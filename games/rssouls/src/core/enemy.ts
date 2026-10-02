import type { Rng } from '@pv/engine';
import { moveBody, newBody, type Body } from './body';
import { cutActive, phaseOf, startAttack, type AttackRun } from './attack';
import { approach } from './hero';
import type { AttackDef, EnemyDef, EnemySpawn, FeelDef, SimEvent, Solid } from './types';

export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'stagger' | 'dead';

/** A projectile an attack asked for this tick; the sim turns it into a flying object. */
export interface ShotRequest {
  def: AttackDef;
  x: number;
  y: number;
  facing: number;
  /** Where it was aimed (the hero's middle). */
  tx: number;
  ty: number;
}

/** Where the enemy should go and whom it should face this tick. */
export interface EnemyTarget {
  x: number;
  y: number;
  alive: boolean;
  /** Stand-off point (flanking); defaults to `x`. */
  goalX?: number;
}

/**
 * One enemy, driven by its `EnemyDef` alone: patrol, notice, chase, telegraph, strike, recover.
 *
 * The telegraph is the attack's wind-up – the readable warning UEBERGABE §6.5 puts at the centre
 * of the fight. Hits do not interrupt it; only a broken poise (stagger) or a parry does.
 */
export class Enemy {
  readonly body: Body;
  facing = -1;
  hp: number;
  poise: number;
  state: EnemyState = 'patrol';
  stateT = 0;
  attack: AttackRun | null = null;
  cooldown = 0.6;
  freeze = 0;
  pendingKb = 0;
  /** Seconds since poise was last taken. */
  sincePoise = 99;
  /** Projectiles requested this tick (drained by the sim). */
  shots: ShotRequest[] = [];
  /** Elite version (high Heat): more life, harder hits. */
  elite = false;
  dmgMul = 1;
  /** The phase reached so far (1 = none crossed); each change pauses the fight once, for breath. */
  phaseSeen = 1;
  private dir = 1;

  constructor(
    readonly def: EnemyDef,
    readonly spawn: EnemySpawn,
  ) {
    this.body = newBody(spawn.x, spawn.y, def.w, def.h);
    this.hp = def.hp;
    this.poise = def.poise;
    this.state = this.startState();
  }

  private startState(): EnemyState {
    if (this.def.boss) return 'idle';
    return this.spawn.awake ? 'chase' : 'patrol';
  }

  /** The hero's traits acting on this enemy: how far it sees, how long it winds up. */
  sightMul = 1;
  telegraphMul = 1;
  /** Life multiplier of this instance (Glut-Grad, elite). */
  hpMul = 1;

  /** The elite version (UEBERGABE §6.5): +30 % life, +45 % damage. */
  makeElite() {
    if (this.elite) return;
    this.elite = true;
    this.dmgMul = 1.45;
    this.toughen(1.3);
  }

  /** More life for this instance (and keeps the current share of it). */
  toughen(mul: number) {
    this.hpMul *= mul;
    this.hp = Math.round(this.hp * mul);
  }

  get maxHp() {
    return Math.round(this.def.hp * this.hpMul);
  }

  /** Wakes it up (a call for help, a boss arena). */
  wake() {
    if (this.state === 'idle' || this.state === 'patrol') this.setState('chase');
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** Below the phase-2 threshold, if the def has one. */
  get enraged() {
    return this.phase > 1;
  }

  /** The phase the life is in: 1, then one more for each threshold crossed. */
  get phase(): number {
    let n = 1;
    for (const p of this.phaseDefs()) if (this.hp <= this.maxHp * p.below) n++;
    return n;
  }

  private phaseDefs() {
    return [...(this.def.phase2 ? [this.def.phase2] : []), ...(this.def.phases ?? [])];
  }

  /** The current phase's numbers (telegraph and speed multipliers). */
  private phaseDef() {
    return this.phaseDefs()[this.phase - 2];
  }

  reset() {
    Object.assign(this.body, newBody(this.spawn.x, this.spawn.y, this.def.w, this.def.h));
    this.hp = this.def.hp;
    this.poise = this.def.poise;
    this.state = this.startState();
    this.stateT = 0;
    this.shots = [];
    this.phaseSeen = 1;
    this.attack = null;
    this.cooldown = 0.6;
    this.freeze = this.pendingKb = 0;
    this.sincePoise = 99;
    this.facing = -1;
    this.dir = 1;
  }

  setState(s: EnemyState) {
    this.state = s;
    this.stateT = 0;
    if (s !== 'attack') this.attack = null;
  }

  /** Takes poise; returns true if that broke it (the enemy is now staggered). */
  takePoise(amount: number, stagger: number): boolean {
    this.sincePoise = 0;
    this.poise -= amount;
    if (this.poise > 0) return false;
    this.stagger(stagger);
    return true;
  }

  stagger(seconds: number) {
    this.poise = this.def.poise;
    this.setState('stagger');
    this.stateT = -seconds;
  }

  step(dt: number, target: EnemyTarget, solids: readonly Solid[], feel: FeelDef, rng: Rng, index: number, events: SimEvent[]) {
    const b = this.body;
    if (this.freeze > 0) {
      this.freeze -= dt;
      b.px = b.x;
      b.py = b.y;
      if (this.freeze <= 0 && this.pendingKb) {
        b.vx = this.pendingKb;
        this.pendingKb = 0;
      }
      return;
    }
    this.stateT += dt;
    this.sincePoise += dt;
    if (this.sincePoise > this.def.poiseDelay) this.poise = Math.min(this.def.poise, this.poise + this.def.poise * 2 * dt);

    if (this.phase > this.phaseSeen && this.alive) {
      // the armour cracks: a pause to breathe, then the next phase
      this.phaseSeen = this.phase;
      this.stagger(2);
      events.push({ type: 'phase', enemy: index });
    }
    const dx = target.x - b.x;
    const dist = Math.abs(dx);
    const dy = Math.abs(target.y - b.y);
    const speedMul = this.phaseDef()?.speedMul ?? 1;
    switch (this.state) {
      case 'idle':
        b.vx = approach(b.vx, 0, 600 * dt);
        this.facing = dx >= 0 ? 1 : -1;
        break;
      case 'dead':
        b.vx = approach(b.vx, 0, 600 * dt);
        break;
      case 'stagger':
        // stateT counts up from -duration to 0
        b.vx = approach(b.vx, 0, 500 * dt);
        if (this.stateT >= 0) this.setState('chase');
        break;
      case 'patrol': {
        const [a, z] = this.spawn.patrol;
        if (b.x <= a) this.dir = 1;
        else if (b.x >= z) this.dir = -1;
        if (b.wallL) this.dir = 1;
        if (b.wallR) this.dir = -1;
        b.vx = approach(b.vx, this.dir * this.def.patrolSpeed, 600 * dt);
        this.facing = this.dir;
        if (target.alive && dist < this.def.sight * this.sightMul && dy < 90) {
          this.setState('chase');
          if (this.def.callsHelp) events.push({ type: 'call', enemy: index });
        }
        break;
      }
      case 'chase': {
        // a boss never gives up; everybody else does beyond the outer radius
        if (!target.alive || (!this.def.boss && dist > this.def.lose)) {
          this.setState(this.def.boss ? 'idle' : 'patrol');
          break;
        }
        this.facing = dx >= 0 ? 1 : -1;
        this.cooldown -= dt;
        const goal = target.goalX ?? target.x;
        const toGoal = goal - b.x;
        const close = this.closestRange();
        const want = Math.abs(toGoal) > close * 0.8 ? Math.sign(toGoal) * this.def.chaseSpeed * speedMul : 0;
        b.vx = approach(b.vx, want, 900 * dt);
        if (this.cooldown <= 0 && (b.onGround || this.def.flying)) {
          const pick = this.pickAttack(dist, dy, rng);
          if (pick) {
            const mul = (this.phaseDef()?.telegraphMul ?? 1) * this.telegraphMul;
            this.attack = startAttack(pick, mul);
            this.state = 'attack';
            this.stateT = 0;
            events.push({ type: 'telegraph', enemy: index, attack: pick.id, parryable: !!pick.parryable });
          }
        }
        break;
      }
      case 'attack': {
        const run = this.attack;
        if (!run) {
          this.setState('chase');
          break;
        }
        const before = phaseOf(run);
        run.t += dt;
        const phase = phaseOf(run);
        if (before === 'windup' && phase === 'active') {
          events.push({ type: 'swing', who: index, attack: run.def.id });
          if (run.def.projectile) {
            const front = b.x + (this.facing * b.w) / 2;
            this.shots.push({ def: run.def, x: front, y: b.y + b.h * 0.6, facing: this.facing, tx: target.x, ty: target.y + 25 });
          }
          if (run.def.leap) {
            b.vx = this.facing * run.def.leap.vx;
            b.vy = run.def.leap.vy;
            b.onGround = false;
          }
        }
        if (phase === 'windup') b.vx = approach(b.vx, 0, 1200 * dt);
        else if (phase === 'active' && run.def.lunge) b.vx = this.facing * run.def.lunge;
        else if (phase !== 'active' && b.onGround) b.vx = approach(b.vx, 0, 900 * dt);
        if (phase === 'done') {
          const next = run.def.next ? this.def.attacks.find((a) => a.id === run.def.next) : undefined;
          if (next && target.alive) {
            // a combo: the next link follows at once, with its own telegraph
            this.facing = dx >= 0 ? 1 : -1;
            this.attack = startAttack(next, this.phaseDef()?.telegraphMul ?? 1);
            this.stateT = 0;
            events.push({ type: 'telegraph', enemy: index, attack: next.id, parryable: !!next.parryable });
            break;
          }
          this.cooldown = rng.range(this.def.cooldown[0], this.def.cooldown[1]) / speedMul;
          this.setState('chase');
        }
        break;
      }
    }

    if (this.def.flying && this.state !== 'dead') {
      // hovers back to its height; a leap is a dive that climbs back
      b.vy = approach(b.vy, (this.spawn.y - b.y) * 3, 900 * dt);
    } else {
      b.vy -= feel.gravity * (b.vy < 0 ? feel.fallGravity : 1) * dt;
      b.vy = Math.max(b.vy, -feel.maxFall);
    }
    const wasGround = b.onGround;
    moveBody(b, solids, dt);
    // a leap ends where it lands
    if (b.onGround && !wasGround && this.attack?.def.leap) cutActive(this.attack);
  }

  private closestRange(): number {
    let r = Infinity;
    for (const a of this.def.attacks) r = Math.min(r, a.range?.[1] ?? 40);
    return Math.max(24, r);
  }

  /** The first attack whose distance band holds the target; ties broken by the seeded rng. */
  private pickAttack(dist: number, dy: number, rng: Rng): AttackDef | null {
    const phase = this.phase;
    const fits = this.def.attacks.filter((a) => {
      // `phase: n` is that phase only; `minPhase: n` that one and all after
      if (a.phase && a.phase !== phase) return false;
      if (a.minPhase && phase < a.minPhase) return false;
      // combo links are only reached through their chain
      if (this.def.attacks.some((o) => o.next === a.id)) return false;
      const [lo, hi] = a.range ?? [0, 50];
      const reachY = this.def.flying ? 220 : a.projectile ? 160 : a.leap ? 90 : a.around ? 60 : 40;
      return dist >= lo && dist <= hi && dy < reachY;
    });
    if (!fits.length) return null;
    return fits.length === 1 ? fits[0]! : rng.pick(fits);
  }
}

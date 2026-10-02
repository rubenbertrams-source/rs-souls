import { moveBody, newBody, type Body } from './body';
import { cutActive, phaseOf, recoveryElapsed, startAttack, windupOf, type AttackRun } from './attack';
import type { AttackDef, Command, FeelDef, HeroDef, SimEvent, Solid, WeaponDef } from './types';
import { NO_COMMAND, SKILL2_STAGE } from './types';
import type { Traits } from './sim';

export type HeroState =
  | 'move'
  | 'roll'
  | 'attack'
  | 'charge'
  | 'block'
  | 'guardBreak'
  | 'hurt'
  | 'drink'
  | 'rest'
  | 'dash'
  | 'dead';

/** What became of an incoming attack. */
export type Outcome = 'ignored' | 'dodged' | 'parried' | 'blocked' | 'guardBreak' | 'hit';

/** The air dash: a short burst through the air, invulnerable while it lasts. */
export const DASH = { time: 0.18, speed: 520, cost: 18 };
/** A wall jump pushes away from the wall and holds the stick off for a moment. */
export const WALL_JUMP = { vx: 260, lock: 0.18, slide: 120 };

/** Drinking a flask: the heal lands at `at`, the whole drink takes `time`. */
export const DRINK = { time: 0.85, at: 0.5, speed: 0.3 };
/** Seconds a tar hit slows the hero and glues the roll. */
export const TAR_TIME = 3;
export const BURN_TIME = 3;
export const BURN_DPS = 4;

/**
 * The player's figure: movement, the roll, the weapon's chain, block and parry, the flask.
 *
 * One state at a time, and every state says what it lets through. Presses are derived from the
 * held states of the `Command` against the previous tick, so a bot, a test script and a gamepad
 * all drive it the same way.
 */
export class Hero {
  readonly body: Body;
  facing = 1;
  hp: number;
  stamina: number;
  /** Life and stamina caps and the damage multiplier – the progression writes these. */
  maxHp: number;
  maxStamina: number;
  power = 1;
  state: HeroState = 'move';
  /** Seconds in the current state. */
  stateT = 0;
  attack: AttackRun | null = null;
  /** The running attack is the weapon ability. */
  attackIsSkill = false;
  /** Seconds the attack button has been held through a charge. */
  chargeT = 0;
  /** Hitstop: the figure is frozen while this runs. */
  freeze = 0;
  /** Knockback held back until the hitstop is over. */
  pendingKb = 0;
  /** After a parry: the next hit deals riposte damage while this runs. */
  riposteT = 0;
  /** Healing flasks left, and how much one heals. */
  flasks = 3;
  flasksMax = 3;
  flaskHeal = 55;
  /** Status effects. */
  tarT = 0;
  burnT = 0;
  /** Two weapon slots; `slot` is the one in hand. */
  weapons: [WeaponDef, WeaponDef | null];
  slot: 0 | 1 = 0;
  /** Ability cooldowns by weapon id. */
  skillCd: Record<string, number> = {};
  /** The interact button went down this tick – the sim decides what it touches. */
  interactP = false;
  /** Weapon skills do not work here (a dead zone without pure light). */
  skillLocked = false;
  /** A ward (second ability) runs: incoming damage is scaled while it lasts. */
  wardT = 0;
  wardMul = 1;
  /** Projectiles the hero's attacks asked for this tick (drained by the sim). */
  shotsOut: { def: AttackDef; x: number; y: number; facing: number }[] = [];
  /** Folk, class and run traits, combined (set by the sim; absent for a bare hero in tests). */
  traits?: Traits;
  /** Upgrade stage per weapon id: each stage adds damage. */
  upgrades: Record<string, number> = {};
  /** Run modifiers acting on the hero: a wider parry window, cheaper or dearer actions. */
  parryAdd = 0;
  costMul = 1;
  /** Movement abilities learnt for good (UEBERGABE §7: they belong to no class). */
  abilities = { double: false, dash: false, wall: false };
  private airJumps = 0;
  private airDash = 0;
  private wallLockT = 0;
  /** Last spot the hero stood safely on, for a death by falling. */
  safe = { x: 0, y: 0 };
  /** Set when the block was raised by a fresh press – only then does the parry window open. */
  private freshBlock = false;
  private coyoteT = 0;
  private jumpBufT = 0;
  private attackBufT = 0;
  private rising = false;
  /** The attack button has stayed down since the current attack began (a charge needs that). */
  private heldSinceStart = false;
  private healed = false;
  private sinceSpend = 99;
  private prev: Command = NO_COMMAND;

  constructor(
    readonly def: HeroDef,
    readonly feel: FeelDef,
    weapon: WeaponDef,
    x: number,
    y: number,
  ) {
    this.body = newBody(x, y, def.w, def.h);
    this.maxHp = def.hp;
    this.maxStamina = def.stamina;
    this.hp = def.hp;
    this.stamina = def.stamina;
    this.weapons = [weapon, null];
    this.safe = { x, y };
  }

  get weapon(): WeaponDef {
    return this.weapons[this.slot] ?? this.weapons[0];
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** Inside the roll's invulnerability window (a rest is safe too: nothing reaches the light). */
  get invulnerable() {
    const r = this.feel.roll;
    return (this.state === 'roll' && this.stateT >= r.iStart && this.stateT < r.iEnd) || this.state === 'rest' || this.state === 'dash';
  }

  get blocking() {
    return this.state === 'block';
  }

  /** The opening moment of a block, in which a parryable attack is parried. */
  get parryOpen() {
    const b = this.weapon.moveset.block;
    return this.state === 'block' && this.freshBlock && !!b && this.stateT < b.parry + this.parryAdd;
  }

  /** Puts the hero somewhere new, whole again or as it is. */
  place(x: number, y: number, restore: boolean) {
    const vx = this.body.vx;
    Object.assign(this.body, newBody(x, y, this.def.w, this.def.h));
    this.safe = { x, y };
    if (!restore) {
      this.body.vx = vx;
      return;
    }
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.flasks = this.flasksMax;
    this.tarT = this.burnT = this.wardT = 0;
    this.shotsOut = [];
    this.facing = 1;
    this.setState('move');
    this.freeze = this.pendingKb = this.riposteT = 0;
    this.coyoteT = this.jumpBufT = this.attackBufT = 0;
    this.skillCd = {};
    this.prev = NO_COMMAND;
  }

  /** Back at full strength on the spot (training room, tests). */
  respawn(x: number, y: number) {
    this.place(x, y, true);
  }

  step(cmd: Command, dt: number, solids: readonly Solid[], smog: boolean, events: SimEvent[]) {
    const f = this.feel;
    const jumpP = cmd.jump && !this.prev.jump;
    const rollP = cmd.roll && !this.prev.roll;
    const attackP = cmd.attack && !this.prev.attack;
    const blockP = cmd.block && !this.prev.block;
    const healP = cmd.heal && !this.prev.heal;
    const swapP = cmd.swap && !this.prev.swap;
    const skillP = cmd.skill && !this.prev.skill;
    this.interactP = cmd.interact && !this.prev.interact;
    this.prev = { ...cmd };
    this.jumpBufT = jumpP ? f.jumpBuffer : Math.max(0, this.jumpBufT - dt);
    this.attackBufT = attackP ? f.attackBuffer : Math.max(0, this.attackBufT - dt);
    if (blockP) this.freshBlock = true;
    if (!cmd.block) this.freshBlock = false;

    if (this.freeze > 0) {
      this.freeze -= dt;
      this.body.px = this.body.x;
      this.body.py = this.body.y;
      if (this.freeze <= 0 && this.pendingKb) {
        this.body.vx = this.pendingKb;
        this.pendingKb = 0;
      }
      return;
    }

    this.stateT += dt;
    this.riposteT = Math.max(0, this.riposteT - dt);
    this.tarT = Math.max(0, this.tarT - dt);
    this.wardT = Math.max(0, this.wardT - dt);
    for (const k of Object.keys(this.skillCd)) this.skillCd[k] = Math.max(0, (this.skillCd[k] ?? 0) - dt);
    if (this.burnT > 0 && this.alive) {
      this.burnT = Math.max(0, this.burnT - dt);
      this.hp = Math.max(0, this.hp - BURN_DPS * dt);
      if (this.hp <= 0) this.setState('dead');
    }
    this.sinceSpend += dt;
    if (this.sinceSpend > this.def.staminaDelay && this.alive) {
      const rate = this.def.staminaRegen * (smog ? 0.5 : 1) * (this.state === 'block' ? 0.5 : 1);
      this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
    }

    const ms = this.weapon.moveset;
    const b = this.body;
    switch (this.state) {
      case 'dead':
      case 'rest':
        b.vx = approach(b.vx, 0, 900 * dt);
        break;
      case 'hurt':
        if (this.stateT >= f.hurtLock) this.setState('move');
        break;
      case 'guardBreak':
        b.vx = approach(b.vx, 0, 900 * dt);
        if (this.stateT >= f.guardBreak) this.setState('move');
        break;
      case 'dash':
        b.vx = this.facing * DASH.speed;
        b.vy = 0;
        if (this.stateT >= DASH.time) {
          b.vx *= 0.4;
          this.setState('move');
        }
        break;
      case 'roll':
        b.vx = this.facing * f.roll.speed * (this.tarT > 0 ? 0.5 : 1);
        if (this.stateT >= f.roll.time) {
          b.vx *= 0.35;
          this.setState('move');
        }
        break;
      case 'drink':
        this.run(cmd, dt, DRINK.speed);
        if (!this.healed && this.stateT >= DRINK.at) {
          this.healed = true;
          const amount = Math.min(this.flaskHeal, this.maxHp - this.hp);
          this.hp += amount;
          events.push({ type: 'heal', amount });
        }
        if (this.stateT >= DRINK.time) this.setState('move');
        break;
      case 'charge':
        b.vx = approach(b.vx, 0, 1400 * dt);
        this.chargeT += dt;
        if (Math.abs(cmd.x) > 0.3) this.facing = Math.sign(cmd.x);
        if (!cmd.attack) {
          const heavy = ms.charge ? ms.attacks[ms.charge] : undefined;
          if (heavy && this.chargeT >= ms.chargeTime) {
            this.spend(heavy.cost);
            this.attack = startAttack(heavy);
            // the hold was the wind-up
            this.attack.t = heavy.windup;
            events.push({ type: 'swing', who: 'hero', attack: heavy.id });
          } else if (this.attack) {
            events.push({ type: 'swing', who: 'hero', attack: this.attack.def.id });
          }
          this.state = 'attack';
        }
        break;
      case 'attack':
        this.stepAttack(cmd, dt, rollP, events);
        break;
      case 'block':
        if (!cmd.block || !ms.block) {
          this.setState('move');
          break;
        }
        this.run(cmd, dt, 0.5);
        if (rollP && b.onGround && this.stamina > 0) this.startRoll(cmd, events);
        else if (this.attackBufT > 0 && this.stamina > 0) this.chooseAttack(cmd, events);
        break;
      case 'move':
        this.stepMove(cmd, dt, { rollP, healP, swapP, skillP }, events);
        break;
    }

    // gravity, the jump cut, the move
    if (this.rising && (!cmd.jump || b.vy <= 0)) {
      if (b.vy > 0) b.vy *= f.jumpCut;
      this.rising = false;
    }
    if (this.state !== 'dash') {
      b.vy -= f.gravity * (b.vy < 0 ? f.fallGravity : 1) * dt;
      b.vy = Math.max(b.vy, -f.maxFall);
      // pressing into a wall with the wall jump learnt: slide down it slowly
      const pressing = (b.wallL && cmd.x < -0.3) || (b.wallR && cmd.x > 0.3);
      if (this.abilities.wall && pressing && !b.onGround && b.vy < -WALL_JUMP.slide) b.vy = -WALL_JUMP.slide;
    }
    this.wallLockT = Math.max(0, this.wallLockT - dt);
    const wasGround = b.onGround;
    moveBody(b, solids, dt);
    if (b.onGround) {
      this.airJumps = 1;
      this.airDash = 1;
      this.coyoteT = f.coyote;
      if (this.alive) this.safe = { x: b.x, y: b.y };
    } else this.coyoteT = Math.max(0, this.coyoteT - dt);
    if (b.onGround && !wasGround) {
      events.push({ type: 'land' });
      // an air attack ends with the landing, a plunge lands into its recovery
      const air = ms.air ? ms.attacks[ms.air] : undefined;
      if (this.attack && this.state === 'attack' && this.attack.def === air) {
        this.attack = null;
        this.setState('move');
      } else if (this.attack && this.state === 'attack' && this.attack.def.leap) {
        cutActive(this.attack);
      }
    }
  }

  private stepMove(
    cmd: Command,
    dt: number,
    p: { rollP: boolean; healP: boolean; swapP: boolean; skillP: boolean },
    events: SimEvent[],
  ) {
    const f = this.feel;
    const b = this.body;
    const ms = this.weapon.moveset;
    this.run(cmd, dt, 1);
    if (this.jumpBufT > 0 && (b.onGround || this.coyoteT > 0)) {
      this.jumpBufT = 0;
      this.coyoteT = 0;
      if (cmd.y < -0.5 && b.onOneWay) {
        b.dropT = 0.25;
        b.onGround = false;
      } else {
        b.vy = f.jumpSpeed * (this.tarT > 0 ? 0.8 : 1);
        this.rising = true;
        events.push({ type: 'jump' });
      }
      return;
    }
    if (this.jumpBufT > 0 && !b.onGround) {
      if (this.abilities.wall && (b.wallL || b.wallR)) {
        // off the wall, away from it
        const away = b.wallL ? 1 : -1;
        this.jumpBufT = 0;
        b.vy = f.jumpSpeed * 0.95;
        b.vx = away * WALL_JUMP.vx;
        this.facing = away;
        this.wallLockT = WALL_JUMP.lock;
        this.rising = true;
        events.push({ type: 'jump' });
        return;
      }
      if (this.abilities.double && this.airJumps > 0) {
        this.jumpBufT = 0;
        this.airJumps--;
        b.vy = f.jumpSpeed * 0.88;
        this.rising = true;
        events.push({ type: 'jump' });
        return;
      }
    }
    if (p.rollP && !b.onGround && this.abilities.dash && this.airDash > 0 && this.stamina > 0) {
      if (Math.abs(cmd.x) > 0.3) this.facing = Math.sign(cmd.x);
      this.airDash--;
      this.spend(DASH.cost);
      this.setState('dash');
      events.push({ type: 'roll' });
      return;
    }
    if (p.rollP && b.onGround && this.stamina > 0) return this.startRoll(cmd, events);
    if (p.healP && this.flasks > 0 && b.onGround) {
      this.flasks--;
      this.healed = false;
      this.setState('drink');
      return;
    }
    if (p.swapP && this.weapons[1]) {
      this.slot = this.slot === 0 ? 1 : 0;
      events.push({ type: 'swap', weapon: this.weapon.id });
      return;
    }
    // up + the ability button: the second ability, once the weapon is upgraded far enough
    const skill2 = this.weapon.skill2;
    const key2 = `${this.weapon.id}#2`;
    if (p.skillP && cmd.y > 0.5 && skill2 && !this.skillLocked && (this.upgrades[this.weapon.id] ?? 0) >= SKILL2_STAGE && (this.skillCd[key2] ?? 0) <= 0 && this.stamina > 0) {
      this.skillCd[key2] = skill2.cooldown * (this.traits?.skillCdMul ?? 1);
      events.push({ type: 'skill', who: 'hero', id: skill2.id });
      if (skill2.ward) {
        this.spend(skill2.cost);
        this.wardT = skill2.ward.time;
        this.wardMul = skill2.ward.damageMul;
        return;
      }
      if (skill2.attack) {
        this.beginAttack(skill2.attack, cmd, events);
        this.attackIsSkill = true;
      }
      return;
    }
    const skill = this.weapon.skill;
    if (p.skillP && skill && !this.skillLocked && (this.skillCd[this.weapon.id] ?? 0) <= 0 && this.stamina > 0) {
      // from the second upgrade stage on the ability comes back a third sooner
      this.skillCd[this.weapon.id] = skill.cooldown * ((this.upgrades[this.weapon.id] ?? 0) >= 2 ? 0.7 : 1) * (this.traits?.skillCdMul ?? 1);
      this.beginAttack(skill.attack, cmd, events);
      this.attackIsSkill = true;
      events.push({ type: 'skill', who: 'hero', id: skill.attack.id });
      return;
    }
    if (cmd.block && ms.block && b.onGround) {
      this.setState('block');
      b.vx *= 0.5;
      return;
    }
    if (this.attackBufT > 0 && this.stamina > 0) this.chooseAttack(cmd, events);
  }

  private stepAttack(cmd: Command, dt: number, rollP: boolean, events: SimEvent[]) {
    const run = this.attack;
    const b = this.body;
    const ms = this.weapon.moveset;
    if (!run) return this.setState('move');
    if (!cmd.attack) this.heldSinceStart = false;
    const before = phaseOf(run);
    run.t += dt;
    const phase = phaseOf(run);
    // turning is allowed while winding up, never once the blade is out
    if (phase === 'windup' && Math.abs(cmd.x) > 0.3) this.facing = Math.sign(cmd.x);

    // holding through the opening wind-up of the chain turns into a charge
    if (before === 'windup' && phase !== 'windup' && this.heldSinceStart && ms.charge && run.def.id === ms.start && b.onGround) {
      run.t = windupOf(run);
      this.chargeT = run.t;
      this.state = 'charge';
      return;
    }
    if (before === 'windup' && phase === 'active') {
      events.push({ type: 'swing', who: 'hero', attack: run.def.id });
      if (run.def.projectile) this.shotsOut.push({ def: run.def, x: b.x + (this.facing * b.w) / 2, y: b.y + b.h * 0.6, facing: this.facing });
      if (run.def.leap) {
        b.vx = this.facing * run.def.leap.vx;
        b.vy = run.def.leap.vy;
      }
    }
    if (phase === 'active' && run.def.leap) {
      // a plunge keeps its own fall
    } else if (phase === 'active') {
      if (run.def.lunge) b.vx = this.facing * run.def.lunge;
      else b.vx = approach(b.vx, 0, 1200 * dt);
    } else if (b.onGround) {
      b.vx = approach(b.vx, 0, 1200 * dt);
    }

    if (phase === 'recovery') {
      const rec = recoveryElapsed(run);
      const next = run.def.next ? ms.attacks[run.def.next] : undefined;
      if (next && this.attackBufT > 0 && rec <= (run.def.comboWindow ?? 0) && this.stamina > 0) {
        this.attackBufT = 0;
        this.beginAttack(next, cmd, events);
        return;
      }
      if (rollP && b.onGround && this.stamina > 0 && rec >= run.def.recovery * this.feel.rollCancel) {
        this.startRoll(cmd, events);
        return;
      }
    }
    if (phase === 'done') {
      this.attack = null;
      this.setState('move');
    }
  }

  private run(cmd: Command, dt: number, mul: number) {
    const b = this.body;
    const f = this.feel;
    if (this.wallLockT > 0) return;
    const slow = this.tarT > 0 ? 0.55 : 1;
    const target = clampAxis(cmd.x) * f.runSpeed * this.weapon.moveset.speed * mul * slow;
    b.vx = approach(b.vx, target, (b.onGround ? f.groundAccel : f.airAccel) * dt);
    if (Math.abs(cmd.x) > 0.3 && this.state !== 'block') this.facing = Math.sign(cmd.x);
  }

  private startRoll(cmd: Command, events: SimEvent[]) {
    if (Math.abs(cmd.x) > 0.3) this.facing = Math.sign(cmd.x);
    this.spend(this.feel.roll.cost * (this.tarT > 0 ? 1.5 : 1) * (this.traits?.rollCostMul ?? 1));
    this.attack = null;
    this.setState('roll');
    events.push({ type: 'roll' });
  }

  private chooseAttack(cmd: Command, events: SimEvent[]) {
    this.attackBufT = 0;
    const ms = this.weapon.moveset;
    let id = ms.start;
    // down in the air is the plunge; down on the ground has no variant of its own
    if (!this.body.onGround) id = cmd.y < -0.5 && ms.down ? ms.down : (ms.air ?? ms.start);
    else if (cmd.y > 0.5) id = ms.up ?? ms.start;
    const def = ms.attacks[id];
    if (def) this.beginAttack(def, cmd, events);
  }

  private beginAttack(def: AttackDef, cmd: Command, events: SimEvent[]) {
    if (Math.abs(cmd.x) > 0.3) this.facing = Math.sign(cmd.x);
    this.spend(def.cost);
    this.attack = startAttack(def);
    this.attackIsSkill = false;
    this.heldSinceStart = cmd.attack;
    this.setState('attack');
    // a chain link with no wind-up is out at once; the rest announce themselves in stepAttack
    if (windupOf(this.attack) <= 0) events.push({ type: 'swing', who: 'hero', attack: def.id });
  }

  spend(cost: number) {
    this.stamina = Math.max(0, this.stamina - cost * this.costMul);
    this.sinceSpend = 0;
  }

  setState(s: HeroState) {
    this.state = s;
    this.stateT = 0;
    if (s !== 'attack' && s !== 'charge') this.attack = null;
  }

  /** Deals damage that no block can stop (hazards, burning). */
  hurt(damage: number, kb: number) {
    if (!this.alive || this.invulnerable) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.pendingKb = kb;
    this.body.vy = Math.max(this.body.vy, 220);
    this.setState(this.hp <= 0 ? 'dead' : 'hurt');
    return true;
  }

  /**
   * An enemy attack reaches the hero. Decides between dodge, parry, block, guard break and hit,
   * and applies the consequence to the hero; the attacker's side is the caller's business.
   */
  receive(damage: number, knockback: number, fromX: number, parryable: boolean, effect?: 'tar' | 'burn'): Outcome {
    if (!this.alive) return 'ignored';
    if (this.wardT > 0) damage *= this.wardMul;
    if (this.invulnerable) return 'dodged';
    const facingIt = (fromX - this.body.x) * this.facing >= 0;
    const block = this.weapon.moveset.block;
    const dir = fromX < this.body.x ? 1 : -1;
    if (this.state === 'block' && block && facingIt) {
      if (parryable && this.parryOpen) {
        this.riposteT = this.feel.riposte.window;
        return 'parried';
      }
      const taken = damage * (1 - Math.min(0.95, block.reduction + (this.traits?.blockAdd ?? 0)));
      const cost = damage * this.feel.blockCostPerDamage;
      this.hp = Math.max(0, this.hp - taken);
      this.pendingKb = dir * knockback * 0.4;
      if (this.stamina >= cost) {
        this.spend(cost);
        if (this.hp <= 0) this.setState('dead');
        return 'blocked';
      }
      this.spend(this.stamina);
      this.setState(this.hp <= 0 ? 'dead' : 'guardBreak');
      return 'guardBreak';
    }
    this.hp = Math.max(0, this.hp - damage);
    this.pendingKb = dir * knockback;
    this.body.vy = Math.max(this.body.vy, 120);
    if (effect === 'tar') this.tarT = TAR_TIME;
    if (effect === 'burn') this.burnT = BURN_TIME;
    this.setState(this.hp <= 0 ? 'dead' : 'hurt');
    return 'hit';
  }
}

export function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

function clampAxis(v: number) {
  return Math.abs(v) < 0.2 ? 0 : Math.max(-1, Math.min(1, v));
}

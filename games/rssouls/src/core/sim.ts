import { Rng, StateHasher } from '@pv/engine';
import { bodyRect, overlaps } from './body';
import { hitbox, phaseOf } from './attack';
import { damageEnemy, enemiesStrike, heroDamage, heroStrikes, resolveOnHero } from './combat';
import { Enemy, type EnemyTarget } from './enemy';
import { Hero } from './hero';
import { GRADES, STAT_GAIN, hasFlag, levelCost, newProgress, setFlag, upgradeCost, type Progress, type Stat } from './progress';
import type {
  AttackDef,
  Command,
  RunMod,
  EnemyDef,
  FeelDef,
  HeroDef,
  LevelDef,
  PropDef,
  Rect,
  RoomDef,
  SimEvent,
  Solid,
  WeaponDef,
} from './types';

export interface SimConfig {
  level: LevelDef;
  hero: HeroDef;
  feel: FeelDef;
  weapons: Record<string, WeaponDef>;
  enemies: Record<string, EnemyDef>;
  startWeapon: string;
  /** Use only the first n enemy spawns of each room (training sandbox). */
  enemyCount?: number;
  /** Kills that end the session; 0 plays on. */
  kills: number;
  infiniteStamina: boolean;
  /** Training room: the dead come back after a few seconds instead of at the next rest. */
  respawnInPlace?: boolean;
  /** World flag that wins the game (the last boss). */
  goal?: string;
  /** Folk and class traits of the hero (UEBERGABE §7.1). */
  traits?: RunMod[];
}

export type Traits = Required<RunMod>;

/** Combines run modifiers (and folk and class traits) into one. */
export function combine(mods: RunMod[]): Traits {
  const out: Traits = {
    hpMul: 1, damageMul: 1, staminaAdd: 0, flaskDelta: 0, currencyMul: 1, enemyDamageMul: 1, parryAdd: 0, costMul: 1,
    blockAdd: 0, chargeMul: 1, skillCdMul: 1, plungeMul: 1, riposteMul: 1, rollCostMul: 1, poiseMul: 1, wallMul: 1,
    sightMul: 1, telegraphMul: 1, smogImmune: false, deadZoneImmune: false, darkSight: false, pureMul: 1,
  };
  for (const m of mods) {
    out.blockAdd += m.blockAdd ?? 0;
    out.chargeMul *= m.chargeMul ?? 1;
    out.skillCdMul *= m.skillCdMul ?? 1;
    out.plungeMul *= m.plungeMul ?? 1;
    out.riposteMul *= m.riposteMul ?? 1;
    out.rollCostMul *= m.rollCostMul ?? 1;
    out.poiseMul *= m.poiseMul ?? 1;
    out.wallMul *= m.wallMul ?? 1;
    out.sightMul *= m.sightMul ?? 1;
    out.telegraphMul *= m.telegraphMul ?? 1;
    out.smogImmune ||= !!m.smogImmune;
    out.deadZoneImmune ||= !!m.deadZoneImmune;
    out.darkSight ||= !!m.darkSight;
    out.pureMul *= m.pureMul ?? 1;
    out.hpMul *= m.hpMul ?? 1;
    out.damageMul *= m.damageMul ?? 1;
    out.staminaAdd += m.staminaAdd ?? 0;
    out.flaskDelta += m.flaskDelta ?? 0;
    out.currencyMul *= m.currencyMul ?? 1;
    out.enemyDamageMul *= m.enemyDamageMul ?? 1;
    out.parryAdd += m.parryAdd ?? 0;
    out.costMul *= m.costMul ?? 1;
  }
  return out;
}

/** Seconds a dead enemy lies before it comes back (training), and the hero before the respawn. */
export const ENEMY_RESPAWN = 3;
export const HERO_RESPAWN = 2.5;
/** Share of life a fall into a pit costs; the hero is put back at the last safe spot. */
export const PIT_COST = 0.15;
/** Stamina a successful parry gives back. */
export const PARRY_BREATH = 20;
/** How close the hero has to be to use a rest, lever or pick-up. */
export const REACH = 40;

/** A flying object: a thrown scrap, a spat glob of tar, a deflected one going back. */
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  gravity: number;
  life: number;
  solid: boolean;
  damage: number;
  knockback: number;
  parryable: boolean;
  effect?: 'tar' | 'burn';
  /** Enemy index that fired it, or -1 once the hero has parried it back. */
  owner: number;
  dead: boolean;
}

/**
 * The world as it is played: one room at a time, its enemies, its pieces, the hero's progress.
 *
 * Like every Partyverse simulation it knows no Three.js, DOM or clock: `step()` is the one
 * measure of time, and the same seed with the same commands plays the same run in Vitest.
 */
export class Sim {
  readonly hero: Hero;
  enemies: Enemy[] = [];
  room!: RoomDef;
  readonly progress: Progress;
  shots: Shot[] = [];
  /** What happened during the last `step()`. */
  events: SimEvent[] = [];
  time = 0;
  over = false;
  /** The run was won (goal flag reached). */
  won = false;
  /** Enemies slain since the last rest, as `room#index`. */
  readonly slain = new Set<string>();
  /** The entry the hero came in by – a death in an arena leaves the cell here. */
  private arrival = { x: 0, y: 0 };
  /** Per-enemy seconds dead (training respawn). */
  private deadT: number[] = [];
  private heroDeadT = 0;
  private hazardCd = 0;
  /** The run's modifiers (dice run cards). */
  mods: RunMod[] = [];
  /** Heat (Ascheburg): 0–10, starts every session at 0. */
  heat = 0;
  private heatT = 0;
  /** Running wave of the room's cauldron (-1: none running). */
  waveIndex = -1;
  /** Index in `enemies` where the running wave's spawns begin. */
  private waveFrom = 0;
  private rng: Rng;

  constructor(
    public cfg: SimConfig,
    seed: number,
    progress?: Progress,
  ) {
    this.rng = new Rng(seed);
    this.progress = progress ?? newProgress(cfg.startWeapon);
    const w = cfg.weapons[this.progress.slots[0]] ?? cfg.weapons[cfg.startWeapon]!;
    this.hero = new Hero(cfg.hero, cfg.feel, w, 0, 0);
    this.applyProgress();
    const start = this.progress.rest ? this.restSpot(this.progress.rest.room, this.progress.rest.id) : null;
    if (start) this.enterRoom(start.room, null, start.x, start.y);
    else this.enterRoom(cfg.level.start.room, cfg.level.start.at);
    this.hero.place(this.hero.body.x, this.hero.body.y, true);
  }

  get kills() {
    return this.progress.kills;
  }

  get deaths() {
    return this.progress.deaths;
  }

  /** Copies levels, flasks and weapons from the progress onto the hero. */
  applyProgress() {
    const p = this.progress;
    const h = this.hero;
    const m = this.traits();
    h.traits = m;
    h.maxHp = Math.round((this.cfg.hero.hp + p.levels.vit * STAT_GAIN.vit) * m.hpMul);
    h.maxStamina = this.cfg.hero.stamina + p.levels.breath * STAT_GAIN.breath + m.staminaAdd;
    h.power = (1 + p.levels.power * STAT_GAIN.power) * m.damageMul;
    h.flasksMax = Math.max(0, p.flasksMax + m.flaskDelta);
    h.parryAdd = m.parryAdd;
    h.upgrades = { ...(p.upgrades ?? {}) };
    h.costMul = m.costMul;
    h.abilities = { double: hasFlag(p, 'faehigkeit:doppelsprung'), dash: hasFlag(p, 'faehigkeit:luftdash'), wall: hasFlag(p, 'faehigkeit:wandsprung') };
    const a = this.cfg.weapons[p.slots[0]];
    const b = p.slots[1] ? this.cfg.weapons[p.slots[1]] : undefined;
    if (a) h.weapons = [a, b ?? null];
    if (!h.weapons[h.slot]) h.slot = 0;
  }

  private restSpot(roomId: string, id: string) {
    const room = this.cfg.level.rooms[roomId];
    const prop = room?.props?.find((p) => p.id === id);
    if (!room || !prop || prop.type !== 'rest') return null;
    return { room: roomId, x: prop.x + 30, y: prop.y };
  }

  /** Moves the hero into a room, at a named entry or at a given spot. */
  enterRoom(id: string, at: string | null, x?: number, y?: number) {
    const room = this.cfg.level.rooms[id];
    if (!room) throw new Error(`rssouls: unknown room ${id}`);
    this.room = room;
    const spot = at ? (room.entries?.[at] ?? room.spawn) : { x: x ?? room.spawn.x, y: y ?? room.spawn.y };
    this.hero.place(spot.x, spot.y, false);
    this.arrival = { x: spot.x, y: spot.y };
    this.shots = [];
    this.waveIndex = -1;
    this.spawnEnemies();
    // the map remembers where the hero has been
    setFlag(this.progress, `seen:${id}`);
    this.events.push({ type: 'room', room: id });
  }

  private spawnEnemies() {
    const room = this.room;
    this.heatSpawns = [];
    const spawns = room.enemies.slice(0, this.cfg.enemyCount ?? room.enemies.length);
    this.enemies = spawns.map((s) => {
      const def = this.cfg.enemies[s.kind];
      if (!def) throw new Error(`rssouls: unknown enemy ${s.kind}`);
      return new Enemy(def, s);
    });
    this.enemies.forEach((e, i) => {
      const gone = this.slain.has(`${room.id}#${i}`) || (e.def.boss && hasFlag(this.progress, bossFlag(room.id, e.def.id)));
      if (gone) e.setState('dead');
      // the dead are gone from the room, not lying in it
      if (gone) e.body.y = -9999;
    });
    this.deadT = this.enemies.map(() => 0);
    if ((this.progress.grade ?? 0) >= 1) for (const e of this.enemies) e.toughen(GRADES.hpMul);
    const harder = combine(this.mods).enemyDamageMul;
    if (harder !== 1) for (const e of this.enemies) e.dmgMul *= harder;
    for (const e of this.enemies) this.dressEnemy(e);
    if (room.heat) {
      // high Heat: the district sends its elites, and at 7 the hunter that follows the hero
      if (this.heat >= 4) for (const e of this.enemies) if (!e.def.boss) e.makeElite();
      if (this.heat >= 7 && this.cfg.enemies['riot-kommandeur']) {
        const far = this.hero.body.x < room.w / 2 ? room.w - 120 : 120;
        const e = new Enemy(this.cfg.enemies['riot-kommandeur'], { kind: 'riot-kommandeur', x: far, y: 0, patrol: [far, far + 1], awake: true });
        this.enemies.push(e);
        this.deadT.push(0);
        this.heatSpawns.push(e);
        this.events.push({ type: 'hunter' });
      }
    }
  }

  /** Enemies the Heat brought into this room (not part of its spawn list). */
  private heatSpawns: Enemy[] = [];

  /** The room's collision: its geometry plus closed gates and walls still standing. */
  solids(): Solid[] {
    const out: Solid[] = [...this.room.solids];
    for (const p of this.room.props ?? []) {
      if (p.type === 'gate' && this.gateClosed(p)) out.push(p.rect);
      if (p.type === 'wall' && !hasFlag(this.progress, `broken:${p.id}`)) out.push(p.rect);
    }
    return out;
  }

  gateClosed(p: Extract<PropDef, { type: 'gate' }>): boolean {
    if (p.arena) return this.bossFight() !== null || this.waveIndex >= 0;
    return !hasFlag(this.progress, `open:${p.id}`);
  }

  /** The awake, living boss of this room, if a fight is on. */
  bossFight(): Enemy | null {
    return this.enemies.find((e) => e.def.boss && e.alive && e.state !== 'idle') ?? null;
  }

  hazardOn(p: Extract<PropDef, { type: 'hazard' }>): boolean {
    if (!p.period) return true;
    return (this.time + (p.phase ?? 0)) % p.period < p.period / 2;
  }

  step(cmd: Command, dt: number) {
    this.events = [];
    if (this.over) return;
    this.time += dt;
    this.progress.time += dt;
    this.hazardCd = Math.max(0, this.hazardCd - dt);
    // Heat sinks with time (one step every 25 s) and at a rest
    if (this.heat > 0) {
      this.heatT += dt;
      if (this.heatT > 25) {
        this.heatT = 0;
        this.heat--;
        this.events.push({ type: 'heat', heat: this.heat });
      }
    }
    const { hero, cfg } = this;
    const solids = this.solids();

    // a dead zone chokes the breath like smog does – unless Korro's pure cell is carried
    const t = hero.traits ?? this.traits();
    const pure = hasFlag(this.progress, 'korro') || t.deadZoneImmune;
    const dead = !!this.room.deadZone && !pure;
    // Glut-Grad 3: the zone gnaws everywhere – the breath comes slow in every room
    const inSmog = (this.progress.grade ?? 0) >= 3 || !!this.room.smog?.some((r) => overlaps(bodyRect(hero.body), r));
    const smog = dead || (inSmog && !t.smogImmune);
    hero.skillLocked = dead;
    hero.step(cmd, dt, solids, smog, this.events);
    if (this.room.pure && hero.alive) {
      // pure light: the breath comes back a good half faster, skills cool down twice as fast
      hero.stamina = Math.min(hero.maxStamina, hero.stamina + this.cfg.hero.staminaRegen * 0.6 * t.pureMul * dt);
      for (const k of Object.keys(hero.skillCd)) hero.skillCd[k] = Math.max(0, (hero.skillCd[k] ?? 0) - dt * t.pureMul);
    }
    if (cfg.infiniteStamina) hero.stamina = hero.maxStamina;

    // the hero's own projectiles (a skill that throws): friendly from the start
    for (const s of hero.shotsOut) {
      const first = this.shots.length;
      this.fire(s.def, s.x, s.y, s.facing, s.x + s.facing * 600, s.y, hero.weapon.damage * hero.power, -1);
      for (const shot of this.shots.slice(first)) shot.owner = -1;
    }
    hero.shotsOut = [];
    this.stepEnemies(dt, solids);
    this.stepShots(dt, solids);

    for (const i of heroStrikes(hero, this.enemies, this.events)) this.onEnemyDied(i);
    this.strikeWalls();
    enemiesStrike(hero, this.enemies, this.events);
    for (const ev of this.events) if (ev.type === 'parry') hero.stamina = Math.min(hero.maxStamina, hero.stamina + PARRY_BREATH);

    if (hero.alive && hero.state !== 'rest') this.touchWorld();
    this.stepWaves();
    this.checkPit();
    this.checkExits();
    this.respawns(dt);

    if (cfg.kills > 0 && this.progress.kills >= cfg.kills) this.finish(true);
    if (cfg.goal && hasFlag(this.progress, cfg.goal)) this.finish(true);
  }

  /** The wave cauldron: start once its trigger is set, next wave when the last one is down. */
  private stepWaves() {
    const w = this.room.waves;
    if (!w || !this.hero.alive) return;
    const done = `waves:${this.room.id}`;
    if (hasFlag(this.progress, done)) return;
    if (this.waveIndex < 0) {
      if (w.after && !hasFlag(this.progress, w.after)) return;
      if (this.bossFight()) return;
      this.startWave(0);
      return;
    }
    const wave = this.enemies.slice(this.waveFrom);
    if (wave.some((e) => e.alive)) return;
    if (this.waveIndex + 1 < w.list.length) this.startWave(this.waveIndex + 1);
    else {
      setFlag(this.progress, done);
      this.waveIndex = -1;
      this.events.push({ type: 'wavesDone' });
    }
  }

  private startWave(n: number) {
    const list = this.room.waves!.list[n] ?? [];
    this.waveIndex = n;
    this.waveFrom = this.enemies.length;
    for (const s of list) {
      const def = this.cfg.enemies[s.kind];
      if (!def) throw new Error(`rssouls: unknown enemy ${s.kind}`);
      const e = new Enemy(def, { ...s, awake: true });
      e.dmgMul *= combine(this.mods).enemyDamageMul;
      this.dressEnemy(e);
      this.enemies.push(e);
      this.deadT.push(0);
    }
    this.events.push({ type: 'wave', n: n + 1, of: this.room.waves!.list.length });
  }

  private finish(won: boolean) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.events.push({ type: 'over' });
  }

  private stepEnemies(dt: number, solids: Solid[]) {
    const { hero, enemies } = this;
    // the first living enemy engages; the others hold the far side (UEBERGABE §6.5: one flanks)
    const engaged = enemies.findIndex((e) => e.alive && !e.def.boss && (e.state === 'chase' || e.state === 'attack'));
    const lead = engaged >= 0 ? enemies[engaged]! : null;
    enemies.forEach((e, i) => {
      if (!e.alive && e.body.y < -1000) return;
      const t: EnemyTarget = { x: hero.body.x, y: hero.body.y, alive: hero.alive && hero.state !== 'rest' };
      if (lead && i !== engaged && !e.def.boss && !e.def.flying) {
        const side = lead.body.x < hero.body.x ? 1 : -1;
        t.goalX = hero.body.x + side * 70;
      }
      const wasIdle = e.state === 'idle';
      // a boss wakes when the hero is well inside its arena
      if (wasIdle && e.def.boss && t.alive && Math.abs(hero.body.x - e.body.x) < e.def.sight) {
        e.wake();
        this.events.push({ type: 'bossAwake', enemy: i, name: e.def.name });
      }
      e.step(dt, t, solids, this.cfg.feel, this.rng, i, this.events);
      for (const s of e.shots) this.fire(s.def, s.x, s.y, s.facing, s.tx, s.ty, e.def.damage * e.dmgMul, i);
      e.shots = [];
    });
    for (const ev of this.events) {
      if (ev.type === 'call') for (const e of enemies) if (e.alive) e.wake();
    }
  }

  private fire(def: AttackDef, x: number, y: number, facing: number, tx: number, ty: number, base: number, owner: number) {
    const p = def.projectile;
    if (!p) return;
    // an arcing throw is aimed: the flight time follows the distance, the arc does the rest
    let vx = facing * p.speed;
    let vy = p.arc;
    if (p.gravity > 0 && p.arc > 0) {
      const tFlight = (2 * p.arc) / p.gravity;
      vx = Math.max(-p.speed, Math.min(p.speed, (tx - x) / Math.max(0.2, tFlight)));
    } else if (p.arc === 0 && p.gravity === 0) {
      const dx = tx - x;
      const dy = ty - y;
      const len = Math.hypot(dx, dy) || 1;
      // straight shots go for the hero, but never backwards
      vx = Math.abs(dx) < 1 ? facing * p.speed : (dx / len) * p.speed;
      vy = (dy / len) * p.speed;
    }
    const n = p.count ?? 1;
    const straight = p.arc === 0 && p.gravity === 0;
    for (let k = 0; k < n; k++) {
      const fan = n > 1 ? (k / (n - 1) - 0.5) * 2 * (p.spread ?? 0.3) : 0;
      this.shots.push({
      x,
      y,
      // a thrown fan spreads in reach, a straight one in angle
      vx: straight ? vx : vx * (1 + fan),
      vy: straight ? vy + fan * p.speed * 0.4 : vy,
      w: p.w,
      h: p.h,
      gravity: p.gravity,
      life: p.life,
      solid: p.solid,
      damage: base * def.damage,
      knockback: def.knockback,
      parryable: !!def.parryable,
      effect: def.effect,
      owner,
      dead: false,
      });
    }
  }

  private stepShots(dt: number, solids: Solid[]) {
    const hero = this.hero;
    for (const s of this.shots) {
      s.life -= dt;
      s.vy -= s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const r: Rect = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
      if (s.life <= 0) s.dead = true;
      if (s.solid && solids.some((q) => !q.oneWay && overlaps(r, q))) {
        s.dead = true;
        this.events.push({ type: 'shot', x: s.x, y: s.y });
      }
      if (s.dead) continue;
      if (s.owner >= 0) {
        if (!overlaps(r, bodyRect(hero.body))) continue;
        const at = { x: s.x, y: s.y };
        const outcome = resolveOnHero(hero, s.damage, s.knockback, s.x - s.vx * 0.05, s.parryable, s.effect, at, s.owner, this.events);
        if (outcome === 'parried') {
          // sent back where it came from, twice as hard
          s.owner = -1;
          s.vx = -s.vx * 1.3;
          s.vy = Math.abs(s.vy) * 0.3;
          s.gravity = 0;
          s.damage *= 2;
          s.life = 1.5;
        } else if (outcome !== 'dodged') {
          s.dead = true;
        }
        if (outcome !== 'ignored' && outcome !== 'dodged' && !hero.alive) this.events.push({ type: 'heroDied', cause: this.enemies[s.owner]?.def.name ?? '?' });
      } else {
        this.enemies.forEach((e, i) => {
          if (s.dead || !e.alive || !overlaps(r, bodyRect(e.body))) return;
          s.dead = true;
          if (damageEnemy(hero, e, i, s.damage, 30, 160, true, this.events)) this.onEnemyDied(i);
        });
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  /** The hero's blade against the breakable walls of the room. */
  private strikeWalls() {
    const hero = this.hero;
    const run = hero.attack;
    if (hero.state !== 'attack' || !run || phaseOf(run) !== 'active') return;
    const box = hitbox(hero.body, hero.facing, run.def);
    for (const p of this.room.props ?? []) {
      if (p.type !== 'wall' || hasFlag(this.progress, `broken:${p.id}`) || run.struck.includes(`wall:${p.id}`)) continue;
      if (!overlaps(box, p.rect)) continue;
      run.struck.push(`wall:${p.id}`);
      const at = { x: p.rect.x + p.rect.w / 2, y: hero.body.y + 30 };
      if (heroDamage(hero) * (hero.traits?.wallMul ?? 1) >= p.minDamage) {
        setFlag(this.progress, `broken:${p.id}`);
        this.events.push({ type: 'wallBroken', id: p.id, ...at });
      } else {
        hero.freeze = Math.max(hero.freeze, hero.feel.hitstop.light);
        this.events.push({ type: 'wallHolds', ...at });
      }
    }
  }

  private onEnemyDied(i: number) {
    const e = this.enemies[i];
    if (!e) return;
    const p = this.progress;
    if (this.room.heat) {
      // the hunter's fall cools the district down; every other kill heats it up
      this.heat = this.heatSpawns.includes(e) ? Math.max(0, this.heat - 3) : Math.min(10, this.heat + 1);
      this.events.push({ type: 'heat', heat: this.heat });
    }
    p.kills++;
    const reward = Math.round(e.def.reward * combine(this.mods).currencyMul);
    p.currency += reward;
    if (reward > 0) this.events.push({ type: 'reward', amount: reward, x: e.body.x, y: e.body.y + e.body.h });
    if (!this.cfg.respawnInPlace && i < this.room.enemies.length) this.slain.add(`${this.room.id}#${i}`);
    if (e.def.boss) {
      const flag = bossFlag(this.room.id, e.def.id);
      setFlag(p, flag);
      this.events.push({ type: 'bossDied', enemy: i, id: flag });
    }
  }

  /** The boss that can be ended by hand right now (last phase, flag carried, close by). */
  endable(): Enemy | null {
    const hero = this.hero;
    return (
      this.enemies.find((e) => {
        if (!e.def.endsWith || !e.alive || !hasFlag(this.progress, e.def.endsWith)) return false;
        const last = 1 + (e.def.phase2 ? 1 : 0) + (e.def.phases?.length ?? 0);
        return e.phase >= last && Math.abs(e.body.x - hero.body.x) < 140;
      }) ?? null
    );
  }

  /** Rests, levers, pick-ups, hazards and the dropped cell. */
  private touchWorld() {
    const hero = this.hero;
    const end = hero.interactP ? this.endable() : null;
    if (end) {
      const i = this.enemies.indexOf(end);
      end.hp = 0;
      end.setState('dead');
      this.events.push({ type: 'ended', enemy: i });
      this.events.push({ type: 'enemyDied', enemy: i, x: end.body.x, y: end.body.y + end.body.h / 2 });
      this.onEnemyDied(i);
    }
    const hb = bodyRect(hero.body);
    const p = this.progress;
    // the cell from the last death
    const cell = p.cell;
    if (cell && cell.room === this.room.id && Math.abs(cell.x - hero.body.x) < 30 && Math.abs(cell.y - hero.body.y) < 50) {
      p.currency += cell.amount;
      this.events.push({ type: 'cellRecovered', amount: cell.amount });
      p.cell = null;
    }
    for (const prop of this.room.props ?? []) {
      switch (prop.type) {
        case 'rest':
          if (hero.interactP && hero.body.onGround && near(hero, prop.x, prop.y)) this.rest(prop.id);
          break;
        case 'lever':
          if (hero.interactP && near(hero, prop.x, prop.y) && !hasFlag(p, `pulled:${prop.id}`)) {
            setFlag(p, `pulled:${prop.id}`);
            setFlag(p, `open:${prop.opens}`);
            this.events.push({ type: 'lever', id: prop.id, opens: prop.opens });
          }
          break;
        case 'pickup':
          if (!hasFlag(p, `got:${prop.id}`) && Math.abs(prop.x - hero.body.x) < 26 && Math.abs(prop.y - hero.body.y) < 50) {
            setFlag(p, `got:${prop.id}`);
            this.take(prop.item);
            this.events.push({ type: 'pickup', id: prop.id, item: prop.item });
          }
          break;
        case 'hazard':
          if (this.hazardCd <= 0 && this.hazardOn(prop) && overlaps(hb, prop.rect)) {
            const dir = hero.body.x < prop.rect.x + prop.rect.w / 2 ? -1 : 1;
            if (hero.hurt(prop.damage, dir * 160)) {
              this.hazardCd = 0.8;
              this.events.push({ type: 'hazard', x: hero.body.x, y: hero.body.y + 20 });
              this.events.push({ type: 'hit', target: 'hero', x: hero.body.x, y: hero.body.y + 30, damage: prop.damage, heavy: false, riposte: false });
              if (!hero.alive) this.events.push({ type: 'heroDied', cause: 'hazard' });
            }
          }
          break;
      }
    }
  }

  private take(item: string) {
    const p = this.progress;
    const [kind, arg] = item.split(':');
    if (kind === 'flask') {
      p.flasksMax++;
      this.hero.flasksMax = p.flasksMax;
      this.hero.flasks++;
    } else if (kind === 'currency') {
      p.currency += Number(arg) || 0;
    } else if (kind === 'weapon' && arg && this.cfg.weapons[arg]) {
      if (!p.weapons.includes(arg)) p.weapons.push(arg);
      if (!p.slots[1]) p.slots[1] = arg;
      this.applyProgress();
    } else if (kind === 'flag' && arg) {
      setFlag(p, arg);
    } else if (kind === 'slag') {
      p.slag = (p.slag ?? 0) + (Number(arg) || 1);
    } else if (kind === 'ability' && arg) {
      setFlag(p, `faehigkeit:${arg}`);
      this.applyProgress();
    }
  }

  /** What the interact button would do right now, for the prompt and the button's double duty. */
  interactable(): { kind: 'rest' | 'lever' | 'door' | 'locked' | 'end'; label: string } | null {
    const hero = this.hero;
    if (!hero.alive || hero.state === 'rest') return null;
    const end = this.endable();
    if (end) return { kind: 'end', label: end.def.id };
    for (const prop of this.room.props ?? []) {
      if (prop.type === 'rest' && near(hero, prop.x, prop.y)) return { kind: 'rest', label: prop.id };
      if (prop.type === 'lever' && near(hero, prop.x, prop.y) && !hasFlag(this.progress, `pulled:${prop.id}`)) return { kind: 'lever', label: prop.id };
    }
    for (const ex of this.room.exits ?? []) {
      if (!ex.door) continue;
      const inside = hero.body.x > ex.rect.x && hero.body.x < ex.rect.x + ex.rect.w && hero.body.y + 20 > ex.rect.y && hero.body.y < ex.rect.y + ex.rect.h;
      if (!inside) continue;
      return { kind: ex.needs && !hasFlag(this.progress, ex.needs) ? 'locked' : 'door', label: ex.to };
    }
    return null;
  }

  /** The sign the hero stands at, if any. */
  signNear(): string | null {
    for (const prop of this.room.props ?? []) {
      if (prop.type === 'sign' && Math.abs(prop.x - this.hero.body.x) < 60 && Math.abs(prop.y - this.hero.body.y) < 80) return prop.text;
    }
    return null;
  }

  /** Sits down at a rest point: healed, flasks full, enemies back, the respawn set here. */
  rest(id: string) {
    const p = this.progress;
    if ((p.grade ?? 0) >= 4 && id !== GRADES.lastRest) {
      // Glut-Grad 4: every Kollektor but one has gone cold
      this.events.push({ type: 'locked', x: this.hero.body.x, y: this.hero.body.y });
      return;
    }
    const first = !hasFlag(p, `lit:${id}`);
    setFlag(p, `lit:${id}`);
    p.rest = { room: this.room.id, id };
    this.slain.clear();
    this.heat = 0;
    this.spawnEnemies();
    this.applyProgress();
    const h = this.hero;
    // Glut-Grad 2: the Kollektor heals only half
    h.hp = (p.grade ?? 0) >= 2 ? Math.min(h.maxHp, h.hp + h.maxHp * GRADES.restHeal) : h.maxHp;
    h.stamina = h.maxStamina;
    h.flasks = h.flasksMax;
    h.tarT = h.burnT = 0;
    h.setState('rest');
    this.events.push({ type: 'rest', id, first });
  }

  /** Every lit rest point of the level: where travel can go. */
  litRests(): { room: string; id: string }[] {
    const out: { room: string; id: string }[] = [];
    for (const room of Object.values(this.cfg.level.rooms)) {
      for (const p of room.props ?? []) if (p.type === 'rest' && hasFlag(this.progress, `lit:${p.id}`)) out.push({ room: room.id, id: p.id });
    }
    return out;
  }

  /** Travels from one rest point to another lit one and sits down there. */
  travel(room: string, id: string): boolean {
    if (this.hero.state !== 'rest' || !hasFlag(this.progress, `lit:${id}`)) return false;
    const spot = this.restSpot(room, id);
    if (!spot) return false;
    this.enterRoom(spot.room, null, spot.x, spot.y);
    this.rest(id);
    return true;
  }

  leaveRest() {
    if (this.hero.state !== 'rest') return;
    this.hero.setState('move');
    this.events.push({ type: 'restEnd' });
  }

  /** Run modifiers and the hero's folk and class traits, combined. */
  traits(): Traits {
    return combine([...(this.cfg.traits ?? []), ...this.mods]);
  }

  /** A new build for the hero (folk and class chosen): base numbers and traits; refilled. */
  setBuild(hero: HeroDef, traits: RunMod[]) {
    this.cfg = { ...this.cfg, hero, traits };
    this.applyProgress();
    const h = this.hero;
    h.hp = h.maxHp;
    h.stamina = h.maxStamina;
    h.flasks = h.flasksMax;
    for (const e of this.enemies) this.dressEnemy(e);
  }

  /** What the hero's traits do to an enemy: how far it sees, how long it telegraphs. */
  private dressEnemy(e: Enemy) {
    const t = this.traits();
    e.sightMul = t.sightMul;
    e.telegraphMul = t.telegraphMul;
  }

  /** Takes a run modifier for the rest of the run, the hero refilled to the new caps. */
  addMod(mod: RunMod) {
    this.mods.push(mod);
    this.applyProgress();
    const h = this.hero;
    h.hp = h.maxHp;
    h.stamina = h.maxStamina;
    h.flasks = h.flasksMax;
    const harder = mod.enemyDamageMul ?? 1;
    if (harder !== 1) for (const e of this.enemies) e.dmgMul *= harder;
  }

  /** Buys a level in a stat at the rest. Returns false if the currency does not reach. */
  levelUp(stat: Stat): boolean {
    const p = this.progress;
    const cost = levelCost(p);
    if (p.currency < cost) return false;
    p.currency -= cost;
    p.levels[stat]++;
    const h = this.hero;
    const before = { hp: h.maxHp, st: h.maxStamina };
    this.applyProgress();
    h.hp += h.maxHp - before.hp;
    h.stamina += h.maxStamina - before.st;
    this.events.push({ type: 'levelUp', stat });
    return true;
  }

  /** Smiths the weapon one stage up at a rest. Returns false if Glut or slag do not reach. */
  upgrade(weapon: string): boolean {
    const p = this.progress;
    const cost = upgradeCost(p, weapon);
    if (!cost || p.currency < cost.currency || (p.slag ?? 0) < cost.slag) return false;
    p.currency -= cost.currency;
    p.slag = (p.slag ?? 0) - cost.slag;
    p.upgrades = { ...(p.upgrades ?? {}), [weapon]: (p.upgrades?.[weapon] ?? 0) + 1 };
    this.applyProgress();
    this.events.push({ type: 'levelUp', stat: `upgrade:${weapon}` });
    return true;
  }

  /** Puts a found weapon into the slot. */
  equip(slot: 0 | 1, weapon: string | null) {
    const p = this.progress;
    if (weapon && !p.weapons.includes(weapon)) return;
    if (slot === 0) {
      if (!weapon) return;
      p.slots[0] = weapon;
    } else p.slots[1] = weapon;
    this.applyProgress();
  }

  private checkPit() {
    const hero = this.hero;
    if (!hero.alive || hero.body.y > -120) return;
    // a fall costs life, not the run: back to the last safe ground
    hero.hp = Math.max(0, hero.hp - hero.maxHp * PIT_COST);
    this.events.push({ type: 'hit', target: 'hero', x: hero.body.x, y: -60, damage: hero.maxHp * PIT_COST, heavy: true, riposte: false });
    if (hero.hp <= 0) {
      hero.setState('dead');
      this.events.push({ type: 'heroDied', cause: 'fall' });
      return;
    }
    hero.place(hero.safe.x - hero.facing * 20, hero.safe.y, false);
    hero.body.vx = 0;
    hero.setState('hurt');
  }

  private checkExits() {
    const hero = this.hero;
    if (!hero.alive || this.bossFight() || this.waveIndex >= 0) return;
    for (const ex of this.room.exits ?? []) {
      const inside = hero.body.x > ex.rect.x && hero.body.x < ex.rect.x + ex.rect.w && hero.body.y + 20 > ex.rect.y && hero.body.y < ex.rect.y + ex.rect.h;
      if (!inside) continue;
      if (ex.door && !(hero.interactP && hero.body.onGround && hero.state === 'move')) continue;
      if (ex.needs && !hasFlag(this.progress, ex.needs)) {
        if (ex.door) this.events.push({ type: 'locked', x: hero.body.x, y: hero.body.y });
        continue;
      }
      this.enterRoom(ex.to, ex.at);
      return;
    }
  }

  private respawns(dt: number) {
    const { hero, cfg, enemies } = this;
    if (cfg.respawnInPlace) {
      enemies.forEach((e, i) => {
        if (e.alive || e.def.boss) {
          this.deadT[i] = 0;
          return;
        }
        this.deadT[i] = (this.deadT[i] ?? 0) + dt;
        if ((this.deadT[i] ?? 0) >= ENEMY_RESPAWN && hero.alive) {
          e.reset();
          this.deadT[i] = 0;
        }
      });
    }

    if (hero.alive) return;
    if (this.heroDeadT === 0) this.onHeroDeath();
    this.heroDeadT += dt;
    if (this.heroDeadT < HERO_RESPAWN) return;
    this.heroDeadT = 0;
    if (cfg.respawnInPlace) {
      hero.respawn(this.room.spawn.x, this.room.spawn.y);
      for (const e of enemies) e.reset();
      this.deadT.fill(0);
    } else {
      this.slain.clear();
      const p = this.progress;
      const spot = p.rest ? this.restSpot(p.rest.room, p.rest.id) : null;
      if (spot) this.enterRoom(spot.room, null, spot.x, spot.y);
      else this.enterRoom(cfg.level.start.room, cfg.level.start.at);
      this.applyProgress();
      hero.place(hero.body.x, hero.body.y, true);
    }
    this.events.push({ type: 'respawn' });
  }

  /** The carried currency stays behind as a cell; the one from before is gone for good. */
  private onHeroDeath() {
    const p = this.progress;
    p.deaths++;
    if (this.cfg.respawnInPlace) return;
    if (p.cell) this.events.push({ type: 'cellLost', amount: p.cell.amount });
    p.cell = null;
    if (p.currency > 0) {
      // in an arena the cell waits at the door, not under the boss
      const arena = this.room.camera === 'arena';
      const spot = arena ? this.arrival : this.hero.body.onGround ? { x: this.hero.body.x, y: this.hero.body.y } : this.hero.safe;
      p.cell = { room: this.room.id, x: spot.x, y: spot.y, amount: p.currency };
      this.events.push({ type: 'cellDropped', amount: p.currency });
      p.currency = 0;
    }
  }

  /** Divergence check, and the determinism test's yardstick. */
  hash(): number {
    const h = new StateHasher();
    const hb = this.hero.body;
    h.addString(this.room.id);
    h.add(hb.x).add(hb.y).add(hb.vx).add(hb.vy).add(this.hero.hp).add(this.hero.stamina).addString(this.hero.state);
    for (const e of this.enemies) h.add(e.body.x).add(e.body.y).add(e.hp).add(e.poise).addString(e.state);
    for (const s of this.shots) h.add(s.x).add(s.y);
    const p = this.progress;
    return h.add(p.kills, 0).add(p.deaths, 0).add(p.currency, 0).value;
  }
}

export function bossFlag(room: string, enemy: string) {
  return `boss:${enemy}@${room}`;
}

function near(hero: Hero, x: number, y: number) {
  return Math.abs(hero.body.x - x) < REACH && Math.abs(hero.body.y - y) < 60;
}

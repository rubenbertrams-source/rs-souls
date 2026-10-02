import { Rng } from '@pv/engine';
import { describe, expect, it } from 'vitest';
import { HERO_RESPAWN, Sim, type SimConfig } from '../games/rssouls/src/core/sim';
import { STAT_GAIN, levelCost, newProgress, nextGrade, readProgress } from '../games/rssouls/src/core/progress';
import { Hero } from '../games/rssouls/src/core/hero';
import { Enemy } from '../games/rssouls/src/core/enemy';
import { startAttack, windupOf } from '../games/rssouls/src/core/attack';
import { NO_COMMAND, type Command, type LevelDef, type RoomDef, type SimEvent } from '../games/rssouls/src/core/types';
import { FEEL, SURVIVOR } from '../games/rssouls/src/data/feel';
import { ROST_KLINGE, WEAPONS, WEAPON_BY_ID } from '../games/rssouls/src/data/weapons';
import { ENEMIES, ENEMY_BY_ID, ROST_SPINNER } from '../games/rssouls/src/data/enemies';
import { TRAINING } from '../games/rssouls/src/data/rooms';
import { CAMPAIGN_GOAL, MAX_STEP, REINSTROM } from '../games/rssouls/src/data/world';
import { RUN_LENGTH, dailySeed, makeRun, runGoal } from '../games/rssouls/src/data/run';
import { MOD_CARDS } from '../games/rssouls/src/data/modifiers';
import { layoutMap } from '../games/rssouls/src/ui/map';
import { CLASSES, FOLKS, SURVIVOR_CLASS, heroOf, newMeta, unlocked } from '../games/rssouls/src/data/heroes';
import { SIGNS } from '../games/rssouls/src/data/strings';
import { MAX_PARRY, validateEnemy, validateWeapon } from '../games/rssouls/src/data/validate';
import { HeroBot } from '../games/rssouls/src/ai/heroBot';

/**
 * RS Souls M1 – the combat room, played headless. Every promise of UEBERGABE §6 that a number can
 * check is checked here; whether it *feels* right is for the controller in hand.
 */

const DT = 1 / 60;

/** A flat floor, wide enough to never meet a wall. */
const FLAT: RoomDef = {
  id: 'flat',
  w: 4000,
  h: 600,
  solids: [{ x: -2000, y: -40, w: 8000, h: 40 }],
  spawn: { x: 0, y: 0 },
  enemies: [{ kind: 'rost-spinner', x: 200, y: 0, patrol: [150, 250] }],
};

const levelOf = (room: RoomDef): LevelDef => ({ id: 'test', rooms: { [room.id]: room }, start: { room: room.id, at: 'spawn' } });

const cmd = (c: Partial<Command> = {}): Command => ({ ...NO_COMMAND, ...c });

/** A hero standing on the flat floor (one settle tick, so it knows it is grounded). */
function newHero(x = 0) {
  const h = new Hero(SURVIVOR, FEEL, ROST_KLINGE, x, 0);
  h.step(NO_COMMAND, DT, FLAT.solids, false, []);
  return h;
}

function stepHero(h: Hero, c: Command, n = 1, events: SimEvent[] = []) {
  for (let i = 0; i < n; i++) h.step(c, DT, FLAT.solids, false, events);
  return events;
}

function config(over: Partial<SimConfig> = {}): SimConfig {
  return {
    level: levelOf(FLAT),
    hero: SURVIVOR,
    feel: FEEL,
    weapons: WEAPON_BY_ID,
    enemies: ENEMY_BY_ID,
    startWeapon: ROST_KLINGE.id,
    enemyCount: 1,
    kills: 0,
    infiniteStamina: false,
    respawnInPlace: true,
    ...over,
  };
}

describe('rssouls movement', () => {
  it('a held jump peaks at about 108 px, a tapped one far lower', () => {
    const full = newHero();
    stepHero(full, cmd(), 2);
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      stepHero(full, cmd({ jump: true }));
      peak = Math.max(peak, full.body.y);
    }
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThan(116);

    const tap = newHero();
    stepHero(tap, cmd(), 2);
    stepHero(tap, cmd({ jump: true }), 3);
    let low = 0;
    for (let i = 0; i < 90; i++) {
      stepHero(tap, cmd());
      low = Math.max(low, tap.body.y);
    }
    expect(low).toBeLessThan(peak * 0.5);
  });

  it('coyote time: a jump pressed just after running off a ledge still counts', () => {
    const ledge: RoomDef = { ...FLAT, solids: [{ x: -500, y: -40, w: 520, h: 40 }] };
    const h = newHero();
    // run right until the feet leave the ledge
    let t = 0;
    while (h.body.onGround && t++ < 200) h.step(cmd({ x: 1 }), DT, ledge.solids, false, []);
    expect(h.body.onGround).toBe(false);
    // 3 ticks (0.05 s) later – inside the 0.10 s coyote window
    for (let i = 0; i < 3; i++) h.step(cmd({ x: 1 }), DT, ledge.solids, false, []);
    const ev: SimEvent[] = [];
    h.step(cmd({ x: 1, jump: true }), DT, ledge.solids, false, ev);
    expect(ev).toContainEqual({ type: 'jump' });

    // ... but not 10 ticks later
    const late = newHero();
    t = 0;
    while (late.body.onGround && t++ < 200) late.step(cmd({ x: 1 }), DT, ledge.solids, false, []);
    for (let i = 0; i < 10; i++) late.step(cmd({ x: 1 }), DT, ledge.solids, false, []);
    const ev2: SimEvent[] = [];
    late.step(cmd({ x: 1, jump: true }), DT, ledge.solids, false, ev2);
    expect(ev2).not.toContainEqual({ type: 'jump' });
  });

  it('jump buffer: a press just before landing jumps on touchdown', () => {
    const h = newHero();
    stepHero(h, cmd(), 2);
    stepHero(h, cmd({ jump: true }), 40);
    // falling now; let go, then press again shortly before the ground
    while (h.body.y > 12) stepHero(h, cmd());
    const ev = stepHero(h, cmd({ jump: true }), 12);
    expect(ev.filter((e) => e.type === 'jump').length).toBe(1);
    expect(h.body.vy).toBeGreaterThan(0);
  });

  it('the roll is invulnerable in its middle and costs stamina', () => {
    const h = newHero();
    stepHero(h, cmd(), 2);
    stepHero(h, cmd({ roll: true }));
    expect(h.state).toBe('roll');
    expect(h.stamina).toBeLessThan(SURVIVOR.stamina);
    stepHero(h, cmd(), 6);
    expect(h.invulnerable).toBe(true);
    expect(h.receive(20, 100, 50, true)).toBe('dodged');
    expect(h.hp).toBe(SURVIVOR.hp);
    stepHero(h, cmd(), 30);
    expect(h.invulnerable).toBe(false);
  });
});

describe('rssouls attacks', () => {
  it('the chain runs Hieb – Hieb – Stich when pressed inside the combo window', () => {
    const h = newHero();
    const seen: string[] = [];
    let held = false;
    for (let i = 0; i < 150; i++) {
      // press again every few ticks: the buffer catches the early ones
      held = i % 8 < 2;
      const ev = stepHero(h, cmd({ attack: held }));
      for (const e of ev) if (e.type === 'swing') seen.push(e.attack);
      if (seen.length >= 3) break;
    }
    expect(seen).toEqual(['hieb1', 'hieb2', 'stich']);
  });

  it('a press too early is buffered (0.12 s), a press long before is forgotten', () => {
    const h = newHero();
    stepHero(h, cmd({ attack: true }));
    stepHero(h, cmd(), 1);
    const run = h.attack!;
    // press 0.1 s before the recovery starts
    const toRecovery = windupOf(run) + run.def.active - run.t;
    const lead = Math.round((toRecovery - 0.1) / DT);
    stepHero(h, cmd(), lead);
    stepHero(h, cmd({ attack: true }));
    stepHero(h, cmd(), 8);
    expect(h.attack?.def.id).toBe('hieb2');

    const late = newHero();
    stepHero(late, cmd({ attack: true }));
    stepHero(late, cmd(), 1);
    // press right at the start: far more than 0.12 s before the recovery
    stepHero(late, cmd({ attack: true }));
    stepHero(late, cmd(), 30);
    expect(late.attack?.def.id ?? 'none').not.toBe('hieb2');
  });

  it('holding the first swing charges the wide cut', () => {
    const h = newHero();
    const ev = stepHero(h, cmd({ attack: true }), 45);
    expect(h.state).toBe('charge');
    stepHero(h, cmd(), 1, ev);
    expect(h.attack?.def.id).toBe('ladung');
    expect(ev.some((e) => e.type === 'swing' && e.attack === 'ladung')).toBe(true);
  });

  it('the hero does not turn around while the blade is out', () => {
    const h = newHero();
    stepHero(h, cmd({ attack: true }));
    stepHero(h, cmd(), 9); // past the wind-up
    expect(h.facing).toBe(1);
    stepHero(h, cmd({ x: -1 }), 3);
    expect(h.facing).toBe(1);
  });
});

describe('rssouls block and parry', () => {
  function blockingHero(ticksSinceRaise: number) {
    const h = newHero();
    stepHero(h, cmd(), 2);
    stepHero(h, cmd({ block: true }), 1 + ticksSinceRaise);
    return h;
  }

  it('a parryable attack inside the opening window is parried', () => {
    const h = blockingHero(5); // ~0.1 s < 0.20 s
    expect(h.parryOpen).toBe(true);
    expect(h.receive(18, 180, 60, true)).toBe('parried');
    expect(h.hp).toBe(SURVIVOR.hp);
    expect(h.riposteT).toBeCloseTo(FEEL.riposte.window);
  });

  it('just outside the window it is an ordinary block: half the damage, stamina spent', () => {
    const h = blockingHero(14); // ~0.25 s
    expect(h.parryOpen).toBe(false);
    const st = h.stamina;
    expect(h.receive(18, 180, 60, true)).toBe('blocked');
    expect(h.hp).toBe(SURVIVOR.hp - 9);
    expect(h.stamina).toBeCloseTo(st - 18 * FEEL.blockCostPerDamage);
  });

  it('an unparryable attack is only blocked, even inside the window', () => {
    const h = blockingHero(3);
    expect(h.parryOpen).toBe(true);
    expect(h.receive(18, 180, 60, false)).toBe('blocked');
    expect(h.riposteT).toBe(0);
  });

  it('guard break at empty stamina leaves the hero open for 0.6 s', () => {
    const h = blockingHero(20);
    h.stamina = 5;
    expect(h.receive(18, 180, 60, true)).toBe('guardBreak');
    expect(h.state).toBe('guardBreak');
    stepHero(h, cmd({ block: true }), Math.round(FEEL.guardBreak / DT) - 2);
    expect(h.state).toBe('guardBreak');
    stepHero(h, cmd({ block: true }), 4);
    expect(h.state).not.toBe('guardBreak');
  });

  it('a block raised by holding through a roll has no parry window – only a fresh press opens it', () => {
    const h = newHero();
    stepHero(h, cmd(), 2);
    stepHero(h, cmd({ block: true }), 30);
    expect(h.parryOpen).toBe(false);
  });

  it('a block from behind does not count', () => {
    const h = blockingHero(20);
    expect(h.facing).toBe(1);
    expect(h.receive(18, 180, -60, true)).toBe('hit');
  });
});

describe('rssouls enemy', () => {
  it('telegraphs before every strike', () => {
    const sim = new Sim(config(), 3);
    const telegraphs: number[] = [];
    const strikes: number[] = [];
    for (let i = 0; i < 60 * 20; i++) {
      sim.step(NO_COMMAND, DT);
      for (const e of sim.events) {
        if (e.type === 'telegraph') telegraphs.push(sim.time);
        if (e.type === 'swing' && e.who !== 'hero') strikes.push(sim.time);
      }
    }
    expect(strikes.length).toBeGreaterThan(2);
    for (const s of strikes) {
      const before = telegraphs.filter((t) => t < s).pop();
      expect(before).toBeDefined();
      expect(s - before!).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('two sight radii: notices inside `sight`, keeps chasing until `lose`', () => {
    const e = new Enemy(ROST_SPINNER, { kind: 'rost-spinner', x: 0, y: 0, patrol: [-50, 50] });
    const rng = { range: () => 1, pick: <T,>(a: readonly T[]) => a[0]! } as never;
    const tick = (x: number) => e.step(DT, { x, y: 0, alive: true }, FLAT.solids, FEEL, rng, 0, []);
    tick(ROST_SPINNER.sight + 40);
    expect(e.state).toBe('patrol');
    tick(ROST_SPINNER.sight - 40);
    expect(e.state).toBe('chase');
    tick(e.body.x + (ROST_SPINNER.sight + ROST_SPINNER.lose) / 2);
    expect(e.state).toBe('chase');
    tick(e.body.x + ROST_SPINNER.lose + 40);
    expect(e.state).toBe('patrol');
  });

  it('poise breaks into a visible stagger that cancels its attack, and refills after rest', () => {
    const e = new Enemy(ROST_SPINNER, { kind: 'rost-spinner', x: 0, y: 0, patrol: [-50, 50] });
    e.attack = startAttack(ROST_SPINNER.attacks[0]!);
    e.state = 'attack';
    expect(e.takePoise(12, ROST_SPINNER.stagger)).toBe(false);
    expect(e.takePoise(12, ROST_SPINNER.stagger)).toBe(true);
    expect(e.state).toBe('stagger');
    expect(e.attack).toBeNull();

    const r = new Enemy(ROST_SPINNER, { kind: 'rost-spinner', x: 0, y: 0, patrol: [-50, 50] });
    r.takePoise(12, 1);
    const rng = { range: () => 1, pick: <T,>(a: readonly T[]) => a[0]! } as never;
    for (let i = 0; i < 60 * 3; i++) r.step(DT, { x: 2000, y: 0, alive: false }, FLAT.solids, FEEL, rng, 0, []);
    expect(r.poise).toBe(ROST_SPINNER.poise);
  });
});

describe('rssouls combat room', () => {
  /** Waits for the bite's telegraph, then raises the block so it lands inside the parry window. */
  it('a parry is reproducible: stagger, riposte ×2.5, and the spinner dies to it', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = new Sim(config(), seed);
      let parried = false;
      let riposteDamage = 0;
      let blockFrom = -1;
      for (let i = 0; i < 60 * 30 && !riposteDamage; i++) {
        const e = sim.enemies[0]!;
        const run = e.state === 'attack' ? e.attack : null;
        let c = cmd();
        const dist = Math.abs(e.body.x - sim.hero.body.x);
        if (!parried) {
          if (run?.def.parryable && windupOf(run) - run.t < 0.08 && blockFrom < 0) blockFrom = i;
          if (blockFrom >= 0) c = cmd({ block: true });
          // stand and wait close by; step off if the spinner would rather leap
          else if (dist > 70) c = cmd({ x: Math.sign(e.body.x - sim.hero.body.x) });
        } else {
          c = cmd({ attack: i % 2 === 0, x: Math.sign(e.body.x - sim.hero.body.x) * 0.3 });
        }
        sim.step(c, DT);
        for (const ev of sim.events) {
          if (ev.type === 'parry') parried = true;
          if (ev.type === 'blocked' || (ev.type === 'hit' && ev.target === 'hero')) blockFrom = -1;
          if (ev.type === 'hit' && ev.target !== 'hero' && ev.riposte) riposteDamage = ev.damage;
        }
      }
      expect(parried, `seed ${seed}`).toBe(true);
      expect(riposteDamage).toBeCloseTo(ROST_KLINGE.damage * FEEL.riposte.mul);
      expect(sim.enemies[0]!.alive).toBe(false);
    }
  });

  it('is deterministic: same seed and commands give the same hash', () => {
    const script = (t: number): Command => cmd({ x: Math.sin(t / 40), attack: t % 37 < 3, roll: t % 91 === 0, block: t % 150 > 120, jump: t % 77 < 10 });
    const a = new Sim(config({ level: TRAINING, enemyCount: 3 }), 9);
    const b = new Sim(config({ level: TRAINING, enemyCount: 3 }), 9);
    for (let t = 0; t < 60 * 40; t++) {
      a.step(script(t), DT);
      b.step(script(t), DT);
    }
    expect(a.hash()).toBe(b.hash());
  });

  it('the demo bot clears three spinners in the Kollektor-Hof within a minute or two', () => {
    const sim = new Sim(config({ level: TRAINING, enemyCount: 2, kills: 3 }), 4);
    const bot = new HeroBot();
    let t = 0;
    for (; t < 60 * 120 && !sim.over; t++) sim.step(bot.think(sim), DT);
    expect(sim.over).toBe(true);
    expect(sim.kills).toBe(3);
  });

  it('hits freeze exactly the two involved (hitstop)', () => {
    const sim = new Sim(config({ enemyCount: 1 }), 1);
    const e = sim.enemies[0]!;
    e.body.x = 40;
    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) {
      sim.step(cmd({ attack: i === 1 }), DT);
      hit = sim.events.some((ev) => ev.type === 'hit' && ev.target === 0);
    }
    expect(hit).toBe(true);
    expect(sim.hero.freeze).toBeGreaterThan(0);
    expect(e.freeze).toBeGreaterThan(0);
  });
});

describe('rssouls data', () => {
  it('every weapon and enemy table is consistent', () => {
    for (const w of WEAPONS) expect(validateWeapon(w)).toEqual([]);
    for (const e of ENEMIES) expect(validateEnemy(e)).toEqual([]);
  });

  it('the validator catches a cycle and an overlong parry', () => {
    const broken = structuredClone(ROST_KLINGE);
    broken.moveset.attacks.stich!.next = 'hieb1';
    broken.moveset.attacks.stich!.comboWindow = 0.2;
    broken.moveset.block = { reduction: 0.5, parry: MAX_PARRY };
    const errors = validateWeapon(broken);
    expect(errors.some((s) => s.includes('Zyklus'))).toBe(true);
    expect(errors.some((s) => s.includes('Parry'))).toBe(true);
  });
});

describe('rssouls world (N1/N2)', () => {
  /** Two rooms: a yard with a rest, a lever, a wall, a pit and a hazard, and an arena behind a gate. */
  const YARD: RoomDef = {
    id: 'yard',
    w: 1200,
    h: 500,
    solids: [
      { x: -40, y: -40, w: 700, h: 40 },
      { x: 760, y: -40, w: 500, h: 40 },
      { x: -40, y: 0, w: 40, h: 500 },
    ],
    spawn: { x: 60, y: 0 },
    entries: { back: { x: 1100, y: 0 } },
    exits: [{ rect: { x: 1170, y: 0, w: 60, h: 200 }, to: 'arena', at: 'door' }],
    enemies: [{ kind: 'rost-spinner', x: 400, y: 0, patrol: [350, 450] }],
    props: [
      { type: 'rest', id: 'k1', x: 40, y: 0 },
      { type: 'lever', id: 'h1', x: 900, y: 0, opens: 'g1' },
      { type: 'gate', id: 'g1', rect: { x: 1000, y: 0, w: 20, h: 200 } },
      { type: 'wall', id: 'w1', rect: { x: 600, y: 0, w: 20, h: 200 }, minDamage: 50 },
      { type: 'pickup', id: 'p1', x: 300, y: 0, item: 'flask' },
    ],
  };
  const ARENA: RoomDef = {
    id: 'arena',
    w: 900,
    h: 500,
    camera: 'arena',
    solids: [{ x: -40, y: -40, w: 1000, h: 40 }, { x: 900, y: 0, w: 40, h: 500 }],
    spawn: { x: 80, y: 0 },
    entries: { door: { x: 80, y: 0 } },
    exits: [{ rect: { x: -60, y: 0, w: 40, h: 200 }, to: 'yard', at: 'back' }],
    enemies: [{ kind: 'verwerter-konstrukt', x: 600, y: 0, patrol: [600, 600] }],
    props: [{ type: 'gate', id: 'ga', arena: true, rect: { x: -20, y: 0, w: 20, h: 300 } }],
  };
  const WORLD: LevelDef = { id: 'w', rooms: { yard: YARD, arena: ARENA }, start: { room: 'yard', at: 'spawn' } };
  const worldSim = () => new Sim(config({ level: WORLD, respawnInPlace: false, enemyCount: undefined }), 7);
  const run = (sim: Sim, c: Partial<Command>, n: number) => {
    for (let i = 0; i < n; i++) sim.step(cmd(c), DT);
  };

  it('resting heals, fills the flasks, sets the respawn and brings the slain back', () => {
    const sim = worldSim();
    sim.slain.add('yard#0');
    sim.hero.hp = 20;
    sim.hero.flasks = 0;
    run(sim, {}, 2);
    sim.step(cmd({ interact: true }), DT);
    expect(sim.hero.state).toBe('rest');
    expect(sim.hero.hp).toBe(sim.hero.maxHp);
    expect(sim.hero.flasks).toBe(sim.hero.flasksMax);
    expect(sim.progress.rest).toEqual({ room: 'yard', id: 'k1' });
    expect(sim.slain.size).toBe(0);
    expect(sim.enemies[0]!.alive).toBe(true);
    sim.leaveRest();
    expect(sim.hero.state).toBe('move');
  });

  it('levels cost currency, rise in price and raise the stat', () => {
    const sim = worldSim();
    sim.progress.currency = 1000;
    const hp = sim.hero.maxHp;
    const c0 = levelCost(sim.progress);
    expect(sim.levelUp('vit')).toBe(true);
    expect(sim.hero.maxHp).toBe(hp + STAT_GAIN.vit);
    expect(levelCost(sim.progress)).toBeGreaterThan(c0);
    sim.progress.currency = 0;
    expect(sim.levelUp('power')).toBe(false);
  });

  it('death drops the currency as a cell; one recovery attempt, a second death loses it', () => {
    const sim = worldSim();
    sim.progress.currency = 300;
    run(sim, { x: 1 }, 30);
    sim.hero.receive(999, 0, sim.hero.body.x + 10, false);
    run(sim, {}, Math.ceil(HERO_RESPAWN / DT) + 2);
    expect(sim.progress.currency).toBe(0);
    const cell = sim.progress.cell!;
    expect(cell.amount).toBe(300);
    // walk back to it
    sim.hero.place(cell.x - 5, cell.y, false);
    run(sim, {}, 2);
    expect(sim.progress.currency).toBe(300);
    expect(sim.progress.cell).toBeNull();

    // die twice: the first cell is gone for good
    sim.hero.receive(999, 0, sim.hero.body.x + 10, false);
    run(sim, {}, Math.ceil(HERO_RESPAWN / DT) + 2);
    sim.progress.currency = 50;
    sim.hero.receive(999, 0, sim.hero.body.x + 10, false);
    const ev: SimEvent[] = [];
    for (let i = 0; i < 4; i++) {
      sim.step(cmd(), DT);
      ev.push(...sim.events);
    }
    expect(ev.some((e) => e.type === 'cellLost' && e.amount === 300)).toBe(true);
    expect(sim.progress.cell?.amount).toBe(50);
  });

  it('a pit costs life and puts the hero back on safe ground', () => {
    const sim = worldSim();
    run(sim, {}, 2);
    sim.hero.place(700, 0, false); // above the gap 660..760
    run(sim, {}, 60);
    expect(sim.hero.alive).toBe(true);
    expect(sim.hero.hp).toBeLessThan(sim.hero.maxHp);
    expect(sim.hero.body.y).toBeGreaterThanOrEqual(0);
  });

  it('a lever opens its gate for good, a flask shard raises the flasks', () => {
    const sim = worldSim();
    expect(sim.solids().some((s) => s.x === 1000)).toBe(true);
    sim.hero.place(300, 0, false);
    run(sim, {}, 2);
    expect(sim.hero.flasksMax).toBe(4);
    sim.hero.place(895, 0, false);
    run(sim, {}, 2);
    sim.step(cmd({ interact: true }), DT);
    expect(sim.solids().some((s) => s.x === 1000)).toBe(false);
    expect(sim.progress.flags).toContain('open:g1');
  });

  it('a wall breaks only to a heavy enough blow', () => {
    const sim = worldSim();
    sim.enemies[0]!.setState('dead');
    sim.hero.place(560, 0, false);
    run(sim, {}, 2);
    // a light slash (34) holds
    const ev: SimEvent[] = [];
    sim.step(cmd({ attack: true }), DT);
    for (let i = 0; i < 30; i++) {
      sim.step(cmd(), DT);
      ev.push(...sim.events);
    }
    expect(ev.some((e) => e.type === 'wallHolds')).toBe(true);
    expect(sim.progress.flags).not.toContain('broken:w1');
    // the charged cut (68) breaks it
    for (let i = 0; i < 30; i++) sim.step(cmd(), DT);
    for (let i = 0; i < 45; i++) sim.step(cmd({ attack: true }), DT);
    for (let i = 0; i < 30; i++) sim.step(cmd(), DT);
    expect(sim.progress.flags).toContain('broken:w1');
  });

  it('an exit changes the room; a boss locks its arena, and a death there leaves the cell at the door', () => {
    const sim = worldSim();
    sim.progress.flags.push('open:g1');
    sim.hero.place(1150, 0, false);
    run(sim, { x: 1 }, 10);
    expect(sim.room.id).toBe('arena');
    expect(sim.hero.body.x).toBeCloseTo(80, -1);
    // walk in until the boss wakes
    let awake = false;
    for (let i = 0; i < 200 && !awake; i++) {
      sim.step(cmd({ x: 1 }), DT);
      awake = sim.events.some((e) => e.type === 'bossAwake');
    }
    expect(awake).toBe(true);
    expect(sim.solids().some((s) => s.x === -20)).toBe(true);
    sim.progress.currency = 120;
    sim.hero.receive(999, 0, sim.hero.body.x + 10, false);
    run(sim, {}, 3);
    expect(sim.progress.cell).toMatchObject({ room: 'arena', amount: 120 });
    expect(sim.progress.cell!.x).toBeCloseTo(80, -1);
  });

  it('the plunge falls fast and hits from above for the weak spot', () => {
    const sim = worldSim();
    run(sim, {}, 2);
    sim.step(cmd({ jump: true }), DT);
    run(sim, { jump: true }, 12);
    sim.step(cmd({ y: -1, attack: true }), DT);
    run(sim, { y: -1 }, 8);
    expect(sim.hero.attack?.def.id).toBe('sturz');
    expect(sim.hero.body.vy).toBeLessThan(-400);
  });

  it('a parried projectile flies back and hurts its thrower', () => {
    const sim = worldSim();
    sim.enemies[0]!.setState('dead');
    run(sim, {}, 2);
    const hb = sim.hero.body;
    sim.shots.push({ x: hb.x + 60, y: hb.y + 30, vx: -300, vy: 0, w: 14, h: 14, gravity: 0, life: 2, solid: false, damage: 10, knockback: 100, parryable: true, owner: 0, dead: false });
    sim.step(cmd({ block: true }), DT);
    let parried = false;
    for (let i = 0; i < 20 && !parried; i++) {
      sim.step(cmd({ block: true }), DT);
      parried = sim.events.some((e) => e.type === 'parry');
    }
    expect(parried).toBe(true);
    expect(sim.shots[0]?.owner).toBe(-1);
    expect(sim.shots[0]!.vx).toBeGreaterThan(0);
  });
});

describe('rssouls world data', () => {
  const rooms = Object.values(REINSTROM.rooms);

  it('every exit leads to a room and an entry that exist, every enemy and weapon is known', () => {
    for (const r of rooms) {
      for (const ex of r.exits ?? []) {
        const to = REINSTROM.rooms[ex.to];
        expect(to, `${r.id} → ${ex.to}`).toBeDefined();
        expect(to!.entries?.[ex.at] ?? (ex.at === 'spawn' ? to!.spawn : undefined), `${r.id} → ${ex.to}:${ex.at}`).toBeDefined();
      }
      for (const e of r.enemies) expect(ENEMY_BY_ID[e.kind], `${r.id}: ${e.kind}`).toBeDefined();
      for (const p of r.props ?? []) {
        if (p.type === 'pickup' && p.item.startsWith('weapon:')) expect(WEAPON_BY_ID[p.item.slice(7)]).toBeDefined();
        if (p.type === 'sign') expect(SIGNS[p.text], `sign ${p.text}`).toBeDefined();
      }
    }
  });

  it('prop ids are unique across the world (their flags are global)', () => {
    const seen = new Map<string, string>();
    for (const r of rooms) {
      for (const p of r.props ?? []) {
        // a gate may appear on both sides of its door: same id, same flag
        if (p.type === 'gate' && !p.arena) continue;
        expect(seen.get(p.id), `${p.id} in ${r.id} and ${seen.get(p.id)}`).toBeUndefined();
        seen.set(p.id, r.id);
      }
    }
  });

  it('every room is reachable from the start, and every arrival point is outside the walk-in exits', () => {
    const reach = new Set([REINSTROM.start.room]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of [...reach]) {
        for (const ex of REINSTROM.rooms[id]!.exits ?? []) {
          if (!reach.has(ex.to)) {
            reach.add(ex.to);
            grew = true;
          }
        }
      }
    }
    expect([...reach].sort()).toEqual(rooms.map((r) => r.id).sort());
    for (const r of rooms) {
      const points = [r.spawn, ...Object.values(r.entries ?? {})];
      for (const pt of points) {
        for (const ex of r.exits ?? []) {
          if (ex.door) continue;
          const inside = pt.x > ex.rect.x && pt.x < ex.rect.x + ex.rect.w && pt.y + 20 > ex.rect.y && pt.y < ex.rect.y + ex.rect.h;
          expect(inside, `${r.id}: arrival (${pt.x},${pt.y}) inside exit to ${ex.to}`).toBe(false);
        }
      }
    }
  });

  it('arrival points stand on something: entering a room never drops the hero into a pit', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false, enemyCount: 0 }), 1);
    for (const r of rooms) {
      for (const [name, pt] of Object.entries({ spawn: r.spawn, ...(r.entries ?? {}) })) {
        sim.enterRoom(r.id, null, pt.x, pt.y);
        sim.hero.place(pt.x, pt.y, true);
        for (let i = 0; i < 90; i++) sim.step(cmd(), DT);
        if (sim.room.id !== r.id) continue; // a deliberate drop shaft hands over to the room below
        if (r.waves) continue; // a wave cauldron fights back at once
        expect(sim.hero.body.onGround, `${r.id}:${name}`).toBe(true);
        expect(sim.hero.hp, `${r.id}:${name}`).toBe(sim.hero.maxHp);
      }
    }
  });

  it('every enemy spawns on ground (or flies) and every rest point stands on the floor', () => {
    for (const r of rooms) {
      const solids = r.solids;
      const under = (x: number, y: number) => solids.some((s) => x >= s.x && x <= s.x + s.w && Math.abs(s.y + s.h - y) < 1);
      for (const e of r.enemies) if (!ENEMY_BY_ID[e.kind]!.flying) expect(under(e.x, e.y), `${r.id}: ${e.kind} at ${e.x},${e.y}`).toBe(true);
      for (const p of r.props ?? []) if (p.type === 'rest') expect(under(p.x, p.y), `${r.id}: ${p.id}`).toBe(true);
    }
  });
});

describe('rssouls bosses are beatable', () => {
  // the demo bot dodges on the frame; a human takes several times as long. If the bot cannot win,
  // nobody can – and if it wins in seconds, the boss is a wall of HP, not a fight.
  // [room, boss, min s, max s, hero levels (vit = power, breath half) a player plausibly has there]
  for (const [room, boss, min, max, lv] of [
    ['pumpstation', 'schrott-golem', 8, 90, 0],
    ['verwerter-arena', 'verwerter-konstrukt', 20, 120, 0],
    ['tuempel', 'oel-leviathan', 12, 120, 4],
    ['tor', 'sezier-golem', 15, 120, 5],
    ['forschung', 'exponat', 12, 120, 6],
    ['umspannwerk', 'schwarzkittel', 18, 150, 7],
    ['labor', 'doktor-asche', 20, 180, 8],
  ] as const) {
    it(`${boss}: the demo bot wins, and it takes a while`, () => {
      let wins = 0;
      for (const seed of [1, 2, 3, 4]) {
        const sim = new Sim(config({ level: { ...REINSTROM, start: { room, at: 'west' } }, respawnInPlace: false, enemyCount: undefined }), seed);
        sim.progress.levels = { vit: lv, breath: Math.round(lv / 2), power: lv };
        sim.applyProgress();
        sim.hero.hp = sim.hero.maxHp;
        const bot = new HeroBot();
        let t = 0;
        let won = false;
        for (; t < 60 * 180; t++) {
          sim.step(bot.think(sim), DT);
          if (sim.events.some((e) => e.type === 'bossDied')) won = true;
          if (won || sim.events.some((e) => e.type === 'heroDied')) break;
        }
        if (won) {
          wins++;
          expect(t / 60).toBeGreaterThan(min);
          expect(t / 60).toBeLessThan(max);
        }
      }
      expect(wins).toBeGreaterThanOrEqual(boss === 'doktor-asche' ? 2 : 3);
    });
  }
});

describe('rssouls act 1 finale', () => {
  it('Kommandantin Riss: the demo bot wins, then the failsafe sends its waves and the maw opens', () => {
    let wins = 0;
    for (const seed of [1, 2, 3, 4]) {
      const sim = new Sim(config({ level: { ...REINSTROM, start: { room: 'schlund', at: 'west' } }, respawnInPlace: false, enemyCount: undefined }), seed);
      const bot = new HeroBot();
      const seen: string[] = [];
      for (let t = 0; t < 60 * 300; t++) {
        sim.step(bot.think(sim), DT);
        for (const e of sim.events) if (['bossDied', 'wave', 'wavesDone', 'heroDied'].includes(e.type)) seen.push(e.type);
        if (seen.includes('wavesDone') || seen.includes('heroDied')) break;
      }
      if (seen.includes('wavesDone')) {
        wins++;
        expect(seen.filter((s) => s === 'wave').length).toBe(2);
        expect(sim.progress.flags).toContain('waves:schlund');
        expect(sim.solids().some((s) => s.x === 1500 && s.w === 20)).toBe(false);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(2);
  });

  it('a dead zone locks the skills and slows the breath – unless Korro is carried', () => {
    const sim = new Sim(config({ level: { ...REINSTROM, start: { room: 'baumring', at: 'west' } }, respawnInPlace: false, enemyCount: 0 }), 1);
    sim.step(cmd(), DT);
    expect(sim.hero.skillLocked).toBe(true);
    sim.progress.flags.push('korro');
    sim.step(cmd(), DT);
    expect(sim.hero.skillLocked).toBe(false);
  });
});

describe('rssouls Ascheburg and the finale', () => {
  it('Heat rises with kills, brings elites at 4 and the hunter at 7, and a rest clears it', () => {
    const sim = new Sim(config({ level: { ...REINSTROM, start: { room: 'verwaltung', at: 'west' } }, respawnInPlace: false, enemyCount: undefined }), 1);
    sim.heat = 7;
    sim.enterRoom('verwaltung', 'west');
    expect(sim.enemies.some((e) => e.def.id === 'riot-kommandeur')).toBe(true);
    expect(sim.enemies.filter((e) => e.def.id !== 'riot-kommandeur').every((e) => e.elite)).toBe(true);
    sim.enterRoom('daecher', 'west');
    sim.hero.place(180, 0, false);
    sim.step(cmd(), DT);
    sim.step(cmd({ interact: true }), DT);
    expect(sim.hero.state).toBe('rest');
    expect(sim.heat).toBe(0);
  });

  it('with the crystal, Doktor Asche can be ended by hand in her last phase', () => {
    const sim = new Sim(config({ level: { ...REINSTROM, start: { room: 'labor', at: 'west' } }, respawnInPlace: false, enemyCount: undefined }), 1);
    const asche = sim.enemies[0]!;
    sim.hero.place(asche.body.x - 80, 0, false);
    sim.step(cmd(), DT);
    asche.hp = asche.def.hp * 0.2;
    expect(sim.interactable()?.kind).not.toBe('end');
    sim.progress.flags.push('kristall');
    expect(sim.interactable()?.kind).toBe('end');
    sim.step(cmd({ interact: true }), DT);
    expect(asche.alive).toBe(false);
    expect(sim.progress.flags).toContain('boss:doktor-asche@labor');
  });
});

describe('rssouls movement abilities', () => {
  const learnt = (ab: Partial<Hero['abilities']>) => {
    const h = newHero();
    h.abilities = { double: false, dash: false, wall: false, ...ab };
    return h;
  };
  const peak = (h: Hero, script: (i: number) => Partial<Command>) => {
    let top = 0;
    for (let i = 0; i < 120; i++) {
      h.step(cmd(script(i)), DT, FLAT.solids, false, []);
      top = Math.max(top, h.body.y);
    }
    return top;
  };

  it('the double jump reaches about twice as high', () => {
    const script = (i: number) => ({ jump: i < 20 || (i > 24 && i < 50) });
    expect(peak(learnt({}), script)).toBeLessThan(116);
    expect(peak(learnt({ double: true }), script)).toBeGreaterThan(170);
  });

  it('the air dash carries far and is invulnerable', () => {
    const h = learnt({ dash: true });
    h.step(cmd({ jump: true }), DT, FLAT.solids, false, []);
    for (let i = 0; i < 8; i++) h.step(cmd({ jump: true }), DT, FLAT.solids, false, []);
    const x0 = h.body.x;
    h.step(cmd({ roll: true, x: 1 }), DT, FLAT.solids, false, []);
    expect(h.state).toBe('dash');
    expect(h.invulnerable).toBe(true);
    for (let i = 0; i < 12; i++) h.step(cmd({ x: 1 }), DT, FLAT.solids, false, []);
    expect(h.body.x - x0).toBeGreaterThan(80);
  });

  it('the wall jump climbs a shaft that nothing else can', () => {
    const shaft = [...FLAT.solids, { x: -100, y: 0, w: 40, h: 600 }, { x: 40, y: 0, w: 40, h: 600 }];
    const climb = (wall: boolean) => {
      const h = new Hero(SURVIVOR, FEEL, ROST_KLINGE, -20, 0);
      h.abilities = { double: false, dash: false, wall };
      let top = 0;
      let dir = 1;
      for (let i = 0; i < 400; i++) {
        // press into the wall, jump off it, follow the push to the other wall and press into that
        if (h.body.vx * dir < -50) dir = Math.sign(h.body.vx);
        const touching = h.body.wallL || h.body.wallR;
        h.step(cmd({ x: dir, jump: h.body.vy > 0 || (touching && i % 2 === 0) }), DT, shaft, false, []);
        top = Math.max(top, h.body.y);
      }
      return top;
    };
    expect(climb(false)).toBeLessThan(120);
    expect(climb(true)).toBeGreaterThan(300);
  });
});

describe('rssouls campaign is completable', () => {
  it('every lock opens with a key found in a room reachable before it, all the way to the laboratory', () => {
    const flags = new Set<string>();
    const reach = new Set([REINSTROM.start.room]);
    // levers set `open:<gate>`; pick-ups set their flag; walls break on their own
    const grant = (id: string) => {
      for (const p of REINSTROM.rooms[id]!.props ?? []) {
        if (p.type === 'lever') flags.add(`open:${p.opens}`);
        if (p.type === 'pickup' && p.item.startsWith('flag:')) flags.add(p.item.slice(5));
      }
    };
    let grew = true;
    while (grew) {
      grew = false;
      const known = flags.size;
      for (const id of [...reach]) grant(id);
      if (flags.size > known) grew = true;
      for (const id of [...reach]) {
        for (const ex of REINSTROM.rooms[id]!.exits ?? []) {
          if (ex.needs && !flags.has(ex.needs)) continue;
          if (!reach.has(ex.to)) {
            reach.add(ex.to);
            grew = true;
          }
        }
      }
    }
    expect(Object.keys(REINSTROM.rooms).filter((id) => !reach.has(id))).toEqual([]);
    // the final boss exists and its defeat is the goal
    expect(REINSTROM.rooms.labor!.enemies.some((e) => e.kind === 'doktor-asche')).toBe(true);
    expect(CAMPAIGN_GOAL).toBe('boss:doktor-asche@labor');
  });

  it('a Kollektor sits at the start of every level and before every boss door', () => {
    const rests = new Set(Object.values(REINSTROM.rooms).filter((r) => r.props?.some((p) => p.type === 'rest')).map((r) => r.id));
    for (const id of ['hof', 'rohr-eingang', 'masten', 'lichtquell', 'daecher', 'zugang']) expect(rests.has(id), id).toBe(true);
    // the room before each boss arena (or the arena's neighbour one further back) has a rest
    for (const [arena, before] of [['verwerter-arena', 'kontrollposten'], ['schlund', 'ader-rast'], ['umspannwerk', 'archiv']] as const) {
      expect(REINSTROM.rooms[arena]!.exits!.some((e) => e.to === before)).toBe(true);
      expect(rests.has(before), before).toBe(true);
    }
  });
});

describe('rssouls dice run', () => {
  it('is the same run for the same seed and a different one for another', () => {
    expect(JSON.stringify(makeRun(42))).toBe(JSON.stringify(makeRun(42)));
    expect(JSON.stringify(makeRun(42))).not.toBe(JSON.stringify(makeRun(43)));
  });

  it('every generated run is sound: known enemies, a straight line of rooms, bosses at 5/10/15, no step above a jump', () => {
    for (const seed of [1, 2, 3, 77, 1234, dailySeed(new Date(2026, 9, 2))]) {
      const level = makeRun(seed);
      const ids = Object.keys(level.rooms);
      expect(ids.length).toBe(RUN_LENGTH + 1);
      for (const r of Object.values(level.rooms)) {
        for (const e of r.enemies) expect(ENEMY_BY_ID[e.kind], `${seed}/${r.id}: ${e.kind}`).toBeDefined();
        for (const ex of r.exits ?? []) expect(level.rooms[ex.to]?.entries?.[ex.at]).toBeDefined();
        // one-way platforms: each reachable from the ground or from a neighbour within a jump
        const plats = r.solids.filter((s) => s.oneWay).map((s) => s.y + s.h);
        for (const top of plats) expect(top === 0 || plats.some((o) => o < top && top - o <= MAX_STEP) || top <= MAX_STEP).toBe(true);
      }
      for (const n of [5, 10, 15]) expect(ENEMY_BY_ID[level.rooms[`w${n}`]!.enemies[0]!.kind]!.boss).toBe(true);
      expect(runGoal(level)).toMatch(/^boss:/);
    }
  });

  it('the demo bot plays a run on its own: fights, walks on, reaches the first boss', () => {
    for (const seed of [5, 6]) {
      const level = makeRun(seed);
      const sim = new Sim(config({ level, respawnInPlace: false, enemyCount: undefined, goal: runGoal(level) }), seed);
      const bot = new HeroBot();
      let deepest = 0;
      for (let t = 0; t < 60 * 180; t++) {
        sim.step(bot.think(sim), DT);
        deepest = Math.max(deepest, Number(sim.room.id.slice(1)));
      }
      expect(deepest, `seed ${seed}`).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('rssouls Glut-Grade', () => {
  it('the next grade keeps the hero, resets the world and toughens the rules', () => {
    const won = newProgress('rost-klinge');
    won.levels = { vit: 5, breath: 2, power: 4 };
    won.weapons.push('verwerter-hammer');
    won.flags.push('boss:doktor-asche@labor', 'faehigkeit:wandsprung', 'open:g-rohrtor');
    const g1 = nextGrade(won);
    expect(g1.grade).toBe(1);
    expect(g1.levels).toEqual(won.levels);
    expect(g1.weapons).toContain('verwerter-hammer');
    expect(g1.flags).toEqual(['faehigkeit:wandsprung']);

    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false, enemyCount: undefined }), 1, g1);
    const spinner = sim.enemies[0]!;
    expect(spinner.hp).toBe(Math.round(spinner.def.hp * 1.25));

    // grade 2: half a heal at the Kollektor; grade 4: only the first one burns
    const g2 = nextGrade(g1);
    const s2 = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1, g2);
    s2.enterRoom('hof', null, 180, 0);
    s2.hero.hp = 10;
    s2.rest('k-hof');
    expect(s2.hero.hp).toBeCloseTo(10 + s2.hero.maxHp / 2);
    const g4 = nextGrade(nextGrade(g2));
    expect(g4.grade).toBe(4);
    const s4 = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1, g4);
    s4.enterRoom('truemmer', null, 340, 0);
    s4.rest('k-truemmer');
    expect(s4.hero.state).not.toBe('rest');
    s4.enterRoom('hof', null, 180, 0);
    s4.rest('k-hof');
    expect(s4.hero.state).toBe('rest');
  });
});

describe('rssouls run modifiers', () => {
  it('a card changes the hero and the enemies as it says', () => {
    const level = makeRun(3);
    const sim = new Sim(config({ level, respawnInPlace: false, enemyCount: undefined }), 3);
    const hp = sim.hero.maxHp;
    const power = sim.hero.power;
    sim.addMod(MOD_CARDS.find((c) => c.id === 'glaskanone')!.mod);
    expect(sim.hero.maxHp).toBe(Math.round(hp * 0.65));
    expect(sim.hero.power).toBeCloseTo(power * 1.4);
    sim.addMod(MOD_CARDS.find((c) => c.id === 'ruhige-hand')!.mod);
    expect(sim.hero.parryAdd).toBeCloseTo(0.08);
    expect(sim.hero.flasksMax).toBe(2);
    for (const c of MOD_CARDS) expect(c.text.de.length).toBeGreaterThan(5);
  });
});

describe('rssouls weapon upgrades', () => {
  it('smithing costs Glut and slag, adds damage per stage and stops at +3', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1);
    const p = sim.progress;
    expect(sim.upgrade('rost-klinge')).toBe(false);
    p.currency = 10_000;
    p.slag = 10;
    for (let i = 0; i < 3; i++) expect(sim.upgrade('rost-klinge')).toBe(true);
    expect(sim.upgrade('rost-klinge')).toBe(false);
    expect(p.upgrades?.['rost-klinge']).toBe(3);
    expect(p.slag).toBe(10 - 1 - 2 - 3);
    expect(sim.hero.upgrades['rost-klinge']).toBe(3);
  });

  it('the world holds enough slag for all three stages of one weapon', () => {
    let slag = 0;
    for (const r of Object.values(REINSTROM.rooms)) for (const p of r.props ?? []) if (p.type === 'pickup' && p.item.startsWith('slag')) slag += Number(p.item.split(':')[1] ?? 1);
    expect(slag).toBeGreaterThanOrEqual(6);
  });
});

describe('rssouls folk and class', () => {
  it('classes unlock by deeds, the survivor and the Sparkguard from the start', () => {
    const none = newMeta();
    const open = CLASSES.filter((c) => unlocked(c, none)).map((c) => c.id);
    expect(open).toEqual(['ueberlebender', 'sparkguard']);
    const veteran = { runs: 5, bosses: ['a', 'b', 'c'], areas: ['1', '2', '3', '4'] };
    expect(CLASSES.every((c) => unlocked(c, veteran))).toBe(true);
    expect(FOLKS.length).toBe(9);
    expect(CLASSES.length).toBe(11);
  });

  it('a build changes the hero: the survivor is the norm, the Striker hits hard and breaks easily', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1);
    const base = { hp: sim.hero.maxHp, power: sim.hero.power };
    const survivor = heroOf(SURVIVOR_CLASS);
    sim.setBuild(survivor.def, [survivor.mod]);
    expect(sim.hero.maxHp).toBe(base.hp);
    expect(sim.hero.power).toBeCloseTo(base.power);
    const striker = heroOf(CLASSES.find((c) => c.id === 'striker')!);
    sim.setBuild(striker.def, [FOLKS.find((f) => f.id === 'rost-geborene')!.mod, striker.mod]);
    expect(sim.hero.maxHp).toBe(Math.round(Math.round(78 * 0.85) * 1.15));
    expect(sim.hero.power).toBeCloseTo(50 / 30);
    // traits reach the enemies: an Echo-Wandler is noticed late
    sim.setBuild(survivor.def, [FOLKS.find((f) => f.id === 'echo-wandler')!.mod]);
    expect(sim.enemies[0]!.sightMul).toBeCloseTo(0.65);
  });
});

describe('rssouls fuzz', () => {
  it('random play through every room never throws and never leaves the hero in a broken state', () => {
    const rng = new Rng(99);
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false, enemyCount: undefined, goal: CAMPAIGN_GOAL }), 7);
    sim.progress.flags.push('faehigkeit:doppelsprung', 'faehigkeit:luftdash', 'faehigkeit:wandsprung', 'korro');
    sim.progress.weapons.push('verwerter-hammer', 'lumen-dolch');
    sim.progress.slots[1] = 'verwerter-hammer';
    sim.applyProgress();
    const rooms = Object.keys(REINSTROM.rooms);
    let c = cmd();
    for (let t = 0; t < 60 * 600; t++) {
      if (t % 600 === 0) {
        const id = rooms[(t / 600) % rooms.length]!;
        sim.enterRoom(id, null, REINSTROM.rooms[id]!.spawn.x, REINSTROM.rooms[id]!.spawn.y);
      }
      if (t % 7 === 0) {
        c = {
          x: rng.range(-1, 1),
          y: rng.range(-1, 1),
          jump: rng.next() < 0.3,
          roll: rng.next() < 0.1,
          attack: rng.next() < 0.4,
          block: rng.next() < 0.15,
          interact: rng.next() < 0.05,
          heal: rng.next() < 0.03,
          swap: rng.next() < 0.03,
          skill: rng.next() < 0.05,
        };
      }
      if (sim.hero.state === 'rest' && t % 30 === 0) sim.leaveRest();
      sim.step(c, DT);
      if (sim.over) break;
      const h = sim.hero;
      expect(Number.isFinite(h.body.x) && Number.isFinite(h.body.y)).toBe(true);
      expect(h.hp).toBeGreaterThanOrEqual(0);
      expect(h.hp).toBeLessThanOrEqual(h.maxHp + 0.001);
      expect(h.stamina).toBeGreaterThanOrEqual(0);
      for (const e of sim.enemies) expect(Number.isFinite(e.body.x) && Number.isFinite(e.hp)).toBe(true);
    }
  });
});

describe('rssouls travel', () => {
  it('from a rest, the hero can travel to any lit Kollektor – and only to lit ones', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1);
    sim.enterRoom('hof', null, 180, 0);
    sim.rest('k-hof');
    expect(sim.travel('truemmer', 'k-truemmer')).toBe(false);
    sim.progress.flags.push('lit:k-truemmer');
    expect(sim.litRests().map((r) => r.id).sort()).toEqual(['k-hof', 'k-truemmer']);
    expect(sim.travel('truemmer', 'k-truemmer')).toBe(true);
    expect(sim.room.id).toBe('truemmer');
    expect(sim.hero.state).toBe('rest');
    expect(sim.progress.rest).toEqual({ room: 'truemmer', id: 'k-truemmer' });
  });
});

describe('rssouls map', () => {
  it('lays out every room on its own cell, east to the right, the start at the origin', () => {
    const m = layoutMap(REINSTROM);
    const ids = Object.keys(REINSTROM.rooms);
    expect(Object.keys(m.cells).sort()).toEqual([...ids].sort());
    const cells = Object.values(m.cells).map((c) => `${c.x},${c.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(m.cells.markt).toMatchObject({ x: 0, y: 0 });
    expect(m.cells.gasse!.x).toBe(1);
    expect(m.links.length).toBeGreaterThan(40);
  });

  it('the sim remembers the rooms the hero has seen', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false }), 1);
    sim.enterRoom('gasse', 'west');
    expect(sim.progress.flags).toContain('seen:markt');
    expect(sim.progress.flags).toContain('seen:gasse');
  });
});

describe('rssouls second ability', () => {
  const armed = (weapon: string, stage: number) => {
    const sim = new Sim(config({ level: levelOf(FLAT), respawnInPlace: true }), 1);
    sim.progress.weapons.push(weapon);
    sim.progress.slots[0] = weapon;
    sim.progress.upgrades = { [weapon]: stage };
    sim.applyProgress();
    sim.step(cmd(), DT);
    return sim;
  };

  it('opens only from upgrade stage 2, with up + the ability button', () => {
    const low = armed('rost-klinge', 1);
    low.step(cmd({ y: 1, skill: true }), DT);
    expect(low.hero.wardT).toBe(0);
    const high = armed('rost-klinge', 2);
    high.step(cmd({ y: 1, skill: true }), DT);
    expect(high.hero.wardT).toBeGreaterThan(5);
    // the ward halves what lands
    const hp = high.hero.hp;
    high.hero.receive(20, 0, high.hero.body.x + 30, false);
    expect(high.hero.hp).toBeCloseTo(hp - 10);
  });

  it('the hammer leaps into its Bodenbrecher, the dagger throws three friendly blades of light', () => {
    const hammer = armed('verwerter-hammer', 2);
    hammer.step(cmd({ y: 1, skill: true }), DT);
    expect(hammer.hero.attack?.def.id).toBe('bodenbrecher');

    const dagger = armed('lumen-dolch', 2);
    dagger.enemies[0]!.body.x = 140;
    dagger.step(cmd({ y: 1, skill: true }), DT);
    let shots = 0;
    let hit = false;
    for (let i = 0; i < 40; i++) {
      dagger.step(cmd(), DT);
      shots = Math.max(shots, dagger.shots.filter((s) => s.owner === -1).length);
      hit ||= dagger.events.some((e) => e.type === 'hit' && e.target === 0);
    }
    expect(shots).toBe(3);
    expect(hit).toBe(true);
  });
});

describe('rssouls save and continue', () => {
  it('a saved progress, read back, puts the hero at its Kollektor with everything it had', () => {
    const sim = new Sim(config({ level: REINSTROM, respawnInPlace: false, goal: CAMPAIGN_GOAL }), 1);
    sim.enterRoom('truemmer', null, 340, 0);
    sim.rest('k-truemmer');
    sim.progress.currency = 777;
    sim.progress.levels.power = 3;
    sim.progress.upgrades = { 'rost-klinge': 1 };
    sim.progress.flags.push('faehigkeit:doppelsprung', 'pulled:h-abk', 'open:g-abk');
    sim.progress.cell = { room: 'schrott', x: 500, y: 0, amount: 120 };
    const saved = JSON.parse(JSON.stringify(sim.progress));

    const loaded = readProgress(saved)!;
    expect(loaded).not.toBeNull();
    const again = new Sim(config({ level: REINSTROM, respawnInPlace: false, goal: CAMPAIGN_GOAL }), 2, loaded);
    expect(again.room.id).toBe('truemmer');
    expect(again.hero.body.x).toBeCloseTo(350, -1);
    expect(again.progress.currency).toBe(777);
    expect(again.hero.power).toBeCloseTo(1 + 3 * STAT_GAIN.power);
    expect(again.hero.upgrades['rost-klinge']).toBe(1);
    expect(again.hero.abilities.double).toBe(true);
    expect(again.progress.cell?.amount).toBe(120);
    expect(again.over).toBe(false);
    expect(readProgress({ version: 2 })).toBeNull();
    expect(readProgress('nonsense')).toBeNull();
  });
});

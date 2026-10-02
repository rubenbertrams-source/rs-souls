import type { WeaponDef } from '../core/types';

/**
 * Weapons of Reinstrom (UEBERGABE §7.2). Each class has its own pattern; the numbers are start
 * values. Atem costs follow the research note in plan/14-RSSOULS.md: five light swings on a full bar.
 */

/** Klinge: Hieb – Hieb – Stich, holding the first link charges a wide cut, block 50 %, parry 0.20 s. */
export const ROST_KLINGE: WeaponDef = {
  id: 'rost-klinge',
  name: 'Rost-Klinge',
  damage: 34,
  moveset: {
    start: 'hieb1',
    up: 'aufwaerts',
    down: 'sturz',
    air: 'luft',
    charge: 'ladung',
    chargeTime: 0.5,
    block: { reduction: 0.5, parry: 0.2 },
    speed: 1,
    attacks: {
      hieb1: {
        id: 'hieb1', kind: 'slash', windup: 0.14, active: 0.1, recovery: 0.3,
        damage: 1, poise: 12, knockback: 120, cost: 20,
        box: { x: -6, y: 8, w: 58, h: 44 }, next: 'hieb2', comboWindow: 0.24,
      },
      hieb2: {
        id: 'hieb2', kind: 'slash', windup: 0.12, active: 0.1, recovery: 0.3,
        damage: 1, poise: 12, knockback: 120, cost: 20,
        box: { x: -6, y: 4, w: 58, h: 46 }, next: 'stich', comboWindow: 0.24,
      },
      stich: {
        id: 'stich', kind: 'thrust', windup: 0.18, active: 0.12, recovery: 0.42,
        damage: 1.25, poise: 18, knockback: 210, cost: 22, lunge: 170,
        box: { x: 0, y: 20, w: 70, h: 16 },
      },
      ladung: {
        id: 'ladung', kind: 'charge', windup: 0.5, active: 0.14, recovery: 0.5,
        damage: 2, poise: 30, knockback: 280, cost: 36, lunge: 60,
        box: { x: -10, y: 0, w: 84, h: 62 },
      },
      aufwaerts: {
        id: 'aufwaerts', kind: 'slash', windup: 0.16, active: 0.12, recovery: 0.34,
        damage: 1, poise: 12, knockback: 80, cost: 20,
        box: { x: -24, y: 30, w: 60, h: 62 },
      },
      luft: {
        id: 'luft', kind: 'slash', windup: 0.1, active: 0.14, recovery: 0.22,
        damage: 0.9, poise: 10, knockback: 100, cost: 18,
        box: { x: -8, y: -8, w: 56, h: 60 },
      },
      /** Air + down: the plunge. Lands with the blade first; the way "from above". */
      sturz: {
        id: 'sturz', kind: 'thrust', windup: 0.08, active: 0.8, recovery: 0.32,
        damage: 1.6, poise: 30, knockback: 60, cost: 18, leap: { vx: 0, vy: -650 },
        box: { x: -30, y: -16, w: 36, h: 40 },
      },
    },
  },
  skill: {
    cooldown: 7,
    /** Rost-Splitter: rust shards burst from the blade all around. */
    attack: {
      id: 'rost-splitter', kind: 'charge', windup: 0.22, active: 0.16, recovery: 0.4,
      damage: 1.3, poise: 25, knockback: 220, cost: 26, around: true,
      box: { x: 0, y: -4, w: 150, h: 70 },
    },
  },
  /** Rostwand: a skin of rust – six seconds of half damage. */
  skill2: { id: 'rostwand', cooldown: 16, cost: 15, ward: { time: 6, damageMul: 0.5 } },
};

/** Hammer: two slow, heavy blows, no block; the charge is a ground slam that breaks walls. */
export const VERWERTER_HAMMER: WeaponDef = {
  id: 'verwerter-hammer',
  name: 'Verwerter-Hammer',
  damage: 62,
  moveset: {
    start: 'schlag1',
    down: 'hammersturz',
    air: 'hammerluft',
    charge: 'bodenschlag',
    chargeTime: 0.7,
    block: null,
    speed: 0.85,
    attacks: {
      schlag1: {
        id: 'schlag1', kind: 'slash', windup: 0.42, active: 0.14, recovery: 0.5,
        damage: 1, poise: 40, knockback: 260, cost: 38, lunge: 50,
        box: { x: -8, y: 0, w: 66, h: 60 }, next: 'schlag2', comboWindow: 0.3,
      },
      schlag2: {
        id: 'schlag2', kind: 'slash', windup: 0.38, active: 0.14, recovery: 0.6,
        damage: 1.15, poise: 45, knockback: 300, cost: 38, lunge: 60,
        box: { x: -8, y: 0, w: 70, h: 64 },
      },
      bodenschlag: {
        id: 'bodenschlag', kind: 'charge', windup: 0.7, active: 0.16, recovery: 0.7,
        damage: 1.8, poise: 70, knockback: 340, cost: 44, around: true,
        box: { x: 0, y: -4, w: 190, h: 50 },
      },
      hammerluft: {
        id: 'hammerluft', kind: 'slash', windup: 0.2, active: 0.16, recovery: 0.3,
        damage: 0.9, poise: 30, knockback: 200, cost: 30,
        box: { x: -10, y: -14, w: 60, h: 64 },
      },
      hammersturz: {
        id: 'hammersturz', kind: 'charge', windup: 0.12, active: 0.8, recovery: 0.45,
        damage: 1.7, poise: 60, knockback: 200, cost: 30, leap: { vx: 0, vy: -720 },
        box: { x: -40, y: -16, w: 56, h: 44 },
      },
    },
  },
  skill: {
    cooldown: 10,
    /** Schlagwelle: the ground answers the hammer on both sides. */
    attack: {
      id: 'schlagwelle', kind: 'charge', windup: 0.35, active: 0.2, recovery: 0.6,
      damage: 1.2, poise: 60, knockback: 320, cost: 34, around: true,
      box: { x: 0, y: -4, w: 300, h: 34 },
    },
  },
  /** Bodenbrecher: a leap forward that comes down hammer first. */
  skill2: {
    id: 'bodenbrecher', cooldown: 12, cost: 30,
    attack: {
      id: 'bodenbrecher', kind: 'charge', windup: 0.3, active: 0.22, recovery: 0.6,
      damage: 1.6, poise: 70, knockback: 320, cost: 30, lunge: 340,
      box: { x: -10, y: 0, w: 90, h: 70 },
    },
  },
};

/** Dolch: four quick stabs, low stagger, no real block but a tight parry; the fast answer. */
export const LUMEN_DOLCH: WeaponDef = {
  id: 'lumen-dolch',
  name: 'Lumen-Dolch',
  damage: 19,
  moveset: {
    start: 'dolch1',
    air: 'dolchluft',
    down: 'dolchsturz',
    chargeTime: 0,
    block: { reduction: 0, parry: 0.15 },
    speed: 1.12,
    attacks: {
      dolch1: { id: 'dolch1', kind: 'thrust', windup: 0.07, active: 0.07, recovery: 0.18, damage: 1, poise: 5, knockback: 60, cost: 12, box: { x: -4, y: 18, w: 42, h: 20 }, next: 'dolch2', comboWindow: 0.18 },
      dolch2: { id: 'dolch2', kind: 'thrust', windup: 0.06, active: 0.07, recovery: 0.18, damage: 1, poise: 5, knockback: 60, cost: 12, box: { x: -4, y: 22, w: 42, h: 20 }, next: 'dolch3', comboWindow: 0.18 },
      dolch3: { id: 'dolch3', kind: 'slash', windup: 0.07, active: 0.08, recovery: 0.2, damage: 1.1, poise: 6, knockback: 80, cost: 12, box: { x: -6, y: 10, w: 46, h: 36 }, next: 'dolch4', comboWindow: 0.2 },
      dolch4: { id: 'dolch4', kind: 'thrust', windup: 0.12, active: 0.1, recovery: 0.34, damage: 1.6, poise: 12, knockback: 160, cost: 14, lunge: 220, box: { x: 0, y: 18, w: 56, h: 18 } },
      dolchluft: { id: 'dolchluft', kind: 'slash', windup: 0.06, active: 0.1, recovery: 0.16, damage: 1, poise: 5, knockback: 60, cost: 10, box: { x: -6, y: -4, w: 44, h: 52 } },
      dolchsturz: { id: 'dolchsturz', kind: 'thrust', windup: 0.06, active: 0.8, recovery: 0.25, damage: 1.8, poise: 18, knockback: 40, cost: 14, leap: { vx: 0, vy: -650 }, box: { x: -22, y: -16, w: 22, h: 36 } },
    },
  },
  skill: {
    cooldown: 5,
    /** Licht-Schnitt: a dash through the line ahead. */
    attack: {
      id: 'licht-schnitt', kind: 'thrust', windup: 0.12, active: 0.18, recovery: 0.3,
      damage: 2, poise: 15, knockback: 120, cost: 20, lunge: 520,
      box: { x: -30, y: 8, w: 70, h: 36 },
    },
  },
  /** Lichtfächer: three blades of light, thrown. */
  skill2: {
    id: 'lichtfaecher', cooldown: 9, cost: 20,
    attack: {
      id: 'lichtfaecher', kind: 'thrust', windup: 0.15, active: 0.1, recovery: 0.3,
      damage: 0.9, poise: 10, knockback: 120, cost: 20,
      box: { x: 0, y: 0, w: 1, h: 1 },
      projectile: { speed: 520, arc: 0, gravity: 0, w: 14, h: 6, life: 1, solid: true, count: 3, spread: 0.25 },
    },
  },
};

export const WEAPONS: WeaponDef[] = [ROST_KLINGE, VERWERTER_HAMMER, LUMEN_DOLCH];
export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

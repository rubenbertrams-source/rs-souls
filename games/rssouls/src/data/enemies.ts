import type { AttackDef, EnemyDef } from '../core/types';

/**
 * Enemies of Reinstrom (UEBERGABE §6.5), tuned along the research note in plan/14-RSSOULS.md:
 * a regular enemy takes 10–15 % of the hero's life per hit, a boss 20–30 %; every wind-up is a
 * readable telegraph (≥ 0.35 s, regulars 0.5–0.8 s); `parryable: false` shows a red marker.
 */

const atk = (a: AttackDef): AttackDef => a;

/** Level 1: the teaching enemy. A rust construct – the bite can be parried, the pounce not. */
export const ROST_SPINNER: EnemyDef = {
  id: 'rost-spinner',
  name: 'Rost-Spinner',
  w: 44, h: 26, hp: 40, damage: 14, poise: 20, poiseDelay: 1.5, stagger: 0.9, parryStagger: 1.6,
  patrolSpeed: 45, chaseSpeed: 120, sight: 280, lose: 420, cooldown: [0.7, 1.3], reward: 25,
  attacks: [
    atk({
      id: 'biss', kind: 'thrust', windup: 0.5, active: 0.12, recovery: 0.55,
      damage: 1, poise: 0, knockback: 180, cost: 0, lunge: 140,
      box: { x: -4, y: 2, w: 34, h: 26 }, parryable: true, range: [0, 62],
    }),
    atk({
      id: 'sprung', kind: 'thrust', windup: 0.6, active: 0.6, recovery: 0.6,
      damage: 1, poise: 0, knockback: 220, cost: 0, leap: { vx: 290, vy: 380 },
      box: { x: -14, y: 0, w: 40, h: 30 }, parryable: false, range: [120, 220],
    }),
  ],
};

/** Level 1/2: vermin in numbers. Weak, quick, never parryable. */
export const RATTE: EnemyDef = {
  id: 'ratte',
  name: 'Ratte',
  w: 30, h: 16, hp: 18, damage: 8, poise: 6, poiseDelay: 1, stagger: 0.6, parryStagger: 1,
  patrolSpeed: 60, chaseSpeed: 150, sight: 240, lose: 380, cooldown: [0.5, 1], reward: 8, light: true,
  attacks: [
    atk({
      id: 'nagen', kind: 'thrust', windup: 0.4, active: 0.1, recovery: 0.4,
      damage: 1, poise: 0, knockback: 100, cost: 0, lunge: 160,
      box: { x: -4, y: 0, w: 26, h: 18 }, parryable: false, range: [0, 50],
    }),
  ],
};

/** Level 1: a scrap drone with the boss's overhead blow – the lesson "roll through, not away". */
export const SCHROTT_DROHNE: EnemyDef = {
  id: 'schrott-drohne',
  name: 'Schrott-Drohne',
  w: 34, h: 50, hp: 60, damage: 15, poise: 30, poiseDelay: 1.5, stagger: 1, parryStagger: 1.6,
  patrolSpeed: 35, chaseSpeed: 75, sight: 260, lose: 400, cooldown: [0.9, 1.5], reward: 40,
  attacks: [
    atk({
      id: 'ueberkopf', kind: 'slash', windup: 0.8, active: 0.14, recovery: 0.9,
      damage: 1, poise: 0, knockback: 240, cost: 0,
      box: { x: -10, y: 0, w: 62, h: 70 }, parryable: false, range: [0, 80],
    }),
  ],
};

/** Level 1: holds its shield to the front; only its back is open (the lesson "go round"). */
export const SCHILDTRAEGER: EnemyDef = {
  id: 'schildtraeger',
  name: 'Schildträger',
  w: 32, h: 54, hp: 70, damage: 14, poise: 40, poiseDelay: 1.5, stagger: 1, parryStagger: 1.8,
  patrolSpeed: 35, chaseSpeed: 80, sight: 260, lose: 400, cooldown: [1, 1.6], reward: 45, weakSpot: 1.5, frontGuard: 0.15,
  attacks: [
    atk({
      id: 'schildstoss', kind: 'thrust', windup: 0.6, active: 0.12, recovery: 0.6,
      damage: 1, poise: 0, knockback: 260, cost: 0, lunge: 120,
      box: { x: -4, y: 6, w: 40, h: 48 }, parryable: true, range: [0, 64],
    }),
  ],
};

/** Level 2: lurks in pipes and drops out of them. */
export const ROHR_KRIECHER: EnemyDef = {
  id: 'rohr-kriecher',
  name: 'Rohr-Kriecher',
  w: 36, h: 18, hp: 22, damage: 9, poise: 8, poiseDelay: 1, stagger: 0.7, parryStagger: 1, light: true,
  patrolSpeed: 50, chaseSpeed: 135, sight: 220, lose: 360, cooldown: [0.6, 1.1], reward: 12,
  attacks: [
    atk({
      id: 'schnapp', kind: 'thrust', windup: 0.45, active: 0.5, recovery: 0.5,
      damage: 1, poise: 0, knockback: 140, cost: 0, leap: { vx: 260, vy: 260 },
      box: { x: -10, y: 0, w: 32, h: 20 }, parryable: false, range: [40, 170],
    }),
    atk({
      id: 'biss-k', kind: 'thrust', windup: 0.4, active: 0.1, recovery: 0.4,
      damage: 1, poise: 0, knockback: 100, cost: 0, lunge: 120,
      box: { x: -4, y: 0, w: 28, h: 20 }, parryable: false, range: [0, 40],
    }),
  ],
};

/** Level 2: NEBELWERK guard, in pairs, calls for help. Humanoid: everything can be parried. */
export const NEBELWERK_WACHE: EnemyDef = {
  id: 'nebelwerk-wache',
  name: 'NEBELWERK-Wache',
  w: 26, h: 56, hp: 75, damage: 15, poise: 40, poiseDelay: 1.5, stagger: 1, parryStagger: 1.8,
  patrolSpeed: 40, chaseSpeed: 110, sight: 300, lose: 460, cooldown: [0.8, 1.4], reward: 55, callsHelp: true,
  attacks: [
    atk({
      id: 'stoss', kind: 'thrust', windup: 0.55, active: 0.12, recovery: 0.5,
      damage: 1, poise: 0, knockback: 200, cost: 0, lunge: 160,
      box: { x: -2, y: 22, w: 58, h: 16 }, parryable: true, range: [0, 80], next: 'nachstoss',
    }),
    atk({
      id: 'nachstoss', kind: 'slash', windup: 0.45, active: 0.12, recovery: 0.7,
      damage: 1.1, poise: 0, knockback: 220, cost: 0,
      box: { x: -8, y: 6, w: 56, h: 50 }, parryable: true,
    }),
    atk({
      id: 'knueppel', kind: 'slash', windup: 0.75, active: 0.14, recovery: 0.7,
      damage: 1.3, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 60, h: 64 }, parryable: true, range: [0, 70],
    }),
  ],
};

/** Level 2: spits tar that glues the roll. The glob can be parried back. */
export const TEERBINDER: EnemyDef = {
  id: 'teerbinder',
  name: 'Teerbinder',
  w: 40, h: 40, hp: 80, damage: 12, poise: 40, poiseDelay: 1.5, stagger: 1, parryStagger: 1.6,
  patrolSpeed: 25, chaseSpeed: 55, sight: 360, lose: 520, cooldown: [1.2, 2], reward: 60,
  attacks: [
    atk({
      id: 'auswurf', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.7,
      damage: 1, poise: 0, knockback: 120, cost: 0, effect: 'tar',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [90, 360],
      projectile: { speed: 330, arc: 300, gravity: 900, w: 14, h: 14, life: 2.5, solid: true },
    }),
    atk({
      id: 'klatsch', kind: 'slash', windup: 0.6, active: 0.14, recovery: 0.6,
      damage: 1.2, poise: 0, knockback: 220, cost: 0, effect: 'tar',
      box: { x: -8, y: 0, w: 46, h: 42 }, parryable: true, range: [0, 70],
    }),
  ],
};

/** Level 2 mid-boss: guards the pumping station. */
export const SCHROTT_GOLEM: EnemyDef = {
  id: 'schrott-golem',
  name: 'Schrott-Golem',
  w: 70, h: 90, hp: 520, damage: 20, poise: 110, poiseDelay: 2, stagger: 1.4, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 70, sight: 420, lose: 9999, cooldown: [0.8, 1.4], reward: 450, boss: true,
  attacks: [
    atk({
      id: 'faust', kind: 'slash', windup: 0.75, active: 0.16, recovery: 0.8,
      damage: 1, poise: 0, knockback: 280, cost: 0, lunge: 80,
      box: { x: -10, y: 10, w: 70, h: 70 }, parryable: true, range: [0, 100],
    }),
    atk({
      id: 'stampf', kind: 'charge', windup: 0.9, active: 0.14, recovery: 1.2,
      damage: 1.2, poise: 0, knockback: 260, cost: 0, around: true,
      box: { x: 0, y: -2, w: 260, h: 24 }, parryable: false, range: [0, 150],
    }),
    atk({
      id: 'brocken', kind: 'thrust', windup: 0.8, active: 0.1, recovery: 0.8,
      damage: 0.8, poise: 0, knockback: 160, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [160, 600],
      projectile: { speed: 380, arc: 420, gravity: 1000, w: 18, h: 18, life: 3, solid: true },
    }),
  ],
};

/**
 * Level 2 boss: the Verwerter-Konstrukt. Teaches in order (research note §8): roll through the
 * overhead blow, parry the sweep, jump the stomp's shockwave and plunge while it is stuck, close in
 * against the scrap throw. Phase 2: the red core spin (roll out only), then the overheated back.
 */
export const VERWERTER_KONSTRUKT: EnemyDef = {
  id: 'verwerter-konstrukt',
  name: 'Verwerter-Konstrukt',
  w: 90, h: 110, hp: 1100, damage: 24, poise: 170, poiseDelay: 2.5, stagger: 1.6, parryStagger: 2.2,
  patrolSpeed: 0, chaseSpeed: 80, sight: 480, lose: 9999, cooldown: [0.6, 1.2], reward: 1400,
  boss: true, weakSpot: 1.5, phase2: { below: 0.5, telegraphMul: 0.85, speedMul: 1.15 },
  attacks: [
    atk({
      id: 'hammer', kind: 'slash', windup: 0.9, active: 0.16, recovery: 1.2,
      damage: 1.1, poise: 0, knockback: 300, cost: 0, lunge: 60,
      box: { x: -20, y: 0, w: 96, h: 110 }, parryable: false, range: [0, 110], phase: 1,
    }),
    atk({
      id: 'sweep', kind: 'slash', windup: 0.7, active: 0.16, recovery: 0.9,
      damage: 1, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 110, h: 40 }, parryable: true, range: [0, 120],
    }),
    atk({
      id: 'stampfer', kind: 'charge', windup: 1, active: 0.14, recovery: 1.5,
      damage: 1, poise: 0, knockback: 280, cost: 0, around: true,
      box: { x: 0, y: -2, w: 360, h: 26 }, parryable: false, range: [0, 200],
    }),
    atk({
      id: 'schrott', kind: 'thrust', windup: 0.8, active: 0.1, recovery: 0.9,
      damage: 0.7, poise: 0, knockback: 160, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [200, 700],
      projectile: { speed: 420, arc: 460, gravity: 1000, w: 18, h: 18, life: 3, solid: true, count: 3, spread: 0.35 },
    }),
    atk({
      id: 'glutkern', kind: 'charge', windup: 1, active: 0.8, recovery: 2,
      damage: 1.2, poise: 0, knockback: 320, cost: 0, around: true, effect: 'burn',
      box: { x: 0, y: 0, w: 230, h: 120 }, parryable: false, range: [0, 140], phase: 2,
    }),
    atk({
      id: 'hammer2', kind: 'slash', windup: 0.75, active: 0.16, recovery: 0.4,
      damage: 1.1, poise: 0, knockback: 300, cost: 0, lunge: 60,
      box: { x: -20, y: 0, w: 96, h: 110 }, parryable: false, range: [0, 110], phase: 2, next: 'hammer3',
    }),
    atk({
      id: 'hammer3', kind: 'slash', windup: 0.6, active: 0.16, recovery: 0.4,
      damage: 1.1, poise: 0, knockback: 300, cost: 0, lunge: 60,
      box: { x: -20, y: 0, w: 96, h: 110 }, parryable: false, next: 'sweep2',
    }),
    atk({
      id: 'sweep2', kind: 'slash', windup: 0.85, active: 0.16, recovery: 1.1,
      damage: 1, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 110, h: 40 }, parryable: true,
    }),
  ],
};

// ------------------------------------------------------------------ Level 3: Schwarze Ader

/** Lurks in the soot, leaps out of hiding: a high single blow. Notices late, hits hard. */
export const RUSS_KRIECHER: EnemyDef = {
  id: 'russ-kriecher',
  name: 'Ruß-Kriecher',
  w: 40, h: 22, hp: 45, damage: 16, poise: 15, poiseDelay: 1.2, stagger: 0.8, parryStagger: 1.2,
  patrolSpeed: 0, chaseSpeed: 140, sight: 170, lose: 400, cooldown: [0.7, 1.2], reward: 45,
  attacks: [
    atk({
      id: 'hervorschnellen', kind: 'thrust', windup: 0.45, active: 0.5, recovery: 0.6,
      damage: 1, poise: 0, knockback: 220, cost: 0, leap: { vx: 330, vy: 300 },
      box: { x: -12, y: 0, w: 40, h: 24 }, parryable: false, range: [50, 190],
    }),
    atk({
      id: 'russbiss', kind: 'thrust', windup: 0.5, active: 0.12, recovery: 0.5,
      damage: 0.8, poise: 0, knockback: 140, cost: 0, lunge: 120,
      box: { x: -4, y: 0, w: 32, h: 24 }, parryable: true, range: [0, 50],
    }),
  ],
};

/** Wild beast of the vein: its bite sets you burning. */
export const GLUT_WILD: EnemyDef = {
  id: 'glut-wild',
  name: 'Glut-Wild',
  w: 50, h: 34, hp: 60, damage: 13, poise: 45, poiseDelay: 1.5, stagger: 0.9, parryStagger: 1.4,
  patrolSpeed: 50, chaseSpeed: 160, sight: 300, lose: 460, cooldown: [0.8, 1.3], reward: 55,
  attacks: [
    atk({
      id: 'gluthorn', kind: 'thrust', windup: 0.55, active: 0.35, recovery: 0.7,
      damage: 1, poise: 0, knockback: 260, cost: 0, lunge: 360, effect: 'burn',
      box: { x: -6, y: 4, w: 36, h: 30 }, parryable: false, range: [40, 200],
    }),
    atk({
      id: 'stampfen', kind: 'slash', windup: 0.5, active: 0.12, recovery: 0.5,
      damage: 0.9, poise: 0, knockback: 200, cost: 0,
      box: { x: -8, y: 0, w: 44, h: 36 }, parryable: true, range: [0, 50],
    }),
  ],
};

/** NEBELWERK sensor drone: hovers, shoots straight, raises the alarm. */
export const SENSOR_DROHNE: EnemyDef = {
  id: 'sensor-drohne',
  name: 'Sensor-Drohne',
  w: 30, h: 22, hp: 30, damage: 10, poise: 10, poiseDelay: 1, stagger: 0.8, parryStagger: 1.2,
  patrolSpeed: 40, chaseSpeed: 70, sight: 380, lose: 520, cooldown: [1.4, 2.2], reward: 35,
  flying: true, callsHelp: true, light: true,
  attacks: [
    atk({
      id: 'abtaster', kind: 'thrust', windup: 0.65, active: 0.1, recovery: 0.6,
      damage: 1, poise: 0, knockback: 120, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [60, 420],
      projectile: { speed: 340, arc: 0, gravity: 0, w: 10, h: 10, life: 2, solid: true },
    }),
  ],
};

/**
 * Level 3 boss: Kommandantin Riss, keeper of the vein. A soldier: quick, readable, everything she
 * does with the blade can be parried; the gun cannot. Below half she triggers the failsafe.
 */
export const KOMMANDANTIN_RISS: EnemyDef = {
  id: 'kommandantin-riss',
  name: 'Kommandantin Riss',
  w: 28, h: 58, hp: 900, damage: 20, poise: 130, poiseDelay: 2, stagger: 1.3, parryStagger: 1.8,
  patrolSpeed: 0, chaseSpeed: 150, sight: 460, lose: 9999, cooldown: [0.4, 0.9], reward: 1800,
  boss: true, phase2: { below: 0.5, telegraphMul: 0.85, speedMul: 1.2 },
  attacks: [
    atk({
      id: 'ausfall', kind: 'thrust', windup: 0.5, active: 0.12, recovery: 0.3,
      damage: 1, poise: 0, knockback: 220, cost: 0, lunge: 340,
      box: { x: -4, y: 20, w: 60, h: 18 }, parryable: true, range: [60, 200], next: 'nachsetzen',
    }),
    atk({
      id: 'nachsetzen', kind: 'slash', windup: 0.42, active: 0.12, recovery: 0.6,
      damage: 1, poise: 0, knockback: 240, cost: 0, lunge: 120,
      box: { x: -10, y: 4, w: 62, h: 52 }, parryable: true,
    }),
    atk({
      id: 'kreuzhieb', kind: 'slash', windup: 0.55, active: 0.14, recovery: 0.4,
      damage: 1.1, poise: 0, knockback: 240, cost: 0,
      box: { x: -10, y: 0, w: 66, h: 60 }, parryable: true, range: [0, 70], next: 'kreuzhieb2',
    }),
    atk({
      id: 'kreuzhieb2', kind: 'slash', windup: 0.45, active: 0.14, recovery: 0.7,
      damage: 1.1, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 66, h: 60 }, parryable: true,
    }),
    atk({
      id: 'schuss', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.6,
      damage: 1.2, poise: 0, knockback: 200, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: false, range: [220, 700],
      projectile: { speed: 620, arc: 0, gravity: 0, w: 10, h: 6, life: 1.6, solid: true },
    }),
    atk({
      id: 'granate', kind: 'thrust', windup: 0.75, active: 0.1, recovery: 0.7,
      damage: 0.9, poise: 0, knockback: 200, cost: 0, effect: 'burn',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [120, 500], phase: 2,
      projectile: { speed: 380, arc: 420, gravity: 1000, w: 16, h: 16, life: 3, solid: true, count: 2, spread: 0.3 },
    }),
    atk({
      id: 'sturmangriff', kind: 'thrust', windup: 0.6, active: 0.4, recovery: 0.9,
      damage: 1.3, poise: 0, knockback: 300, cost: 0, lunge: 480,
      box: { x: -6, y: 4, w: 50, h: 52 }, parryable: false, range: [150, 420], phase: 2,
    }),
  ],
};

/** Woken by the failsafe at the maw: slow, heavy, a slam that shakes the ground. */
export const SCHLUND_WAECHTER: EnemyDef = {
  id: 'schlund-waechter',
  name: 'Schlund-Wächter',
  w: 64, h: 84, hp: 360, damage: 22, poise: 150, poiseDelay: 2, stagger: 1.5, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 70, sight: 600, lose: 9999, cooldown: [0.9, 1.5], reward: 600, weakSpot: 1.3,
  attacks: [
    atk({
      id: 'schlundschlag', kind: 'slash', windup: 0.85, active: 0.16, recovery: 0.9,
      damage: 1, poise: 0, knockback: 300, cost: 0, lunge: 60,
      box: { x: -10, y: 0, w: 74, h: 84 }, parryable: true, range: [0, 100],
    }),
    atk({
      id: 'beben', kind: 'charge', windup: 1, active: 0.14, recovery: 1.3,
      damage: 1.1, poise: 0, knockback: 280, cost: 0, around: true,
      box: { x: 0, y: -2, w: 300, h: 24 }, parryable: false, range: [0, 180],
    }),
  ],
};

/** Optional: lives in the still pool. Whoever digs there wakes it. */
export const OEL_LEVIATHAN: EnemyDef = {
  id: 'oel-leviathan',
  name: 'Öl-Leviathan',
  w: 110, h: 90, hp: 1100, damage: 22, poise: 250, poiseDelay: 3, stagger: 1.5, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 0, sight: 420, lose: 9999, cooldown: [0.7, 1.3], reward: 1500, boss: true,
  phase2: { below: 0.5, telegraphMul: 0.85, speedMul: 1.2 },
  attacks: [
    atk({
      id: 'tentakel', kind: 'slash', windup: 0.8, active: 0.18, recovery: 0.8,
      damage: 1, poise: 0, knockback: 300, cost: 0,
      box: { x: -20, y: 0, w: 170, h: 40 }, parryable: true, range: [0, 230],
    }),
    atk({
      id: 'oelfontaene', kind: 'charge', windup: 0.95, active: 0.3, recovery: 1,
      damage: 1.1, poise: 0, knockback: 260, cost: 0, around: true, effect: 'tar',
      box: { x: 0, y: 0, w: 260, h: 160 }, parryable: false, range: [0, 140],
    }),
    atk({
      id: 'oelklumpen', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.7,
      damage: 0.8, poise: 0, knockback: 160, cost: 0, effect: 'tar',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [200, 700],
      projectile: { speed: 420, arc: 480, gravity: 1000, w: 18, h: 18, life: 3, solid: true, count: 3, spread: 0.4 },
    }),
  ],
};

// ------------------------------------------------------------------ Level 4–6: to Ascheburg and below it

/** NEBELWERK elite guard: shield bash, sabre combos, everything parryable. */
export const GARDE: EnemyDef = {
  id: 'garde',
  name: 'Garde',
  w: 28, h: 60, hp: 120, damage: 17, poise: 60, poiseDelay: 1.5, stagger: 1, parryStagger: 1.8,
  patrolSpeed: 45, chaseSpeed: 120, sight: 320, lose: 480, cooldown: [0.6, 1.1], reward: 90, callsHelp: true,
  attacks: [
    atk({
      id: 'saebel', kind: 'slash', windup: 0.5, active: 0.12, recovery: 0.3,
      damage: 1, poise: 0, knockback: 200, cost: 0, lunge: 140,
      box: { x: -8, y: 6, w: 60, h: 50 }, parryable: true, range: [0, 90], next: 'saebel2',
    }),
    atk({
      id: 'saebel2', kind: 'thrust', windup: 0.4, active: 0.12, recovery: 0.6,
      damage: 1.1, poise: 0, knockback: 240, cost: 0, lunge: 220,
      box: { x: -4, y: 22, w: 62, h: 16 }, parryable: true,
    }),
    atk({
      id: 'schildramme', kind: 'thrust', windup: 0.65, active: 0.3, recovery: 0.7,
      damage: 1, poise: 0, knockback: 320, cost: 0, lunge: 380,
      box: { x: -4, y: 4, w: 40, h: 54 }, parryable: false, range: [90, 240],
    }),
  ],
};

/** A foreman of the works: slow, tanky, a sledge that shakes the floor. */
export const VORARBEITER: EnemyDef = {
  id: 'vorarbeiter',
  name: 'Vorarbeiter',
  w: 40, h: 62, hp: 160, damage: 18, poise: 90, poiseDelay: 2, stagger: 1.2, parryStagger: 1.8,
  patrolSpeed: 30, chaseSpeed: 70, sight: 300, lose: 460, cooldown: [1, 1.6], reward: 110, callsHelp: true,
  attacks: [
    atk({
      id: 'vorschlag', kind: 'slash', windup: 0.8, active: 0.16, recovery: 0.8,
      damage: 1, poise: 0, knockback: 280, cost: 0,
      box: { x: -10, y: 0, w: 70, h: 70 }, parryable: true, range: [0, 90],
    }),
    atk({
      id: 'bodenwelle', kind: 'charge', windup: 0.9, active: 0.14, recovery: 1,
      damage: 0.9, poise: 0, knockback: 240, cost: 0, around: true,
      box: { x: 0, y: -2, w: 240, h: 22 }, parryable: false, range: [0, 140],
    }),
  ],
};

/** Shows up when the Heat runs high, and follows from room to room. */
export const RIOT_KOMMANDEUR: EnemyDef = {
  id: 'riot-kommandeur',
  name: 'Riot-Kommandeur',
  w: 34, h: 64, hp: 300, damage: 19, poise: 90, poiseDelay: 2, stagger: 1.2, parryStagger: 1.8,
  patrolSpeed: 60, chaseSpeed: 150, sight: 900, lose: 9999, cooldown: [0.5, 1], reward: 400,
  attacks: [
    atk({
      id: 'riotschlag', kind: 'slash', windup: 0.5, active: 0.14, recovery: 0.35,
      damage: 1, poise: 0, knockback: 240, cost: 0, lunge: 160,
      box: { x: -8, y: 0, w: 64, h: 64 }, parryable: true, range: [0, 90], next: 'riotschlag2',
    }),
    atk({
      id: 'riotschlag2', kind: 'slash', windup: 0.45, active: 0.14, recovery: 0.7,
      damage: 1.1, poise: 0, knockback: 260, cost: 0, lunge: 160,
      box: { x: -8, y: 0, w: 64, h: 64 }, parryable: true,
    }),
    atk({
      id: 'traenengas', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.7,
      damage: 0.7, poise: 0, knockback: 120, cost: 0, effect: 'burn',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [160, 600],
      projectile: { speed: 360, arc: 380, gravity: 1000, w: 16, h: 16, life: 3, solid: true },
    }),
  ],
};

/** Lab assistant: quick scalpels, cowardly; parry and it is open. */
export const ASSISTENT: EnemyDef = {
  id: 'assistent',
  name: 'Assistent',
  w: 26, h: 56, hp: 110, damage: 15, poise: 35, poiseDelay: 1.2, stagger: 1, parryStagger: 1.8,
  patrolSpeed: 50, chaseSpeed: 140, sight: 340, lose: 500, cooldown: [0.5, 1], reward: 90,
  attacks: [
    atk({
      id: 'skalpell', kind: 'thrust', windup: 0.42, active: 0.1, recovery: 0.3,
      damage: 1, poise: 0, knockback: 160, cost: 0, lunge: 260,
      box: { x: -4, y: 24, w: 46, h: 14 }, parryable: true, range: [0, 110], next: 'skalpell2',
    }),
    atk({
      id: 'skalpell2', kind: 'slash', windup: 0.38, active: 0.1, recovery: 0.6,
      damage: 1, poise: 0, knockback: 160, cost: 0,
      box: { x: -6, y: 10, w: 48, h: 40 }, parryable: true,
    }),
  ],
};

/**
 * Level 4 boss: Asches Sezier-Golem. Sent to capture Korro. Scalpel arms you can parry, a grab
 * you must roll, a dissection beam at range; phase 2 adds the spinning saws.
 */
export const SEZIER_GOLEM: EnemyDef = {
  id: 'sezier-golem',
  name: 'Asches Sezier-Golem',
  w: 80, h: 100, hp: 1500, damage: 22, poise: 170, poiseDelay: 2.5, stagger: 1.5, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 95, sight: 480, lose: 9999, cooldown: [0.5, 1], reward: 2400,
  boss: true, weakSpot: 1.3, phase2: { below: 0.5, telegraphMul: 0.85, speedMul: 1.2 },
  attacks: [
    atk({
      id: 'skalpellarm', kind: 'slash', windup: 0.6, active: 0.14, recovery: 0.35,
      damage: 1, poise: 0, knockback: 260, cost: 0, lunge: 120,
      box: { x: -10, y: 10, w: 90, h: 80 }, parryable: true, range: [0, 120], next: 'skalpellarm2',
    }),
    atk({
      id: 'skalpellarm2', kind: 'slash', windup: 0.5, active: 0.14, recovery: 0.8,
      damage: 1, poise: 0, knockback: 260, cost: 0, lunge: 120,
      box: { x: -10, y: 10, w: 90, h: 80 }, parryable: true,
    }),
    atk({
      id: 'greifer', kind: 'thrust', windup: 0.8, active: 0.35, recovery: 1.1,
      damage: 1.4, poise: 0, knockback: 340, cost: 0, lunge: 420,
      box: { x: -6, y: 0, w: 70, h: 100 }, parryable: false, range: [100, 330],
    }),
    atk({
      id: 'sezierstrahl', kind: 'thrust', windup: 0.75, active: 0.1, recovery: 0.8,
      damage: 0.6, poise: 0, knockback: 140, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [240, 700],
      projectile: { speed: 560, arc: 0, gravity: 0, w: 14, h: 8, life: 2, solid: true, count: 3, spread: 0.12 },
    }),
    atk({
      id: 'saegen', kind: 'charge', windup: 0.9, active: 0.6, recovery: 1.4,
      damage: 1.2, poise: 0, knockback: 300, cost: 0, around: true,
      box: { x: 0, y: 0, w: 220, h: 110 }, parryable: false, range: [0, 150], phase: 2,
    }),
  ],
};

/** Level 5 mid-boss: Asche's second exhibit. Shadow grip from afar, shadow veins around it. */
export const EXPONAT: EnemyDef = {
  id: 'exponat',
  name: 'Asches zweites Exponat',
  w: 50, h: 76, hp: 1200, damage: 20, poise: 160, poiseDelay: 2, stagger: 1.4, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 85, sight: 460, lose: 9999, cooldown: [0.5, 1.1], reward: 1600,
  boss: true, phase2: { below: 0.5, telegraphMul: 0.85, speedMul: 1.15 },
  attacks: [
    atk({
      id: 'schattengriff', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.7,
      damage: 1, poise: 0, knockback: 120, cost: 0, effect: 'tar',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [150, 600],
      projectile: { speed: 460, arc: 0, gravity: 0, w: 18, h: 18, life: 2, solid: true },
    }),
    atk({
      id: 'schattenader', kind: 'charge', windup: 0.85, active: 0.4, recovery: 1,
      damage: 1.1, poise: 0, knockback: 280, cost: 0, around: true,
      box: { x: 0, y: -2, w: 320, h: 30 }, parryable: false, range: [0, 200],
    }),
    atk({
      id: 'krallen', kind: 'slash', windup: 0.55, active: 0.14, recovery: 0.6,
      damage: 1, poise: 0, knockback: 240, cost: 0, lunge: 200,
      box: { x: -8, y: 0, w: 70, h: 76 }, parryable: true, range: [0, 120], minPhase: 1,
    }),
  ],
};

/**
 * Level 5 boss: Schwarzkittel, the grid's emergency construct. Runs on its rails: dashes, arcs of
 * current, and below a third its defensive stance (a shield up front – go round it).
 */
export const SCHWARZKITTEL: EnemyDef = {
  id: 'schwarzkittel',
  name: 'Schwarzkittel',
  w: 70, h: 96, hp: 2100, damage: 24, poise: 190, poiseDelay: 2.5, stagger: 1.5, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 110, sight: 520, lose: 9999, cooldown: [0.45, 0.95], reward: 3000,
  boss: true, weakSpot: 1.4, phase2: { below: 0.6, telegraphMul: 0.85, speedMul: 1.15 }, phases: [{ below: 0.3, telegraphMul: 0.8, speedMul: 1.25 }],
  attacks: [
    atk({
      id: 'schienensprint', kind: 'thrust', windup: 0.65, active: 0.45, recovery: 0.9,
      damage: 1.2, poise: 0, knockback: 320, cost: 0, lunge: 620,
      box: { x: -6, y: 0, w: 70, h: 90 }, parryable: false, range: [140, 600],
    }),
    atk({
      id: 'kabelpeitsche', kind: 'slash', windup: 0.55, active: 0.16, recovery: 0.35,
      damage: 1, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 120, h: 70 }, parryable: true, range: [0, 140], next: 'kabelpeitsche2',
    }),
    atk({
      id: 'kabelpeitsche2', kind: 'slash', windup: 0.5, active: 0.16, recovery: 0.8,
      damage: 1, poise: 0, knockback: 260, cost: 0,
      box: { x: -10, y: 0, w: 120, h: 70 }, parryable: true,
    }),
    atk({
      id: 'stromfeld', kind: 'charge', windup: 0.9, active: 0.5, recovery: 1.1,
      damage: 1, poise: 0, knockback: 260, cost: 0, around: true, effect: 'burn',
      box: { x: 0, y: 0, w: 260, h: 140 }, parryable: false, range: [0, 160], minPhase: 2,
    }),
    atk({
      id: 'funkenregen', kind: 'thrust', windup: 0.8, active: 0.1, recovery: 0.8,
      damage: 0.7, poise: 0, knockback: 160, cost: 0, effect: 'burn',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [200, 700], minPhase: 2,
      projectile: { speed: 420, arc: 520, gravity: 1000, w: 14, h: 14, life: 3, solid: true, count: 4, spread: 0.45 },
    }),
  ],
};

/**
 * The final boss: Doktor Asche. Four phases (UEBERGABE §4): Diagnose (glut beam from above),
 * Eskalation (scalpel and assistants' fury), Kollaps (the ceiling comes down), Auflösung (the last
 * glut wave – or the crystal, if the purification path was taken). Clinical, not a monster.
 */
export const DOKTOR_ASCHE: EnemyDef = {
  id: 'doktor-asche',
  name: 'Doktor Asche',
  w: 30, h: 62, hp: 2800, damage: 22, poise: 170, poiseDelay: 2, stagger: 1.4, parryStagger: 2,
  patrolSpeed: 0, chaseSpeed: 120, sight: 600, lose: 9999, cooldown: [0.45, 0.95], reward: 0,
  boss: true, endsWith: 'kristall',
  phases: [
    { below: 0.75, telegraphMul: 0.95, speedMul: 1.1 },
    { below: 0.5, telegraphMul: 0.9, speedMul: 1.15 },
    { below: 0.25, telegraphMul: 0.85, speedMul: 1.2 },
  ],
  attacks: [
    atk({
      id: 'glutstrahl', kind: 'thrust', windup: 0.7, active: 0.1, recovery: 0.6,
      damage: 0.7, poise: 0, knockback: 150, cost: 0, effect: 'burn',
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: true, range: [120, 700],
      projectile: { speed: 600, arc: 0, gravity: 0, w: 16, h: 10, life: 2, solid: true, count: 2, spread: 0.1 },
    }),
    atk({
      id: 'diagnose', kind: 'slash', windup: 0.55, active: 0.12, recovery: 0.4,
      damage: 1, poise: 0, knockback: 220, cost: 0, lunge: 180,
      box: { x: -8, y: 6, w: 60, h: 54 }, parryable: true, range: [0, 110], next: 'befund',
    }),
    atk({
      id: 'befund', kind: 'thrust', windup: 0.45, active: 0.12, recovery: 0.7,
      damage: 1.1, poise: 0, knockback: 260, cost: 0, lunge: 300,
      box: { x: -4, y: 22, w: 66, h: 16 }, parryable: true,
    }),
    atk({
      id: 'eskalation', kind: 'thrust', windup: 0.6, active: 0.4, recovery: 0.9,
      damage: 1.3, poise: 0, knockback: 320, cost: 0, lunge: 560,
      box: { x: -6, y: 0, w: 50, h: 60 }, parryable: false, range: [160, 520], minPhase: 2,
    }),
    atk({
      id: 'kollaps', kind: 'thrust', windup: 0.9, active: 0.1, recovery: 0.9,
      damage: 0.8, poise: 0, knockback: 180, cost: 0,
      box: { x: 0, y: 0, w: 1, h: 1 }, parryable: false, range: [0, 800], minPhase: 3,
      projectile: { speed: 320, arc: 640, gravity: 1100, w: 22, h: 22, life: 3, solid: true, count: 5, spread: 0.9 },
    }),
    atk({
      id: 'glutwelle', kind: 'charge', windup: 1, active: 0.5, recovery: 1.6,
      damage: 1.4, poise: 0, knockback: 340, cost: 0, around: true, effect: 'burn',
      box: { x: 0, y: -2, w: 520, h: 40 }, parryable: false, range: [0, 400], phase: 4,
    }),
  ],
};

export const ENEMIES: EnemyDef[] = [
  ROST_SPINNER,
  RATTE,
  SCHROTT_DROHNE,
  SCHILDTRAEGER,
  ROHR_KRIECHER,
  NEBELWERK_WACHE,
  TEERBINDER,
  SCHROTT_GOLEM,
  VERWERTER_KONSTRUKT,
  RUSS_KRIECHER,
  GLUT_WILD,
  SENSOR_DROHNE,
  KOMMANDANTIN_RISS,
  SCHLUND_WAECHTER,
  OEL_LEVIATHAN,
  GARDE,
  VORARBEITER,
  RIOT_KOMMANDEUR,
  ASSISTENT,
  SEZIER_GOLEM,
  EXPONAT,
  SCHWARZKITTEL,
  DOKTOR_ASCHE,
];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

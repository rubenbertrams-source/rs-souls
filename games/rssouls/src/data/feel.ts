import type { FeelDef, HeroDef } from '../core/types';

/**
 * How the hero moves and how hits land – the "feels good" values of UEBERGABE §6.4 and §11.
 *
 * Start values from the prototype, not balanced. Jump: v² / 2g = 570² / 3000 ≈ 108 px, the
 * height the level geometry is built around.
 */
export const FEEL: FeelDef = {
  runSpeed: 175,
  groundAccel: 1800,
  airAccel: 1100,
  gravity: 1500,
  fallGravity: 1.2,
  maxFall: 900,
  jumpSpeed: 570,
  jumpCut: 0.45,
  coyote: 0.1,
  jumpBuffer: 0.12,
  attackBuffer: 0.12,
  hurtLock: 0.15,
  roll: { time: 0.42, speed: 310, iStart: 0.03, iEnd: 0.34, cost: 22 },
  rollCancel: 0.5,
  guardBreak: 0.6,
  blockCostPerDamage: 1.5,
  riposte: { window: 1.2, mul: 2.5 },
  hitstop: { light: 0.04, heavy: 0.07, parry: 0.1 },
};

/** The nameless survivor. Atem (stamina) refills in about 2 s outside the smog, 4 s inside. */
export const SURVIVOR: HeroDef = {
  w: 24,
  h: 54,
  hp: 100,
  stamina: 100,
  staminaRegen: 55,
  staminaDelay: 0.45,
};

import type { AttackDef, Rect, Who } from './types';
import type { Body } from './body';

/** Where an attack is in its life: wind-up → active → recovery → done. */
export type AttackPhase = 'windup' | 'active' | 'recovery' | 'done';

/** One attack being performed. */
export interface AttackRun {
  def: AttackDef;
  /** Seconds since the attack started. */
  t: number;
  /** Multiplier on the wind-up (an enemy's phase 2 shortens the telegraph). */
  windupMul: number;
  /** Targets already struck by this swing (enemies, the hero, walls by id): each once per attack. */
  struck: (Who | string)[];
  /** Time the active window ended early (a leap that landed), or -1. */
  cutAt: number;
}

export function startAttack(def: AttackDef, windupMul = 1): AttackRun {
  return { def, t: 0, windupMul, struck: [], cutAt: -1 };
}

export function windupOf(run: AttackRun): number {
  return run.def.windup * run.windupMul;
}

/** When the recovery starts (or started). */
export function recoveryStart(run: AttackRun): number {
  return run.cutAt >= 0 ? run.cutAt : windupOf(run) + run.def.active;
}

/** Seconds spent in recovery so far (0 before it starts). */
export function recoveryElapsed(run: AttackRun): number {
  return Math.max(0, run.t - recoveryStart(run));
}

export function phaseOf(run: AttackRun): AttackPhase {
  if (run.t < windupOf(run)) return 'windup';
  if (run.t < recoveryStart(run)) return 'active';
  return recoveryElapsed(run) < run.def.recovery ? 'recovery' : 'done';
}

/** Ends the active window now (a leap attack touching down). */
export function cutActive(run: AttackRun) {
  if (phaseOf(run) === 'active') run.cutAt = run.t;
}

/** The attack's hitbox in the world, mirrored with the facing. */
export function hitbox(body: Body, facing: number, def: AttackDef): Rect {
  if (def.around) return { x: body.x - def.box.w / 2 + def.box.x, y: body.y + def.box.y, w: def.box.w, h: def.box.h };
  const front = body.x + (facing * body.w) / 2;
  const near = front + facing * def.box.x;
  const far = near + facing * def.box.w;
  return { x: Math.min(near, far), y: body.y + def.box.y, w: def.box.w, h: def.box.h };
}

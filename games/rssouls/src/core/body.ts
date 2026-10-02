import type { Rect, Solid } from './types';

/**
 * A moving box against the room's rectangles – the whole physics of the game.
 *
 * Kinematic on purpose: no solver, no rotation, the axes resolved one after the other. A
 * soulslike hero has to stop where the stick says, not where momentum would carry a rigid body,
 * and a box that never sinks into the ground is what makes coyote time and landings exact.
 */
export interface Body {
  /** Middle of the feet. */
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  /** The ground piece it stands on is one-way (it can be dropped through). */
  onOneWay: boolean;
  /** Touching a wall on that side this tick. */
  wallL: boolean;
  wallR: boolean;
  /** Seconds left in which one-way pieces are ignored (dropping through). */
  dropT: number;
  /** Position at the start of the last step, for render interpolation. */
  px: number;
  py: number;
}

export function newBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, onOneWay: false, wallL: false, wallR: false, dropT: 0, px: x, py: y };
}

export function bodyRect(b: Body): Rect {
  return { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Moves the body by its velocity and resolves it against the solids, x first, then y. */
export function moveBody(b: Body, solids: readonly Solid[], dt: number) {
  b.px = b.x;
  b.py = b.y;
  b.dropT = Math.max(0, b.dropT - dt);
  b.wallL = b.wallR = false;

  b.x += b.vx * dt;
  for (const s of solids) {
    if (s.oneWay) continue;
    const l = b.x - b.w / 2;
    if (!overlaps({ x: l, y: b.y, w: b.w, h: b.h }, s)) continue;
    if (b.x < s.x + s.w / 2) {
      b.x = s.x - b.w / 2;
      b.wallR = true;
    } else {
      b.x = s.x + s.w + b.w / 2;
      b.wallL = true;
    }
    b.vx = 0;
  }

  const prevY = b.y;
  b.y += b.vy * dt;
  b.onGround = false;
  b.onOneWay = false;
  for (const s of solids) {
    const r = { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
    if (!overlaps(r, s)) continue;
    const top = s.y + s.h;
    if (s.oneWay) {
      // carries only a body coming down onto it from above
      if (b.dropT > 0 || b.vy > 0 || prevY < top - 0.01) continue;
      b.y = top;
      b.vy = 0;
      b.onGround = true;
      b.onOneWay = true;
      continue;
    }
    if (b.vy <= 0 && prevY >= top - 0.01) {
      b.y = top;
      b.vy = 0;
      b.onGround = true;
    } else if (b.vy > 0) {
      b.y = s.y - b.h;
      b.vy = 0;
    } else {
      // started inside (e.g. spawned overlapping): push out upwards
      b.y = top;
      b.vy = 0;
      b.onGround = true;
    }
  }
  // standing still on the ground: probe one pixel down so `onGround` holds without falling
  if (!b.onGround && b.vy === 0) {
    const probe = { x: b.x - b.w / 2, y: b.y - 1, w: b.w, h: 1 };
    for (const s of solids) {
      if (s.oneWay && b.dropT > 0) continue;
      if (overlaps(probe, s) && Math.abs(s.y + s.h - b.y) < 0.01) {
        b.onGround = true;
        b.onOneWay = !!s.oneWay;
      }
    }
  }
}

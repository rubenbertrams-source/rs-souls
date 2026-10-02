import * as THREE from 'three';
import { MeshBuilder, sphere, torus, type Vec3 } from './builder';

/**
 * Shared vocabulary for the procedural heads. Every head is built from these plus the raw
 * primitives in `builder.ts`; the head modules add nothing to the toolbox, they only arrange it.
 *
 * Two rules earn their place here, because breaking either is what makes a head look wrong:
 *
 * 1. **Anything that reads as line art is `unlit`.** Pupils, mouths, slits, teeth, gills. The toon
 *    ramp has only three steps, so a lit dark shape collapses to the bottom step and smears.
 * 2. **Nothing floats in front of a curved surface.** A detail either hugs the surface (`plate`,
 *    `patch`, or a sphere squashed with `scale: [1, 1, 0.35–0.5]`) or it sits clearly in front of
 *    it — never halfway through. See the overlap rule on `clears()` below.
 */

/** Base skin tone of the faces. */
export const SKIN = '#ffe0bd';
/** Slightly darker skin for noses. */
export const SKIN_DARK = '#f2b592';
/** Outline / pupil colour of the unlit face parts. */
export const INK = '#1a1a2a';
/** Neutral dark for boots, bolts and sockets. */
export const DARK = '#2a2a3a';

/**
 * Does an outer part clear an inner one along +Z, with room for the outline?
 *
 * `MeshBuilder.build` wraps the whole merged head in an inverted hull 3 % larger, so two parts that
 * merely touch already read as one poking through the other. This is the check the viking's nose
 * guard failed: guard at z 0.245–0.275 over a nose reaching z 0.29 – steel through flesh.
 *
 * Use it when a hard part lies over a soft one (helmet over nose, glasses over face, visor over
 * skull): `clears(zOuter, depthOuter, zInner, rInner)` must hold.
 */
export function clears(zOuter: number, depthOuter: number, zInner: number, rInner: number, air = 0.01): boolean {
  return zOuter - depthOuter / 2 >= zInner + rInner + air;
}

/**
 * One cartoon eye: a white disc flattened onto the surface plus a pupil, both unlit so they stay
 * crisp under any light. `yaw` turns the eye around Y (0 = looking along +Z, ±π/2 = sideways),
 * so eyes can sit on the side of a snout without poking out like ping-pong balls.
 */
export function eye(b: MeshBuilder, pos: Vec3, yaw = 0, r = 0.065) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  b.add(sphere(r, 8, 6), '#ffffff', { pos, rot: [0, yaw, 0], scale: [1, 1, 0.5], unlit: true });
  const k = r * 0.32;
  b.add(sphere(r * 0.5, 6, 5), INK, { pos: [pos[0] + dx * k, pos[1], pos[2] + dz * k], rot: [0, yaw, 0], scale: [1, 1, 0.5], unlit: true });
}

export function eyes(b: MeshBuilder, y: number, z: number, spread = 0.1, r = 0.065) {
  eye(b, [-spread, y, z], 0, r);
  eye(b, [spread, y, z], 0, r);
}

/** Smile: a half torus whose lower part is tilted back so it hugs a round face. */
export function smile(b: MeshBuilder, y: number, z: number, r = 0.08, tube = 0.018) {
  b.add(torus(r, tube, 4, 10, Math.PI), INK, { pos: [0, y, z], rot: [0.45, 0, Math.PI], unlit: true });
}

/** Two flattened, tilted blobs either side of the nose – the basic moustache. */
export function moustache(b: MeshBuilder, color: THREE.ColorRepresentation, y: number, z: number, w = 1.6, tilt = 0.3, x = 0.08, r = 0.058) {
  for (const s of [-1, 1]) b.add(sphere(r, 8, 6), color, { pos: [s * x, y, z], rot: [0, 0, -s * tilt], scale: [w, 0.55, 0.6] });
}

/** Curved plate hugging a round head/helmet: an open cylinder segment facing +Z. */
export function plate(r: number, h: number, span: number, seg = 10) {
  return new THREE.CylinderGeometry(r, r, h, seg, 1, true, -span / 2, span);
}

/** Curved patch of a sphere facing +Z (visors): `span` is the horizontal half angle, theta the vertical range. */
export function patch(r: number, span: number, thetaStart: number, thetaLength: number) {
  return new THREE.SphereGeometry(r, 10, 8, Math.PI / 2 - span, span * 2, thetaStart, thetaLength);
}

/**
 * A head is a function that fills a builder. Registering it in `CLASSIC_HEADS` or `EXTRA_HEADS`
 * plus an entry in `data/heads.ts` is all it takes to appear in every lobby.
 */
export type HeadBuilder = (b: MeshBuilder, skin: THREE.ColorRepresentation) => void;

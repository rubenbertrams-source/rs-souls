import * as THREE from 'three';
import { box, capsule, cone, cyl, dome, octa, sphere, torus, type Vec3 } from './builder';
import { DARK, INK, SKIN_DARK, eye, eyes, moustache, patch, plate, smile, type HeadBuilder } from './head-parts';

/**
 * The heads that shipped first. See `head-parts.ts` for the rules they follow and
 * `tools/dev/shot-heads.mjs` for the contact sheet that proves they hold from all four sides.
 *
 * Three habits keep the backs of these heads from being bald and their fronts from growing
 * through each other:
 *
 * - Hair and beards are **closed rings of overlapping spheres** around the skull (`ring()`), not a
 *   blob glued to one cheek. A ring closes at the back, so the 180° view – the one the follow
 *   camera shows for the whole race – gets a silhouette of its own.
 * - Anything flat on a round skull is a `patch()` (sphere segment) or a `plate()` (cylinder
 *   segment); a band that would show its cut ends from the side is closed all the way round.
 * - A detail that sits on a curve is placed on the surface normal (`tangent()`), pushed a little
 *   *into* the body. A box that only touches the surface reads as floating, because the outline
 *   hull is 3 % larger than the mesh it wraps.
 */

/** Ring of overlapping spheres around the head axis: `[azimuth (0 = front), y, radius, size]`. */
type Tuft = [number, number, number, number];
function ring(b: Parameters<HeadBuilder>[0], color: THREE.ColorRepresentation, tufts: Tuft[]) {
  for (const [a, y, R, r] of tufts) {
    const sides = Math.abs(Math.sin(a)) > 1e-3 ? [1, -1] : [1];
    for (const s of sides) b.add(sphere(r, 8, 6), color, { pos: [s * R * Math.sin(a), y, R * Math.cos(a)] });
  }
}

/**
 * Downward shadow gradient for a vertex colour: the form of a beard, a hat or a mane comes out of
 * the colour, because the three-step toon ramp gives a smooth white cloud no shading at all.
 */
function shade(top: number, drop: number, span = 0.3) {
  return (p: THREE.Vector3, c: THREE.Color) => c.multiplyScalar(1 - drop * Math.min(1, Math.max(0, (top - p.y) / span)));
}

/**
 * Point and yaw for a detail lying on an ellipse in the XZ plane, sunk `sink` into the surface.
 * `t` runs from the front (0) round to the back (π); `cz` is the ellipse centre on Z.
 */
function tangent(t: number, ax: number, az: number, cz: number, sink: number): { pos: [number, number]; yaw: number } {
  const x = ax * Math.sin(t), z = cz + az * Math.cos(t);
  const nx = x / (ax * ax), nz = (z - cz) / (az * az), n = Math.hypot(nx, nz);
  return { pos: [x - (nx / n) * sink, z - (nz / n) * sink], yaw: Math.atan2(nx, nz) };
}

export const CLASSIC_HEADS: Record<string, HeadBuilder> = {
  pferd: (b) => {
    const coat = '#9c6b3c', muzzle = '#c99a63', mane = '#3a2a20';
    b.add(sphere(0.24, 10, 8), coat, { pos: [0, 0.385, -0.045], scale: [0.9, 1, 1.05] });
    // long muzzle sloping down and forward; the rounded nose pad on its tip is what makes the
    // snout read from straight ahead instead of collapsing into a flat brown patch
    b.add(sphere(0.145, 10, 8), muzzle, { pos: [0, 0.27, 0.205], scale: [0.92, 0.82, 1.8], rot: [0.22, 0, 0] });
    b.add(sphere(0.115, 9, 7), muzzle, { pos: [0, 0.21, 0.415], scale: [1.15, 0.92, 0.8] });
    for (const s of [-1, 1]) b.add(sphere(0.033, 6, 5), INK, { pos: [s * 0.055, 0.228, 0.487], scale: [1, 1.3, 0.5], unlit: true });
    b.add(torus(0.06, 0.015, 4, 8, Math.PI), INK, { pos: [0, 0.152, 0.462], rot: [0.5, 0, Math.PI], unlit: true });
    // eyes on the sides of the head, turned along the surface normal and sunk into it, so no white
    // disc breaks the silhouette from the side
    for (const s of [-1, 1]) eye(b, [s * 0.14, 0.425, 0.1115], s * 0.897, 0.07);
    // ears, forelock, and a mane that runs down the neck in tufts instead of one smooth pillar
    for (const s of [-1, 1]) b.add(cone(0.078, 0.22, 6), coat, { pos: [s * 0.12, 0.665, -0.065], rot: [0, 0, -s * 0.2] });
    b.add(sphere(0.09, 8, 6), mane, { pos: [0, 0.585, 0.1], scale: [1.3, 0.9, 1] });
    b.add(sphere(0.11, 8, 6), mane, { pos: [0, 0.625, -0.065], scale: [0.85, 1, 1.1] });
    for (const [y, z, r] of [[0.59, -0.175, 0.105], [0.485, -0.265, 0.105], [0.365, -0.305, 0.1], [0.245, -0.295, 0.095]] as Vec3[]) {
      b.add(sphere(r, 8, 6), mane, { pos: [0, y, z], scale: [0.85, 1, 1.05] });
      for (const s of [-1, 1]) b.add(sphere(r * 0.72, 6, 5), mane, { pos: [s * 0.07, y - 0.045, z + 0.015] });
    }
  },
  flaschengeist: (b, skin) => {
    const blue = '#2f6fd6', beard = '#23233a';
    b.add(sphere(0.26, 10, 8), skin, { pos: [0, 0.29, 0] });
    // turban with top knot, a red jewel in a gold ring, and a cloth tail down the back
    b.add(sphere(0.315, 10, 8), blue, { pos: [0, 0.5, 0], scale: [1, 0.72, 1] });
    b.add(sphere(0.105, 8, 6), blue, { pos: [0, 0.735, 0] });
    b.add(torus(0.062, 0.013, 4, 8), '#ffd23a', { pos: [0, 0.5, 0.305], unlit: true });
    b.add(octa(0.058), '#ff3366', { pos: [0, 0.5, 0.315], unlit: true });
    for (const [y, z, r] of [[0.36, -0.27, 0.09], [0.29, -0.265, 0.075]] as Vec3[])
      b.add(sphere(r, 8, 6), blue, { pos: [0, y, z], scale: [1.6, 1, 0.6] });
    b.add(sphere(0.062, 8, 6), SKIN_DARK, { pos: [0, 0.285, 0.255] });
    eyes(b, 0.325, 0.232, 0.105, 0.068);
    // wide grin: bands wrapped on the skull, so no white bar hovers in front of the mouth
    b.add(patch(0.263, 0.44, 1.86, 0.16), INK, { pos: [0, 0.29, 0], unlit: true });
    b.add(patch(0.269, 0.36, 1.9, 0.05), '#ffffff', { pos: [0, 0.29, 0], unlit: true });
    // black beard: a closed ring along the jaw, a full chin and a curl below it
    moustache(b, beard, 0.245, 0.25, 1.6, 0.25, 0.078, 0.058);
    const curls = shade(0.24, 0.3);
    b.add(sphere(0.14, 9, 7), beard, { pos: [0, 0.07, 0.105], scale: [1.15, 1, 0.9], colorFn: curls });
    b.add(sphere(0.085, 8, 6), beard, { pos: [0, -0.005, 0.1], colorFn: curls });
    b.add(sphere(0.06, 8, 6), beard, { pos: [0, -0.05, 0.095], colorFn: curls });
    ring(b, beard, [
      [0.65, 0.15, 0.225, 0.1],
      [1.15, 0.2, 0.23, 0.095],
      [1.65, 0.25, 0.235, 0.09],
      [2.15, 0.27, 0.235, 0.09],
      [2.65, 0.25, 0.23, 0.09],
      [Math.PI, 0.22, 0.225, 0.095],
    ]);
  },
  pirat: (b, skin) => {
    const hat = '#23232f', red = '#e0433a', gold = '#ffd23a', hair = '#2a2018';
    b.add(sphere(0.265, 10, 8), skin, { pos: [0, 0.29, 0] });
    // bandana band with a knot and a tail falling down the back of the head
    b.add(cyl(0.272, 0.277, 0.095, 12), red, { pos: [0, 0.405, 0] });
    b.add(sphere(0.08, 8, 6), red, { pos: [0.18, 0.395, -0.2] });
    b.add(sphere(0.06, 8, 6), red, { pos: [0.215, 0.325, -0.2] });
    b.add(sphere(0.045, 6, 5), red, { pos: [0.235, 0.265, -0.19] });
    ring(b, hair, [[2.15, 0.29, 0.25, 0.075], [2.55, 0.26, 0.25, 0.08], [2.9, 0.21, 0.245, 0.075], [Math.PI, 0.23, 0.245, 0.08]]);
    // tricorn: flat round brim, low crown, three upturned flaps – rounded, so no corner floats
    // free beside the head the way the old boxed brim did
    b.add(cyl(0.37, 0.37, 0.038, 14), hat, { pos: [0, 0.475, 0] });
    b.add(sphere(0.26, 10, 8), hat, { pos: [0, 0.515, 0], scale: [1, 0.62, 1] });
    for (const a of [0, 2.27, -2.27])
      b.add(sphere(0.145, 9, 7), hat, { pos: [0.3 * Math.sin(a), 0.525, 0.3 * Math.cos(a)], rot: [0, a, 0], scale: [1.35, 0.85, 0.3] });
    b.add(sphere(0.048, 8, 6), '#ffffff', { pos: [0, 0.555, 0.335], scale: [1, 1, 0.5], unlit: true });
    // eye patch and strap flush on the skull
    b.add(patch(0.27, 0.4, 1.24, 0.52), INK, { pos: [0, 0.29, 0], rot: [0, 0.42, 0], unlit: true });
    b.add(torus(0.272, 0.013, 4, 18), INK, { pos: [0, 0.29, 0], rot: [Math.PI / 2 - 0.24, 0, 0], unlit: true });
    eye(b, [-0.105, 0.35, 0.234], 0, 0.068);
    smile(b, 0.175, 0.225, 0.075);
    b.add(sphere(0.027, 6, 5), gold, { pos: [0.042, 0.158, 0.222], scale: [1, 1, 0.6], unlit: true });
    // earring: the top of the ring is buried in the head, so it hangs instead of floating beside it
    b.add(torus(0.048, 0.011, 4, 10), gold, { pos: [0.238, 0.195, 0], rot: [0, Math.PI / 2, 0], unlit: true });
  },
  roboter: (b) => {
    b.add(box(0.46, 0.44, 0.44), '#b0b8c8', { pos: [0, 0.3, 0] });
    b.add(box(0.4, 0.36, 0.02), '#c9d1dc', { pos: [0, 0.3, 0.22] });
    // glowing visor with two pupils, a speaker grille, antenna and ear bolts
    b.add(box(0.35, 0.11, 0.03), '#2ad4d4', { pos: [0, 0.355, 0.237], unlit: true });
    for (const s of [-1, 1]) b.add(sphere(0.033, 6, 5), INK, { pos: [s * 0.088, 0.355, 0.258], scale: [1, 1, 0.4], unlit: true });
    for (const x of [-0.07, 0, 0.07]) b.add(box(0.038, 0.055, 0.02), INK, { pos: [x, 0.185, 0.24], unlit: true });
    b.add(cyl(0.02, 0.02, 0.17, 5), DARK, { pos: [0, 0.6, 0] });
    b.add(sphere(0.052, 6, 5), '#ff3366', { pos: [0, 0.71, 0], unlit: true });
    for (const s of [-1, 1]) b.add(cyl(0.075, 0.075, 0.07, 6), DARK, { pos: [s * 0.25, 0.32, 0], rot: [0, 0, Math.PI / 2] });
    // maintenance hatch on the back: a raised plate, four bolts and two vent slots
    b.add(box(0.3, 0.28, 0.02), '#c9d1dc', { pos: [0, 0.3, -0.225] });
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.add(box(0.032, 0.032, 0.02), INK, { pos: [s * 0.12, 0.3 + t * 0.11, -0.243], unlit: true });
    for (const y of [0.255, 0.345]) b.add(box(0.15, 0.028, 0.02), INK, { pos: [0, y, -0.243], unlit: true });
  },
  kuerbis: (b) => {
    // ridged pumpkin: the vertex colour darkens between the lobes
    const ridge = (p: THREE.Vector3, c: THREE.Color) => c.multiplyScalar(0.86 + 0.14 * Math.abs(Math.cos(3 * Math.atan2(p.x, p.z))));
    b.add(sphere(0.28, 12, 9), '#ff8c1a', { pos: [0, 0.26, 0], scale: [1.1, 0.85, 1.1], colorFn: ridge });
    b.add(cyl(0.04, 0.06, 0.14, 5), '#3aa64f', { pos: [0, 0.53, 0], rot: [0, 0, 0.15] });
    // carved face: triangle eyes and nose, jagged grin
    for (const s of [-1, 1]) b.add(cone(0.06, 0.1, 3), INK, { pos: [s * 0.1, 0.32, 0.28], unlit: true });
    b.add(cone(0.035, 0.06, 3), INK, { pos: [0, 0.24, 0.3], rot: [0, 0, Math.PI], unlit: true });
    b.add(box(0.12, 0.05, 0.03), INK, { pos: [0, 0.16, 0.295], unlit: true });
    for (const s of [-1, 1]) b.add(box(0.09, 0.035, 0.03), INK, { pos: [s * 0.095, 0.175, 0.28], rot: [0, s * 0.35, s * 0.4], unlit: true });
  },
  astronaut: (b) => {
    const grey = '#8a8a96';
    b.add(sphere(0.325, 12, 9), '#ffffff', { pos: [0, 0.34, 0] });
    // gold visor in a grey frame on the front of the helmet, plus a highlight streak
    b.add(patch(0.327, 1.1, 0.78, 1.52), grey, { pos: [0, 0.34, 0] });
    b.add(patch(0.332, 0.95, 0.88, 1.32), '#f0a828', { pos: [0, 0.34, 0] });
    b.add(box(0.11, 0.032, 0.02), '#fff3d0', { pos: [-0.1, 0.47, 0.29], rot: [0, 0, 0.5], unlit: true });
    b.add(cyl(0.25, 0.295, 0.11, 12), grey, { pos: [0, 0.045, 0] });
    // round ear pods sunk into the shell, where boxes used to hover beside it
    for (const s of [-1, 1]) {
      b.add(cyl(0.088, 0.088, 0.11, 8), grey, { pos: [s * 0.295, 0.34, 0], rot: [0, 0, Math.PI / 2] });
      b.add(torus(0.058, 0.012, 4, 10), DARK, { pos: [s * 0.352, 0.34, 0], rot: [0, Math.PI / 2, 0], unlit: true });
    }
    // aerial rising out of one pod, and vents wrapped on the back so the rear is not blank white
    b.add(cyl(0.015, 0.015, 0.2, 5), grey, { pos: [0.345, 0.47, 0] });
    b.add(sphere(0.036, 6, 5), '#ff3366', { pos: [0.345, 0.595, 0], unlit: true });
    b.add(patch(0.329, 0.45, 0.95, 0.95), grey, { pos: [0, 0.34, 0], rot: [0, Math.PI, 0] });
    for (const t of [1.06, 1.24, 1.42]) b.add(patch(0.334, 0.3, t, 0.05), DARK, { pos: [0, 0.34, 0], rot: [0, Math.PI, 0], unlit: true });
  },
  wikinger: (b, skin) => {
    const steel = '#8d8d99', light = '#a8a8b6', band = '#6a6a78', beard = '#c0392b';
    b.add(sphere(0.26, 10, 8), skin, { pos: [0, 0.285, 0] });
    // nasal helm: dome, rim band, and a guard that sits ON the brow (its back face is inside the
    // skull) and STOPS above the nose – clears(0.243 back face, nose top 0.245 at y 0.195) holds
    // because the guard ends at y 0.26, a finger's width over the nose.
    b.add(dome(0.29, 10, 5), steel, { pos: [0, 0.36, 0] });
    b.add(torus(0.29, 0.024, 4, 14), band, { pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0] });
    b.add(box(0.08, 0.17, 0.05), light, { pos: [0, 0.335, 0.29] });
    b.add(box(0.1, 0.05, 0.055), band, { pos: [0, 0.262, 0.291] });
    b.add(cyl(0.032, 0.032, 0.06, 6), band, { pos: [0, 0.4, 0.295], rot: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) {
      b.add(cyl(0.075, 0.075, 0.05, 8), band, { pos: [s * 0.255, 0.45, 0], rot: [0, 0, -s * 0.75] });
      b.add(cone(0.06, 0.28, 6), '#fff2dc', { pos: [s * 0.325, 0.555, 0], rot: [0, 0, -s * 0.75] });
    }
    for (const s of [-1, 1]) eye(b, [s * 0.104, 0.3136, 0.223], s * 0.436, 0.055);
    b.add(sphere(0.05, 8, 6), SKIN_DARK, { pos: [0, 0.195, 0.235] });
    // red hair and beard as one closed ring: moustache, chin, jaw, sideburns, nape
    moustache(b, beard, 0.16, 0.25, 1.7, 0.3, 0.078, 0.06);
    const wool = shade(0.3, 0.26);
    b.add(sphere(0.14, 9, 7), beard, { pos: [0, 0.115, 0.135], scale: [1.25, 1, 0.95], colorFn: wool });
    b.add(sphere(0.085, 8, 6), beard, { pos: [0, 0.045, 0.125], colorFn: wool });
    ring(b, beard, [
      [0.55, 0.155, 0.23, 0.115],
      [1.05, 0.215, 0.24, 0.11],
      [1.55, 0.275, 0.245, 0.105],
      [2.05, 0.3, 0.245, 0.105],
      [2.55, 0.29, 0.24, 0.105],
      [1.6, 0.13, 0.22, 0.095],
      [2.15, 0.125, 0.215, 0.095],
      [2.6, 0.15, 0.225, 0.095],
      [Math.PI, 0.21, 0.24, 0.11],
      [Math.PI, 0.12, 0.21, 0.1],
    ]);
    // two braids with gold beads hanging off the chin
    for (const s of [-1, 1]) {
      b.add(sphere(0.06, 8, 6), beard, { pos: [s * 0.135, 0.05, 0.165] });
      b.add(sphere(0.048, 6, 5), beard, { pos: [s * 0.133, 0, 0.16] });
      b.add(cyl(0.044, 0.044, 0.03, 6), '#ffd23a', { pos: [s * 0.131, -0.032, 0.157], unlit: true });
    }
  },
  ritter: (b) => {
    const steel = '#8d8d99', light = '#a8a8b6', band = '#6a6a78', plume = '#e0433a';
    // great helm: tapered barrel + dome. All its shape has to come from edges – the toon ramp
    // gives a smooth grey bucket no shading at all – so it gets a base rim, a vertical rib, a brow
    // ridge and a vision band, each of them closed right round so no cut end shows from the side.
    b.add(cyl(0.265, 0.28, 0.5, 12), steel, { pos: [0, 0.29, 0] });
    b.add(dome(0.265, 12, 5), steel, { pos: [0, 0.54, 0] });
    b.add(torus(0.286, 0.02, 4, 14), band, { pos: [0, 0.09, 0], rot: [Math.PI / 2, 0, 0] });
    b.add(plate(0.284, 0.28, 0.42, 6), band, { pos: [0, 0.245, 0] });
    b.add(plate(0.278, 0.05, Math.PI * 2, 14), light, { pos: [0, 0.45, 0] });
    b.add(plate(0.276, 0.055, Math.PI * 2, 14), INK, { pos: [0, 0.392, 0], unlit: true });
    for (const a of [0, 0.75, -0.75, 1.5, -1.5, 2.25, -2.25, Math.PI])
      b.add(box(0.028, 0.07, 0.035), light, { pos: [0.276 * Math.sin(a), 0.392, 0.276 * Math.cos(a)], rot: [0, a, 0] });
    for (const y of [0.3, 0.245]) for (const a of [-0.42, -0.2, 0.2, 0.42])
      b.add(box(0.03, 0.03, 0.03), INK, { pos: [0.2722 * Math.sin(a), y, 0.2722 * Math.cos(a)], rot: [0, a, 0], unlit: true });
    // crest: a red comb following the dome from brow to nape, so it reads from all four sides
    // instead of hanging down the back like the old string of beads
    b.add(cyl(0.05, 0.05, 0.05, 8), '#ffd23a', { pos: [0, 0.54 + 0.27 * Math.cos(1.22), 0.27 * Math.sin(1.22)], rot: [1.22, 0, 0] });
    // the comb is narrow where it meets the helmet and broad at the top, so head-on and from
    // behind it opens into a fan instead of showing one red thumb
    for (const [t, w] of [[52, 0.85], [36, 1.05], [20, 1.25], [4, 1.35], [-12, 1.3], [-28, 1.15], [-46, 0.95], [-64, 0.8]] as [number, number][]) {
      const a = (t * Math.PI) / 180;
      b.add(sphere(0.14, 8, 6), plume, { pos: [0, 0.54 + 0.315 * Math.cos(a), 0.315 * Math.sin(a)], scale: [w, 1, 0.95], colorFn: shade(0.9, 0.24, 0.45) });
    }
  },
  zauberer: (b, skin) => {
    const hat = '#4a3fbf', beard = '#f5f5f5';
    b.add(sphere(0.26, 10, 8), skin, { pos: [0, 0.28, 0] });
    // pointed hat with a bent tip and stars
    b.add(cyl(0.37, 0.37, 0.045, 12), hat, { pos: [0, 0.43, 0] });
    b.add(cyl(0.135, 0.275, 0.32, 10), hat, { pos: [0, 0.6, 0] });
    b.add(cone(0.135, 0.32, 8), hat, { pos: [0, 0.88, -0.07], rot: [-0.45, 0, 0] });
    b.add(octa(0.05), '#ffd23a', { pos: [0.135, 0.59, 0.17], unlit: true });
    b.add(octa(0.038), '#ffd23a', { pos: [-0.09, 0.76, 0.1], unlit: true });
    // round glasses over the eyes and a nose
    eyes(b, 0.335, 0.222, 0.105, 0.058);
    for (const s of [-1, 1]) b.add(torus(0.075, 0.013, 4, 12), INK, { pos: [s * 0.105, 0.335, 0.24], unlit: true });
    b.add(box(0.065, 0.013, 0.013), INK, { pos: [0, 0.335, 0.24], unlit: true });
    b.add(sphere(0.052, 8, 6), SKIN_DARK, { pos: [0, 0.255, 0.245] });
    // white beard and hair as one ring under the brim: a point in front, a mane over the nape
    const wool = shade(0.32, 0.3, 0.34);
    b.add(sphere(0.058, 8, 6), '#e2e2ea', { pos: [0, 0.2, 0.255], scale: [2.4, 0.6, 0.7] });
    b.add(sphere(0.145, 9, 7), beard, { pos: [0, 0.1, 0.125], scale: [1.1, 1.1, 0.9], colorFn: wool });
    b.add(sphere(0.105, 8, 6), beard, { pos: [0, 0.01, 0.115], colorFn: wool });
    b.add(cone(0.075, 0.14, 7), beard, { pos: [0, -0.03, 0.105], rot: [Math.PI, 0, 0], colorFn: wool });
    ring(b, beard, [
      [0.72, 0.15, 0.235, 0.1],
      [1.25, 0.22, 0.24, 0.1],
      [1.8, 0.28, 0.245, 0.095],
      [2.35, 0.29, 0.24, 0.1],
      [2.85, 0.27, 0.235, 0.1],
      [2.55, 0.13, 0.225, 0.095],
      [Math.PI, 0.19, 0.235, 0.105],
    ].map((t) => t as Tuft));
  },
  koch: (b, skin) => {
    const white = '#ffffff', tache = '#3a2a20';
    b.add(sphere(0.27, 10, 8), skin, { pos: [0, 0.29, 0] });
    // toque: a narrow band on the head and one puffy crown of deeply overlapping lobes – the old
    // hat was a shapeless cloud of small bumps, each with its own dark outline seam
    b.add(cyl(0.245, 0.235, 0.12, 12), white, { pos: [0, 0.5, 0] });
    const puff = shade(0.78, 0.22, 0.36);
    b.add(sphere(0.29, 12, 9), white, { pos: [0, 0.66, 0], scale: [1, 0.85, 1], colorFn: puff });
    for (const [x, z] of [[0.17, 0.02], [-0.17, 0.02], [0, -0.17], [0, 0.18]] as [number, number][])
      b.add(sphere(0.165, 9, 7), white, { pos: [x, 0.735, z], colorFn: puff });
    // dark hair round the back of the head, under the band
    ring(b, tache, [
      [1.85, 0.31, 0.255, 0.075],
      [2.4, 0.33, 0.26, 0.095],
      [2.85, 0.31, 0.255, 0.095],
      [Math.PI, 0.29, 0.255, 0.1],
      [Math.PI, 0.21, 0.25, 0.095],
    ]);
    eyes(b, 0.345, 0.228, 0.105, 0.068);
    // rosy cheeks, nose, curly moustache with curled tips, smile underneath
    for (const s of [-1, 1]) b.add(sphere(0.065, 8, 6), '#f5a9a0', { pos: [s * 0.165, 0.26, 0.19], scale: [1, 0.8, 0.35] });
    b.add(sphere(0.06, 8, 6), SKIN_DARK, { pos: [0, 0.27, 0.25] });
    moustache(b, tache, 0.215, 0.24, 1.6, 0.35, 0.09, 0.065);
    for (const s of [-1, 1]) b.add(sphere(0.038, 6, 5), tache, { pos: [s * 0.185, 0.25, 0.2] });
    smile(b, 0.15, 0.225, 0.065);
  },
  hai: (b) => {
    const grey = '#6f8fb0';
    // torpedo head with a pale underside, dorsal and side fins
    b.add(sphere(0.24, 10, 8), grey, { pos: [0, 0.3, 0.05], scale: [1, 0.9, 1.5] });
    b.add(sphere(0.22, 10, 8), '#dfe8f0', { pos: [0, 0.205, 0.075], scale: [0.93, 0.72, 1.34] });
    b.add(cone(0.09, 0.26, 3), grey, { pos: [0, 0.6, -0.1], rot: [-0.35, 0, 0] });
    for (const s of [-1, 1]) b.add(cone(0.06, 0.18, 3), grey, { pos: [s * 0.27, 0.22, 0], rot: [0, 0, -s * (Math.PI / 2 + 0.3)] });
    // gills laid on the flank along its normal – as axis-aligned boxes they stuck out past the
    // silhouette from behind like black tabs
    for (const s of [-1, 1]) for (const t of [2.27, 2.53, 2.79]) {
      const g = tangent(t, 0.24, 0.36, 0.05, 0.006);
      b.add(box(0.024, 0.095, 0.02), INK, { pos: [s * g.pos[0], 0.3, g.pos[1]], rot: [0, s * g.yaw, 0], unlit: true });
    }
    // wide toothy grin following the snout, each segment on the curve of the pale underside
    for (const s of [-1, 1]) for (const [t, w] of [[0.42, 0.125], [0.78, 0.09]] as [number, number][]) {
      const m = tangent(t, 0.1995, 0.2875, 0.075, 0.022);
      b.add(box(w, 0.06, 0.03), INK, { pos: [s * m.pos[0], 0.17, m.pos[1]], rot: [0, s * m.yaw, 0], unlit: true });
    }
    b.add(box(0.13, 0.06, 0.03), INK, { pos: [0, 0.17, 0.353], unlit: true });
    b.add(cone(0.022, 0.05, 4), '#ffffff', { pos: [0, 0.185, 0.362], rot: [Math.PI, 0, 0], unlit: true });
    for (const s of [-1, 1]) for (const [t, r] of [[0.32, 0.022], [0.66, 0.02]] as [number, number][]) {
      const m = tangent(t, 0.2029, 0.2925, 0.075, -0.006);
      b.add(cone(r, 0.05, 4), '#ffffff', { pos: [s * m.pos[0], 0.185, m.pos[1]], rot: [Math.PI, 0, 0], unlit: true });
    }
    // eyes on the sides, turned along the surface normal and sunk into it
    for (const s of [-1, 1]) eye(b, [s * 0.145, 0.362, 0.276], s * 0.99, 0.06);
  },
  kaktus: (b) => {
    const green = '#3aa64f';
    // ribs straight out of the vertex colour, the way the pumpkin gets its lobes
    const ribs = (p: THREE.Vector3, c: THREE.Color) => c.multiplyScalar(0.84 + 0.16 * Math.abs(Math.cos(4 * Math.atan2(p.x, p.z))));
    b.add(capsule(0.18, 0.36, 3, 9), green, { pos: [0, 0.35, 0], colorFn: ribs });
    for (const s of [-1, 1]) b.add(capsule(0.07, 0.16, 2, 6), green, { pos: [s * 0.23, 0.35, 0], rot: [0, 0, s * 0.6] });
    // spines: cones rooted inside the body, pointing straight out, front and back. They used to be
    // little octahedra hanging in the air a hand's width off the plant.
    for (const [a, y] of [[0.55, 0.22], [-0.75, 0.3], [0.35, 0.45], [-0.32, 0.5], [0.2, 0.15], [-0.15, 0.6], [2.3, 0.24], [-2.35, 0.33], [2.85, 0.47], [Math.PI, 0.17], [-2.9, 0.21]] as [number, number][])
      b.add(cone(0.032, 0.13, 4), '#fff2dc', { pos: [0.175 * Math.sin(a), y, 0.175 * Math.cos(a)], rot: [0, a - Math.PI / 2, -Math.PI / 2] });
    // flower with a yellow centre, eyes lying flat on the curve, smile
    b.add(sphere(0.08, 7, 6), '#ff6fb5', { pos: [0.055, 0.655, 0.03], scale: [1.1, 0.8, 1.1] });
    b.add(sphere(0.034, 6, 5), '#ffd23a', { pos: [0.055, 0.7, 0.05], unlit: true });
    for (const s of [-1, 1]) eye(b, [s * 0.0864, 0.4, 0.1416], s * 0.55, 0.042);
    smile(b, 0.305, 0.168, 0.06, 0.015);
  },
};

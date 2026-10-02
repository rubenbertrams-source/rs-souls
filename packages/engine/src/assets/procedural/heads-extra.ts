import * as THREE from 'three';
import { box, cone, cyl, sphere, torus } from './builder';
import { INK, eye, eyes, plate, smile, type HeadBuilder } from './head-parts';
import { ANUBIS_PARTS } from './heads-anubis-mesh';

/**
 * The second wave of heads. Same rules as `heads-classic.ts` – see `head-parts.ts`.
 * Kept in its own module so the roster can grow without a 600-line file.
 *
 * Every one of these was checked on the four-angle contact sheet (`tools/dev/shot-heads.mjs`),
 * the 180° column included: the follow camera stares at the back of the head for a whole race, so
 * each head carries something back there – a knot with ribbons, a spine crest, cranial ridges, a
 * fur ruff, an air hose, a rainbow mane.
 */

/** Darken a part towards its underside so a round shape still reads on the three-step toon ramp. */
const under = (lo: number, hi: number, floor = 0.8) => (p: THREE.Vector3, c: THREE.Color) =>
  c.multiplyScalar(floor + (1 - floor) * THREE.MathUtils.smoothstep(p.y, lo, hi));

/**
 * Band hugging a sphere, like `patch()` but with enough segments to stay flush.
 * `patch` is fixed at 10 × 8 segments; laid over a 12-segment skull its coarser polygons dive
 * under the surface and the head shows through the band in triangular notches (the bee's stripes
 * looked serrated until this). `span` is the horizontal half angle, π for a full ring.
 */
function ring(r: number, thetaStart: number, thetaLength: number, span = Math.PI, seg = 24) {
  const rows = Math.max(2, Math.round(thetaLength * 10));
  return new THREE.SphereGeometry(r, seg, rows, Math.PI / 2 - span, span * 2, thetaStart, thetaLength);
}

export const EXTRA_HEADS: Record<string, HeadBuilder> = {
  ninja: (b, skin) => {
    const cloth = '#2b2b3a', wrap = '#3a3a4c', band = '#e0433a', steel = '#9aa0ac';
    // hood: skull, a bulge behind the head and a cowl over the neck
    b.add(sphere(0.285, 12, 9), cloth, { pos: [0, 0.32, 0], colorFn: under(0.1, 0.5, 0.76) });
    b.add(sphere(0.225, 10, 8), cloth, { pos: [0, 0.26, -0.13], scale: [1, 1, 0.9] });
    b.add(sphere(0.215, 10, 8), cloth, { pos: [0, 0.11, -0.01], scale: [1.1, 0.72, 1.05] });
    // the mask wraps the lower face in a lighter cloth; a pale fold line marks its upper edge,
    // because an INK line on near-black cloth is a line nobody can see
    b.add(ring(0.289, 1.9, 0.62, 1.05), wrap, { pos: [0, 0.32, 0] });
    b.add(ring(0.292, 1.87, 0.035, 1.05), '#5e5e78', { pos: [0, 0.32, 0], unlit: true });
    // the one eye slit: a band of skin hugging the skull, shaded dark under the headband
    b.add(ring(0.289, 1.28, 0.24, 0.62), skin, { pos: [0, 0.32, 0], colorFn: under(0.335, 0.4, 0.68) });
    eyes(b, 0.368, 0.25, 0.092, 0.052);
    // headband with a steel plate at the front, a knot and two ribbons trailing behind
    b.add(cyl(0.292, 0.294, 0.065, 16), band, { pos: [0, 0.455, 0] });
    b.add(plate(0.305, 0.055, 0.85), steel, { pos: [0, 0.455, 0] });
    b.add(box(0.03, 0.03, 0.02), INK, { pos: [0, 0.455, 0.312], unlit: true });
    b.add(sphere(0.062, 8, 6), band, { pos: [0, 0.455, -0.285], scale: [1, 1, 0.85] });
    for (const s of [-1, 1]) {
      b.add(box(0.065, 0.19, 0.022), band, { pos: [s * 0.05, 0.385, -0.335], rot: [0.55, 0, s * 0.2] });
      b.add(box(0.06, 0.16, 0.022), band, { pos: [s * 0.082, 0.25, -0.4], rot: [1.0, 0, s * 0.35] });
    }
  },

  drache: (b) => {
    const hide = '#3aa64f', pale = '#8fd85a', brow = '#2d8b3f', gold = '#ffd23a', bone = '#f5f2e4';
    // heavy skull, long snout, paler lower jaw
    b.add(sphere(0.265, 12, 9), hide, { pos: [0, 0.36, -0.04], scale: [1, 0.95, 1.02], colorFn: under(0.14, 0.5, 0.8) });
    b.add(sphere(0.165, 10, 8), hide, { pos: [0, 0.285, 0.2], scale: [0.95, 0.8, 1.6] });
    b.add(sphere(0.135, 10, 8), pale, { pos: [0, 0.225, 0.2], scale: [0.92, 0.6, 1.55] });
    for (const s of [-1, 1]) b.add(sphere(0.026, 6, 5), INK, { pos: [s * 0.062, 0.332, 0.424], scale: [0.75, 1.5, 0.5], rot: [0, 0, -s * 0.35], unlit: true });
    // mouth line following the curve of the snout, fangs sitting on the lip
    b.add(box(0.15, 0.022, 0.024), INK, { pos: [0, 0.243, 0.445], unlit: true });
    for (const s of [-1, 1]) {
      b.add(box(0.11, 0.022, 0.024), INK, { pos: [s * 0.09, 0.243, 0.4], rot: [0, -s * 0.5, 0], unlit: true });
      b.add(box(0.1, 0.022, 0.024), INK, { pos: [s * 0.128, 0.243, 0.325], rot: [0, -s * 1.0, 0], unlit: true });
      b.add(cone(0.023, 0.058, 4), '#ffffff', { pos: [s * 0.05, 0.228, 0.443], rot: [Math.PI, 0, 0], unlit: true });
      b.add(cone(0.021, 0.05, 4), '#ffffff', { pos: [s * 0.1, 0.228, 0.375], rot: [Math.PI, 0, 0], unlit: true });
    }
    // slit-pupil eyes on the sides of the skull, heavy brows, horns and cheek spikes
    for (const s of [-1, 1]) {
      const yaw = s * 0.65;
      b.add(sphere(0.072, 9, 7), gold, { pos: [s * 0.162, 0.425, 0.145], rot: [0, yaw, 0], scale: [1, 1.15, 0.5], unlit: true });
      b.add(box(0.02, 0.09, 0.02), INK, { pos: [s * 0.162 + Math.sin(yaw) * 0.022, 0.425, 0.145 + Math.cos(yaw) * 0.022], rot: [0, yaw, 0], unlit: true });
      b.add(sphere(0.085, 8, 6), brow, { pos: [s * 0.14, 0.485, 0.115], scale: [1.3, 0.62, 0.8], rot: [0, 0, -s * 0.28] });
      b.add(cone(0.065, 0.34, 6), bone, { pos: [s * 0.15, 0.63, -0.155], rot: [-0.7, 0, -s * 0.3] });
      b.add(cone(0.034, 0.14, 5), bone, { pos: [s * 0.235, 0.34, -0.02], rot: [0, 0, -s * 1.15] });
    }
    // spine crest: what the follow camera sees, from the crown all the way down the neck
    const fins: [number, number, number, number][] = [
      [0.585, -0.06, 0.085, -0.25], [0.555, -0.16, 0.09, -0.7], [0.49, -0.235, 0.085, -1.1],
      [0.4, -0.275, 0.078, -1.45], [0.3, -0.28, 0.068, -1.75], [0.2, -0.245, 0.056, -2.1],
      [0.1, -0.185, 0.045, -2.45], [0.02, -0.115, 0.038, -2.75],
    ];
    for (const [y, z, r, tilt] of fins) b.add(cone(r, r * 2.2, 4), gold, { pos: [0, y, z], rot: [tilt, 0, 0], scale: [0.4, 1, 1] });
  },

  alien: (b) => {
    const hide = '#9ee83a', crest = '#82d42f';
    const shade = under(0.16, 0.55, 0.74);
    // the cranium is lobed like the pumpkin's: five soft ridges that fade in towards the back, so
    // the 180° view has structure without a single extra primitive. Thin torus ribs were tried
    // first and the 3 % outline hull swallowed them into black seams – a melon, not a skull.
    const skull = (p: THREE.Vector3, c: THREE.Color) => {
      shade(p, c);
      const lobes = Math.abs(Math.cos(2.5 * Math.atan2(p.x, -p.z)));
      c.multiplyScalar(1 - 0.24 * THREE.MathUtils.smoothstep(-p.z, -0.08, 0.2) * (1 - lobes));
    };
    // teardrop skull: a big cranium tapering into a narrow chin
    b.add(sphere(0.335, 13, 10), hide, { pos: [0, 0.44, 0], scale: [1.06, 1, 0.98], colorFn: skull });
    b.add(sphere(0.235, 11, 9), hide, { pos: [0, 0.24, 0.02], scale: [1, 1.05, 1], colorFn: shade });
    b.add(sphere(0.13, 10, 7), hide, { pos: [0, 0.1, 0.04], scale: [1, 1.1, 1], colorFn: shade });
    b.add(sphere(0.065, 8, 6), hide, { pos: [0, 0.025, 0.045], colorFn: shade });
    // black almond eyes with a glint at the outer corner; no mouth, only two nostril slits
    for (const s of [-1, 1]) {
      b.add(sphere(0.125, 10, 8), INK, { pos: [s * 0.148, 0.415, 0.265], rot: [0, -s * 0.35, s * 0.55], scale: [1.25, 0.62, 0.45], unlit: true });
      b.add(sphere(0.028, 6, 5), '#ffffff', { pos: [s * 0.19, 0.452, 0.285], scale: [1, 1, 0.5], unlit: true });
      b.add(box(0.016, 0.04, 0.02), '#4f8f1c', { pos: [s * 0.04, 0.235, 0.246], rot: [0, 0, -s * 0.2], unlit: true });
    }
    // one smooth occipital ridge across the base of the skull, and two vent slits above it.
    // A chain of beads down the spine was tried twice: however far the beads overlap, each one
    // turns its own underside away from the light and the ridge comes out scalloped like a
    // caterpillar. One flattened ellipsoid has one surface and stays a ridge.
    b.add(sphere(0.1, 10, 8), crest, { pos: [0, 0.3, -0.265], scale: [2.0, 0.55, 0.5] });
    for (const s of [-1, 1]) b.add(box(0.03, 0.085, 0.018), '#5aa81f', { pos: [s * 0.128, 0.6, -0.248], rot: [0, 0, -s * 0.25], unlit: true });
  },

  skelett: (b) => {
    const bone = '#f0efe8', boneDark = '#dcd8c9', suture = '#bdb9a8';
    const shade = under(0.1, 0.42, 0.82);
    b.add(sphere(0.29, 13, 10), bone, { pos: [0, 0.36, -0.01], colorFn: shade });
    b.add(sphere(0.225, 11, 9), bone, { pos: [0, 0.335, 0.125], scale: [1.03, 0.85, 0.75], colorFn: shade });
    b.add(sphere(0.2, 11, 9), bone, { pos: [0, 0.16, 0.08], scale: [1.1, 0.72, 1.0], colorFn: shade });
    for (const s of [-1, 1]) b.add(sphere(0.085, 8, 6), boneDark, { pos: [s * 0.198, 0.3, 0.125], scale: [1, 0.7, 0.9] });
    // two neck vertebrae, so the skull sits on something instead of hovering
    b.add(cyl(0.078, 0.085, 0.05, 8), bone, { pos: [0, 0.04, -0.005] });
    b.add(cyl(0.092, 0.1, 0.055, 8), boneDark, { pos: [0, -0.03, -0.005] });
    // deep sockets with a live glint, triangular nose hole, a row of teeth in a sunk dark mouth
    for (const s of [-1, 1]) {
      b.add(sphere(0.096, 9, 7), INK, { pos: [s * 0.112, 0.39, 0.232], scale: [1, 0.95, 0.5], unlit: true });
      b.add(sphere(0.033, 7, 6), '#ffffff', { pos: [s * 0.112, 0.385, 0.268], scale: [1, 1, 0.6], unlit: true });
    }
    b.add(cone(0.055, 0.085, 3), INK, { pos: [0, 0.285, 0.268], unlit: true });
    b.add(sphere(0.115, 10, 8), INK, { pos: [0, 0.175, 0.232], scale: [1.0, 0.42, 0.42], unlit: true });
    for (const [x, z] of [[-0.076, 0.242], [-0.025, 0.262], [0.025, 0.262], [0.076, 0.242]] as [number, number][])
      b.add(box(0.04, 0.05, 0.03), '#ffffff', { pos: [x, 0.177, z], unlit: true });
    // sutures: the seam over the crown and the lambdoid pair at the back, soft grey rather than
    // ink – a black hairline on white bone reads as a crack, not as a skull
    b.add(torus(0.296, 0.013, 4, 22, 1.5), suture, { pos: [0, 0.36, -0.01], rot: [0, Math.PI / 2, 0], unlit: true });
    for (const s of [-1, 1]) b.add(box(0.17, 0.024, 0.024), suture, { pos: [s * 0.09, 0.315, -0.276], rot: [0, 0, -s * 0.8], unlit: true });
  },

  biene: (b) => {
    const yellow = '#ffd23a', fuzz = '#ffe276', black = '#23232f', facet = '#43435a';
    b.add(sphere(0.295, 13, 10), yellow, { pos: [0, 0.32, 0], colorFn: under(0.08, 0.45, 0.84) });
    // striped cap: bands that wrap the whole skull, so the 180° view is striped too. They sit
    // above the eyes – the middle stripe used to swallow them.
    b.add(ring(0.3, 0, 0.5), black, { pos: [0, 0.32, 0] });
    b.add(ring(0.3, 0.86, 0.3), black, { pos: [0, 0.32, 0] });
    b.add(ring(0.3, 2.15, 0.35), black, { pos: [0, 0.32, 0] });
    // big compound eyes on the sides of the yellow face, each with a highlight streak
    for (const s of [-1, 1]) {
      b.add(sphere(0.115, 10, 8), facet, { pos: [s * 0.155, 0.355, 0.185], rot: [0, s * 0.55, s * 0.28], scale: [0.8, 1.15, 0.75] });
      b.add(sphere(0.032, 7, 6), '#ffffff', { pos: [s * 0.194, 0.4, 0.249], unlit: true });
    }
    smile(b, 0.2, 0.281, 0.075, 0.016);
    // antennae: thin stalks off the crown with a ball on each tip
    for (const s of [-1, 1]) {
      b.add(cyl(0.015, 0.019, 0.23, 5), black, { pos: [s * 0.126, 0.695, -0.012], rot: [0, 0, -s * 0.35] });
      b.add(sphere(0.055, 8, 6), black, { pos: [s * 0.166, 0.803, -0.014] });
    }
    // fuzzy collar all round the neck
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.add(sphere(0.078, 7, 6), i % 2 ? fuzz : yellow, { pos: [Math.sin(a) * 0.205, 0.025 + Math.cos(a * 2) * 0.014, Math.cos(a) * 0.205] });
    }
  },

  yeti: (b) => {
    const fur = '#f6f5f0', furAlt = '#c3d2e0', face = '#b9c6d4', ice = '#7ee8ff', maw = '#3d5064';
    // each clump darkens towards its own underside, so the ruff reads as clumps, not as one cloud
    const clump = (p: THREE.Vector3, c: THREE.Color) => c.multiplyScalar(0.68 + 0.32 * THREE.MathUtils.smoothstep(p.y, 0.0, 0.36));
    // skull plus a large face set well forward, so the ruff frames it instead of swallowing it
    b.add(sphere(0.275, 12, 9), fur, { pos: [0, 0.36, -0.02], colorFn: under(0.14, 0.45, 0.84) });
    b.add(sphere(0.225, 11, 9), face, { pos: [0, 0.3, 0.135], scale: [1, 1, 0.75] });
    // shaggy ruff: overlapping clumps that really touch, riding low at the front (a beard under
    // the chin) and high at the back (a hump behind the head)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const front = (1 + Math.cos(a)) / 2;
      const r = 0.3 + 0.03 * (1 - front);
      b.add(sphere(0.105, 8, 6), i % 2 ? fur : furAlt, { pos: [Math.sin(a) * r, 0.3 - front * 0.28 + Math.cos(a * 3) * 0.02, Math.cos(a) * r], colorFn: clump });
    }
    for (const [y, z, r] of [[0.5, -0.26, 0.1], [0.4, -0.32, 0.105], [0.29, -0.34, 0.1]] as [number, number, number][])
      b.add(sphere(r, 8, 6), furAlt, { pos: [0, y, z], colorFn: clump });
    for (const [x, y, z, r] of [[0.06, 0.6, -0.04, 0.115], [-0.1, 0.585, 0.02, 0.1], [-0.015, 0.635, -0.12, 0.09]] as [number, number, number, number][])
      b.add(sphere(r, 8, 6), fur, { pos: [x, y, z] });
    // heavy brows hanging over the eyes, blue nose, dark maw with two fangs
    for (const s of [-1, 1]) b.add(sphere(0.105, 8, 6), fur, { pos: [s * 0.115, 0.43, 0.2], scale: [1.35, 0.6, 0.62], rot: [0, 0, -s * 0.3] });
    eyes(b, 0.345, 0.28, 0.11, 0.058);
    b.add(sphere(0.075, 9, 7), ice, { pos: [0, 0.285, 0.29], scale: [1.2, 0.95, 0.95] });
    b.add(sphere(0.09, 10, 8), maw, { pos: [0, 0.19, 0.245], scale: [1.3, 0.55, 0.45], unlit: true });
    for (const s of [-1, 1]) b.add(cone(0.026, 0.062, 4), '#ffffff', { pos: [s * 0.058, 0.2, 0.275], rot: [Math.PI, 0, 0], unlit: true });
  },

  taucher: (b) => {
    const copper = '#c48a4a', copperDark = '#9e6c35', copperLite = '#d9a463', steel = '#9aa0ac', glass = '#2b4658';
    b.add(sphere(0.315, 13, 10), copper, { pos: [0, 0.335, 0], colorFn: under(0.06, 0.48, 0.78) });
    // bolt flange at the base and the shoulder collar the helmet screws onto
    b.add(cyl(0.275, 0.292, 0.07, 16), copperDark, { pos: [0, 0.135, 0] });
    b.add(cyl(0.265, 0.31, 0.11, 14), steel, { pos: [0, 0.04, 0] });
    // three ribs meeting at the crown – the plain copper egg had nothing for the follow camera
    b.add(torus(0.319, 0.022, 4, 22, 1.62), copperDark, { pos: [0, 0.335, 0], rot: [0, Math.PI / 2, 0] });
    for (const s of [-1, 1]) b.add(torus(0.319, 0.016, 4, 20, 1.5), copperDark, { pos: [0, 0.335, 0], rot: [0, Math.PI / 2 - s * 0.55, 0] });
    // porthole: sunk glass in a raised rim with a proud steel ring, eyes on the glass. The glass
    // stands 0.01 out of the copper at its centre, so nothing here cuts through anything.
    b.add(cyl(0.178, 0.196, 0.05, 20), copperLite, { pos: [0, 0.35, 0.24], rot: [Math.PI / 2, 0, 0] });
    b.add(sphere(0.16, 12, 9), glass, { pos: [0, 0.35, 0.225], scale: [1, 1, 0.62] });
    b.add(torus(0.132, 0.032, 5, 16), steel, { pos: [0, 0.35, 0.272] });
    for (const s of [-1, 1]) eye(b, [s * 0.06, 0.365, 0.315], 0, 0.05);
    // three rivets set into the copper around the porthole, sunk onto the actual sphere surface
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const x = Math.cos(a) * 0.215, y = 0.35 + Math.sin(a) * 0.215;
      const z = Math.sqrt(Math.max(0.02, 0.0992 - x * x - (y - 0.335) ** 2)) - 0.014;
      b.add(sphere(0.034, 7, 6), steel, { pos: [x, y, z], unlit: true });
    }
    // side ports and a lamp on the crown
    for (const s of [-1, 1]) {
      b.add(torus(0.075, 0.022, 4, 12), steel, { pos: [s * 0.295, 0.35, 0], rot: [0, Math.PI / 2, 0] });
      b.add(sphere(0.065, 9, 7), glass, { pos: [s * 0.3, 0.35, 0], scale: [0.42, 1, 1] });
    }
    b.add(cyl(0.05, 0.058, 0.055, 8), copperDark, { pos: [0, 0.665, -0.02] });
    b.add(sphere(0.045, 8, 6), '#ffd23a', { pos: [0, 0.705, -0.02], unlit: true });
    // air hose stub and a corrugated hose curling away behind
    b.add(cyl(0.062, 0.07, 0.13, 8), steel, { pos: [0, 0.45, -0.305], rot: [-1.0, 0, 0] });
    b.add(torus(0.068, 0.016, 4, 12), copperDark, { pos: [0, 0.485, -0.36], rot: [-(Math.PI / 2 + 1.0), 0, 0] });
    for (const [y, z, r] of [[0.5, -0.4, 0.055], [0.475, -0.45, 0.052], [0.43, -0.485, 0.05]] as [number, number, number][])
      b.add(sphere(r, 8, 6), '#4d4033', { pos: [0, y, z], scale: [1, 1, 0.9] });
  },

  einhorn: (b) => {
    // deliberately the horse's proportions – same skull, muzzle and side-mounted eyes, new coat.
    const coat = '#f0efe8', muzzle = '#ffd9e8', gold = '#ffd23a';
    const mane = ['#ff6fb5', '#b26bff', '#7ee8ff', '#ffd23a'];
    b.add(sphere(0.22, 10, 8), coat, { pos: [0, 0.36, -0.04], scale: [0.9, 1, 1.05], colorFn: under(0.16, 0.44, 0.86) });
    b.add(sphere(0.13, 10, 8), muzzle, { pos: [0, 0.26, 0.2], scale: [0.9, 0.8, 1.9], rot: [0.25, 0, 0] });
    for (const s of [-1, 1]) b.add(sphere(0.03, 6, 5), '#d98cb0', { pos: [s * 0.05, 0.23, 0.42], scale: [1, 1, 0.5] });
    b.add(torus(0.05, 0.014, 4, 8, Math.PI), INK, { pos: [0, 0.13, 0.39], rot: [0.6, 0, Math.PI], unlit: true });
    for (const s of [-1, 1]) {
      eye(b, [s * 0.158, 0.403, 0.091], s * 0.95, 0.062);
      b.add(box(0.08, 0.016, 0.016), INK, { pos: [s * 0.182, 0.452, 0.1], rot: [0, s * 0.95, -s * 0.5], unlit: true });
      b.add(cone(0.065, 0.2, 6), coat, { pos: [s * 0.115, 0.6, -0.07], rot: [-0.15, 0, -s * 0.25] });
      b.add(cone(0.04, 0.13, 5), muzzle, { pos: [s * 0.112, 0.585, -0.04], rot: [-0.15, 0, -s * 0.25] });
    }
    // twisted horn: six short frusta with an oval cross-section, each turned further round –
    // a plain stack of cones reads as a smooth cone from every angle
    for (let i = 0; i < 6; i++) {
      const r0 = 0.062 - i * 0.0088, r1 = 0.062 - (i + 1) * 0.0088;
      b.add(cyl(r1, r0, 0.072, 6), gold, { pos: [0, 0.545 + i * 0.058, 0.055 + i * 0.008], rot: [0.15, i * 0.62, 0], scale: [1.2, 1, 0.8] });
    }
    b.add(cone(0.014, 0.055, 5), gold, { pos: [0, 0.895, 0.107], rot: [0.15, 0, 0] });
    // forelock between the ears and a rainbow mane down the neck
    for (const [x, y, z, r, c] of [[0, 0.535, 0.115, 0.075, 0], [-0.09, 0.53, 0.06, 0.06, 2], [0.095, 0.535, 0.055, 0.055, 1]] as [number, number, number, number, number][])
      b.add(sphere(r, 8, 6), mane[c]!, { pos: [x, y, z], scale: [1, 0.85, 1.1] });
    const chain: [number, number, number, number][] = [
      [0.6, -0.09, 0.1, 1], [0.55, -0.2, 0.105, 2], [0.45, -0.28, 0.105, 3],
      [0.34, -0.32, 0.1, 0], [0.22, -0.33, 0.095, 1], [0.1, -0.31, 0.085, 2], [0.0, -0.27, 0.08, 3],
    ];
    for (const [y, z, r, c] of chain) b.add(sphere(r, 8, 6), mane[c]!, { pos: [0, y, z], scale: [0.55, 1, 1.1] });
  },
  anubis: (b) => {
    // Modelled in Blender, not from primitives: `tools/assets/blender/anubis_head.py` turns
    // `assets-source/heads/Anubis.fbx` into triangles per colour (black jackal, blue-gold nemes, gold collar).
    for (const part of ANUBIS_PARTS) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      b.add(geo, part.color);
    }
  },
};

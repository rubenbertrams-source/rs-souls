import * as THREE from 'three';
import { characterById } from '../../data/characters';
import { MeshBuilder, capsule, sphere } from './builder';
import { DARK, SKIN, eyes, smile } from './head-parts';
import { CLASSIC_HEADS } from './heads-classic';
import { EXTRA_HEADS } from './heads-extra';
import { shade } from './palette';

/** Height of the neck anchor on the body (heads attach here). */
export const NECK_Y = 0.68;
/** Heads are drawn oversized (chibi look) – applied to the head anchor. */
export const HEAD_SCALE = 1.45;


/**
 * Player body: colour capsule with belly, arms and feet as one merged mesh (+ outline).
 * Origin at the feet, neck anchor at NECK_Y (group in userData.headAnchor).
 */
export function buildFigure(characterId: string): THREE.Group {
  const c = characterById(characterId);
  const b = new MeshBuilder();
  const body = new THREE.Color(c.color);
  const accent = new THREE.Color(c.color2);
  b.add(capsule(0.22, 0.3, 3, 10), body, { pos: [0, 0.4, 0] });
  b.add(sphere(0.15, 10, 7), accent, { pos: [0, 0.42, 0.2], scale: [1, 1.1, 0.5] });
  for (const s of [-1, 1]) {
    b.add(capsule(0.07, 0.22, 2, 7), body, { pos: [s * 0.3, 0.42, 0.05], rot: [0, 0, s * 0.5] });
    b.add(sphere(0.08, 6, 5), shade(body, 0.85), { pos: [s * 0.36, 0.3, 0.08] });
    b.add(sphere(0.1, 7, 5), DARK, { pos: [s * 0.12, 0.08, 0.04], scale: [1, 0.6, 1.3] });
  }
  const g = b.build(`body:${c.id}`, { outline: 0.03 });
  const anchor = new THREE.Group();
  anchor.name = 'headAnchor';
  anchor.position.y = NECK_Y;
  anchor.scale.setScalar(HEAD_SCALE);
  g.add(anchor);
  g.userData.headAnchor = anchor;
  g.scale.setScalar(c.scale);
  return g;
}
/**
 * Procedural head by id: origin at the neck, faces +Z, ~0.5–0.95 tall (hats included).
 * Flat toon look: few primitives, 2–3 tones per head, one lit mesh (+ outline) and one unlit mesh
 * for eyes/mouths. Beards stay above the neck line so nothing hangs through the body.
 *
 * The heads themselves live in `heads-classic.ts` and `heads-extra.ts`; an id with no builder
 * falls back to the plain ball below, which is also what `kugel` is.
 */
export function buildHead(headId: string, skin: THREE.ColorRepresentation = SKIN): THREE.Group {
  const b = new MeshBuilder();
  const make = CLASSIC_HEADS[headId] ?? EXTRA_HEADS[headId];
  if (make) {
    make(b, skin);
  } else {
    b.add(sphere(0.27, 12, 9), skin, { pos: [0, 0.27, 0] });
    eyes(b, 0.32, 0.24, 0.1, 0.07);
    smile(b, 0.16, 0.235, 0.07);
  }
  const g = b.build(`head:${headId}`, { outline: 0.03 });
  seatOnNeck(g);
  return g;
}

/**
 * The neck anchor sits at y = 0, so a head whose lowest point is above it visibly floats over the
 * body. Measured before this was added: horse 0.077, robot 0.080, knight 0.060, shark 0.055 – times
 * HEAD_SCALE that is a finger's width of air under the chin. Drop such a head until it touches.
 * Heads that already reach below zero (beards, long hair) keep their overlap with the torso.
 * The shift goes into the geometry, not into `position`, so callers that place the head themselves
 * (Brawl puts it on a flat disc) still get a head measured from the same origin.
 */
function seatOnNeck(g: THREE.Group) {
  const box = new THREE.Box3();
  let any = false;
  for (const child of g.children) {
    const m = child as THREE.Mesh;
    if (!m.isMesh || !m.geometry) continue;
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!);
    any = true;
  }
  if (!any || box.min.y <= 0.001) return;
  for (const child of g.children) {
    const m = child as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      m.geometry.translate(0, -box.min.y, 0);
      m.geometry.computeBoundingBox();
      m.geometry.computeBoundingSphere();
    }
  }
}

/** Full procedural figure: body + head. */
export function buildCharacter(characterId: string, headId = 'kugel'): THREE.Group {
  const body = buildFigure(characterId);
  const c = characterById(characterId);
  (body.userData.headAnchor as THREE.Group).add(buildHead(headId, headId === 'kugel' ? c.color : SKIN));
  return body;
}

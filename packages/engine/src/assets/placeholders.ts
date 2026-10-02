import * as THREE from 'three';
import { markShared } from './shared';

/*
 * Shared toon helpers. Procedural bodies, heads, karts and props live in ./procedural
 * (see plan/07-LOOK.md) – this file only keeps the material/outline utilities.
 */

/** 3-step toon gradient shared by all toon materials. */
let gradientTex: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradientTex) return gradientTex;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  gradientTex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientTex.minFilter = THREE.NearestFilter;
  gradientTex.magFilter = THREE.NearestFilter;
  gradientTex.needsUpdate = true;
  return markShared(gradientTex);
}

export function toonMaterial(color: THREE.ColorRepresentation, opts: Partial<THREE.MeshToonMaterialParameters> = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

/** Cheap outline: inverted hull with back-face rendering. */
export function addOutline(mesh: THREE.Mesh, thickness = 0.03, color = 0x1a1a2a) {
  const outline = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  outline.scale.setScalar(1 + thickness);
  outline.name = 'outline';
  mesh.add(outline);
  return outline;
}

import type * as THREE from 'three';

/**
 * Marks a material or texture as shared: one object that many meshes use for the whole session
 * (the toon material of every procedural prop, the toon gradient, a cached texture).
 * `disposeObject` leaves it alone – disposing it drops its GPU program or upload, and the next
 * frame that draws any of its users has to link the shader and upload the texture again, a hitch
 * each time a single roller or prop goes.
 */
export function markShared<T extends THREE.Material | THREE.Texture>(o: T): T {
  o.userData.shared = true;
  return o;
}

import * as THREE from 'three';
import { markShared } from '@pv/engine';

/**
 * The painted backdrops (tools/assets/gen_rssouls.py → src/assets/img/*.webp), bundled by Vite.
 * A missing picture is not an error: the room keeps its flat silhouettes until the GPU has made one.
 */
const URLS = import.meta.glob('../assets/img/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Pixel sizes written by the generator, so a plane can take a picture's real aspect. */
const SIZES = Object.values(import.meta.glob('../assets/img/sizes.json', { eager: true, import: 'default' }))[0] as Record<string, [number, number]> | undefined;

const IMG: Record<string, string> = {};
for (const [path, url] of Object.entries(URLS)) IMG[path.split('/').pop()!.replace(/\.webp$/, '')] = url;

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function hasImage(id: string) {
  return !!IMG[id];
}

/** Width over height of a picture (1 when unknown). */
export function aspect(id: string): number {
  const s = SIZES?.[id];
  return s ? s[0] / s[1] : 1;
}

/**
 * A texture for a picture id (shared: it survives `disposeObject` of a room), or null when the
 * picture does not exist. It loads in the background and shows once it arrives.
 */
export function texture(id: string): THREE.Texture | null {
  const url = IMG[id];
  if (!url) return null;
  let t = cache.get(id);
  if (!t) {
    t = markShared(loader.load(url));
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(id, t);
  }
  return t;
}

export function disposeImages() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

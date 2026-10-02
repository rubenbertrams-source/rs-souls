import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { toonGradient } from './placeholders';
import { markShared } from './shared';
import { buildFigure, buildHead } from './procedural/figure';
import { characterById } from '../data/characters';

export interface AssetManifest {
  /** Relative paths (under /assets/generated/) that actually exist, written by tools/assets/run_all.py */
  files: string[];
  /** Generated meshes that should be used instead of the procedural version (e.g. "props/statue.glb"). */
  hero?: string[];
  generatedAt?: string;
}

/**
 * One kind of procedural asset, registered by the game that owns the geometry.
 *
 * `A` is the argument list the finished factory takes, so a game keeps its own vocabulary
 * (`(variant, colour)` for a kart body, `(id, opts)` for a prop) without the engine learning it.
 */
export interface ProceduralAsset<A extends unknown[]> {
  /** Where a generated mesh for these arguments would sit in the manifest, e.g. `props/hut.glb`. */
  file(...args: A): string;
  /** Built in code. May resolve its geometry lazily, so a big builder stays off the start-up path. */
  build(...args: A): THREE.Group | Promise<THREE.Group>;
  /** Touch up the clone of a hero GLB before it is handed out (paint it, fill in userData, ...). */
  adopt?(model: THREE.Group, ...args: A): void;
}

/** What `AssetManager.register` hands back: call it like any other asset method. */
export type AssetFactory<A extends unknown[]> = (...args: A) => Promise<THREE.Group>;

/**
 * Generated GLBs/textures with caching, plus the procedural geometry games register here.
 * A generated GLB is only used for heads and for manifest items flagged as `hero`; everything else
 * is built in code. Callers never need to know which path was taken.
 */
export class AssetManager {
  private gltf = new GLTFLoader();
  private draco = new DRACOLoader();
  private texLoader = new THREE.TextureLoader();
  private models = new Map<string, Promise<THREE.Group | null>>();
  private textures = new Map<string, Promise<THREE.Texture | null>>();
  manifest: AssetManifest = { files: [] };
  readonly base: string;
  /** Force procedural assets everywhere (debug / tests). */
  placeholdersOnly = false;

  constructor(base = 'assets/generated/') {
    this.base = base;
    this.draco.setDecoderPath('draco/');
    this.gltf.setDRACOLoader(this.draco);
  }

  async loadManifest() {
    try {
      const res = await fetch(this.base + 'manifest.json', { cache: 'no-cache' });
      if (res.ok) this.manifest = await res.json();
    } catch {
      this.manifest = { files: [] };
    }
  }

  has(rel: string) {
    return !this.placeholdersOnly && this.manifest.files.includes(rel);
  }

  /**
   * URL of a generated file, stamped with the moment the asset pipeline last ran.
   *
   * Nothing under /assets/generated/ carries a content hash in its name – the pipeline writes
   * plain paths like `sfx/boost.wav` – so a browser that has one is free to keep it for as long as
   * the server's cache header allows. After a deploy that meant hearing the old sounds and seeing
   * the old heads on the live site while the files on disk were already the new ones. The manifest
   * itself is fetched with `no-cache`, so this stamp is always current and every file it names is
   * fetched fresh exactly when it changed, and served from cache the rest of the time.
   */
  url(rel: string) {
    const v = this.manifest.generatedAt;
    return this.base + rel + (v ? `?v=${encodeURIComponent(v)}` : '');
  }

  /** Generated file explicitly flagged as hero asset (used instead of the procedural version). */
  isHero(rel: string) {
    return this.has(rel) && !!this.manifest.hero?.includes(rel);
  }

  /** Load a GLB by relative path (e.g. "characters/pip.glb"). Resolves null if missing. */
  model(rel: string): Promise<THREE.Group | null> {
    if (!this.has(rel)) return Promise.resolve(null);
    let p = this.models.get(rel);
    if (!p) {
      p = this.gltf
        .loadAsync(this.url(rel))
        .then((g) => {
          const root = g.scene;
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              m.material = mats.map((mat) => {
                const std = mat as THREE.MeshStandardMaterial;
                const toon = new THREE.MeshToonMaterial({
                  color: std.color ?? new THREE.Color(0xffffff),
                  map: std.map ?? null,
                  gradientMap: toonGradient(),
                });
                return toon;
              })[0] as THREE.Material;
            }
          });
          return root;
        })
        .catch(() => null);
      this.models.set(rel, p);
    }
    return p;
  }

  /** Set from the renderer (`capabilities.getMaxAnisotropy()`); applies to every texture handed out here. */
  maxAnisotropy = 4;

  texture(rel: string, opts: { repeat?: number; srgb?: boolean } = {}): Promise<THREE.Texture | null> {
    if (!this.has(rel)) return Promise.resolve(null);
    let p = this.textures.get(rel);
    if (!p) {
      p = this.texLoader
        .loadAsync(this.url(rel))
        .then((t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          if (opts.repeat) t.repeat.set(opts.repeat, opts.repeat);
          if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = this.maxAnisotropy;
          // cached for the session: whoever disposes a model that uses it must not drop it
          return markShared(t);
        })
        .catch(() => null);
      this.textures.set(rel, p);
    }
    return p;
  }

  /**
   * Register a kind of procedural asset and get the factory for it.
   *
   * This is the one rule the engine owns and every kind shares: a generated mesh that the manifest
   * flags as `hero` wins, code builds the thing otherwise. Games own the geometry - nothing in here
   * knows what a kart or a prop is.
   */
  register<A extends unknown[]>(kind: ProceduralAsset<A>): AssetFactory<A> {
    return async (...args: A) => {
      const rel = kind.file(...args);
      const hero = this.isHero(rel) ? await this.model(rel) : null;
      if (!hero) return kind.build(...args);
      const clone = hero.clone(true);
      kind.adopt?.(clone, ...args);
      return clone;
    };
  }

  /** Characters and heads are shared by every game, so the engine registers them itself. */
  private readonly figure = this.register<[id: string, headId: string]>({
    file: (id) => `characters/${id}.glb`,
    adopt: (body, id) => {
      body.name = `char:${id}`; // full character mesh: no separate head
    },
    build: (id, headId) => this.buildCharacter(id, headId),
  });

  /** Figure = procedural colour body with a swappable head (generated GLB head if present), origin at feet. */
  character(id: string, headId = 'kugel'): Promise<THREE.Group> {
    return this.figure(id, headId);
  }

  private async buildCharacter(id: string, headId: string): Promise<THREE.Group> {
    const body = buildFigure(id);
    const anchor = body.userData.headAnchor as THREE.Group;
    const headModel = await this.model(`heads/${headId}.glb`);
    if (headModel) {
      const h = headModel.clone(true);
      h.name = `head:${headId}`;
      if (headId === 'kugel') {
        // neutral ball head: tint the generated texture with the body colour
        const tint = new THREE.Color(characterById(id).color);
        h.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !Array.isArray(m.material)) {
            m.material = (m.material as THREE.Material).clone();
            (m.material as THREE.MeshToonMaterial).color.copy(tint).lerp(new THREE.Color(0xffffff), 0.25);
          }
        });
      }
      anchor.add(h);
    } else {
      anchor.add(buildHead(headId, headId === 'kugel' ? characterById(id).color : 0xffe0bd));
    }
    return body;
  }
}

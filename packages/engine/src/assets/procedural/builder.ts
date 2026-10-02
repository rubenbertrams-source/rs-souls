import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from '../placeholders';
import { markShared } from '../shared';
import type { Rng } from '../../math/rng';

/*
 * Low-poly toon building blocks. Every procedural object is one merged, non-indexed geometry
 * per material (flat faces, colours as vertex colours), so a prop costs one draw call and all
 * props share the same two materials (lit toon + unlit "glow").
 */

let litMat: THREE.MeshToonMaterial | null = null;
let unlitMat: THREE.MeshBasicMaterial | null = null;
let outlineMat: THREE.MeshBasicMaterial | null = null;

/**
 * Shared toon material for vertex-coloured geometry. Glowing parts (lanterns, windows, crystals,
 * eyes) live in the same geometry with a `glow` vertex attribute of 1: the fragment shader then
 * shows the raw vertex colour instead of the lit one. One material, one draw call per prop,
 * where the lit + unlit split used to cost two.
 */
export function litVertexMaterial(): THREE.MeshToonMaterial {
  if (!litMat) {
    litMat = markShared(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), name: 'pv-lit' }));
    litMat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float glow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb, vGlow);');
    };
    // the instanced and non-instanced variants compile separately; keying by the flag keeps them apart
    litMat.customProgramCacheKey = () => 'pv-lit-glow';
  }
  return litMat;
}

/** Shared unlit material – reads as glowing (lanterns, crystals, eyes, windows). */
export function unlitVertexMaterial(): THREE.MeshBasicMaterial {
  if (!unlitMat) unlitMat = markShared(new THREE.MeshBasicMaterial({ vertexColors: true, name: 'pv-unlit' }));
  return unlitMat;
}

export function outlineMaterial(): THREE.MeshBasicMaterial {
  if (!outlineMat) outlineMat = markShared(new THREE.MeshBasicMaterial({ color: 0x1a1a2a, side: THREE.BackSide, name: 'pv-outline' }));
  return outlineMat;
}

const instancedVariants = new Map<THREE.Material, (THREE.Material | null)[]>();

/**
 * The material to give an InstancedMesh when ordinary meshes draw the same one.
 *
 * three keeps "was the last draw instanced / did it have instance colours" per *material*. A
 * material shared between the trees' InstancedMesh and the start arch's plain Mesh flips that flag
 * on every object, and each flip makes the renderer resolve the shader program again – build the
 * parameter set, the cache key string, the uniform list – for every one of those objects, every
 * frame. With the shared toon material on 160 objects that was a third of the CPU time of a
 * four-player frame. The instanced variant is a clone with the same hooks, so it shares the GPU
 * program (the cache key already tells instanced and plain apart) but keeps its own flags.
 */
export function instancedVariant<T extends THREE.Material>(mat: T, withColor = false): T {
  let variants = instancedVariants.get(mat);
  if (!variants) instancedVariants.set(mat, (variants = [null, null]));
  const i = withColor ? 1 : 0;
  if (!variants[i]) {
    const m = mat.clone() as T;
    // clone() copies the parameters, not the hooks the material was set up with
    m.onBeforeCompile = mat.onBeforeCompile;
    m.customProgramCacheKey = mat.customProgramCacheKey;
    m.name = `${mat.name}:inst${withColor ? '+color' : ''}`;
    variants[i] = m;
  }
  return variants[i] as T;
}

export type Vec3 = [number, number, number];

export interface PartOpts {
  pos?: Vec3;
  /** Euler XYZ in radians. */
  rot?: Vec3;
  scale?: number | Vec3;
  /** Unlit material (glow). */
  unlit?: boolean;
  /** Per-face lightness jitter 0..1 (needs an Rng on the builder). */
  jitter?: number;
  /** Keep smooth normals (spheres that should not look faceted). */
  smooth?: boolean;
  /** Colour override per vertex: called with the local position (after transform) and the base colour. */
  colorFn?: (p: THREE.Vector3, c: THREE.Color) => void;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Roughen an (indexed or not) geometry: weld vertices, then push each along its normal by ±amount. */
export function roughen(geo: THREE.BufferGeometry, rng: Rng, amount: number, freq = 1): THREE.BufferGeometry {
  const g = mergeVertices(geo, 1e-4);
  geo.dispose();
  g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const d = (rng.next() - 0.5) * 2 * amount * freq;
    pa.setXYZ(i, pa.getX(i) + na.getX(i) * d, pa.getY(i) + na.getY(i) * d, pa.getZ(i) + na.getZ(i) * d);
  }
  return g;
}

export class MeshBuilder {
  private lit: THREE.BufferGeometry[] = [];
  constructor(readonly rng?: Rng) {}

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation | THREE.Color, o: PartOpts = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    // transform in place
    const p = o.pos ?? [0, 0, 0];
    const r = o.rot ?? [0, 0, 0];
    const sc = o.scale ?? 1;
    _q.setFromEuler(_e.set(r[0], r[1], r[2]));
    if (typeof sc === 'number') _s.setScalar(sc);
    else _s.set(sc[0], sc[1], sc[2]);
    _m.compose(_p.set(p[0], p[1], p[2]), _q, _s);
    g.applyMatrix4(_m);
    if (!o.smooth || !g.attributes.normal) g.computeVertexNormals();
    // colours (linear, one colour per face + optional jitter / colour function)
    const base = color instanceof THREE.Color ? color : new THREE.Color(color);
    const pa = g.attributes.position as THREE.BufferAttribute;
    const n = pa.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    const cv = new THREE.Color();
    for (let i = 0; i < n; i += 3) {
      c.copy(base);
      if (o.jitter && this.rng) {
        const j = 1 + (this.rng.next() - 0.5) * 2 * o.jitter;
        c.multiplyScalar(j);
      }
      for (let k = 0; k < 3 && i + k < n; k++) {
        cv.copy(c);
        if (o.colorFn) {
          _p.fromBufferAttribute(pa, i + k);
          o.colorFn(_p, cv);
        }
        const idx = (i + k) * 3;
        col[idx] = Math.min(1, cv.r);
        col[idx + 1] = Math.min(1, cv.g);
        col[idx + 2] = Math.min(1, cv.b);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const glow = new Float32Array(n);
    if (o.unlit) glow.fill(1);
    g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    this.lit.push(g);
    return this;
  }

  /** Merge everything into a group with one mesh per material (named 'lit' / 'unlit'). */
  build(name: string, opts: { outline?: number } = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    if (this.lit.length) {
      const geo = this.lit.length === 1 ? this.lit[0]! : mergeGeometries(this.lit, false)!;
      if (this.lit.length > 1) for (const g of this.lit) g.dispose();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, litVertexMaterial());
      mesh.name = 'lit';
      if (opts.outline) {
        const outline = new THREE.Mesh(geo, outlineMaterial());
        outline.scale.setScalar(1 + opts.outline);
        outline.name = 'outline';
        mesh.add(outline);
      }
      group.add(mesh);
    }
    this.lit = [];
    return group;
  }
}

// --- primitive shorthands (radial segment counts kept low for the faceted look)
export const cyl = (rTop: number, rBottom: number, h: number, seg = 8) => new THREE.CylinderGeometry(rTop, rBottom, h, seg);
export const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const sphere = (r: number, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const dome = (r: number, w = 10, h = 5) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2);
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const capsule = (r: number, len: number, cap = 2, rad = 8) => new THREE.CapsuleGeometry(r, len, cap, rad);
export const torus = (r: number, tube: number, rad = 6, tub = 12, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, rad, tub, arc);
export const octa = (r: number) => new THREE.OctahedronGeometry(r, 0);

/**
 * Cylinder segment from a to b (world-ish coordinates in the builder's local frame).
 * Returns the geometry already transformed; add it with no pos/rot.
 */
export function tube(a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, seg = 6): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rB, rA, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Soft radial shadow texture (cached) for the blob under karts/figures. */
let blobTex: THREE.CanvasTexture | null = null;
export function shadowBlobTexture(): THREE.Texture {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  blobTex = markShared(new THREE.CanvasTexture(cv));
  return blobTex;
}

/** Flat blob mesh on the ground plane (y = 0.02), sized in metres. */
export function shadowBlob(w: number, d: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowBlobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.name = 'shadow';
  m.renderOrder = 1;
  return m;
}

/**
 * Bake a static subtree into one mesh per material. A figure with a head is six draw calls
 * (body lit / unlit / outline, head lit / unlit / outline); after this it is three. Only for
 * things that never move relative to each other – the head anchor's transform is baked in.
 * The group keeps its own position/rotation/scale; children are replaced.
 */
export function flattenStatic(group: THREE.Group, name = group.name): THREE.Group {
  const saved = { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone(), parent: group.parent };
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.scale.setScalar(1);
  group.parent = null;
  group.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o === group) return;
    const mat = m.material as THREE.Material;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as THREE.BufferGeometry;
    g.applyMatrix4(m.matrixWorld);
    // merged geometries need the same attribute set: drop what only some parts carry
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'color' && a !== 'glow') g.deleteAttribute(a);
    const n = (g.attributes.position as THREE.BufferAttribute).count;
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!g.attributes.glow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n), 1));
    if (!g.attributes.normal) g.computeVertexNormals();
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(g);
  });
  group.clear();
  for (const [mat, list] of byMat) {
    const geo = list.length === 1 ? list[0]! : mergeGeometries(list, false)!;
    if (list.length > 1) for (const g of list) g.dispose();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = mat.name === 'pv-outline' ? 'outline' : mat.name === 'pv-unlit' ? 'unlit' : 'lit';
    // the outline hull has to draw after the body it wraps, whatever the order they were merged in
    if (mesh.name === 'outline') mesh.renderOrder = 0;
    group.add(mesh);
  }
  group.name = name;
  group.position.copy(saved.p);
  group.quaternion.copy(saved.q);
  group.scale.copy(saved.s);
  if (saved.parent) saved.parent.add(group);
  return group;
}

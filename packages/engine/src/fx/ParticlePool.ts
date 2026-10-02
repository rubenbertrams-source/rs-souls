import * as THREE from 'three';

/**
 * A dead slot is parked below every level instead of being removed: it keeps its place in the
 * buffer, and the vertex is clipped long before it costs a fragment.
 */
const PARK_Y = -9999;

export interface ParticlePoolOptions {
  /** Slots in the pool, fixed for its life. Spawning past it reuses the oldest slot. */
  capacity: number;
  /**
   * Material of the single `THREE.Points`. The pool never touches it, so colour, texture, size,
   * blending and any custom shader – including uniforms the game feeds per frame – stay in the game.
   */
  material: THREE.Material;
  /**
   * Extra per-particle attributes as name -> item size, e.g. `{ color: 3 }` for a material with
   * `vertexColors`, or `{ aSize: 1, aAlpha: 1 }` for a custom shader. The pool allocates them and
   * uploads them alongside the positions; the game writes them through `array()`.
   */
  attributes?: Record<string, number>;
  /** Pull along -y in units/s². `spawn` may override it per particle. */
  gravity?: number;
  /** Velocity damping per second, applied after gravity: `v *= 1 - drag * dt`. */
  drag?: number;
  /**
   * Called once per living particle per frame with its slot, its remaining life as a fraction
   * (1 fresh, 0 dead) and the frame's dt – the hook for fading, which every game does differently:
   * over the material's opacity, over the vertex colour, or over an alpha attribute.
   */
  onLive?: (index: number, k: number, dt: number) => void;
  /**
   * Hide the cloud while nothing is alive and save its draw call. Off by default: showing a
   * `Points` again makes three resolve its program, and a game that must not hitch on the first
   * effect keeps the empty cloud resident instead.
   */
  hideWhenEmpty?: boolean;
}

/**
 * One pooled cloud of particles: fixed slots over a `BufferGeometry`, a single draw call, and no
 * allocation once it runs.
 *
 * Three games had grown their own copy of this – kart's sparks and rocket smoke, brawl's specks,
 * the dust and splashes in towers. What they shared to the letter is the bookkeeping: hand out a
 * slot, age what is alive, pull it down, upload the buffer. What they did not share is the look and
 * the spawning, and neither lives here: the game brings the material and the extra attributes, and
 * decides what to throw off, when, and with which impulse.
 */
export class ParticlePool {
  readonly points: THREE.Points;
  readonly capacity: number;
  private pos: Float32Array;
  private vel: Float32Array;
  /** Seconds left, <= 0 for a free slot. */
  private life: Float32Array;
  /** Seconds the slot started with, so `onLive` gets a fraction. */
  private span: Float32Array;
  private grav: Float32Array;
  private arrays = new Map<string, Float32Array>();
  private attrs: THREE.BufferAttribute[] = [];
  private mat: THREE.Material;
  private gravity: number;
  private drag: number;
  private onLive: ((index: number, k: number, dt: number) => void) | undefined;
  private hideWhenEmpty: boolean;
  private next = 0;
  private liveCount = 0;
  private dirty = false;

  constructor(opts: ParticlePoolOptions) {
    const cap = (this.capacity = opts.capacity);
    this.gravity = opts.gravity ?? 0;
    this.drag = opts.drag ?? 0;
    this.onLive = opts.onLive;
    this.hideWhenEmpty = opts.hideWhenEmpty ?? false;
    this.mat = opts.material;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.span = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = PARK_Y;
    const geo = new THREE.BufferGeometry();
    const add = (name: string, array: Float32Array, itemSize: number) => {
      const a = new THREE.BufferAttribute(array, itemSize).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      this.attrs.push(a);
      this.arrays.set(name, array);
    };
    add('position', this.pos, 3);
    for (const [name, size] of Object.entries(opts.attributes ?? {})) add(name, new Float32Array(cap * size), size);
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    if (this.hideWhenEmpty) this.points.visible = false;
  }

  /** Particles alive after the last `update`. */
  get live(): number {
    return this.liveCount;
  }

  /** The backing array of an extra attribute, indexed by the slot `spawn` returns. */
  array(name: string): Float32Array {
    const a = this.arrays.get(name);
    if (!a) throw new Error(`ParticlePool: no attribute "${name}"`);
    return a;
  }

  /**
   * Start a particle and return its slot, so the caller can fill its own attributes for that index.
   * Slots go round robin: once the pool is full, the oldest one is taken over.
   */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, gravity = this.gravity): number {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.vel[o] = vx;
    this.vel[o + 1] = vy;
    this.vel[o + 2] = vz;
    this.life[i] = life;
    this.span[i] = life;
    this.grav[i] = gravity;
    // flagged here too: a game that spawns after its own update still shows the particle this frame
    this.dirty = true;
    return i;
  }

  /** Age everything alive and upload what moved. Render side only – never fold this into a step. */
  update(dt: number) {
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      const left = this.life[i]!;
      if (left <= 0) continue;
      const rest = left - dt;
      this.dirty = true;
      if (rest <= 0) {
        this.life[i] = 0;
        this.pos[i * 3 + 1] = PARK_Y;
        continue;
      }
      this.life[i] = rest;
      const o = i * 3;
      let vx = this.vel[o]!;
      let vy = this.vel[o + 1]! - this.grav[i]! * dt;
      let vz = this.vel[o + 2]!;
      if (this.drag > 0) {
        const d = 1 - this.drag * dt;
        vx *= d;
        vy *= d;
        vz *= d;
      }
      this.vel[o] = vx;
      this.vel[o + 1] = vy;
      this.vel[o + 2] = vz;
      this.pos[o] = this.pos[o]! + vx * dt;
      this.pos[o + 1] = this.pos[o + 1]! + vy * dt;
      this.pos[o + 2] = this.pos[o + 2]! + vz * dt;
      this.onLive?.(i, rest / this.span[i]!, dt);
      live++;
    }
    this.liveCount = live;
    if (this.dirty) {
      for (const a of this.attrs) a.needsUpdate = true;
      this.dirty = false;
    }
    if (this.hideWhenEmpty) this.points.visible = live > 0;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

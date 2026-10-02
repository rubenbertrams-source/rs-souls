import { Vector3 } from 'three';

/**
 * Closed Catmull-Rom spline with arc-length parametrisation.
 * Used for kart tracks (centerline) and CPU racing lines.
 */
export class ClosedSpline {
  readonly points: Vector3[];
  private samples: Vector3[] = [];
  private cumulative: number[] = [];
  private _length = 0;
  readonly resolution: number;

  constructor(points: Vector3[], samplesPerSegment = 16) {
    if (points.length < 3) throw new Error('ClosedSpline needs at least 3 points');
    this.points = points.map((p) => p.clone());
    this.resolution = samplesPerSegment;
    this.rebuild();
  }

  get length(): number {
    return this._length;
  }

  private rebuild() {
    const n = this.points.length;
    this.samples = [];
    this.cumulative = [];
    let acc = 0;
    let prev: Vector3 | null = null;
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < this.resolution; s++) {
        const p = this.evalSegment(i, s / this.resolution);
        if (prev) acc += p.distanceTo(prev);
        this.samples.push(p);
        this.cumulative.push(acc);
        prev = p;
      }
    }
    // close loop
    const first = this.samples[0] as Vector3;
    acc += (prev as Vector3).distanceTo(first);
    this._length = acc;
  }

  /** Catmull-Rom on segment i (between points[i] and points[i+1]) at local t. */
  evalSegment(i: number, t: number, out = new Vector3()): Vector3 {
    const n = this.points.length;
    const p0 = this.points[(i - 1 + n) % n] as Vector3;
    const p1 = this.points[i % n] as Vector3;
    const p2 = this.points[(i + 1) % n] as Vector3;
    const p3 = this.points[(i + 2) % n] as Vector3;
    const t2 = t * t;
    const t3 = t2 * t;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
  }

  /** Position at normalised arc-length u in [0,1). */
  at(u: number, out = new Vector3()): Vector3 {
    return this.atDistance(this.wrapU(u) * this._length, out);
  }

  /** Tangent (unit) at normalised u. */
  tangentAt(u: number, out = new Vector3()): Vector3 {
    const eps = 0.5 / this._length;
    const a = this.at(u - eps);
    const b = this.at(u + eps);
    return out.subVectors(b, a).normalize();
  }

  /** Position at absolute distance d along the loop. */
  atDistance(d: number, out = new Vector3()): Vector3 {
    d = ((d % this._length) + this._length) % this._length;
    const idx = this.findSample(d);
    const nextIdx = (idx + 1) % this.samples.length;
    const d0 = this.cumulative[idx] as number;
    const d1 = nextIdx === 0 ? this._length : (this.cumulative[nextIdx] as number);
    const t = d1 === d0 ? 0 : (d - d0) / (d1 - d0);
    return out.lerpVectors(this.samples[idx] as Vector3, this.samples[nextIdx] as Vector3, t);
  }

  private findSample(d: number): number {
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.cumulative[mid] as number) <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Closest normalised u to a world point (coarse sample search + local refinement). */
  closestU(p: Vector3, hintU?: number, window = 0.08): number {
    let bestI = 0;
    let bestD = Infinity;
    const n = this.samples.length;
    let start = 0;
    let end = n;
    if (hintU !== undefined) {
      const c = Math.floor(this.wrapU(hintU) * n);
      const w = Math.max(2, Math.floor(window * n));
      start = c - w;
      end = c + w;
    }
    for (let k = start; k < end; k++) {
      const i = ((k % n) + n) % n;
      const d = (this.samples[i] as Vector3).distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    // refine between neighbours by projecting on the two adjacent segments
    const a = this.samples[(bestI - 1 + n) % n] as Vector3;
    const b = this.samples[bestI] as Vector3;
    const c = this.samples[(bestI + 1) % n] as Vector3;
    const da = this.cumulative[(bestI - 1 + n) % n] as number;
    const db = this.cumulative[bestI] as number;
    const dc = this.cumulative[(bestI + 1) % n] as number;
    const proj = (p0: Vector3, p1: Vector3) => {
      const ab = p1.clone().sub(p0);
      const t = Math.max(0, Math.min(1, p.clone().sub(p0).dot(ab) / Math.max(1e-6, ab.lengthSq())));
      return { t, d: p.distanceToSquared(p0.clone().addScaledVector(ab, t)) };
    };
    const r1 = proj(a, b);
    const r2 = proj(b, c);
    let dist: number;
    if (r1.d < r2.d) {
      const len = bestI === 0 ? this._length - da : db - da;
      dist = da + r1.t * len;
    } else {
      const len = (bestI + 1) % n === 0 ? this._length - db : dc - db;
      dist = db + r2.t * len;
    }
    return this.wrapU(dist / this._length);
  }

  wrapU(u: number): number {
    return u - Math.floor(u);
  }

  /** Curvature sign/strength estimate at u (positive = left turn for y-up, tangent forward). */
  curvatureAt(u: number, step = 0.01): number {
    const t0 = this.tangentAt(u - step);
    const t1 = this.tangentAt(u + step);
    const cross = t0.x * t1.z - t0.z * t1.x; // y-component of cross product (sign)
    const angle = Math.asin(Math.max(-1, Math.min(1, cross)));
    return -angle / (2 * step * this._length);
  }
}

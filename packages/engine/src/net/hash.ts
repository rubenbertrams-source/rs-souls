/** Small order-sensitive integer hash for desync detection (FNV-1a style over int32 words). */
export class StateHasher {
  private h = 0x811c9dc5 | 0;

  /** Add a number: floats are rounded to `digits` decimals first so tiny render-side noise cannot matter. */
  add(v: number, digits = 3): this {
    const n = Number.isFinite(v) ? Math.round(v * 10 ** digits) : 0x7fffffff;
    this.h = Math.imul(this.h ^ (n | 0), 16777619);
    this.h = Math.imul(this.h ^ (this.h >>> 13), 16777619);
    return this;
  }

  addBool(b: boolean): this {
    return this.add(b ? 1 : 0, 0);
  }

  addString(s: string): this {
    for (let i = 0; i < s.length; i++) this.add(s.charCodeAt(i), 0);
    return this.add(s.length, 0);
  }

  get value(): number {
    return this.h >>> 0;
  }
}

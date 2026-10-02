/**
 * A bit stream that travels as text.
 *
 * The relay hands peer messages on inside a JSON frame, so whatever a peer sends has to survive as
 * characters – the same reason InputLog encodes its runs to base64. Six bits per character is the
 * densest thing that stays a plain JSON string, and writing the bits directly instead of packing
 * bytes first saves the byte alignment: a flag really costs one bit, and only the very last
 * character of a message is padded.
 *
 * The alphabet is base64url, so nothing in here ever needs escaping in JSON.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) VALUE[ALPHABET.charCodeAt(i)] = i;

/** Widest fixed-width field. Keeps the accumulator inside 31 bits, so plain shifts stay exact. */
export const MAX_FIELD_BITS = 24;
/** Data bits per varint group; the sixth bit of each group says whether another one follows. */
const VAR_CHUNK = 5;

export class BitWriter {
  private out = '';
  private acc = 0;
  private n = 0;

  /** Write the low `bits` bits of `v` (unsigned, `bits` ≤ MAX_FIELD_BITS). */
  u(v: number, bits: number): this {
    this.acc = (this.acc << bits) | (v & ((1 << bits) - 1));
    this.n += bits;
    while (this.n >= 6) {
      this.n -= 6;
      this.out += ALPHABET[(this.acc >>> this.n) & 63];
    }
    this.acc &= (1 << this.n) - 1;
    return this;
  }

  /** Unsigned variable length: five data bits per group, so small numbers cost six bits. */
  v(v: number): this {
    let x = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    for (;;) {
      const part = x % (1 << VAR_CHUNK);
      x = Math.floor(x / (1 << VAR_CHUNK));
      this.u(x > 0 ? part | (1 << VAR_CHUNK) : part, VAR_CHUNK + 1);
      if (x === 0) return this;
    }
  }

  /** Signed variable length (zig-zag, so -1 is as cheap as 1). */
  s(v: number): this {
    const x = Number.isFinite(v) ? Math.round(v) : 0;
    return this.v(x < 0 ? -2 * x - 1 : 2 * x);
  }

  /** A full int32 (sign included), for values that are large by nature – match ids, hashes. */
  i32(v: number): this {
    const x = v | 0;
    return this.u((x >>> 16) & 0xffff, 16).u(x & 0xffff, 16);
  }

  toString(): string {
    return this.n ? this.out + ALPHABET[(this.acc << (6 - this.n)) & 63] : this.out;
  }
}

export class BitReader {
  private i = 0;
  private acc = 0;
  private n = 0;
  /** False once the stream ran out or carried a character outside the alphabet. */
  ok = true;

  constructor(private readonly src: string) {}

  u(bits: number): number {
    while (this.n < bits) {
      const c = this.i < this.src.length ? (VALUE[this.src.charCodeAt(this.i++)] ?? -1) : -1;
      if (c < 0) {
        this.ok = false;
        return 0;
      }
      this.acc = (this.acc << 6) | c;
      this.n += 6;
    }
    this.n -= bits;
    const v = (this.acc >>> this.n) & ((1 << bits) - 1);
    this.acc &= (1 << this.n) - 1;
    return v;
  }

  v(): number {
    let out = 0;
    let shift = 1;
    for (let g = 0; g < 11; g++) {
      const part = this.u(VAR_CHUNK + 1);
      if (!this.ok) return 0;
      out += (part & ((1 << VAR_CHUNK) - 1)) * shift;
      if (!(part & (1 << VAR_CHUNK))) return out;
      shift *= 1 << VAR_CHUNK;
    }
    this.ok = false;
    return 0;
  }

  s(): number {
    const z = this.v();
    return z & 1 ? -(z + 1) / 2 : z / 2;
  }

  i32(): number {
    const hi = this.u(16);
    return ((hi << 16) | this.u(16)) | 0;
  }

  /** True once every bit written has been read back (only the last character's padding is left). */
  get atEnd(): boolean {
    return this.i >= this.src.length && this.n < 6;
  }
}

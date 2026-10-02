import { packInput, unpackInput, type PackedInput } from './codec';
import { emptyState, type InputState } from '../input/PlayerInput';
import type { SlotCommand } from './commands';

/**
 * Every input the simulation has run, tick by tick, for every seat in the match.
 *
 * This is what makes a reconnect into a *running* match possible at all. A deterministic simulation
 * is a function of its seed and its inputs, so a peer that has both can rebuild any tick of it – no
 * snapshot of the world has to be serialised, no physics engine has to be persuaded to restore
 * itself byte for byte. That matters here in particular: Rapier can take snapshots, but restoring
 * one is documented as not bit-exact (its broad-phase tree is not part of the snapshot), so a
 * snapshot-based rejoin would desync exactly in the two games that use it.
 *
 * Stored as one flat `Int16Array` per match rather than objects per tick: five numbers per seat per
 * tick, so three minutes of an eight-player match is under a megabyte and stays one allocation.
 */
export const LOG_WIDTH = 5; // x, y, x2, y2, buttons – see PackedInput

export class InputLog {
  /** Seat indices, in the order they are laid out in each tick's row. */
  readonly slots: number[];
  private readonly stride: number;
  private data: Int16Array;
  private len = 0;
  /**
   * Game orders applied per tick (see commands.ts), only for ticks that had any. Kept apart from
   * the input rows: they are rare and of any shape, the rows are dense and all the same width.
   */
  private cmds = new Map<number, SlotCommand[]>();

  constructor(slots: number[], capacityTicks = 4096) {
    this.slots = [...slots].sort((a, b) => a - b);
    this.stride = this.slots.length * LOG_WIDTH;
    this.data = new Int16Array(this.stride * Math.max(1, capacityTicks));
  }

  /** Ticks recorded, i.e. the first tick this log does not know. */
  get length() {
    return this.len;
  }

  private grow(ticks: number) {
    if (this.stride * ticks <= this.data.length) return;
    let cap = Math.max(1, this.data.length / this.stride || 1);
    while (cap < ticks) cap *= 2;
    const next = new Int16Array(this.stride * cap);
    next.set(this.data);
    this.data = next;
  }

  /**
   * Record one tick. Ticks arrive in order while playing, but a replay fills gaps out of order, so
   * an arbitrary index is allowed – anything not written yet reads as neutral input.
   */
  put(tick: number, slot: number, p: PackedInput) {
    const k = this.slots.indexOf(slot);
    if (k < 0 || tick < 0) return;
    this.grow(tick + 1);
    const at = tick * this.stride + k * LOG_WIDTH;
    for (let i = 0; i < LOG_WIDTH; i++) this.data[at + i] = p[i]!;
    if (tick >= this.len) this.len = tick + 1;
  }

  putState(tick: number, slot: number, s: InputState) {
    this.put(tick, slot, packInput(s));
  }

  has(tick: number): boolean {
    return tick >= 0 && tick < this.len;
  }

  at(tick: number, slot: number): PackedInput | null {
    const k = this.slots.indexOf(slot);
    if (k < 0 || !this.has(tick)) return null;
    const at = tick * this.stride + k * LOG_WIDTH;
    return [this.data[at]!, this.data[at + 1]!, this.data[at + 2]!, this.data[at + 3]!, this.data[at + 4]!];
  }

  /** Record the orders applied at this tick (replaces what was there; an empty list clears it). */
  putCommands(tick: number, list: SlotCommand[]) {
    if (tick < 0) return;
    if (list.length) this.cmds.set(tick, list);
    else this.cmds.delete(tick);
  }

  commands(tick: number): SlotCommand[] {
    return this.cmds.get(tick) ?? [];
  }

  /**
   * The orders of `[from, to)` as `[tick, slot, orders]` entries, in chunks whose JSON stays under
   * `maxChars` – one seat's orders of one tick are never split (commands.ts caps those well below).
   */
  encodeCommands(from: number, to: number, maxChars: number): [tick: number, slot: number, cmds: unknown[]][][] {
    const chunks: [number, number, unknown[]][][] = [];
    let cur: [number, number, unknown[]][] = [];
    let size = 2;
    for (const tick of [...this.cmds.keys()].filter((t) => t >= from && t < to).sort((a, b) => a - b)) {
      const bySlot = new Map<number, unknown[]>();
      for (const { slot, cmd } of this.cmds.get(tick)!) {
        let l = bySlot.get(slot);
        if (!l) bySlot.set(slot, (l = []));
        l.push(cmd);
      }
      for (const [slot, list] of bySlot) {
        const entry: [number, number, unknown[]] = [tick, slot, list];
        const n = JSON.stringify(entry).length + 1;
        if (cur.length && size + n > maxChars) {
          chunks.push(cur);
          cur = [];
          size = 2;
        }
        cur.push(entry);
        size += n;
      }
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  /** Apply one chunk of `encodeCommands` (entries arrive seat by seat, in seat order). */
  decodeCommands(entries: [tick: number, slot: number, cmds: unknown[]][]) {
    for (const [tick, slot, list] of entries) {
      const had = this.cmds.get(tick)?.filter((c) => c.slot !== slot) ?? [];
      const next = [...had, ...list.map((cmd) => ({ slot, cmd }))].sort((a, b) => a.slot - b.slot);
      this.cmds.set(tick, next);
    }
  }

  state(tick: number, slot: number): InputState {
    const p = this.at(tick, slot);
    return p ? unpackInput(p) : emptyState();
  }

  /**
   * One seat's inputs for `[from, to)` as run-length pairs, base64.
   *
   * Run-length because a played input is extraordinarily repetitive – a finger on the accelerator is
   * the same five numbers sixty times a second – so a minute of driving usually collapses to a few
   * hundred runs. The worst case (an analogue stick that never rests) is a run per tick, which costs
   * one extra number per tick and still fits a relay frame at this range size.
   */
  encode(slot: number, from: number, to: number): string {
    const end = Math.min(to, this.len);
    const runs: number[] = [];
    let cur: PackedInput | null = null;
    let n = 0;
    const flush = () => {
      if (!cur) return;
      runs.push(n, ...cur);
      n = 0;
    };
    for (let t = Math.max(0, from); t < end; t++) {
      const p = this.at(t, slot)!;
      if (cur && n < 30000 && cur.every((v, i) => v === p[i])) {
        n++;
        continue;
      }
      flush();
      cur = p;
      n = 1;
    }
    flush();
    return toBase64(new Int16Array(runs));
  }

  /** Apply what `encode` produced. Returns the tick after the last one written. */
  decode(slot: number, from: number, b64: string): number {
    const runs = fromBase64(b64);
    let t = from;
    for (let i = 0; i + LOG_WIDTH < runs.length; i += LOG_WIDTH + 1) {
      const count = runs[i]!;
      const p: PackedInput = [runs[i + 1]!, runs[i + 2]!, runs[i + 3]!, runs[i + 4]!, runs[i + 5]!];
      for (let k = 0; k < count; k++) this.put(t++, slot, p);
    }
    return t;
  }
}

/** Int16Array ↔ base64. The relay carries JSON text, so the bytes have to travel as characters. */
export function toBase64(a: Int16Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  // in chunks: String.fromCharCode with a megabyte of arguments overflows the call stack
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}

export function fromBase64(b64: string): Int16Array {
  const s = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.length >> 1);
}

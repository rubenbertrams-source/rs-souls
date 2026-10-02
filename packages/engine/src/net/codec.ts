import { BUTTONS, emptyState, type InputState } from '../input/PlayerInput';
import { BitReader, BitWriter } from './bits';

/** Packed input: axes quantised to 1/1000 (ints), buttons as a bit mask. */
export type PackedInput = [x: number, y: number, x2: number, y2: number, mask: number];

const Q = 1000;
const q = (v: number) => Math.max(-Q, Math.min(Q, Math.round((Number.isFinite(v) ? v : 0) * Q)));

export function packInput(s: InputState): PackedInput {
  let mask = 0;
  for (let i = 0; i < BUTTONS.length; i++) if (s.buttons[BUTTONS[i]!]) mask |= 1 << i;
  return [q(s.x), q(s.y), q(s.x2), q(s.y2), mask];
}

export function unpackInput(p: PackedInput): InputState {
  const s = emptyState();
  s.x = (p[0] | 0) / Q;
  s.y = (p[1] | 0) / Q;
  s.x2 = (p[2] | 0) / Q;
  s.y2 = (p[3] | 0) / Q;
  const mask = p[4] | 0;
  for (let i = 0; i < BUTTONS.length; i++) s.buttons[BUTTONS[i]!] = (mask & (1 << i)) !== 0;
  return s;
}

/** Same rounding the wire applies – local and remote peers must simulate the identical state. */
export function quantizeInput(s: InputState): InputState {
  return unpackInput(packInput(s));
}

// ---- peer ↔ peer messages (carried as `d` inside relay `msg` frames) ----

export interface InputMessage {
  t: 'in';
  /** match id */
  m: number;
  tick: number;
  in: [slot: number, state: PackedInput][];
  /**
   * The last few frames this peer already sent, repeated for redundancy. A lost packet is then
   * covered by the next one instead of stalling everybody for a full round trip.
   */
  r?: [tick: number, inputs: [slot: number, state: PackedInput][]][];
  /**
   * How often this peer has had to wait for input so far. The receiver uses a rising number as a
   * request to capture further ahead: only the *sender's* delay can cure the *receiver's* stalls.
   */
  s?: number;
  /** Sender's current simulation tick (next to run) – for tick synchronisation. */
  k?: number;
  /** Sender's own estimate of how many ticks it runs ahead of us (see TimeSync). */
  a?: number;
  /** Ticks of *our* input the sender has buffered ahead of its simulation. */
  b?: number;
  /**
   * Game orders (commands.ts) for the ticks of this frame – `tick` and those in `r` – that have any.
   * A tick whose input is in here and that is missing from `c` had none, so a lost frame cannot lose
   * an order either: each repetition carries them again. Absent when there are none at all, which
   * leaves every frame of a game without orders exactly as it was.
   */
  c?: [tick: number, cmds: [slot: number, cmd: unknown][]][];
}
export interface HashMessage {
  t: 'hash';
  m: number;
  tick: number;
  h: number;
}
export type PeerMessage = InputMessage | HashMessage | { t: string; [k: string]: unknown };

export function encodeMessage(m: PeerMessage): string {
  return JSON.stringify(m);
}

export function decodeMessage(raw: unknown): PeerMessage | null {
  if (typeof raw !== 'string') return null;
  // The two wire forms are told apart by their first character: JSON objects start with '{', which
  // is not in the bit stream's alphabet. Nothing is guessed, and neither can be read as the other.
  if (raw.charCodeAt(0) !== 0x7b) return unpackMessage(raw);
  try {
    const m = JSON.parse(raw);
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
    return m as PeerMessage;
  } catch {
    return null;
  }
}

// ---- the bit-packed wire form of the two hot messages ----
//
// Input frames are the only thing sent sixty times a second, and as JSON they spend most of their
// bytes on field names and on digits for numbers that need eleven bits. Packed, an input message is
// roughly a quarter of the size; see tests/net.test.ts for the measured numbers.
//
// Only 'in' and 'hash' are packed. Everything else (lobby, start, resync) is rare, is shaped by the
// hub rather than by this file, and is far better off staying readable JSON.

/**
 * Format version, three bits in the first character.
 *
 * It is in there for one reason: a receiver must be able to *refuse* a message it would otherwise
 * mis-read. Every other kind of damage a wrong format could do is loud – a dropped frame stalls, a
 * malformed one is rejected by the shape guards – but a stream of bits read with the wrong field
 * widths yields plausible-looking axes, and a wrong axis is a silent desync. Three bits are free
 * (they share the first character with the message type), so the check costs nothing and the format
 * can be changed later without the next version having to guess what it is looking at.
 */
export const WIRE_VERSION = 1;
const T_INPUT = 0;
const T_HASH = 1;
/** Axis range after quantisation is -1000…1000 → 2001 values, offset by Q into 11 bits. */
const AXIS_BITS = 11;
/** One bit per button; taken from BUTTONS so the width follows the game, not a copied constant. */
const MASK_BITS = BUTTONS.length;
const SLOT_BITS = 4;
const COUNT_BITS = 4;
const MAX_ENTRIES = (1 << COUNT_BITS) - 1;

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isInt32 = (v: unknown): v is number => isInt(v) && v === ((v as number) | 0);

/** Can this list be written bit for bit? Anything outside the field widths falls back to JSON. */
function listPackable(list: [number, PackedInput][]): boolean {
  if (list.length > MAX_ENTRIES) return false;
  for (const [slot, p] of list) {
    if (!isInt(slot) || slot < 0 || slot >= 1 << SLOT_BITS) return false;
    if (!Array.isArray(p) || p.length !== 5) return false;
    for (let i = 0; i < 4; i++) if (!isInt(p[i]) || Math.abs(p[i]!) > Q) return false;
    if (!isInt(p[4]) || p[4]! < 0 || p[4]! >= 1 << MASK_BITS) return false;
  }
  return true;
}

function writeList(w: BitWriter, list: [number, PackedInput][]) {
  w.u(list.length, COUNT_BITS);
  for (const [slot, p] of list) {
    w.u(slot, SLOT_BITS);
    // An axis at rest is the common case by a wide margin (two sticks, four axes, and most games
    // read two of them), so a resting axis costs one bit instead of eleven. `-0` becomes `0` on the
    // way, exactly as JSON.stringify already did, and unpackInput reads both as the same 0.
    for (let i = 0; i < 4; i++) {
      const v = p[i]!;
      if (v === 0) w.u(0, 1);
      else w.u(1, 1).u(v + Q, AXIS_BITS);
    }
    w.u(p[4]!, MASK_BITS);
  }
}

function readList(r: BitReader): [number, PackedInput][] {
  const n = r.u(COUNT_BITS);
  const list: [number, PackedInput][] = [];
  for (let i = 0; i < n && r.ok; i++) {
    const slot = r.u(SLOT_BITS);
    const p: PackedInput = [0, 0, 0, 0, 0];
    for (let k = 0; k < 4; k++) p[k] = r.u(1) ? r.u(AXIS_BITS) - Q : 0;
    p[4] = r.u(MASK_BITS);
    list.push([slot, p]);
  }
  return list;
}

/**
 * The bit-packed form of an input or hash message, or null for anything else – including a message
 * whose numbers do not fit the fields exactly. "Not exactly" always means JSON here: the packed form
 * is a different spelling of the same message, never a rounded one, because the receiver simulates
 * from these numbers and a value that survived the trip only approximately is a desync.
 */
export function packMessage(m: PeerMessage): string | null {
  if (isInputMessage(m)) {
    // orders are rare and of any shape: a frame that carries some goes as JSON, in one piece
    if (m.c !== undefined) return null;
    if (!isInt32(m.m) || !isInt(m.tick) || m.tick < 0 || !listPackable(m.in)) return null;
    const red = m.r ?? [];
    if (red.length > MAX_ENTRIES) return null;
    for (const [tick, list] of red) if (!isInt(tick) || !listPackable(list)) return null;
    const opt: [number, boolean][] = [
      [m.s ?? 0, m.s !== undefined],
      [m.k ?? 0, m.k !== undefined],
      [m.a ?? 0, m.a !== undefined],
      [m.b ?? 0, m.b !== undefined],
    ];
    for (const [v, present] of opt) if (present && !isInt(v)) return null;
    const w = new BitWriter();
    w.u(WIRE_VERSION, 3).u(T_INPUT, 2);
    w.i32(m.m).v(m.tick);
    writeList(w, m.in);
    w.u(red.length, COUNT_BITS);
    for (const [tick, list] of red) {
      // the repeated frames sit a handful of ticks behind this one, so the distance is what travels
      w.s(m.tick - tick);
      writeList(w, list);
    }
    let flags = 0;
    for (let i = 0; i < 4; i++) if (opt[i]![1]) flags |= 1 << i;
    w.u(flags, 4);
    if (opt[0]![1]) w.v(opt[0]![0]);
    if (opt[1]![1]) w.s(m.tick - opt[1]![0]); // sender tick: one input delay behind `tick`
    if (opt[2]![1]) w.s(opt[2]![0]);
    if (opt[3]![1]) w.v(opt[3]![0]);
    return w.toString();
  }
  if (isHashMessage(m)) {
    if (!isInt32(m.m) || !isInt(m.tick) || m.tick < 0 || !isInt(m.h) || m.h < 0 || m.h > 0xffffffff) return null;
    const w = new BitWriter();
    w.u(WIRE_VERSION, 3).u(T_HASH, 2);
    return w.i32(m.m).v(m.tick).i32(m.h).toString();
  }
  return null;
}

/** Read back what `packMessage` wrote. Returns null for anything that is not exactly that. */
export function unpackMessage(raw: string): InputMessage | HashMessage | null {
  if (!raw) return null;
  const r = new BitReader(raw);
  if (r.u(3) !== WIRE_VERSION) return null;
  const type = r.u(2);
  if (!r.ok) return null;
  if (type === T_HASH) {
    const m = r.i32();
    const tick = r.v();
    const h = r.i32() >>> 0;
    return r.ok && r.atEnd ? { t: 'hash', m, tick, h } : null;
  }
  if (type !== T_INPUT) return null;
  const m = r.i32();
  const tick = r.v();
  const list = readList(r);
  const rn = r.u(COUNT_BITS);
  const red: [number, [number, PackedInput][]][] = [];
  for (let i = 0; i < rn && r.ok; i++) {
    const at = tick - r.s();
    red.push([at, readList(r)]);
  }
  const flags = r.u(4);
  const msg: InputMessage = { t: 'in', m, tick, in: list };
  if (flags & 1) msg.s = r.v();
  if (flags & 2) msg.k = tick - r.s();
  if (flags & 4) msg.a = r.s();
  if (flags & 8) msg.b = r.v();
  if (rn) msg.r = red;
  // `atEnd` is part of the check: a stream that still has whole characters left was not written by
  // this version of the encoder, whatever its version bits claimed.
  return r.ok && r.atEnd ? msg : null;
}

/** Type guard for input frames (shape-checked because the data crosses the network). */
export function isInputMessage(m: PeerMessage): m is InputMessage {
  if (m.t !== 'in') return false;
  const tick = (m as { tick?: unknown }).tick;
  const list = (m as { in?: unknown }).in;
  return Number.isInteger(tick) && typeof (m as { m?: unknown }).m === 'number' && Array.isArray(list) && list.every((e) => Array.isArray(e) && Number.isInteger(e[0]) && Array.isArray(e[1]) && e[1].length === 5);
}

export function isHashMessage(m: PeerMessage): m is HashMessage {
  return m.t === 'hash' && Number.isInteger((m as { tick?: unknown }).tick) && typeof (m as { h?: unknown }).h === 'number' && typeof (m as { m?: unknown }).m === 'number';
}

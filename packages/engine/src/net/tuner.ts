/**
 * Input-delay regulation for the lockstep, kept free of timers and globals so it can be unit-tested
 * with an explicit clock.
 *
 * What the delay has to cover: the input for tick `T + delay` leaves after tick `T` and must be at the
 * receiver before it simulates `T + delay`. That is one relay hop each way (the full round trip is the
 * safe estimate) plus the once-per-frame receive poll – hence RTT + jitter, converted to ticks, plus one.
 *
 * Two lessons from the first version:
 * - Our *own* stalls are no reason to raise our *own* delay. Our delay only fills the peer's buffer;
 *   the peer's delay fills ours. Peers report their stall counter (`s`) and buffer depth (`b`), and
 *   only those drive the pressure rule here.
 * - Lowering must be evidence-based and steady: one tick per second while the peer's buffer stays
 *   comfortable, instead of a rare halving that left the delay parked near the maximum.
 */

export const MIN_DELAY = 4;
export const MAX_DELAY = 20;
export const TICK_MS = 1000 / 60;
/** Stalls right after the start barrier are loading noise, not link quality. */
export const START_GRACE_MS = 2000;
/** How long a reported peer stall keeps the pressure on. */
export const PRESSURE_WINDOW_MS = 1500;
/** Pressure raises at most one tick per interval (a stall episode therefore costs +1…+3). */
export const RAISE_INTERVAL_MS = 500;
/** Lowering steps one tick per interval. */
export const LOWER_INTERVAL_MS = 1000;
/** While the delay sits far above what the link needs (a loading hitch), it comes down twice as fast. */
export const FAST_LOWER_EXCESS = 3;
/** The peer's buffer must have stayed at or above this for the whole window before we lower. */
export const BUFFER_WINDOW_MS = 2000;
export const LOWER_MIN_PEER_BUFFER = 2;
/**
 * A level reached through stall pressure is remembered: the delay does not drop below it again for
 * a while, otherwise it oscillates between "too low → stalls → up" and "quiet → down" forever. The
 * remembered floor relaxes one tick per STALL_FLOOR_DECAY_MS.
 */
export const STALL_FLOOR_DECAY_MS = 4000;
/** Samples the lobby must have collected before its estimate seeds the start delay. */
export const START_MIN_SAMPLES = 6;
/** A start delay never exceeds this: the first pongs carry page-load noise, the tuner fixes the rest. */
export const START_MAX_DELAY = 10;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class DelayTuner {
  private startedAt = -Infinity;
  private lastPeerStall = -Infinity;
  private lastRaise = -Infinity;
  private lastChange = -Infinity;
  /** Recent peer buffer reports [time, depth]. */
  private buffers: [number, number][] = [];
  private stallFloor = MIN_DELAY;
  private stallFloorAt = -Infinity;

  /** Ticks of delay the measured link asks for (median RTT + 2× its p90 spread, plus one tick of slack). */
  static wantFromRtt(srtt: number, rttvar: number): number {
    if (!(srtt > 0)) return MIN_DELAY;
    return clamp(Math.ceil((srtt + 2 * rttvar) / TICK_MS) + 1, MIN_DELAY, MAX_DELAY);
  }

  /** Delay to start a match with, from `samples` lobby pings (falls back to `fallback` with too few). */
  static startDelay(samples: number, srtt: number, rttvar: number, fallback: number): number {
    if (samples < START_MIN_SAMPLES) return fallback;
    return Math.min(START_MAX_DELAY, DelayTuner.wantFromRtt(srtt, rttvar));
  }

  reset() {
    this.startedAt = -Infinity;
    this.lastPeerStall = -Infinity;
    this.lastRaise = -Infinity;
    this.lastChange = -Infinity;
    this.buffers = [];
    this.stallFloor = MIN_DELAY;
    this.stallFloorAt = -Infinity;
  }

  /** The start barrier released the simulation. */
  matchStarted(now: number) {
    this.startedAt = now;
    this.lastChange = now;
  }

  /** A peer's stall counter rose. */
  peerStalled(now: number) {
    this.lastPeerStall = now;
  }

  /** A peer reported how many ticks of *our* input it has buffered. */
  peerBuffer(now: number, depth: number) {
    this.buffers.push([now, depth]);
    while (this.buffers.length && this.buffers[0]![0] < now - BUFFER_WINDOW_MS) this.buffers.shift();
  }

  /** Smallest peer buffer reported inside the window; -1 when there is no report yet. */
  minPeerBuffer(now: number): number {
    let min = Infinity;
    for (const [t, d] of this.buffers) if (t >= now - BUFFER_WINDOW_MS) min = Math.min(min, d);
    return Number.isFinite(min) ? min : -1;
  }

  /** True while a recent peer stall (after the start grace) asks for more delay. */
  pressure(now: number): boolean {
    return now - this.lastPeerStall < PRESSURE_WINDOW_MS && this.lastPeerStall - this.startedAt >= START_GRACE_MS;
  }

  /** Lowest level the delay may currently fall to (a level learned from stalls, relaxing over time). */
  floor(now: number): number {
    const relaxed = Math.floor((now - this.stallFloorAt) / STALL_FLOOR_DECAY_MS);
    return Math.max(MIN_DELAY, this.stallFloor - Math.max(0, relaxed));
  }

  /** The delay to use from now on; call on every RTT sample. */
  next(now: number, delay: number, srtt: number, rttvar: number): number {
    let want = DelayTuner.wantFromRtt(srtt, rttvar);
    const pressure = this.pressure(now);
    if (pressure && now - this.lastRaise >= RAISE_INTERVAL_MS) {
      want = Math.max(want, Math.min(MAX_DELAY, delay + 1));
      this.stallFloor = want;
      this.stallFloorAt = now;
    }
    if (want > delay) {
      this.lastRaise = now;
      this.lastChange = now;
      return want;
    }
    const target = Math.max(want, this.floor(now));
    const interval = delay - target > FAST_LOWER_EXCESS ? LOWER_INTERVAL_MS / 2 : LOWER_INTERVAL_MS;
    if (
      !pressure &&
      target < delay &&
      now - this.lastChange >= interval &&
      now - this.startedAt >= START_GRACE_MS &&
      this.minPeerBuffer(now) >= LOWER_MIN_PEER_BUFFER
    ) {
      this.lastChange = now;
      return delay - 1;
    }
    return delay;
  }
}

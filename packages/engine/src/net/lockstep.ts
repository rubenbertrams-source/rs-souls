import { emptyState, type InputState } from '../input/PlayerInput';
import { quantizeInput } from './codec';
import { sortCommands, type SlotCommand } from './commands';

/**
 * Deterministic lockstep with a fixed input delay.
 *
 * Every tick each peer captures its local slots' input for tick `now + delay`, sends it, and simulates
 * tick `now` only once inputs for ALL required slots (local and remote) are present. The first `delay`
 * ticks are pre-filled with neutral input so nobody waits at the start.
 */
export class Lockstep {
  /** Next tick to simulate. */
  tick = 0;
  private delayValue: number;
  readonly local: number[];
  readonly remote: number[];
  private frames = new Map<number, Map<number, InputState>>();
  private last = new Map<number, InputState>();
  /** Game orders per tick and seat (see commands.ts). A seat with input and no entry gave none. */
  private cmds = new Map<number, Map<number, unknown[]>>();
  /**
   * Slots whose owner is not sending any more, and the first tick that is true for.
   *
   * Both halves matter. *That* a slot is unattended is not enough – every peer has to stop
   * requiring its input at the **same tick**, or two peers simulate different things for the ticks
   * in between and the match quietly desyncs. The tick therefore comes from one announcement that
   * everybody applies, never from the moment each peer happened to notice.
   */
  private away = new Map<number, number>();

  /** Ticks between capturing a local input and simulating it. */
  get delay() {
    return this.delayValue;
  }

  constructor(opts: { local: number[]; remote: number[]; delay?: number }) {
    this.delayValue = Math.max(0, Math.floor(opts.delay ?? 3));
    this.local = [...opts.local];
    this.remote = [...opts.remote];
    // everybody agrees on neutral input for the first `delay` ticks – nothing has to travel before tick 0 runs
    for (let t = 0; t < this.delay; t++) for (const s of this.required) this.put(t, s, emptyState());
  }

  get required(): number[] {
    return [...this.local, ...this.remote];
  }

  private put(tick: number, slot: number, state: InputState) {
    let f = this.frames.get(tick);
    if (!f) this.frames.set(tick, (f = new Map()));
    f.set(slot, state);
    this.last.set(slot, state);
  }

  /**
   * Record a local slot's fresh device state for `tick + delay`. Returns the state to send (for that
   * future tick) and the state to simulate now (already quantised like the wire so every peer computes
   * the same numbers). Calling it twice in one tick for the same slot keeps the first capture.
   */
  localInput(slot: number, fresh: InputState): { send: InputState; now: InputState } {
    const target = this.tick + this.delay;
    let send = this.frames.get(target)?.get(slot);
    if (!send) this.put(target, slot, (send = quantizeInput(fresh)));
    return { send, now: this.inputFor(this.tick, slot) };
  }

  /**
   * Input from another peer for a future (or the current) tick; stale ticks are ignored.
   *
   * Input from at or after the tick a slot was declared unattended is dropped too: a packet that
   * was already in flight when the announcement was made must not be simulated by the one peer
   * that happened to receive it.
   */
  remoteInput(tick: number, slot: number, state: InputState) {
    if (tick < this.tick) return;
    const from = this.away.get(slot);
    if (from !== undefined && tick >= from) return;
    this.put(tick, slot, state);
  }

  /**
   * A seat's orders for one tick – its own, or ones that arrived with that seat's input frame.
   * Same rules as `remoteInput`: nothing for a tick already run or past the seat's cut. The list is
   * the whole list for that tick, so a repeated frame sets the same thing again instead of adding.
   */
  putCommands(tick: number, slot: number, list: unknown[]) {
    if (tick < this.tick) return;
    const from = this.away.get(slot);
    if (from !== undefined && tick >= from) return;
    let f = this.cmds.get(tick);
    if (!f) this.cmds.set(tick, (f = new Map()));
    if (list.length) f.set(slot, list);
    else f.delete(slot);
  }

  /** Orders the replay says were applied for this tick; replaces whatever is stored. */
  replayCommands(tick: number, list: SlotCommand[]) {
    const f = new Map<number, unknown[]>();
    for (const { slot, cmd } of list) {
      let l = f.get(slot);
      if (!l) f.set(slot, (l = []));
      l.push(cmd);
    }
    this.cmds.set(tick, f);
  }

  /**
   * The orders to apply at this tick: by seat, then in the order given. An unattended seat gives
   * none, exactly like its input is neutral – also one whose orders this peer happened to receive.
   */
  commandsFor(tick: number): SlotCommand[] {
    const f = this.cmds.get(tick);
    if (!f?.size) return [];
    return sortCommands(new Map([...f].filter(([slot]) => !this.isAway(slot, tick))));
  }

  /**
   * Raise the input delay while the match runs (the connection got worse).
   *
   * Raising it leaves a hole: captures jump from `tick + old` straight to `tick + new`, and the
   * ticks in between would never be filled, so everyone would wait forever. The gap is therefore
   * filled here with the last known local input, and the caller must send those frames on.
   * Lowering the delay needs no such care – those ticks already carry input – so it is applied
   * directly. Peers may run different delays: a larger one only means the sender is further ahead.
   */
  raiseDelay(next: number): { tick: number; slot: number; state: InputState }[] {
    const want = Math.max(0, Math.floor(next));
    if (want === this.delayValue) return [];
    const out: { tick: number; slot: number; state: InputState }[] = [];
    if (want > this.delayValue) {
      // start at `tick + old delay`, not one past it: right after the constructor's pre-fill the
      // tick at exactly that offset has not been captured yet, and skipping it left a permanent
      // hole that stalled every peer. Ticks that already carry input are skipped below anyway.
      for (let t = this.tick + this.delayValue; t <= this.tick + want; t++) {
        for (const s of this.local) {
          if (this.frames.get(t)?.has(s)) continue;
          const state = this.last.get(s) ?? emptyState();
          this.put(t, s, state);
          out.push({ tick: t, slot: s, state });
        }
      }
    }
    this.delayValue = want;
    return out;
  }

  /** How many ticks of future input are buffered for the slot that is furthest behind. */
  bufferDepth(): number {
    let min = Infinity;
    for (const s of this.required) {
      if (this.isAway(s)) continue;
      let d = -1;
      for (let t = this.tick; t < this.tick + 60; t++) {
        if (!this.frames.get(t)?.has(s)) break;
        d = t - this.tick;
      }
      min = Math.min(min, d);
    }
    return Number.isFinite(min) ? min : 0;
  }

  /**
   * Local inputs already captured for the ticks after the current one (`tick + 1 … tick + delay`).
   * A renderer can run the local player's own physics ahead with these so the player's controls
   * respond at once while the simulation itself stays in lockstep.
   */
  pendingLocal(slot: number): InputState[] {
    const out: InputState[] = [];
    for (let t = this.tick + 1; t <= this.tick + this.delay; t++) {
      const s = this.frames.get(t)?.get(slot);
      if (!s) break;
      out.push(s);
    }
    return out;
  }

  /**
   * Nobody is driving this slot from `fromTick` on. Announced once and applied by every peer, so the
   * changeover happens on the same tick everywhere.
   *
   * Input already stored for that tick and later is thrown away – whoever received one more packet
   * than the others must not act on it. An announcement can only ever be applied for a tick that is
   * still ahead: a peer stalls on a missing input, so it cannot have run past the cut.
   */
  setAway(slot: number, fromTick: number) {
    const had = this.away.get(slot);
    if (had !== undefined && had <= fromTick) return;
    this.away.set(slot, fromTick);
    for (const [t, f] of this.frames) if (t >= fromTick) f.delete(slot);
    for (const [t, f] of this.cmds) if (t >= fromTick) f.delete(slot);
  }

  /**
   * The slot is being driven again from `fromTick` on – its player came back and caught up.
   *
   * Announced by the returning peer and applied by everybody, exactly like the cut that made it
   * unattended: the tick both sides start requiring input again has to be one number, not two.
   */
  setLive(slot: number, fromTick: number) {
    const from = this.away.get(slot);
    if (from === undefined || fromTick <= from) return;
    this.away.delete(slot);
    this.backAt.set(slot, fromTick);
  }

  /** Neutral again for the ticks a slot spent unattended, even after its player is back. */
  private backAt = new Map<number, number>();

  /** Input the replay says was simulated for this tick. Overwrites whatever is stored. */
  replayInput(tick: number, slot: number, state: InputState) {
    this.put(tick, slot, state);
  }

  /** First tick from which this slot has nobody driving it, or undefined while it is played. */
  awayFrom(slot: number): number | undefined {
    return this.away.get(slot);
  }

  isAway(slot: number, tick = this.tick): boolean {
    const from = this.away.get(slot);
    if (from !== undefined) return tick >= from;
    // a seat whose player came back is still unattended for the stretch they were gone – those
    // ticks were simulated with neutral input by everybody and must stay that way in a replay
    const back = this.backAt.get(slot);
    return back !== undefined && tick < back;
  }

  has(tick: number, slot: number): boolean {
    return this.isAway(slot, tick) || !!this.frames.get(tick)?.has(slot);
  }

  /** True when every required slot has input for the next tick. */
  canStep(): boolean {
    for (const s of this.required) if (!this.has(this.tick, s)) return false;
    return true;
  }

  /** Which slots block the next tick (diagnostics). */
  missing(): number[] {
    return this.required.filter((s) => !this.has(this.tick, s));
  }

  /**
   * Input to simulate. An unattended slot gets **neutral** input, not its owner's last one: repeating
   * the last frame means a kart that was accelerating drives on at full throttle into the first wall,
   * which reads as a player behaving strangely rather than as a player who is not there.
   */
  inputFor(tick: number, slot: number): InputState {
    if (this.isAway(slot, tick)) return emptyState();
    return this.frames.get(tick)?.get(slot) ?? emptyState();
  }

  /** Consume the current tick; frames older than one tick are dropped. */
  advance() {
    this.frames.delete(this.tick - 1);
    this.cmds.delete(this.tick - 1);
    this.tick++;
  }
}

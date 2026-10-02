import { BUTTONS, emptyState, type Button, type InputState } from './PlayerInput';

/**
 * A touch surface behaving like a gamepad.
 *
 * It is deliberately nothing but a mutable `InputState` with a name: the same class gathers the
 * touches on the phone that acts as a controller **and** holds the state that arrived from one on
 * the machine that runs the game. Both ends therefore agree on what a button is, and the value that
 * travels between them is the one `InputManager` would have read from a gamepad.
 *
 * There is no timing in here at all – no smoothing, no repeat, no wall clock. A phone's packet lands
 * whenever it lands and is read by the next `poll()`, exactly like a stick that was moved between
 * two ticks; from there it goes through the ordinary lockstep path (quantised in `net/codec.ts`,
 * delayed in `net/lockstep.ts`) and every peer simulates the same numbers. Anything that reacted to
 * the arrival *time* of a packet would be a wall clock inside the input chain and would desync.
 */
export class TouchInput {
  /** Label for the lobby seat ("Handy 1"). */
  label: string;
  private state = emptyState();
  /** True since the last `take()`; lets a sender skip packets for a state nobody changed. */
  private changed = true;
  /**
   * How often the state has been read. The device side uses it to hold a tap until it has been
   * seen at least once – a press that went down and up between two reads never happened, and how
   * long that gap is depends on the frame rate, not on any number of milliseconds.
   */
  reads = 0;

  constructor(
    readonly id: string,
    label = 'Handy',
  ) {
    this.label = label;
  }

  /**
   * Device-facing read, the shape `InputManager` expects.
   *
   * A **copy**, and that is not tidiness. `InputManager.poll` keeps the last state it read from each
   * device to work out which buttons are new (`wasHeld`, which is what makes join-in and every
   * `pressed` edge work). Handing out the live object would mean it kept a reference to a thing that
   * goes on changing, so "was it held last time" would answer with what is true *now* and no button
   * would ever count as newly pressed. The keyboard and gamepad devices build a fresh state per read
   * for the same reason.
   */
  read(): InputState {
    this.reads++;
    const s = this.state;
    return { x: s.x, y: s.y, x2: s.x2, y2: s.y2, buttons: { ...s.buttons } };
  }

  setButton(b: Button, down: boolean) {
    if (this.state.buttons[b] === down) return;
    this.state.buttons[b] = down;
    this.changed = true;
  }

  /** Stick position, -1..1. The d-pad buttons stay untouched; `PlayerInput.commit` merges both. */
  setAxes(x: number, y: number) {
    const cx = clamp(x);
    const cy = clamp(y);
    if (this.state.x === cx && this.state.y === cy) return;
    this.state.x = cx;
    this.state.y = cy;
    this.changed = true;
  }

  setAim(x2: number, y2: number) {
    const cx = clamp(x2);
    const cy = clamp(y2);
    if (this.state.x2 === cx && this.state.y2 === cy) return;
    this.state.x2 = cx;
    this.state.y2 = cy;
    this.changed = true;
  }

  /** Take a whole state over (the receiving end: this is what came off the wire). */
  setState(s: InputState) {
    this.state.x = clamp(s.x);
    this.state.y = clamp(s.y);
    this.state.x2 = clamp(s.x2);
    this.state.y2 = clamp(s.y2);
    for (const b of BUTTONS) this.state.buttons[b] = !!s.buttons[b];
    this.changed = true;
  }

  /**
   * Everything let go of.
   *
   * This is what a seat gets when its phone stops talking – neutral, never the last state. A
   * repeated full throttle drives into the wall, which is the same reason `Lockstep` gives an
   * unattended seat neutral input rather than its last one.
   */
  clear() {
    this.state = emptyState();
    this.changed = true;
  }

  /** True if anything moved since the last call; resets the flag. */
  take(): boolean {
    const c = this.changed;
    this.changed = false;
    return c;
  }
}

function clamp(v: number) {
  return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}

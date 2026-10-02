export const BUTTONS = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'select', 'up', 'down', 'left', 'right'] as const;
export type Button = (typeof BUTTONS)[number];

export interface InputState {
  x: number;
  y: number;
  /** Right stick / secondary axes (aiming). 0 when the device has none. */
  x2: number;
  y2: number;
  buttons: Record<Button, boolean>;
}

export function emptyState(): InputState {
  const buttons = {} as Record<Button, boolean>;
  for (const b of BUTTONS) buttons[b] = false;
  return { x: 0, y: 0, x2: 0, y2: 0, buttons };
}

/**
 * Two devices on one seat, read as one gamepad.
 *
 * The larger deflection wins per axis and a button is down if either device has it down. That is
 * the same rule `InputManager.poll` already applies when it merges every device into the menu's
 * `ui` input, and it has to be the same one: a seat driven by a phone *and* the keyboard it was
 * handed over from must feel like one controller, not like two taking turns.
 *
 * Not commutative in one respect, and deliberately so: on an exact tie the *second* argument wins,
 * so the caller decides who breaks it. `poll` passes the seat's own device first and the phone
 * second, because the phone is the one somebody deliberately picked up.
 */
export function mergeStates(a: InputState, b: InputState): InputState {
  const buttons = {} as Record<Button, boolean>;
  for (const btn of BUTTONS) buttons[btn] = a.buttons[btn] || b.buttons[btn];
  return {
    x: Math.abs(b.x) >= Math.abs(a.x) ? b.x : a.x,
    y: Math.abs(b.y) >= Math.abs(a.y) ? b.y : a.y,
    x2: Math.abs(b.x2) >= Math.abs(a.x2) ? b.x2 : a.x2,
    y2: Math.abs(b.y2) >= Math.abs(a.y2) ? b.y2 : a.y2,
    buttons,
  };
}

/**
 * Per-player abstract gamepad. Devices (keyboard/gamepad/CPU/phone) write into `next`,
 * `commit()` turns it into held/pressed/released for one simulation tick.
 */
export class PlayerInput {
  /** Analog axes, -1..1 (x right, y forward/up). */
  x = 0;
  y = 0;
  x2 = 0;
  y2 = 0;
  held = emptyState().buttons;
  pressed = emptyState().buttons;
  released = emptyState().buttons;
  /** Device label for UI, e.g. "Tastatur 1", "Gamepad 2", "CPU". */
  label = '';
  /** Pending state written by the device. */
  next: InputState = emptyState();
  /** Optional haptics. */
  vibrate: (ms: number, strength?: number) => void = () => {};

  commit() {
    this.x = this.next.x;
    this.y = this.next.y;
    this.x2 = this.next.x2;
    this.y2 = this.next.y2;
    for (const b of BUTTONS) {
      const now = this.next.buttons[b];
      const was = this.held[b];
      this.pressed[b] = now && !was;
      this.released[b] = !now && was;
      this.held[b] = now;
    }
    // digital d-pad merged into axes
    if (this.next.buttons.left) this.x = Math.min(this.x, -1);
    if (this.next.buttons.right) this.x = Math.max(this.x, 1);
    if (this.next.buttons.up) this.y = Math.max(this.y, 1);
    if (this.next.buttons.down) this.y = Math.min(this.y, -1);
  }

  /** For CPU / scripted control: set full state for the next tick. */
  set(partial: Partial<InputState['buttons']> & { x?: number; y?: number }) {
    const { x, y, ...rest } = partial;
    const btn = rest as Partial<Record<Button, boolean>>;
    if (x !== undefined) this.next.x = x;
    if (y !== undefined) this.next.y = y;
    for (const k of Object.keys(btn) as Button[]) this.next.buttons[k] = !!btn[k];
  }

  clear() {
    this.next = emptyState();
    this.commit();
    this.commit();
  }

  /** Menu-style navigation with repeat: returns 'up'/'down'/'left'/'right' once per press or on repeat. */
  anyPressed(): boolean {
    for (const b of BUTTONS) if (this.pressed[b]) return true;
    return false;
  }
}

/**
 * Human-readable name for a key code, e.g. "KeyW" → "W", "ArrowLeft" → "←".
 *
 * Lives here rather than in the hub because the in-game HUDs need it too: a prompt that says "Y"
 * is a lie on a keyboard, and on a German layout it is a lie that points at the *wrong physical
 * key* – the one labelled Y there reports `KeyZ`, which this project binds to the left nudge.
 */
export function keyName(code: string, locale: 'de' | 'en' = 'de'): string {
  const named: Record<string, Record<string, string>> = {
    Space: { de: 'Leertaste', en: 'Space' },
    ShiftLeft: { de: 'Shift links', en: 'Left shift' },
    ShiftRight: { de: 'Shift rechts', en: 'Right shift' },
    ControlLeft: { de: 'Strg links', en: 'Left ctrl' },
    ControlRight: { de: 'Strg rechts', en: 'Right ctrl' },
    Mouse0: { de: 'Linksklick', en: 'Left click' },
    Mouse1: { de: 'Mittelklick', en: 'Middle click' },
    Mouse2: { de: 'Rechtsklick', en: 'Right click' },
  };
  if (named[code]) return named[code]![locale]!;
  if (code.startsWith('Mouse')) return `${locale === 'de' ? 'Maustaste' : 'Mouse button'} ${Number(code.slice(5)) + 1}`;
  const map: Record<string, string> = {
    Enter: '⏎', NumpadEnter: '⏎ (Num)', Escape: 'Esc', Tab: 'Tab',
    Backspace: '⌫', Backslash: '\\', Slash: '/', Minus: '-', Period: '.', Comma: ',',
    AltLeft: 'Alt', AltRight: 'AltGr', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  if (map[code]) return map[code]!;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/**
 * Very short key name for a HUD chip, where there is room for a word and no more.
 *
 * The side of a modifier is dropped rather than the modifier itself: "Left shift" has to shrink to
 * "Shift", never to "Left", which would read as a direction.
 */
export function shortKeyName(code: string, locale: 'de' | 'en' = 'de'): string {
  const short: Record<string, string> = {
    Space: locale === 'de' ? 'Leer' : 'Space',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Strg', ControlRight: 'Strg',
    Mouse0: locale === 'de' ? 'L-Klick' : 'L-click', Mouse2: locale === 'de' ? 'R-Klick' : 'R-click',
  };
  if (locale === 'en') { short.ControlLeft = 'Ctrl'; short.ControlRight = 'Ctrl'; }
  return short[code] ?? keyName(code, locale);
}

/** Gamepad face-button captions, for the same prompts on a pad. */
export const PAD_LABEL: Record<Button, string> = {
  a: 'A', b: 'B', x: 'X', y: 'Y', l: 'LB', r: 'RB',
  start: 'Start', select: 'Back', up: '↑', down: '↓', left: '←', right: '→',
};

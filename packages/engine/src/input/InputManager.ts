import { BUTTONS, PAD_LABEL, PlayerInput, emptyState, mergeStates, shortKeyName, type InputState, type Button } from './PlayerInput';
import { TouchInput } from './TouchInput';

export interface KeyboardLayout {
  name: string;
  keys: Partial<Record<Button, string[]>>;
  /** This layout aims with the mouse and fires/blocks with the mouse buttons. */
  mouse?: boolean;
}

/** Stored overrides: layout index → button → key codes. Empty array = action unbound. */
export type KeyBindings = Record<string, Partial<Record<Button, string[]>>>;

/** Factory defaults. Two players can share one keyboard; `layouts` below is the editable copy. */
export const KEYBOARD_LAYOUTS: KeyboardLayout[] = [
  {
    name: 'Tastatur 1 (WASD)',
    keys: {
      up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
      // Stick-Fight-style extras: V blocks (B), F throws (L) – bound here so they travel through PlayerInput (lockstep-safe)
      a: ['Space'], b: ['ShiftLeft', 'KeyV'], x: ['KeyE'], y: ['KeyQ'], l: ['KeyZ', 'KeyY', 'KeyF'], r: ['KeyC'],
      start: ['Tab'], select: ['KeyR'],
    },
    mouse: true,
  },
  {
    name: 'Tastatur 2 (Pfeile)',
    keys: {
      up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      a: ['Enter', 'NumpadEnter'], b: ['ShiftRight'], x: ['Slash', 'Minus'], y: ['Period'], l: ['Comma'], r: ['Numpad0'],
      start: ['Backspace'], select: ['Backslash'],
    },
  },
  /**
   * A third couch player on the same keyboard: the IJKL block with its neighbours, chosen so that
   * no key collides with the two layouts above (`conflicts()` stays quiet).
   *
   * There is deliberately no fourth keyboard layout. Three pairs of hands on one keyboard is
   * already the physical limit, and most keyboards drop keys once six or seven are held at once –
   * players five to eight belong on gamepads or on their own machine.
   */
  {
    name: 'Tastatur 3 (IJKL)',
    keys: {
      up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'],
      a: ['KeyN'], b: ['KeyM'], x: ['KeyO'], y: ['KeyP'], l: ['KeyU'], r: ['KeyH'],
      start: ['KeyT'], select: ['KeyG'],
    },
  },
];

/**
 * 'touch' is a phone held by somebody in the room: a device of this machine, exactly like a pad
 * plugged into it, that happens to reach it over the relay instead of over USB. It is *not*
 * 'remote' – that one is another peer's seat, whose state arrives already simulated per tick.
 */
type DeviceKind = 'keyboard' | 'gamepad' | 'remote' | 'touch';

/**
 * Lockstep interceptor (online play): sees the fresh device state of a local slot each tick and returns
 * the state that is actually committed this tick (the one buffered `delay` ticks ago).
 */
export interface LockstepHook {
  local(slot: number, fresh: InputState): InputState;
  /** Local inputs already captured for the ticks after the current one (for render-side prediction). */
  pendingLocal?(slot: number): InputState[];
}

/** Screen position (CSS px) a keyboard+mouse player aims from; null = mouse aiming off for that slot. */
export type MouseAimProvider = (slot: number) => { x: number; y: number } | null;

interface Device {
  id: string;
  kind: DeviceKind;
  label: string;
  /** keyboard: layout index; gamepad: gamepad index */
  index: number;
  read(): InputState;
  vibrate(ms: number, strength: number): void;
}

export type InputEvent =
  | { type: 'join'; slot: number; device: string }
  | { type: 'leave'; slot: number }
  | { type: 'pause'; slot: number | null }
  | { type: 'device'; device: string; connected: boolean };

const DEADZONE = 0.18;

/**
 * One stick, dead zone taken radially and the rest rescaled to the full range.
 *
 * Per axis the zone is a square: a stick pushed diagonally to (0.17, 0.17) reads as nothing at
 * all, and one pushed to (1, 0.17) has its small sideways lean cut to zero – which is what made
 * the diagonals feel sticky, the stick had to cross the edge of the square before the second axis
 * woke up. Radially the zone is a circle around the centre: a small lean is a small value in
 * every direction, and past the circle the length grows from 0 to 1 while the direction is kept.
 */
export function radialDeadzone(x: number, y: number, dead = DEADZONE): [number, number] {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0];
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return [x * k, y * k];
}

/**
 * Does this page get gamepads at all?
 *
 * The Gamepad API is secure-context only. On a plain `http://` origin that is not localhost,
 * `navigator.getGamepads` does not exist – no error, no event, no pad – and both call sites below
 * swallow that with `?.`. This project invites exactly that origin: the dev server runs with
 * `host: true` (vite.config.ts) so phones can reach it over the LAN, and the obvious way to open
 * the hub on the couch machine is then `http://192.168.x.x:5173`. Deployed over HTTPS it is fine.
 *
 * No code here can repair that; the repair is the address. So it is said out loud once at start-up,
 * and the settings screen's controller check says it again where somebody is looking for the answer.
 */
export function padsAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

/** Printed once at start-up, and shown on the controller check page. */
export const PAD_INSECURE =
  '[pv] Gamepads: navigator.getGamepads fehlt – diese Seite ist kein sicherer Kontext. '
  + 'Über http://localhost:5173 oder über die HTTPS-Adresse öffnen, sonst gibt der Browser keine Pads heraus.';

/**
 * What to call a pad on screen.
 *
 * `Gamepad.id` is a string the driver wrote, and browsers glue the USB numbers onto it:
 * `Xbox 360 Controller (XInput STANDARD GAMEPAD)`, `Wireless Controller (STANDARD GAMEPAD Vendor:
 * 054c Product: 09cc)`, `054c-09cc-Wireless Controller`. A seat card and a table column want the
 * name a person would say, so the machine-readable parts come off. An id that is nothing but
 * numbers leaves nothing behind, and then the caller keeps its own "Gamepad N".
 */
export function padName(id: string): string {
  const s = (id ?? '')
    .replace(/\s*\((?:Vendor|Product|STANDARD GAMEPAD|XInput)[^)]*\)\s*$/i, '')
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '')
    .trim();
  return /[a-z]/i.test(s) ? s : '';
}

/** How many player slots a room has. Eight is the platform limit; games cap themselves in `maxPlayers`. */
export const MAX_PLAYERS = 8;

/**
 * Maps physical devices to player slots (up to `maxSlots`, eight by default).
 * - join mode: any unassigned device pressing A takes the next free slot.
 * - `ui` is a merged "anyone" input for menus.
 */
/**
 * Mouse buttons travel as key codes (`Mouse0` left, `Mouse1` middle, `Mouse2` right), so they can be
 * bound to an action like any key and reach the game through `PlayerInput` (lockstep-safe).
 */
export const mouseCode = (button: number) => `Mouse${button}`;

/** A click on a control of the page (a menu button, a checkbox) is meant for it, not for the game. */
function clickingUi(e: MouseEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el?.closest?.('button, a, input, select, textarea, label, [contenteditable="true"]');
}

/** True while the key belongs to a text field – a name box, a room code, a search line. */
function typingInto(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class InputManager {
  readonly slots: (Device | null)[];
  readonly inputs: PlayerInput[];
  /** Merged input of all devices (assigned or not) – for menus/title screen. */
  readonly ui = new PlayerInput();
  joinEnabled = false;
  /** Slots occupied by CPU players in the lobby – join skips them. */
  reserved: boolean[];
  /** Device that most recently pressed A (used to seat the menu navigator in slot 0). */
  lastActiveDevice = 'kb0';
  /**
   * The thing a person is holding right now: `lastActiveDevice`, plus the pseudo-device `'mouse'`
   * once the pointer moves or clicks.
   *
   * A separate field on purpose. `lastActiveDevice` answers "which device gets the next seat"
   * (`ensureAnyPlayer`, `preferredLocalDevice`), and a mouse is no seat – writing `'mouse'` in
   * there would take a pad away from a player who nudged the mouse. This one answers "whose
   * button names should the menu print", which is a question about hands, not about slots.
   */
  lastActiveInput = 'kb0';
  /** Set to true in the lobby so B on an assigned device leaves. */
  leaveEnabled = false;
  /**
   * May a device pressing A take over a seat nobody is really sitting in, instead of opening a new
   * one? Set by the lobby, and only for a table that owns its own seat map. See `seatClaimed`.
   */
  adoptEnabled = false;
  /**
   * Per seat: did a person take this one, or was it handed out because somebody had to sit?
   *
   * `ensureAnyPlayer` seats a keyboard so a lobby is never empty. Whoever walked the menus with the
   * mouse never touched that keyboard – the mouse deliberately does not write `lastActiveDevice`
   * (see above), so the seat goes to `kb0` by default. Picking up a pad and pressing A then opened
   * a *second* seat, and the match started with two players, one of them a keyboard nobody held.
   * From the sofa that is exactly what "the controller does not work" looks like.
   *
   * So the two cases are kept apart. A seat handed out by `ensureAnyPlayer` is unclaimed; one a
   * person sat down in – by joining, or by pressing anything on the device already in it – is
   * claimed. A pad pressing A takes over an unclaimed *keyboard* seat and leaves every claimed one
   * alone, so the couch still works: player two's pad still becomes player two.
   */
  private seatClaimed: boolean[];
  /**
   * Online: which slot an unassigned device may take when it presses A. In a room the host owns the
   * seat map, so a guest's device must not grab an index by itself – the hook asks the host for one
   * more seat and returns -1 until it has been granted. `null` keeps the couch rule (next free one).
   */
  claimSlot: ((deviceId: string) => number) | null = null;
  private devices = new Map<string, Device>();
  private keys = new Set<string>();
  /** Keys pressed since the last poll – guarantees very short taps are not lost between ticks. */
  private tapped = new Set<string>();
  private listeners = new Set<(e: InputEvent) => void>();
  private uiRepeat = { dir: '', t: 0 };
  /** Mouse state in CSS pixels (for keyboard players: aiming + attack/block). */
  readonly mouse = { x: 0, y: 0, left: false, right: false, leftPressed: false, rightPressed: false, movedAt: 0 };
  private mouseTap = { left: false, right: false };
  private mousePrev = { left: false, right: false };
  /**
   * Set by a game that lets the keyboard-1 player aim with the mouse: the aim direction lands in `x2/y2`
   * of that keyboard's InputState (unit vector), left click → `x`, right click → `b`. Off (null) in menus.
   */
  mouseAim: MouseAimProvider | null = null;
  /**
   * Mouse buttons the running game binds by default (e.g. RS Souls: left click strikes), for layouts
   * with the mouse switched on. A code the player bound to some action themselves wins over this.
   * The game sets it in `init()` and clears it in `dispose()`.
   */
  mouseDefaults: Partial<Record<Button, string[]>> | null = null;
  /**
   * Games that are played by **pointing**: where on its lane the player put the mouse or a finger.
   *
   * Towers is aimed, not driven – you say where the brick belongs and it goes. Only the game knows
   * where its lanes are on the screen, so it does the arithmetic and hands the answer in here; from
   * this point on it is an axis like any other. It rides in `x2` (−1 … 1 across the lane) with `y2`
   * as "a finger or the mouse is on it right now", because *pointing at the middle* and *not
   * pointing at all* must not be the same number.
   *
   * That channel, and not a field of the game's own, because an online seat's input has to be the
   * thing the lockstep buffers, delays and sends: a value the game read straight off the mouse
   * would be committed on one machine and nowhere else.
   */
  private lanePoints = new Map<number, { x: number; down: boolean; letGo: boolean }>();
  /** Online play: intercepts local device states per tick (see LockstepHook). */
  lockstep: LockstepHook | null = null;
  /** Latest input states of remote players, written by the net session before each poll. */
  private remoteStates: (InputState | null)[];
  /** Phones bound to this machine, by their own stable id (see `addTouch`). */
  private touches = new Map<string, TouchInput>();
  /**
   * Phones that drive a seat they do not hold: device id → slot. See `pairTouch`.
   *
   * A phone can be a seat of its own – press A, take the next free one, the couch case – or it can
   * sit *alongside* the device already in a seat, which is somebody at their own machine who would
   * rather steer with their thumbs than with the keyboard. The second case must not take the seat
   * away: both keep working, so a hand that reaches back for the keyboard out of habit still
   * steers something.
   */
  private paired = new Map<string, number>();
  /**
   * Haptics for a bound phone. Set by whoever owns the link, because this class knows nothing about
   * the wire. Outside the simulation – a game asking for rumble changes no state anybody hashes.
   */
  onTouchVibrate: ((id: string, ms: number, strength: number) => void) | null = null;
  /** Merged ui navigation with key-repeat: 'up'|'down'|'left'|'right'|null per frame. */
  uiNav: 'up' | 'down' | 'left' | 'right' | null = null;

  /**
   * The layouts actually in use – a deep copy of KEYBOARD_LAYOUTS that the settings screen edits.
   * Devices read from here, so a rebind takes effect on the next tick, mid-match included.
   */
  readonly layouts: KeyboardLayout[] = KEYBOARD_LAYOUTS.map((l) => ({ ...l, keys: { ...l.keys } }));

  /** Apply stored overrides on top of the defaults (missing entries keep the default). */
  applyBindings(saved: KeyBindings | undefined) {
    for (let i = 0; i < this.layouts.length; i++) {
      const def = KEYBOARD_LAYOUTS[i]!;
      const over = saved?.[String(i)] ?? {};
      this.layouts[i]!.keys = { ...def.keys };
      for (const b of Object.keys(over) as Button[]) this.layouts[i]!.keys[b] = [...(over[b] ?? [])];
      if (saved?.[`mouse${i}`]) this.layouts[i]!.mouse = (saved[`mouse${i}`] as any).on !== false;
    }
  }

  /** Bind one action of one layout; returns the layouts so the caller can persist them. */
  rebind(layoutIdx: number, button: Button, codes: string[]) {
    const l = this.layouts[layoutIdx];
    if (!l) return;
    l.keys[button] = [...codes];
  }

  setMouseLayout(layoutIdx: number, on: boolean) {
    const l = this.layouts[layoutIdx];
    if (l) l.mouse = on;
  }

  /** Only the differences from the defaults, so a later change to a default still reaches players. */
  bindingOverrides(): KeyBindings {
    const out: KeyBindings = {};
    for (let i = 0; i < this.layouts.length; i++) {
      const def = KEYBOARD_LAYOUTS[i]!, cur = this.layouts[i]!;
      const diff: Partial<Record<Button, string[]>> = {};
      for (const b of new Set([...Object.keys(def.keys), ...Object.keys(cur.keys)]) as Set<Button>) {
        const a = (def.keys[b] ?? []).join(','), c = (cur.keys[b] ?? []).join(',');
        if (a !== c) diff[b] = [...(cur.keys[b] ?? [])];
      }
      if (Object.keys(diff).length) out[String(i)] = diff;
      if (!!cur.mouse !== !!def.mouse) (out as any)[`mouse${i}`] = { on: !!cur.mouse };
    }
    return out;
  }

  /** Which key codes are already taken by another action (same or other layout). */
  conflicts(code: string, layoutIdx: number, button: Button) {
    const hits: { layout: number; button: Button }[] = [];
    for (let i = 0; i < this.layouts.length; i++)
      for (const b of Object.keys(this.layouts[i]!.keys) as Button[])
        if ((i !== layoutIdx || b !== button) && (this.layouts[i]!.keys[b] ?? []).includes(code)) hits.push({ layout: i, button: b });
    return hits;
  }

  /** Raw key state for game-specific bindings (e.g. Brawl: F throws, V blocks). */
  keyDown(code: string) {
    return this.keys.has(code);
  }

  constructor(readonly maxSlots = MAX_PLAYERS) {
    this.slots = Array.from({ length: maxSlots }, () => null);
    this.inputs = Array.from({ length: maxSlots }, () => new PlayerInput());
    this.reserved = Array.from({ length: maxSlots }, () => false);
    this.seatClaimed = Array.from({ length: maxSlots }, () => false);
    this.remoteStates = Array.from({ length: maxSlots }, () => null);
    window.addEventListener('keydown', (e) => {
      // A key typed into a text field is text, not a control. Without this the lobby's name box
      // moved the cursor of the seat it belongs to while it was being filled in, and Space scrolled
      // the page instead of landing in the name.
      if (e.repeat || typingInto(e)) return;
      this.keys.add(e.code);
      this.tapped.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    window.addEventListener('mousemove', (e) => {
      // Position and `movedAt` are written unconditionally: `mergeMouse` aims from them, and only
      // while the mouse moved within the last 15 s. Gating those would kill mouse aiming in Brawl
      // without a single error message anywhere.
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.movedAt = performance.now();
      // What this deliberately no longer does is `setActiveInput('mouse')`. A nudged desk, a
      // drifting optical sensor, the elbow of the person holding the pad – any of them was enough
      // to pull the hints back to "Klick" a frame after a gamepad had earned them, which is what
      // made the switching look broken. A click is an intention; a movement is not. And the hand
      // that reaches for the mouse is a hand about to click, so the hints correct themselves.
      // re-sync held buttons from the event – a mouseup lost outside the window would otherwise keep firing
      this.mouse.left = !!(e.buttons & 1);
      this.mouse.right = !!(e.buttons & 2);
      // e.buttons: 1 left, 2 right, 4 middle – the codes follow e.button (0 left, 1 middle, 2 right)
      for (const [bit, btn] of [[1, 0], [4, 1], [2, 2]] as const) if (!(e.buttons & bit)) this.keys.delete(mouseCode(btn));
    });
    window.addEventListener('mousedown', (e) => {
      this.setActiveInput('mouse');
      if (e.button === 0) { this.mouse.left = true; this.mouseTap.left = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouseTap.right = true; }
      if (!clickingUi(e)) { this.keys.add(mouseCode(e.button)); this.tapped.add(mouseCode(e.button)); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
      this.keys.delete(mouseCode(e.button));
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    // Escape out of a text field means "done typing", not "open the pause menu".
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !typingInto(e)) this.emit({ type: 'pause', slot: null }); });
    // The events are the quick way in – they carry the first press, and they arrive before the next
    // poll. They are no longer the *only* way: `syncPads` reconciles the snapshot against this map
    // every tick, and says there which three cases escape the events.
    window.addEventListener('gamepadconnected', (e) => this.onGamepad(e.gamepad, true));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepad(e.gamepad, false));
    for (let i = 0; i < KEYBOARD_LAYOUTS.length; i++) this.devices.set(`kb${i}`, this.makeKeyboard(i));
    // already-connected pads (page reload)
    for (const gp of navigator.getGamepads?.() ?? []) if (gp) this.onGamepad(gp, true);
    // Not a warning about this code: the browser is withholding the whole API (see `padsAvailable`).
    if (!padsAvailable()) console.warn(PAD_INSECURE);
  }

  on(fn: (e: InputEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: InputEvent) {
    for (const l of this.listeners) l(e);
  }

  /**
   * Notified whenever `lastActiveInput` changes, with the new value ('kb0', 'gp1', 'mouse', a
   * phone's id). Returns the unsubscribe function, like `on`.
   *
   * The menu listens here instead of reading the field every frame: the hints change a handful of
   * times in an evening, and a render that polls an input field is a render that runs forever.
   */
  onActiveInput(fn: (input: string) => void) {
    this.activeListeners.add(fn);
    return () => this.activeListeners.delete(fn);
  }
  private activeListeners = new Set<(input: string) => void>();
  private setActiveInput(id: string) {
    if (this.lastActiveInput === id) return;
    this.lastActiveInput = id;
    for (const l of this.activeListeners) l(id);
  }

  /** A fresh press on this device this tick – any button, or a stick pushed past halfway. */
  private freshlyUsed(id: string, s: InputState) {
    for (const b of BUTTONS) if (s.buttons[b] && !this.wasHeld(id, b)) return true;
    const prev = this.prevStates.get(id);
    const moved = (now: number, was: number) => Math.abs(now) > 0.5 && Math.abs(was) <= 0.5;
    return moved(s.x, prev?.x ?? 0) || moved(s.y, prev?.y ?? 0);
  }

  private makeKeyboard(layoutIdx: number): Device {
    const keys = this.keys;
    const tapped = this.tapped;
    return {
      id: `kb${layoutIdx}`,
      kind: 'keyboard',
      label: KEYBOARD_LAYOUTS[layoutIdx]!.name,
      index: layoutIdx,
      read: () => {
        // read the live layout, so a rebind in the pause menu applies on the next tick
        const layout = this.layouts[layoutIdx]!;
        const s = emptyState();
        for (const b of Object.keys(layout.keys) as Button[]) {
          const codes = layout.keys[b] ?? [];
          s.buttons[b] = codes.some((c) => keys.has(c) || tapped.has(c));
        }
        if (layout.mouse && this.mouseDefaults) {
          const own = new Set(Object.values(layout.keys).flat());
          for (const [b, codes] of Object.entries(this.mouseDefaults) as [Button, string[]][])
            if (codes.some((c) => !own.has(c) && (keys.has(c) || tapped.has(c)))) s.buttons[b] = true;
        }
        s.x = (s.buttons.right ? 1 : 0) - (s.buttons.left ? 1 : 0);
        s.y = (s.buttons.up ? 1 : 0) - (s.buttons.down ? 1 : 0);
        if (layout.mouse) this.mergeMouse(s, layoutIdx);
        return s;
      },
      vibrate() {},
    };
  }

  /**
   * Where the player is pointing on `slot`'s lane, −1 … 1 across it; `down` = still touching.
   *
   * Called by the game from its own pointer handling. Passing `down: false` is what a lifted finger
   * looks like: the seat stops being steered, and what happens to the aim the player gave is the
   * game's business, not the input layer's.
   */
  pointLane(slot: number, x: number, down: boolean) {
    if (slot < 0) return;
    const at = Math.max(-1, Math.min(1, x));
    const cur = this.lanePoints.get(slot);
    if (down) {
      this.lanePoints.set(slot, { x: at, down: true, letGo: false });
      return;
    }
    // A tap can be over inside a single frame, and a seat's input is read once per tick: a press
    // that went down and up between two polls would never be seen, and a tap is the whole point of
    // aiming. So the lifted finger keeps the seat pointing until the poll that reads it – the same
    // rule the touch buttons follow for the same reason (`MIN_PRESS_MS` in the pad's controls).
    if (cur?.down) {
      cur.x = at;
      cur.letGo = true;
    } else this.lanePoints.set(slot, { x: at, down: false, letGo: false });
  }

  /** Nobody is pointing at anything any more (a game shutting down, a lane that lost its seat). */
  clearLanePoints() {
    this.lanePoints.clear();
  }

  /** Keyboard 1 + mouse: aim vector relative to the figure's screen position, clicks as attack/block. */
  private mergeMouse(s: InputState, layoutIdx: number) {
    const aim = this.mouseAim;
    if (!aim) return;
    const slot = this.slotOf(`kb${layoutIdx}`);
    if (slot < 0) return;
    const m = this.mouse;
    // only while the mouse is in use (moved within the last 15 s); otherwise sticks/keys aim as usual
    if (!(m.movedAt > 0 && performance.now() - m.movedAt < 15000)) return;
    const origin = aim(slot);
    if (!origin) return;
    const dx = m.x - origin.x;
    const dy = -(m.y - origin.y);
    const len = Math.hypot(dx, dy);
    if (len >= 1) {
      s.x2 = dx / len;
      s.y2 = dy / len;
    }
    if (m.left || this.mouseTap.left) s.buttons.x = true;
    if (m.right || this.mouseTap.right) s.buttons.b = true;
  }

  private makeRemote(slot: number, label: string): Device {
    return {
      id: `remote${slot}`,
      kind: 'remote',
      label,
      index: slot,
      read: () => this.remoteStates[slot] ?? emptyState(),
      vibrate() {},
    };
  }

  /** Seat a remote (online) player in a slot; its state is fed per tick via `setRemoteState`. Emits no join event. */
  addRemote(slot: number, label = 'Online') {
    if (!this.hasSlot(slot)) return;
    const id = `remote${slot}`;
    if (this.slots[slot]?.id === id) return;
    const dev = this.makeRemote(slot, label);
    this.devices.set(id, dev);
    const prev = this.slots[slot];
    if (prev && prev.kind !== 'remote') this.slots[slot] = null;
    this.slots[slot] = dev;
    this.remoteStates[slot] = null;
    const inp = this.inputs[slot]!;
    inp.label = label;
    inp.vibrate = () => {};
  }

  removeRemote(slot: number) {
    if (!this.hasSlot(slot)) return;
    const id = `remote${slot}`;
    if (this.slots[slot]?.id === id) this.unassign(slot);
    this.devices.delete(id);
    this.remoteStates[slot] = null;
  }

  isRemote(slot: number) {
    return this.slots[slot]?.kind === 'remote';
  }

  // ---- phones as controllers ----
  //
  // A phone is bound here and nowhere else, and that is the whole point of doing it this way: from
  // `poll()` down it is indistinguishable from a gamepad. Join-in still works (an unassigned device
  // pressing A takes the next free seat), `B` still leaves, and in an online match the state goes
  // through `lockstep.local()` like every other local device – quantised, delayed by ticks, sent on
  // the wire. Nothing about the simulation learns that a phone is involved.

  /**
   * Bind a network device to this machine as if it were plugged in. `id` must be stable for the
   * physical phone, so a reconnecting one finds the seat it was sitting in.
   */
  addTouch(id: string, label = 'Handy'): TouchInput {
    const known = this.touches.get(id);
    if (known) {
      known.label = label;
      const seat = this.slotOf(id);
      if (seat >= 0) this.inputs[seat]!.label = label;
      return known;
    }
    const pad = new TouchInput(id, label);
    this.touches.set(id, pad);
    this.devices.set(id, {
      id,
      kind: 'touch',
      label,
      index: this.touches.size - 1,
      read: () => pad.read(),
      vibrate: (ms, strength) => this.onTouchVibrate?.(id, ms, strength),
    });
    this.emit({ type: 'device', device: id, connected: true });
    return pad;
  }

  /** The phone is gone for good: its seat is freed like an unplugged pad's. */
  removeTouch(id: string) {
    if (!this.touches.delete(id)) return;
    this.paired.delete(id);
    this.devices.delete(id);
    const slot = this.slotOf(id);
    if (slot >= 0) this.unassign(slot);
    this.prevStates.delete(id);
    this.emit({ type: 'device', device: id, connected: false });
  }

  /** The state a bound phone writes into, or undefined if that phone is not bound here. */
  touch(id: string): TouchInput | undefined {
    return this.touches.get(id);
  }

  /**
   * Let a phone drive `slot` *alongside* the device that holds it, instead of taking a seat.
   *
   * This is the "phone instead of mouse and keyboard" case: somebody at their own machine points
   * their camera at the code and takes over their own seat. The keyboard stays live on purpose –
   * see `paired` – and the seat's owner is the one who agreed to it, which is a question for the
   * layer that owns the wire, not for this class.
   *
   * Returns false for an empty seat: there would be no device to sit alongside, and the phone's
   * input would go nowhere while the phone showed itself as connected.
   */
  pairTouch(id: string, slot: number): boolean {
    if (!this.touches.has(id) || !this.hasSlot(slot) || !this.slots[slot]) return false;
    // A phone cannot hold a seat and drive another one at the same time; give up its own first.
    const own = this.slotOf(id);
    if (own >= 0) this.unassign(own);
    this.paired.set(id, slot);
    this.touches.get(id)!.clear();
    return true;
  }

  /** Hand the seat back. The phone is an ordinary free device again and may join in as one. */
  unpairTouch(id: string) {
    if (!this.paired.delete(id)) return;
    this.touches.get(id)?.clear();
    // Nothing of the phone's last state may survive the handover: a thumb that was still on the
    // throttle when the link ended would otherwise be held down forever by `prevStates`.
    this.prevStates.delete(id);
  }

  /** The seat this phone drives without holding it, or -1. */
  pairedSlot(id: string): number {
    return this.paired.get(id) ?? -1;
  }

  /** Every phone driving `slot` alongside its own device. */
  pairedTo(slot: number): string[] {
    return [...this.paired].filter(([, v]) => v === slot).map(([k]) => k);
  }

  isTouch(slot: number) {
    return this.slots[slot]?.kind === 'touch';
  }

  /**
   * May this seat's `x2`/`y2` be read as "the player is pointing at their lane" (see `pointLane`)?
   *
   * Every device answers yes except a gamepad, whose right stick lives on those very axes: a thumb
   * resting on it would otherwise steer a brick across the island. A gamepad with a phone paired to
   * it counts, because the phone's aim is merged onto the same seat and is meant.
   */
  canPointLane(slot: number): boolean {
    const dev = this.slots[slot];
    if (!dev) return false;
    return dev.kind !== 'gamepad' || this.pairedTo(slot).length > 0;
  }

  setRemoteState(slot: number, state: InputState) {
    if (this.hasSlot(slot)) this.remoteStates[slot] = state;
  }

  /** Slots are addressed by index from the hub and from the net session – both can be out of range. */
  hasSlot(slot: number) {
    return Number.isInteger(slot) && slot >= 0 && slot < this.maxSlots;
  }

  private makeGamepad(index: number, id = ''): Device {
    return {
      id: `gp${index}`,
      kind: 'gamepad',
      // the name the driver gave it, so a seat card says "Xbox 360 Controller" and not "Gamepad 1"
      label: padName(id) || `Gamepad ${index + 1}`,
      index,
      read: () => {
        const gp = this.pads[index];
        const s = emptyState();
        if (!gp) return s;
        const ax = (i: number) => gp.axes[i] ?? 0;
        const bt = (i: number) => !!gp.buttons[i]?.pressed;
        [s.x, s.y] = radialDeadzone(ax(0), -ax(1));
        [s.x2, s.y2] = radialDeadzone(ax(2), -ax(3));
        s.buttons.a = bt(0);
        s.buttons.b = bt(1);
        s.buttons.x = bt(2);
        s.buttons.y = bt(3);
        s.buttons.l = bt(4) || bt(6);
        s.buttons.r = bt(5) || bt(7);
        s.buttons.select = bt(8);
        s.buttons.start = bt(9);
        s.buttons.up = bt(12) || s.y > 0.6;
        s.buttons.down = bt(13) || s.y < -0.6;
        s.buttons.left = bt(14) || s.x < -0.6;
        s.buttons.right = bt(15) || s.x > 0.6;
        if (s.buttons.left && !s.x) s.x = -1;
        if (s.buttons.right && !s.x) s.x = 1;
        return s;
      },
      vibrate(ms, strength) {
        const gp = navigator.getGamepads()[index];
        const act = (gp as any)?.vibrationActuator;
        act?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {});
      },
    };
  }

  private onGamepad(gp: Gamepad, connected: boolean) {
    const id = `gp${gp.index}`;
    if (!connected) {
      this.dropPad(gp.index);
      return;
    }
    if (!this.devices.has(id)) this.devices.set(id, this.makeGamepad(gp.index, gp.id));
    this.padIds[gp.index] = gp.id;
    this.emit({ type: 'device', device: id, connected });
  }

  /**
   * A pad is gone: its device, its seat and its remembered state go with it.
   *
   * `prevStates` too, which the old disconnect path forgot. Without that, a pad unplugged with a
   * button held came back to a manager that still thought the button was down, and the press that
   * should have seated it read as "already held" and did nothing.
   */
  private dropPad(index: number) {
    const id = `gp${index}`;
    if (!this.devices.delete(id)) return;
    this.padIds[index] = '';
    const slot = this.slots.findIndex((d) => d?.id === id);
    if (slot >= 0) this.unassign(slot);
    this.prevStates.delete(id);
    this.emit({ type: 'device', device: id, connected: false });
  }

  /**
   * What a device reads at this moment, for the settings screen's controller check.
   *
   * Diagnostics only – a game never asks this, it asks its seat. It exists so the check page can
   * put what this class makes of a pad next to the raw numbers the browser handed out, and that one
   * comparison is what separates "the browser sees nothing" from "we are reading it wrong".
   */
  deviceState(deviceId: string): InputState | null {
    return this.devices.get(deviceId)?.read() ?? null;
  }

  get deviceList() {
    return [...this.devices.values()].filter((d) => d.kind !== 'remote').map((d) => ({ id: d.id, label: d.label, kind: d.kind }));
  }

  /** Kind of the device seated in a slot ('keyboard' | 'gamepad' | null). */
  deviceKind(slot: number): DeviceKind | null {
    return this.slots[slot]?.kind ?? null;
  }
  deviceIndex(slot: number): number {
    return this.slots[slot]?.index ?? -1;
  }

  slotOf(deviceId: string) {
    return this.slots.findIndex((d) => d?.id === deviceId);
  }

  /** Slot a PlayerInput belongs to, so a game holding only the input can look its device up. */
  slotOfInput(input: PlayerInput | null | undefined): number {
    return input ? this.inputs.indexOf(input) : -1;
  }

  /**
   * What a HUD should print for an action on the device that actually sits in this slot.
   *
   * In-game prompts used to hard-code the pad captions ("Y", "B"), which is wrong for every
   * keyboard player and actively misleading on a German layout, where the key labelled Y reports
   * `KeyZ` and is bound to something else entirely. Ask here instead.
   */
  buttonHint(slot: number, button: Button, locale: 'de' | 'en' = 'de'): string {
    const dev = this.slots[slot];
    if (dev?.kind === 'keyboard') {
      const codes = this.layouts[dev.index]?.keys[button] ?? [];
      if (!codes.length) return '—';
      return shortKeyName(codes[0]!, locale);
    }
    return PAD_LABEL[button];
  }

  /** The same lookup starting from a game's PlayerInput. */
  buttonHintFor(input: PlayerInput | null | undefined, button: Button, locale: 'de' | 'en' = 'de'): string {
    const slot = this.slotOfInput(input);
    return slot < 0 ? PAD_LABEL[button] : this.buttonHint(slot, button, locale);
  }

  assign(slot: number, deviceId: string, claimed = true) {
    const dev = this.devices.get(deviceId);
    if (!dev || !this.hasSlot(slot)) return false;
    const prev = this.slotOf(deviceId);
    if (prev >= 0) {
      this.slots[prev] = null;
      this.seatClaimed[prev] = false; // the claim belonged to the device, and the device left
    }
    this.slots[slot] = dev;
    this.seatClaimed[slot] = claimed;
    const inp = this.inputs[slot]!;
    inp.label = dev.label;
    inp.vibrate = (ms, s = 0.6) => dev.vibrate(ms, s);
    this.emit({ type: 'join', slot, device: deviceId });
    return true;
  }

  unassign(slot: number) {
    if (!this.hasSlot(slot) || !this.slots[slot]) return;
    // Nobody can drive a seat that no longer has a device to drive alongside.
    for (const id of this.pairedTo(slot)) this.unpairTouch(id);
    this.slots[slot] = null;
    this.seatClaimed[slot] = false;
    this.inputs[slot]!.clear();
    this.inputs[slot]!.label = '';
    this.emit({ type: 'leave', slot });
  }

  unassignAll() {
    for (let i = 0; i < this.maxSlots; i++) this.unassign(i);
  }

  /**
   * Assign the first keyboard to slot 0 if nobody joined (single-player convenience).
   *
   * Marked **unclaimed**: nobody asked for this seat, it exists so that a lobby is not empty. A pad
   * that is picked up afterwards takes it over instead of opening a second one (see `seatClaimed`),
   * and the first press on the seated device claims it, so a keyboard player keeps their place.
   */
  ensureAnyPlayer() {
    if (this.slots.every((s) => !s)) this.assign(0, this.devices.has(this.lastActiveDevice) ? this.lastActiveDevice : 'kb0', false);
  }

  /**
   * Hand an unclaimed keyboard seat to the device that just pressed A, or answer false.
   *
   * See `seatClaimed` for why a seat can be unclaimed at all. Three guards, each one a thing that
   * would otherwise break:
   *  - `adoptEnabled`, set by the lobby and only for a table that owns its own seat map. Online a
   *    guest's seats belong to the host (`claimSlot`), and the engine must not deal them out behind
   *    the host's back.
   *  - no `lockstep`: in a match a seat that swaps its device mid-tick commits a different
   *    `InputState` than every other peer expects. `joinEnabled` is false outside the lobby anyway –
   *    this is the belt to that pair of braces.
   *  - a gamepad takes over, and only a keyboard seat is taken. A phone already has a way onto a
   *    seat somebody is using, and a better one: it asks (`pairTouch`, `TakeoverPrompt`), the seat's
   *    owner agrees, and both devices stay live afterwards. Adopting quietly here would undercut
   *    that, and on a couch it is plainly wrong – a phone that just scanned the code wants a seat of
   *    its own. In the other direction: a seat holding a phone or the screen's own pad has a thumb
   *    on it, which is a person and never a placeholder.
   */
  private adoptSeat(dev: Device): boolean {
    if (!this.adoptEnabled || this.lockstep || dev.kind !== 'gamepad') return false;
    const slot = this.slots.findIndex((d, i) => !!d && !this.seatClaimed[i] && d.kind === 'keyboard');
    if (slot < 0) return false;
    const old = this.slots[slot]!;
    // Nothing of the old device may survive the handover. `assign` does not clear the seat (unlike
    // `unassign`), so without this the first pad tick reads the keyboard's last frame as a fresh
    // press – and a phantom `pressed.b` with `leaveEnabled` on would throw the pad straight out again.
    this.inputs[slot]!.clear();
    this.prevStates.delete(old.id);
    // `assign` alone, never `unassign` first: the `leave` event makes an online guest give its seat
    // back to the host (see `Lobby`), while an extra `join` on a seat that is already human is
    // handled idempotently there.
    this.assign(slot, dev.id);
    return true;
  }

  /**
   * State of every phone that drives a seat it does not hold, by slot, or null when none does.
   *
   * Returning null in the ordinary case is not micro-optimisation, it is the guarantee that a build
   * where nobody paired a phone runs the exact same `poll` it ran before this existed.
   */
  private readPaired(): (InputState | null)[] | null {
    if (!this.paired.size) return null;
    const out: (InputState | null)[] = Array.from({ length: this.maxSlots }, () => null);
    for (const [id, slot] of this.paired) {
      const dev = this.devices.get(id);
      // A seat that emptied under the phone takes the pairing with it – there is nothing to drive.
      if (!dev || !this.slots[slot]) continue;
      const s = dev.read();
      out[slot] = out[slot] ? mergeStates(out[slot]!, s) : s;
      // The phone counts as "the device in use" like any other, so the on-screen hints say pad
      // labels while a thumb is on it and go back to key names the moment a hand is on the keyboard.
      if (this.freshlyUsed(id, s)) {
        this.lastActiveDevice = id;
        this.setActiveInput(id);
        // a thumb on a phone sharing this seat claims it just as the seat's own device would
        this.seatClaimed[slot] = true;
      }
      this.remember(id, s);
    }
    return out;
  }

  /**
   * The pads as of this poll. `navigator.getGamepads()` builds a fresh snapshot array on every
   * call (Chrome copies every pad's state into it), and each pad device read it again – four pads
   * were four snapshots a tick. One here, read by all of them.
   */
  private pads: (Gamepad | null)[] = [];
  /** `Gamepad.id` per index, so `syncPads` can tell a reconnect from the pad that was there. */
  private padIds: string[] = [];

  /**
   * Bring the device map in line with this tick's snapshot.
   *
   * `gamepadconnected` is the quick way a pad arrives, but not a dependable one. Firefox holds the
   * event back until a button is pressed; Chromium fires it only while the document has focus, so a
   * pad woken in a background tab never announces itself; and a pad unplugged and plugged back in
   * usually returns on a *different* `gamepad.index`, which leaves the old `gp0` device alive in
   * this map reading `this.pads[0] === null` for the rest of the evening.
   *
   * The snapshot is taken every tick anyway, so comparing it against what we hold costs one pass
   * over four entries and all three cases go away. It runs **before** the device loop and never
   * inside it: it writes to `this.devices`, and mutating that map under its own iterator would
   * change the order the devices are read in.
   */
  private syncPads() {
    const pads = this.pads;
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      const live = gp && gp.connected !== false;
      const have = this.devices.get(`gp${i}`);
      if (!live) {
        if (have) this.dropPad(i);
      } else if (!have) {
        this.onGamepad(gp!, true);
      } else if (this.padIds[i] !== gp!.id) {
        // same index, other hardware: the seat belonged to the pad that left, not to this one
        this.dropPad(i);
        this.onGamepad(gp!, true);
      }
    }
    // Firefox shortens the array when the last pad goes; anything past its end is gone.
    const stale: number[] = [];
    for (const dev of this.devices.values()) if (dev.kind === 'gamepad' && dev.index >= pads.length) stale.push(dev.index);
    for (const i of stale) this.dropPad(i);
  }

  /** Call once per simulation tick (or per frame in menus). */
  poll(dt: number) {
    this.pads = navigator.getGamepads?.() ?? [];
    this.syncPads();
    const merged = emptyState();
    let anyStart: number | null | false = false;
    // Phones driving somebody else's seat are read up front, because their state has to be part of
    // that seat's input *before* the lockstep books it. A seat commits exactly one input per tick;
    // two devices on it are one gamepad (see `mergeStates`), never two bookings.
    const extra = this.readPaired();
    for (const dev of this.devices.values()) {
      // read above, holds no seat of its own, and must not join in on A: its A belongs to the seat
      if (this.paired.has(dev.id)) continue;
      let s = dev.read();
      const slot = this.slotOf(dev.id);
      if (dev.kind === 'remote') {
        // remote players: state comes from the net session; no join/pause/menu merging
        if (slot >= 0) this.inputs[slot]!.next = s;
        continue;
      }
      if (slot >= 0) {
        const add = extra?.[slot];
        // the phone second, so it wins an exact tie – it is the device somebody deliberately took up
        if (add) s = mergeStates(s, add);
        // a finger or the mouse on this seat's lane speaks only while it is down, so letting go
        // never wipes a target a phone is still holding on its own strip (see `pointLane`)
        const point = this.lanePoints.get(slot);
        if (point?.down) {
          s.x2 = point.x;
          s.y2 = 1;
          // it has been read now, so a tap that was over before this poll may end (see `pointLane`)
          if (point.letGo) point.down = false;
        }
        if (this.lockstep) s = this.lockstep.local(slot, s);
        this.inputs[slot]!.next = s;
        if (s.buttons.start && !this.inputs[slot]!.held.start) anyStart = slot;
        if (this.leaveEnabled && s.buttons.b && !this.inputs[slot]!.held.b) {
          // leave handled after commit below
        }
      } else if (this.joinEnabled && s.buttons.a && !this.wasHeld(dev.id, 'a') && !this.adoptSeat(dev)) {
        const free = this.claimSlot ? this.claimSlot(dev.id) : this.slots.findIndex((d, i) => !d && !this.reserved[i]);
        if (free >= 0) this.assign(free, dev.id);
      }
      if (s.buttons.start && !this.wasHeld(dev.id, 'start') && slot < 0) anyStart = null;
      // Any press counts, not just A. The menu prints the button names of whatever is in use, and a
      // player who walks the list with the d-pad and then reads "Leertaste = Auswählen" has been
      // told about a keyboard nobody is touching.
      if (this.freshlyUsed(dev.id, s)) {
        this.lastActiveDevice = dev.id;
        this.setActiveInput(dev.id);
        // somebody is holding this seat's own device, so the seat is theirs and not a placeholder
        if (slot >= 0) this.seatClaimed[slot] = true;
      }
      this.remember(dev.id, s);
      merged.x = Math.abs(s.x) > Math.abs(merged.x) ? s.x : merged.x;
      merged.y = Math.abs(s.y) > Math.abs(merged.y) ? s.y : merged.y;
      for (const b of Object.keys(s.buttons) as Button[]) merged.buttons[b] ||= s.buttons[b];
    }
    for (let i = 0; i < this.maxSlots; i++) {
      const inp = this.inputs[i]!;
      if (this.slots[i]) {
        inp.commit();
        if (this.leaveEnabled && inp.pressed.b && this.slots[i]!.kind !== 'remote') {
          // B is layered while a phone shares this seat: the first press hands the seat back to its
          // own device, only a second one leaves. Two people are on this seat and neither may evict
          // the other with a game button – and it gives a mistaken takeover its way out, on both
          // ends, without a menu to find.
          const guests = this.pairedTo(i);
          if (guests.length) for (const id of guests) this.unpairTouch(id);
          else this.unassign(i);
        }
      }
    }
    this.tapped.clear();
    // mouse edges (taps survive until the next poll like keys)
    const l = this.mouse.left || this.mouseTap.left, r = this.mouse.right || this.mouseTap.right;
    this.mouse.leftPressed = l && !this.mousePrev.left;
    this.mouse.rightPressed = r && !this.mousePrev.right;
    this.mousePrev = { left: l, right: r };
    this.mouseTap = { left: false, right: false };
    this.ui.next = merged;
    this.ui.commit();
    if (anyStart !== false) this.emit({ type: 'pause', slot: anyStart });
    this.updateUiNav(dt);
  }

  private prevStates = new Map<string, InputState>();
  private wasHeld(id: string, b: Button) {
    return !!this.prevStates.get(id)?.buttons[b];
  }
  private remember(id: string, s: InputState) {
    this.prevStates.set(id, s);
  }

  private updateUiNav(dt: number) {
    const u = this.ui;
    const dir = u.y > 0.5 || u.held.up ? 'up' : u.y < -0.5 || u.held.down ? 'down' : u.x < -0.5 || u.held.left ? 'left' : u.x > 0.5 || u.held.right ? 'right' : '';
    this.uiNav = null;
    if (!dir) {
      this.uiRepeat = { dir: '', t: 0 };
      return;
    }
    if (dir !== this.uiRepeat.dir) {
      this.uiRepeat = { dir, t: 0.4 };
      this.uiNav = dir;
    } else {
      this.uiRepeat.t -= dt;
      if (this.uiRepeat.t <= 0) {
        this.uiRepeat.t = 0.12;
        this.uiNav = dir;
      }
    }
  }
}

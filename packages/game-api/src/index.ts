/**
 * @pv/game-api – contracts between the Partyverse hub and its games.
 * Pure types (no runtime code) so games and the hub can evolve independently.
 */
import type * as THREE from 'three';
import type { Engine, InputManager, AudioManager, AssetManager, Save, PlayerInput, CompanionBus } from '@pv/engine';

export type Locale = 'de' | 'en';
export type I18n = Record<Locale, string>;

export type Difficulty = 'easy' | 'normal' | 'hard';
export type PlayerIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PlayerSlot {
  index: PlayerIndex;
  profileId: string;
  name: string;
  /** CSS color used for HUD/markers, e.g. "#ff8c1a" */
  color: string;
  characterId: string;
  /** Swappable head (see engine HEADS). */
  headId: string;
  kind: 'human' | 'cpu';
  difficulty?: Difficulty;
  /** Present for humans; games write CPU decisions into their own virtual inputs. */
  input?: PlayerInput;
  /** Online play: this human sits at another machine (input arrives over the network; no local viewport/HUD). */
  remote?: boolean;
  /** Game-specific extra selection made in the lobby (e.g. kart body). */
  extra?: Record<string, string>;
}

export interface GameModeMeta {
  id: string;
  title: I18n;
  description: I18n;
  minPlayers?: number;
  maxPlayers?: number;
  /** Shared choices asked before the lobby (track, cup, laps …); values land in `rules`. */
  setup?: SandboxField[];
}

/** Declarative rule fields: the hub renders a generic sandbox editor from them. */
export type SandboxField =
  | { key: string; label: I18n; type: 'number'; min: number; max: number; step: number; default: number }
  | { key: string; label: I18n; type: 'bool'; default: boolean }
  | { key: string; label: I18n; type: 'enum'; options: { value: string; label: I18n }[]; default: string }
  | { key: string; label: I18n; type: 'multi'; options: { value: string; label: I18n }[]; default: string[] };

export interface SandboxSchema {
  groups: { title: I18n; fields: SandboxField[] }[];
  presets: { id: string; title: I18n; values: Record<string, unknown> }[];
}

/** Extra per-player choice a game can ask for in the lobby (e.g. kart body). */
export interface LobbyExtraChoice {
  key: string;
  title: I18n;
  options: { value: string; label: I18n; description?: I18n; color?: string }[];
}

/**
 * A small looping scene for the game-select screen, built from the game's own parts – the menu
 * shows the same geometry that stands in the match, never a second, redrawn version of it.
 */
export interface GamePreview {
  /** Anything; the menu measures it and scales it into the tile. */
  group: THREE.Group;
  /** Called every frame while the tile has the focus. */
  update?(dt: number): void;
  /**
   * Idle rotation in radians per second while the tile has the focus. 0 keeps the scene facing the
   * camera – right for anything that reads as a side view, like two fighters aiming at each other.
   */
  spin?: number;
}

export interface GameMeta {
  id: string;
  title: I18n;
  description: I18n;
  minPlayers: number;
  maxPlayers: number;
  /** Emoji, shown while no 3-D scene is up (and as a fallback if `preview` fails). */
  thumbnail?: string;
  /** Three to five words for the menu tile – `description` is a whole sentence and overflows. */
  tagline?: I18n;
  /** The game's own colour in the menu: its world, not a player colour. */
  accent?: string;
  /**
   * Can this game be played in an online room? Default true. A game that reads something only
   * the local machine has – a microphone, a camera – and never hashes its state runs on one
   * screen only: the hub then offers no room for it and refuses to start it inside one.
   */
  online?: boolean;
  /** Builds the menu scene. Optional – without it the tile shows the emoji. */
  preview?: (assets: AssetManager) => Promise<GamePreview>;
  modes: GameModeMeta[];
  sandbox?: SandboxSchema;
  lobbyExtras?: LobbyExtraChoice[];
  /** Controls reference shown in the pause menu (and lobby). */
  controls?: {
    action: I18n;
    keyboard1: string;
    keyboard2: string;
    gamepad: string;
    /**
     * Abstract button this action uses. Set it and the action becomes rebindable in the controls
     * screen, which then shows the player's own key instead of the hard-coded string above.
     */
    button?: 'a' | 'b' | 'x' | 'y' | 'l' | 'r' | 'start' | 'select' | 'up' | 'down' | 'left' | 'right';
    /** This action is aimed/triggered with the mouse (shown as such, not rebindable to a key). */
    mouse?: boolean;
  }[];
}

export type GameExit =
  | { reason: 'finished'; results?: GameResults }
  | { reason: 'quit' }
  | { reason: 'error'; error: unknown };

export interface GameResults {
  /** Placements, best first. Ties share an array entry. */
  placements: PlayerIndex[][];
  /** Optional per-player summary lines shown on the results screen. */
  lines?: Partial<Record<PlayerIndex, string>>;
  /** Optional title override, e.g. "Insel-Cup". */
  title?: I18n;
}

export interface UiHost {
  /** Mount a Preact vnode into the overlay layer above the canvas. Returns an unmount fn. */
  mount(node: unknown): () => void;
  /** Show a toast for a moment. */
  toast(text: string): void;
}

/** One game order as it is applied: the seat that gave it and the order (plain JSON). */
export interface GameCommand {
  slot: PlayerIndex;
  cmd: unknown;
}

/**
 * Game orders – "build a house at 12,40", "remove road 17" – for games whose players act through
 * discrete commands rather than a stick. An order is scheduled for a tick like input is and handed
 * to `GameInstance.applyCommands` at that tick on every machine, in the same order. Offline the
 * same channel exists (`online: false`) and applies an order at the next simulated tick, so a game
 * has one code path for both.
 */
export interface GameNet {
  /** True in an online match (orders then travel to the other peers). */
  readonly online: boolean;
  /**
   * Give an order for one of this machine's seats (default: the first). It must survive JSON – it
   * is applied as `JSON.parse(JSON.stringify(cmd))` everywhere, the sender included – and stay under
   * 2 KB serialised; orders beyond one tick's 2 KB wait for the next tick. Returns false when the
   * order was refused (not JSON, too large, not a seat of this machine, seat unattended, rebuild).
   */
  sendCommand(cmd: unknown, slot?: PlayerIndex): boolean;
}

export interface GameContext {
  engine: Engine;
  input: InputManager;
  audio: AudioManager;
  assets: AssetManager;
  save: Save;
  players: PlayerSlot[];
  mode: string;
  rules: Record<string, unknown>;
  ui: UiHost;
  locale: Locale;
  t: (s: I18n | string) => string;
  seed: number;
  /** URL query params (autoplay/debug flags). */
  query: URLSearchParams;
  /** Ask the hub to show the pause overlay; resolves with the chosen action. */
  pause(): Promise<'resume' | 'restart' | 'quit'>;
  /**
   * Companion devices bound to this machine – the phones in `apps/hub/src/companion/`.
   *
   * Optional, like the hooks on `GameInstance`: a game that has no use for them never looks. It is
   * handed in rather than imported so a game keeps meeting the hub through this one contract; a
   * game reaching into `@pv/engine/net/...` for it would only have moved the coupling one floor
   * down.
   *
   * Whatever arrives here came over the network and is not part of the simulation – see the note
   * on `CompanionBus.deliver`.
   */
  companions?: CompanionBus;
  /** Game orders (see `GameNet`). Optional so older hubs and test harnesses need not provide it. */
  net?: GameNet;
}

export interface GameInstance {
  /** Fixed-step simulation tick (dt in seconds, constant). */
  update(dt: number): void;
  /** Render-time hook (alpha = interpolation 0..1). Optional. */
  render?(alpha: number, dtRender: number): void;
  dispose(): void;
  onExit: Promise<GameExit>;
  /** Online play: hash of the simulation state (rounded positions etc.) – peers compare it to detect desyncs. */
  stateHash?(): number;
  /**
   * Online play: this player's connection is gone for good, a bot takes the character over.
   *
   * Called from inside the fixed step, on the same tick on every peer (see SEAT_GRACE_TICKS), so
   * whatever it does is part of the simulation and must be deterministic: derive the bot's own
   * randomness from the match seed and the slot, never from a fresh `Math.random` or from a shared
   * stream whose position depends on when this happened to be called.
   */
  setPlayerBot?(index: PlayerIndex): void;
  /**
   * The orders given for this tick (see `GameNet`), sorted by seat, then in the order each seat gave
   * them; often empty. Called exactly once per simulated tick, right before that tick's `update`, on
   * every peer alike – also while a rejoining peer rebuilds the match – so it is part of the
   * simulation and must be deterministic. `tick` counts simulated ticks from 0.
   */
  applyCommands?(tick: number, cmds: ReadonlyArray<GameCommand>): void;
}

export interface GameModule {
  meta: GameMeta;
  mount(ctx: GameContext): Promise<GameInstance>;
}

/** Helper for games: resolve rule with default. */
export function rule<T>(rules: Record<string, unknown>, key: string, fallback: T): T {
  const v = rules[key];
  return (v === undefined ? fallback : v) as T;
}

/** Fill a rules object with schema defaults (missing keys only). */
export function withDefaults(schema: SandboxSchema | undefined, rules: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...rules };
  if (!schema) return out;
  for (const g of schema.groups) for (const f of g.fields) if (out[f.key] === undefined) out[f.key] = f.default;
  return out;
}

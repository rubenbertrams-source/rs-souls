import { get, set, del, keys } from 'idb-keyval';
import { signal } from '@preact/signals';

export interface Settings {
  locale: 'de' | 'en';
  master: number;
  music: number;
  sfx: number;
  /** Extra volume channels a game asked for, by name (see AudioManager.channel). */
  channels: Record<string, number>;
  colorblind: boolean;
  screenShake: boolean;
  showFps: boolean;
  quality: 'low' | 'medium' | 'high';
  /** Online relay address (empty = ws(s)://<page host>:8787). */
  relayUrl: string;
  /** Key rebinds per keyboard layout; only the differences from the defaults are stored. */
  bindings: Record<string, unknown>;
  /**
   * On-screen controls in the hub: 'auto' follows the browser (a coarse pointer means a phone),
   * 'on' and 'off' overrule it. The controller page (pad.html) is unaffected – it is always touch.
   */
  touch: 'auto' | 'on' | 'off';
  /** Kart on touch: the throttle latches (tap once, drives on) instead of being held. */
  touchAutoGas: boolean;
  /** Duck & Jump on touch: jump under the left thumb, duck under the right. */
  touchDuckSwap: boolean;
  /** Bumped when a default changes in a way that should override what is already stored. */
  version: number;
}

/**
 * Raised whenever the stored settings must be touched on load.
 * 2 – recorded samples replaced the synthesised beeps and were much louder, so the mix was reset.
 * 3 – the engine hum got its own bus and slider; music up, engine down (it was ~6-9 dB over the track).
 * 4 – that slider is a named channel now (`channels.kartEngine`), so any game can have one.
 */
export const SETTINGS_VERSION = 4;
/** Volumes reset when the stored mix predates version 3 – 4 only moved a key, it did not re-mix. */
const RESET_VOLUMES_BELOW = 3;
/** Keys reset when the stored mix is older than RESET_VOLUMES_BELOW. */
const RESET_ON_UPGRADE: (keyof Settings)[] = ['master', 'music', 'sfx'];
/**
 * Volume sliders that used to be settings keys of their own and are named channels now. A stored
 * value moves over, so nobody loses the level they had set.
 */
const LEGACY_CHANNELS: Record<string, string> = { engine: 'kartEngine' };

/**
 * First run: follow the browser instead of always starting in German. Only the two languages the
 * game actually has count; anything else stays on the default.
 */
export function browserLocale(): Settings['locale'] {
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of list) {
      const tag = (l ?? '').toLowerCase();
      if (tag.startsWith('de')) return 'de';
      if (tag.startsWith('en')) return 'en';
    }
  } catch {
    /* no navigator (tests, workers) – keep the default */
  }
  return 'de';
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'de',
  master: 0.6,
  music: 0.55,
  sfx: 0.7,
  // no channel is known up front: a game registers its own with its own default (see AudioManager.channel)
  channels: {},
  colorblind: false,
  screenShake: true,
  showFps: false,
  quality: 'high',
  relayUrl: '',
  bindings: {},
  touch: 'auto',
  touchAutoGas: true,
  touchDuckSwap: false,
  version: SETTINGS_VERSION,
};

export interface Profile {
  id: string;
  name: string;
  color: string;
  characterId: string;
  createdAt: number;
}

const SETTINGS_KEY = 'pv:settings';
const PREFIX = 'pv:';

/** Settings live in localStorage (sync, tiny). Everything else in IndexedDB. */
export class Save {
  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });

  constructor() {
    // nobody has chosen a language yet, so the browser decides; a stored choice always wins below
    this.settings.value = { ...DEFAULT_SETTINGS, locale: browserLocale() };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Settings> & Record<string, unknown>;
        const merged = { ...this.settings.value, ...stored };
        merged.channels = { ...DEFAULT_SETTINGS.channels, ...(stored.channels ?? {}) };
        // a slider that used to have its own key lives on under its channel name; the old key goes
        for (const [key, channel] of Object.entries(LEGACY_CHANNELS)) {
          const v = stored[key];
          if (typeof v === 'number' && merged.channels[channel] === undefined) merged.channels[channel] = v;
          delete (merged as any)[key];
        }
        // an old save keeps its own volumes, which were set for the synthesised sounds and are far
        // too loud for the recorded ones – reset just those, keep everything else the player chose
        if ((stored.version ?? 0) < RESET_VOLUMES_BELOW) for (const k of RESET_ON_UPGRADE) (merged as any)[k] = DEFAULT_SETTINGS[k];
        if ((stored.version ?? 0) < SETTINGS_VERSION) merged.version = SETTINGS_VERSION;
        this.settings.value = merged;
      }
    } catch {
      /* ignore */
    }
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings.value = { ...this.settings.value, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings.value));
    } catch {
      /* ignore */
    }
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const v = await get<T>(PREFIX + key);
      return v === undefined ? fallback : v;
    } catch {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await set(PREFIX + key, value);
    } catch {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    }
  }

  async remove(key: string) {
    try {
      await del(PREFIX + key);
    } catch {
      /* ignore */
    }
  }

  async listKeys(prefix = ''): Promise<string[]> {
    try {
      const all = await keys();
      return all.filter((k) => typeof k === 'string' && k.startsWith(PREFIX + prefix)).map((k) => (k as string).slice(PREFIX.length));
    } catch {
      return [];
    }
  }

  /** Per-game stats: merge patch into stored object. */
  async bumpStats(gameId: string, patch: Record<string, number>) {
    const cur = await this.get<Record<string, number>>(`stats:${gameId}`, {});
    for (const [k, v] of Object.entries(patch)) cur[k] = (cur[k] ?? 0) + v;
    await this.set(`stats:${gameId}`, cur);
    return cur;
  }
}

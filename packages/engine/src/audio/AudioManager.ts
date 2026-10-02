// zzfx touches AudioContext at import time, so it is loaded lazily in unlock() (keeps node/vitest happy).
type BuildSamples = (...p: number[]) => number[];

export type SfxParams = number[];

/**
 * Container preference for the generated files: the encoder (tools/assets/encode_audio.py) may put
 * several formats of the same recording next to each other, and only the best one is ever loaded.
 */
const FORMAT_RANK: Record<string, number> = { ogg: 0, mp3: 1, wav: 2 };
const formatRank = (ext: string) => FORMAT_RANK[ext.toLowerCase()] ?? 9;

/**
 * Procedural UI/hub sounds (ZzFX parameter arrays), played by the engine's own menus and by the
 * hub. Game sounds are not listed here: a game brings its own table and hands it in with
 * `registerSfx` (see games/<game>/src/sfx.ts).
 */
export const UI_SFX: Record<string, SfxParams> = {
  uiMove: [0.6, 0, 400, 0.01, 0.02, 0.05, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.02, 0],
  uiSelect: [0.8, 0, 660, 0.01, 0.06, 0.12, 0, 1.5, 0, 12, 200, 0.05, 0, 0, 0, 0, 0, 0.9, 0.03, 0],
  uiBack: [0.7, 0, 300, 0.01, 0.05, 0.1, 0, 1.2, 0, -8, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.03, 0],
  join: [1, 0, 520, 0.02, 0.1, 0.2, 0, 1.8, 0, 20, 300, 0.08, 0.05, 0, 0, 0, 0, 0.9, 0.05, 0],
  countdown: [1, 0, 440, 0.01, 0.12, 0.15, 0, 1.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.05, 0],
  go: [1.2, 0, 880, 0.02, 0.25, 0.3, 0, 1.6, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.9, 0.08, 0],
};

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  /**
   * Extra buses by name, e.g. the kart engine hum: a sound that runs continuously drowns the music
   * long before the one-shot effects get loud enough to bother anyone, so it needs its own slider.
   * A game asks for its channel with `channel(name)`; missing names fall back to the default the
   * game registered, so an unknown channel is never silent.
   */
  channels: Record<string, number>;
}

/** Where the camera listens from, in world units. `halfH` is the visible half-height (zoom). */
export interface Listener {
  x: number;
  y: number;
  halfH: number;
}

export interface SfxOptions {
  volume?: number;
  /** Fixed playback rate; overrides the random `pitchVar` spread. */
  rate?: number;
  /** Random pitch spread, e.g. 0.08 → rate in 0.92…1.08. Default 0.06 for samples, 0 for ZzFX. */
  pitchVar?: number;
  /** Random gain spread, e.g. 0.15 → volume × 0.85…1.0. Default 0.12. */
  gainVar?: number;
  throttleMs?: number;
  fallback?: string;
  /** World position: pans and attenuates relative to the listener (see setListener). */
  x?: number;
  y?: number;
  /** Max simultaneous voices for this name (default 4). Extra calls are dropped. */
  maxVoices?: number;
}

/**
 * How long a game start may wait for its sounds (`preloadWithin`).
 *
 * One number for every game, because the trade-off is the same everywhere: waiting is what keeps
 * the decoding out of the first seconds of play, and the cap is what keeps one slow file from
 * holding a match hostage. Generous on purpose - the loading screen is the right place to spend
 * this, and locally the whole set is done long before the deadline.
 */
export const SAMPLE_WAIT_MS = 8000;

export class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private buffers = new Map<string, AudioBuffer>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private currentMusic = '';
  /** Level the current track was started at (duckMusic returns to it). */
  private musicVolume = 1;
  settings: AudioSettings = { master: 0.8, music: 0.6, sfx: 0.9, channels: {} };
  /** Procedural presets: the UI table plus whatever the running games registered. */
  private presets: Record<string, SfxParams> = { ...UI_SFX };
  /** Named extra buses (see channel()), with the default the caller asked for. */
  private channels = new Map<string, { gain: GainNode; fallbackVolume: number }>();
  private sfxCache = new Map<string, AudioBuffer>();
  private lastPlay = new Map<string, number>();
  private voices = new Map<string, number>();
  private buildSamples: BuildSamples | null = null;
  /** Random source for pitch/gain jitter and variant choice – audio only, never the simulation. */
  private rnd = () => Math.random();

  /** Must be called from a user gesture (click/keydown) once. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    // a soft limiter on the sum: four guns plus an explosion used to clip into distortion
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);
    this.applySettings();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore no types shipped
    void import('zzfx').then((m: any) => (this.buildSamples = (...p: number[]) => m.ZZFX.buildSamples(...p)));
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  applySettings(s?: Partial<AudioSettings>) {
    if (s) Object.assign(this.settings, s);
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.musicBus.gain.value = this.settings.music;
    this.sfxBus.gain.value = this.settings.sfx;
    for (const [name, c] of this.channels) c.gain.gain.value = this.settings.channels?.[name] ?? c.fallbackVolume;
  }

  /**
   * A game's own volume channel: an extra bus under the master, with its own slider in the
   * settings. `defaultVolume` is used until the player has moved that slider once.
   * Returns null before unlock() – the caller then simply builds no sound.
   */
  channel(name: string, defaultVolume = 1): GainNode | null {
    if (!this.ctx) return null;
    let c = this.channels.get(name);
    if (!c) {
      const gain = this.ctx.createGain();
      gain.connect(this.master);
      c = { gain, fallbackVolume: defaultVolume };
      this.channels.set(name, c);
    } else {
      c.fallbackVolume = defaultVolume;
    }
    c.gain.gain.value = this.settings.channels?.[name] ?? c.fallbackVolume;
    return c.gain;
  }

  /** Channels asked for so far – the settings screen renders one slider per name. */
  channelNames() {
    return [...this.channels.keys()];
  }

  /**
   * Hand in a game's procedural sounds (ZzFX parameter arrays) – called from the game class, once
   * per match. Names are global, so a game that wants its own version of a sound gives it its own
   * name; registering the same table twice is a no-op in effect.
   */
  registerSfx(table: Record<string, SfxParams>) {
    Object.assign(this.presets, table);
  }

  /** Preset names currently known (UI table plus everything the games registered). */
  sfxNames() {
    return Object.keys(this.presets);
  }

  /** Generated sample files by sfx name, one URL per take; `name.v2.wav` is a take of `name`. */
  private sampleUrls = new Map<string, string[]>();
  /** Per name: take number (0 = base take) → the best format found for that take. */
  private sampleTakes = new Map<string, Map<number, { url: string; rank: number }>>();
  private samples = new Map<string, AudioBuffer[]>();
  private samplePending = new Set<string>();

  /**
   * Register generated samples from the asset manifest: every `sfx/<name>.wav|ogg|mp3` overrides
   * the ZzFX preset `<name>`. `sfx/<name>.v2.wav`, `.v3` … are alternative takes of the same sound
   * and one of them is picked at random on every play.
   *
   * Takes and formats are two different things: `name.wav` and `name.v2.wav` are two recordings and
   * both are loaded, while `name.ogg` and `name.wav` are the same recording in two containers and
   * only the better one is (see FORMAT_RANK) – exactly as registerMusic does it.
   */
  registerSamples(files: string[], base = '/assets/generated/', version?: string) {
    const stamp = version ? `?v=${encodeURIComponent(version)}` : '';
    for (const f of files) {
      const m = /^sfx\/([a-z0-9_-]+?)(?:\.v(\d+))?\.(wav|ogg|mp3)$/i.exec(f);
      if (!m) continue;
      const name = m[1]!;
      const take = m[2] ? Number(m[2]) : 0;
      const rank = formatRank(m[3]!);
      let takes = this.sampleTakes.get(name);
      if (!takes) this.sampleTakes.set(name, (takes = new Map()));
      const cur = takes.get(take);
      if (!cur || rank < cur.rank) takes.set(take, { url: base + f + stamp, rank });
      // base take first so a single-take sound is deterministic, the rest in file order
      this.sampleUrls.set(
        name,
        [...takes.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.url),
      );
    }
  }

  /** Music tracks by name (`music/<name>.<ext>` from the manifest), best format first. */
  private musicUrls = new Map<string, { url: string; rank: number }[]>();

  /** Register generated music from the asset manifest: `music/<name>.ogg|mp3|wav`. */
  registerMusic(files: string[], base = '/assets/generated/', version?: string) {
    const stamp = version ? `?v=${encodeURIComponent(version)}` : '';
    for (const f of files) {
      const m = /^music\/([a-z0-9_-]+)\.(ogg|mp3|wav)$/i.exec(f);
      if (!m) continue;
      const name = m[1]!;
      const list = this.musicUrls.get(name) ?? [];
      list.push({ url: base + f + stamp, rank: formatRank(m[2]!) });
      list.sort((a, b) => a.rank - b.rank);
      this.musicUrls.set(name, list);
    }
  }

  /** True when a generated music track exists under this name. */
  hasMusic(name: string) {
    return this.musicUrls.has(name);
  }

  /**
   * Play a registered track by name (extension-agnostic). Unknown names are silently ignored,
   * so a game can ask for its theme before the file has ever been generated.
   */
  async musicNamed(name: string, opts?: { fade?: number; loop?: boolean; volume?: number }) {
    const urls = this.musicUrls.get(name);
    if (!urls?.length) {
      await this.music(null, { fade: opts?.fade ?? 1 });
      return;
    }
    await this.music(urls[0]!.url, opts);
  }

  /** True when a generated sample exists for this name (decoded or still loading). */
  hasSample(name: string) {
    return this.sampleUrls.has(name);
  }

  /** All registered sample names (base names, variants collapsed). */
  sampleNames() {
    return [...this.sampleUrls.keys()];
  }

  /** The URLs a name will decode: one per take, in the best format available for that take. */
  takeUrls(name: string) {
    return [...(this.sampleUrls.get(name) ?? [])];
  }

  /**
   * Decode samples up front so the first shot in a match is not a fallback beep.
   * Pass names (base names) or nothing for everything registered.
   *
   * All at once on purpose. Rationing the concurrency was tried, because the whole set resolving
   * together drains one long microtask queue and the browser draws nothing until it is empty.
   * Measured against the live server, 77 names: all at once 335 / 334 ms total with a worst frame
   * of 80 / 53 ms; through a sliding window of sixteen, 351 / 315 ms with a worst frame of 93 /
   * 80 ms. No benefit, and a lock-step version of the same idea was actively harmful - on a cold
   * cache it serialised 3.5 MB into thirteen round trips, 11.6 s instead of 0.4 s.
   *
   * What actually keeps the stall out of the game is **when** this runs, not how: games await it
   * from `init()`, which the loading screen waits on. See `preloadWithin`.
   */
  async preload(names?: string[]) {
    if (!this.ctx) return;
    const list = names ?? this.sampleNames();
    await Promise.all(list.map((n) => this.decodeVariants(n)));
  }

  /**
   * `preload`, but a game start never waits longer than `ms` for it.
   *
   * Games call this from `init()`, which the loading screen waits on (`Play.tsx`), so the decoding
   * happens while the player is still looking at the loader instead of during the first seconds of
   * play. The deadline is the safety line: one slow file on a bad connection must not hold a match
   * hostage. Losing the race does not cancel anything — the rest keeps decoding in the background,
   * exactly as it did before, and the fallback beeps cover the gap.
   */
  async preloadWithin(names: string[] | undefined, ms: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((r) => (timer = setTimeout(r, ms)));
    await Promise.race([this.preload(names), deadline]);
    clearTimeout(timer);
  }

  private async decodeVariants(name: string) {
    const urls = this.sampleUrls.get(name);
    if (!urls || this.samples.has(name)) return;
    if (this.samplePending.has(name)) return;
    this.samplePending.add(name);
    const bufs = (await Promise.all(urls.map((u) => this.load(u)))).filter((b): b is AudioBuffer => !!b);
    this.samplePending.delete(name);
    if (bufs.length) this.samples.set(name, bufs);
  }

  /** Listener position/zoom for positional sfx. Set once per frame by the game. */
  listener: Listener | null = null;
  setListener(x: number, y: number, halfH: number) {
    this.listener = { x, y, halfH };
  }
  clearListener() {
    this.listener = null;
  }

  /**
   * Play a sound by name: a generated sample when one is registered (see registerSamples),
   * otherwise the ZzFX preset `name` or `opts.fallback`.
   * Pass `x`/`y` for positional playback (pan + distance attenuation + muffling).
   */
  sfx(name: string, opts: SfxOptions = {}) {
    if (!this.ctx || !this.ready) return;
    const now = performance.now();
    const t = opts.throttleMs ?? 30;
    if (now - (this.lastPlay.get(name) ?? -1e9) < t) return;

    // distance first: a sound far outside the view is not worth a voice at all
    let pan = 0;
    let distGain = 1;
    let muffle = 0;
    const L = this.listener;
    if (L && opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - L.x;
      const dy = opts.y - L.y;
      const d = Math.hypot(dx, dy) / Math.max(1, L.halfH);
      distGain = 1 / (1 + d * d * 1.1);
      if (distGain < 0.04) return;
      pan = Math.max(-0.85, Math.min(0.85, (dx / Math.max(1, L.halfH * 1.6)) * 0.85));
      muffle = Math.min(1, Math.max(0, d - 0.7) / 1.8);
    }

    const live = this.voices.get(name) ?? 0;
    if (live >= (opts.maxVoices ?? 4)) return;
    this.lastPlay.set(name, now);

    const bufs = this.samples.get(name);
    let buf: AudioBuffer | undefined = bufs?.length ? bufs[(this.rnd() * bufs.length) | 0] : undefined;
    const isSample = !!buf;
    if (!buf && this.sampleUrls.has(name)) {
      // first use without preload: decode in the background, play the procedural fallback this once
      void this.decodeVariants(name);
    }
    if (!buf) {
      if (!this.buildSamples) return;
      const key = this.presets[name] ? name : (opts.fallback ?? name);
      const params = this.presets[key];
      if (!params) return;
      buf = this.sfxCache.get(key);
      if (!buf) {
        const samples = this.buildSamples(...params);
        buf = this.ctx.createBuffer(1, samples.length, 44100);
        buf.getChannelData(0).set(samples);
        this.sfxCache.set(key, buf);
      }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const pv = opts.pitchVar ?? (isSample ? 0.06 : 0);
    src.playbackRate.value = opts.rate ?? (pv ? 1 + (this.rnd() * 2 - 1) * pv : 1);
    const gv = opts.gainVar ?? 0.12;
    const g = this.ctx.createGain();
    g.gain.value = (opts.volume ?? 1) * distGain * (1 - this.rnd() * gv);

    let node: AudioNode = src;
    if (muffle > 0.02) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 20000 - muffle * 18200;
      node.connect(lp);
      node = lp;
    }
    node.connect(g);
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    this.voices.set(name, live + 1);
    src.onended = () => this.voices.set(name, Math.max(0, (this.voices.get(name) ?? 1) - 1));
    src.start();
  }

  private async load(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const cached = this.buffers.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(url, buf);
      return buf;
    } catch {
      return null;
    }
  }

  /** Crossfade to a music track. Missing files are silently ignored (placeholders = silence). */
  async music(url: string | null, { fade = 1.0, loop = true, volume = 1 } = {}) {
    if (!this.ctx) return;
    if (url === this.currentMusic) return;
    this.currentMusic = url ?? '';
    const t = this.ctx.currentTime;
    if (this.musicSrc && this.musicGain) {
      const old = this.musicSrc;
      const og = this.musicGain;
      og.gain.setTargetAtTime(0, t, fade / 3);
      setTimeout(() => {
        try {
          old.stop();
        } catch {
          /* ignore */
        }
        og.disconnect();
      }, fade * 1000 + 100);
      this.musicSrc = null;
      this.musicGain = null;
    }
    if (!url) return;
    const buf = await this.load(url);
    if (!buf || this.currentMusic !== url) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(this.musicBus);
    src.start();
    this.musicVolume = volume;
    g.gain.setTargetAtTime(volume, this.ctx.currentTime, fade / 3);
    this.musicSrc = src;
    this.musicGain = g;
  }

  /** Duck the music for a moment (round banner, big explosion). */
  duckMusic(to = 0.35, seconds = 1.2) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    // back to the level this track was started with – restoring to a flat 1 turned every duck
    // into a volume boost, because every caller passes a trim below 1
    this.musicGain.gain.setTargetAtTime(to * this.musicVolume, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, t + seconds, seconds / 3);
  }

  stopMusic(fade = 0.5) {
    void this.music(null, { fade });
  }
}

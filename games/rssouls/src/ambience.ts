import type { AudioManager } from '@pv/engine';

/**
 * The area's ambience under the music: wind, drips, machines (tools/assets/gen_ambience_rssouls.py →
 * src/assets/audio/amb_<area>.ogg). One looping buffer per area on the game's own channel – which
 * gives it its own slider in the hub's settings – crossfaded when the area changes.
 *
 * Silent until the audio is unlocked by the first click or key, and when a loop is missing.
 */
const URLS = import.meta.glob('./assets/audio/amb_*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URL_OF: Record<string, string> = {};
for (const [path, url] of Object.entries(URLS)) URL_OF[path.split('/').pop()!.replace(/^amb_|\.ogg$/g, '')] = url;

/** Room themes that share an ambience. */
const AREA_OF: Record<string, string> = { schanze: 'stadt' };

export const AMBIENCE_CHANNEL = 'RS Souls · Umgebung';
const FADE = 2;

export class Ambience {
  private want = '';
  private playing = '';
  private current: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();

  constructor(private audio: AudioManager) {}

  /** The area to sound like (a room theme). */
  set(theme: string) {
    this.want = URL_OF[AREA_OF[theme] ?? theme] ? (AREA_OF[theme] ?? theme) : '';
  }

  /** Call now and then (a few times a second): starts or swaps the loop once audio is up. */
  tick() {
    if (this.want === this.playing) return;
    const bus = this.audio.channel(AMBIENCE_CHANNEL, 0.55);
    if (!bus) return;
    const ctx = bus.context as AudioContext;
    const name = this.want;
    this.playing = name;
    this.fadeOut(ctx);
    if (!name) return;
    void this.buffer(ctx, name).then((buf) => {
      if (!buf || this.playing !== name) return;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);
      gain.connect(bus);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start();
      this.current = { src, gain };
    });
  }

  private buffer(ctx: AudioContext, name: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      p = fetch(URL_OF[name]!)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(name, p);
    }
    return p;
  }

  private fadeOut(ctx: AudioContext, seconds = FADE) {
    const c = this.current;
    this.current = null;
    if (!c) return;
    c.gain.gain.cancelScheduledValues(ctx.currentTime);
    c.gain.gain.setValueAtTime(c.gain.gain.value, ctx.currentTime);
    c.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
    c.src.stop(ctx.currentTime + seconds + 0.05);
  }

  dispose() {
    const bus = this.audio.channel(AMBIENCE_CHANNEL, 0.55);
    if (bus) this.fadeOut(bus.context as AudioContext, 0.4);
    this.want = this.playing = '';
  }
}

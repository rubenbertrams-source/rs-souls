import * as THREE from 'three';
import { Rng } from '../../math/rng';

/**
 * Procedural ground textures: flat, two-to-three-tone, seamless by construction, coloured from the
 * venue palette so road, terrain and props read as one place (plan/07-LOOK.md).
 *
 * Why not generated images: a diffusion texture carries photographic detail that fights the
 * three-step toon ramp, repeats a visible "hero blob" every tile, and was never matched to the
 * palette. These are drawn on a canvas at load time (a few milliseconds each) and cached.
 *
 * Seamlessness: every primitive near an edge is stamped again at the ±size offsets (3×3 wrap),
 * periodic patterns use wavelengths that divide the size, and grids divide the size.
 */

export type GroundKind = 'asphalt' | 'cobble' | 'dirt' | 'grass' | 'sand' | 'packed' | 'lava' | 'water';

export interface GroundColors {
  base: string;
  /** Second tone for patches / stones. */
  alt: string;
  dark: string;
  light: string;
  /** Lava only: crack glow (also the emissive colour). */
  glow?: string;
}

export interface GroundTextures {
  map: THREE.CanvasTexture;
  /** Lava: the cracks on black, for `emissiveMap`. */
  emissive?: THREE.CanvasTexture;
}

export interface GroundOptions {
  /** Canvas size in px (default 512). */
  size?: number;
  anisotropy?: number;
}

const cache = new Map<string, GroundTextures>();

/** Cached per kind + colours + seed; the same venue always gets the same texture object. */
export function groundTexture(kind: GroundKind, colors: GroundColors, seed: number, opts: GroundOptions = {}): GroundTextures {
  const size = opts.size ?? 512;
  const key = `${kind}|${colors.base}|${colors.alt}|${colors.dark}|${colors.light}|${colors.glow ?? ''}|${seed}|${size}`;
  let t = cache.get(key);
  if (!t) {
    t = draw(kind, colors, seed, size);
    cache.set(key, t);
  }
  if (opts.anisotropy) {
    t.map.anisotropy = opts.anisotropy;
    if (t.emissive) t.emissive.anisotropy = opts.anisotropy;
  }
  return t;
}

/** Drop cached textures (tests / hot reload). */
export function clearGroundCache() {
  for (const t of cache.values()) {
    t.map.dispose();
    t.emissive?.dispose();
  }
  cache.clear();
}

type Ctx = CanvasRenderingContext2D;

/** Canvas + helpers that draw every primitive with wrap-around copies. */
class Tile {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
  constructor(readonly size: number, fill: string) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(0, 0, size, size);
  }

  /** Run `draw` at (x, y) and again shifted by ±size wherever the primitive (radius r) crosses an edge. */
  stamp(x: number, y: number, r: number, draw: (cx: number, cy: number) => void) {
    const s = this.size;
    const xs = [0];
    const ys = [0];
    if (x - r < 0) xs.push(s);
    if (x + r > s) xs.push(-s);
    if (y - r < 0) ys.push(s);
    if (y + r > s) ys.push(-s);
    for (const dx of xs) for (const dy of ys) draw(x + dx, y + dy);
  }

  ellipse(x: number, y: number, rx: number, ry: number, color: string, alpha = 1, rot = 0) {
    const c = this.ctx;
    c.fillStyle = color;
    c.globalAlpha = alpha;
    this.stamp(x, y, Math.max(rx, ry), (cx, cy) => {
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
  }

  /** Short stroke from (x, y) along `angle` – blades of grass, scratches. */
  tick(x: number, y: number, len: number, angle: number, width: number, color: string, alpha = 1) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.globalAlpha = alpha;
    const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
    this.stamp(x, y, len, (cx, cy) => {
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + dx, cy + dy);
      c.stroke();
    });
    c.globalAlpha = 1;
  }

  /** Full-height vertical band (seamless in y; wrapped in x). */
  band(x: number, w: number, color: string, alpha: number) {
    const c = this.ctx;
    c.fillStyle = color;
    c.globalAlpha = alpha;
    this.stamp(x, this.size / 2, w / 2, (cx) => c.fillRect(cx - w / 2, -1, w, this.size + 2));
    c.globalAlpha = 1;
  }

  /**
   * Horizontal wavy line y = y0 + amp·sin(2π·k·x/size + phase): periodic in x by construction,
   * drawn again at ±size in y when it touches the top/bottom edge.
   */
  wave(y0: number, amp: number, k: number, phase: number, width: number, color: string, alpha = 1) {
    const c = this.ctx;
    const s = this.size;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalAlpha = alpha;
    const draw = (dy: number) => {
      c.beginPath();
      for (let x = -4; x <= s + 4; x += 4) {
        const y = y0 + dy + amp * Math.sin((2 * Math.PI * k * x) / s + phase);
        if (x === -4) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    };
    draw(0);
    if (y0 - amp - width < 0) draw(s);
    if (y0 + amp + width > s) draw(-s);
    c.globalAlpha = 1;
  }

  /** Polyline through wrapped points (cracks). Segments are drawn at every offset that touches the tile. */
  path(points: [number, number][], width: number, color: string, alpha = 1) {
    const c = this.ctx;
    const s = this.size;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalAlpha = alpha;
    for (const dx of [-s, 0, s])
      for (const dy of [-s, 0, s]) {
        c.beginPath();
        points.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)));
        c.stroke();
      }
    c.globalAlpha = 1;
  }

  texture(): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    // mipmaps + linear: at distance the detail averages into a calm tone (nearest would shimmer)
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
}

/** Slightly varied copy of a colour (lightness only, keeps the palette hue). */
function shade(color: string, amount: number): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0.03, 0.97));
  return '#' + c.getHexString();
}

function draw(kind: GroundKind, col: GroundColors, seed: number, size: number): GroundTextures {
  const rng = new Rng(seed);
  const s = size;
  const px = s / 512; // recipes are tuned for 512 and scale with the canvas
  const rnd = (a: number, b: number) => a + rng.next() * (b - a);
  // Hand-tuned recipes (2026-09-05). Guiding rules: three clearly separated tones per surface so
  // the toon ramp still shows structure at 20–40 m, a "macro" layer (patches, ruts, ripples) that
  // survives mipmapping, and a "micro" layer (specks, blades) that only shows up close.
  switch (kind) {
    case 'grass': {
      const t = new Tile(s, col.base);
      // macro: soft two-tone patches, a few darker "moist" pools so the meadow is not one green
      for (let i = 0; i < 40; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(26, 70) * px, rnd(16, 44) * px, i % 4 === 0 ? col.light : col.alt, i % 4 === 0 ? 0.35 : 0.55, rnd(0, Math.PI));
      for (let i = 0; i < 12; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(30, 60) * px, rnd(18, 34) * px, col.dark, 0.35, rnd(0, Math.PI));
      // clover clusters: three dark dots with a light centre – reads as texture, not noise
      for (let i = 0; i < 70; i++) {
        const x = rnd(0, s), y = rnd(0, s), r = rnd(2.2, 3.4) * px;
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + rnd(-0.3, 0.3);
          t.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r, r * 0.85, col.dark, 0.55);
        }
        t.ellipse(x, y, r * 0.6, r * 0.6, col.light, 0.5);
      }
      // micro: blade ticks leaning slightly with a shared "wind" direction
      const wind = rnd(-0.35, 0.35);
      for (let i = 0; i < 420; i++) {
        const a = -Math.PI / 2 + wind + rnd(-0.45, 0.45);
        t.tick(rnd(0, s), rnd(0, s), rnd(3.5, 7) * px, a, 1.7 * px, i % 4 === 0 ? col.light : col.dark, 0.7);
      }
      // sparse tiny flowers (white / light) – the meadow sparkles a little
      for (let i = 0; i < 26; i++) {
        const x = rnd(0, s), y = rnd(0, s);
        t.ellipse(x, y, 2.2 * px, 2.2 * px, '#ffffff', 0.85);
        t.ellipse(x, y, 1 * px, 1 * px, col.light, 1);
      }
      return { map: t.texture() };
    }
    case 'sand': {
      const t = new Tile(s, col.base);
      for (let i = 0; i < 16; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(50, 110) * px, rnd(24, 60) * px, i % 2 ? col.alt : col.light, 0.45, rnd(0, Math.PI));
      // wind ripples: light crest with a dark trough right below, two wavelengths interleaved
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const y = ((i + rnd(0.25, 0.75)) / rows) * s;
        const phase = rnd(0, Math.PI * 2);
        const k = i % 3 === 0 ? 4 : 3;
        t.wave(y + 2.2 * px, 4.5 * px, k, phase, 1.4 * px, col.dark, 0.32);
        t.wave(y, 4.5 * px, k, phase, 2.2 * px, col.light, 0.7);
      }
      // shells and pebbles: a white fleck with a dark shadow dot – very cheap, very "beach"
      for (let i = 0; i < 34; i++) {
        const x = rnd(0, s), y = rnd(0, s), r = rnd(1.6, 3.2) * px;
        t.ellipse(x + 0.8 * px, y + 1.2 * px, r, r * 0.8, col.dark, 0.55, rnd(0, Math.PI));
        t.ellipse(x, y, r, r * 0.8, i % 4 === 0 ? '#ff9a8a' : '#fffaf0', 0.95, rnd(0, Math.PI));
      }
      for (let i = 0; i < 90; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(0.8, 1.6) * px, rnd(0.8, 1.6) * px, i % 2 ? col.dark : col.light, 0.6);
      return { map: t.texture() };
    }
    case 'packed': {
      // hard-packed sand / coral gravel racing surface: darker than the dunes, with wear bands
      const t = new Tile(s, col.base);
      for (let i = 0; i < 12; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(50, 120) * px, rnd(30, 70) * px, i % 2 ? col.alt : col.light, 0.35, rnd(0, Math.PI));
      // driving lines: two broad ruts (dark) with a lighter ridge between them
      t.band(s * 0.28, 44 * px, col.dark, 0.22);
      t.band(s * 0.72, 44 * px, col.dark, 0.22);
      t.band(s * 0.5, 26 * px, col.light, 0.16);
      // coral / shell gravel specks and a few hairline cracks
      for (let i = 0; i < 160; i++) {
        const r = rnd(1, 2.6) * px;
        const tone = i % 5 === 0 ? '#ffb3a0' : i % 3 === 0 ? col.light : col.dark;
        t.ellipse(rnd(0, s), rnd(0, s), r, r * rnd(0.6, 1), tone, 0.75, rnd(0, Math.PI));
      }
      for (let i = 0; i < 18; i++) t.tick(rnd(0, s), rnd(0, s), rnd(8, 22) * px, rnd(0, Math.PI), 1 * px, col.dark, 0.4);
      return { map: t.texture() };
    }
    case 'dirt': {
      const t = new Tile(s, col.base);
      for (let i = 0; i < 12; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(50, 110) * px, rnd(30, 70) * px, i % 3 === 0 ? col.light : col.alt, 0.4, rnd(0, Math.PI));
      // two tyre ruts along the driving direction (v axis = along the road): dark trough, light rims
      for (const x of [0.3, 0.7]) {
        t.band(s * x, 40 * px, col.light, 0.14);
        t.band(s * x, 30 * px, col.dark, 0.28);
      }
      // pebbles with a highlight on the top-left edge, some half-buried stones
      for (let i = 0; i < 110; i++) {
        const x = rnd(0, s), y = rnd(0, s), r = rnd(2, 6.5) * px, ry = r * rnd(0.6, 1), rot = rnd(0, Math.PI);
        t.ellipse(x, y, r, ry, i % 4 === 0 ? col.alt : col.dark, 0.9, rot);
        t.ellipse(x - r * 0.25, y - ry * 0.3, r * 0.5, ry * 0.4, col.light, 0.55, rot);
      }
      // dry cracks
      for (let i = 0; i < 14; i++) {
        const x = rnd(0, s), y = rnd(0, s), a = rnd(0, Math.PI), l = rnd(10, 30) * px;
        t.tick(x, y, l, a, 1.2 * px, col.dark, 0.55);
        t.tick(x + Math.cos(a) * l, y + Math.sin(a) * l, l * 0.6, a + rnd(-0.9, 0.9), 1 * px, col.dark, 0.45);
      }
      return { map: t.texture() };
    }
    case 'asphalt': {
      const t = new Tile(s, col.base);
      // three faint wear bands, then fine speckle (mipmaps average it into a slight grain)
      t.band(s * 0.25, 60 * px, col.dark, 0.16);
      t.band(s * 0.75, 60 * px, col.dark, 0.16);
      t.band(s * 0.5, 40 * px, col.alt, 0.14);
      for (let i = 0; i < 2600; i++) t.ellipse(rnd(0, s), rnd(0, s), 1 * px, 1 * px, i % 2 ? col.light : col.dark, 0.38);
      for (let i = 0; i < 46; i++) t.tick(rnd(0, s), rnd(0, s), rnd(6, 20) * px, rnd(0, Math.PI), 1 * px, col.dark, 0.32);
      // a few tar patches – the classic "repaired road" look
      for (let i = 0; i < 5; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(14, 30) * px, rnd(8, 16) * px, col.dark, 0.35, rnd(0, Math.PI));
      return { map: t.texture() };
    }
    case 'cobble': {
      const t = new Tile(s, col.dark);
      const n = 8;
      const cell = s / n;
      const gap = 2.5 * px;
      const c = t.ctx;
      for (let gy = 0; gy < n; gy++)
        for (let gx = 0; gx < n; gx++) {
          // stones sit on a grid that divides the size, so the tile wraps; corners jitter a little
          const x0 = gx * cell + gap + rnd(-1, 1) * px, y0 = gy * cell + gap + rnd(-1, 1) * px;
          const w = cell - 2 * gap + rnd(-2, 2) * px, h = cell - 2 * gap + rnd(-2, 2) * px;
          const tone = rng.next();
          const fill = tone < 0.5 ? col.base : tone < 0.8 ? col.alt : shade(col.base, rnd(-0.06, 0.06));
          const r = Math.min(w, h) * 0.28;
          c.fillStyle = fill;
          t.stamp(x0 + w / 2, y0 + h / 2, Math.max(w, h), (cx, cy) => {
            c.beginPath();
            c.roundRect(cx - w / 2, cy - h / 2, w, h, r);
            c.fill();
          });
          // a light edge on the top-left of each stone reads as a bevel under the toon ramp
          t.tick(x0 + r, y0 + 1.5 * px, w - 2 * r, 0, 1.6 * px, col.light, 0.45);
          t.tick(x0 + 1.5 * px, y0 + r, h - 2 * r, Math.PI / 2, 1.2 * px, col.light, 0.3);
          // occasional chipped corner / ash speck
          if (tone > 0.9) t.ellipse(x0 + rnd(r, w - r), y0 + rnd(r, h - r), rnd(2, 4) * px, rnd(2, 3) * px, col.dark, 0.5, rnd(0, Math.PI));
        }
      // ash dust in the gaps
      for (let i = 0; i < 120; i++) t.ellipse(rnd(0, s), rnd(0, s), 1 * px, 1 * px, col.light, 0.25);
      return { map: t.texture() };
    }
    case 'lava': {
      const glow = col.glow ?? col.light;
      const t = new Tile(s, col.dark);
      const e = new Tile(s, '#000000');
      for (let i = 0; i < 12; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(40, 100) * px, rnd(30, 60) * px, col.alt, 0.5, rnd(0, Math.PI));
      // cooled crust plates: slightly lighter rounded blobs so the black is not flat
      for (let i = 0; i < 30; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(12, 30) * px, rnd(8, 20) * px, col.base, 0.35, rnd(0, Math.PI));
      // cracks: jittered polylines between nearby seed points, drawn as a wide dim halo, a bright core, and on the emissive tile
      const pts: [number, number][] = [];
      for (let i = 0; i < 36; i++) pts.push([rnd(0, s), rnd(0, s)]);
      const wrapD = (a: [number, number], b: [number, number]) => {
        let dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
        dx = Math.min(dx, s - dx);
        dy = Math.min(dy, s - dy);
        return Math.hypot(dx, dy);
      };
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const near = pts
          .map((p, j) => ({ j, d: wrapD(a, p) }))
          .filter((x) => x.j !== i)
          .sort((x, y) => x.d - y.d)
          .slice(0, 2);
        for (const { j } of near) {
          if (j < i) continue;
          const b = pts[j]!;
          // take the short way round the torus
          const bx = Math.abs(b[0] - a[0]) > s / 2 ? b[0] - Math.sign(b[0] - a[0]) * s : b[0];
          const by = Math.abs(b[1] - a[1]) > s / 2 ? b[1] - Math.sign(b[1] - a[1]) * s : b[1];
          const mid: [number, number] = [(a[0] + bx) / 2 + rnd(-12, 12) * px, (a[1] + by) / 2 + rnd(-12, 12) * px];
          const line: [number, number][] = [a, mid, [bx, by]];
          t.path(line, 7 * px, col.base, 0.55);
          t.path(line, 2.2 * px, glow, 1);
          e.path(line, 5 * px, glow, 0.35);
          e.path(line, 2.2 * px, glow, 1);
        }
      }
      // embers: tiny glowing specks away from the cracks
      for (let i = 0; i < 40; i++) {
        const x = rnd(0, s), y = rnd(0, s);
        t.ellipse(x, y, 1.4 * px, 1.4 * px, glow, 0.9);
        e.ellipse(x, y, 1.6 * px, 1.6 * px, glow, 0.7);
      }
      return { map: t.texture(), emissive: e.texture() };
    }
    case 'water': {
      const t = new Tile(s, col.base);
      for (let i = 0; i < 10; i++) t.ellipse(rnd(0, s), rnd(0, s), rnd(60, 120) * px, rnd(30, 60) * px, col.alt, 0.35, rnd(0, Math.PI));
      // two wave sets with different wavelengths: reads as a second layer without a second draw call
      for (let i = 0; i < 9; i++) {
        const y = ((i + rnd(0.2, 0.8)) / 9) * s;
        t.wave(y, 5 * px, 4, rnd(0, Math.PI * 2), 2.2 * px, col.light, 0.8);
      }
      for (let i = 0; i < 6; i++) {
        const y = ((i + rnd(0.2, 0.8)) / 6) * s;
        t.wave(y, 4 * px, 7, rnd(0, Math.PI * 2), 1.2 * px, col.alt, 0.7);
      }
      // sparkle: short bright dashes on the crests
      for (let i = 0; i < 40; i++) t.tick(rnd(0, s), rnd(0, s), rnd(3, 8) * px, rnd(-0.2, 0.2), 1.4 * px, '#ffffff', 0.5);
      return { map: t.texture() };
    }
  }
}

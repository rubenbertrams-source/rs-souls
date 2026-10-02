import * as THREE from 'three';
import type { Rng } from '../../math/rng';
import type { GroundColors } from './ground';

export type ThemeId = 'beach' | 'meadow' | 'volcano' | 'test';

/** Per-venue colour set: every procedural prop picks its colours from here so a track reads as one place. */
export interface Palette {
  trunk: string;
  trunkDark: string;
  /** Foliage greens (round trees, bushes, palm fronds). */
  leaf: string[];
  /** Pine / dark foliage. */
  leafDark: string;
  /** Dry, sun-bleached growth: dune grass, straw. The lush `leaf` greens are tuned for foliage seen
   *  against the sky and look poisonous at ground level on sand. */
  leafDry: string[];
  rock: string;
  rockDark: string;
  wood: string;
  woodDark: string;
  /** Bright accents: mushroom caps, balloons, tire stripes, flowers. */
  accent: string[];
  /** Emissive-looking (unlit) colour for lanterns / windows. */
  glow: string;
  crystal: string[];
  cloud: string;
  /** Soft ground blobs (flowers / pebbles / embers). */
  detail: string[];
  /** Ground textures (procedural, see ground.ts): the road surface, the terrain, and the water/lava plane. */
  terrain: {
    road: GroundColors;
    ground: GroundColors;
    liquid: GroundColors;
  };
  light: {
    sun: string;
    sunIntensity: number;
    sky: string;
    ground: string;
    hemiIntensity: number;
    fogNear: number;
    fogFar: number;
  };
}

const MEADOW: Palette = {
  trunk: '#7c4f2b',
  trunkDark: '#5a381e',
  leaf: ['#4fc24e', '#3aa63f', '#66d15a', '#2f9a3c'],
  leafDark: '#2b7a3a',
  leafDry: ['#9ab04a', '#b6b366', '#87a044'],
  rock: '#9aa3ab',
  rockDark: '#6b737a',
  wood: '#b07a42',
  woodDark: '#8a5a2e',
  accent: ['#e0433a', '#ff8c1a', '#ffd23a', '#ff6fb5', '#f4f1e8'],
  glow: '#ffe28a',
  crystal: ['#7ee8ff', '#b26bff'],
  cloud: '#f6faff',
  detail: ['#ff6fb5', '#ffd23a', '#ffffff', '#ff8c1a'],
  terrain: {
    road: { base: '#6e5a44', alt: '#7d6850', dark: '#5a4736', light: '#8f7a5e' },
    ground: { base: '#62c35a', alt: '#55b24d', dark: '#449a42', light: '#82d972' },
    liquid: { base: '#3d9be8', alt: '#4fb0f0', dark: '#2f7fc0', light: '#bfe9ff' },
  },
  light: { sun: '#fff6e0', sunIntensity: 2.3, sky: '#8fd0ff', ground: '#63c45c', hemiIntensity: 1.1, fogNear: 130, fogFar: 430 },
};

export const PALETTES: Record<ThemeId, Palette> = {
  meadow: MEADOW,
  test: {
    ...MEADOW,
    terrain: { ...MEADOW.terrain, road: { base: '#4b4b5c', alt: '#525266', dark: '#3c3c4a', light: '#6a6a7c' } },
    light: { ...MEADOW.light, sky: '#7cc0ff', ground: '#5fbf5a' },
  },
  beach: {
    trunk: '#a86f3f',
    trunkDark: '#7e4f28',
    leaf: ['#3fbf5a', '#5ccf6e', '#2fa54e', '#8fdc6a'],
    leafDark: '#2e8f4a',
    leafDry: ['#9cb85a', '#c8c07a', '#8aa84e', '#d8cf94'],
    rock: '#cfc6b3',
    rockDark: '#9f9585',
    wood: '#c48a4a',
    woodDark: '#8f6030',
    accent: ['#ff6b57', '#2fd0c8', '#ffd23a', '#ff8c1a', '#fff4dc'],
    glow: '#ffd27a',
    crystal: ['#2fd0c8', '#7ee8ff'],
    cloud: '#ffffff',
    detail: ['#ff6b57', '#fff4dc', '#2fd0c8', '#ffd23a'],
    terrain: {
      // packed coral-sand racing surface: clearly darker and warmer than the dunes beside it
      road: { base: '#c9a46a', alt: '#bf9a5f', dark: '#a37f4c', light: '#dcbd86' },
      ground: { base: '#ecdcaa', alt: '#e4d29a', dark: '#d2bd82', light: '#f7ecc4' },
      liquid: { base: '#2fb6d8', alt: '#3fc5e6', dark: '#2494b3', light: '#bfeeff' },
    },
    light: { sun: '#fff4dc', sunIntensity: 2.5, sky: '#7cc8ff', ground: '#e9d9a3', hemiIntensity: 1.15, fogNear: 150, fogFar: 500 },
  },
  volcano: {
    trunk: '#3a2f2f',
    trunkDark: '#241d1d',
    leaf: ['#5a4a3a'],
    leafDark: '#3a2f2f',
    leafDry: ['#6a5a44', '#7a6a50'],
    rock: '#5c5464',
    rockDark: '#2e2832',
    wood: '#4a3a36',
    woodDark: '#2e2422',
    accent: ['#ff6a1a', '#ffb347', '#ff3d1a'],
    glow: '#ff8a2a',
    crystal: ['#b26bff', '#7ee8ff', '#ff5fd2'],
    cloud: '#3a2a33',
    detail: ['#ff6a1a', '#ffb347', '#ff3d1a'],
    terrain: {
      road: { base: '#4a4048', alt: '#56495a', dark: '#2a2230', light: '#6a5c6e' },
      ground: { base: '#3a2a2a', alt: '#4a3232', dark: '#241a1a', light: '#ffb347', glow: '#ff5a1a' },
      liquid: { base: '#7a2a1a', alt: '#8f3a1a', dark: '#3a1a12', light: '#ffb347', glow: '#ff5a1a' },
    },
    light: { sun: '#ffc090', sunIntensity: 2.0, sky: '#7a3a4a', ground: '#ff5a22', hemiIntensity: 1.2, fogNear: 80, fogFar: 340 },
  },
};

export function paletteFor(theme?: string): Palette {
  return PALETTES[(theme as ThemeId) ?? 'meadow'] ?? MEADOW;
}

/** Hue/lightness-jittered copy of a colour (kept in linear space, clamped). */
export function vary(color: THREE.ColorRepresentation, rng: Rng, amount = 0.08): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + (rng.next() - 0.5) * amount * 0.5 + 1) % 1;
  hsl.s = THREE.MathUtils.clamp(hsl.s + (rng.next() - 0.5) * amount, 0, 1);
  hsl.l = THREE.MathUtils.clamp(hsl.l + (rng.next() - 0.5) * amount * 1.5, 0.04, 0.96);
  return c.setHSL(hsl.h, hsl.s, hsl.l);
}

/** Lighter / darker shade of a colour (factor > 1 lightens). */
export function shade(color: THREE.ColorRepresentation, factor: number): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l * factor, 0.03, 0.97));
}

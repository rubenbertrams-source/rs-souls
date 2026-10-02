/**
 * The placeholder look per enemy and per room theme. Colour carries meaning (UEBERGABE §3.3):
 * green is pure, yellow/black is NEBELWERK and fossil, rust is the Rosttal, cyan is dead tech.
 */

export interface EnemyStyle {
  body: string;
  accent: string;
  eye: string;
  /** How the box is dressed: legs (crawler), tall (humanoid/drone), blob, giant. */
  shape: 'legs' | 'tall' | 'blob' | 'giant';
  /** Extra piece in front: a shield, a hammer arm, a club. */
  gear?: 'shield' | 'hammer' | 'club' | 'none';
}

export const ENEMY_STYLE: Record<string, EnemyStyle> = {
  'rost-spinner': { body: '#8a4b2a', accent: '#5a301b', eye: '#ffd23f', shape: 'legs' },
  ratte: { body: '#5b4a40', accent: '#3a2e28', eye: '#ff5a4a', shape: 'legs' },
  'schrott-drohne': { body: '#6b6458', accent: '#3f3a33', eye: '#ffb347', shape: 'tall', gear: 'hammer' },
  schildtraeger: { body: '#7a5a3a', accent: '#a88a5a', eye: '#ffd23f', shape: 'tall', gear: 'shield' },
  'rohr-kriecher': { body: '#3f4a3a', accent: '#28301f', eye: '#c8ff5a', shape: 'legs' },
  'nebelwerk-wache': { body: '#2a2a2a', accent: '#e8c34a', eye: '#e8c34a', shape: 'tall', gear: 'club' },
  teerbinder: { body: '#151515', accent: '#3a3a3a', eye: '#d8d2c4', shape: 'blob' },
  'schrott-golem': { body: '#6a5f52', accent: '#8a4b2a', eye: '#ffb347', shape: 'giant' },
  'verwerter-konstrukt': { body: '#4a4f52', accent: '#e8c34a', eye: '#ff6b2a', shape: 'giant', gear: 'hammer' },
  'russ-kriecher': { body: '#1e1b1c', accent: '#0e0c0d', eye: '#ff6b2a', shape: 'legs' },
  'glut-wild': { body: '#5a2a1a', accent: '#ff6b2a', eye: '#ffd23f', shape: 'legs' },
  'sensor-drohne': { body: '#2a2a2a', accent: '#e8c34a', eye: '#5ad1ff', shape: 'blob' },
  'kommandantin-riss': { body: '#2e2a26', accent: '#e8c34a', eye: '#e8c34a', shape: 'tall', gear: 'club' },
  'schlund-waechter': { body: '#26222a', accent: '#5a4a6a', eye: '#b06aff', shape: 'giant' },
  'oel-leviathan': { body: '#0e0e10', accent: '#2a2a30', eye: '#d8d2c4', shape: 'blob' },
  garde: { body: '#1e1e22', accent: '#e8c34a', eye: '#5ad1ff', shape: 'tall', gear: 'shield' },
  vorarbeiter: { body: '#5a4a3a', accent: '#c8692f', eye: '#ffd23f', shape: 'tall', gear: 'hammer' },
  'riot-kommandeur': { body: '#141416', accent: '#ff3b3b', eye: '#ff3b3b', shape: 'tall', gear: 'club' },
  assistent: { body: '#c8ccd0', accent: '#5ad1ff', eye: '#5ad1ff', shape: 'tall', gear: 'club' },
  'sezier-golem': { body: '#8a9096', accent: '#5ad1ff', eye: '#5ad1ff', shape: 'giant', gear: 'club' },
  exponat: { body: '#1a1420', accent: '#6a3a8a', eye: '#b06aff', shape: 'tall' },
  schwarzkittel: { body: '#0e0e10', accent: '#e8c34a', eye: '#5ad1ff', shape: 'giant', gear: 'club' },
  'doktor-asche': { body: '#e8e4dc', accent: '#ff6b2a', eye: '#ff6b2a', shape: 'tall', gear: 'club' },
};

export const DEFAULT_STYLE: EnemyStyle = { body: '#7a3a3a', accent: '#3a1a1a', eye: '#ffd23f', shape: 'tall' };

export interface Theme {
  sky: string;
  far: string;
  solid: string;
  top: string;
  oneWay: string;
  /** Faint overall haze colour (smog, darkness). */
  haze: string;
  hazeOpacity: number;
}

export const THEMES: Record<string, Theme> = {
  rosttal: { sky: '#16171c', far: '#1f2026', solid: '#2c2723', top: '#5c4b3b', oneWay: '#4a3b2e', haze: '#8a8455', hazeOpacity: 0.05 },
  rohr: { sky: '#121614', far: '#1a201d', solid: '#262b27', top: '#4a5a4a', oneWay: '#3a4a3a', haze: '#6a7a55', hazeOpacity: 0.08 },
  unter: { sky: '#0c0d0f', far: '#14161a', solid: '#1f2124', top: '#3a4048', oneWay: '#30343a', haze: '#000000', hazeOpacity: 0.25 },
  pumpe: { sky: '#101418', far: '#182028', solid: '#24292e', top: '#4a5560', oneWay: '#38424c', haze: '#5ad1ff', hazeOpacity: 0.04 },
  ader: { sky: '#0b0a0c', far: '#151217', solid: '#1c1a1e', top: '#3a2f3a', oneWay: '#2e2630', haze: '#000000', hazeOpacity: 0.2 },
  wald: { sky: '#0f1a14', far: '#173022', solid: '#1f2a20', top: '#4a7a4a', oneWay: '#33503a', haze: '#5dff86', hazeOpacity: 0.03 },
  schanze: { sky: '#16161a', far: '#22222a', solid: '#2e2e34', top: '#6a6a72', oneWay: '#46464e', haze: '#e8c34a', hazeOpacity: 0.03 },
  stadt: { sky: '#121822', far: '#1c2636', solid: '#262e3a', top: '#7a9ab8', oneWay: '#3e4e62', haze: '#5ad1ff', hazeOpacity: 0.04 },
  labor: { sky: '#0e1012', far: '#181c20', solid: '#22272c', top: '#c8ccd0', oneWay: '#3a4048', haze: '#ff6b2a', hazeOpacity: 0.03 },
};

export const DEFAULT_THEME = THEMES.rosttal!;

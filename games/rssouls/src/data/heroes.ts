import type { I18n } from '@pv/game-api';
import type { HeroDef, RunMod } from '../core/types';
import { SURVIVOR } from './feel';

/**
 * The hero as folk × class (UEBERGABE §7.1): chosen once at the start of a game or run. Folks are
 * open from the start; classes unlock through what the player has done (areas seen, bosses beaten,
 * runs started) and are mechanically equal to folks – no premium tier. Every entry trades something.
 */

export interface Folk {
  id: string;
  name: I18n;
  /** Strength / weakness, one line each. */
  text: I18n;
  mod: RunMod;
}

export interface HeroClass {
  id: string;
  name: I18n;
  /** HP, Atem, damage from the handover's table (damage 30 = the norm). */
  hp: number;
  atem: number;
  dmg: number;
  /** The signature, as a trait. */
  signature: I18n;
  mod: RunMod;
  unlock: { areas?: number; bosses?: number; runs?: number };
}

export const FOLKS: Folk[] = [
  { id: 'rost-geborene', name: { de: 'Rost-Geborene', en: 'Rustborn' }, text: { de: 'Zäh: +15 % Leben · Gelenke: Rolle kostet 15 % mehr', en: 'Tough: +15% life · Joints: roll costs 15% more' }, mod: { hpMul: 1.15, rollCostMul: 1.15 } },
  { id: 'funkengeborene', name: { de: 'Funkengeborene', en: 'Sparkborn' }, text: { de: 'Fähigkeiten laden 30 % schneller · Sensoren sehen dich weiter', en: 'Skills recharge 30% faster · sensors see you from further' }, mod: { skillCdMul: 0.7, sightMul: 1.2 } },
  { id: 'russgezeichnete', name: { de: 'Rußgezeichnete', en: 'Sootmarked' }, text: { de: 'Tote Zonen schaden dem Atem nicht · reine Zonen geben nur halb', en: 'Dead zones do not choke you · pure zones give only half' }, mod: { deadZoneImmune: true, pureMul: 0.5 } },
  { id: 'stahlhueter', name: { de: 'Stahlhüter', en: 'Steelwarden' }, text: { de: '+25 Atem · Implantat-Nähte: −10 % Leben', en: '+25 breath · implant seams: −10% life' }, mod: { staminaAdd: 25, hpMul: 0.9 } },
  { id: 'schattenfischer', name: { de: 'Schattenfischer', en: 'Shadowfisher' }, text: { de: 'Sehen im Dunkeln · grelles Licht: reine Zonen geben nichts', en: 'See in the dark · glare: pure zones give nothing' }, mod: { darkSight: true, pureMul: 0 } },
  { id: 'glockenschlaeger', name: { de: 'Glockenschläger', en: 'Bellringer' }, text: { de: 'Smog bremst den Atem nicht · laut: Gegner sehen dich weiter', en: 'Smog does not slow your breath · loud: enemies see you further' }, mod: { smogImmune: true, sightMul: 1.15 } },
  { id: 'licht-geweihte', name: { de: 'Licht-Geweihte', en: 'Lightsworn' }, text: { de: 'Reine Zonen geben doppelt · das Glühen verrät: Gegner sehen weiter', en: 'Pure zones give double · the glow betrays you' }, mod: { pureMul: 2, sightMul: 1.2 } },
  { id: 'echo-wandler', name: { de: 'Echo-Wandler', en: 'Echowalker' }, text: { de: 'Gegner bemerken dich spät · −10 % Schaden', en: 'Enemies notice you late · −10% damage' }, mod: { sightMul: 0.65, damageMul: 0.9 } },
  { id: 'rostsaenger', name: { de: 'Rostsänger', en: 'Rustsinger' }, text: { de: 'Hört Schwachstellen: +25 % Poise-Schaden, Wände brechen leichter · kein Kämpfer: −10 % Leben', en: 'Hears weak spots: +25% poise damage, walls break easier · no fighter: −10% life' }, mod: { poiseMul: 1.25, wallMul: 1.6, hpMul: 0.9 } },
];

/** The nameless survivor: the default, always there. */
export const SURVIVOR_CLASS: HeroClass = {
  id: 'ueberlebender', name: { de: 'Überlebender', en: 'Survivor' }, hp: 118, atem: 100, dmg: 30,
  signature: { de: 'Keine – aber auch keine Schwäche.', en: 'None – but no weakness either.' }, mod: {}, unlock: {},
};

export const CLASSES: HeroClass[] = [
  SURVIVOR_CLASS,
  { id: 'sparkguard', name: { de: 'Sparkguard', en: 'Sparkguard' }, hp: 125, atem: 90, dmg: 28, signature: { de: 'Steht vor anderen: Block hält 25 % mehr ab', en: 'Stands in front: block stops 25% more' }, mod: { blockAdd: 0.25 }, unlock: {} },
  { id: 'rootward', name: { de: 'Rootward', en: 'Rootward' }, hp: 115, atem: 95, dmg: 30, signature: { de: 'Steht, wo andere weichen: Parry-Fenster +0,05 s', en: 'Stands where others yield: parry window +0.05 s' }, mod: { parryAdd: 0.05 }, unlock: { areas: 2 } },
  { id: 'junker', name: { de: 'Junker', en: 'Junker' }, hp: 135, atem: 80, dmg: 32, signature: { de: 'Jam-Bang: Ladeschläge +40 %', en: 'Jam-Bang: charged blows +40%' }, mod: { chargeMul: 1.4 }, unlock: { bosses: 1 } },
  { id: 'klanker', name: { de: 'Klanker', en: 'Klanker' }, hp: 100, atem: 120, dmg: 30, signature: { de: 'Furcht-Ton: Gegner holen 15 % länger aus', en: 'Dread-Tone: enemies wind up 15% longer' }, mod: { telegraphMul: 1.15 }, unlock: { runs: 4 } },
  { id: 'coremind', name: { de: 'Coremind', en: 'Coremind' }, hp: 95, atem: 115, dmg: 30, signature: { de: 'Purge-Burst: Fähigkeiten laden doppelt so schnell', en: 'Purge-Burst: skills recharge twice as fast' }, mod: { skillCdMul: 0.5 }, unlock: { runs: 5 } },
  { id: 'lux', name: { de: 'Lux', en: 'Lux' }, hp: 80, atem: 110, dmg: 34, signature: { de: 'Ein Licht, das nicht verlischt: tote Zonen ohne Wirkung', en: 'A light that does not go out: dead zones have no effect' }, mod: { deadZoneImmune: true }, unlock: { bosses: 2 } },
  { id: 'deepseeker', name: { de: 'Deepseeker', en: 'Deepseeker' }, hp: 85, atem: 125, dmg: 32, signature: { de: 'Sog-Griff: Sturzangriffe +60 %', en: 'Pull-Grip: plunges +60%' }, mod: { plungeMul: 1.6 }, unlock: { areas: 4 } },
  { id: 'riftblade', name: { de: 'Riftblade', en: 'Riftblade' }, hp: 92, atem: 105, dmg: 42, signature: { de: 'Runen-Anspruch: Riposte ×1,4', en: 'Rune-Claim: riposte ×1.4' }, mod: { riposteMul: 1.4 }, unlock: { runs: 2 } },
  { id: 'duskrunner', name: { de: 'Duskrunner', en: 'Duskrunner' }, hp: 88, atem: 100, dmg: 44, signature: { de: 'Zwischen den Schichten: Rolle kostet die Hälfte', en: 'Between the layers: roll costs half' }, mod: { rollCostMul: 0.5 }, unlock: { areas: 3 } },
  { id: 'striker', name: { de: 'Striker', en: 'Striker' }, hp: 78, atem: 95, dmg: 50, signature: { de: 'Ein Schlag, keine Erklärung: +25 % Poise-Schaden', en: 'One blow, no explanation: +25% poise damage' }, mod: { poiseMul: 1.25 }, unlock: { bosses: 3 } },
];

/** What the player has done across all saves: drives class unlocks. */
export interface Meta {
  runs: number;
  bosses: string[];
  areas: string[];
}

export const META_KEY = 'rssouls:meta';

export function newMeta(): Meta {
  return { runs: 0, bosses: [], areas: [] };
}

export function unlocked(c: HeroClass, m: Meta): boolean {
  const u = c.unlock;
  return (u.areas ?? 0) <= m.areas.length && (u.bosses ?? 0) <= m.bosses.length && (u.runs ?? 0) <= m.runs;
}

/** The unlock condition as a line, for a locked entry in the menu. */
export function unlockText(c: HeroClass, de: boolean): string {
  const u = c.unlock;
  if (u.bosses) return de ? `${u.bosses} Boss${u.bosses > 1 ? 'e' : ''} besiegt` : `${u.bosses} boss${u.bosses > 1 ? 'es' : ''} beaten`;
  if (u.areas) return de ? `${u.areas} Gebiete gesehen` : `${u.areas} areas seen`;
  if (u.runs) return de ? `${u.runs} Läufe begonnen` : `${u.runs} runs started`;
  return '';
}

/** The hero numbers of a class (damage enters as a trait, so weapons keep their own numbers). */
export function heroOf(c: HeroClass): { def: HeroDef; mod: RunMod } {
  return {
    def: { ...SURVIVOR, hp: Math.round(c.hp * 0.85), stamina: c.atem },
    mod: { ...c.mod, damageMul: (c.dmg / 30) * (c.mod.damageMul ?? 1) },
  };
}

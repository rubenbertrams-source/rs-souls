import type { I18n } from '@pv/game-api';
import type { RunMod } from '../core/types';

/**
 * Run modifiers (UEBERGABE §8): at the start of a dice run one of three cards is chosen. Each one
 * trades something – a card without a price would just be a difficulty switch.
 */
export interface ModCard {
  id: string;
  name: I18n;
  text: I18n;
  mod: RunMod;
}

export const MOD_CARDS: ModCard[] = [
  { id: 'glaskanone', name: { de: 'Glaskanone', en: 'Glass Cannon' }, text: { de: '+40 % Schaden, −35 % Leben', en: '+40% damage, −35% life' }, mod: { damageMul: 1.4, hpMul: 0.65 } },
  { id: 'eiserne-haut', name: { de: 'Eiserne Haut', en: 'Iron Skin' }, text: { de: '+35 % Leben, −15 % Schaden', en: '+35% life, −15% damage' }, mod: { hpMul: 1.35, damageMul: 0.85 } },
  { id: 'gierige-glut', name: { de: 'Gierige Glut', en: 'Greedy Glut' }, text: { de: 'Doppelte Glut, Gegner treffen 25 % härter', en: 'Double Glut, enemies hit 25% harder' }, mod: { currencyMul: 2, enemyDamageMul: 1.25 } },
  { id: 'ruhige-hand', name: { de: 'Ruhige Hand', en: 'Steady Hand' }, text: { de: 'Parry-Fenster +0,08 s, eine Ampulle weniger', en: 'Parry window +0.08 s, one flask fewer' }, mod: { parryAdd: 0.08, flaskDelta: -1 } },
  { id: 'langer-atem', name: { de: 'Langer Atem', en: 'Long Breath' }, text: { de: '+40 Atem, Schläge kosten 20 % mehr', en: '+40 breath, strikes cost 20% more' }, mod: { staminaAdd: 40, costMul: 1.2 } },
  { id: 'schnelle-klinge', name: { de: 'Schnelle Klinge', en: 'Quick Blade' }, text: { de: 'Schläge kosten 35 % weniger Atem, −20 % Leben', en: 'Strikes cost 35% less breath, −20% life' }, mod: { costMul: 0.65, hpMul: 0.8 } },
  { id: 'vorrat', name: { de: 'Vorrat', en: 'Supplies' }, text: { de: '+2 Ampullen, keine Glut von Gegnern', en: '+2 flasks, no Glut from enemies' }, mod: { flaskDelta: 2, currencyMul: 0 } },
];

import type { AttackDef, EnemyDef, WeaponDef } from '../core/types';

/** Parry windows at or above this make the parry a block that cannot fail (UEBERGABE §14). */
export const MAX_PARRY = 0.35;
/** No enemy wind-up below this: the research note's floor for a readable telegraph. */
export const MIN_TELEGRAPH = 0.35;

/**
 * Consistency of the data layer: everything a typo in a table could break without the compiler
 * noticing. Returns the problems as readable lines; an empty list means the data is sound.
 */
export function validateWeapon(w: WeaponDef): string[] {
  const out: string[] = [];
  const ms = w.moveset;
  const has = (id: string | undefined, what: string) => {
    if (id !== undefined && !ms.attacks[id]) out.push(`${w.id}: ${what} "${id}" fehlt`);
  };
  has(ms.start, 'start');
  has(ms.up, 'up');
  has(ms.down, 'down');
  has(ms.air, 'air');
  has(ms.charge, 'charge');
  if (ms.charge && ms.chargeTime <= 0) out.push(`${w.id}: chargeTime muss > 0 sein`);
  if (ms.block && (ms.block.parry <= 0 || ms.block.parry >= MAX_PARRY)) {
    out.push(`${w.id}: Parry-Fenster ${ms.block.parry} s liegt nicht in (0, ${MAX_PARRY})`);
  }
  if (ms.block && (ms.block.reduction < 0 || ms.block.reduction > 1)) {
    out.push(`${w.id}: Block-Reduktion ${ms.block.reduction} liegt nicht in [0, 1]`);
  }
  for (const [key, a] of Object.entries(ms.attacks)) {
    if (a.id !== key) out.push(`${w.id}: Angriff unter "${key}" heißt "${a.id}"`);
    out.push(...validateAttack(`${w.id}/${key}`, a));
    has(a.next, `next von ${key}`);
    if (a.next && !(a.comboWindow && a.comboWindow > 0)) out.push(`${w.id}/${key}: Kette ohne comboWindow`);
  }
  const s2 = w.skill2;
  if (s2) {
    if (!s2.attack && !s2.ward) out.push(`${w.id}: zweite Fähigkeit ohne Angriff und ohne Schutz`);
    if (s2.attack) out.push(...validateAttack(`${w.id}/${s2.id}`, s2.attack));
    if (s2.ward && (s2.ward.damageMul <= 0 || s2.ward.damageMul >= 1)) out.push(`${w.id}/${s2.id}: Schutz muss den Schaden senken`);
  }
  // every chain has to end: follow `next` and fail on a repeat
  for (const key of Object.keys(ms.attacks)) {
    const seen = new Set<string>();
    let cur: string | undefined = key;
    while (cur) {
      if (seen.has(cur)) {
        out.push(`${w.id}: Kette ab "${key}" ist ein Zyklus`);
        break;
      }
      seen.add(cur);
      cur = ms.attacks[cur]?.next;
    }
  }
  return out;
}

export function validateEnemy(e: EnemyDef): string[] {
  const out: string[] = [];
  if (e.hp <= 0 || e.poise <= 0) out.push(`${e.id}: hp und poise müssen > 0 sein`);
  if (e.lose < e.sight) out.push(`${e.id}: lose (${e.lose}) < sight (${e.sight})`);
  if (!e.attacks.length) out.push(`${e.id}: keine Angriffe`);
  for (const a of e.attacks) {
    out.push(...validateAttack(`${e.id}/${a.id}`, a));
    // the telegraph is the whole fairness promise: no attack without a readable wind-up
    if (a.windup < MIN_TELEGRAPH) out.push(`${e.id}/${a.id}: Telegraf ${a.windup} s ist zu kurz zum Lesen`);
    const link = e.attacks.some((o) => o.next === a.id);
    if (!a.range && !link) out.push(`${e.id}/${a.id}: range fehlt`);
    if (a.next && !e.attacks.some((o) => o.id === a.next)) out.push(`${e.id}/${a.id}: Kombo-Glied "${a.next}" fehlt`);
  }
  return out;
}

function validateAttack(where: string, a: AttackDef): string[] {
  const out: string[] = [];
  if (!(a.windup >= 0 && a.active > 0 && a.recovery > 0)) out.push(`${where}: Phasen müssen > 0 sein`);
  if (a.box.w <= 0 || a.box.h <= 0) out.push(`${where}: Trefferzone ist leer`);
  return out;
}

/** Total time of a weapon's opening attack – the yardstick for "the hammer is slower". */
export function openingTime(w: WeaponDef): number {
  const a = w.moveset.attacks[w.moveset.start];
  return a ? a.windup + a.active + a.recovery : 0;
}

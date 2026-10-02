import { bodyRect, overlaps } from './body';
import { hitbox, phaseOf } from './attack';
import type { Enemy } from './enemy';
import type { Hero } from './hero';
import type { SimEvent } from './types';

/**
 * Where attacks meet bodies. Both directions follow the same order:
 * is the blade out, does the box touch, has this swing already struck – then the consequence.
 *
 * Hitstop freezes exactly the two involved (UEBERGABE §6.3); everybody else keeps moving.
 */

/** Damage of the hero's running attack before riposte and weak spots. */
export function heroDamage(hero: Hero): number {
  const run = hero.attack;
  const stage = hero.upgrades[hero.weapon.id] ?? 0;
  if (!run) return 0;
  const t = hero.traits;
  const kind = run.def.kind === 'charge' ? (t?.chargeMul ?? 1) : 1;
  const plunge = run.def.leap ? (t?.plungeMul ?? 1) : 1;
  return hero.weapon.damage * run.def.damage * hero.power * (1 + stage * 0.15) * kind * plunge;
}

/** Applies a hit on an enemy. Returns true if it died. */
export function damageEnemy(
  hero: Hero,
  e: Enemy,
  i: number,
  base: number,
  poise: number,
  knockback: number,
  forceHeavy: boolean,
  events: SimEvent[],
): boolean {
  const f = hero.feel;
  const riposte = hero.riposteT > 0;
  if (riposte) hero.riposteT = 0;
  // a construct's weak spot: from behind, or from above
  const behind = (hero.body.x - e.body.x) * e.facing < 0;
  const above = hero.body.y > e.body.y + e.body.h * 0.6;
  const weak = behind || above ? (e.def.weakSpot ?? 1) : (e.def.frontGuard ?? 1);
  const t = hero.traits;
  const damage = base * (riposte ? f.riposte.mul * (t?.riposteMul ?? 1) : 1) * weak;
  e.hp = Math.max(0, e.hp - damage);
  const broke = e.alive && e.state !== 'stagger' && e.takePoise(poise * weak * (t?.poiseMul ?? 1), e.def.stagger);
  const heavy = broke || forceHeavy || riposte;
  const stop = heavy ? f.hitstop.heavy : f.hitstop.light;
  hero.freeze = Math.max(hero.freeze, stop);
  e.freeze = Math.max(e.freeze, stop);
  // heavies shrug off the push unless the hit staggered them
  if (e.def.light || broke || !e.def.boss) e.pendingKb = Math.sign(e.body.x - hero.body.x || hero.facing) * knockback * (e.def.boss ? 0.3 : 1);
  if (e.state === 'idle' || e.state === 'patrol') e.wake();
  const at = { x: e.body.x, y: e.body.y + e.body.h / 2 };
  events.push({ type: 'hit', target: i, ...at, damage, heavy, riposte });
  if (broke) events.push({ type: 'stagger', enemy: i, ...at });
  if (e.hp <= 0) {
    e.setState('dead');
    events.push({ type: 'enemyDied', enemy: i, ...at });
    return true;
  }
  return false;
}

/** The hero's swing against every enemy. Returns the indices of the enemies that died. */
export function heroStrikes(hero: Hero, enemies: readonly Enemy[], events: SimEvent[]): number[] {
  const run = hero.attack;
  if (hero.state !== 'attack' || !run || phaseOf(run) !== 'active') return [];
  const box = hitbox(hero.body, hero.facing, run.def);
  const died: number[] = [];
  enemies.forEach((e, i) => {
    if (!e.alive || run.struck.includes(i) || !overlaps(box, bodyRect(e.body))) return;
    run.struck.push(i);
    if (damageEnemy(hero, e, i, heroDamage(hero), run.def.poise, run.def.knockback, run.def.kind === 'charge', events)) died.push(i);
  });
  return died;
}

/** Every enemy's swing against the hero. */
export function enemiesStrike(hero: Hero, enemies: readonly Enemy[], events: SimEvent[]) {
  enemies.forEach((e, i) => {
    const run = e.attack;
    if (e.state !== 'attack' || !run || phaseOf(run) !== 'active' || run.struck.includes('hero')) return;
    // a pure projectile attack has no blade of its own
    if (run.def.projectile && run.def.box.w <= 1) return;
    if (!overlaps(hitbox(e.body, e.facing, run.def), bodyRect(hero.body))) return;
    run.struck.push('hero');
    const damage = e.def.damage * run.def.damage * e.dmgMul;
    const at = { x: (hero.body.x + e.body.x) / 2, y: hero.body.y + hero.body.h * 0.55 };
    const outcome = resolveOnHero(hero, damage, run.def.knockback, e.body.x, !!run.def.parryable, run.def.effect, at, i, events);
    if (outcome === 'parried') {
      e.stagger(e.def.parryStagger);
      e.pendingKb = hero.facing * 140;
      e.freeze = hero.feel.hitstop.parry;
    } else if (outcome !== 'ignored' && outcome !== 'dodged') {
      e.freeze = hero.freeze;
    }
    if (outcome !== 'ignored' && !hero.alive) events.push({ type: 'heroDied', cause: e.def.name });
  });
}

/** One incoming hit on the hero, from a blade or a projectile; emits the matching event. */
export function resolveOnHero(
  hero: Hero,
  damage: number,
  knockback: number,
  fromX: number,
  parryable: boolean,
  effect: 'tar' | 'burn' | undefined,
  at: { x: number; y: number },
  enemy: number,
  events: SimEvent[],
) {
  const f = hero.feel;
  const outcome = hero.receive(damage, knockback, fromX, parryable, effect);
  switch (outcome) {
    case 'dodged':
      events.push({ type: 'dodge' });
      break;
    case 'parried':
      hero.freeze = f.hitstop.parry;
      events.push({ type: 'parry', enemy, ...at });
      break;
    case 'blocked':
      hero.freeze = f.hitstop.light;
      events.push({ type: 'blocked', ...at, damage });
      break;
    case 'guardBreak':
      hero.freeze = f.hitstop.heavy;
      events.push({ type: 'guardBreak' });
      break;
    case 'hit':
      hero.freeze = f.hitstop.light;
      events.push({ type: 'hit', target: 'hero', ...at, damage, heavy: false, riposte: false });
      break;
  }
  return outcome;
}

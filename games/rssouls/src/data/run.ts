import { Rng } from '@pv/engine';
import type { EnemySpawn, LevelDef, PropDef, RoomDef, Solid } from '../core/types';

/**
 * The bonus mode (UEBERGABE §2.2): a run assembled from dice. The same building blocks as the
 * campaign – rooms with a floor, platforms no higher than a jump, Kollektor rooms, boss arenas –
 * thrown together by a seed. Same seed, same run; the daily run is the day as a seed.
 *
 * Fifteen rooms: a Kollektor every fourth, a boss at five, ten and fifteen. Enemies get harder
 * with depth; the theme follows the act the depth belongs to.
 */

export const RUN_LENGTH = 15;

const DOOR = 170;

const TIERS: string[][] = [
  ['rost-spinner', 'ratte', 'schrott-drohne', 'schildtraeger'],
  ['rohr-kriecher', 'nebelwerk-wache', 'teerbinder', 'russ-kriecher', 'rost-spinner'],
  ['glut-wild', 'sensor-drohne', 'garde', 'vorarbeiter', 'assistent', 'russ-kriecher'],
];
const BOSSES = [
  ['schrott-golem', 'verwerter-konstrukt'],
  ['kommandantin-riss', 'sezier-golem', 'exponat', 'oel-leviathan'],
  ['schwarzkittel', 'doktor-asche'],
];
const THEMES = ['rosttal', 'rohr', 'unter', 'ader', 'wald', 'schanze', 'stadt', 'labor'];
const WEAPONS = ['verwerter-hammer', 'lumen-dolch'];

/** The flag a run is won with: the boss of its last room. */
export function runGoal(level: LevelDef): string {
  const last = level.rooms[`w${RUN_LENGTH}`]!;
  return `boss:${last.enemies[0]!.kind}@${last.id}`;
}

/** A seed for today, the same for everyone (UEBERGABE §8: Tages-Saat). */
export function dailySeed(date = new Date()): number {
  const s = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shell(w: number, h: number, west: boolean, east: boolean): Solid[] {
  const out: Solid[] = [{ x: -60, y: -40, w: w + 120, h: 40 }];
  out.push(west ? { x: -40, y: DOOR, w: 40, h: h + 400 } : { x: -40, y: 0, w: 40, h: h + 400 });
  out.push(east ? { x: w, y: DOOR, w: 40, h: h + 400 } : { x: w, y: 0, w: 40, h: h + 400 });
  return out;
}

export function makeRun(seed: number): LevelDef {
  const rng = new Rng(seed ^ 0x5eed1234);
  const rooms: Record<string, RoomDef> = {};
  for (let i = 0; i <= RUN_LENGTH; i++) {
    const id = `w${i}`;
    const act = Math.min(2, Math.floor((i - 1) / 5));
    const theme = THEMES[Math.min(THEMES.length - 1, Math.floor((i / RUN_LENGTH) * THEMES.length))]!;
    const boss = i > 0 && i % 5 === 0;
    const rest = i === 0 || (!boss && i % 4 === 0);
    const w = boss ? 1500 : rest ? 900 : rng.int(12, 18) * 100;
    const h = boss ? 680 : 620;
    const last = i === RUN_LENGTH;
    const solids = shell(w, h, i > 0, !last);
    const props: PropDef[] = [];
    const enemies: EnemySpawn[] = [];

    if (boss) {
      const kind = rng.pick(BOSSES[act]!);
      solids.push({ x: 220, y: 78, w: 200, h: 12, oneWay: true }, { x: w - 420, y: 78, w: 200, h: 12, oneWay: true });
      enemies.push({ kind, x: w - 450, y: 0, patrol: [w - 450, w - 449] });
      props.push({ type: 'gate', id: `${id}-gw`, arena: true, rect: { x: -20, y: 0, w: 20, h: DOOR } });
      if (!last) props.push({ type: 'gate', id: `${id}-go`, arena: true, rect: { x: w, y: 0, w: 20, h: DOOR } });
    } else if (rest) {
      props.push({ type: 'rest', id: `${id}-k`, x: 200, y: 0 });
      if (i > 0) props.push({ type: 'pickup', id: `${id}-f`, x: 640, y: 0, item: 'flask' });
    } else {
      // a few platforms, every step up within a jump
      let x = rng.int(2, 5) * 60;
      let top = 0;
      while (x < w - 300) {
        const pw = rng.int(3, 6) * 40;
        top = Math.max(60, Math.min(260, top + rng.pick([-90, -60, 60, 90])));
        if (top <= 90 || rng.next() < 0.75) solids.push({ x, y: top - 12, w: pw, h: 12, oneWay: true });
        else top = 0;
        x += pw + rng.int(1, 3) * 40;
      }
      const tier = TIERS[act]!;
      const n = rng.int(2, 3 + act);
      for (let k = 0; k < n; k++) {
        const kind = rng.pick(tier);
        const ex = Math.round(400 + ((w - 600) * (k + 0.5)) / n);
        const flying = kind === 'sensor-drohne';
        enemies.push({ kind, x: ex, y: flying ? 240 : 0, patrol: [ex - 100, ex + 100] });
      }
      props.push({ type: 'pickup', id: `${id}-g`, x: rng.int(3, Math.floor(w / 100) - 3) * 100, y: 0, item: `currency:${50 + i * 20}` });
      if (i === 2 || i === 7) props.push({ type: 'pickup', id: `${id}-w`, x: w - 250, y: 0, item: `weapon:${WEAPONS[i === 2 ? rng.int(0, 1) : 1 - rng.int(0, 1)]}` });
    }

    rooms[id] = {
      id,
      w,
      h,
      theme,
      camera: boss ? 'arena' : rest ? 'chamber' : 'hall',
      solids,
      spawn: { x: 120, y: 0 },
      entries: { west: { x: 60, y: 0 }, east: { x: w - 60, y: 0 } },
      exits: [
        ...(i > 0 ? [{ rect: { x: -60, y: 0, w: 40, h: DOOR }, to: `w${i - 1}`, at: 'east' }] : []),
        ...(!last ? [{ rect: { x: w + 20, y: 0, w: 40, h: DOOR }, to: `w${i + 1}`, at: 'west' }] : []),
      ],
      enemies,
      props,
    };
  }
  return { id: `run-${seed}`, rooms, start: { room: 'w0', at: 'spawn' } };
}

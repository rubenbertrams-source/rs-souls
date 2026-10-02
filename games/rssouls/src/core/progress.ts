/**
 * Everything that outlives a room, a death and a session: the hero's growth, the world's flags,
 * where the carried currency fell. Plain JSON, so the game class can save it as it is.
 *
 * World-neutral like the rest of the core: "currency" is Glut, "rest" a Kollektor – the data says so.
 */
export interface Progress {
  version: 1;
  /** Carried currency (= experience). */
  currency: number;
  /** Bought levels per stat. */
  levels: { vit: number; breath: number; power: number };
  flasksMax: number;
  /** Weapon ids found, and the two in the slots. */
  weapons: string[];
  slots: [string, string | null];
  /** The last rest point: where a death brings the hero back. */
  rest: { room: string; id: string } | null;
  /** The currency dropped at the last death, waiting for its one recovery attempt. */
  cell: { room: string; x: number; y: number; amount: number } | null;
  /** World flags: levers pulled, walls broken, pickups taken, bosses dead, rests lit. */
  flags: string[];
  deaths: number;
  kills: number;
  /** Seconds played. */
  time: number;
  /** Upgrade stage per weapon id (0–3), and the smithing material carried. */
  upgrades?: Record<string, number>;
  slag?: number;
  /** The hero's folk and class (UEBERGABE §7.1), chosen at the start. */
  folk?: string;
  cls?: string;
  /** Glut-Grad of this playthrough (0 = first; 1–4 after a win, UEBERGABE §8). */
  grade?: number;
}

/** Weapon upgrades (UEBERGABE §7.2): three stages above the raw one. */
export const UPGRADE = { max: 3, damagePerStage: 0.15 };

/** Price of the next stage: Glut, and one piece of slag per stage. */
export function upgradeCost(p: Progress, weapon: string): { currency: number; slag: number } | null {
  const stage = p.upgrades?.[weapon] ?? 0;
  if (stage >= UPGRADE.max) return null;
  return { currency: 250 * (stage + 1), slag: stage + 1 };
}

/** The rules each Glut-Grad adds (cumulative). */
export const GRADES = {
  /** Grade 1: enemies have a quarter more life. */
  hpMul: 1.25,
  /** Grade 2: a Kollektor heals only half. */
  restHeal: 0.5,
  /** Grade 4: the only Kollektor that still burns. */
  lastRest: 'k-hof',
};

/**
 * The next playthrough after a win: everything the hero has become stays (levels, weapons, flasks,
 * movement abilities, carried Glut), the world starts over, one grade harder.
 */
export function nextGrade(p: Progress): Progress {
  return {
    ...newProgress(p.slots[0]),
    currency: p.currency,
    levels: { ...p.levels },
    flasksMax: p.flasksMax,
    weapons: [...p.weapons],
    slots: [...p.slots],
    flags: p.flags.filter((f) => f.startsWith('faehigkeit:')),
    upgrades: { ...(p.upgrades ?? {}) },
    folk: p.folk,
    cls: p.cls,
    slag: p.slag ?? 0,
    deaths: p.deaths,
    kills: p.kills,
    time: p.time,
    grade: Math.min(4, (p.grade ?? 0) + 1),
  };
}

export function newProgress(weapon: string): Progress {
  return {
    version: 1,
    currency: 0,
    levels: { vit: 0, breath: 0, power: 0 },
    flasksMax: 3,
    weapons: [weapon],
    slots: [weapon, null],
    rest: null,
    cell: null,
    flags: [],
    deaths: 0,
    kills: 0,
    time: 0,
  };
}

export type Stat = keyof Progress['levels'];

/** What a level in each stat gives. */
export const STAT_GAIN = { vit: 12, breath: 8, power: 0.06 };

export function totalLevel(p: Progress): number {
  return p.levels.vit + p.levels.breath + p.levels.power;
}

/** The price of the next level: rises by a fifth each time, rounded to a readable number. */
export function levelCost(p: Progress): number {
  return Math.round((60 * Math.pow(1.2, totalLevel(p))) / 5) * 5;
}

export function hasFlag(p: Progress, f: string): boolean {
  return p.flags.includes(f);
}

export function setFlag(p: Progress, f: string) {
  if (!p.flags.includes(f)) p.flags.push(f);
}

/** Loads a saved progress, or nothing if it does not look like one. */
export function readProgress(v: unknown): Progress | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Progress;
  if (p.version !== 1 || !Array.isArray(p.flags) || !p.levels) return null;
  return p;
}

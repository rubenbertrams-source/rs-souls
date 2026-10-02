import type { EnemySpawn, ExitDef, LevelDef, PropDef, Rect, RoomDef, Solid } from '../core/types';

/**
 * Reinstrom as rooms. Act 1 (UEBERGABE §4): Rosttal (level 1), the Rohrviertel with the
 * Unterrohre (level 2) and the Schwarze Ader (level 3), built after the research note in plan/14-RSSOULS.md – every room teaches
 * one thing, a Kollektor every few minutes, the boss door close to the last one, a shortcut loop
 * per level, and the big loop: the Rohrtor in the Marktplatz is shut until the lever behind the
 * Verwerter-Konstrukt opens it.
 *
 * Coordinates: pixels, y up, the floor's top at y = 0. A jump reaches ~108 px; every step up in
 * here is at most 90 px (`tests/rssouls.test.ts` checks the platforms against that).
 */

/** Height of a doorway in a side wall. */
const DOOR = 170;
/** The highest step a room may ask of a jump. */
export const MAX_STEP = 92;

interface ShellOpts {
  /** Doorway in the left/right wall at this height (false: closed wall). */
  west?: number | false;
  east?: number | false;
  /** Gaps in the floor (pits or shafts down), as [from, to]. */
  gaps?: [number, number][];
  /** A low ceiling at this height (a narrow passage). */
  ceiling?: number;
}

/** Floor, side walls with doorways, optional low ceiling. */
function shell(w: number, h: number, o: ShellOpts = {}): Solid[] {
  const out: Solid[] = [];
  const cuts = [...(o.gaps ?? [])].sort((a, b) => a[0] - b[0]);
  let x = -60;
  for (const [a, b] of cuts) {
    if (a > x) out.push({ x, y: -40, w: a - x, h: 40 });
    x = b;
  }
  out.push({ x, y: -40, w: w + 60 - x, h: 40 });
  const wall = (wx: number, door: number | false | undefined) => {
    if (door === false || door === undefined) out.push({ x: wx, y: 0, w: 40, h: h + 400 });
    else {
      if (door > 0) out.push({ x: wx, y: 0, w: 40, h: door });
      out.push({ x: wx, y: door + DOOR, w: 40, h: h + 400 });
    }
  };
  wall(-40, o.west);
  wall(w, o.east);
  if (o.ceiling) out.push({ x: 0, y: o.ceiling, w, h: 400 });
  return out;
}

/** A one-way platform whose top is at `top`. */
const plat = (x: number, top: number, w: number): Solid => ({ x, y: top - 12, w, h: 12, oneWay: true });
/** A solid block standing on the ground (or on `y`), `top` high. */
const block = (x: number, top: number, w: number, y = 0): Solid => ({ x, y, w, h: top - y });
const west = (to: string, at: string, y = 0): ExitDef => ({ rect: { x: -60, y, w: 40, h: DOOR }, to, at });
const east = (w: number, to: string, at: string, y = 0): ExitDef => ({ rect: { x: w + 20, y, w: 40, h: DOOR }, to, at });
const down = (x0: number, x1: number, to: string, at: string): ExitDef => ({ rect: { x: x0, y: -110, w: x1 - x0, h: 60 }, to, at });
const door = (x: number, to: string, at: string, needs?: string, y = 0): ExitDef => ({ rect: { x: x - 24, y, w: 48, h: 80 }, to, at, needs, door: true });
const en = (kind: string, x: number, y: number, a: number, b: number, awake = false): EnemySpawn => ({ kind, x, y, patrol: [a, b], awake });
const rest = (id: string, x: number, y = 0): PropDef => ({ type: 'rest', id, x, y });
const sign = (id: string, x: number, text: string, y = 0): PropDef => ({ type: 'sign', id, x, y, text });
const pick = (id: string, x: number, item: string, y = 0): PropDef => ({ type: 'pickup', id, x, y, item });
const npc = (id: string, x: number, sprite: string, h: number, y = 0): PropDef => ({ type: 'npc', id, x, y, sprite, h });
const gate = (id: string, rect: Rect, arena = false): PropDef => ({ type: 'gate', id, rect, arena });
const lever = (id: string, x: number, opens: string, y = 0): PropDef => ({ type: 'lever', id, x, y, opens });
const valve = (id: string, x: number, period: number, phase = 0, y = 0): PropDef => ({ type: 'hazard', id, rect: { x, y, w: 36, h: 90 }, damage: 12, period, phase });
const spikes = (id: string, x: number, w: number, y = 0): PropDef => ({ type: 'hazard', id, rect: { x, y, w, h: 14 }, damage: 14 });

// ------------------------------------------------------------------ Level 1: Rosttal

/** Start. Safe ground, signs, one spinner at the far end: read the bite, hit back. */
const MARKT: RoomDef = {
  id: 'markt', w: 1500, h: 520, theme: 'rosttal',
  solids: [...shell(1500, 520, { west: false, east: 0 }), block(520, 46, 120), block(560, 76, 60, 46), plat(700, 120, 160), plat(300, 210, 120)],
  spawn: { x: 90, y: 0 },
  entries: { east: { x: 1440, y: 0 }, rohrtor: { x: 1300, y: 0 } },
  exits: [east(1500, 'gasse', 'west'), door(1300, 'unterrohre-ende', 'rohrtor', 'open:g-rohrtor')],
  enemies: [en('rost-spinner', 1050, 0, 960, 1180)],
  props: [
    sign('s-move', 200, 'move'),
    sign('s-attack', 900, 'attack'),
    pick('p-markt', 780, 'currency:40', 120),
    pick('p-markt-geheim', 360, 'slag:1', 210),
    sign('s-rohrtor', 1240, 'rohrtor'),
  ],
};

/** A narrow lane under hanging sheet metal: no jumping over the drone, roll through its blow. */
const GASSE: RoomDef = {
  id: 'gasse', w: 1300, h: 300, theme: 'rosttal', camera: 'chamber',
  solids: [...shell(1300, 300, { west: 0, east: 0, ceiling: 120 })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1250, y: 0 } },
  exits: [west('markt', 'east'), east(1300, 'hof', 'west')],
  enemies: [en('schrott-drohne', 650, 0, 560, 760), en('ratte', 1050, 0, 980, 1150)],
  props: [sign('s-roll', 300, 'roll')],
};

/** The first Kollektor, three to four minutes in. A locked door: the shortcut, opened later. */
const HOF: RoomDef = {
  id: 'hof', w: 1400, h: 600, theme: 'rosttal',
  solids: [...shell(1400, 600, { west: 0, east: 0 }), plat(380, 90, 180), block(760, 60, 90), plat(900, 140, 220)],
  spawn: { x: 200, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1350, y: 0 }, abk: { x: 1250, y: 0 } },
  exits: [west('gasse', 'east'), east(1400, 'dach', 'west'), door(1250, 'truemmer', 'abk', 'open:g-abk')],
  enemies: [en('rost-spinner', 600, 0, 480, 720), en('rost-spinner', 1000, 140, 920, 1100)],
  props: [rest('k-hof', 160), sign('s-rest', 320, 'rest'), sign('s-skill', 680, 'skill'), sign('s-abk', 1180, 'abk')],
};

/** Roofs: gaps between houses, a shield-bearer asleep below the high roof – plunge on it. */
const DACH: RoomDef = {
  id: 'dach', w: 1800, h: 760, theme: 'rosttal', camera: 'shaft',
  solids: [
    ...shell(1800, 760, { west: 0, east: 280, gaps: [[560, 700], [1180, 1280]] }),
    plat(150, 90, 160), plat(330, 180, 160), block(420, 270, 140, 250), plat(150, 340, 140),
    block(700, 120, 480), plat(780, 205, 140),
    block(1280, 170, 520), plat(1380, 250, 140), block(1560, 280, 240, 260),
  ],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1750, y: 280 } },
  exits: [west('hof', 'east'), east(1800, 'speicher', 'west', 280)],
  enemies: [
    en('schildtraeger', 740, 120, 740, 741),
    en('rost-spinner', 1450, 170, 1320, 1550),
    en('ratte', 950, 120, 820, 1150),
  ],
  props: [sign('s-plunge', 470, 'plunge', 270), pick('p-dach', 850, 'currency:60', 205), pick('p-dach-geheim', 220, 'flask', 340)],
};

/** A yard of sheds; on a ledge a corrugated wall hides a door (a heavy blow breaks it). */
const SPEICHER: RoomDef = {
  id: 'speicher', w: 1400, h: 640, theme: 'rosttal',
  solids: [
    ...shell(1400, 640, { west: 270, east: 0 }),
    block(0, 270, 220), plat(300, 180, 140), plat(480, 90, 160), block(1000, 80, 60),
    plat(1130, 90, 110), plat(1240, 180, 160),
  ],
  spawn: { x: 60, y: 270 },
  entries: { west: { x: 50, y: 270 }, east: { x: 1350, y: 0 }, nische: { x: 1350, y: 180 } },
  exits: [west('dach', 'east', 270), east(1400, 'schrott', 'west'), door(1350, 'nische', 'west', undefined, 180)],
  enemies: [en('ratte', 700, 0, 600, 950), en('ratte', 760, 0, 600, 950), en('ratte', 820, 0, 600, 950), en('rost-spinner', 1150, 0, 1080, 1330)],
  props: [{ type: 'wall', id: 'w-speicher', rect: { x: 1280, y: 180, w: 30, h: 150 }, minDamage: 50 }, sign('s-wall', 1190, 'wall', 90)],
};

/** The secret niche: a flask shard (one more heal) and some Glut. */
const NISCHE: RoomDef = {
  id: 'nische', w: 460, h: 260, theme: 'rosttal', camera: 'chamber',
  solids: [...shell(460, 260, { west: false, east: false })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 } },
  exits: [door(60, 'speicher', 'nische')],
  enemies: [],
  props: [pick('p-flask1', 280, 'flask'), pick('p-nische', 380, 'currency:120'), sign('s-brina', 170, 'brina'), npc('n-brina1', 215, 'npc_brina', 46)],
};

/** Scrapyard: steam valves in rhythm, a shield-bearer to learn the parry on, spinners. */
const SCHROTT: RoomDef = {
  id: 'schrott', w: 1700, h: 600, theme: 'rosttal',
  solids: [...shell(1700, 600, { west: 0, east: 0 }), plat(560, 90, 200), block(1150, 70, 140), plat(1300, 150, 160)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1650, y: 0 } },
  exits: [west('speicher', 'east'), east(1700, 'truemmer', 'west')],
  enemies: [en('schildtraeger', 900, 0, 820, 1040), en('rost-spinner', 1500, 0, 1400, 1640), en('rost-spinner', 1380, 150, 1310, 1450)],
  props: [valve('v1', 330, 2.4), valve('v2', 430, 2.4, 1.2), sign('s-valve', 200, 'valve'), sign('s-parry', 700, 'parry')],
};

/** Trümmerfeld 7: the second Kollektor, Korro in the wreck, and the lever of the shortcut. */
const TRUEMMER: RoomDef = {
  id: 'truemmer', w: 1500, h: 640, theme: 'rosttal',
  solids: [...shell(1500, 640, { west: 0, east: 0 }), block(560, 90, 200), plat(800, 170, 180), block(1060, 40, 80)],
  spawn: { x: 350, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1450, y: 0 }, abk: { x: 130, y: 0 } },
  exits: [west('schrott', 'east'), east(1500, 'yara', 'west'), door(130, 'hof', 'abk', 'open:g-abk')],
  enemies: [en('rost-spinner', 1250, 0, 1150, 1420), en('ratte', 950, 0, 850, 1050), en('ratte', 1000, 0, 850, 1050)],
  props: [rest('k-truemmer', 320), lever('h-abk', 215, 'g-abk'), pick('p-korro', 890, 'flag:korro', 170), pick('p-truemmer', 650, 'slag:1', 90)],
};

/** Yara's hideout: no enemies; the thesis of act 1 from those it hits. */
const YARA: RoomDef = {
  id: 'yara', w: 900, h: 360, theme: 'rosttal', camera: 'chamber',
  solids: [...shell(900, 360, { west: 0, east: 0 })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 850, y: 0 } },
  exits: [west('truemmer', 'east'), east(900, 'rohr-eingang', 'west')],
  enemies: [],
  props: [sign('s-yara', 420, 'yara'), pick('p-yara', 640, 'currency:100'), npc('n-yara', 470, 'npc_yara', 60)],
};

// ------------------------------------------------------------------ Level 2: Rohrviertel

/** The district's entry with its Kollektor; a pair of guards that call for each other. */
const ROHR_EINGANG: RoomDef = {
  id: 'rohr-eingang', w: 1600, h: 620, theme: 'rohr',
  solids: [...shell(1600, 620, { west: 0, east: 0 }), plat(520, 90, 200), block(900, 60, 100), plat(1100, 140, 200)],
  spawn: { x: 220, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1550, y: 0 } },
  exits: [west('yara', 'east'), east(1600, 'gassen', 'west')],
  enemies: [en('nebelwerk-wache', 1150, 0, 1050, 1300), en('nebelwerk-wache', 1300, 0, 1150, 1450)],
  props: [rest('k-rohr', 180), sign('s-rohr', 420, 'rohr')],
};

/** Gassen: a tall shaft of pipes; crawlers on ledges, a tar-spitter on top; up to Vex, down to the depths. */
const GASSEN: RoomDef = {
  id: 'gassen', w: 1300, h: 1000, theme: 'rohr', camera: 'shaft',
  solids: [
    ...shell(1300, 1000, { west: 0, east: false, gaps: [[1100, 1220]] }),
    plat(200, 90, 180), plat(420, 180, 180), plat(200, 270, 160), plat(420, 360, 200),
    plat(680, 450, 160), plat(900, 540, 160), block(1060, 630, 240, 610),
  ],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, oben: { x: 1220, y: 630 }, unten: { x: 1000, y: 0 } },
  exits: [west('rohr-eingang', 'east'), door(1220, 'schwarzmarkt', 'west', undefined, 630), down(1100, 1220, 'unterrohre', 'oben')],
  enemies: [
    en('rohr-kriecher', 480, 180, 430, 600),
    en('rohr-kriecher', 500, 360, 430, 610),
    en('teerbinder', 1150, 630, 1080, 1280),
    en('ratte', 700, 0, 600, 1000),
  ],
  props: [sign('s-gassen', 900, 'gassen'), pick('p-gassen', 260, 'slag:1', 270)],
};

/** Vex' workshop in the black market: the dagger, a flask shard, the truth about the vein. */
const SCHWARZMARKT: RoomDef = {
  id: 'schwarzmarkt', w: 1000, h: 420, theme: 'rohr', camera: 'chamber',
  solids: [...shell(1000, 420, { west: false, east: false }), block(600, 50, 160)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 } },
  exits: [door(80, 'gassen', 'oben')],
  enemies: [],
  props: [sign('s-vex', 400, 'vex'), npc('n-vex', 450, 'npc_vex', 60), pick('p-dolch', 680, 'weapon:lumen-dolch', 50), pick('p-flask2', 900, 'flask'), pick('p-doppel', 820, 'ability:doppelsprung')],
};

/** Unterrohre: dark and wet, smog, valves, vermin. Kollektor-less depth. */
const UNTERROHRE: RoomDef = {
  id: 'unterrohre', w: 2000, h: 560, theme: 'unter', dark: true,
  solids: [...shell(2000, 560, { west: false, east: 0, gaps: [[880, 1000]] }), block(1300, 60, 120), plat(1500, 140, 180)],
  spawn: { x: 140, y: 0 },
  entries: { oben: { x: 140, y: 300 }, east: { x: 1950, y: 0 }, leiter: { x: 80, y: 0 } },
  exits: [door(80, 'gassen', 'unten'), east(2000, 'pumpstation', 'west')],
  enemies: [
    en('ratte', 500, 0, 400, 800), en('ratte', 560, 0, 400, 800),
    en('rohr-kriecher', 1150, 0, 1050, 1290), en('teerbinder', 1600, 140, 1520, 1670), en('rohr-kriecher', 1750, 0, 1650, 1900),
  ],
  props: [valve('v3', 700, 2, 0), valve('v4', 1240, 2.6, 1), spikes('sp1', 1440, 50), sign('s-unter', 260, 'unter')],
  smog: [{ x: 300, y: 0, w: 900, h: 400 }],
};
UNTERROHRE.solids.push(plat(900, 60, 80));

/** Pumpstation: the Schrott-Golem guards it. A mid-boss arena; the doors shut behind. */
const PUMPSTATION: RoomDef = {
  id: 'pumpstation', w: 1300, h: 560, theme: 'pumpe', camera: 'arena',
  solids: [...shell(1300, 560, { west: 0, east: 0 }), plat(250, 90, 160), plat(890, 90, 160)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1240, y: 0 } },
  exits: [west('unterrohre', 'east'), east(1300, 'kontrollposten', 'west')],
  enemies: [en('schrott-golem', 800, 0, 800, 801)],
  props: [gate('ga-pumpe-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-pumpe-o', { x: 1300, y: 0, w: 20, h: DOOR }, true), pick('p-flask3', 1150, 'flask')],
};

/** Kontrollposten: the Kollektor before the boss (runback ≤ 20 s), a guard and a tar-spitter. */
const KONTROLLPOSTEN: RoomDef = {
  id: 'kontrollposten', w: 1500, h: 560, theme: 'rohr',
  solids: [...shell(1500, 560, { west: 0, east: 0 }), block(600, 90, 40), plat(640, 90, 200), block(1000, 50, 120)],
  spawn: { x: 160, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1450, y: 0 } },
  exits: [west('pumpstation', 'east'), east(1500, 'verwerter-arena', 'west')],
  enemies: [en('nebelwerk-wache', 900, 0, 860, 980), en('teerbinder', 720, 90, 660, 820)],
  props: [rest('k-posten', 120), sign('s-boss', 1350, 'boss')],
};

/** The Verwerter-Konstrukt's arena: wide, two ledges to plunge from. */
const VERWERTER_ARENA: RoomDef = {
  id: 'verwerter-arena', w: 1500, h: 640, theme: 'pumpe', camera: 'arena',
  solids: [...shell(1500, 640, { west: 0, east: 0 }), plat(220, 90, 200), plat(1080, 90, 200)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1440, y: 0 } },
  exits: [west('kontrollposten', 'east'), east(1500, 'unterrohre-ende', 'west')],
  enemies: [en('verwerter-konstrukt', 1000, 0, 1000, 1001)],
  props: [gate('ga-verw-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-verw-o', { x: 1500, y: 0, w: 20, h: DOOR }, true)],
};

/** Behind the boss: the lever that opens the Rohrtor back into the Marktplatz, and the hammer. */
const UNTERROHRE_ENDE: RoomDef = {
  id: 'unterrohre-ende', w: 1100, h: 520, theme: 'unter', dark: true,
  solids: [...shell(1100, 520, { west: 0, east: 0 }), plat(560, 90, 160)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, rohrtor: { x: 880, y: 0 }, east: { x: 1050, y: 0 } },
  exits: [west('verwerter-arena', 'east'), door(880, 'markt', 'rohrtor', 'open:g-rohrtor'), east(1100, 'masten', 'west')],
  enemies: [],
  props: [
    lever('h-rohrtor', 800, 'g-rohrtor'),
    pick('p-hammer', 400, 'weapon:verwerter-hammer'),
    pick('p-ende', 640, 'slag:2', 90),
    sign('s-ende', 180, 'ende'),
  ],
};

// ------------------------------------------------------------------ Level 3: Schwarze Ader

/** The edge of the vein: two sensor masts, drones that call, soot crawlers that wait. */
const MASTEN: RoomDef = {
  id: 'masten', w: 1700, h: 760, theme: 'ader',
  solids: [
    ...shell(1700, 760, { west: 0, east: 0 }),
    block(520, 420, 40), plat(440, 90, 80), plat(560, 180, 90), plat(440, 270, 80), plat(560, 360, 90),
    block(1160, 170, 40), plat(1080, 90, 80), plat(1200, 90, 90),
  ],
  spawn: { x: 200, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1650, y: 0 } },
  exits: [west('unterrohre-ende', 'east'), east(1700, 'baumring', 'west')],
  enemies: [
    { kind: 'sensor-drohne', x: 760, y: 220, patrol: [660, 960] },
    { kind: 'sensor-drohne', x: 1350, y: 260, patrol: [1250, 1550] },
    en('russ-kriecher', 900, 0, 900, 901),
    en('russ-kriecher', 1420, 0, 1420, 1421),
  ],
  props: [rest('k-ader', 140), sign('s-ader', 330, 'ader'), pick('p-masten', 600, 'slag:1', 360)],
};

/** A ring of petrified trees: a dead zone. Without pure light the breath comes slow. */
const BAUMRING: RoomDef = {
  id: 'baumring', w: 1900, h: 760, theme: 'ader', deadZone: true,
  solids: [
    ...shell(1900, 760, { west: 0, east: 0, gaps: [[1240, 1360]] }),
    block(380, 160, 70), plat(300, 80, 80), plat(450, 240, 120),
    block(820, 180, 80), plat(720, 90, 100), plat(900, 270, 140),
    block(1500, 140, 70), plat(1420, 70, 80), plat(1570, 220, 110),
  ],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1850, y: 0 }, tuempel: { x: 1050, y: 0 } },
  exits: [west('masten', 'east'), east(1900, 'ader-rast', 'west'), door(1050, 'tuempel', 'west')],
  enemies: [
    en('glut-wild', 640, 0, 560, 760),
    en('russ-kriecher', 1150, 0, 1150, 1151),
    en('glut-wild', 1700, 0, 1600, 1820),
    { kind: 'sensor-drohne', x: 960, y: 380, patrol: [860, 1100] },
  ],
  props: [sign('s-tot', 200, 'tot'), sign('s-tuempel', 990, 'tuempel'), pick('p-flask4', 960, 'flask', 270)],
};

/** The still pool: black, reflecting nothing. Optional – the Öl-Leviathan guards a reward. */
const TUEMPEL: RoomDef = {
  id: 'tuempel', w: 1300, h: 600, theme: 'ader', camera: 'arena',
  solids: [...shell(1300, 600, { west: false, east: false }), plat(160, 90, 160), plat(980, 90, 160)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 } },
  exits: [door(80, 'baumring', 'tuempel')],
  enemies: [en('oel-leviathan', 760, 0, 760, 761)],
  props: [pick('p-tuempel', 1180, 'slag:2'), pick('p-flask5', 1220, 'flask'), pick('p-dash', 1100, 'ability:luftdash')],
};

/** The last Kollektor before the maw: short way to the boss. */
const ADER_RAST: RoomDef = {
  id: 'ader-rast', w: 900, h: 420, theme: 'ader', camera: 'chamber',
  solids: [...shell(900, 420, { west: 0, east: 0 }), block(420, 40, 80)],
  spawn: { x: 200, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 850, y: 0 } },
  exits: [west('baumring', 'east'), east(900, 'schlund', 'west')],
  enemies: [],
  props: [rest('k-ader-rast', 160), sign('s-riss', 640, 'riss')],
};

/** Der Schlund: Kommandantin Riss; when she falls, the failsafe wakes what lives in the maw. */
const SCHLUND: RoomDef = {
  id: 'schlund', w: 1500, h: 680, theme: 'ader', camera: 'arena',
  solids: [...shell(1500, 680, { west: 0, east: 0 }), plat(200, 90, 180), plat(1120, 90, 180)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1440, y: 0 } },
  exits: [west('ader-rast', 'east'), east(1500, 'steg', 'west')],
  enemies: [en('kommandantin-riss', 1000, 0, 1000, 1001)],
  props: [gate('ga-schlund-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-schlund-o', { x: 1500, y: 0, w: 20, h: DOOR }, true)],
  waves: {
    after: 'boss:kommandantin-riss@schlund',
    list: [
      [en('russ-kriecher', 300, 0, 300, 301), en('russ-kriecher', 1200, 0, 1200, 1201), en('glut-wild', 760, 0, 600, 900)],
      [en('schlund-waechter', 1100, 0, 1000, 1200)],
    ],
  },
};

/** The footbridge over the vein: the end of act 1. */
const STEG: RoomDef = {
  id: 'steg', w: 1000, h: 460, theme: 'ader',
  solids: [...shell(1000, 460, { west: 0, east: 0 })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 950, y: 0 } },
  exits: [west('schlund', 'east'), east(1000, 'fluesterwald', 'west')],
  enemies: [],
  props: [pick('p-akt1', 700, 'flag:akt1'), sign('s-steg', 400, 'steg')],
};

// ------------------------------------------------------------------ Level 4: Der Weg nach Ascheburg

/** Flüsterwald: the first pure zone since act 1. Green, quiet, exploration pays. */
const FLUESTERWALD: RoomDef = {
  id: 'fluesterwald', w: 2000, h: 760, theme: 'wald', pure: true,
  solids: [
    ...shell(2000, 760, { west: 0, east: 0 }),
    plat(300, 90, 160), plat(480, 180, 160), plat(700, 270, 180), plat(940, 180, 140),
    block(1250, 80, 120), plat(1400, 160, 160), plat(1600, 250, 160),
  ],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1950, y: 0 } },
  exits: [west('steg', 'east'), east(2000, 'lichtquell', 'west')],
  enemies: [
    { kind: 'sensor-drohne', x: 900, y: 360, patrol: [800, 1100] },
    { kind: 'sensor-drohne', x: 1600, y: 380, patrol: [1500, 1800] },
    en('glut-wild', 1100, 0, 1000, 1240),
  ],
  props: [sign('s-wald', 200, 'wald'), sign('s-juno', 780, 'juno', 270), npc('n-juno1', 830, 'npc_juno', 60, 270), pick('p-wald', 1680, 'slag:1', 250)],
};

/** Lichtquell: home of the tribe; the Runen-Kern; a Kollektor in pure light. */
const LICHTQUELL: RoomDef = {
  id: 'lichtquell', w: 1100, h: 520, theme: 'wald', pure: true, camera: 'chamber',
  solids: [...shell(1100, 520, { west: 0, east: 0 }), block(500, 50, 140)],
  spawn: { x: 260, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1050, y: 0 } },
  exits: [west('fluesterwald', 'east'), east(1100, 'schanze-weg', 'west')],
  enemies: [],
  props: [rest('k-licht', 220), sign('s-kern', 570, 'kern', 50), npc('n-juno2', 620, 'npc_juno', 60, 50), pick('p-flask6', 900, 'flask'), pick('p-wand', 760, 'ability:wandsprung')],
};

/** The way to the Rauchschanze: NEBELWERK patrols, a smugglers' door. */
const SCHANZE_WEG: RoomDef = {
  id: 'schanze-weg', w: 1800, h: 600, theme: 'schanze',
  solids: [...shell(1800, 600, { west: 0, east: 0 }), block(600, 70, 120), plat(760, 150, 160), block(1200, 60, 100)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1750, y: 0 }, brina: { x: 1450, y: 0 } },
  exits: [west('lichtquell', 'east'), east(1800, 'rauchschanze', 'west'), door(1450, 'schmuggler', 'west')],
  enemies: [
    en('nebelwerk-wache', 900, 0, 820, 1100), en('nebelwerk-wache', 1000, 0, 880, 1150),
    { kind: 'sensor-drohne', x: 1300, y: 260, patrol: [1200, 1500] },
  ],
  props: [sign('s-brina2', 1390, 'brina2')],
};

/** Brina's smugglers' path: she opens the way into the city. */
const SCHMUGGLER: RoomDef = {
  id: 'schmuggler', w: 1000, h: 380, theme: 'schanze', camera: 'chamber',
  solids: [...shell(1000, 380, { west: false, east: false }), block(400, 50, 100)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 } },
  exits: [door(80, 'schanze-weg', 'brina')],
  enemies: [en('ratte', 600, 0, 520, 800), en('ratte', 680, 0, 520, 800)],
  props: [sign('s-brina3', 300, 'brina3'), npc('n-brina2', 345, 'npc_brina', 46), pick('p-pass', 880, 'flag:passierschein'), pick('p-schmuggel', 440, 'slag:1', 50)],
};

/** The Rauchschanze: the border. A Kollektor at the gate, the barrier needs a pass. */
const RAUCHSCHANZE: RoomDef = {
  id: 'rauchschanze', w: 1700, h: 640, theme: 'schanze',
  solids: [...shell(1700, 640, { west: 0, east: false }), plat(500, 90, 160), block(820, 80, 80), plat(980, 160, 200)],
  spawn: { x: 200, y: 0 },
  entries: { west: { x: 50, y: 0 }, schranke: { x: 1620, y: 0 } },
  exits: [west('schanze-weg', 'east'), door(1620, 'maut', 'west', 'passierschein')],
  enemies: [en('garde', 1100, 0, 1000, 1300), en('vorarbeiter', 1400, 0, 1300, 1500), en('nebelwerk-wache', 700, 0, 620, 800)],
  props: [rest('k-schanze', 150), sign('s-schranke', 1540, 'schranke')],
};

/** Tote Zone unter der Maut: a short wave cauldron in a dead zone. */
const MAUT: RoomDef = {
  id: 'maut', w: 1300, h: 560, theme: 'ader', camera: 'arena', deadZone: true,
  solids: [...shell(1300, 560, { west: 0, east: 0 }), plat(250, 90, 160), plat(890, 90, 160)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1240, y: 0 } },
  exits: [west('rauchschanze', 'schranke'), east(1300, 'tor', 'west')],
  enemies: [],
  props: [gate('ga-maut-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-maut-o', { x: 1300, y: 0, w: 20, h: DOOR }, true)],
  waves: {
    list: [
      [en('russ-kriecher', 400, 0, 400, 401), en('russ-kriecher', 1000, 0, 1000, 1001), en('nebelwerk-wache', 800, 0, 700, 900)],
      [en('garde', 900, 0, 800, 1100), en('glut-wild', 300, 0, 200, 500)],
    ],
  },
};

/** The Ascheburg gate: the city is beautiful. Asche sends the Sezier-Golem for Korro. */
const TOR: RoomDef = {
  id: 'tor', w: 1500, h: 680, theme: 'stadt', camera: 'arena',
  solids: [...shell(1500, 680, { west: 0, east: 0 }), plat(220, 90, 200), plat(1080, 90, 200)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1440, y: 0 } },
  exits: [west('maut', 'east'), east(1500, 'daecher', 'west')],
  enemies: [en('sezier-golem', 1000, 0, 1000, 1001)],
  props: [gate('ga-tor-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-tor-o', { x: 1500, y: 0, w: 20, h: DOOR }, true)],
};

// ------------------------------------------------------------------ Level 5: Ascheburg (Heat)

/** Rauch-Sammler-Dächer: the safest route, climbing, quiet. Kollektor; two ways down. */
const DAECHER: RoomDef = {
  id: 'daecher', w: 1800, h: 760, theme: 'stadt',
  solids: [
    ...shell(1800, 760, { west: 0, east: 0 }),
    plat(300, 90, 160), plat(500, 180, 160), block(720, 270, 260, 250), plat(1050, 180, 160), plat(1260, 90, 160), plat(1150, 300, 120),
  ],
  spawn: { x: 200, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1750, y: 0 }, arbeiter: { x: 1500, y: 0 } },
  exits: [west('tor', 'east'), east(1800, 'verwaltung', 'west'), door(1500, 'arbeiter', 'west')],
  enemies: [{ kind: 'sensor-drohne', x: 900, y: 420, patrol: [700, 1100] }],
  props: [rest('k-daecher', 150), sign('s-stadt', 360, 'stadt'), sign('s-heat', 1430, 'heat'), pick('p-daecher', 840, 'currency:300', 270), pick('p-daecher-geheim', 1210, 'slag:2', 300)],
};

/** Verwaltungskern: papers, guards, the Heat starts to count. */
const VERWALTUNG: RoomDef = {
  id: 'verwaltung', w: 1800, h: 620, theme: 'stadt', heat: true,
  solids: [...shell(1800, 620, { west: 0, east: 0 }), block(500, 60, 120), plat(680, 140, 200), block(1200, 60, 120)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1750, y: 0 } },
  exits: [west('daecher', 'east'), east(1800, 'forschung', 'west')],
  enemies: [en('garde', 900, 0, 800, 1100), en('nebelwerk-wache', 1300, 0, 1250, 1500), en('nebelwerk-wache', 1400, 0, 1300, 1600), en('garde', 1600, 0, 1500, 1700)],
  props: [sign('s-selin', 300, 'selin')],
};

/** Funkengeborene-Arbeiterviertel: optional; foremen, a flask shard, a hammer of the works. */
const ARBEITER: RoomDef = {
  id: 'arbeiter', w: 1400, h: 560, theme: 'stadt', heat: true,
  solids: [...shell(1400, 560, { west: false, east: false }), plat(400, 90, 200), block(800, 70, 120), block(1150, 300, 30), block(1250, 300, 30), plat(1180, 300, 70)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 } },
  exits: [door(80, 'daecher', 'arbeiter')],
  enemies: [en('vorarbeiter', 700, 0, 600, 900), en('vorarbeiter', 1050, 0, 950, 1130), en('nebelwerk-wache', 500, 90, 420, 580)],
  props: [sign('s-funken', 260, 'funken'), pick('p-flask7', 1215, 'flask', 300), pick('p-arbeiter2', 1340, 'currency:200'), pick('p-arbeiter', 860, 'slag:2', 70)],
};

/** Sektor Forschung: Asche's second exhibit. */
const FORSCHUNG: RoomDef = {
  id: 'forschung', w: 1400, h: 640, theme: 'labor', camera: 'arena', heat: true,
  solids: [...shell(1400, 640, { west: 0, east: 0 }), plat(220, 90, 180), plat(1000, 90, 180)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1340, y: 0 } },
  exits: [west('verwaltung', 'east'), east(1400, 'archiv', 'west')],
  enemies: [en('exponat', 900, 0, 900, 901)],
  props: [gate('ga-forsch-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-forsch-o', { x: 1400, y: 0, w: 20, h: DOOR }, true)],
};

/** Das Archiv: Asche's research; Ilv; the Kollektor before the substation. */
const ARCHIV: RoomDef = {
  id: 'archiv', w: 1100, h: 480, theme: 'stadt', camera: 'chamber',
  solids: [...shell(1100, 480, { west: 0, east: 0 }), block(450, 60, 160)],
  spawn: { x: 220, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1050, y: 0 } },
  exits: [west('forschung', 'east'), east(1100, 'umspannwerk', 'west')],
  enemies: [],
  props: [rest('k-archiv', 160), sign('s-ilv', 520, 'ilv', 60), sign('s-umspann', 900, 'umspann')],
};

/** Hauptumspannwerk: Juno couples the core to the grid – and Schwarzkittel wakes. */
const UMSPANNWERK: RoomDef = {
  id: 'umspannwerk', w: 1600, h: 700, theme: 'stadt', camera: 'arena',
  solids: [...shell(1600, 700, { west: 0, east: 0 }), plat(240, 90, 200), plat(1160, 90, 200)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1540, y: 0 } },
  exits: [west('archiv', 'east'), east(1600, 'zugang', 'west')],
  enemies: [en('schwarzkittel', 1100, 0, 1100, 1101)],
  props: [gate('ga-umsp-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-umsp-o', { x: 1600, y: 0, w: 20, h: DOOR }, true)],
};

// ------------------------------------------------------------------ Level 6: Finale – Doktor Asche

/** The way down: one Kollektor, the only one. Whoever goes in comes out victorious or not at all. */
const ZUGANG: RoomDef = {
  id: 'zugang', w: 1000, h: 460, theme: 'labor', camera: 'chamber',
  solids: [...shell(1000, 460, { west: 0, east: 0 })],
  spawn: { x: 240, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 950, y: 0 } },
  exits: [west('umspannwerk', 'east'), east(1000, 'gang', 'west')],
  enemies: [],
  props: [rest('k-labor', 180), sign('s-sahl', 600, 'sahl')],
};

const GANG: RoomDef = {
  id: 'gang', w: 1700, h: 520, theme: 'labor', dark: true,
  solids: [...shell(1700, 520, { west: 0, east: 0 }), plat(600, 90, 200), block(1000, 50, 100)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1650, y: 0 } },
  exits: [west('zugang', 'east'), east(1700, 'kesselraum', 'west')],
  enemies: [en('assistent', 800, 0, 700, 950), en('assistent', 1200, 0, 1100, 1400), en('garde', 1500, 0, 1400, 1650)],
  props: [],
};

/** Kesselraum: the choice. The forge – short, hard. The cooling section – long, quiet, a crystal. */
const KESSELRAUM: RoomDef = {
  id: 'kesselraum', w: 1300, h: 560, theme: 'labor',
  solids: [...shell(1300, 560, { west: 0, east: false })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, schmiede: { x: 900, y: 0 }, kuehlung: { x: 1180, y: 0 } },
  exits: [west('gang', 'east'), door(900, 'schmiede', 'west'), door(1180, 'kuehlung', 'west')],
  enemies: [en('vorarbeiter', 600, 0, 500, 760)],
  props: [sign('s-wahl', 1040, 'wahl'), valve('v5', 380, 2.2)],
};

const SCHMIEDE: RoomDef = {
  id: 'schmiede', w: 1500, h: 560, theme: 'labor',
  solids: [...shell(1500, 560, { west: false, east: 0 }), plat(500, 90, 200), block(950, 60, 100)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 }, east: { x: 1450, y: 0 } },
  exits: [door(80, 'kesselraum', 'schmiede'), east(1500, 'pods', 'west')],
  enemies: [en('garde', 600, 0, 500, 800), en('assistent', 800, 0, 700, 900), en('vorarbeiter', 1100, 0, 1000, 1300), en('assistent', 1300, 0, 1200, 1400)],
  props: [sign('s-gewalt', 240, 'gewalt'), valve('v6', 1240, 2, 1)],
};

const KUEHLUNG: RoomDef = {
  id: 'kuehlung', w: 2200, h: 600, theme: 'labor',
  solids: [...shell(2200, 600, { west: false, east: 0, gaps: [[900, 1000], [1500, 1600]] }), plat(920, 60, 60), plat(1520, 60, 60)],
  spawn: { x: 80, y: 0 },
  entries: { west: { x: 80, y: 0 }, east: { x: 2150, y: 0 } },
  exits: [door(80, 'kesselraum', 'kuehlung'), east(2200, 'pods', 'west')],
  enemies: [en('assistent', 1200, 0, 1100, 1400), { kind: 'sensor-drohne', x: 1800, y: 260, patrol: [1700, 2000] }],
  props: [sign('s-rill', 400, 'rill'), sign('s-kuehl', 700, 'kuehl'), pick('p-kristall', 1900, 'flag:kristall'), valve('v7', 600, 2.6), valve('v8', 1300, 2.6, 1.3)],
};

/** The archive of subject pods: the guards wake. */
const PODS: RoomDef = {
  id: 'pods', w: 1300, h: 560, theme: 'labor', camera: 'arena',
  solids: [...shell(1300, 560, { west: 0, east: 0 }), plat(250, 90, 160), plat(890, 90, 160)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 }, east: { x: 1240, y: 0 } },
  exits: [west('kesselraum', 'west'), east(1300, 'reanimation', 'west')],
  enemies: [],
  props: [gate('ga-pods-w', { x: -20, y: 0, w: 20, h: DOOR }, true), gate('ga-pods-o', { x: 1300, y: 0, w: 20, h: DOOR }, true)],
  waves: {
    list: [
      [en('assistent', 400, 0, 300, 500), en('assistent', 1000, 0, 900, 1100)],
      [en('garde', 900, 0, 800, 1100), en('assistent', 300, 0, 200, 500), en('vorarbeiter', 700, 0, 600, 800)],
    ],
  },
};

/** Reanimation chamber: the mural with the whole story. */
const REANIMATION: RoomDef = {
  id: 'reanimation', w: 1100, h: 520, theme: 'labor', camera: 'chamber',
  solids: [...shell(1100, 520, { west: 0, east: 0 })],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 50, y: 0 }, east: { x: 1050, y: 0 } },
  exits: [west('pods', 'east'), east(1100, 'labor', 'west')],
  enemies: [],
  props: [sign('s-gemaelde', 450, 'gemaelde'), sign('s-varrek', 850, 'varrek')],
};

/** Doktor Asche's laboratory. Four phases. */
const LABOR: RoomDef = {
  id: 'labor', w: 1600, h: 720, theme: 'labor', camera: 'arena',
  solids: [...shell(1600, 720, { west: 0, east: false }), plat(240, 90, 200), plat(1160, 90, 200)],
  spawn: { x: 60, y: 0 },
  entries: { west: { x: 60, y: 0 } },
  exits: [west('reanimation', 'east')],
  enemies: [{ kind: 'doktor-asche', x: 1100, y: 0, patrol: [1100, 1101] }],
  props: [gate('ga-labor-w', { x: -20, y: 0, w: 20, h: DOOR }, true)],
};

export const ROOMS: RoomDef[] = [
  MARKT, GASSE, HOF, DACH, SPEICHER, NISCHE, SCHROTT, TRUEMMER, YARA,
  ROHR_EINGANG, GASSEN, SCHWARZMARKT, UNTERROHRE, PUMPSTATION, KONTROLLPOSTEN, VERWERTER_ARENA, UNTERROHRE_ENDE,
  MASTEN, BAUMRING, TUEMPEL, ADER_RAST, SCHLUND, STEG,
  FLUESTERWALD, LICHTQUELL, SCHANZE_WEG, SCHMUGGLER, RAUCHSCHANZE, MAUT, TOR,
  DAECHER, VERWALTUNG, ARBEITER, FORSCHUNG, ARCHIV, UMSPANNWERK,
  ZUGANG, GANG, KESSELRAUM, SCHMIEDE, KUEHLUNG, PODS, REANIMATION, LABOR,
];

export const REINSTROM: LevelDef = {
  id: 'reinstrom',
  rooms: Object.fromEntries(ROOMS.map((r) => [r.id, r])),
  start: { room: 'markt', at: 'spawn' },
};

/** The flag that ends the campaign: Doktor Asche beaten (by blade or by crystal). */
export const CAMPAIGN_GOAL = 'boss:doktor-asche@labor';

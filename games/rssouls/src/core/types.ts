/**
 * The vocabulary of the combat core.
 *
 * The core is world-neutral on purpose (UEBERGABE §6): it knows "stamina", "attack", "poise" and
 * "room", never Glut, Atem or Kollektor. Everything Reinstrom brings – names, numbers, texts – lives
 * in `../data` and is handed in. A second world would be a second data folder, not a code change.
 *
 * Units are pixels and seconds, y points up, and a body's `x`/`y` is the middle of its feet.
 */

/** Axis-aligned rectangle, `x`/`y` its bottom-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A piece of room geometry. One-way pieces only carry from above and can be dropped through. */
export interface Solid extends Rect {
  oneWay?: boolean;
}

/** The shape of a hit: a wide arc, a long narrow line, or a held-and-released heavy. */
export type HitKind = 'slash' | 'thrust' | 'charge';

/**
 * One attack, used by the hero and by enemies alike (UEBERGABE §6.5: same data form).
 *
 * `box` is placed relative to the attacker: `x` from its front edge (negative reaches behind it),
 * `y` from its feet, both mirrored with the facing.
 */
export interface AttackDef {
  id: string;
  kind: HitKind;
  /** Wind-up (for enemies: the telegraph), the window that hits, and the recovery after it. */
  windup: number;
  active: number;
  recovery: number;
  /** Multiplier on the wielder's base damage. */
  damage: number;
  /** Poise taken from the target. */
  poise: number;
  /** Push on the target, px/s. */
  knockback: number;
  /** Stamina the attack costs. */
  cost: number;
  box: Rect;
  /** Forward speed during the active window. */
  lunge?: number;
  /** A jump attack: velocity at the start of the active window; the active window ends on landing. */
  leap?: { vx: number; vy: number };
  /** The chain continues with this attack if pressed within `comboWindow` of the recovery. */
  next?: string;
  comboWindow?: number;
  /** Enemy attacks only: may this be parried? Humanoids and constructs yes, vermin no. */
  parryable?: boolean;
  /** Freeze on hit, s. Light hits 0.04, heavies 0.07. */
  hitstop?: number;
  /** Enemy attacks only: distance band in which the attack is chosen. */
  range?: [number, number];
  /** Fires a projectile at the start of the active window instead of (or as well as) the box. */
  projectile?: ProjectileDef;
  /** What a hit does besides damage: `tar` slows and glues the roll for a few seconds. */
  effect?: 'tar' | 'burn';
  /** Box ignores the facing and is centred on the attacker (a ground slam). */
  around?: boolean;
  /** Enemy attacks only: used only in this phase of a multi-phase enemy. */
  phase?: number;
  /** Enemy attacks only: used from this phase on. */
  minPhase?: number;
}

export interface ProjectileDef {
  speed: number;
  /** Upward start speed for an arcing throw (0: straight). */
  arc: number;
  gravity: number;
  w: number;
  h: number;
  life: number;
  /** Breaks on walls/floor. */
  solid: boolean;
  /** Several at once, fanned out by `spread` (share of the speed). */
  count?: number;
  spread?: number;
}

/** A weapon class's move set (UEBERGABE §6.2). */
export interface MovesetDef {
  attacks: Record<string, AttackDef>;
  /** First link of the ground chain. */
  start: string;
  /** Direction variants; a missing one falls back to `start`. */
  up?: string;
  down?: string;
  air?: string;
  /** Released after holding at least `chargeTime`. */
  charge?: string;
  chargeTime: number;
  /** null: this class cannot block. `parry` is the opening window of a block, s. */
  block: { reduction: number; parry: number } | null;
  /** Multiplier on run speed while this weapon is held. */
  speed: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** Base damage the attack multipliers act on. */
  damage: number;
  moveset: MovesetDef;
  /** The weapon ability: an attack with its own cooldown. */
  skill?: { attack: AttackDef; cooldown: number };
  /** The second ability, open from upgrade stage 2 (UEBERGABE §7.2): an attack or a ward. */
  skill2?: SkillDef;
}

export interface SkillDef {
  id: string;
  cooldown: number;
  cost: number;
  attack?: AttackDef;
  /** A ward: for `time` seconds incoming damage is multiplied by `damageMul`. */
  ward?: { time: number; damageMul: number };
}

/** The upgrade stage from which the second ability is open. */
export const SKILL2_STAGE = 2;

/** Movement and timing that make the hero "feel good" (UEBERGABE §6.4). */
export interface FeelDef {
  runSpeed: number;
  groundAccel: number;
  airAccel: number;
  gravity: number;
  /** Extra gravity while falling, for a snappier arc. */
  fallGravity: number;
  maxFall: number;
  jumpSpeed: number;
  /** Releasing jump while rising multiplies the upward speed by this. */
  jumpCut: number;
  coyote: number;
  jumpBuffer: number;
  attackBuffer: number;
  /** Seconds without control after being hit. */
  hurtLock: number;
  roll: { time: number; speed: number; iStart: number; iEnd: number; cost: number };
  /** The roll may cancel an attack's recovery once this share of it is over. */
  rollCancel: number;
  guardBreak: number;
  /** Stamina per blocked damage point. */
  blockCostPerDamage: number;
  riposte: { window: number; mul: number };
  hitstop: { light: number; heavy: number; parry: number };
}

export interface HeroDef {
  w: number;
  h: number;
  hp: number;
  stamina: number;
  /** Stamina per second once `staminaDelay` has passed since the last spend. */
  staminaRegen: number;
  staminaDelay: number;
}

export interface EnemyDef {
  id: string;
  /** Name for the death text: "Von einem {name} erschlagen." */
  name: string;
  w: number;
  h: number;
  hp: number;
  damage: number;
  poise: number;
  /** Seconds without poise damage before it refills. */
  poiseDelay: number;
  stagger: number;
  /** Stagger after a successful parry – longer, so the riposte fits. */
  parryStagger: number;
  patrolSpeed: number;
  chaseSpeed: number;
  /** Starts chasing inside `sight`, gives up only beyond `lose` (two radii, §6.5). */
  sight: number;
  lose: number;
  attacks: AttackDef[];
  /** Pause between two attacks, s. */
  cooldown: [number, number];
  /** Optional phase 2 below a share of life: the telegraph shrinks by `telegraphMul`. */
  phase2?: PhaseDef;
  /** More phases (a final boss): each starts below its share of life; `phase2` counts as the first of them. */
  phases?: PhaseDef[];
  /** Currency/experience it leaves behind. */
  reward: number;
  /** A boss: one per room, gets the big life bar, locks the arena, stays dead for good. */
  boss?: boolean;
  /** Damage multiplier for hits that land from behind or from above (a construct's weak spot). */
  weakSpot?: number;
  /** Damage multiplier for hits from the front (a shield). */
  frontGuard?: number;
  /** On first noticing the hero it wakes every other enemy in the room. */
  callsHelp?: boolean;
  /** Can be pushed by knockback while attacking (light vermin); heavies ignore pushes. */
  light?: boolean;
  /** Flies: no gravity, hovers at its spawn height. */
  flying?: boolean;
  /** In its last phase, a hero carrying this flag can end the fight with the interact button. */
  endsWith?: string;
}

export interface PhaseDef {
  below: number;
  telegraphMul: number;
  speedMul?: number;
}

export interface EnemySpawn {
  /** Enemy def id. */
  kind: string;
  x: number;
  y: number;
  patrol: [number, number];
  /** Starts awake (an ambush) – otherwise it patrols until it notices the hero. */
  awake?: boolean;
}

export interface RoomDef {
  id: string;
  w: number;
  h: number;
  solids: Solid[];
  /** Named arrival points; `spawn` is the default one. */
  spawn: { x: number; y: number };
  entries?: Record<string, { x: number; y: number }>;
  exits?: ExitDef[];
  enemies: EnemySpawn[];
  props?: PropDef[];
  /** Areas where stamina refills at half speed. */
  smog?: Rect[];
  /** Dark rooms: the picture only shows what is near a light (render hint). */
  dark?: boolean;
  /** Camera profile (render hint). */
  camera?: 'hall' | 'shaft' | 'chamber' | 'arena';
  /** Look of the room (render hint): which palette and backdrop. */
  theme?: string;
  /** A dead zone: magic collapses – no weapon skills, stamina at half speed – unless pure light is carried. */
  deadZone?: boolean;
  /** A wave cauldron: waves of enemies once `after` is set (or at once), the arena shut meanwhile. */
  waves?: { after?: string; list: EnemySpawn[][] };
  /** Heat counts here (Ascheburg): kills raise it, high Heat brings elites and a hunter. */
  heat?: boolean;
  /** A pure zone: breath comes faster, skills cool down faster. */
  pure?: boolean;
}

/** Touching `rect` moves the hero into room `to`, arriving at its entry `at`. */
export interface ExitDef {
  rect: Rect;
  to: string;
  at: string;
  /** Needs this world flag (a gate key, a lever) – otherwise the exit is shut. */
  needs?: string;
  /** A door: used with the interact button instead of by walking into it. */
  door?: boolean;
}

/**
 * The interactive pieces of a room. Each carries a world-unique `id`; what happened to it (pulled,
 * broken, taken) is a world flag named after it, so it survives leaving the room and saving.
 */
export type PropDef =
  | { type: 'rest'; id: string; x: number; y: number }
  | { type: 'lever'; id: string; x: number; y: number; opens: string }
  | { type: 'gate'; id: string; rect: Rect; /** closed until the boss of the room is awake, then until it dies */ arena?: boolean }
  | { type: 'wall'; id: string; rect: Rect; minDamage: number }
  | { type: 'hazard'; id: string; rect: Rect; damage: number; /** on/off cycle, s; omitted = always on */ period?: number; phase?: number }
  | { type: 'pickup'; id: string; x: number; y: number; item: string }
  | { type: 'sign'; id: string; x: number; y: number; text: string }
  /** A figure of the story standing in the world (picture only; its words are on the sign beside it). */
  | { type: 'npc'; id: string; x: number; y: number; sprite: string; h: number };

export interface LevelDef {
  id: string;
  rooms: Record<string, RoomDef>;
  start: { room: string; at: string };
}

/** A run modifier's numbers (all optional; 1 / 0 = no change). */
export interface RunMod {
  hpMul?: number;
  damageMul?: number;
  staminaAdd?: number;
  flaskDelta?: number;
  currencyMul?: number;
  enemyDamageMul?: number;
  parryAdd?: number;
  costMul?: number;
  /** Traits of a folk or class (UEBERGABE §7.1): */
  blockAdd?: number;
  chargeMul?: number;
  skillCdMul?: number;
  plungeMul?: number;
  riposteMul?: number;
  rollCostMul?: number;
  poiseMul?: number;
  wallMul?: number;
  /** Enemies notice later (sight radius) / telegraph longer. */
  sightMul?: number;
  telegraphMul?: number;
  /** Smog does not slow the breath; dead zones do not choke it; a wider ring of sight in the dark. */
  smogImmune?: boolean;
  deadZoneImmune?: boolean;
  darkSight?: boolean;
  /** Pure zones give this much more. */
  pureMul?: number;
}

/** What the hero's controls say this tick. Held states only; the hero derives presses itself. */
export interface Command {
  /** -1..1 */
  x: number;
  /** -1..1, up positive */
  y: number;
  jump: boolean;
  roll: boolean;
  attack: boolean;
  block: boolean;
  interact: boolean;
  heal: boolean;
  /** Next weapon slot. */
  swap: boolean;
  /** Weapon ability. */
  skill: boolean;
}

export const NO_COMMAND: Command = {
  x: 0,
  y: 0,
  jump: false,
  roll: false,
  attack: false,
  block: false,
  interact: false,
  heal: false,
  swap: false,
  skill: false,
};

/** Who is meant: the hero, or an enemy by index. */
export type Who = 'hero' | number;

export type SimEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'roll' }
  | { type: 'swing'; who: Who; attack: string }
  | { type: 'telegraph'; enemy: number; attack: string; parryable: boolean }
  | { type: 'hit'; target: Who; x: number; y: number; damage: number; heavy: boolean; riposte: boolean }
  | { type: 'blocked'; x: number; y: number; damage: number }
  | { type: 'parry'; enemy: number; x: number; y: number }
  | { type: 'guardBreak' }
  | { type: 'dodge' }
  | { type: 'stagger'; enemy: number; x: number; y: number }
  | { type: 'enemyDied'; enemy: number; x: number; y: number }
  | { type: 'heroDied'; cause: string }
  | { type: 'respawn' }
  | { type: 'over' }
  | { type: 'room'; room: string }
  | { type: 'rest'; id: string; first: boolean }
  | { type: 'restEnd' }
  | { type: 'heal'; amount: number }
  | { type: 'reward'; amount: number; x: number; y: number }
  | { type: 'cellDropped'; amount: number }
  | { type: 'cellLost'; amount: number }
  | { type: 'cellRecovered'; amount: number }
  | { type: 'lever'; id: string; opens: string }
  | { type: 'wallBroken'; id: string; x: number; y: number }
  | { type: 'wallHolds'; x: number; y: number }
  | { type: 'pickup'; id: string; item: string }
  | { type: 'bossAwake'; enemy: number; name: string }
  | { type: 'bossDied'; enemy: number; id: string }
  | { type: 'call'; enemy: number }
  | { type: 'skill'; who: Who; id: string }
  | { type: 'swap'; weapon: string }
  | { type: 'hazard'; x: number; y: number }
  | { type: 'shot'; x: number; y: number }
  | { type: 'levelUp'; stat: string }
  | { type: 'phase'; enemy: number }
  | { type: 'locked'; x: number; y: number }
  | { type: 'wave'; n: number; of: number }
  | { type: 'wavesDone' }
  | { type: 'heat'; heat: number }
  | { type: 'hunter' }
  | { type: 'ended'; enemy: number };

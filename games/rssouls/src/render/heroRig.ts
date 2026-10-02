import { phaseOf, recoveryElapsed, windupOf } from '../core/attack';
import type { Hero } from '../core/hero';

/**
 * The hero as a cutout rig rendered in Blender (tools/assets/rssouls_rig): one strip of frames per
 * action for the body, one for the sword fist (drawn over the weapon), and per frame where the grip
 * is and which way the blade points. Pixels are those of the rendered frames.
 */
export interface RigAction {
  frames: number;
  fps: number;
  loop: boolean;
  /** Attacks: [first frame of the cut, first frame of the follow-through]. */
  phases: [number, number] | null;
  w: number;
  h: number;
  /** The figure's foot point in the frame. */
  anchor: [number, number];
  /** Per frame: grip x, y (pixels, y down) and blade angle (radians, counter-clockwise). */
  grip: [number, number, number][];
  /** The blade angles made continuous over the frames, so an arc can be drawn between two of them. */
  unwrapped: number[];
}

export interface RigData {
  /** Height of the standing figure in frame pixels. */
  figurePx: number;
  actions: Record<string, RigAction>;
}

const RAW = Object.values(import.meta.glob('../assets/rig/hero.json', { eager: true, import: 'default' }))[0] as
  | { figurePx: number; actions: Record<string, Omit<RigAction, 'unwrapped'>> }
  | undefined;

export const HERO_RIG: RigData | null = RAW
  ? {
      figurePx: RAW.figurePx,
      actions: Object.fromEntries(
        Object.entries(RAW.actions).map(([k, a]) => {
          const unwrapped: number[] = [];
          for (const [, , ang] of a.grip) {
            let x = ang;
            const prev = unwrapped[unwrapped.length - 1];
            if (prev !== undefined) {
              while (x - prev > Math.PI) x -= Math.PI * 2;
              while (prev - x > Math.PI) x += Math.PI * 2;
            }
            unwrapped.push(x);
          }
          return [k, { ...a, unwrapped }];
        }),
      ),
    }
  : null;

/**
 * Which rendered action an attack plays. The rig has one action per kind of movement; the weapons'
 * attacks share them (a hammer's overhead blow is the heavy cut, a dagger's stab is the thrust).
 */
const ATTACK_ACTION: Record<string, string> = {
  hieb1: 'hieb1', hieb2: 'hieb2', stich: 'stich', ladung: 'schwer', aufwaerts: 'hieb2', luft: 'luft', sturz: 'sturz',
  'rost-splitter': 'dreh',
  schlag1: 'schwer', schlag2: 'hieb2', bodenschlag: 'schwer', hammerluft: 'luft', hammersturz: 'sturz', schlagwelle: 'schwer',
  bodenbrecher: 'schwer',
  dolch1: 'stich', dolch2: 'stich', dolch3: 'hieb1', dolch4: 'stich', dolchluft: 'luft', dolchsturz: 'sturz',
  'licht-schnitt': 'stich', lichtfaecher: 'stich',
};

function attackAction(rig: RigData, h: Hero): string | null {
  const def = h.attack!.def;
  const named = ATTACK_ACTION[def.id];
  const guess = named ?? (def.leap ? 'sturz' : def.around ? 'dreh' : def.kind === 'thrust' ? 'stich' : def.kind === 'charge' ? 'schwer' : def.box.y > 25 ? 'hieb2' : 'hieb1');
  if (rig.actions[guess]) return guess;
  return rig.actions.hieb1 ? 'hieb1' : null;
}

export interface RigPick {
  action: string;
  frame: number;
  /** In an attack: the cut is under way, and the frame the cut started from. */
  cutting: boolean;
  cutFrom: number;
  /** The painted body's turn applies on top (a roll spins the curled-up figure). */
  turn?: boolean;
}

/**
 * The action and frame for what the hero is doing, or null when the rig has nothing for it (the
 * view then keeps the weapon's own angle). `t` is the view's clock in seconds.
 */
export function pickRigFrame(rig: RigData, h: Hero, t: number): RigPick | null {
  if (h.state === 'attack' && h.attack) {
    const name = attackAction(rig, h);
    const a = name ? rig.actions[name] : undefined;
    if (!name || !a?.phases) return null;
    const run = h.attack;
    const [p0, p1] = a.phases;
    const ph = phaseOf(run);
    const w = windupOf(run);
    let frame: number;
    if (ph === 'windup') frame = Math.floor(p0 * Math.min(0.999, run.t / Math.max(0.001, w)));
    else if (ph === 'active') frame = p0 + Math.floor((p1 - p0) * Math.min(0.999, (run.t - w) / Math.max(0.001, run.def.active)));
    else frame = p1 + Math.floor((a.frames - p1) * Math.min(0.999, recoveryElapsed(run) / Math.max(0.001, run.def.recovery)));
    return { action: name, frame, cutting: ph === 'active', cutFrom: Math.max(0, p0 - 1) };
  }
  const still = (action: string, turn = false): RigPick | null =>
    rig.actions[action] ? { action, frame: 0, cutting: false, cutFrom: 0, turn } : null;
  switch (h.state) {
    case 'block':
      return still('block');
    case 'roll':
    case 'dash':
      return still('roll', true);
    case 'charge':
      return still('charge');
    case 'drink':
      return still('drink');
    case 'rest':
      return still('rest');
    case 'hurt':
    case 'guardBreak':
      return still('hurt');
    case 'dead':
      return still('dead');
  }
  if (!h.body.onGround && h.alive) return still(h.body.vy > 0 ? 'jump' : 'fall');
  const speed = Math.abs(h.body.vx);
  if (h.state === 'move' && h.body.onGround && speed > 30 && rig.actions.run) {
    const a = rig.actions.run;
    // the stride follows the speed: full speed is the authored rate
    const frame = Math.floor(t * a.fps * Math.max(0.6, speed / 175)) % a.frames;
    return { action: 'run', frame, cutting: false, cutFrom: 0 };
  }
  if (h.state === 'move' && rig.actions.idle) {
    const a = rig.actions.idle;
    return { action: 'idle', frame: Math.floor(t * a.fps) % a.frames, cutting: false, cutFrom: 0 };
  }
  return null;
}

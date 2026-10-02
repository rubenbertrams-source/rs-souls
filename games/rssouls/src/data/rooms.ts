import type { LevelDef, RoomDef } from '../core/types';

/**
 * The training room: a yard in Rosttal around a Kollektor. Flat ground to read telegraphs on, two
 * one-way platforms and a crate to try the jump against, three spinner spawns.
 */
export const KOLLEKTOR_HOF: RoomDef = {
  id: 'kollektor-hof',
  w: 1280,
  h: 560,
  solids: [
    { x: -40, y: 0, w: 1360, h: 40 },
    { x: -40, y: 40, w: 40, h: 600 },
    { x: 1280, y: 40, w: 40, h: 600 },
    { x: 300, y: 140, w: 180, h: 12, oneWay: true },
    { x: 760, y: 40, w: 90, h: 60 },
    { x: 920, y: 230, w: 200, h: 12, oneWay: true },
  ],
  spawn: { x: 140, y: 40 },
  enemies: [
    { kind: 'rost-spinner', x: 620, y: 40, patrol: [480, 730] },
    { kind: 'rost-spinner', x: 1080, y: 40, patrol: [900, 1230] },
    { kind: 'rost-spinner', x: 1020, y: 242, patrol: [940, 1100] },
  ],
  props: [{ type: 'rest', id: 'hof-kollektor', x: 100, y: 40 }],
  smog: [{ x: 880, y: 40, w: 400, h: 400 }],
};

export const TRAINING: LevelDef = {
  id: 'training',
  rooms: { [KOLLEKTOR_HOF.id]: KOLLEKTOR_HOF },
  start: { room: KOLLEKTOR_HOF.id, at: 'spawn' },
};

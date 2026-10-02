import type { LevelDef } from '../core/types';

/**
 * The map's layout, worked out from the exits alone: a west exit puts its room to the left, an east
 * exit to the right, doors and shafts below or above. Pure, so it is tested without a screen.
 */
export interface MapCell {
  id: string;
  x: number;
  y: number;
}

export interface MapLayout {
  cells: Record<string, MapCell>;
  links: [string, string][];
}

export function layoutMap(level: LevelDef): MapLayout {
  const cells: Record<string, MapCell> = {};
  const taken = new Set<string>();
  const place = (id: string, x: number, y: number) => {
    // the wanted cell, or the nearest free one around it
    for (let r = 0; r < 8; r++) {
      for (const [dx, dy] of [[0, 0], [0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]] as const) {
        const k = `${x + dx},${y + dy}`;
        if (taken.has(k)) continue;
        taken.add(k);
        cells[id] = { id, x: x + dx, y: y + dy };
        return;
      }
    }
  };
  const links: [string, string][] = [];
  const linked = new Set<string>();
  for (const room of Object.values(level.rooms)) {
    for (const ex of room.exits ?? []) {
      const key = [room.id, ex.to].sort().join('|');
      if (linked.has(key) || !level.rooms[ex.to]) continue;
      linked.add(key);
      links.push([room.id, ex.to]);
    }
  }
  // walkways first, doors second: a shortcut door must not pull a room out of its street
  const spread = (useDoors: boolean) => {
    const queue = Object.keys(cells);
    while (queue.length) {
      const id = queue.shift()!;
      const room = level.rooms[id];
      const at = cells[id];
      if (!room || !at) continue;
      for (const ex of room.exits ?? []) {
        if (cells[ex.to] || !level.rooms[ex.to] || (!!ex.door && !useDoors)) continue;
        let dx = 0;
        let dy = 0;
        if (ex.door) dy = 1;
        else if (ex.rect.x < 0) dx = -1;
        else if (ex.rect.x > room.w) dx = 1;
        else if (ex.rect.y < 0) dy = 1;
        else dy = -1;
        place(ex.to, at.x + dx, at.y + dy);
        queue.push(ex.to);
      }
    }
  };
  place(level.start.room, 0, 0);
  spread(false);
  // rooms only a door leads to, and whatever hangs off them
  for (let pass = 0; pass < 4; pass++) {
    spread(true);
    spread(false);
  }
  return { cells, links };
}

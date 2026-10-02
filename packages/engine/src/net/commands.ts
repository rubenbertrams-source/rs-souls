/**
 * Game commands: discrete orders ("build a house at 12,40", "remove road 17") that travel next to
 * the input of one tick and are applied by every peer at that tick, in the same order.
 *
 * A stick is sampled sixty times a second and one lost sample is covered by the next; an order is
 * given once and has to arrive exactly once, on every peer, at the same tick. So it rides the input
 * frame of the tick it is scheduled for – and every repetition of that frame – and a tick is only
 * simulated once its input is there, which therefore means its orders are there too.
 */

/** One order as it is applied: the seat that gave it and the order itself (plain JSON). */
export interface SlotCommand {
  slot: number;
  cmd: unknown;
}

/**
 * Serialised size (JSON characters) all orders of one peer for one tick may take together.
 *
 * Sized for the relay, which drops frames over 16 KB: an input frame carries its own tick and the
 * last three again (INPUT_REDUNDANCY), so four ticks of orders ride in one frame – 8 KB at worst,
 * with room to spare. What does not fit waits for the next tick, in order; a single order that is
 * larger than this on its own is refused.
 */
export const MAX_TICK_COMMAND_BYTES = 2048;

/**
 * The order as every peer will see it: through JSON and back, so the sender simulates exactly what
 * arrives elsewhere (no `undefined` fields, no -0, no class instances). Null if it cannot travel.
 */
export function wireCommand(cmd: unknown): { cmd: unknown; size: number } | null {
  let json: string | undefined;
  try {
    json = JSON.stringify(cmd);
  } catch {
    return null;
  }
  if (json === undefined || json.length > MAX_TICK_COMMAND_BYTES) return null;
  return { cmd: JSON.parse(json) as unknown, size: json.length };
}

/**
 * Orders waiting for a tick, oldest first. `take` hands out as many as fit one tick's budget and
 * keeps the rest, in the order they were given.
 */
export class CommandQueue {
  private queue: { slot: number; cmd: unknown; size: number }[] = [];

  get length() {
    return this.queue.length;
  }

  /** Queue an order for `slot`; false if it cannot travel (not JSON, or too large on its own). */
  push(slot: number, cmd: unknown): boolean {
    const w = wireCommand(cmd);
    if (!w) return false;
    this.queue.push({ slot, cmd: w.cmd, size: w.size });
    return true;
  }

  take(): [slot: number, cmd: unknown][] {
    const out: [number, unknown][] = [];
    // the bracket and a comma per entry plus the `[slot,` around each order – counted generously
    let used = 2;
    while (this.queue.length) {
      const next = this.queue[0]!;
      const cost = next.size + 6;
      if (out.length && used + cost > MAX_TICK_COMMAND_BYTES) break;
      used += cost;
      out.push([next.slot, next.cmd]);
      this.queue.shift();
    }
    return out;
  }

  clear() {
    this.queue = [];
  }
}

/** Deterministic order of one tick's orders: by seat, then in the order each seat gave them. */
export function sortCommands(bySlot: Map<number, unknown[]>): SlotCommand[] {
  const out: SlotCommand[] = [];
  for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) for (const cmd of bySlot.get(slot)!) out.push({ slot, cmd });
  return out;
}

/**
 * Orders of a game played on this machine alone: nothing travels, but they are applied the same
 * way – at the start of the next simulated tick – so a game has one code path for both.
 */
export class LocalCommands {
  /** Next tick to simulate (counts only ticks that actually ran). */
  tick = 0;
  /** Seat an order without an explicit one is given for. */
  defaultSlot = 0;
  private readonly queue = new CommandQueue();

  reset(defaultSlot = 0) {
    this.tick = 0;
    this.defaultSlot = defaultSlot;
    this.queue.clear();
  }

  send(cmd: unknown, slot = this.defaultSlot): boolean {
    return this.queue.push(slot, cmd);
  }

  /** The orders for the tick about to run; advances the tick. */
  take(): { tick: number; cmds: SlotCommand[] } {
    const bySlot = new Map<number, unknown[]>();
    for (const [slot, cmd] of this.queue.take()) {
      let l = bySlot.get(slot);
      if (!l) bySlot.set(slot, (l = []));
      l.push(cmd);
    }
    return { tick: this.tick++, cmds: sortCommands(bySlot) };
  }
}

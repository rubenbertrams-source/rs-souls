/**
 * A side channel between the companion phones in the room and whatever game is running.
 *
 * `pads.ts` needs nothing like this: a controller's payload becomes a `TouchInput`, and the game
 * then reads it through the `InputManager` like any other device. A microphone has no such path –
 * an audio take is not an input state – and a game may not import from the hub, so the two ends
 * need somewhere neutral to meet.
 *
 * The engine owns the mechanism, the game owns the meaning: the payload stays `unknown` here and
 * is shaped entirely by whoever registered that companion kind.
 *
 * The name comes from the hub's `companion/` pages, but nothing here knows what a phone is: this is
 * a side channel from outside into a running game, and a future kind that is not a phone at all
 * would need no change.
 */

export interface CompanionLink {
  readonly dev: string;
  readonly kind: string;
  /** Label for the lobby seat, e.g. "Mikro 2". */
  readonly name: string;
  /** Seat at this machine, or -1 while it holds none. */
  slot: number;
  /** Kind-specific payload back to this phone. */
  send(d: unknown): void;
}

export class CompanionBus {
  private readonly byDev = new Map<string, CompanionLink>();
  private readonly subs = new Set<(dev: string, d: unknown) => void>();

  /** Host side: a phone arrived (or came back – the same `dev` replaces its old link). */
  add(link: CompanionLink) {
    this.byDev.set(link.dev, link);
  }

  remove(dev: string) {
    this.byDev.delete(dev);
  }

  get(dev: string): CompanionLink | undefined {
    return this.byDev.get(dev);
  }

  all(kind?: string): CompanionLink[] {
    const out: CompanionLink[] = [];
    for (const l of this.byDev.values()) if (!kind || l.kind === kind) out.push(l);
    return out;
  }

  /** The phone in a given seat, if any. */
  bySlot(slot: number, kind?: string): CompanionLink | undefined {
    for (const l of this.byDev.values()) if (l.slot === slot && (!kind || l.kind === kind)) return l;
    return undefined;
  }

  /**
   * Host side: hand a payload to whoever is listening.
   *
   * **Never inside the simulation.** These arrive over the network and therefore at a different
   * moment on every peer; reading one from `update()` or letting it reach `stateHash()` makes two
   * machines compute different numbers from the same tick. A game drives its own clock and picks
   * the payload up from there – `games/mimic` runs its rounds on deadlines for exactly this reason.
   */
  deliver(dev: string, d: unknown) {
    for (const fn of this.subs) fn(dev, d);
  }

  /** Game side: listen. Returns the unsubscribe – a game that forgets it leaks into the next match. */
  on(fn: (dev: string, d: unknown) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  /** Everything is forgotten when the room is left. Listeners stay: they belong to the page. */
  clear() {
    this.byDev.clear();
  }
}

/** One per page, like the InputManager: the room is a property of the page, not of a match. */
export const companions = new CompanionBus();

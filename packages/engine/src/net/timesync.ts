/**
 * Keeps peers on the same simulation tick (GGPO-style "frame advantage").
 *
 * Every input message carries the sender's current tick (`k`) and how far the sender believes it is
 * ahead of us (`a`). From the newest report we know our own lead; half the difference between the two
 * views is the real skew – the transit time cancels out because it inflates both estimates equally.
 * A peer that is ahead drops single ticks (no more than one per SKIP_INTERVAL_MS) until balanced.
 *
 * This changes only *when* ticks run, never what they compute, so determinism is untouched.
 */

/** Skew (in ticks) from which the ahead peer starts dropping ticks. */
export const SKIP_THRESHOLD = 1;
/** Minimum spacing between dropped ticks (≤ 10 per second: an 8-tick lead is gone in under a second). */
export const SKIP_INTERVAL_MS = 100;

interface PeerView {
  tick: number;
  lead: number;
  at: number;
}

export class TimeSync {
  private peers = new Map<string, PeerView>();
  private lastDrop = -Infinity;

  reset() {
    this.peers.clear();
    this.lastDrop = -Infinity;
  }

  forget(peer: string) {
    this.peers.delete(peer);
  }

  /** A message from `peer` reported its tick and its own lead estimate. */
  observe(peer: string, peerTick: number, peerLead: number, now: number) {
    this.peers.set(peer, { tick: peerTick, lead: peerLead, at: now });
  }

  /** How far our tick is ahead of the most-behind peer's last reported tick (0 without reports). */
  localLead(myTick: number): number {
    let max = -Infinity;
    for (const p of this.peers.values()) max = Math.max(max, myTick - p.tick);
    return Number.isFinite(max) ? max : 0;
  }

  /** Real skew in ticks: positive means we are ahead and should drop ticks. */
  skew(myTick: number): number {
    let worst = 0;
    for (const p of this.peers.values()) {
      const s = (myTick - p.tick - p.lead) / 2;
      if (s > worst) worst = s;
    }
    return worst;
  }

  /** Ticks to drop this frame (0 or 1). */
  ticksToDrop(myTick: number, now: number): 0 | 1 {
    if (Math.round(this.skew(myTick)) < SKIP_THRESHOLD) return 0;
    if (now - this.lastDrop < SKIP_INTERVAL_MS) return 0;
    this.lastDrop = now;
    return 1;
  }
}

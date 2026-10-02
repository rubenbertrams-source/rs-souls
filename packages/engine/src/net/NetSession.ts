import { emptyState, type InputState } from '../input/PlayerInput';
import type { InputManager, LockstepHook } from '../input/InputManager';
import { decodeMessage, isHashMessage, isInputMessage, packInput, packMessage, unpackInput, WIRE_VERSION, type InputMessage, type PackedInput, type PeerMessage } from './codec';
import { Lockstep } from './lockstep';
import { DelayTuner, MAX_DELAY, MIN_DELAY } from './tuner';
import { TimeSync } from './timesync';
import { clientKey } from './codes';
import { InputLog } from './inputlog';
import { CommandQueue, type SlotCommand } from './commands';

export { MAX_DELAY, MIN_DELAY };

/** Frames the relay sends to a client. */
export type RelayFrame =
  | { t: 'joined'; room: string; id: string; host: boolean; hostId?: string; peers: string[]; resumed?: boolean }
  | { t: 'peer'; id: string; joined: boolean; away?: boolean; back?: boolean }
  | { t: 'host'; id: string }
  | { t: 'msg'; from: string; d: unknown }
  | { t: 'pong'; ts: number }
  | { t: 'error'; code: string };

export interface NetMatchOptions {
  /** Slot indices of players sitting at this machine. */
  local: number[];
  /** Slot indices of players on other peers and who owns them. */
  remote: { slot: number; peer: string }[];
  /**
   * Input delay in ticks everybody starts with. The host derives it from its link and ships it in the
   * start message so every peer pre-fills the same window; a peer on a worse link raises at once.
   */
  delay?: number;
  /** Identifies the match; frames of another match (e.g. the previous race) are dropped. */
  matchId: number;
  /** Ticks an unattended seat waits before a bot takes it (default SEAT_GRACE_TICKS); `?grace=` for probes. */
  graceTicks?: number;
  input: InputManager;
}

/** Anything with an optional state hash (the running GameInstance). */
export interface Hashable {
  stateHash?(): number;
}

export const HASH_EVERY = 60;
/** Fallback start delay when no link measurement exists yet (100 ms at 60 Hz). */
export const DEFAULT_DELAY = 6;
/** How many past ticks ride along in every input message so a lost packet does not stall anyone. */
export const INPUT_REDUNDANCY = 4;
/**
 * How long an unattended seat waits for its player before a bot takes it over, in **simulation**
 * ticks (60 = 1 s). Ticks, not milliseconds: every peer has to hand the seat over on the same tick
 * or the match desyncs, and a wall clock is the one thing peers do not share. Counted in game time,
 * which is also what the waiting players actually experience.
 */
export const SEAT_GRACE_TICKS = 15 * 60;
/** Ticks of log sent per message. Sized so even an input that never repeats fits a relay frame. */
export const LOG_CHUNK_TICKS = 600;
/** JSON characters of logged game orders per resync message – far enough under the relay's 16 KB. */
export const LOG_CHUNK_CHARS = 12000;
/**
 * How far ahead of the running match a returning peer books its seat back. It has to be far enough
 * that the peer can capture and ship input for that tick before everybody reaches it – its own
 * input delay plus a margin for the trip.
 */
export const LIVE_MARGIN_TICKS = 90;
/** How many round-trip samples the median/p90 estimate keeps (0.5 s apart → last ~10 s). */
export const RTT_WINDOW = 20;
/** Samples needed before the link estimate is trusted for the start delay / tuning. */
export const MIN_RTT_SAMPLES = 3;
/** The start barrier gives up waiting for a peer's ready signal after this long. */
export const START_TIMEOUT_MS = 15000;
/**
 * How long a client keeps trying to get back into its room. Matches the relay's AWAY_TTL: past that
 * the seat is gone anyway, so trying on would only keep a dead room on screen.
 */
export const RECONNECT_WINDOW_MS = 90000;
/**
 * Waits between reconnect attempts, in ms; the last one repeats until the window closes.
 *
 * Capped at two seconds rather than backing off further: every second spent waiting for the next
 * attempt is a second of the seat's grace period spent, and the difference between coming back into
 * the race and watching a bot finish it was measured to be exactly this.
 */
const RECONNECT_BACKOFF = [0, 250, 500, 1000, 1500, 2000];

/**
 * One connection to the relay: room membership, peer messages, and – during a match – the lockstep glue
 * between the InputManager and the wire. Lobby/game semantics live in the hub; this class knows only
 * slots, ticks and hashes.
 */
export class NetSession implements LockstepHook {
  id = '';
  room = '';
  isHost = false;
  hostId = '';
  peers: string[] = [];
  /** Round-trip time to the relay in ms. */
  ping = 0;
  /** Smoothed round-trip time and its variation (RFC 6298 style), in milliseconds. */
  srtt = 0;
  rttvar = 0;
  /** Milliseconds the simulation spent waiting for remote input since the match started. */
  stallMs = 0;
  /** Ticks of remote input currently buffered ahead of the simulation. */
  bufferDepth = 0;
  /** Number of stall episodes (frames where the simulation waited for remote input). */
  stalls = 0;
  stalling = false;
  desyncs = 0;
  /** Seed agreed for the current match (set by the hub from the start message). */
  matchSeed = 0;
  /** Start delay agreed for the current match (host's suggestion from the start message); null = own estimate. */
  matchDelay: number | null = null;
  /**
   * Grace ticks agreed for the current match, from the host's start message; null = the default.
   * It travels with the match for the same reason the delay does: two peers handing a seat to a bot
   * at two different ticks is a desync, so the number may not come from each peer's own URL.
   */
  matchGrace: number | null = null;
  /** Own state hashes [tick, hash] of the current match (latest last). */
  hashes: [number, number][] = [];
  readonly remoteHashes = new Map<string, Map<number, number>>();
  lockstep: Lockstep | null = null;
  /** True once the start barrier released the simulation of the current match. */
  started = false;
  /**
   * A peer appeared or vanished. `how` separates the two kinds of vanishing that matter: 'away' is a
   * dropped socket whose seat the relay still holds, 'gone' is a seat that is free again. 'back' is
   * the same peer returning with the same id.
   */
  onPeer: ((id: string, joined: boolean, how: 'joined' | 'back' | 'away' | 'gone') => void) | null = null;
  /** Peers whose socket dropped but whose seat is still held, and when that happened (performance.now). */
  readonly awayPeers = new Map<string, number>();
  onHost: ((id: string) => void) | null = null;
  /** Peer messages that are not lockstep input/hash frames (lobby, start, …). */
  onMessage: ((from: string, d: PeerMessage) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  onDesync: ((tick: number, peer: string) => void) | null = null;
  /** Link state changed: 'lost' (trying to get back), 'back' (resumed), 'gone' (gave up). */
  onLink: ((state: 'lost' | 'back' | 'gone') => void) | null = null;
  /** True while the socket is down and we are still trying to get the room back. */
  reconnecting = false;
  /**
   * This client is in the room but never simulates it – a phone acting as a controller, a companion
   * screen. The relay broadcasts every input and hash frame to the whole room, and to a client with
   * no lockstep those are not just useless, they would pile up in `pendingFrames` waiting for a
   * match that is never going to start here. It still announces its wire version above, because a
   * peer that says nothing pushes the whole room back to the JSON fallback.
   */
  passive = false;
  /** Wall-clock ms since the connection dropped, 0 while connected. */
  get lostForMs() {
    return this.lostAt ? performance.now() - this.lostAt : 0;
  }
  /** This tab's identity towards the relay; the same key comes back as the same peer id. */
  readonly key = clientKey();
  private ws: WebSocket | null = null;
  private input: InputManager | null = null;
  private slotOwner = new Map<number, string>();
  private matchId = 0;
  private pendingSend: [number, PackedInput][] = [];
  /** The last few frames we sent, repeated in each message as redundancy. */
  private sentFrames: [number, [number, PackedInput][]][] = [];
  /** Game orders of our seats waiting for a tick (see commands.ts). */
  private cmdQueue = new CommandQueue();
  /** Orders we scheduled, by tick, for as long as that tick's frame is still being repeated. */
  private ownCmds = new Map<number, [number, unknown][]>();
  /**
   * Newest tick we have sent a frame for. Orders only ever go to a tick past it: a tick whose frame
   * is already out may have been simulated elsewhere by now (after the delay was lowered, the next
   * frames repeat ticks that were sent before), so orders added to it would arrive too late.
   */
  private lastFrameTick = -1;
  private pendingFrames: { from: string; m: PeerMessage }[] = [];
  /**
   * Peers that have said they can read the packed wire form (see `WIRE_VERSION`).
   *
   * A deploy while somebody is playing is the case this exists for: the two clients in a room may
   * come from two builds, and a peer that cannot read the packed form would simply see no input at
   * all – no error, just everybody waiting. So the packed form is used only towards peers that
   * announced it, and the fallback is the JSON every version has always understood.
   */
  private readonly wirePeers = new Set<string>();
  private joinWait: { resolve: (room: string) => void; reject: (e: Error) => void } | null = null;
  private pingTimer = 0;
  private closed = false;
  private lostAt = 0;
  private retryTimer = 0;
  private retryStep = 0;
  /** Room we were in when the link dropped, so the retry knows where to go back to. */
  private lastRoom = '';

  constructor(readonly url: string) {}

  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      this.ws = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
        // twice a second: often enough to see jitter, far too little traffic to matter
        this.pingTimer = window.setInterval(() => this.raw({ t: 'ping', ts: performance.now() }), 500);
        resolve();
      };
      ws.onerror = () => {
        if (!opened) reject(new Error('relay-unreachable'));
      };
      ws.onclose = () => {
        window.clearInterval(this.pingTimer);
        if (!opened) reject(new Error('relay-unreachable'));
        this.joinWait?.reject(new Error('closed'));
        this.joinWait = null;
        if (this.closed || this.ws !== ws) return; // a deliberate close, or an old socket we replaced
        // Not "the session is over": the relay holds this peer's seat for a while, so the honest
        // reaction to a dropped socket is to go and get it back. Only when that window runs out
        // is the session really gone.
        if (this.lastRoom) this.beginReconnect();
        else {
          this.closed = true;
          this.onClose?.('closed');
        }
      };
      ws.onmessage = (ev) => this.onFrame(ev.data);
    });
  }

  /** Create a room with the given code (the relay rejects codes that are in use). */
  create(code: string): Promise<string> {
    return this.roomRequest({ t: 'create', room: code, as: this.key });
  }

  join(code: string): Promise<string> {
    return this.roomRequest({ t: 'join', room: code, as: this.key });
  }

  private roomRequest(frame: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('not-connected'));
      this.joinWait = { resolve, reject };
      this.raw(frame);
    });
  }

  /**
   * The owner of this slot is not sending any more. The changeover tick is the one after the last
   * tick it did send, which every peer works out to the same number - see `maxSeen`.
   */
  private dropSlot(slot: number) {
    this.lockstep?.setAway(slot, (this.maxSeen.get(slot) ?? this.lockstep.tick - 1) + 1);
  }

  // ---- rejoining a match that is still running ----
  //
  // A deterministic simulation is a function of its seed and its inputs, so a peer that has both can
  // rebuild any tick of it. That is the whole trick: no world state is serialised and shipped, only
  // the inputs, and the returning peer re-runs the match at whatever speed its machine manages
  // (measured with tools/dev/probe-catchup.mjs: 55x real time in the slowest game, on the software
  // renderer). Which peer serves the log does not matter – by the same determinism they all hold
  // the identical one.

  /** True while ticks are being rebuilt rather than played. */
  get replaying(): boolean {
    return !!this.replay && !!this.lockstep && this.lockstep.tick < this.replay.head;
  }

  /** The rebuild the hub still has to run, or null. */
  get pendingReplay() {
    return this.replay;
  }

  /** Newest tick any peer reported running. */
  get liveTick() {
    return this.peerTick;
  }

  private serverPeer(): string {
    return this.peers.includes(this.hostId) ? this.hostId : ([...this.peers].sort()[0] ?? '');
  }

  /** Ask a peer for the running match, so this one can rebuild it. Returns false if nobody can serve. */
  requestResync(matchId: number): boolean {
    const serve = this.serverPeer();
    if (!serve) return false;
    this.resyncFrom = serve;
    this.replay = null;
    this.send({ t: 'rsy', m: matchId, from: 0 }, serve);
    return true;
  }

  /**
   * Ask for the stretch the last transfer did not cover.
   *
   * The match does not stand still while its log is being sent, so the log always ends a little
   * before the present. That leftover is what this closes. It cannot be left to the live input
   * either: a peer only keeps the last few ticks as redundancy, and the ones sent while this peer
   * was rebuilding went into a lockstep that no longer exists.
   */
  topUp(from: number): Promise<void> {
    const serve = this.serverPeer();
    if (!serve || !this.replay) return Promise.resolve();
    this.resyncFrom = serve;
    return new Promise((resolve) => {
      const done = () => {
        if (this.topUpWait !== done) return;
        this.topUpWait = null;
        resolve();
      };
      this.topUpWait = done;
      this.send({ t: 'rsy', m: this.matchId, from }, serve);
      setTimeout(done, 3000); // a peer that does not answer must not hang the rebuild forever
    });
  }

  /** Serve the log of the running match to a peer that asked for it. */
  private serveResync(to: string, matchId: number, from = 0) {
    const ls = this.lockstep;
    const log = this.log;
    if (!ls || !log || matchId !== this.matchId) return;
    const head = log.length;
    if (from > 0) {
      // a follow-up: the seats and the cuts are already over there, only the missing ticks are not
      for (const slot of log.slots) {
        for (let at = from; at < head; at += LOG_CHUNK_TICKS) {
          this.send({ t: 'rsyl', m: matchId, slot, from: at, d: log.encode(slot, at, Math.min(head, at + LOG_CHUNK_TICKS)) }, to);
        }
      }
      this.serveCommands(to, matchId, from, head);
      this.send({ t: 'rsye', m: matchId, head }, to);
      return;
    }
    const away = [...this.slotOwner.keys(), ...ls.local]
      .map((slot) => [slot, ls.awayFrom(slot)] as const)
      .filter(([, from]) => from !== undefined)
      .map(([slot, from]) => [slot, from!]);
    this.send({ t: 'rsyh', m: matchId, head, slots: log.slots, away }, to);
    // One seat and 600 ticks per message: the relay drops anything over 16 KB, and a run-length
    // encoded ten seconds of one seat stays well inside that even when nothing repeats.
    for (const slot of log.slots) {
      for (let from = 0; from < head; from += LOG_CHUNK_TICKS) {
        this.send({ t: 'rsyl', m: matchId, slot, from, d: log.encode(slot, from, Math.min(head, from + LOG_CHUNK_TICKS)) }, to);
      }
    }
    this.serveCommands(to, matchId, 0, head);
    this.send({ t: 'rsye', m: matchId, head }, to);
  }

  /** The game orders of `[from, head)`, after the input and before the end mark (the relay keeps order). */
  private serveCommands(to: string, matchId: number, from: number, head: number) {
    for (const c of this.log?.encodeCommands(from, head, LOG_CHUNK_CHARS) ?? []) this.send({ t: 'rsyc', m: matchId, c }, to);
  }

  /** Book the seat back into the running match, a little ahead so the input arrives in time. */
  claimSeatsBack(slots: number[]) {
    const ls = this.lockstep;
    if (!ls) return;
    const from = Math.max(this.peerTick, ls.tick) + LIVE_MARGIN_TICKS;
    for (const slot of slots) {
      // a seat a bot has already been given stays with the bot: that handover happened at one tick
      // in everybody's simulation, and taking it back would have to happen in everybody's too
      if (!ls.isAway(slot) || this.handedOver.has(slot)) continue;
      ls.setLive(slot, from);
      this.send({ t: 'live', m: this.matchId, slot, from });
    }
  }

  /** The rebuild is done; from here the match is played, not replayed. */
  finishReplay() {
    this.replay = null;
    this.started = true;
    this.tuner.matchStarted(performance.now());
  }

  /** Ticks an unattended seat still has before a bot takes it; 0 while somebody is driving it. */
  graceTicks(slot: number): number {
    const from = this.lockstep?.awayFrom(slot);
    if (from === undefined || !this.lockstep) return 0;
    return Math.max(0, from + this.grace - this.lockstep.tick);
  }

  /** Ticks a seat waits for its player before a bot takes over (see SEAT_GRACE_TICKS). */
  private grace = SEAT_GRACE_TICKS;

  /** Slots nobody is driving right now, with the ticks left before a bot takes over. */
  awaySlots(): { slot: number; grace: number; bot: boolean }[] {
    const ls = this.lockstep;
    if (!ls) return [];
    return [...ls.required]
      .filter((s) => ls.isAway(s))
      .map((slot) => ({ slot, grace: this.graceTicks(slot), bot: this.handedOver.has(slot) }));
  }

  /** Send a peer message to everyone else in the room (or one peer). */
  send(d: PeerMessage, to?: string) {
    // Input and hash frames – the only ones sent per tick – ride the packed wire form as soon as
    // everybody who would receive this frame can read it. Everything else stays JSON: it is rare,
    // and the hub, not this file, decides what is in it.
    const packed = (d.t === 'in' || d.t === 'hash') && this.wireReady(to) ? packMessage(d) : null;
    const body = packed ?? d;
    this.raw(to ? { t: 'msg', d: body, to } : { t: 'msg', d: body });
  }

  /** Can every receiver of this message read the packed form? A single old peer sends us back to JSON. */
  private wireReady(to?: string): boolean {
    if (to) return this.wirePeers.has(to);
    if (!this.peers.length) return false;
    for (const p of this.peers) if (!this.wirePeers.has(p)) return false;
    return true;
  }

  /** Tell the room which wire form this build can read. Sent on joining and whenever a peer turns up. */
  private announceWire() {
    this.send({ t: 'cap', w: WIRE_VERSION });
  }

  private raw(frame: Record<string, unknown>) {
    if (!this.connected) return;
    this.ws!.send(JSON.stringify(frame));
  }

  /**
   * The socket went down without anybody asking it to. Keep going back to the relay with the same
   * key until it hands the seat over again, or until the window closes.
   *
   * Everything else about the session is deliberately left standing: the id, the slot map, the
   * running lockstep. A reconnect is supposed to be *the same peer* coming back, and the moment any
   * of that were rebuilt the seat map would move under a match that is still running elsewhere.
   */
  private beginReconnect() {
    if (this.reconnecting || this.closed) return;
    this.reconnecting = true;
    this.lostAt = performance.now();
    this.retryStep = 0;
    this.onLink?.('lost');
    this.scheduleRetry();
  }

  private scheduleRetry() {
    const wait = RECONNECT_BACKOFF[Math.min(this.retryStep, RECONNECT_BACKOFF.length - 1)]!;
    this.retryStep++;
    this.retryTimer = window.setTimeout(() => void this.tryReconnect(), wait);
  }

  private async tryReconnect() {
    if (this.closed || !this.reconnecting) return;
    if (this.lostForMs > RECONNECT_WINDOW_MS) return this.giveUp();
    try {
      await this.connect();
      // `join`, not `create`, even for the host: the relay recognises the key and hands the old
      // identity back either way, and a `create` on a room somebody else is now hosting would fail
      await this.join(this.lastRoom);
      this.reconnecting = false;
      this.lostAt = 0;
      this.retryStep = 0;
      this.onLink?.('back');
    } catch {
      try {
        this.ws?.close();
      } catch {
        /* the socket may never have opened */
      }
      this.ws = null;
      if (this.lostForMs > RECONNECT_WINDOW_MS) return this.giveUp();
      this.scheduleRetry();
    }
  }

  private giveUp() {
    this.reconnecting = false;
    this.lostAt = 0;
    window.clearTimeout(this.retryTimer);
    if (this.closed) return;
    this.closed = true;
    this.onLink?.('gone');
    this.onClose?.('closed');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.reconnecting = false;
    window.clearTimeout(this.retryTimer);
    // say it out loud, so the relay frees the seat instead of holding it for a comeback
    this.raw({ t: 'leave' });
    window.clearInterval(this.pingTimer);
    this.endMatch();
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.onClose?.('local');
  }

  private onFrame(data: unknown) {
    if (typeof data !== 'string') return;
    let f: RelayFrame;
    try {
      f = JSON.parse(data) as RelayFrame;
    } catch {
      return;
    }
    if (!f || typeof f !== 'object' || typeof f.t !== 'string') return;
    switch (f.t) {
      case 'joined':
        this.id = f.id;
        this.room = f.room;
        this.lastRoom = f.room;
        this.isHost = !!f.host;
        this.peers = Array.isArray(f.peers) ? f.peers.filter((p) => p !== f.id) : [];
        // the relay names the host outright; guessing `peers[0]` was wrong the moment a room could
        // outlive a dropped connection, because the first id in the list may be the one that is away
        this.hostId = f.hostId ?? (this.isHost ? f.id : (this.peers[0] ?? ''));
        this.joinWait?.resolve(f.room);
        this.joinWait = null;
        this.announceWire();
        break;
      case 'error': {
        const err = new Error(String(f.code));
        if (this.joinWait) this.joinWait.reject(err);
        else console.warn('[net] relay error', f.code);
        this.joinWait = null;
        break;
      }
      case 'peer':
        if (f.joined) {
          if (!this.peers.includes(f.id)) this.peers.push(f.id);
          this.awayPeers.delete(f.id);
          // the newcomer has no idea what this build speaks, and we have none about it: say it again
          this.announceWire();
        } else {
          this.peers = this.peers.filter((p) => p !== f.id);
          this.wirePeers.delete(f.id);
          this.timesync.forget(f.id);
          if (f.away) this.awayPeers.set(f.id, performance.now());
          else this.awayPeers.delete(f.id);
          // The match must not stall on somebody who is not there. Which input the seat gets from
          // here on, and when a bot takes it over, is decided in `seatMode` – this only makes sure
          // nobody is left waiting for a packet that is not coming.
          if (this.lockstep) for (const [slot, owner] of this.slotOwner) if (owner === f.id) this.dropSlot(slot);
        }
        this.onPeer?.(f.id, !!f.joined, f.joined ? (f.back ? 'back' : 'joined') : f.away ? 'away' : 'gone');
        break;
      case 'host':
        this.hostId = f.id;
        this.isHost = f.id === this.id;
        this.onHost?.(f.id);
        break;
      case 'pong': {
        const r = Math.max(0, performance.now() - Number(f.ts));
        this.ping = Math.round(r);
        // A rolling window with median/p90 instead of an exponential average: the first pongs after
        // connecting are page-load noise, and an average seeded with a 300 ms outlier stays wrong
        // for a minute. A median throws that sample away immediately.
        this.rttWindow.push(r);
        if (this.rttWindow.length > RTT_WINDOW) this.rttWindow.shift();
        const sorted = [...this.rttWindow].sort((a, b) => a - b);
        const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
        this.srtt = at(0.5);
        // Jitter from the p90 – but samples far above the median are page-load / GC hitches, not
        // link quality (the main thread simply answered the pong late). They are left out here;
        // a link that really spikes like that produces stalls, and the pressure rule covers those.
        const cut = Math.max(this.srtt * 3, this.srtt + 30);
        const trimmed = sorted.filter((v) => v <= cut);
        const p90 = trimmed[Math.min(trimmed.length - 1, Math.floor(0.9 * trimmed.length))] ?? this.srtt;
        this.rttvar = Math.max(0, p90 - this.srtt);
        this.tuneDelay();
        break;
      }
      case 'msg': {
        const d = f.d;
        // A passive client (a phone, see `passive`) can tell the room's lockstep traffic apart from
        // everything else without unpacking it: only 'in' and 'hash' ride the bit-packed form, and
        // that one is a string that never starts with '{'. Sixty of those a second per peer is a
        // measurable amount of parsing to do on a phone for messages it is going to throw away.
        if (this.passive && typeof d === 'string' && d.charCodeAt(0) !== 0x7b) return;
        const m = d && typeof d === 'object' && typeof (d as { t?: unknown }).t === 'string' ? (d as PeerMessage) : decodeMessage(d);
        if (!m) return;
        this.onPeerMessage(String(f.from), m);
        break;
      }
    }
  }

  private onPeerMessage(from: string, m: PeerMessage) {
    if (m.t === 'cap') {
      // `w` is the newest wire form that peer can read; older builds send none and stay on JSON
      const w = Number((m as { w?: unknown }).w);
      if (Number.isFinite(w) && w >= WIRE_VERSION) this.wirePeers.add(from);
      else this.wirePeers.delete(from);
      return;
    }
    if (this.passive) {
      // see `passive`: lockstep traffic is not addressed to this client, everything else is
      if (m.t === 'in' || m.t === 'hash' || m.t === 'ready' || m.t === 'live' || (m.t.length === 4 && m.t.startsWith('rsy')) || m.t === 'rsy') return;
      this.onMessage?.(from, m);
      return;
    }
    if (m.t === 'ready' && typeof m.m === 'number') {
      // keyed by match so a signal that arrives before our own beginMatch() is not lost
      this.peerReady.add(`${from}:${m.m}`);
      return;
    }
    // rebuilding a running match: request, header, log chunks, end, and the seat being booked back
    if (m.t === 'rsy' && m.m === this.matchId) {
      this.serveResync(from, m.m as number, Math.max(0, Number(m.from) || 0));
      return;
    }
    if (m.t === 'rsyh' && from === this.resyncFrom && Array.isArray(m.slots)) {
      this.replay = {
        log: new InputLog(m.slots as number[], Math.max(1, Number(m.head) || 1)),
        head: 0,
        away: ((m.away as [number, number][]) ?? []).map(([slot, at]) => [Number(slot), Number(at)]),
      };
      return;
    }
    if (m.t === 'rsyl' && from === this.resyncFrom && this.replay) {
      this.replay.log.decode(Number(m.slot), Number(m.from), String(m.d));
      return;
    }
    if (m.t === 'rsyc' && from === this.resyncFrom && this.replay && Array.isArray(m.c)) {
      const ok = (e: unknown): e is [number, number, unknown[]] => Array.isArray(e) && Number.isInteger(e[0]) && Number.isInteger(e[1]) && Array.isArray(e[2]);
      this.replay.log.decodeCommands((m.c as unknown[]).filter(ok));
      return;
    }
    if (m.t === 'rsye' && from === this.resyncFrom && this.replay) {
      this.replay.head = Number(m.head) || this.replay.log.length;
      if (this.topUpWait) this.topUpWait();
      else this.onResync?.(); // the first one: the hub remounts the game and starts the rebuild
      return;
    }
    if (m.t === 'live' && m.m === this.matchId && this.lockstep) {
      // somebody caught up and is taking their seat back – the tick they named is the one every
      // peer starts requiring their input again, so it is applied here exactly as it was sent
      this.lockstep.setLive(Number(m.slot), Number(m.from));
      return;
    }
    if (isInputMessage(m) || isHashMessage(m)) {
      if (this.lockstep && m.m !== this.matchId) return;
      if (!this.lockstep) {
        // match not started on this side yet (still loading) – keep frames for beginMatch
        if (this.pendingFrames.length < 2000) this.pendingFrames.push({ from, m });
        return;
      }
      if (isInputMessage(m)) {
        const apply = (tick: number, list: [number, PackedInput][]) => {
          for (const [slot, packed] of list) {
            if (this.slotOwner.get(slot) !== from) continue;
            // counted from the message, not from what the lockstep chose to keep: a redundant frame
            // for a tick already simulated is dropped there, but it still says how far this peer got
            if (tick > (this.maxSeen.get(slot) ?? -1)) this.maxSeen.set(slot, tick);
            this.lockstep!.remoteInput(tick, slot, unpackInput(packed));
          }
        };
        // the repeated frames first, so the newest one wins if both are present
        for (const [tick, list] of m.r ?? []) apply(tick, list);
        apply(m.tick, m.in);
        // A seat's orders for a tick travel in the same message as its input for that tick, so
        // once the input is here the orders are too; a tick missing from `c` simply had none.
        if (Array.isArray(m.c)) {
          for (const e of m.c) {
            if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Array.isArray(e[1])) continue;
            const bySlot = new Map<number, unknown[]>();
            for (const c of e[1]) {
              if (!Array.isArray(c) || this.slotOwner.get(c[0]) !== from) continue;
              let l = bySlot.get(c[0]);
              if (!l) bySlot.set(c[0], (l = []));
              l.push(c[1]);
            }
            for (const [slot, list] of bySlot) this.lockstep!.putCommands(e[0], slot, list);
          }
        }
        // a peer that sends input is by definition running the match
        this.peerReady.add(`${from}:${m.m}`);
        const now = performance.now();
        // this peer is waiting on us: capture further ahead so its buffer fills again
        // (gap-fill frames carry no counter – they must not reset what we have seen, or the next
        // regular message looks like a fresh stall and the delay climbs forever)
        if (typeof m.s === 'number') {
          const seen = this.peerStalls.get(from) ?? m.s;
          if (m.s > seen) this.tuner.peerStalled(now);
          this.peerStalls.set(from, m.s);
        }
        if (typeof m.b === 'number') {
          this.tuner.peerBuffer(now, m.b);
          this.peerBuffers.set(from, m.b);
        }
        if (typeof m.k === 'number') {
          this.timesync.observe(from, m.k, typeof m.a === 'number' ? m.a : 0, now);
          if (m.k > this.peerTick) this.peerTick = m.k;
        }
      } else {
        let map = this.remoteHashes.get(from);
        if (!map) this.remoteHashes.set(from, (map = new Map()));
        map.set(m.tick, m.h);
        if (map.size > 40) map.delete(map.keys().next().value!);
        this.compareHash(m.tick, from);
      }
      return;
    }
    this.onMessage?.(from, m);
  }

  private compareHash(tick: number, peer: string) {
    const mine = this.hashes.find(([t]) => t === tick);
    const theirs = this.remoteHashes.get(peer)?.get(tick);
    if (mine === undefined || theirs === undefined) return;
    if (mine[1] !== theirs) {
      this.desyncs++;
      console.warn(`[net] DESYNC at tick ${tick}: local ${mine[1]} vs ${peer} ${theirs}`);
      this.onDesync?.(tick, peer);
    }
  }

  // ---- match / lockstep ----

  /** Start delay this peer would pick from its own link measurement (host puts it in the start message). */
  suggestedDelay(): number {
    return DelayTuner.startDelay(this.rttWindow.length, this.srtt, this.rttvar, DEFAULT_DELAY);
  }

  beginMatch(opts: NetMatchOptions) {
    this.endMatch();
    // the RTT window deliberately survives from the lobby: it has been pinging for a while, so the
    // delay is right at tick 0 instead of after a warm-up
    this.input = opts.input;
    const startDelay = Math.max(0, Math.floor(opts.delay ?? this.suggestedDelay()));
    this.lockstep = new Lockstep({ local: opts.local, remote: opts.remote.map((r) => r.slot), delay: startDelay });
    this.slotOwner.clear();
    this.matchId = opts.matchId;
    for (const r of opts.remote) this.slotOwner.set(r.slot, r.peer);
    this.tuner.reset();
    this.timesync.reset();
    this.peerBuffers.clear();
    this.started = false;
    this.ready = false;
    this.matchBeganAt = performance.now();
    for (const k of this.peerReady) if (!k.endsWith(`:${opts.matchId}`)) this.peerReady.delete(k);
    this.hashes = [];
    this.remoteHashes.clear();
    this.desyncs = 0;
    this.stalls = 0;
    this.stalling = false;
    this.maxSeen.clear();
    this.handedOver.clear();
    this.peerTick = 0;
    this.log = new InputLog([...opts.local, ...opts.remote.map((r) => r.slot)]);
    this.grace = Math.max(0, Math.floor(opts.graceTicks ?? SEAT_GRACE_TICKS));
    // peers that already left before the match started never send input
    for (const r of opts.remote) if (!this.peers.includes(r.peer)) this.lockstep.setAway(r.slot, 0);
    // rebuilding: the seats that were unattended, and from which tick – our own among them
    for (const [slot, at] of this.replay?.away ?? []) this.lockstep.setAway(slot, at);
    opts.input.lockstep = this;
    const queued = this.pendingFrames;
    this.pendingFrames = [];
    for (const q of queued) this.onPeerMessage(q.from, q.m);
    // a peer on a worse link than the host's estimate raises right away (fills travel with it)
    const want = this.suggestedDelay();
    if (want > startDelay) this.applyDelay(want);
  }

  /** The game is mounted and ready to simulate: tell the peers (start barrier). */
  markReady() {
    if (!this.lockstep || this.ready) return;
    this.ready = true;
    this.send({ t: 'ready', m: this.matchId });
  }

  private allPeersReady(): boolean {
    const owners = new Set(this.slotOwner.values());
    for (const peer of owners) {
      if (!this.peers.includes(peer)) continue; // gone → its slots are frozen
      if (!this.peerReady.has(`${peer}:${this.matchId}`)) return false;
    }
    return true;
  }

  private applyDelay(next: number) {
    const ls = this.lockstep;
    if (!ls || next === ls.delay) return;
    const fills = ls.raiseDelay(next);
    for (const f of fills) {
      this.send({ t: 'in', m: this.matchId, tick: f.tick, in: [[f.slot, packInput(f.state)]] });
      this.lastFrameTick = Math.max(this.lastFrameTick, f.tick);
    }
    this.onDelayChange?.(next);
  }

  endMatch() {
    if (this.input) {
      this.input.lockstep = null;
      for (const slot of this.slotOwner.keys()) this.input.setRemoteState(slot, emptyState());
    }
    this.lockstep = null;
    this.input = null;
    this.onSeatBot = null;
    this.pendingSend = [];
    this.pendingFrames = [];
    this.sentFrames = [];
    this.cmdQueue.clear();
    this.ownCmds.clear();
    this.lastFrameTick = -1;
    this.stallMs = 0;
    this.peerStalls.clear();
    this.peerBuffers.clear();
    this.started = false;
    this.ready = false;
  }

  get inMatch() {
    return !!this.lockstep;
  }

  /**
   * Match the input delay to the measured link (see DelayTuner). Called on every pong; the tuner
   * owns the rules, this only applies the result. Raising fills the tick gap (see Lockstep.raiseDelay).
   */
  private tuneDelay() {
    const ls = this.lockstep;
    if (!ls || !this.started || this.rttWindow.length < MIN_RTT_SAMPLES) return;
    this.applyDelay(this.tuner.next(performance.now(), ls.delay, this.srtt, this.rttvar));
  }

  private readonly tuner = new DelayTuner();
  private readonly timesync = new TimeSync();
  /** Recent round-trip samples; median and p90 come from here. */
  private rttWindow: number[] = [];
  /**
   * Highest tick each remote slot has ever sent input for.
   *
   * The quiet cornerstone of the whole away handling. Packets are lost on the way *to* the relay,
   * never on the way from it: the relay reads a peer's message whole and fans it out over ordered
   * connections, and it only reports that peer as away once its socket is closed - which is after
   * everything it did send has already gone out. So every surviving peer has seen exactly the same
   * last tick from the one that dropped, and can work out the changeover tick for itself. No
   * announcement, no authority, no waiting for the host to say so - and no desync from two peers
   * noticing at two different moments, which is what the old `freeze` did.
   */
  private maxSeen = new Map<number, number>();
  /** Slots already handed to a bot, so it is handed over once and not on every tick. */
  private handedOver = new Set<number>();
  /**
   * Everything the simulation has run, so a peer that comes back can rebuild the match from it.
   * Kept by every peer, because a deterministic simulation makes them all identical – whoever is
   * connected can serve it.
   */
  private log: InputLog | null = null;
  /** Highest tick any peer has reported running (their `k`), for judging how far behind we are. */
  private peerTick = 0;
  /**
   * While rebuilding a match that is already running: the log to replay, how far it goes, and which
   * seats were unattended from which tick.
   *
   * The cuts have to travel with it and be applied to the **new** lockstep. They were the first
   * thing this got wrong: they were applied on arrival, to the lockstep of the diverged match, and
   * `beginMatch` then built a fresh one for the rebuild and threw them away. The returning peer's
   * own seat was the one that mattered – without its cut it never noticed it had a seat to take
   * back, so it silently rebuilt the match and then sat out the rest of the race.
   */
  private replay: { log: InputLog; head: number; away: [number, number][] } | null = null;
  /** The rebuild is ready to run – the hub remounts the game and fast-forwards it. */
  onResync: (() => void) | null = null;
  /** Peer we asked for the log, and what has arrived so far. */
  private resyncFrom = '';
  /** Resolves the promise of a follow-up request for the stretch the first transfer did not cover. */
  private topUpWait: (() => void) | null = null;
  /** A seat has been unattended for the whole grace period: the game should put a bot in it. */
  onSeatBot: ((slot: number) => void) | null = null;
  /** Stall counters last reported by each peer. */
  private peerStalls = new Map<string, number>();
  /** Buffer depth last reported by each peer (ticks of our input it holds). */
  private peerBuffers = new Map<string, number>();
  /** Peers that signalled they are running the match, keyed `peer:matchId`. */
  private peerReady = new Set<string>();
  private ready = false;
  private matchBeganAt = 0;

  /** Called when the input delay was raised (for the HUD). */
  onDelayChange: ((ticks: number) => void) | null = null;

  /** Engine hook: may the next fixed step run? */
  canStep(): boolean {
    if (!this.lockstep) return true;
    const now = performance.now();
    if (!this.started) {
      // start barrier: nobody simulates tick 0 while another peer is still loading – those waits
      // are not stalls and must not push the delay up
      const go = (this.ready && this.allPeersReady()) || now - this.matchBeganAt > START_TIMEOUT_MS;
      if (!go) return false;
      this.started = true;
      this.tuner.matchStarted(now);
    }
    const ok = this.lockstep.canStep();
    if (!ok) {
      if (!this.stalling) {
        this.stalls++;
        this.stallSince = now;
      }
    } else if (this.stalling) {
      this.stallMs += now - this.stallSince;
    }
    this.stalling = !ok;
    this.bufferDepth = this.lockstep.bufferDepth();
    return ok;
  }

  private stallSince = 0;

  /** Before InputManager.poll(): feed remote slots with their input for the tick about to run. */
  beforePoll() {
    const ls = this.lockstep;
    if (!ls || !this.input) return;
    // A tick being rebuilt takes its input from the log, for every seat including our own: what is
    // being replayed is what the *others* simulated, not what this machine's devices are doing now.
    if (this.replay && this.replay.log.has(ls.tick)) {
      for (const slot of ls.required) ls.replayInput(ls.tick, slot, this.replay.log.state(ls.tick, slot));
      ls.replayCommands(ls.tick, this.replay.log.commands(ls.tick));
    }
    for (const slot of ls.remote) this.input.setRemoteState(slot, ls.inputFor(ls.tick, slot));
    // Driven from the tick about to run, never from a timer: this is a change to the simulation, so
    // it has to happen at the same tick on every peer. `awayFrom` is identical everywhere, so
    // `awayFrom + grace` is too.
    //
    // Every seat, **including our own**. It read `ls.remote` at first, which looks right and is not:
    // a peer rebuilding the match after its own connection died has its own seat in `local`, so it
    // was the only one in the room that did not put a bot in it – and from that tick on it simulated
    // a neutral driver where everybody else simulated a CPU one. The state hashes caught it.
    for (const slot of ls.required) {
      const from = ls.awayFrom(slot);
      if (from === undefined || this.handedOver.has(slot) || ls.tick < from + this.grace) continue;
      this.handedOver.add(slot);
      this.onSeatBot?.(slot);
    }
  }

  /**
   * Queue a game order of one of our seats (default: the first). It goes out with the next input
   * frame for a tick nobody has input for yet and is applied by every peer at that tick – see
   * `commands`. False if it cannot be sent: no match, a rebuild running, not our seat, a seat
   * nobody is driving right now, or an order that is not JSON or larger than MAX_TICK_COMMAND_BYTES.
   */
  sendCommand(cmd: unknown, slot?: number): boolean {
    const ls = this.lockstep;
    if (!ls || this.replaying) return false;
    const s = slot ?? ls.local[0];
    if (s === undefined || !ls.local.includes(s) || ls.isAway(s)) return false;
    return this.cmdQueue.push(s, cmd);
  }

  /** The game orders to apply at the tick about to run, identical on every peer. After beforePoll(). */
  commands(): { tick: number; cmds: SlotCommand[] } {
    const ls = this.lockstep;
    return ls ? { tick: ls.tick, cmds: ls.commandsFor(ls.tick) } : { tick: 0, cmds: [] };
  }

  /** LockstepHook: called by InputManager.poll() for every local device slot. */
  local(slot: number, fresh: InputState): InputState {
    if (!this.lockstep || !this.lockstep.local.includes(slot)) return fresh;
    const { send, now } = this.lockstep.localInput(slot, fresh);
    this.pendingSend.push([slot, packInput(send)]);
    return now;
  }

  /** After the game simulated the tick: ship this tick's captured input, exchange hashes, advance. */
  afterTick(game?: Hashable | null) {
    const ls = this.lockstep;
    if (!ls) return;
    // local slots without a device this tick still need a frame, otherwise everybody waits forever
    for (const slot of ls.local) if (!this.pendingSend.some(([s]) => s === slot)) this.pendingSend.push([slot, packInput(ls.localInput(slot, emptyState()).send)]);
    // Everything that was actually simulated, tick by tick – the record a returning peer rebuilds
    // the match from. Written from `inputFor`, not from what arrived, so an unattended seat is
    // logged with the neutral input every peer really ran.
    for (const slot of ls.required) this.log?.putState(ls.tick, slot, ls.inputFor(ls.tick, slot));
    this.log?.putCommands(ls.tick, ls.commandsFor(ls.tick));
    if (this.replaying) {
      // rebuilding the past: nothing of this is news to anybody, and the hashes are compared
      // against what the peers already sent rather than announced again
      this.pendingSend = [];
      if (ls.tick % HASH_EVERY === 0 && game?.stateHash) {
        this.hashes.push([ls.tick, game.stateHash()]);
        if (this.hashes.length > 40) this.hashes.shift();
        for (const peer of this.remoteHashes.keys()) this.compareHash(ls.tick, peer);
      }
      ls.advance();
      return;
    }
    const frame: [number, [number, PackedInput][]] = [ls.tick + ls.delay, this.pendingSend];
    if (frame[0] > this.lastFrameTick) {
      // queued orders go to this frame's tick, as many as its budget takes – the rest wait, in order
      const list = this.cmdQueue.length ? this.cmdQueue.take() : [];
      if (list.length) {
        this.ownCmds.set(frame[0], list);
        for (const slot of ls.local) ls.putCommands(frame[0], slot, list.filter(([s]) => s === slot).map(([, c]) => c));
      }
      this.lastFrameTick = frame[0];
    }
    this.sentFrames.push(frame);
    if (this.sentFrames.length > INPUT_REDUNDANCY) this.sentFrames.shift();
    // every message repeats the last few frames: a dropped packet then costs nothing, because the
    // next one already carries what was missing (no retransmit round trip, no stall)
    const msg: InputMessage = {
      t: 'in', m: this.matchId, tick: frame[0], in: frame[1], r: this.sentFrames.slice(0, -1),
      s: this.stalls, k: ls.tick, a: this.timesync.localLead(ls.tick), b: this.bufferDepth,
    };
    // …and the orders of each of those ticks with them, or a lost packet could lose an order
    if (this.ownCmds.size) {
      const ticks = new Set(this.sentFrames.map(([t]) => t));
      for (const t of this.ownCmds.keys()) if (!ticks.has(t)) this.ownCmds.delete(t);
      const c = [...this.ownCmds].sort((x, y) => x[0] - y[0]);
      if (c.length) msg.c = c;
    }
    this.send(msg);
    this.pendingSend = [];
    if (ls.tick % HASH_EVERY === 0 && game?.stateHash) {
      const h = game.stateHash();
      this.hashes.push([ls.tick, h]);
      if (this.hashes.length > 40) this.hashes.shift();
      this.send({ t: 'hash', m: this.matchId, tick: ls.tick, h });
      for (const peer of this.remoteHashes.keys()) this.compareHash(ls.tick, peer);
    }
    ls.advance();
  }

  /** Input delay currently in use, in ticks. */
  get delayTicks() {
    return this.lockstep?.delay ?? 0;
  }

  /** Engine hook: ticks to give back this frame because we run ahead of a peer (TimeSync). */
  timeSkipTicks(): number {
    if (!this.lockstep || !this.started) return 0;
    return this.timesync.ticksToDrop(this.lockstep.tick, performance.now());
  }

  /** Estimated ticks we run ahead of the slowest peer (negative = behind). */
  get lead(): number {
    return this.lockstep ? this.timesync.skew(this.lockstep.tick) : 0;
  }

  /** Smallest buffer of our input any peer reported (ticks); -1 without reports. */
  get peerBuffer(): number {
    let min = Infinity;
    for (const b of this.peerBuffers.values()) min = Math.min(min, b);
    return Number.isFinite(min) ? min : -1;
  }

  /** LockstepHook: local inputs already captured for the ticks after the current one. */
  pendingLocal(slot: number): InputState[] {
    return this.lockstep?.pendingLocal(slot) ?? [];
  }

  /** Current simulation tick of the match (next to run). */
  get tick() {
    return this.lockstep?.tick ?? 0;
  }
}

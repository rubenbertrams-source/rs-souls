/** Invite-code alphabet without look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/** 5-character room code, e.g. "K7PQ2". `random` defaults to Math.random (this is not simulation code). */
export function generateRoomCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.max(0, Math.floor(random() * CODE_ALPHABET.length)))];
  return out;
}

/** Upper-case and strip spaces/dashes (what people type after hearing a code on the phone). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const c of code) if (!CODE_ALPHABET.includes(c)) return false;
  return true;
}

/**
 * This tab's own key, stable across a reconnect. The relay maps it back to the peer id, so a client
 * that drops and comes back is the same player and finds its seat still there.
 *
 * `sessionStorage`, not `localStorage`: it has to survive a reload of this tab, and it must NOT be
 * shared with a second tab – two tabs are two players, and one key would make them fight over one
 * seat. If storage is unavailable (private mode, embedded views) a per-page key still works for
 * everything except a full page reload.
 */
export function clientKey(store?: Storage): string {
  const gen = () => {
    const b = new Uint8Array(16);
    (globalThis.crypto ?? { getRandomValues: (a: Uint8Array) => a.forEach((_, i) => (a[i] = (Math.random() * 256) | 0)) }).getRandomValues(b);
    return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  try {
    const s = store ?? sessionStorage;
    const had = s.getItem('pv.clientKey');
    if (had && /^[A-Za-z0-9_-]{8,64}$/.test(had)) return had;
    const made = gen();
    s.setItem('pv.clientKey', made);
    return made;
  } catch {
    return gen();
  }
}

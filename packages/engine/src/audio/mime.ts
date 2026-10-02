/**
 * Pick a container the browser can actually record into.
 *
 * `MediaRecorder.isTypeSupported` cannot be trusted on its own, in both directions: Safari answered
 * false for `audio/mp4;codecs=mp4a.40.2` while plain `audio/mp4` worked, and a true answer has
 * historically not guaranteed that `start()` succeeds. So this is a preference list, and the caller
 * must still wrap the constructor *and* `start()` in try/catch and read `recorder.mimeType` back for
 * what was really used.
 *
 * Order: Opus first because it is by far the smallest, and every relay frame it saves matters – the
 * frame budget is 16 KiB including the JSON wrapper and base64 inflation. `audio/mp4` is the fall
 * back for iOS below 18.4, which could not record WebM at all. (Decoding is the other way round and
 * not a problem: Safari has decoded WebM/Opus since ~17.4.)
 */
export function pickRecorderMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* keep looking – a throwing check is just another no */
    }
  }
  return '';
}

/**
 * Constraints for a take.
 *
 * All three processing steps off, deliberately. Jackbox shipped this exact idea in *Hear Say* and
 * reported that off-the-shelf denoising "could cut out player audio or make silly mouth effects
 * unintelligible" – a deliberate raspberry is, acoustically, noise. Automatic gain would flatten
 * the dynamic range of a shouted impression on top of that.
 *
 * Chrome ignores two of these; read `track.getSettings()` back if you need to know what you got.
 */
export const TAKE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

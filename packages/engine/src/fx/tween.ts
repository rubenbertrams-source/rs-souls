import { clamp01, easeOutCubic } from '../math/easing';

export type Ease = (t: number) => number;

interface Tween {
  t: number;
  dur: number;
  ease: Ease;
  update: (v: number) => void;
  done?: () => void;
}

/** Minimal tween runner; call `update(dt)` each frame. */
export class Tweens {
  private list: Tween[] = [];
  add(dur: number, update: (v: number) => void, opts: { ease?: Ease; done?: () => void } = {}) {
    const tw: Tween = { t: 0, dur, ease: opts.ease ?? easeOutCubic, update, done: opts.done };
    this.list.push(tw);
    update(0);
    return tw;
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i]!;
      tw.t += dt;
      const v = tw.ease(clamp01(tw.t / tw.dur));
      tw.update(v);
      if (tw.t >= tw.dur) {
        this.list.splice(i, 1);
        tw.done?.();
      }
    }
  }
  clear() {
    this.list.length = 0;
  }
}

/** Screen shake state: call add(strength) then read offset each frame. */
export class Shake {
  private amp = 0;
  private time = 0;
  enabled = true;
  x = 0;
  y = 0;
  add(strength: number) {
    this.amp = Math.max(this.amp, strength);
  }
  update(dt: number) {
    this.time += dt;
    this.amp = Math.max(0, this.amp - dt * 2.5);
    const a = this.enabled ? this.amp : 0;
    this.x = Math.sin(this.time * 61) * a * 0.15;
    this.y = Math.cos(this.time * 47) * a * 0.12;
  }
}

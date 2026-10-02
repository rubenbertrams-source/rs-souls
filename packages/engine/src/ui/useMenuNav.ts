import { useEffect, useState } from 'preact/hooks';
import type { InputManager } from '../input/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { Ticker } from './ticker';

export interface MenuNavDeps {
  input: InputManager;
  audio: AudioManager;
  ticker: Ticker;
}

export interface MenuNavOptions {
  /** How many focusable entries there are. */
  count: number;
  deps: MenuNavDeps;
  /**
   * Which direction moves the cursor; the other axis goes to `onAdjust`. Use 'both' for a list that
   * reflows – the title screen is a row on a desktop and a column on a phone, and either stick
   * direction should walk it.
   */
  axis?: 'x' | 'y' | 'both';
  onSelect(index: number): void;
  onBack?: () => void;
  /** Left/right on a vertical menu (or up/down on a horizontal one): -1 or +1. */
  onAdjust?: (index: number, dir: -1 | 1) => void;
  /** Entries that cannot be focused (separators, greyed-out rows). */
  disabled?: (index: number) => boolean;
  initial?: number;
}

/**
 * Keyboard/gamepad cursor for a menu. Reads the merged UI input once per simulation tick (the
 * ticker, not DOM events), plays the menu sounds, and handles Escape/Backspace as "back".
 *
 * Extracted from `Menu` so a screen with its own layout – the game selection is a row of tiles,
 * not a list – gets the same feel without copying the loop. The cursor is mirrored in a closure
 * because the ticker callback is registered once, not per render.
 */
export function useMenuNav(opts: MenuNavOptions): [number, (i: number) => void] {
  const { count, deps, axis = 'y', onSelect, onBack, onAdjust, disabled, initial = 0 } = opts;
  const [idx, setIdx] = useState(initial);

  useEffect(() => {
    let cur = Math.min(idx, Math.max(0, count - 1));
    const move = (d: number) => {
      if (!count) return;
      for (let k = 0; k < count; k++) {
        cur = (cur + d + count) % count;
        if (!disabled?.(cur)) break;
      }
      setIdx(cur);
      deps.audio.sfx('uiMove');
    };
    const back = axis === 'x' ? ['left'] : axis === 'y' ? ['up'] : ['up', 'left'];
    const fwd = axis === 'x' ? ['right'] : axis === 'y' ? ['down'] : ['down', 'right'];
    return deps.ticker.on(() => {
      const ui = deps.input.ui;
      const nav = deps.input.uiNav;
      if (nav && back.includes(nav)) move(-1);
      else if (nav && fwd.includes(nav)) move(1);
      else if (nav === 'left' || nav === 'right') {
        if (onAdjust) {
          onAdjust(cur, nav === 'left' ? -1 : 1);
          deps.audio.sfx('uiMove');
        }
      } else if (nav === 'up' || nav === 'down') {
        if (onAdjust) {
          onAdjust(cur, nav === 'up' ? -1 : 1);
          deps.audio.sfx('uiMove');
        }
      }
      if (ui.pressed.a || ui.pressed.start) {
        if (!disabled?.(cur)) {
          deps.audio.sfx('uiSelect');
          onSelect(cur);
        }
      }
      if (ui.pressed.b && onBack) {
        deps.audio.sfx('uiBack');
        onBack();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, axis, onSelect, onBack, onAdjust]);

  // keyboard users expect Escape; the gamepad path is the B button above
  useEffect(() => {
    if (!onBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'Backspace') return;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      e.preventDefault();
      deps.audio.sfx('uiBack');
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBack]);

  return [idx, setIdx];
}

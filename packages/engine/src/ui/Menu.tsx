import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useMenuNav } from './useMenuNav';
import type { InputManager } from '../input/InputManager';
import type { AudioManager } from '../audio/AudioManager';
import type { Ticker } from './ticker';

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect?: () => void;
  /** For left/right adjustable items (e.g. settings). */
  onLeft?: () => void;
  onRight?: () => void;
  value?: string;
}

export interface MenuDeps {
  input: InputManager;
  audio: AudioManager;
  ticker: Ticker;
}

/**
 * Gamepad/keyboard-navigable vertical menu. Mouse works too.
 * A = select, B = back, left/right = adjust.
 */
export function Menu({ items, deps, onBack, title, children, initial = 0, className = '' }: {
  items: MenuItem[];
  deps: MenuDeps;
  onBack?: () => void;
  title?: string;
  children?: ComponentChildren;
  initial?: number;
  className?: string;
}) {
  // one shared cursor implementation for every menu in the game – see useMenuNav
  const [idx, setIdx] = useMenuNav({
    count: items.length,
    deps,
    axis: 'y',
    initial,
    disabled: (i) => !!items[i]?.disabled,
    onSelect: (i) => {
      const it = items[i];
      if (it?.onSelect) it.onSelect();
      else it?.onRight?.();
    },
    onBack,
    onAdjust: (i, d) => {
      const it = items[i];
      if (d < 0) it?.onLeft?.();
      else it?.onRight?.();
    },
  });

  // a long list (settings, sandbox rules) is taller than the screen; walking down it with a pad or
  // the keyboard has to bring the cursor along, otherwise the focus sits below the fold unseen
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    (list.current?.children[idx] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  return (
    <div class={`pv-menu ${className}`}>
      {title && <h2 class="pv-menu-title">{title}</h2>}
      {children}
      <ul ref={list}>
        {items.map((it, i) => (
          <li
            key={i}
            class={`pv-menu-item ${i === idx ? 'focus' : ''} ${it.disabled ? 'disabled' : ''}`}
            onMouseEnter={() => setIdx(i)}
            onPointerDown={() => setIdx(i)}
            onClick={() => {
              if (it.disabled) return;
              if (it.onSelect) {
                deps.audio.sfx('uiSelect');
                it.onSelect();
              } else it.onRight?.();
            }}
          >
            <span class="label">{it.label}</span>
            {it.value !== undefined && (
              <span class="value">
                {it.onLeft && (
                  <button class="arrow" aria-label="−" onClick={(e) => { e.stopPropagation(); it.onLeft?.(); }}><i class="chev l" /></button>
                )}
                <span>{it.value}</span>
                {it.onRight && (
                  <button class="arrow" aria-label="+" onClick={(e) => { e.stopPropagation(); it.onRight?.(); }}><i class="chev r" /></button>
                )}
              </span>
            )}
            {it.hint && i === idx && <span class="hint">{it.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

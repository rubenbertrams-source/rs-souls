import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Path aliases for vite + vitest (kept in sync with tsconfig "paths"). */
export const alias = [
  { find: /^@pv\/engine$/, replacement: r('./packages/engine/src/index.ts') },
  { find: /^@pv\/engine\/(.*)$/, replacement: r('./packages/engine/src/') + '$1' },
  { find: /^@pv\/game-api$/, replacement: r('./packages/game-api/src/index.ts') },
  { find: /^@pv\/rssouls$/, replacement: r('./games/rssouls/src/index.ts') },
];

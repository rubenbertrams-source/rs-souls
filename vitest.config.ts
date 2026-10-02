import { defineConfig } from 'vitest/config';
import { alias } from './alias.config';

export default defineConfig({
  resolve: { alias },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'games/**/*.test.ts'],
    environment: 'node',
    watch: false,
  },
});

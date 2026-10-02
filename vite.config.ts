import { defineConfig } from 'vite';
import { alias } from './alias.config';

export default defineConfig({
  resolve: { alias },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { target: 'es2022', sourcemap: 'hidden' },
  server: { port: 5173 },
});

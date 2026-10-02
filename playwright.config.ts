import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 5173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 200_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    viewport: { width: 1280, height: 720 },
    // software WebGL: runs on machines without a GPU (CI) as well
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

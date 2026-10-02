import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    pv: any;
  }
}

/**
 * RS Souls smoke test: the demo bot fights the Kollektor-Hof until three spinners are down, the host
 * shows the results. `kills=3` is a sandbox rule, passed through the query like every other.
 *
 *   PORT=5231 npx playwright test e2e/rssouls.spec.ts --workers=1
 */
test('rssouls: the demo hero clears three spinners and reaches the results screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

  await page.goto('/?autoplay=1&game=rssouls&mode=training&humans=0&cpus=1&seed=4&kills=3&enemyCount=2');
  await page.waitForFunction(() => window.pv && window.pv.route.value.name === 'play');
  await page.waitForFunction(() => !!window.pv.game.value?.sim, null, { timeout: 30_000 });

  const layout = await page.evaluate(() => window.pv.engine.viewports.map((v: any) => [v.x, v.y, v.w, v.h]));
  expect(layout).toEqual([[0, 0, 1, 1]]);
  expect(await page.evaluate(() => window.pv.audio.sfxNames().includes('rssParry'))).toBe(true);
  await expect(page.locator('.rss-hud')).toBeVisible();

  await expect.poll(() => page.evaluate(() => window.pv.game.value.sim.kills), { timeout: 90_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.pv.route.value.name), { timeout: 180_000 }).toBe('results');
  expect(errors).toEqual([]);
});

/**
 * Mouse controls: by default left click strikes and right click blocks (keyboard 1 with the mouse
 * on), and the settings screen takes a mouse button as a new binding.
 */
test('rssouls: left click strikes, right click blocks', async ({ page }) => {
  await page.goto('/?autoplay=1&game=rssouls&mode=training&humans=1&cpus=0&seed=4&enemyCount=1');
  await page.waitForFunction(() => !!window.pv?.game.value?.sim, null, { timeout: 30_000 });
  const state = () => page.evaluate(() => window.pv.game.value.sim.hero.state as string);
  await expect.poll(state).toBe('move');

  await page.mouse.move(640, 300);
  await page.mouse.down();
  await expect.poll(state, { timeout: 5_000 }).toMatch(/attack|charge/);
  await page.mouse.up();
  await expect.poll(state, { timeout: 5_000 }).toBe('move');

  await page.mouse.down({ button: 'right' });
  await expect.poll(state, { timeout: 5_000 }).toBe('block');
  await page.mouse.up({ button: 'right' });
  await expect.poll(state, { timeout: 5_000 }).toBe('move');
});

import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/read', '/systems', '/map/region', '/map/tracts', '/map/sources', '/open-items', '/references', '/glossary', '/concepts', '/concepts/three-maps', '/figures', '/figures/fig-served', '/figures/fig-systems-graph', '/methods', '/about', '/notes', '/search?q=988', '/no-such-page'];

for (const r of ROUTES) {
  test(`${r} renders its h1 and the draft banner`, async ({ page }) => {
    const res = await page.goto(r);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    const banner = page.getByTestId('draft-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Draft for review');
    await expect(banner).toContainText('independent of WellStone');
    await expect(banner.getByRole('link', { name: 'Open items' })).toHaveAttribute('href', /\/open-items$/);
    await expect(banner.getByRole('link', { name: 'How it was made' })).toHaveAttribute('href', /\/methods$/);
  });
}

test('there is no /changes route: it is the 404 page', async ({ page }) => {
  await page.goto('/changes');
  await expect(page.locator('h1').first()).toHaveText(/not found|no page/i);
  await expect(page.getByRole('link', { name: 'Changes' })).toHaveCount(0);
});

test('as_of appears on /, /read, /about, both maps and /systems', async ({ page }) => {
  for (const r of ['/', '/read', '/about', '/map/region', '/map/tracts', '/systems']) {
    await page.goto(r);
    await expect(page.getByText(/4 October 2026/).first()).toBeVisible();
  }
});

test('the venue is on / and /about; the front door has five cards and the statewide link', async ({ page }) => {
  for (const r of ['/', '/about']) {
    await page.goto(r);
    await expect(page.getByTestId('venue')).toContainText('not peer reviewed');
  }
  await page.goto('/');
  await expect(page.getByTestId('card-numbers')).toHaveCount(5);
  await expect(page.getByTestId('card-numbers').first()).toHaveText('1,497 claims · 978 verified against a quoted passage');
  await expect(page.getByTestId('card-numbers').nth(1)).toHaveText('129 open items · 46 that anyone with a browser can close');
  await expect(page.getByTestId('companion-link')).toHaveText(/The statewide report/);
});

test('the footer carries the draft line', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByTestId('footer-line')).toHaveText('Draft for review · Researched and written with Claude from public sources, October 2026 · awaiting review by Little Orange Fish · independent of WellStone and of every organization described.');
});

test('dark mode persists across a reload and the logo sits on a white panel', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const bg = await page.getByTestId('logo-panel').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');
});

for (const r of ['/read', '/map/tracts', '/systems', '/open-items']) {
  test(`${r} works at 375 px without horizontal page scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(r);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
}

test('at 375 px the tract map shows its table below the map', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/map/tracts');
  await expect(page.getByTestId('map-table')).toBeVisible();
  await expect(page.getByTestId('map-table-row')).toHaveCount(117);
});

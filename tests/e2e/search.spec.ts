import { expect, test } from '@playwright/test';

test('⌘K finds a county, a tract, a term and a block', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByTestId('palette-input');
  await expect(input).toBeFocused();
  for (const [q, label] of [['Cullman', 'Counties'], ['106.30', 'Census tracts'], ['Stepping Up', 'Glossary'], ['13,700', 'In the report']] as const) {
    await input.fill(q);
    await expect(page.getByTestId('search-modal').getByRole('heading', { name: label })).toBeVisible();
  }
  await input.fill('106.30');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/map\/tracts\?layer=pct_poverty&geo=01089010630/);
});

test('/search?q=988 shows grouped results', async ({ page }) => {
  await page.goto('/search?q=988');
  const res = page.getByTestId('search-results');
  await expect(res.getByRole('heading', { name: /In the report/ })).toBeVisible();
  expect(await res.getByRole('heading').count()).toBeGreaterThan(1);
  await expect(page.getByTestId('search-result').first().locator('mark').first()).toBeVisible();
});

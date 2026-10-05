import { expect, test } from '@playwright/test';

test('/map/region: 15 counties with the core outlined, layer switch, hover beside Alabama, table, overlay', async ({ page }) => {
  await page.goto('/map/region');
  await expect(page.getByTestId('map-area')).toHaveCount(15);
  await expect(page.getByTestId('core-outline')).toHaveCount(1);
  await expect(page.getByTestId('backdrop')).toHaveCount(1);
  const legend = page.getByTestId('map-legend');
  const before = await legend.textContent();
  await page.getByTestId('layer-select').selectOption('chr_suicide_rate');
  await expect(page).toHaveURL(/layer=chr_suicide_rate/);
  await expect(legend).not.toHaveText(before!);
  await page.locator('[data-testid="map-area"][data-fips="01089"]').hover();
  const tip = page.getByTestId('map-tooltip');
  await expect(tip).toContainText('Madison County');
  await expect(tip.getByTestId('tooltip-value')).toHaveText('15.3');
  await expect(tip.getByTestId('tooltip-alabama')).toHaveText('Alabama: 16.2');
  await expect(tip.getByTestId('tooltip-cite')).toBeVisible();
  // Lamar's suicide rate is not published: never 0
  await page.locator('[data-testid="map-area"][data-fips="01075"]').hover();
  await expect(page.getByTestId('tooltip-value')).toHaveText('not published or suppressed');
  await page.locator('[data-testid="map-area"][data-fips="01043"]').dispatchEvent('click');
  await expect(page).toHaveURL(/geo=01043/);
  const panel = page.getByTestId('area-panel');
  await expect(panel).toContainText('Cullman County');
  await expect(panel.getByTestId('county-overlays')).toContainText('WellStone');
  await expect(panel.getByTestId('county-overlays')).toContainText('since 2024-07');
  await page.getByTestId('map-table-button').click();
  await expect(page.getByTestId('map-table-row')).toHaveCount(15);
});

test('an overlay toggle draws center service-area outlines', async ({ page }) => {
  await page.goto('/map/region');
  await page.getByTestId('toggle-centers').check();
  await expect(page).toHaveURL(/overlay=centers/);
  await expect(page.getByTestId('overlay-outline')).toHaveCount(5);
  await page.getByTestId('toggle-catchment').check();
  await expect(page.getByTestId('overlay-catchment')).toHaveCount(1);
  await expect(page.getByTestId('catchment-note')).toContainText('Crisis Centers');
});

test('/map/tracts: 117 tracts; survey ± and between; modeled label; the suppressed cell; markers', async ({ page }) => {
  await page.goto('/map/tracts?layer=pct_poverty');
  await expect(page.getByTestId('map-area')).toHaveCount(117);
  await expect(page.getByTestId('standing-line')).toContainText('Do not rank neighbouring tracts on small differences.');
  await page.locator('[data-testid="map-area"][data-geoid="01043964100"]').hover();
  const tip = page.getByTestId('map-tooltip');
  await expect(tip.getByTestId('tooltip-value')).toHaveText('17.8% ± 6.5');
  await expect(tip.getByTestId('tooltip-between')).toContainText('between 11.3% and 24.3%');
  await expect(tip.getByTestId('tooltip-benchmarks')).toContainText('Alabama');
  // modeled
  await page.getByTestId('layer-select').selectOption('places_mhlth');
  await page.locator('[data-testid="map-area"][data-geoid="01089001200"]').hover();
  await expect(page.getByTestId('map-tooltip').getByTestId('tooltip-modeled')).toHaveText('modeled estimate');
  await expect(page.getByTestId('map-tooltip')).not.toContainText('±');
  // the suppressed cell
  await page.getByTestId('layer-select').selectOption('pct_rent_burden_35');
  await page.locator('[data-testid="map-area"][data-geoid="01089010630"]').hover();
  await expect(page.getByTestId('map-tooltip').getByTestId('tooltip-value')).toHaveText('not published or suppressed');
  await page.getByTestId('map-table-button').click();
  const row = page.locator('[data-testid="map-table-row"][data-geoid="01089010630"]');
  await expect(row).toContainText('not published or suppressed');
  await expect(row.locator('td').nth(2)).not.toHaveText('0');
  await expect(row.locator('td').nth(2)).not.toHaveText('0%');
});

test('the location overlay: a hollow approximate marker, three places at one point, two unplaced listed', async ({ page }) => {
  await page.goto('/map/tracts?layer=pct_poverty&overlay=locations');
  const approx = page.locator('[data-testid="location-marker"][data-approximate="true"]');
  expect(await approx.count()).toBeGreaterThan(0);
  const campus = page.locator('[data-testid="location-marker"][data-ids="wes wes_peds ws_hsv"]');
  await expect(campus).toHaveAttribute('data-approximate', 'true');
  await campus.hover();
  await expect(page.getByTestId('marker-tooltip')).toContainText('approximate position');
  await expect(page.getByTestId('marker-tooltip')).toContainText('3 places share this point');
  await expect(page.getByTestId('unplaced-item')).toHaveCount(2);
  await expect(page.getByTestId('location-sentences')).toContainText('They are not a directory of services');
  await campus.dispatchEvent('click');
  await expect(page.getByTestId('location-panel')).toContainText('4020 Memorial Parkway SW');
});

test('a tract panel: every tract layer with margins, the locations inside, a link to the county', async ({ page }) => {
  await page.goto('/map/tracts?layer=places_mhlth&geo=01089001200');
  const panel = page.getByTestId('area-panel');
  await expect(panel).toContainText('Census Tract 12');
  await expect(panel).toContainText('±');
  await expect(panel).toContainText('modeled estimate');
  await expect(panel.getByTestId('tract-locations')).toBeVisible();
  await expect(panel.getByRole('link', { name: /Madison County on the region map/ })).toHaveAttribute('href', /\/map\/region\?geo=01089/);
});

test('map state is URL-addressable and the CSV downloads with its margin column and source line', async ({ page }) => {
  await page.goto('/map/tracts?layer=pct_uninsured&geo=01089010630');
  await expect(page.getByTestId('area-panel')).toContainText('Census Tract 106.30');
  const dl = page.waitForEvent('download');
  await page.getByTestId('map-csv').click();
  const text = await (await dl).createReadStream().then((s) => new Promise<string>((res) => { let b = ''; s!.on('data', (c) => (b += c)); s!.on('end', () => res(b)); }));
  expect(text).toContain('pct_uninsured_moe');
  expect(text).toContain('source,');
});

test('keyboard: arrow keys move between counties and announce them', async ({ page }) => {
  await page.goto('/map/region?layer=pop_est');
  await page.getByTestId('map-svg').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('map-live')).toContainText('Madison County');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('area-panel')).toContainText('Madison County');
});

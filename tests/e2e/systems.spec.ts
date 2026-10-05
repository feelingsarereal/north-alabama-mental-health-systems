import { expect, test } from '@playwright/test';

test('/systems renders 13 nodes; Data\'s fan-out is a halo until Data is selected; then its eleven edges appear', async ({ page }) => {
  await page.goto('/systems');
  await expect(page.getByTestId('graph-node')).toHaveCount(13);
  await expect(page.getByTestId('fan-halo')).toHaveCount(1);
  await expect(page.getByTestId('graph-edge')).toHaveCount(14);
  await page.locator('[data-node="d6"]').click();
  await expect(page).toHaveURL(/node=d6/);
  await expect(page.getByTestId('fan-halo')).toHaveCount(0);
  await expect(page.getByTestId('graph-edge')).toHaveCount(25);
  await expect(page.locator('[data-testid="graph-edge"][data-edge^="e9-d6-"]')).toHaveCount(11);
  await expect(page.getByTestId('headline-table')).toContainText('Madison');
});

test('selecting an edge shows its evidence with a working citation', async ({ page }) => {
  await page.goto('/systems');
  await page.locator('[data-edge="e1-s12-d3"]').click();
  await expect(page).toHaveURL(/edge=e1-s12-d3/);
  const panel = page.getByTestId('edge-panel');
  await expect(panel).toContainText('The clinic payment covers Medicaid enrollees');
  const cite = panel.getByTestId('edge-evidence').locator('[data-cite]').first();
  await cite.hover();
  await expect(page.getByTestId('cite-popover')).toBeVisible();
  await expect(page.getByTestId('cite-popover').getByTestId('ref-summary')).not.toBeEmpty();
});

test('the ring node points to the region map; "Depends on" follows the report\'s eleven links; the table view', async ({ page }) => {
  await page.goto('/systems?node=s13');
  await expect(page.getByTestId('ring-headline').getByRole('link')).toHaveAttribute('href', /\/map\/region$/);
  await page.goto('/systems?node=d3');
  await page.getByRole('button', { name: 'Depends on' }).click();
  await expect(page.getByText("following the report's eleven links")).toBeVisible();
  await page.getByTestId('table-view').click();
  await expect(page.getByTestId('systems-table').locator('tbody tr')).toHaveCount(25);
});

test('the table view is the default below 768 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/systems');
  await expect(page.getByTestId('systems-table')).toBeVisible();
});

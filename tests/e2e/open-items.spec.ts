import { expect, test } from '@playwright/test';

test('/open-items pins OI-128 and OI-010, filters by who, and marks Appendix C', async ({ page }) => {
  await page.goto('/open-items');
  await expect(page.getByTestId('oi-note')).toContainText('it does not say the thing does not exist');
  const pinned = page.getByTestId('pinned').getByTestId('open-item');
  await expect(pinned).toHaveCount(2);
  await expect(pinned.first()).toHaveAttribute('id', 'OI-128');
  await expect(pinned.nth(1)).toHaveAttribute('id', 'OI-010');
  await expect(page.getByTestId('open-item')).toHaveCount(129);
  await expect(page.getByTestId('appendix-c-chip')).toHaveCount(22);
  await page.getByTestId('filter-who').selectOption('next-review');
  await expect(page).toHaveURL(/who=next-review/);
  await expect(page.getByTestId('open-item')).toHaveCount(6);
  await expect(page.getByTestId('pinned')).toHaveCount(0);
  const dl = page.waitForEvent('download');
  await page.getByTestId('oi-csv').click();
  expect((await dl).suggestedFilename()).toBe('open-items-who=next-review.csv');
});

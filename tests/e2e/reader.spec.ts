import { expect, test } from '@playwright/test';

async function firstCiteInDomain3(page: import('@playwright/test').Page) {
  await page.goto('/read#d3');
  await expect(page.getByTestId('reader-body')).toBeVisible();
  const handle = await page.evaluateHandle(() => {
    const h = document.getElementById('d3')!;
    return [...document.querySelectorAll<HTMLElement>('[data-cite]')].find((c) => h.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)!;
  });
  return page.locator(`#${await handle.evaluate((el) => el.closest('[data-block]')!.id)} [data-cite]`).first();
}

test('hovering the first [n] in Domain 3 shows the summary and what supports the sentence', async ({ page }) => {
  const cite = await firstCiteInDomain3(page);
  await page.waitForTimeout(400);
  await cite.scrollIntoViewIfNeeded();
  await cite.hover();
  const pop = page.getByTestId('cite-popover');
  await expect(pop).toBeVisible();
  await expect(pop.getByTestId('ref-summary')).not.toBeEmpty();
  await expect(pop.getByText('What supports this sentence')).toBeVisible();
  await expect(pop.getByTestId('supports').locator('q').first()).not.toBeEmpty();
  await expect(pop.getByRole('link', { name: /Open the source/ })).toBeVisible();
  await expect(pop.getByRole('link', { name: /Full reference/ })).toBeVisible();
});

test('the same card opens by keyboard and closes with Esc, focus returning', async ({ page }) => {
  const cite = await firstCiteInDomain3(page);
  await page.waitForTimeout(400);
  await cite.focus();
  await expect(page.getByTestId('cite-popover')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('cite-popover').getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('cite-popover')).toBeHidden();
  await expect(cite).toBeFocused();
});

test('clicking [n] folds the card out under the paragraph', async ({ page }) => {
  const cite = await firstCiteInDomain3(page);
  await cite.click();
  await expect(page.getByTestId('foldout').first()).toBeVisible();
  await expect(page.getByTestId('foldout').first().getByTestId('ref-summary')).not.toBeEmpty();
});

test('"Show what was checked": a verified claim opens a passage, a not-found claim opens "Looked for in"', async ({ page }) => {
  await page.goto('/read#d3');
  await page.getByTestId('show-checked').check();
  await expect(page.getByTestId('claim-legend')).toContainText('matched to a quoted passage');
  const verified = page.locator('.bx-checked [data-claim="B0073.a"]');
  await verified.scrollIntoViewIfNeeded();
  await verified.hover();
  const card = page.getByTestId('claim-popover');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('claim-status')).toContainText(/Verified: matched to a quoted passage/);
  await expect(card.getByTestId('claim-source').first().locator('q')).not.toBeEmpty();
  await expect(card.getByTestId('claim-pass')).toContainText(/settled (in|after)/);
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  const absent = page.locator('.bx-checked [data-claim="B0074.d"]');
  await absent.scrollIntoViewIfNeeded();
  await absent.hover();
  await expect(page.getByTestId('claim-popover').getByTestId('claim-status')).toContainText(/Not found/);
  await expect(page.getByTestId('claim-popover')).toContainText('Looked for in');
  await page.reload();
  await expect(page.getByTestId('show-checked')).toBeChecked();
});

test('/read#b-B0138 scrolls to the block; there are no change markers', async ({ page }) => {
  await page.goto('/read#b-B0138');
  const b = page.locator('#b-B0138');
  await expect(b).toBeVisible();
  await expect(b).toBeInViewport();
  await expect(page.getByTestId('change-marker')).toHaveCount(0);
});

test('analysis passages are marked; the read banner; section strips; Appendix C links to its open items', async ({ page }) => {
  await page.goto('/read');
  await expect(page.getByTestId('read-banner')).toContainText('Researched and written with Claude for Little Orange Fish from public sources');
  await expect(page.getByTestId('analysis').first()).toContainText('analysis');
  await expect(page.getByTestId('section-strip').first()).toContainText('claims checked');
  await expect(page.getByTestId('appendix-c-link')).toHaveCount(22);
  await expect(page.getByTestId('appendix-c-link').first()).toHaveText('OI-001 →');
  await expect(page.getByTestId('maps-strip').first()).toContainText('On the maps');
});

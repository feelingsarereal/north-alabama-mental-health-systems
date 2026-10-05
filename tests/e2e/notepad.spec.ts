import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SENTENCE = 'Check the 13,700 clinic count against page 29 before the coalition meeting.';

async function typeIntoNewNote(page: Page) {
  const drawer = page.getByTestId('notepad-drawer');
  await expect(drawer).toBeVisible();
  await drawer.getByTestId('new-note').click();
  const body = drawer.getByTestId('note-body').first();
  await expect(body).toBeFocused();
  await page.keyboard.type(SENTENCE, { delay: 15 });
  await expect(body).toHaveValue(SENTENCE);
  await expect(body).toBeFocused();
}

test('notepad: write → reload → persists → export → import', async ({ page }) => {
  await page.goto('/glossary');
  await page.getByTestId('notepad-toggle').click();
  await page.getByTestId('new-note').first().click();
  await page.getByTestId('note-body').first().fill('Is the waitlist figure from July 2026?');
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByTestId('notepad-toggle').click();
  await expect.poll(() => page.getByTestId('note-body').evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value))).toContain('Is the waitlist figure from July 2026?');
  const dl = page.waitForEvent('download');
  await page.getByTestId('export-notes').first().click();
  const file = (await (await dl).path())!;
  const md = fs.readFileSync(file, 'utf8');
  expect(md).toContain('# Notes — ');
  expect(md).toContain('Is the waitlist figure from July 2026?');
  // clear storage, then import the exported file back
  await page.evaluate(() => localStorage.clear());
  await page.goto('/notes');
  await page.locator('input[type=file]').first().setInputFiles(file);
  // (other tests share the preview's file autosave, so look for this note among whatever else is there)
  await expect.poll(() => page.getByTestId('note-body').evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value))).toContain('Is the waitlist figure from July 2026?');
});

test('the drawer keeps focus while a full sentence is typed', async ({ page }) => {
  await page.goto('/changes');
  await page.getByTestId('notepad-toggle').click();
  await typeIntoNewNote(page);
});

test('the drawer on /read at 375 px keeps focus while typing', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/read');
  await page.getByTestId('notepad-toggle').click();
  await typeIntoNewNote(page);
});

test('the notepad says where notes are saved', async ({ page }) => {
  await page.goto('/notes');
  await expect(page.getByTestId('save-line')).toContainText(/autosaved to notes\/notepad\.md|Saved in this browser only — export to keep a copy\./);
});

test('a note anchored to a tract on the tract map shows its anchor on /notes', async ({ page }) => {
  await page.goto('/map/tracts?layer=pct_poverty&geo=01089010630');
  await page.getByTestId('area-panel').getByTestId('add-note').first().click();
  await page.getByTestId('notepad-drawer').getByTestId('note-body').first().fill('Ask about this tract.');
  await page.waitForTimeout(800);
  await page.goto('/notes');
  await expect(page.getByTestId('note').getByRole('link', { name: /tract map: People below the poverty level · Census Tract 106\.30/ }).first()).toBeVisible();
});

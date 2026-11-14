import { expect, test, type Page } from '@playwright/test';
import { SHOTS, freshSetup, horizontalOverflow } from './helpers';

/** November 2026: the board that fits the screen, the price list picker, quotes as cards, and the new templates. */

test.use({ timezoneId: 'Asia/Manila', viewport: { width: 1440, height: 900 }, actionTimeout: 15_000 });

async function addJob(page: Page, title: string, status?: string) {
  await page.goto('/#/jobs?new=job');
  const nj = page.getByRole('dialog', { name: 'New job' });
  await nj.getByLabel('Name or organization').fill(`${title} Client`);
  await nj.getByLabel('What they need').fill(title);
  await nj.getByRole('button', { name: 'Add the job' }).click();
  await expect(nj).toBeHidden();
  const job = page.getByRole('dialog').last();
  await expect(job.getByLabel('Status')).toBeVisible();
  if (status) await job.getByLabel('Status').selectOption(status);
  await job.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(job).toBeHidden();
}

test('the job board fits the screen, with a short Completed list', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T10:00:00+08:00') });
  await freshSetup(page);
  for (let i = 1; i <= 6; i++) await addJob(page, `Old finished job ${i}`, 'completed');
  // Three weeks later.
  await page.clock.setSystemTime(new Date('2026-10-21T10:00:00+08:00'));
  for (let i = 1; i <= 3; i++) await addJob(page, `Recently finished job ${i}`, 'completed');
  await addJob(page, 'Merch design for the org fair', 'in-progress');
  await addJob(page, 'Environmental learning materials with a long title', 'in-progress');
  await addJob(page, 'Branding and visual identity', 'review');
  await addJob(page, 'Customized calendar');

  for (const theme of ['light', 'dark']) {
    await page.goto('/#/jobs');
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await expect(page.locator('.job-col.done .done-row')).toHaveCount(3);
    // Nothing scrolls: not the page sideways, not the board sideways, not the page down.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    const board = await page.locator('.job-board').evaluate((b) => b.scrollWidth - b.clientWidth);
    expect(board).toBeLessThanOrEqual(1);
    const main = await page.locator('.main').evaluate((m) => m.scrollHeight - m.clientHeight);
    expect(main).toBeLessThanOrEqual(1);
    // Empty columns fold into slim strips.
    const inquiry = await page.locator('.job-col.st-inquiry').boundingBox();
    const progress = await page.locator('.job-col.st-in-progress').boundingBox();
    expect(inquiry!.width).toBeLessThan(progress!.width * 0.7);
    await page.screenshot({ path: `${SHOTS}/nov-board-${theme}.png` });
  }

  await page.getByRole('button', { name: /See all 9 completed/ }).click();
  await expect(page).toHaveURL(/#\/jobs\/list\?status=completed/);
  await expect(page.getByText('9 of 13 jobs')).toBeVisible();
});

test('price list picker, quotes as cards, and the new templates', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00+08:00') });
  await freshSetup(page);
  await page.goto('/#/docs/quotes');
  await page.getByRole('button', { name: 'New quote' }).first().click();
  const quote = page.getByRole('dialog', { name: /^Quote / });
  await quote.getByLabel('Name on the quote').fill('Kape Ilonggo');
  await quote.getByRole('button', { name: 'Add from the price list' }).click();
  const picker = page.getByRole('dialog', { name: 'Add from the price list' });
  // Sections down the side on a computer.
  const sections = picker.getByRole('navigation', { name: 'Price list sections' });
  await expect(sections).toBeVisible();
  for (const s of ['Merch production', 'Printing', 'Situation kits', 'Video']) await expect(sections.getByRole('button', { name: new RegExp(`^${s}`) })).toBeVisible();
  await sections.getByRole('button', { name: /^Branding/ }).click();
  const row = picker.locator('.catalog-row').first();
  // The rows take the card's colour (never the grey browser button), text from the left.
  const idle = await row.evaluate((r) => ({ bg: getComputedStyle(r).backgroundColor, align: getComputedStyle(r).textAlign }));
  expect(idle).toEqual({ bg: 'rgba(0, 0, 0, 0)', align: 'left' });
  await row.hover();
  await expect.poll(() => row.evaluate((r) => getComputedStyle(r).backgroundColor)).toBe('rgb(220, 239, 241)');
  await page.screenshot({ path: `${SHOTS}/nov-picker-hover.png` });
  await row.click();
  await expect(row.getByText('Added')).toBeVisible();
  await sections.getByRole('button', { name: /^Printing/ }).click();
  await expect(picker.getByRole('button', { name: /Sintra board menu board, 3 mm.*₱120 \/ sq ft/ })).toBeVisible();
  await picker.getByRole('button', { name: /Sintra board menu board/ }).click();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: `${SHOTS}/nov-picker-dark.png` });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await picker.getByRole('button', { name: /Done \(2 added\)/ }).click();
  await quote.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(quote).toBeHidden();

  // Quotes are cards, like the contract templates.
  await page.goto('/#/docs/quotes');
  const card = page.locator('.quote-card').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Kape Ilonggo');
  await expect(card).toContainText('Draft');
  await expect(card).toContainText('Budget Logo + 1 more');
  await page.screenshot({ path: `${SHOTS}/nov-quotes.png` });

  // 21 contract templates.
  await page.goto('/#/docs/templates');
  await expect(page.locator('.template-card')).toHaveCount(21);
  await page.screenshot({ path: `${SHOTS}/nov-templates.png`, fullPage: true });

  // A government contract: no down payment, so the PDF asks for payment after acceptance.
  await page.goto('/#/docs/contracts');
  await page.getByRole('button', { name: 'New contract' }).first().click();
  await page.getByRole('radio', { name: /Government & LGU/ }).click();
  await page.getByRole('button', { name: 'Make the contract' }).click();
  const ct = page.getByRole('dialog').first();
  await expect(ct).toBeVisible();
  const download = page.waitForEvent('download');
  await ct.locator('.dialog-foot').getByRole('button', { name: 'PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  await file.saveAs(`${SHOTS}/nov-government-contract.pdf`);
});

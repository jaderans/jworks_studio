import { expect, test } from '@playwright/test';
import { SHOTS, freshSetup, horizontalOverflow } from './helpers';

test.use({ timezoneId: 'Asia/Manila', viewport: { width: 1440, height: 900 }, actionTimeout: 15_000 });

test('sticker printing in Studio: a customer’s own size by count, quote to shipped, and the shares in Payouts', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T10:00:00+08:00') });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await freshSetup(page);

  await page.getByRole('link', { name: 'Sticker printing' }).first().click();
  await expect(page.getByRole('heading', { name: 'Sticker printing', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'New service order' }).click();
  const d = page.getByRole('dialog', { name: 'New service order' });
  await d.getByLabel('Name', { exact: true }).fill('Mira Bakeshop');
  await d.getByLabel('Mobile, email or @handle').fill('0917 555 0101');
  // Their own 2.3 × 1.7 in, 50 stickers: 16 a sheet inside the Cricut area, so 4 sheets.
  await expect(d.getByLabel('Sticker size (optional)').locator('option', { hasText: '2 × 2 in · 15 per sheet' })).toHaveCount(1);
  await d.getByLabel('Sticker size (optional)').selectOption({ label: 'Custom size…' });
  await d.getByLabel('Sticker width in inches').fill('2.3');
  await d.getByLabel('Sticker height in inches').fill('1.7');
  await expect(d.locator('.sheet-fit')).toContainText('16 stickers of 2.3 × 1.7 in on one A4');
  await d.getByRole('button', { name: 'Sticker count' }).click();
  await d.getByLabel('How many stickers').fill('50');
  await expect(d.getByText('4 A4 sheets make 64, 14 spare.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/printing-custom-size.png` });
  await d.getByRole('button', { name: 'Add to the order' }).click();
  await expect(d.locator('.list-item', { hasText: '2.3 × 1.7 in: 50 stickers, 64 fit on 4 sheets' })).toContainText('₱320');
  // Two detailed designs: ₱450 at the November rate.
  await d.getByRole('button', { name: 'Illustration', exact: true }).click();
  await d.getByLabel('Tier').selectOption('detailed');
  await d.getByLabel('Designs').fill('2');
  await expect(d.getByText(/Rate card: ₱450, a set saving ₱50/)).toBeVisible();
  await d.getByRole('button', { name: 'Add to the order' }).click();
  // Courier, ₱120.
  await d.getByRole('button', { name: 'Courier', exact: true }).click();
  await d.getByLabel('Courier', { exact: true }).fill('J&T');
  await d.getByLabel('Delivery fee').fill('120');
  await d.getByLabel('Address').fill('12 Rizal St, Jaro, Iloilo City');
  await d.getByLabel('Who prints it').selectOption({ label: 'Joshua' });
  await d.getByLabel('Who draws it').selectOption({ label: 'Joshua' });
  await d.getByLabel('Illustrator’s share').fill('50');
  await expect(d.locator('.wf-row.total')).toContainText('₱890');
  await expect(d.locator('.wf-row', { hasText: '50% down payment' })).toContainText('₱445');
  await page.screenshot({ path: `${SHOTS}/printing-order.png`, fullPage: true });
  await d.getByRole('button', { name: 'Save service order' }).click();
  await expect(d).toBeHidden();

  const card = page.getByRole('article', { name: /Sticker printing COM-/ });
  await expect(page.getByRole('region', { name: 'Quote and proof' }).getByRole('article')).toHaveCount(1);
  await expect(card).toContainText('₱890 · no payment yet');
  await card.getByRole('button', { name: 'Proof sent' }).click();
  await card.getByRole('button', { name: 'Approved' }).click();
  await expect(card.getByText(/Ready by/)).toBeVisible();
  // The down payment, recorded in Studio.
  await card.getByRole('button', { name: 'Payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Record a payment' });
  await expect(pay.getByLabel('Amount')).toHaveValue('445');
  await pay.getByRole('button', { name: 'Save the payment' }).click();
  await expect(card).toContainText('₱445 paid');

  // The quote slip on the letterhead.
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: /Quote slip for COM-/ }).click();
  expect((await download).suggestedFilename()).toMatch(/COM-\d+ - Mira Bakeshop - sticker printing\.pdf/);

  await card.getByRole('button', { name: 'Start making' }).click();
  await expect(page.getByRole('region', { name: 'Making' }).getByRole('article')).toHaveCount(1);
  await page.getByRole('region', { name: 'Making' }).getByRole('button', { name: 'Ready' }).click();
  const ready = page.getByRole('region', { name: 'Ready' });
  await expect(ready.getByRole('article')).toHaveCount(1);
  // Shipped asks for the balance first.
  await ready.getByRole('button', { name: 'Shipped' }).click();
  const balance = page.getByRole('dialog', { name: 'Record a payment' });
  await expect(balance.getByLabel('Amount')).toHaveValue('445');
  await balance.getByRole('button', { name: 'Save the payment' }).click();
  await expect(ready.getByRole('article')).toContainText('Paid');
  await ready.getByRole('button', { name: 'Shipped' }).click();
  await expect(page.getByText('Done and cancelled (1)')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/printing-board.png`, fullPage: true });

  // Find an order.
  await page.getByLabel('Find an order').fill('nobody');
  await expect(page.getByText('Done and cancelled')).toHaveCount(0);
  await page.getByLabel('Find an order').fill('0917');
  await expect(page.getByText('Done and cancelled (1)')).toBeVisible();

  // It's a Sticker Printing job, and the printer's and illustrator's shares are owed in Payouts:
  // 20% of ₱320 + 50% of ₱450 = ₱64 + ₱225 = ₱289.
  await page.goto('/#/jobs/list?status=completed');
  await expect(page.getByText(/Sticker printing: Premium Matte or Glossy/).first()).toBeVisible();
  await page.goto('/#/money/payouts');
  await expect(page.getByText('₱289').first()).toBeVisible();

  // The rate card: the cut area and the November illustration prices.
  await page.goto('/#/printing');
  await page.getByRole('button', { name: 'Rate card' }).click();
  const rc = page.getByRole('dialog', { name: 'Sticker printing rate card' });
  await expect(rc.getByLabel('Cut area width')).toHaveValue('7.2');
  await expect(rc.getByLabel('Cut area height')).toHaveValue('10.62');
  await expect(rc.getByLabel('Detailed, one design')).toHaveValue('250');
  await page.screenshot({ path: `${SHOTS}/printing-rate-card.png`, fullPage: true });
  expect(errors).toEqual([]);
});

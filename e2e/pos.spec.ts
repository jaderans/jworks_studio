import { expect, test } from '@playwright/test';
import { SHOTS, freshSetup, horizontalOverflow, overlappingFields } from './helpers';
import type { PosEventFeed, PosOrderFeed } from '../src/domain/posFeed';

test.use({ timezoneId: 'Asia/Manila' });

const event: PosEventFeed = {
  type: 'event', v: 1, eventId: 'ev1', name: 'Komiket Iloilo', venue: 'SM City Iloilo', startDate: '2026-10-24', endDate: '2026-10-25', status: 'reported',
  business: 'JoshWorks', gross: 579_500, transactions: 50, itemsSold: 120, discounts: 0,
  methods: [
    { methodId: 'cash', name: 'Cash', kind: 'cash', amount: 349_500 },
    { methodId: 'gcash', name: 'GCash', kind: 'ewallet', amount: 230_000 },
  ],
  cogs: 120_000, cogsMissing: 0, boothFee: 200_000, supplies: 15_000,
  people: [
    { memberId: 'p-josh', name: 'Joshua', email: '', kind: 'staff', role: 'Production', amount: 45_033, paid: 45_033, paidAt: Date.parse('2026-10-26T10:00:00+08:00'), method: 'GCash' },
    { memberId: 'p-kaye', name: 'Kaye', email: '', kind: 'staff', role: 'Cashier', amount: 30_011, paid: 0, paidAt: null, method: '' },
    { memberId: 'p-nook', name: 'Nook Prints', email: '', kind: 'partner', role: 'Nook stickers 30%', amount: 20_000, paid: 0, paidAt: null, method: '' },
  ],
  tradingProfit: 0, joshworksNet: 0, depositsHeld: 0,
};

const order: PosOrderFeed = {
  type: 'order', v: 1, orderId: 'o1', number: 'QA-07', eventId: 'ev1', eventName: 'Komiket Iloilo',
  customer: { name: 'Kaye Santos', email: 'kaye@example.com', phone: '0917', handle: '' },
  designer: { memberId: 'p-josh', name: 'Joshua', email: '' },
  lines: [{ name: 'Custom portrait', qty: 1, unitPrice: 50_000 }],
  total: 50_000, dueAt: '2026-10-31T15:00', status: 'in-progress', createdAt: Date.parse('2026-10-24T13:00:00+08:00'),
  payments: [{ saleId: 's1', date: '2026-10-24', name: 'GCash', kind: 'ewallet', amount: 25_000, stage: 'deposit' }],
  notes: '',
};

test('booth events and orders from JoshWorks POS become jobs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await freshSetup(page);

  // What "Send to Studio" leaves in the POS database on this device (same site)
  await page.evaluate(async (feed) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('jworks-pos', 60);
      req.onupgradeneeded = () => req.result.createObjectStore('studioFeed', { keyPath: 'id' });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('studioFeed', 'readwrite');
        tx.objectStore('studioFeed').put({ id: 'event:ev1', feed, sentBy: 'Joshua', createdAt: 1, updatedAt: 1 });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
      };
    });
  }, event);

  await page.goto('/#/money/pos');
  await expect(page.getByRole('heading', { name: 'Booth events', level: 1 })).toBeVisible();
  const row = page.getByRole('row', { name: /Komiket Iloilo/ });
  await expect(row.getByText('Not in Studio')).toBeVisible();
  await row.getByRole('button', { name: 'Add to Studio' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add Komiket Iloilo to Studio' });
  await expect(dialog.getByLabel('Who is Joshua (staff)').locator('option:checked')).toHaveText('Joshua');
  await expect(dialog.getByLabel('Who is Kaye (staff)')).toHaveValue('expense');
  await expect(dialog.getByText('Expense (partner share)')).toBeVisible();
  // ₱5,795 − Joshua ₱450.33 − booth fee, supplies, production cost, Kaye and the partner (₱3,850.11)
  await expect(dialog.getByText('₱1,494.56')).toBeVisible();
  expect(await overlappingFields(page)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/pos-import.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Add to Studio' }).click();
  await expect(page.getByText('Komiket Iloilo added to Studio')).toBeVisible();
  await expect(row.getByText('In Studio')).toBeVisible();

  // Joshua's pay shows as earned and already paid
  await page.goto('/#/money/payouts');
  await expect(page.getByRole('row', { name: /Joshua/ }).first()).toContainText('₱450.33');

  // An order from a file saved on another device
  await page.goto('/#/money/pos');
  await page.getByLabel('POS file').setInputFiles({
    name: 'JoshWorks - for JoshWorks Studio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'jworks-pos', kind: 'studio-feed', v: 1, exportedAt: 1, feeds: [order] })),
  });
  const orderRow = page.getByRole('row', { name: /QA-07/ });
  await orderRow.getByRole('button', { name: 'Add to Studio' }).click();
  const od = page.getByRole('dialog', { name: 'Add order QA-07 as a job' });
  await expect(od.getByLabel('Who makes it').locator('option:checked')).toHaveText('Joshua');
  await od.getByRole('button', { name: 'Add to Studio' }).click();
  await expect(orderRow.getByText('In Studio')).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/pos-booth-events.png`, fullPage: true });

  await page.goto('/#/clients');
  await expect(page.getByText('Kaye Santos').first()).toBeVisible();
  expect(errors).toEqual([]);
});

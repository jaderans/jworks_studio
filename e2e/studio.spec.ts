import { expect, test, type Page } from '@playwright/test';
import { SHOTS, freshSetup, horizontalOverflow, overlappingFields } from './helpers';

// Wednesday, Oct 21 2026, 10:00 PHT.
test.use({ timezoneId: 'Asia/Manila' });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|trends\/latest\.json/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function pdf(page: Page, click: () => Promise<void>, name: RegExp) {
  const download = page.waitForEvent('download');
  await click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(name);
  await file.saveAs(`${SHOTS}/${file.suggestedFilename()}`);
}

test('owner runs a job from inquiry to paid, with invoice, receipt, contract and payout', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00+08:00') });
  const errors = watchErrors(page);
  await freshSetup(page);

  // A walk-in asks for a logo: log the inquiry.
  await page.goto('/#/jobs');
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New inquiry' }).first().click();
  const inq = page.getByRole('dialog', { name: 'New inquiry' });
  await inq.getByLabel('Name or organization').fill('Kape Ilonggo');
  await inq.getByLabel('Email').fill('hello@kape.example');
  await inq.getByLabel('What they need').fill('Logo and brand kit');
  await inq.getByLabel('Type').selectOption('Branding');
  await inq.getByLabel('Needed by').fill('2026-11-13');
  await page.screenshot({ path: `${SHOTS}/studio-inquiry.png` });
  await inq.getByRole('button', { name: 'Add the inquiry' }).click();

  // The job opens; price it from the price list.
  const job = page.getByRole('dialog', { name: /COM-001/ });
  await expect(job).toBeVisible();
  await job.getByRole('button', { name: 'Money', exact: true }).click();
  await job.getByRole('button', { name: 'Add from the price list' }).click();
  const picker = page.getByRole('dialog', { name: 'Add from the price list' });
  await picker.getByLabel('Search the price list').fill('Essential Branding');
  await picker.getByRole('button', { name: /Essential Branding/ }).first().click();
  await picker.getByRole('button', { name: /Done/ }).click();
  await expect(job.getByText('₱3,500').first()).toBeVisible();
  await job.getByRole('button', { name: 'Work', exact: true }).click();
  await job.getByLabel('Status').selectOption('in-progress');
  await job.getByRole('button', { name: 'Money', exact: true }).click();
  // Who gets paid: the owner takes 100% of the share.
  await job.getByRole('button', { name: 'Add a person' }).click();
  await job.getByLabel('Designer').selectOption({ label: 'Joshua' });
  await expect(job.getByText('100%').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-job-money.png` });

  // 50% down payment by GCash → acknowledgment receipt.
  await job.getByRole('button', { name: 'Record a payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Record a payment' });
  await pay.getByLabel('Amount').fill('1750');
  await pay.getByRole('button', { name: 'Save the payment' }).click();
  await expect(pay).toBeHidden();
  await expect(job.getByText(/AR-0001-2026/)).toBeVisible();

  // Invoice for the balance.
  await job.getByRole('button', { name: 'Make an invoice' }).click();
  const inv = page.getByRole('dialog', { name: /Invoice JW-0032-2026/ });
  await expect(inv).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-invoice.png` });
  await pdf(page, () => inv.getByRole('button', { name: 'PDF' }).click(), /JW-0032-2026.*\.pdf$/);
  await inv.getByRole('button', { name: 'Save', exact: true }).click();
  await job.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('Escape');

  await page.screenshot({ path: `${SHOTS}/studio-board.png`, fullPage: true });
  for (const [tab, shot] of [
    ['All jobs', 'jobs-list'],
    ['Deadlines', 'jobs-deadlines'],
    ['Workload', 'jobs-workload'],
  ]) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.screenshot({ path: `${SHOTS}/studio-${shot}.png`, fullPage: true });
  }

  // Money: the invoice is part paid, the payment has a receipt, the owner's share shows as owed.
  await page.goto('/#/money/invoices');
  await expect(page.getByText('JW-0032-2026').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-invoices.png`, fullPage: true });
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await expect(page.getByText('AR-0001-2026').first()).toBeVisible();
  await pdf(page, () => page.getByRole('button', { name: 'Receipt PDF' }).first().click(), /AR-0001-2026.*\.pdf$/);
  await page.screenshot({ path: `${SHOTS}/studio-payments.png`, fullPage: true });
  await page.getByRole('link', { name: 'Payouts', exact: true }).click();
  // ₱1,750 less the 5% deduction = ₱1,662.50 earned by the lead designer.
  await expect(page.getByText('₱1,662.50').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-payouts.png`, fullPage: true });
  for (const tab of ['Expenses', 'Reports', 'BIR']) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.screenshot({ path: `${SHOTS}/studio-${tab.toLowerCase()}.png`, fullPage: true });
  }

  // Documents: a branding contract on the logo letterhead, filled from the job.
  await page.goto('/#/docs/contracts');
  await page.getByRole('button', { name: 'New contract' }).first().click();
  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Kape Ilonggo' });
  await page.getByLabel('For a job (optional)').selectOption({ index: 1 });
  await page.getByRole('radio', { name: /Branding/ }).first().click();
  await page.getByRole('button', { name: 'Make the contract' }).click();
  const ct = page.getByRole('dialog').first();
  await expect(ct).toBeVisible();
  // Payment method is a dropdown of the studio's methods; the questionnaire is the studio's own 22 questions.
  await expect(ct.getByLabel('Payment method')).toHaveJSProperty('tagName', 'SELECT');
  await expect(ct.getByLabel('Prices valid until')).toHaveValue('2026-11-04');
  await page.screenshot({ path: `${SHOTS}/studio-contract.png` });
  await ct.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(ct.getByText('3 logo concepts')).toBeVisible();
  await ct.getByRole('button', { name: 'Branding Questionnaire', exact: true }).click();
  await expect(ct.getByText('of 22 answered')).toBeVisible();
  await ct.getByRole('button', { name: 'Modern & Minimalist', exact: true }).click();
  await expect(ct.getByText('2 of 22 answered')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-contract-questionnaire.png` });
  await pdf(page, () => ct.locator('.dialog-foot').getByRole('button', { name: 'PDF' }).click(), /\.pdf$/);
  await page.keyboard.press('Escape');
  for (const tab of ['Quotes', 'Price list', 'Contract templates', 'Team rates']) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.screenshot({ path: `${SHOTS}/studio-docs-${tab.toLowerCase().replace(/ /g, '-')}.png`, fullPage: true });
  }

  // Clients: general clients with history.
  await page.goto('/#/clients');
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-clients.png`, fullPage: true });
  await page.getByRole('button', { name: /Kape Ilonggo/ }).first().click();
  const client = page.getByRole('dialog', { name: /Kape Ilonggo/ });
  await client.getByRole('button', { name: 'History', exact: true }).click();
  await expect(client.getByText('JW-0032-2026')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-client-history.png` });
  await page.keyboard.press('Escape');

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /Money/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/studio-dashboard.png`, fullPage: true });

  expect(errors).toEqual([]);
});

// Every main screen at phone, tablet and desktop sizes, light and dark: nothing wider than the screen.
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
];
const ROUTES = ['/', '/jobs', '/jobs/list', '/jobs/deadlines', '/jobs/workload', '/clients', '/money/invoices', '/money/payments', '/money/payouts', '/money/expenses', '/money/reports', '/money/bir', '/docs/quotes', '/docs/contracts', '/docs/prices', '/docs/templates', '/docs/rates', '/calendar', '/board', '/team', '/settings'];

test('every screen fits phones, tablets and desktops', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00+08:00') });
  const errors = watchErrors(page);
  await freshSetup(page);
  // One job with money so the money screens have rows.
  await page.goto('/#/jobs?new=job');
  const nj = page.getByRole('dialog', { name: 'New job' });
  await nj.getByLabel('Name or organization').fill('CPU Student Council');
  await nj.getByLabel('Kind of client').selectOption('student-org');
  await nj.getByLabel('What they need').fill('Election campaign kit with a very long title that should wrap neatly on phones');
  await nj.getByRole('button', { name: 'Add the job' }).click();
  await page.keyboard.press('Escape');

  const wide: string[] = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const theme of ['light', 'dark']) {
      for (const r of ROUTES) {
        await page.goto(`/#${r}`);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(150);
        const over = await horizontalOverflow(page);
        if (over > 1) wide.push(`${vp.name} ${theme} ${r}: ${over}px`);
        if (theme === 'light' || vp.name === 'iphone-15') await page.screenshot({ path: `${SHOTS}/layout-${vp.name}-${theme}${r.replace(/\//g, '-') || '-home'}.png`, fullPage: true });
      }
    }
  }
  expect(wide).toEqual([]);
  expect(errors).toEqual([]);
});

// A Firebase email link opens the app's own page (here with a dead code, so it shows the error state).
test('email links open a branded page', async ({ page }) => {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(vp);
    await page.goto('/?mode=verifyEmail&oobCode=not-a-real-code&apiKey=not-a-real-key#/');
    await expect(page.getByRole('heading', { name: /didn’t work|Email confirmed/ })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/auth-action-${vp.width}.png` });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  }
});

// The main dialogs at phone and desktop sizes: no field, hint or button drawn over another.
test('dialogs never draw fields over each other', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00+08:00') });
  await freshSetup(page);
  await page.goto('/#/jobs?new=job');
  const nj = page.getByRole('dialog', { name: 'New job' });
  await nj.getByLabel('Name or organization').fill('Kape Ilonggo');
  await nj.getByLabel('What they need').fill('Logo');
  await nj.getByRole('button', { name: 'Add the job' }).click();
  await page.keyboard.press('Escape');
  const found: string[] = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(vp);
    const open = async (name: string, how: () => Promise<void>) => {
      await how();
      await page.waitForTimeout(350);
      for (const o of await overlappingFields(page)) found.push(`${vp.width} ${name}: ${o}`);
      await page.screenshot({ path: `${SHOTS}/dialog-${name}-${vp.width}.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    };
    await open('inquiry', () => page.goto('/#/jobs?new=inquiry'));
    await open('job', async () => {
      await page.goto('/#/jobs/list');
      await page.getByText('Logo', { exact: true }).first().click();
    });
    await open('job-money', async () => {
      await page.getByText('Logo', { exact: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Money', exact: true }).click();
    });
    await open('team', async () => {
      await page.goto('/#/team');
      await page.getByRole('button', { name: /Edit Joshua/ }).click();
    });
    await open('client-new', async () => {
      await page.goto('/#/clients');
      await page.getByRole('button', { name: 'Add a client' }).first().click();
    });
    await open('payment', async () => {
      await page.goto('/#/money/payments');
      await page.getByRole('button', { name: /Record a payment/ }).first().click();
    });
    await open('expense', async () => {
      await page.goto('/#/money/expenses');
      await page.getByRole('button', { name: /Add an expense|New expense|Add expense/ }).first().click();
    });
  }
  expect(found).toEqual([]);
});

// List pages: the Filters button shows and hides compact dropdowns, and remembers the choice.
test('filter bars show, hide and remember their filters', async ({ page }) => {
  await freshSetup(page);
  await page.goto('/#/jobs/list');
  const status = page.getByRole('combobox', { name: 'Status' });
  await expect(status).toBeHidden();
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(status).toBeVisible();
  // Sized to its options, not stretched across the page.
  expect((await status.boundingBox())?.width ?? 999).toBeLessThan(300);
  await status.selectOption('all');
  await expect(page.getByRole('button', { name: /Filters\s*1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(status).toHaveValue('open');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible();
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByRole('combobox', { name: 'Status' })).toBeHidden();
  for (const path of ['/docs/prices', '/money/payments', '/money/expenses', '/team', '/activity']) {
    await page.goto(`/#${path}`);
    await expect(page.locator('.filter-bar').first()).toBeVisible();
  }
});

// Client links: the page the client sees (previewed here, no cloud needed), and a broken link.
test('client link pages: preview to sign, and a broken link', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T10:00:00+08:00') });
  const errors = watchErrors(page);
  await freshSetup(page);
  await page.goto('/#/docs/contracts');
  await page.getByRole('button', { name: 'New contract' }).first().click();
  await page.getByRole('radio', { name: /Branding/ }).first().click();
  await page.getByRole('button', { name: 'Make the contract' }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: /Client link/ }).click();
  const share = page.getByRole('dialog', { name: 'Client link' });
  await expect(share.getByText('Needs cloud sync')).toBeVisible();
  await share.getByRole('button', { name: 'Preview the signing page' }).click();
  const view = page.getByRole('dialog', { name: 'What the client sees' });
  await expect(view.getByRole('heading', { name: 'Terms and conditions' })).toBeVisible();
  await view.getByRole('button', { name: 'Modern & Minimalist', exact: true }).click();
  await view.getByRole('button', { name: 'Sign the contract' }).click();
  await expect(view.getByText(/tick that you have read/)).toBeVisible();
  await view.getByLabel(/I have read, understood/).check();
  await view.getByLabel('Your full name').fill('Ana Reyes');
  const box = (await view.locator('.signature-pad canvas').boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 6 });
  await page.mouse.move(box.x + 220, box.y + 110, { steps: 6 });
  await page.mouse.up();
  await expect(view.getByText('Signed', { exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Sign the contract' }).click();
  await expect(view.getByText(/This is a preview: nothing was sent/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/client-link-preview.png` });
  await page.keyboard.press('Escape');

  // A partial or broken link explains itself instead of showing the studio app.
  await page.goto('/#/c?d=not-a-link');
  await expect(page.getByRole('heading', { name: /This link doesn’t work/ })).toBeVisible();
  expect(errors).toEqual([]);
});

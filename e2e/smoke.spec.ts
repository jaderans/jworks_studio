import { expect, test } from '@playwright/test';
import { SHOTS, freshSetup, hasPlanner } from './helpers';

// Fix "today" so the restart countdown and calendars are stable: Sunday, Oct 4 2026, 10:00 PHT.
test.use({ timezoneId: 'Asia/Manila' });

test('owner sets up, imports the planner and works through every screen', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T10:00:00+08:00') });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|trends\/latest\.json/.test(m.text())) errors.push(m.text());
  });

  await freshSetup(page, { importPlanner: true });

  // Calendar: November restarts with the Typography post on Wed, Nov 4 (Mon, Nov 2 is All Souls' Day).
  if (hasPlanner) {
    await expect(page.getByRole('heading', { name: 'Content calendar' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('grid', { name: /November 2026/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Typography 101/ }).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/calendar-month.png`, fullPage: true });

    // Open a post, write a caption, check the platform tabs and the premium check.
    await page.getByRole('button', { name: /Typography 101/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Captions', exact: true }).click();
    await page.getByLabel('Caption', { exact: true }).fill('Font pairing is easier than you think.\n\nThree rules we use on every brand.');
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(page.locator('.cap-preview')).toContainText('𝗙𝗼𝗻𝘁');
    await page.screenshot({ path: `${SHOTS}/post-captions.png` });
    await page.getByRole('dialog').getByRole('button', { name: /Premium check/ }).click();
    await page.getByRole('button', { name: 'All checked' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }

  // Dashboard shows the countdown to the restart.
  await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
  await expect(page.getByText(/Posting restarts|Good morning/).first()).toBeVisible();
  if (hasPlanner) {
    await expect(page.getByText(/Posting restarts Tue, Nov 3/)).toBeVisible();
    await expect(page.getByText(/posts for the first two weeks back are ready/)).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true });

  // Marketing: one sidebar entry, its pages as tabs.
  await page.getByRole('link', { name: 'Marketing', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Content calendar' })).toBeVisible();
  await page.getByRole('link', { name: 'Content board', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/board.png` });

  await page.getByRole('link', { name: 'Ideas', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ideas.png`, fullPage: true });

  await page.getByRole('link', { name: 'Campaigns', exact: true }).first().click();
  await page.getByRole('button', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: /Launch: JoshWorks now manages social media/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog').locator('input[aria-label="Title"]').first()).toHaveValue(/We now manage social media for local brands/);
  await page.screenshot({ path: `${SHOTS}/campaign-plan.png` });
  if (hasPlanner) {
    // The planner already fills every themed day, so the launch posts clash: move them to free days.
    await page.getByRole('button', { name: 'Move to free days' }).click();
    await expect(page.getByText(/Moved \d+ posts to free days/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move to free days' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/campaign-plan-spread.png` });
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Create campaign/ }).click();
  await expect(page.getByText(/is on the calendar with/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/campaigns.png`, fullPage: true });

  await page.getByRole('link', { name: 'Trends', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible();
  await page.getByRole('link', { name: 'Playbook', exact: true }).click();
  await expect(page.getByText('What the algorithms reward now')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/trends-playbook.png`, fullPage: true });
  await page.getByRole('link', { name: 'Hooks', exact: true }).click();
  await page.getByLabel('Your version').fill('5 logo mistakes that make your café look cheap');
  await page.getByRole('button', { name: /Save today’s hook/ }).click();
  await expect(page.getByText('Done for today.')).toBeVisible();

  await page.getByRole('link', { name: 'Results', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/results.png`, fullPage: true });

  // No API key: the assistant works through Claude.ai (copy the prompt, paste the answer back).
  await page.getByRole('link', { name: 'Assistant', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Copy & open Claude.ai' })).toBeVisible();

  // Clients in general: a student org gets student prices and the org discount on a quote, which becomes a job.
  await page.getByRole('link', { name: 'Clients', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add a client' }).first().click();
  await page.getByLabel('Name (business, org or person)').fill('CPU Student Council');
  await page.getByRole('dialog').getByLabel('Kind', { exact: true }).selectOption('student-org');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /CPU Student Council/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/client.png` });
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'New quote' }).click();
  const quote = page.getByRole('dialog', { name: /^Quote / });
  await expect(quote).toBeVisible();
  await quote.getByRole('button', { name: 'Add from the price list' }).click();
  const picker = page.getByRole('dialog', { name: 'Add from the price list' });
  await picker.getByLabel('Search the price list').fill('Essential Branding');
  await picker.getByRole('button', { name: /Essential Branding/ }).first().click();
  await picker.getByRole('button', { name: /Done/ }).click();
  // Student price.
  await expect(quote.getByText('₱2,700').first()).toBeVisible();
  await quote.getByLabel('Discount code').fill('REPYOURORG15');
  await quote.getByRole('button', { name: 'Apply code' }).click();
  await page.screenshot({ path: `${SHOTS}/quote.png` });
  const download = page.waitForEvent('download');
  await quote.getByRole('button', { name: 'PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await quote.getByRole('button', { name: /Make the job/ }).click();
  await expect(page.getByText(/COM-001 is on the job board/)).toBeVisible();

  await page.getByRole('link', { name: 'Documents', exact: true }).first().click();
  await page.getByRole('link', { name: 'Price list', exact: true }).click();
  await expect(page.getByText('Essential Branding').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/price-list.png`, fullPage: true });

  await page.getByRole('link', { name: 'Team', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Edit Joshua/ }).click();
  await expect(page.getByLabel('Sign-in email')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/team-edit.png` });
  await page.keyboard.press('Escape');
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/settings.png`, fullPage: true });

  // Dark mode.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.goto('/#/');
  await page.screenshot({ path: `${SHOTS}/dashboard-dark.png`, fullPage: true });
  if (hasPlanner) {
    await page.goto('/#/calendar?date=2026-11-10');
    await page.screenshot({ path: `${SHOTS}/calendar-dark.png`, fullPage: true });
  }

  expect(errors).toEqual([]);
});

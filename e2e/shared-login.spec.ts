import { expect, test, type Page } from '@playwright/test';
import { freshSetup } from './helpers';

/**
 * Studio moved into the JoshWorks POS Firebase project (one project, one list of logins), against the
 * emulators (run them from the POS: `npm run emulators`). A designer already signs in to the POS:
 * - giving them Studio access uses that same login (no second password);
 * - on a new device they sign in with their POS email and password and Studio's data loads, including
 *   everything the owner's device had before the move;
 * - Fix sign-in can email them a reset link.
 */

const PROJECT = 'demo-jwpos';
const FIREBASE = { apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: 'demo-app', emulator: { host: '127.0.0.1', authPort: 9099, firestorePort: 8080 } };
const CFG = { firebase: FIREBASE, ws: 'joshworks-studio' };
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const KAYE = 'kaye@jw.test';
const KAYE_POS_PASSWORD = 'kayePOS1';

async function emulatorsUp() {
  try {
    return (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/config`)).ok;
  } catch {
    return false;
  }
}

async function oobCodes(): Promise<{ email: string; requestType: string; oobLink: string }[]> {
  return ((await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).json()) as { oobCodes: { email: string; requestType: string; oobLink: string }[] }).oobCodes;
}

/** The designer's JoshWorks POS login: made and confirmed the way the POS sign-up does. */
async function posLogin(email: string, password: string) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const { idToken } = (await r.json()) as { idToken: string };
  await fetch(`${AUTH}/accounts:sendOobCode?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }) });
  await fetch((await oobCodes()).filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL').pop()!.oobLink);
}

/** Everything on this device marked as already sent (as it was, to the old Firebase project). */
async function markAllSynced(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('jworks-campaigns');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const idb = req.result;
          const names = [...idb.objectStoreNames];
          const tx = idb.transaction(names, 'readwrite');
          for (const n of names) {
            const cur = tx.objectStore(n).openCursor();
            cur.onsuccess = () => {
              const c = cur.result;
              if (!c) return;
              if (c.value && typeof c.value === 'object' && c.value._sync === 1) c.update({ ...c.value, _sync: 0 });
              c.continue();
            };
          }
          tx.oncomplete = () => {
            idb.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('one login for Studio and the POS: a designer signs in with their POS password on a new device, and all of Studio loads', async ({ page, browser }) => {
  test.setTimeout(240_000);
  test.skip(!(await emulatorsUp()), 'Firebase emulators are not running (npm run emulators in the POS)');
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await posLogin(KAYE, KAYE_POS_PASSWORD);

  // The owner's Studio, with work from before the move: a job, already "sent" to the old project.
  await freshSetup(page);
  await page.goto('/#/jobs?new=job');
  const nj = page.getByRole('dialog', { name: 'New job' });
  await nj.getByLabel('Name or organization').fill('Kaye’s Cafe');
  await nj.getByLabel('What they need').fill('Logo and menu board');
  await nj.getByRole('button', { name: 'Add the job' }).click();
  await page.keyboard.press('Escape');
  await markAllSynced(page);

  // Moved to the POS's project: the owner connects; the new workspace gets everything.
  await page.goto('/#/settings');
  await page.getByLabel('Paste the firebaseConfig').fill(JSON.stringify(FIREBASE));
  await page.getByLabel('Team name in the database').fill(CFG.ws);
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await page.getByRole('group', { name: 'Account' }).getByRole('button', { name: 'Create the owner account' }).click();
  await page.locator('#au-email').fill('owner@jw.test');
  await page.locator('#au-pass').fill('secret123');
  await page.locator('button[type=submit]', { hasText: 'Create my account' }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible({ timeout: 20_000 });

  // Kaye already signs in to the POS: Studio uses that login, no second password.
  await page.goto('/#/team');
  await page.getByRole('button', { name: 'Add person' }).click();
  const add = page.getByRole('dialog');
  await add.locator('#tm-name').fill('Kaye');
  await add.locator('#tm-email').fill(KAYE);
  await add.getByRole('group', { name: 'Access' }).getByRole('button', { name: 'Designer' }).click();
  await add.getByRole('button', { name: 'Save' }).click();
  // Saving makes her login by itself, after a moment: Studio finds her POS login and uses it.
  await expect(page.getByText(/Kaye already has a login in this Firebase project \(from JoshWorks POS\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Same login as POS')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Fix sign-in → email a reset link: Firebase sends one to Kaye.
  await page.getByRole('button', { name: 'Fix sign-in for Kaye' }).click();
  await page.getByRole('dialog').filter({ hasText: 'Fix Kaye’s sign-in' }).getByRole('button', { name: 'Email them a reset link' }).click();
  await expect.poll(async () => (await oobCodes()).some((c) => c.email === KAYE && c.requestType === 'PASSWORD_RESET'), { timeout: 10_000 }).toBe(true);

  // Kaye on a new phone: the team sign-in link, her POS email and password.
  const phone = await (await browser.newContext()).newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`/#/login?i=${b64url(JSON.stringify({ c: CFG }))}&e=${encodeURIComponent(KAYE)}`);
  await phone.locator('#au-email').fill(KAYE);
  await phone.locator('#au-pass').fill(KAYE_POS_PASSWORD);
  await phone.locator('button[type=submit]', { hasText: 'Sign in' }).click();
  await expect(phone.getByText(/You’re in as Designer/)).toBeVisible({ timeout: 20_000 });
  // Everything from before the move is there.
  await phone.getByRole('button', { name: 'Open the app' }).click();
  await phone.goto('/#/jobs');
  await expect(phone.getByText('Kaye’s Cafe').first()).toBeVisible({ timeout: 20_000 });

  // A wrong password says which one to use.
  const other = await (await browser.newContext()).newPage();
  await other.goto(`/#/login?i=${b64url(JSON.stringify({ c: CFG }))}`);
  await other.locator('#au-email').fill(KAYE);
  await other.locator('#au-pass').fill('studioOld1');
  await other.locator('button[type=submit]', { hasText: 'Sign in' }).click();
  await expect(other.getByText(/it’s the same password as there/)).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

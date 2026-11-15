import { expect, test } from '@playwright/test';
import { freshSetup } from './helpers';

/**
 * JoshWorks POS, live, against the Firebase emulators (run them from the POS: `npm run emulators`;
 * both apps share one project and one rules file). The cloud is set up the way the POS writes it:
 * owners/{uid} says where the POS data is, and its feed has a Couple-of-Stickers order. Studio,
 * signed in with the same owner login, shows it by itself, adds it as a job, and sees it change.
 */

const PROJECT = 'demo-jwpos';
const FIREBASE = { apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: 'demo-app', emulator: { host: '127.0.0.1', authPort: 9099, firestorePort: 8080 } };
const DOCS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
/** The emulator lets this header past the security rules, to write what the POS would. */
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const EMAIL = 'owner@jw.test';
const PASSWORD = 'secret123';

async function emulatorsUp() {
  try {
    return (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/config`)).ok;
  } catch {
    return false;
  }
}

/** A plain value as Firestore's REST JSON. */
function val(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, val(x)])) } };
}
async function put(path: string, data: Record<string, unknown>) {
  const r = await fetch(`${DOCS}/${path}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: (val(data) as { mapValue: { fields: unknown } }).mapValue.fields }) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

/** The owner's login, made and verified the way the POS's sign-up does. */
async function ownerLogin(): Promise<string> {
  const r = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) });
  const { localId, idToken } = (await r.json()) as { localId: string; idToken: string };
  await fetch(`${AUTH}/accounts:sendOobCode?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }) });
  const codes = (await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).json()) as { oobCodes: { email: string; oobLink: string }[] };
  await fetch(codes.oobCodes.filter((c) => c.email === EMAIL).pop()!.oobLink);
  return localId;
}

const stick = (status: string) => ({
  type: 'stick', v: 1, orderId: 'o1', number: 'BA-03', eventId: 'e1', eventName: 'Hilway November 2026', nickname: 'Kaye',
  customer: { name: 'Kaye', email: 'kaye@jw.test', phone: '', handle: '' }, maker: null,
  packs: [{ name: 'Couple Pack (live)', pack: 'C', singles: false, making: 'illustrating', designNo: 'CS03', file: 'CS03-Kaye-Mark', people: [{ name: 'Kaye', who: 'left' }, { name: 'Mark', who: 'right' }], minis: ['01', '02'], addOns: ['Pin (add-on)'], note: '', photoUrl: 'https://drive.google.com/file/d/ph3/view' }],
  addOns: [], status, paid: 34000, paidWith: 'GCash (ref 5012)', receiptNo: 'A-0003', readyFrom: 1763190000000, readyTo: 1763190600000, photoUrl: '', email: 'kaye@jw.test', softCopy: false,
  createdAt: 1763188000000, doneAt: status === 'ready' ? 1763190300000 : null, notes: '',
});

test('the POS live in Studio: a Couple-of-Stickers order shows up by itself, is added as a job with nothing to pay, and updates', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(!(await emulatorsUp()), 'Firebase emulators are not running (npm run emulators in the POS)');
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // What the POS writes when its owner connects and sells.
  const uid = await ownerLogin();
  await put(`owners/${uid}`, { pos: { ws: 'joshworks-pos', name: 'JoshWorks', email: EMAIL, at: 1 } });
  await put('ws/joshworks-pos', { name: 'JoshWorks', ownerUid: uid, ownerEmail: EMAIL, createdAt: 1 });
  await put(`ws/joshworks-pos/access/${EMAIL}`, { role: 'owner', memberId: 'm1', active: true, email: EMAIL, updatedAt: 1 });
  await put('ws/joshworks-pos/t_studioFeed/stick:o1', { id: 'stick:o1', feed: stick('in-progress'), sentBy: 'Couple-of-Stickers', deleted: 0, updatedAt: 1, deviceId: 'd1' });

  // Studio on this device: the same Firebase project, signed in with the same owner login.
  await freshSetup(page);
  await page.goto('/#/settings');
  await page.getByLabel('Paste the firebaseConfig').fill(JSON.stringify(FIREBASE));
  await page.getByLabel('Team name in the database').fill('joshworks-studio');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await page.locator('#au-email').fill(EMAIL);
  await page.locator('#au-pass').fill(PASSWORD);
  await page.locator('button[type=submit]', { hasText: 'Sign in' }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible({ timeout: 20_000 });

  // It's there by itself, with a count on the menu.
  await expect(page.getByRole('link', { name: /Money/ }).locator('.nav-count')).toHaveText('1', { timeout: 20_000 });
  await page.goto('/#/money/pos');
  await expect(page.getByText(/From JoshWorks through the cloud/)).toBeVisible();
  const row = page.getByRole('row', { name: /BA-03 · Kaye/ });
  await expect(row).toContainText('CS03-Kaye-Mark (Kaye, Mark)');
  await expect(row).toContainText('₱340');
  await expect(row).toContainText('Not in Studio');
  await row.getByRole('button', { name: 'Add to Studio' }).click();
  const d = page.getByRole('dialog', { name: 'Add Couple-of-Stickers 03 · Kaye as a job' });
  await expect(d).toContainText('Kaye (left), Mark (right)');
  await expect(d).toContainText('Paid ₱340 at the booth (GCash (ref 5012))');
  await d.getByRole('button', { name: 'Add to Studio' }).click();
  await expect(row).toContainText('In Studio');
  await expect(page.getByRole('link', { name: /Money/ }).locator('.nav-count')).toHaveCount(0);

  // Made in the POS: Studio sees the change by itself, and Update brings it in.
  await put('ws/joshworks-pos/t_studioFeed/stick:o1', { id: 'stick:o1', feed: stick('ready'), sentBy: 'Couple-of-Stickers', deleted: 0, updatedAt: 2, deviceId: 'd1' });
  await expect(row).toContainText('Changed in the POS', { timeout: 20_000 });
  await row.getByRole('button', { name: 'Update' }).click();
  await page.getByRole('dialog', { name: /^Update Couple-of-Stickers 03/ }).getByRole('button', { name: 'Update the job' }).click();
  await expect(row).toContainText('In Studio');

  // The job: the work, nothing to pay, the photo on its links.
  await row.getByRole('button', { name: 'Open the job' }).click();
  await expect(page.getByText('Couple-of-Stickers 03 · Kaye').first()).toBeVisible();
  expect(errors).toEqual([]);
});

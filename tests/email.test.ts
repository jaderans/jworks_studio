import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { setWriterDevice } from '../src/db/write';
import { DEFAULT_BUSINESS, DEFAULT_EMAIL } from '../src/db/settings';
import { emailReady, newMailerKey, sendEmail } from '../src/email/send';
import { contractEmail, inviteEmail } from '../src/email/templates';
import type { EmailSettings, StudioPayMethod } from '../src/db/types';

const settings: EmailSettings = { ...DEFAULT_EMAIL, mailerUrl: 'https://script.google.com/macros/s/abc/exec', mailerKey: 'jw-secret', copyTo: 'owner@example.com' };
const gcash: StudioPayMethod = { id: 'pm-gcash', label: 'GCash', accountName: 'J. Ranin', accountNumber: '0917 000 0000', qrImage: 'data:image/png;base64,iVBORw0KGgo=', on: true };

beforeEach(async () => {
  await db.delete();
  await db.open();
  setWriterDevice((await ensureDevice()).deviceId);
});
afterEach(() => vi.unstubAllGlobals());

function mockMailer(reply: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof reply === 'string' ? reply : JSON.stringify(reply));
  });
  return calls;
}

describe('studio email through the Gmail mailer', () => {
  it('needs the Apps Script link and the key', () => {
    expect(emailReady(DEFAULT_EMAIL)).toBe(false);
    expect(emailReady(settings)).toBe(true);
    expect(emailReady({ ...settings, mailerUrl: 'https://example.com/exec' })).toBe(false);
    expect(newMailerKey()).toMatch(/^jw-[A-Za-z0-9]{20,}$/);
  });

  it('sends the designed email with the PDF attached and the QR code inline', async () => {
    const calls = mockMailer({ ok: true, remaining: 97 });
    const mail = contractEmail(DEFAULT_BUSINESS, { clientName: 'Kape Ilonggo', number: 'C-2026-001', title: 'Branding & Visual Identity Agreement', total: 350000, down: 175000 }, [gcash]);
    expect(mail.html).toContain('cid:qrpmgcash');
    // Only the QR code goes out: never the account name or number, in the design or the text copy.
    for (const secret of ['0917 000 0000', 'J. Ranin']) {
      expect(mail.html).not.toContain(secret);
      expect(mail.text).not.toContain(secret);
    }
    const noQr = contractEmail(DEFAULT_BUSINESS, { clientName: 'Kape', number: 'C-1', title: 'T', total: 1, down: 1 }, [{ ...gcash, id: 'pm-bank', label: 'UnionBank', qrImage: '' }]);
    expect(noQr.html).not.toContain('UnionBank');
    expect(noQr.html).not.toContain('Where to pay');
    const left = await sendEmail({ email: 'hello@kape.example', name: 'Kape' }, mail, { settings, attachments: [{ name: 'C-2026-001.pdf', blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }) }] });
    expect(left).toBe(97);
    expect(calls).toHaveLength(1);
    // A "simple" request: no CORS preflight to Google.
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ key: 'jw-secret', to: 'hello@kape.example', bcc: 'owner@example.com', subject: 'Your Branding & Visual Identity Agreement contract (C-2026-001)' });
    expect(body.attachments).toEqual([{ name: 'C-2026-001.pdf', type: 'application/pdf', data: btoa('%PDF-1.7') }]);
    expect(body.inline.qrpmgcash).toMatchObject({ type: 'image/png', data: 'iVBORw0KGgo=' });
  });

  it('explains a wrong key, a full quota and a link that is not the mailer', async () => {
    const mail = inviteEmail(DEFAULT_BUSINESS, { name: 'Kaye', email: 'kaye@example.com', link: 'https://x/#/join', role: 'Manager', from: 'Joshua', password: 'JW-K7QF-M2XP' });
    // The login the owner made: email, temporary password and the link, no Google or confirmation.
    expect(mail.subject).toBe('Your JoshWorks Studio account is ready');
    expect(mail.html).toContain('JW-K7QF-M2XP');
    expect(mail.text).toContain('Temporary password: JW-K7QF-M2XP');
    expect(mail.html).not.toMatch(/Google/);
    mockMailer({ ok: false, error: 'key' });
    await expect(sendEmail({ email: 'kaye@example.com' }, mail, { settings })).rejects.toThrow(/key doesn’t match/);
    mockMailer({ ok: false, error: 'quota', remaining: 0 });
    await expect(sendEmail({ email: 'kaye@example.com' }, mail, { settings })).rejects.toThrow(/daily sending limit/);
    mockMailer('<html>Sign in to Google</html>');
    await expect(sendEmail({ email: 'kaye@example.com' }, mail, { settings })).rejects.toThrow(/Who has access/);
  });
});

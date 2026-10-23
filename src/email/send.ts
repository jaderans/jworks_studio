import { getSetting } from '../db/settings';
import { audit } from '../db/write';
import { blobToBase64 } from '../lib/files';
import type { EmailContent } from './templates';
import type { EmailSettings } from '../db/types';

/**
 * Sends the studio's emails from its own Gmail through a small Google Apps
 * Script (apps-script/Mailer.gs): designer invites to join the team, and
 * contracts, invoices and quotations (with receipts and reminders) for clients.
 * The app designs each email; the script delivers it with the PDF attached and
 * the payment QR codes inline. Free Gmail sends about 100 a day.
 */

export const emailReady = (s: Pick<EmailSettings, 'mailerUrl' | 'mailerKey'>) => /^https:\/\/script\.google(usercontent)?\.com\//.test(s.mailerUrl.trim()) && !!s.mailerKey.trim();

export class EmailError extends Error {}

/** A file to attach, e.g. the contract PDF. */
export interface Attachment {
  name: string;
  blob: Blob;
}

interface MailerReply {
  ok: boolean;
  error?: 'key' | 'to' | 'quota' | 'failed';
  message?: string;
  remaining?: number;
}

const fileOf = async (name: string, blob: Blob) => ({ name, type: blob.type || 'application/octet-stream', data: await blobToBase64(blob) });

/** "data:image/png;base64,…" → the mailer's inline image. */
function inlineOf(cid: string, dataUrl: string) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  return m ? { name: `${cid}.${m[1].split('/')[1] || 'png'}`, type: m[1], data: m[2] } : null;
}

async function post(url: string, body: unknown): Promise<MailerReply> {
  const res = await fetch(url.trim(), {
    method: 'POST',
    // text/plain keeps it a "simple" request, so the browser doesn't ask Google for CORS permission first.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new EmailError('Couldn’t reach the mailer. Check the connection and try again.');
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text) as MailerReply;
  } catch {
    throw new EmailError('The mailer link didn’t answer like the JoshWorks mailer. In Apps Script: Deploy → Manage deployments, check “Who has access” is Anyone, and copy the Web app URL again.');
  }
}

function explain(r: MailerReply): string {
  switch (r.error) {
    case 'key':
      return 'The mailer key doesn’t match. Copy the key from Settings → Email into the script’s KEY line, then deploy a new version.';
    case 'to':
      return 'That email address doesn’t look right.';
    case 'quota':
      return 'Gmail’s daily sending limit is used up (about 100 emails a day). It resets tomorrow.';
    default:
      return `Gmail didn’t send it: ${r.message || 'unknown error'}.`;
  }
}

/** Send one email. Returns how many Gmail can still send today. */
export async function sendEmail(
  to: { email: string; name?: string },
  mail: EmailContent,
  opts: { settings?: EmailSettings; what?: string; attachments?: Attachment[] } = {},
): Promise<number | undefined> {
  const s = opts.settings ?? (await getSetting('email'));
  if (!emailReady(s)) throw new EmailError('Email isn’t set up yet. Connect the studio Gmail in Settings → Email.');
  if (!to.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.email.trim())) throw new EmailError('That email address doesn’t look right.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new EmailError('You’re offline. Send it when you’re back online.');
  const inline: Record<string, unknown> = {};
  for (const [cid, url] of Object.entries(mail.inline ?? {})) {
    const img = inlineOf(cid, url);
    if (img) inline[cid] = img;
  }
  const r = await post(s.mailerUrl, {
    key: s.mailerKey.trim(),
    to: to.email.trim(),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    name: s.fromName || 'JoshWorks Studio',
    replyTo: s.replyTo,
    bcc: s.copyTo,
    attachments: await Promise.all((opts.attachments ?? []).map((a) => fileOf(a.name, a.blob))),
    inline,
  });
  if (!r.ok) throw new EmailError(explain(r));
  await audit('email', 'email', null, `Emailed ${to.name || to.email}: ${opts.what ?? mail.subject}`);
  return r.remaining;
}

/** Checks the link and key without sending anything. Returns emails left today. */
export async function checkMailer(s: EmailSettings): Promise<number | undefined> {
  if (!emailReady(s)) throw new EmailError('Paste the Web app URL from Apps Script and the key first.');
  const r = await post(s.mailerUrl, { key: s.mailerKey.trim(), ping: true });
  if (!r.ok) throw new EmailError(explain(r));
  return r.remaining;
}

/** A new random key for the script's KEY line. */
export function newMailerKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `jw-${btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 24)}`;
}

/** Fallback without the mailer: a Gmail draft with the plain-text version. */
export function gmailDraftUrl(to: string, mail: EmailContent): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: mail.subject, body: mail.text });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

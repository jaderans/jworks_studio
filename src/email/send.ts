import { getSetting } from '../db/settings';
import { audit } from '../db/write';
import type { EmailContent } from './templates';
import type { EmailSettings } from '../db/types';

/**
 * Sends branded email from the studio's Gmail through EmailJS (free: 200 a
 * month). The EmailJS template is set up once with: To = {{to_email}},
 * Subject = {{subject}}, Reply-to = {{reply_to}}, From name = {{from_name}},
 * Content (HTML) = {{{html}}}. See docs/EMAIL_SETUP.md.
 */

export const emailReady = (s: Pick<EmailSettings, 'serviceId' | 'templateId' | 'publicKey'>) => !!(s.serviceId && s.templateId && s.publicKey);

export class EmailError extends Error {}

export async function sendEmail(to: { email: string; name?: string }, mail: EmailContent, opts: { settings?: EmailSettings; what?: string } = {}): Promise<void> {
  const s = opts.settings ?? (await getSetting('email'));
  if (!emailReady(s)) throw new EmailError('Email isn’t set up yet. Add the EmailJS keys in Settings → Email.');
  if (!to.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.email.trim())) throw new EmailError('That email address doesn’t look right.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new EmailError('You’re offline. Send it when you’re back online.');
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: s.serviceId,
      template_id: s.templateId,
      user_id: s.publicKey,
      template_params: {
        to_email: to.email.trim(),
        to_name: to.name ?? '',
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: s.replyTo,
        from_name: s.fromName || 'JoshWorks Studio',
        cc_email: s.copyTo,
      },
    }),
  }).catch(() => null);
  if (!res) throw new EmailError('Couldn’t reach the email service. Check the connection and try again.');
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200);
    throw new EmailError(
      res.status === 400 || res.status === 404
        ? `EmailJS didn’t accept the request (${body || res.status}). Check the service ID, template ID and public key in Settings → Email.`
        : res.status === 403
          ? 'EmailJS blocked this site. In EmailJS → Account → Security, allow this site’s address, or turn off the domain restriction.'
          : res.status === 429
            ? 'Too many emails at once (EmailJS limit). Wait a minute and try again.'
            : `The email service said: ${body || res.status}`,
    );
  }
  await audit('email', 'email', null, `Emailed ${to.name || to.email}: ${opts.what ?? mail.subject}`);
}

/** Fallback without EmailJS: a Gmail draft with the plain-text version. */
export function gmailDraftUrl(to: string, mail: EmailContent): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: mail.subject, body: mail.text });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

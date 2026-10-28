import { useEffect, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout } from '../../components/ui';
import { Dialog } from '../../components/Dialog';
import { getSetting } from '../../db/settings';
import { emailReady, sendEmail } from '../../email/send';
import { inviteEmail } from '../../email/templates';
import { copyText } from '../../lib/text';
import { ROLE_LABEL } from '../../services/team';
import { teamSignInLink, type CloudConfig } from '../../sync/config';
import type { Member } from '../../db/types';

export interface LoginToSend {
  member: Member;
  email: string;
  password: string;
}

/** The message a new person needs: the app link, their email and the temporary password. */
export function loginMessage(name: string, link: string, email: string, password: string): string {
  return [
    `Hi ${name}! Your JoshWorks Studio account is ready.`,
    '',
    `1. Open the team sign-in link (bookmark it): ${link}`,
    `2. Sign in with`,
    `   Email: ${email}`,
    `   Temporary password: ${password}`,
    '3. Choose your own password. A short guide shows you around the app.',
  ].join('\n');
}

/** Everyone's new logins in one list, for the owner: each person gets only their own. */
export function loginList(link: string, logins: LoginToSend[]): string {
  return [`JoshWorks Studio sign-in link: ${link}`, '', ...logins.map((l) => `${l.member.name}: ${l.email} · ${l.password}`)].join('\n');
}

/** Shows new logins once, ready to email or paste in Messenger: one person, or everyone at once. */
export function LoginDialog({ value, onClose }: { value: LoginToSend[] | null; onClose: () => void }) {
  const app = useApp();
  const [cfg, setCfg] = useState<CloudConfig | null>(null);
  const [canEmail, setCanEmail] = useState(false);
  // The email being sent ('all' for everyone), and who has theirs.
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    if (!value) return;
    setSent([]);
    void (async () => {
      const [{ getCloudConfig }, email] = await Promise.all([import('../../sync/cloud'), getSetting('email')]);
      setCfg(await getCloudConfig());
      setCanEmail(emailReady(email));
    })();
  }, [value]);

  if (!value?.length) return null;
  const linkFor = (email?: string) => (cfg ? teamSignInLink(cfg, email) : '');
  const copy = async (text: string, done: string) => app.toast((await copyText(text)) ? done : 'Couldn’t copy; select the text and copy it.', { tone: 'good' });
  const send = async (list: LoginToSend[], key: string): Promise<boolean> => {
    setBusy(key);
    try {
      const business = await getSetting('business');
      const from = app.member?.name || business.name || 'JoshWorks';
      for (const l of list) {
        await sendEmail({ email: l.email, name: l.member.name }, inviteEmail(business, { name: l.member.name, email: l.email, link: linkFor(l.email), role: ROLE_LABEL[l.member.appRole], from, password: l.password }), { what: `login for ${l.member.name}` });
        setSent((s) => [...s, l.email]);
      }
      app.toast(list.length === 1 ? `Login emailed to ${list[0].email}` : `Logins emailed to ${list.length} people`, { tone: 'good' });
      return true;
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'The email didn’t send. Copy the message instead.', { tone: 'bad' });
      return false;
    } finally {
      setBusy('');
    }
  };
  const emailTitle = canEmail ? undefined : 'Connect the studio Gmail in Settings → Email to send it from here';
  const noEmail = !canEmail ? <Callout tone="info">To email logins from the studio Gmail, connect it in Settings → Email. Until then, copy the messages and send them in Messenger or Viber.</Callout> : null;

  if (value.length === 1) {
    const [one] = value;
    const { member, email, password } = one;
    const message = loginMessage(member.name, linkFor(email), email, password);
    return (
      <Dialog
        open
        onClose={onClose}
        title={`${member.name}’s login`}
        footer={
          <>
            <Button onClick={() => copy(message, 'Copied. Paste it in Messenger or Viber.')}>
              <Copy size={16} /> Copy message
            </Button>
            <Button variant="primary" disabled={!!busy || !canEmail || !cfg} title={emailTitle} onClick={async () => (await send([one], 'one')) && onClose()}>
              <Mail size={16} /> {busy ? 'Sending…' : 'Email it'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="small">
            {member.name} signs in with this email and temporary password, then chooses their own password before anything else. No email confirmation or Google account is needed.
          </p>
          <div className="kv-grid login-card">
            <span>Email</span>
            <b className="mono">{email}</b>
            <span>Temporary password</span>
            <b className="mono">{password}</b>
            <span>Role</span>
            <b>{ROLE_LABEL[member.appRole]}</b>
          </div>
          <pre className="login-message">{message}</pre>
          {noEmail}
          <p className="tiny muted">The password only shows on this device. It stops working once {member.name} chooses their own. If they lose it or forget theirs, press New password next to their name.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New temporary passwords"
      size="wide"
      footer={
        <>
          <Button onClick={() => copy(loginList(linkFor(), value), 'List copied. Send each person only their own password.')}>
            <Copy size={16} /> Copy the list
          </Button>
          <Button variant="primary" disabled={!!busy || !canEmail || !cfg || sent.length === value.length} title={emailTitle} onClick={() => send(value.filter((l) => !sent.includes(l.email)), 'all')}>
            <Mail size={16} /> {busy === 'all' ? 'Sending…' : 'Email everyone'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small">
          Their old passwords no longer work. Send each person <b>only their own</b> login: they open the team sign-in link, sign in with their email and this password, and choose their own password first thing.
        </p>
        <div className="card flush">
          <div className="list">
            {value.map((l) => (
              <div key={l.email} className="list-item login-row">
                <span className="main-text">
                  <b>{l.member.name}</b>
                  <span className="mono">{l.email}</span>
                </span>
                <b className="mono login-pass">{l.password}</b>
                <Button size="sm" onClick={() => copy(loginMessage(l.member.name, linkFor(l.email), l.email, l.password), `${l.member.name}’s message copied. Paste it in Messenger or Viber.`)} aria-label={`Copy ${l.member.name}’s message`}>
                  <Copy size={15} /> <span className="hide-phone">Copy</span>
                </Button>
                <Button size="sm" disabled={!!busy || !canEmail || !cfg || sent.includes(l.email)} title={emailTitle} onClick={() => send([l], l.email)} aria-label={`Email ${l.member.name}’s login`}>
                  <Mail size={15} /> <span className="hide-phone">{sent.includes(l.email) ? 'Sent' : busy === l.email ? 'Sending…' : 'Email'}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
        {noEmail}
        <p className="tiny muted">These passwords only show on this device (Send login shows them again here). Lost one? Press New password next to the person.</p>
      </div>
    </Dialog>
  );
}

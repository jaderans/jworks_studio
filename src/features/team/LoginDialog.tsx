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
    `1. Open: ${link}`,
    `2. Sign in with`,
    `   Email: ${email}`,
    `   Temporary password: ${password}`,
    '3. Choose your own password. A short guide shows you around the app.',
  ].join('\n');
}

/** Shows a new login once, ready to email or paste in Messenger. */
export function LoginDialog({ value, onClose }: { value: LoginToSend | null; onClose: () => void }) {
  const app = useApp();
  const [link, setLink] = useState('');
  const [canEmail, setCanEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return;
    void (async () => {
      const [{ getCloudConfig }, { inviteLink }, email] = await Promise.all([import('../../sync/cloud'), import('../../sync/config'), getSetting('email')]);
      const cfg = await getCloudConfig();
      setLink(cfg ? inviteLink(cfg, value.email, value.member.name) : '');
      setCanEmail(emailReady(email));
    })();
  }, [value]);

  if (!value) return null;
  const { member, email, password } = value;
  const message = loginMessage(member.name, link, email, password);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${member.name}’s login`}
      footer={
        <>
          <Button onClick={async () => app.toast((await copyText(message)) ? 'Copied. Paste it in Messenger or Viber.' : 'Couldn’t copy; select the text and copy it.', { tone: 'good' })}>
            <Copy size={16} /> Copy message
          </Button>
          <Button
            variant="primary"
            disabled={busy || !canEmail || !link}
            title={canEmail ? undefined : 'Connect the studio Gmail in Settings → Email to send it from here'}
            onClick={async () => {
              setBusy(true);
              try {
                const business = await getSetting('business');
                const from = app.member?.name || business.name || 'JoshWorks';
                await sendEmail({ email, name: member.name }, inviteEmail(business, { name: member.name, email, link, role: ROLE_LABEL[member.appRole], from, password }), { what: `login for ${member.name}` });
                app.toast(`Login emailed to ${email}`, { tone: 'good' });
                onClose();
              } catch (e) {
                app.toast(e instanceof Error ? e.message : 'The email didn’t send. Copy the message instead.', { tone: 'bad' });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Mail size={16} /> {busy ? 'Sending…' : 'Email it'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small">
          {member.name} signs in with this email and temporary password, then chooses their own password. No email confirmation or Google account is needed.
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
        {!canEmail ? <Callout tone="info">To email it from the studio Gmail, connect it in Settings → Email. Until then, copy the message and send it in Messenger or Viber.</Callout> : null}
        <p className="tiny muted">The password only shows on this device. It stops working once {member.name} chooses their own; if they forget theirs, they tap “Forgot password?” on the sign-in screen.</p>
      </div>
    </Dialog>
  );
}

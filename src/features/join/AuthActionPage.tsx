import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, MailCheck, XCircle } from 'lucide-react';
import lockupLight from '../../assets/brand/lockup-on-light.png';
import lockupDark from '../../assets/brand/lockup-on-dark.png';
import { Button, Callout, Loading } from '../../components/ui';
import { Field, TextInput } from '../../components/form';
import type { Auth } from 'firebase/auth';
import type { AuthAction } from './authAction';

/**
 * Where Firebase's emails land (Firebase → Authentication → Templates →
 * Customize action URL = this app): confirm an email, set a new password, or
 * undo an email change, on a JoshWorks page instead of Firebase's plain one.
 */

/** Back to the app, without the one-time code in the address. */
const openApp = () => window.location.replace(`${window.location.origin}${window.location.pathname}#/`);

async function actionAuth(apiKey: string): Promise<Auth> {
  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  // Only the project's public API key is needed to check the link.
  const app = getApps().find((a) => a.name === 'jw-action') ?? initializeApp({ apiKey }, 'jw-action');
  return getAuth(app);
}

const linkError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/expired-action-code') return 'This link has expired. Ask the owner for a new temporary password instead.';
  if (code === 'auth/invalid-action-code') return 'This link was already used or isn’t complete. If your email is already confirmed, just open the app.';
  if (code === 'auth/user-disabled') return 'This account has been turned off. Ask the studio owner.';
  if (code === 'auth/weak-password') return 'Use a password of at least 6 characters.';
  if (code === 'auth/network-request-failed') return 'No connection. Try the link again when you’re online.';
  return 'This link isn’t complete or no longer works. Copy the whole link from the email, or open the app and ask for a new one.';
};

type State = { step: 'working' } | { step: 'done'; title: string; text: string } | { step: 'reset'; email: string } | { step: 'error'; text: string };

export function AuthActionPage({ action }: { action: AuthAction }) {
  const [state, setState] = useState<State>({ step: 'working' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const auth = await actionAuth(action.apiKey);
        const { applyActionCode, checkActionCode, verifyPasswordResetCode } = await import('firebase/auth');
        if (action.mode === 'verifyEmail' || action.mode === 'verifyAndChangeEmail') {
          await applyActionCode(auth, action.oobCode);
          setState({ step: 'done', title: 'Email confirmed', text: 'You’re all set. Go back to JoshWorks Studio and tap “I’ve verified”, or open it here.' });
        } else if (action.mode === 'resetPassword') {
          setState({ step: 'reset', email: await verifyPasswordResetCode(auth, action.oobCode) });
        } else if (action.mode === 'recoverEmail') {
          const info = await checkActionCode(auth, action.oobCode);
          await applyActionCode(auth, action.oobCode);
          setState({ step: 'done', title: 'Email change undone', text: `Your sign-in email is back to ${info.data.email ?? 'what it was'}. If you didn’t ask for the change, set a new password too.` });
        } else setState({ step: 'error', text: 'This link isn’t one the app knows. Open the app and try again.' });
      } catch (e) {
        setState({ step: 'error', text: linkError(e) });
      }
    })();
  }, [action]);

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <img src={lockupLight} alt="JoshWorks" className="only-light" height={40} />
          <img src={lockupDark} alt="JoshWorks" className="only-dark" height={40} />
          <span className="brand-sub">Studio</span>
        </div>
        {state.step === 'working' ? <Loading label="Checking the link…" /> : null}
        {state.step === 'done' ? (
          <div className="stack">
            <h1 className="row" style={{ gap: 10 }}>
              {state.title === 'Email confirmed' ? <MailCheck size={28} className="good" /> : <CheckCircle2 size={28} className="good" />} {state.title}
            </h1>
            <p>{state.text}</p>
            <div>
              <Button variant="primary" size="lg" onClick={openApp}>
                Open JoshWorks Studio
              </Button>
            </div>
          </div>
        ) : null}
        {state.step === 'reset' ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw !== pw2) {
                setErr('The two passwords don’t match.');
                return;
              }
              setBusy(true);
              setErr('');
              try {
                const auth = await actionAuth(action.apiKey);
                const { confirmPasswordReset } = await import('firebase/auth');
                await confirmPasswordReset(auth, action.oobCode, pw);
                setState({ step: 'done', title: 'Password changed', text: `Sign in with ${state.email} and your new password.` });
              } catch (e2) {
                setErr(linkError(e2));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h1 className="row" style={{ gap: 10 }}>
              <KeyRound size={26} className="teal" /> Set a new password
            </h1>
            <p className="muted">For {state.email}</p>
            <Field label="New password" htmlFor="ap-pw" hint="At least 6 characters.">
              <TextInput id="ap-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
            </Field>
            <Field label="Type it again" htmlFor="ap-pw2">
              <TextInput id="ap-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} required />
            </Field>
            {err ? <Callout tone="bad">{err}</Callout> : null}
            <div>
              <Button type="submit" variant="primary" size="lg" disabled={busy || pw.length < 6}>
                {busy ? 'Saving…' : 'Save the new password'}
              </Button>
            </div>
          </form>
        ) : null}
        {state.step === 'error' ? (
          <div className="stack">
            <h1 className="row" style={{ gap: 10 }}>
              <XCircle size={28} className="bad" /> That link didn’t work
            </h1>
            <p>{state.text}</p>
            <div>
              <Button variant="primary" onClick={openApp}>
                Open JoshWorks Studio
              </Button>
            </div>
          </div>
        ) : null}
        <p className="tiny muted">JoshWorks · Graphic Design Studio · Iloilo City</p>
      </div>
    </div>
  );
}

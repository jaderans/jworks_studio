import { useState } from 'react';
import { Button, Callout, Segmented } from '../components/ui';
import { Field, TextInput } from '../components/form';
import { checkVerified, friendlyError, resendVerification, resetPassword, signInCloud, signInWithGoogle, signOutCloud, signUpCloud } from './cloud';
import { useSyncStatus } from './useSync';

/** Google's "G", in its own colours (Google's sign-in button guidelines). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Sign in with Google, or with an email and password (then confirm the email). */
export function AuthForm({ defaultEmail = '', defaultMode = 'signin' }: { defaultEmail?: string; defaultMode?: 'signin' | 'signup' }) {
  const sync = useSyncStatus();
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (sync.needsVerification) {
    return (
      <div className="stack">
        <Callout tone="info" title="Check your email">
          We sent a verification link to <b>{sync.userEmail}</b>. Open it, then come back and tap the button below. Check Spam if it isn&rsquo;t there.
        </Callout>
        {error ? <Callout tone="bad">{error}</Callout> : null}
        {info ? <Callout tone="good">{info}</Callout> : null}
        <div className="actions">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const ok = await checkVerified();
                if (!ok) setError('Not verified yet. Open the link in the email first.');
              })
            }
          >
            I&rsquo;ve verified
          </Button>
          <Button disabled={busy} onClick={() => run(async () => { await resendVerification(); setInfo('Sent again.'); })}>
            Send the link again
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => run(signOutCloud)}>
            Use another account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <Button size="lg" className="google-btn" disabled={busy} onClick={() => run(() => signInWithGoogle(email || defaultEmail || undefined))}>
        <GoogleMark /> Continue with Google
      </Button>
      <p className="tiny muted">Best for Gmail accounts: no password to remember and no confirmation email.</p>
      <div className="or-line" role="separator">
        <span>or with email and password</span>
      </div>
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => (mode === 'signin' ? signInCloud(email, password) : signUpCloud(email, password)));
      }}
    >
      <Segmented<'signin' | 'signup'>
        label="Account"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'signup', label: 'Create account' },
        ]}
      />
      <div className="form-grid">
        <Field label="Email" htmlFor="au-email">
          <TextInput id="au-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="au-pass" hint={mode === 'signup' ? 'At least 6 characters.' : undefined}>
          <TextInput id="au-pass" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}
      {info ? <Callout tone="good">{info}</Callout> : null}
      <div className="actions">
        <Button type="submit" variant="primary" disabled={busy || !email || password.length < 6}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        {mode === 'signin' ? (
          <Button
            variant="link"
            disabled={busy || !email}
            onClick={() => run(async () => { await resetPassword(email); setInfo(`A reset link was sent to ${email}.`); })}
          >
            Forgot password
          </Button>
        ) : null}
      </div>
    </form>
    </div>
  );
}

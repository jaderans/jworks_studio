import { useState } from 'react';
import { Button, Callout, Segmented } from '../components/ui';
import { Field, TextInput } from '../components/form';
import { friendlyError, sendResetEmail, signInCloud, signUpCloud } from './cloud';

/**
 * Sign in with an email and password. Team members use the login the owner
 * made for them (a temporary password they replace after signing in), or,
 * with JoshWorks POS in the same Firebase project, the same login as there.
 * Only the owner, setting up the studio's cloud for the first time, creates an
 * account here. A forgotten password: a reset link by email, or a new
 * temporary one from the owner.
 */
export function AuthForm({ defaultEmail = '', allowCreate = false }: { defaultEmail?: string; allowCreate?: boolean }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const creating = allowCreate && mode === 'signup';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => (creating ? signUpCloud(email, password) : signInCloud(email, password)));
      }}
    >
      {allowCreate ? (
        <Segmented<'signin' | 'signup'>
          label="Account"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create the owner account' },
          ]}
        />
      ) : null}
      <div className="form-grid">
        <Field label="Email" htmlFor="au-email">
          <TextInput id="au-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={creating ? 'Choose a password' : 'Password'} htmlFor="au-pass" hint={creating ? 'At least 6 characters.' : 'New here? Use the temporary password from the owner’s message. Already using JoshWorks POS? The same password as there.'}>
          <TextInput id="au-pass" type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}
      {sent ? (
        <Callout tone="good" title="Check your email">
          We sent a link to {sent} to choose a new password (check Spam too). It’s the same login for JoshWorks POS, so use the new password in both.
        </Callout>
      ) : null}
      <div className="actions">
        <Button type="submit" variant="primary" disabled={busy || !email || password.length < 6}>
          {busy ? 'Please wait…' : creating ? 'Create my account' : 'Sign in'}
        </Button>
        {!creating ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setSent('');
                await sendResetEmail(email);
                setSent(email.trim());
              })
            }
          >
            Email me a reset link
          </Button>
        ) : null}
      </div>
    </form>
  );
}

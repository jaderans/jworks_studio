import { useState } from 'react';
import { Button, Callout, Segmented } from '../components/ui';
import { Field, TextInput } from '../components/form';
import { friendlyError, resetPassword, signInCloud, signUpCloud } from './cloud';

/**
 * Sign in with an email and password. Team members use the login the owner
 * made for them (a temporary password they replace after signing in); only the
 * owner, setting up the studio's cloud for the first time, creates an account
 * here. No email confirmation is needed.
 */
export function AuthForm({ defaultEmail = '', allowCreate = false }: { defaultEmail?: string; allowCreate?: boolean }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const creating = allowCreate && mode === 'signup';

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
        <Field label={creating ? 'Choose a password' : 'Password'} htmlFor="au-pass" hint={creating ? 'At least 6 characters.' : 'New here? Use the temporary password from the owner’s message.'}>
          <TextInput id="au-pass" type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}
      {info ? <Callout tone="good">{info}</Callout> : null}
      <div className="actions">
        <Button type="submit" variant="primary" disabled={busy || !email || password.length < 6}>
          {busy ? 'Please wait…' : creating ? 'Create my account' : 'Sign in'}
        </Button>
        {!creating ? (
          <Button
            variant="link"
            disabled={busy || !email}
            onClick={() =>
              run(async () => {
                await resetPassword(email);
                setInfo(`A link to set a new password was sent to ${email}.`);
              })
            }
          >
            Forgot password?
          </Button>
        ) : null}
      </div>
    </form>
  );
}

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Callout } from '../components/ui';
import { Field, TextInput } from '../components/form';

/** First sign-in: replace the owner's temporary password with your own. */
export function ChoosePassword({ onDone }: { onDone?: () => void }) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const short = pw.length > 0 && pw.length < 8;
  const mismatch = again.length > 0 && again !== pw;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 8 || pw !== again) return;
        setBusy(true);
        setError('');
        try {
          const { changeOwnPassword } = await import('./cloud');
          await changeOwnPassword(pw);
          onDone?.();
        } catch (err) {
          const { friendlyError } = await import('./cloud');
          setError(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="small">You signed in with a temporary password. Choose your own now; the temporary one stops working.</p>
      <div className="form-grid">
        <Field label="New password" htmlFor="cp-new" error={short ? 'Use at least 8 characters.' : undefined}>
          <TextInput id="cp-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </Field>
        <Field label="Type it again" htmlFor="cp-again" error={mismatch ? 'The two don’t match.' : undefined}>
          <TextInput id="cp-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}
      <div>
        <Button type="submit" variant="primary" disabled={busy || pw.length < 8 || pw !== again}>
          <KeyRound size={16} /> {busy ? 'Saving…' : 'Save my password'}
        </Button>
      </div>
    </form>
  );
}

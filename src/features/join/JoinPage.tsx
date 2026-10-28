import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import logo from '../../assets/brand/logo-128.png';
import { Button, Callout, Loading } from '../../components/ui';
import { AuthForm } from '../../sync/AuthForm';
import { ChoosePassword } from '../../sync/ChoosePassword';
import { builtInCloud, readInvite } from '../../sync/config';
import { useSyncStatus } from '../../sync/useSync';
import { getLocal } from '../../db/local';
import { runJoinSetup } from '../../services/setup';
import { ROLE_LABEL } from '../../services/team';

/** The team sign-in screen (#/login, and old #/join invite links): connect this device to the studio and sign in. */
export function JoinPage({ onJoined, onSetUpAlone }: { onJoined: () => void; onSetUpAlone?: () => void }) {
  const [params] = useSearchParams();
  // The sign-in link carries the cloud; otherwise the cloud built into the app (just sign in).
  const linked = readInvite(params.get('i'));
  const built = builtInCloud();
  const email = params.get('e') ?? undefined;
  const invite = linked ? { ...linked, e: linked.e ?? email } : built ? { c: built, e: email, n: undefined } : null;
  const sync = useSyncStatus();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invite) return;
    (async () => {
      try {
        const existing = await getLocal<unknown>('cloudConfig', null);
        const { connectCloud, startCloudSync } = await import('../../sync/cloud');
        if (JSON.stringify(existing) !== JSON.stringify(invite.c)) await connectCloud(invite.c);
        else await startCloudSync();
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not connect.');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="main" style={{ gridRow: 'auto', minHeight: '100%' }}>
      <div className="page narrow" style={{ paddingTop: 36 }}>
        <div className="row" style={{ gap: 14 }}>
          <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 14 }} />
          <div>
            <span className="eyebrow">{linked?.e || linked?.n ? 'Team invite' : 'JoshWorks Studio'}</span>
            <h1>{linked?.e || linked?.n ? 'Join JoshWorks Studio' : 'Sign in'}</h1>
          </div>
        </div>
        {!invite ? (
          <Callout tone="bad" title="This sign-in link is broken">
            Ask the owner to copy it again (Team → Copy sign-in link) and send it whole.
          </Callout>
        ) : error ? (
          <Callout tone="bad">{error}</Callout>
        ) : !ready ? (
          <Loading label="Connecting…" />
        ) : sync.access?.mustChangePassword ? (
          <div className="card pad-lg stack">
            <Callout tone="good" title={`Welcome${invite.n ? `, ${invite.n}` : ''}! You’re in as ${ROLE_LABEL[sync.access.role]}`}>
              One last step: choose your own password.
            </Callout>
            <ChoosePassword />
          </div>
        ) : sync.access ? (
          <div className="card pad-lg stack">
            <Callout tone="good" title={`You’re in as ${ROLE_LABEL[sync.access.role]}`}>
              Signed in as {sync.userEmail}. Jobs, clients and the calendar are downloading now.
            </Callout>
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={async () => {
                  await runJoinSetup(invite.n ? `${invite.n}’s phone` : 'Team phone');
                  onJoined();
                }}
              >
                Open the app
              </Button>
            </div>
          </div>
        ) : (
          <div className="card pad-lg stack">
            <p className="muted">
              {invite.n ? `Hi ${invite.n}! ` : ''}Sign in with your email{invite.e ? ` (${invite.e})` : ''} and password. New to the team? Use the temporary password from the owner’s message; you’ll choose your own right after.
            </p>
            {sync.state === 'error' ? <Callout tone="warn">{sync.message}</Callout> : null}
            <AuthForm defaultEmail={invite.e ?? ''} />
            {onSetUpAlone && !linked ? (
              <p className="tiny muted">
                Not on the JoshWorks team?{' '}
                <button type="button" className="link-btn" onClick={onSetUpAlone}>
                  Set up this device on its own
                </button>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

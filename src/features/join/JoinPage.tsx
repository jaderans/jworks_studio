import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import logo from '../../assets/brand/logo-128.png';
import { Button, Callout, Loading } from '../../components/ui';
import { AuthForm } from '../../sync/AuthForm';
import { readInvite } from '../../sync/config';
import { useSyncStatus } from '../../sync/useSync';
import { getLocal } from '../../db/local';
import { runJoinSetup } from '../../services/setup';
import { ROLE_LABEL } from '../../services/team';

/** Where an invite link lands: connect this phone to the team and sign in. */
export function JoinPage({ onJoined }: { onJoined: () => void }) {
  const [params] = useSearchParams();
  const invite = readInvite(params.get('i'));
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
            <span className="eyebrow">Team invite</span>
            <h1>Join JoshWorks Studio</h1>
          </div>
        </div>
        {!invite ? (
          <Callout tone="bad" title="This invite link is broken">
            Ask the owner to copy the link again from Team and send it whole.
          </Callout>
        ) : error ? (
          <Callout tone="bad">{error}</Callout>
        ) : !ready ? (
          <Loading label="Connecting…" />
        ) : sync.access ? (
          <div className="card pad-lg stack">
            <Callout tone="good" title={`You’re in as ${ROLE_LABEL[sync.access.role]}`}>
              Signed in as {sync.userEmail}. The calendar, ideas and your tasks are downloading now.
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
              {invite.n ? `Hi ${invite.n}! ` : ''}Sign in with the email the owner added{invite.e ? ` (${invite.e})` : ''}. New here? Choose Create account and use that same email.
            </p>
            {sync.state === 'error' ? <Callout tone="warn">{sync.message}</Callout> : null}
            <AuthForm defaultEmail={invite.e ?? ''} defaultMode="signup" />
          </div>
        )}
      </div>
    </div>
  );
}

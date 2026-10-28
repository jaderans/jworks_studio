import logo from '../../assets/brand/logo-128.png';
import { Callout } from '../../components/ui';
import { ChoosePassword } from '../../sync/ChoosePassword';
import { useSyncStatus } from '../../sync/useSync';
import { ROLE_LABEL } from '../../services/team';

/** Signed in with a temporary password: choosing their own comes first, before anything else opens. */
export function PasswordFirstPage() {
  const sync = useSyncStatus();
  return (
    <div className="main" style={{ gridRow: 'auto', minHeight: '100%' }}>
      <div className="page narrow" style={{ paddingTop: 36 }}>
        <div className="row" style={{ gap: 14 }}>
          <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 14 }} />
          <div>
            <span className="eyebrow">JoshWorks Studio</span>
            <h1>Choose your password</h1>
          </div>
        </div>
        <div className="card pad-lg stack">
          <Callout tone="good" title={`You’re in${sync.access ? ` as ${ROLE_LABEL[sync.access.role]}` : ''}`}>
            Signed in as {sync.userEmail}. First, replace the temporary password with your own.
          </Callout>
          <ChoosePassword />
          <p className="tiny muted">
            Not you?{' '}
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                const { signOutCloud } = await import('../../sync/cloud');
                await signOutCloud();
              }}
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

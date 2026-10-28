import { useState } from 'react';
import { Cloud, Copy, Link2, LogOut, RefreshCw, Unplug } from 'lucide-react';
import { Link } from 'react-router';
import rulesText from '../../../firebase/firestore.rules?raw';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout } from '../../components/ui';
import { Field, TextArea, TextInput } from '../../components/form';
import { useSyncStatus } from '../../sync/useSync';
import { AuthForm } from '../../sync/AuthForm';
import { builtInCloud, parseFirebaseConfig, slugify } from '../../sync/config';
import { relativeTime } from '../../lib/time';
import { ROLE_LABEL } from '../../services/team';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CloudSection() {
  const app = useApp();
  const sync = useSyncStatus();
  const owner = app.can('settings');
  const [configText, setConfigText] = useState('');
  const [ws, setWs] = useState('joshworks');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);

  /** The one link for the whole team (pin it in the group chat). */
  const copySignInLink = async () => {
    const [{ getCloudConfig }, { teamSignInLink }] = await Promise.all([import('../../sync/cloud'), import('../../sync/config')]);
    const cfg = await getCloudConfig();
    if (!cfg) return;
    const ok = await copy(teamSignInLink(cfg));
    app.toast(ok ? 'Sign-in link copied. Pin it in your team chat.' : 'Couldn’t copy the link.', { tone: ok ? 'good' : 'bad' });
  };
  /** For the repository variable STUDIO_CLOUD: then the app's own address shows Sign in on any device. */
  const copyForGitHub = async () => {
    const [{ getCloudConfig }, { studioCloudValue }] = await Promise.all([import('../../sync/cloud'), import('../../sync/config')]);
    const cfg = await getCloudConfig();
    if (!cfg) return;
    const ok = await copy(studioCloudValue(cfg));
    app.toast(ok ? 'Copied. Paste it as the value of STUDIO_CLOUD in GitHub (steps below).' : 'Couldn’t copy.', { tone: ok ? 'good' : 'bad', ms: 8000 });
  };

  const connect = async () => {
    setError('');
    try {
      const firebase = parseFirebaseConfig(configText);
      setBusy(true);
      const { connectCloud } = await import('../../sync/cloud');
      await connectCloud({ firebase, ws: slugify(ws) });
      app.toast('Connected. Now sign in or create the owner account.', { tone: 'good' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="s-sync" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
      <div className="card-head">
        <h2 className="row" style={{ gap: 8 }}>
          <Cloud size={22} className="teal" /> Cloud sync and team accounts
        </h2>
        {sync.enabled ? (
          <Badge tone={sync.state === 'error' ? 'bad' : sync.access ? 'good' : 'warn'}>{sync.access ? 'On' : sync.state === 'error' ? 'Problem' : 'Sign in needed'}</Badge>
        ) : (
          <Badge>Off</Badge>
        )}
      </div>

      {!sync.enabled ? (
        owner ? (
          <div className="stack">
            <p className="sub">
              Optional. With it, every designer works on the same calendar from their own phone, comments and approvals arrive live, and everything is backed up. Nothing waits for it; changes upload whenever there&rsquo;s a connection. It runs on your own free Firebase project; use a new project, separate from JoshWorks POS.
            </p>
            <ol className="small" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              <li>
                Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a>, sign in with the JoshWorks Google account and <b>Add project</b> (e.g. joshworks-campaigns; free Spark plan, no card needed).
              </li>
              <li>
                <b>Build → Authentication → Get started</b>, and turn on <b>Email/Password</b>.
              </li>
              <li>
                <b>Build → Firestore Database → Create database</b>. Pick the <b>asia-southeast1 (Singapore)</b> location and start in <b>production mode</b>.
              </li>
              <li>
                In Firestore → <b>Rules</b>, replace everything with the JoshWorks rules (button below) and <b>Publish</b>.
              </li>
              <li>
                <b>Project settings → Your apps → Web (&lt;/&gt;)</b>, register an app, copy the <span className="mono">firebaseConfig</span> block and paste it here.
              </li>
            </ol>
            <div className="actions">
              <Button
                size="sm"
                onClick={async () => {
                  if (await copy(rulesText)) app.toast('Rules copied. Paste them in Firestore → Rules.', { tone: 'good' });
                  else setShowRules(true);
                }}
              >
                <Copy size={16} /> Copy the security rules
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRules((v) => !v)}>
                {showRules ? 'Hide rules' : 'Show rules'}
              </Button>
            </div>
            {showRules ? <TextArea readOnly rows={10} value={rulesText} className="mono" aria-label="Firestore security rules" /> : null}
            <Field label="Paste the firebaseConfig" htmlFor="cl-config">
              <TextArea id="cl-config" rows={7} className="mono" value={configText} onChange={(e) => setConfigText(e.target.value)} placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "….firebaseapp.com",\n  projectId: "…",\n  …\n};'} />
            </Field>
            <Field label="Team name in the database" htmlFor="cl-ws" hint="Short, no spaces. Every device on the team uses the same one.">
              <TextInput id="cl-ws" value={ws} onChange={(e) => setWs(e.target.value)} />
            </Field>
            {error ? <Callout tone="bad">{error}</Callout> : null}
            <div>
              <Button variant="primary" onClick={connect} disabled={busy || !configText.trim()}>
                Connect this device
              </Button>
            </div>
          </div>
        ) : (
          <p className="sub">Open the team’s sign-in link on this device (the owner copies it from Team → Copy sign-in link) and sign in with your email and password.</p>
        )
      ) : (
        <div className="stack">
          {sync.access ? (
            <div className="stack tight">
              <div className="row between wrap">
                <span>
                  Signed in as <b>{sync.userEmail}</b> · <Badge tone="teal">{ROLE_LABEL[sync.access.role]}</Badge>
                </span>
                <span className="muted small">{sync.lastSyncAt ? `Last sync ${relativeTime(sync.lastSyncAt)}` : ''}</span>
              </div>
              <p className="small muted">{sync.message}</p>
              {sync.refused ? (
                <Callout tone="warn" title={`${sync.refused} change${sync.refused === 1 ? '' : 's'} the cloud refused`}>
                  {sync.refusedTables.length ? <>Not uploaded yet: {sync.refusedTables.join(', ')}. </> : null}
                  They’re kept on this device and tried again every couple of minutes. Usually the security rules need publishing again: copy them below and publish them in Firebase → Firestore → Rules. New rules can take a minute to apply; then press Sync now.
                </Callout>
              ) : null}
              <div className="actions">
                <Button
                  size="sm"
                  onClick={async () => {
                    const { syncNow } = await import('../../sync/cloud');
                    await syncNow();
                  }}
                >
                  <RefreshCw size={16} /> Sync now
                </Button>
                {sync.access.role === 'owner' ? (
                  <>
                    <Button size="sm" onClick={copySignInLink}>
                      <Link2 size={16} /> Copy sign-in link
                    </Button>
                    <Link to="/team" className="btn sm">
                      Add the team
                    </Link>
                  </>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const { signOutCloud } = await import('../../sync/cloud');
                    await signOutCloud();
                  }}
                >
                  <LogOut size={16} /> Sign out
                </Button>
              </div>
              {sync.access.role === 'owner' ? (
                <details className="disclosure">
                  <summary className="small strong">
                    Optional: show Sign in at the app’s own address on any device {builtInCloud() ? <Badge tone="good">On</Badge> : null}
                  </summary>
                  <div className="stack tight">
                    <p className="small muted">The team sign-in link already works. With one GitHub setting, the plain address (jaderans.github.io/jworks_studio) also opens Sign in on a new phone or laptop, so nobody needs the link at all.</p>
                    <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                      <li>Press <b>Copy for GitHub</b>.</li>
                      <li>
                        On GitHub, open the <b>jworks_studio</b> repository → <b>Settings → Secrets and variables → Actions → Variables → New repository variable</b>. Name: <span className="mono">STUDIO_CLOUD</span>. Paste the value, then <b>Add variable</b>.
                      </li>
                      <li>
                        <b>Actions → Deploy to GitHub Pages → Run workflow</b>. When it finishes, reload the app.
                      </li>
                    </ol>
                    <div>
                      <Button size="sm" onClick={copyForGitHub}>
                        <Copy size={16} /> Copy for GitHub
                      </Button>
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <>
              {sync.state === 'error' ? <Callout tone="bad">{sync.message}</Callout> : <p className="sub">{owner ? 'Sign in with the owner account. The first time, create it with the email you want the team to know you by.' : 'Sign in with your email and password (new here: the temporary password from the owner’s message).'}</p>}
              <AuthForm allowCreate={owner} />
              {owner ? (
                <p className="tiny muted">
                  Set up the owner account with Google before?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={async () => {
                      const { signInWithGoogle } = await import('../../sync/cloud');
                      await signInWithGoogle().catch((e) => app.toast(e instanceof Error ? e.message : 'Google sign-in didn’t work', { tone: 'bad' }));
                    }}
                  >
                    Continue with Google
                  </button>
                </p>
              ) : null}
            </>
          )}
          {owner ? (
            <div className="row wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!(await app.confirm({ title: 'Stop syncing on this device?', message: 'This device keeps its data and keeps working offline. Cloud data isn’t deleted.', confirmLabel: 'Disconnect' }))) return;
                  const { disconnectCloud } = await import('../../sync/cloud');
                  await disconnectCloud();
                }}
              >
                <Unplug size={16} /> Disconnect this device
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (await copy(rulesText)) app.toast('Rules copied', { tone: 'good' });
                }}
              >
                <Copy size={16} /> Copy the security rules
              </Button>
            </div>
          ) : null}
          <p className="muted tiny">The Claude API key and assistant chats stay on the device. Everything else syncs.</p>
        </div>
      )}
    </section>
  );
}

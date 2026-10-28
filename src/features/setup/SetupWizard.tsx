import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileUp, Megaphone, Users } from 'lucide-react';
import logo from '../../assets/brand/logo-128.png';
import { Button, Callout } from '../../components/ui';
import { Check, Field, TextInput } from '../../components/form';
import { runRestoreSetup, runSetup } from '../../services/setup';
import { parseBackup, type BackupFile } from '../../services/backup';
import { readFileAsText } from '../../lib/files';
import { useApp } from '../../app/AppContext';
import { setLanding } from '../../app/landing';
import { linkRoute } from '../../sync/config';
import { ImportSection } from '../settings/ImportSection';

type Step = 'welcome' | 'business' | 'import' | 'join' | 'restore';

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [businessName, setBusinessName] = useState('JoshWorks');
  const [ownerName, setOwnerName] = useState('');
  const [ownerRole, setOwnerRole] = useState('Creative Director · Brand, Logo & Shirt Design');
  const [deviceName, setDeviceName] = useState('Studio laptop');
  const [pin, setPin] = useState('');
  const [seedPackages, setSeedPackages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await runSetup({ businessName, ownerName, ownerRole, pin, deviceName, seedPackages });
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* not supported */
      }
      await app.refreshDevice();
      setStep('import');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const finish = (to = '/') => {
    setLanding(to);
    onDone();
  };

  return (
    <div className="main" style={{ gridRow: 'auto', minHeight: '100%' }}>
      <div className="page narrow" style={{ paddingTop: 40 }}>
        <div className="row" style={{ gap: 14 }}>
          <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 14 }} />
          <div>
            <span className="eyebrow">Welcome</span>
            <h1>JoshWorks Studio</h1>
          </div>
        </div>

        {step === 'welcome' ? (
          <div className="stack">
            <p className="muted">Run the studio in one place: jobs and deadlines, clients, quotes, contracts and invoices on the JoshWorks letterhead, payments and designer payouts, BIR, and the content calendar. It works offline and syncs the team when you turn it on.</p>
            <div className="grid-2">
              <button type="button" className="card pad-lg" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setStep('business')}>
                <Megaphone size={28} className="teal" />
                <h2>Set it up</h2>
                <p className="muted">I’m the owner and this is my main device.</p>
              </button>
              <button type="button" className="card pad-lg" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setStep('join')}>
                <Users size={28} className="teal" />
                <h2>Team member? Sign in</h2>
                <p className="muted">I’m on the JoshWorks team and have my email and password.</p>
              </button>
            </div>
            <Button variant="link" onClick={() => setStep('restore')}>
              Restore from a backup file instead
            </Button>
          </div>
        ) : null}

        {step === 'business' ? (
          <div className="card pad-lg stack">
            <h2>About you</h2>
            <div className="form-grid">
              <Field label="Business name" htmlFor="sw-biz">
                <TextInput id="sw-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </Field>
              <Field label="Your name" htmlFor="sw-owner" hint="If you’re on the planner’s team list (e.g. Joshua), use the same name.">
                <TextInput id="sw-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Joshua" autoFocus />
              </Field>
              <Field label="What you do" htmlFor="sw-role">
                <TextInput id="sw-role" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)} />
              </Field>
              <Field label="This device" htmlFor="sw-dev">
                <TextInput id="sw-dev" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
              </Field>
              <Field label="Owner PIN (optional)" htmlFor="sw-pin" hint="For a computer the team shares.">
                <TextInput id="sw-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
              </Field>
            </div>
            <Check id="sw-pkg" checked={seedPackages} onChange={setSeedPackages} label="Add starter SMM packages and design prices" sub="Starter ₱4,500, Growth ₱7,500 and Plus ₱12,000 a month, plus add-ons and design services. All editable." />
            {error ? <Callout tone="bad">{error}</Callout> : null}
            <div className="actions">
              <Button onClick={() => setStep('welcome')}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button variant="primary" disabled={busy || !ownerName.trim()} onClick={create}>
                Continue <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'import' ? (
          <div className="card pad-lg stack">
            <h2>Bring in your content planner</h2>
            <p className="muted">Import the Google Sheets planner (download it as .xlsx). Rows you’ve already posted are skipped, and everything not posted yet can restart from a date you choose. You can also do this later in Settings.</p>
            <ImportSection compact onDone={() => finish('/calendar')} />
            <div className="actions">
              <Button variant="ghost" onClick={() => finish('/')}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'join' ? (
          <div className="card pad-lg stack">
            <h2>Sign in to the team</h2>
            <p className="muted">Open the team’s sign-in link on this device (the owner pins it in the team chat, and it’s in the message with your temporary password). Or paste it here:</p>
            <form
              className="row wrap"
              style={{ alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                const route = linkRoute(pasted);
                if (route) window.location.hash = route;
                else setPasteError('That doesn’t look like the JoshWorks sign-in link. Copy the whole link and try again.');
              }}
            >
              <Field label="Sign-in link" htmlFor="sw-link" className="grow" error={pasteError || undefined}>
                <TextInput id="sw-link" value={pasted} placeholder="https://jaderans.github.io/jworks_studio/#/login?i=…" onChange={(e) => { setPasted(e.target.value); setPasteError(''); }} />
              </Field>
              <Button type="submit" variant="primary" disabled={!pasted.trim()}>
                Continue
              </Button>
            </form>
            <Callout tone="info">No link yet? Ask the owner: it’s on the Team page under “Copy sign-in link”. After you sign in once, this device remembers you.</Callout>
            <div>
              <Button onClick={() => setStep('welcome')}>
                <ArrowLeft size={16} /> Back
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'restore' ? (
          <div className="card pad-lg stack">
            <h2>Restore from a backup</h2>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setError('');
                try {
                  setBackup(parseBackup(await readFileAsText(f)));
                } catch (err) {
                  setBackup(null);
                  setError(err instanceof Error ? err.message : 'That file could not be read.');
                }
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp size={16} /> {backup ? 'Choose another file' : 'Choose the backup file'}
            </Button>
            {backup ? <Callout tone="good">Backup from {backup.device?.name ?? 'another device'}, {new Date(backup.exportedAt).toLocaleString('en-PH')}.</Callout> : null}
            {error ? <Callout tone="bad">{error}</Callout> : null}
            <div className="actions">
              <Button onClick={() => setStep('welcome')}>
                <ArrowLeft size={16} /> Back
              </Button>
              <Button
                variant="primary"
                disabled={!backup || busy}
                onClick={async () => {
                  if (!backup) return;
                  setBusy(true);
                  try {
                    await runRestoreSetup(backup, deviceName);
                    await app.refreshDevice();
                    finish('/');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'The restore failed.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

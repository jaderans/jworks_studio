import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Download, FileSpreadsheet, Lock, Megaphone, Palette, Plus, RefreshCw, Smartphone, Store, Trash2, Upload, CalendarRange, ListChecks } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { applyUpdate, checkForUpdate, usePwaUpdateReady } from '../../app/usePwa';
import { APP_VERSION } from '../../app/version';
import { Button, Callout, PageHeader, Toggle } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { useSettingRows } from '../../hooks/data';
import { setSetting, settingValue, DEFAULT_VOICE } from '../../db/settings';
import { DEFAULT_CADENCE, DEFAULT_FRIDAY_ROTATION } from '../../domain/calendar';
import { DEFAULT_CHECKLIST } from '../../domain/checklist';
import { PLATFORMS, PLATFORM_ORDER } from '../../domain/platforms';
import { backupBlob, backupFileName, exportAll, mergeBackup, parseBackup } from '../../services/backup';
import { setOwnerPin } from '../../services/team';
import { downloadBlob, readFileAsText } from '../../lib/files';
import { DOW_NAMES, fmtDateTime } from '../../lib/time';
import { ImportSection } from './ImportSection';
import { TrackerImport } from './TrackerImport';
import { CloudSection } from './CloudSection';
import { AiSection } from './AiSection';
import { BirSection, EmailSection, MoneySection, PayMethodsSection } from './StudioSections';
import type { BrandVoice, BusinessSettings, CadenceSettings, ChecklistItem, PlatformKey } from '../../db/types';

export default function SettingsPage() {
  const app = useApp();
  const location = useLocation();
  const owner = app.can('settings');
  useEffect(() => {
    if (!location.hash) return;
    const t = window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => window.clearTimeout(t);
  }, [location.hash]);
  return (
    <div className="page narrow">
      <PageHeader title="Settings" subtitle={owner ? 'Your business, money, email, content rhythm and the team’s connections.' : 'This device’s connections. The owner manages the rest.'} />
      {owner ? <BusinessSection /> : null}
      {owner ? <MoneySection /> : null}
      {owner ? <PayMethodsSection /> : null}
      {owner ? <EmailSection /> : null}
      {owner ? <BirSection /> : null}
      {owner ? <VoiceSection /> : null}
      {owner ? <RhythmSection /> : null}
      {owner ? <ChecklistSection /> : null}
      <AiSection />
      {app.can('import') ? (
        <section id="s-tracker" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
          <h2 className="row" style={{ gap: 8 }}>
            <FileSpreadsheet size={22} className="teal" /> Import the commission tracker
          </h2>
          <TrackerImport />
        </section>
      ) : null}
      {app.can('import') ? (
        <section id="s-import" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
          <h2 className="row" style={{ gap: 8 }}>
            <FileSpreadsheet size={22} className="teal" /> Import the content planner
          </h2>
          <ImportSection />
        </section>
      ) : null}
      <CloudSection />
      {owner ? <BackupSection /> : null}
      {owner ? <PinSection /> : null}
      <InstallSection />
    </div>
  );
}

function useDraft<T>(value: T): [T, (v: T) => void, boolean, () => void] {
  const [draft, setDraft] = useState<T | null>(null);
  return [draft ?? value, (v: T) => setDraft(v), draft !== null, () => setDraft(null)];
}

function BusinessSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'business');
  const [b, setB, dirty, reset] = useDraft<BusinessSettings>(stored);
  const field = (k: keyof BusinessSettings, label: string, hint?: string) => (
    <Field label={label} htmlFor={`bz-${k}`} hint={hint}>
      <TextInput id={`bz-${k}`} value={String(b[k] ?? '')} onChange={(e) => setB({ ...b, [k]: e.target.value })} />
    </Field>
  );
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <Store size={22} className="teal" /> Business
      </h2>
      <div className="form-grid">
        {field('name', 'Business name')}
        {field('tagline', 'Tagline')}
        {field('registration', 'Registration', 'e.g. DTI Business Name No. 1234567')}
        {field('address', 'Address')}
        {field('contact', 'Phone')}
        {field('email', 'Email')}
        {field('website', 'Website')}
        {field('signatory', 'Signs documents as', 'e.g. Joshua Ranin, Head Designer')}
      </div>
      <Field label="Our pages" hint="Handles or links; used in reports and by the assistant.">
        <div className="form-grid">
          {PLATFORM_ORDER.slice(0, 6).map((k) => (
            <label key={k} className="affix text">
              <span>{PLATFORMS[k].label}</span>
              <input placeholder="@handle or link" value={b.handles[k] ?? ''} onChange={(e) => setB({ ...b, handles: { ...b.handles, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      </Field>
      <Field label="Payment note (fallback)" htmlFor="bz-pay" hint="Printed only when no payment method below is turned on.">
        <TextArea id="bz-pay" rows={2} value={b.paymentDetails} onChange={(e) => setB({ ...b, paymentDetails: e.target.value })} />
      </Field>
      <div className="actions">
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={async () => {
            await setSetting('business', b);
            reset();
            app.toast('Saved', { tone: 'good' });
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}

function VoiceSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'voice');
  const [v, setV, dirty, reset] = useDraft<BrandVoice>(stored);
  const area = (k: keyof BrandVoice, label: string, hint?: string) => (
    <Field label={label} htmlFor={`bv-${k}`} hint={hint}>
      <TextArea id={`bv-${k}`} rows={2} value={String(v[k] ?? '')} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <Megaphone size={22} className="teal" /> Brand voice
      </h2>
      <p className="sub">The assistant writes like this, and it’s a guide for anyone writing captions.</p>
      {area('tone', 'Tone')}
      {area('audience', 'Who we talk to')}
      {area('doSay', 'Always')}
      {area('dontSay', 'Never')}
      <div className="form-grid">
        <Field label="Emoji" htmlFor="bv-emoji">
          <Select id="bv-emoji" value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value as BrandVoice['emoji'] })}>
            <option value="none">None</option>
            <option value="light">A few</option>
            <option value="expressive">Expressive</option>
          </Select>
        </Field>
        <Field label="Language" htmlFor="bv-lang">
          <TextInput id="bv-lang" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value })} />
        </Field>
        <Field label="Default call to action" htmlFor="bv-cta" className="span-2">
          <TextInput id="bv-cta" value={v.defaultCta} onChange={(e) => setV({ ...v, defaultCta: e.target.value })} />
        </Field>
        <Field label="Base hashtags" htmlFor="bv-tags" className="span-2" hint="Instagram takes 5 in total.">
          <TextInput id="bv-tags" value={v.baseHashtags} onChange={(e) => setV({ ...v, baseHashtags: e.target.value })} />
        </Field>
      </div>
      <Toggle id="bv-bold" checked={v.boldHeadline} onChange={(x) => setV({ ...v, boldHeadline: x })} label="We style the first line of captions in Unicode bold" />
      <div className="actions">
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={async () => {
            await setSetting('voice', v);
            reset();
            app.toast('Saved', { tone: 'good' });
          }}
        >
          Save
        </Button>
        <Button variant="ghost" onClick={() => setV(DEFAULT_VOICE)}>
          Back to the original
        </Button>
      </div>
    </section>
  );
}

function RhythmSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'cadence');
  const [c, setC, dirty, reset] = useDraft<CadenceSettings>(stored);
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <CalendarRange size={22} className="teal" /> Content rhythm
      </h2>
      <div className="stack">
        {c.themes.map((t, i) => (
          <div key={t.key} className="card" style={{ padding: '10px 12px' }}>
            <div className="row wrap between">
              <b>{DOW_NAMES[t.dow]}</b>
              <Toggle id={`th-${t.key}`} checked={t.active} onChange={(v) => setC({ ...c, themes: c.themes.map((x, j) => (j === i ? { ...x, active: v } : x)) })} label="On" />
            </div>
            <div className="form-grid">
              <Field label="Theme" htmlFor={`th-n-${t.key}`}>
                <TextInput id={`th-n-${t.key}`} value={t.name} onChange={(e) => setC({ ...c, themes: c.themes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              </Field>
              <Field label="Short label" htmlFor={`th-s-${t.key}`}>
                <TextInput id={`th-s-${t.key}`} value={t.short} onChange={(e) => setC({ ...c, themes: c.themes.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)) })} />
              </Field>
              <Field label="What it’s for" htmlFor={`th-d-${t.key}`} className="span-2">
                <TextArea id={`th-d-${t.key}`} rows={2} value={t.description} onChange={(e) => setC({ ...c, themes: c.themes.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              </Field>
            </div>
          </div>
        ))}
        <Field label="Friday rotation (weeks 1–4)" htmlFor="rh-fri">
          <TextInput id="rh-fri" value={c.fridayRotation.join(', ')} onChange={(e) => setC({ ...c, fridayRotation: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder={DEFAULT_FRIDAY_ROTATION.join(', ')} />
        </Field>
        <Toggle id="rh-break" checked={c.breakRule} onChange={(v) => setC({ ...c, breakRule: v })} label="Break week: the week starting on each month’s last Monday" />
        <Toggle id="rh-hol" checked={c.skipHolidays !== false} onChange={(v) => setC({ ...c, skipHolidays: v })} label="Leave Philippine public holidays free when planning" />
        <div className="form-grid">
          <Field label="Posting restarts on" htmlFor="rh-resume" hint="While this is ahead, the dashboard counts down and shows what to batch.">
            <input id="rh-resume" type="date" className="input" value={c.resumeOn} onChange={(e) => setC({ ...c, resumeOn: e.target.value })} />
          </Field>
          <Field label="Default platforms for new posts">
            <div className="chip-row">
              {PLATFORM_ORDER.slice(0, 7).map((k) => {
                const on = c.platforms.includes(k);
                return (
                  <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => setC({ ...c, platforms: on ? c.platforms.filter((x) => x !== k) : [...c.platforms, k] })}>
                    {PLATFORMS[k].short}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <Field label="Usual posting times">
          <div className="form-grid">
            {(['facebook', 'instagram', 'tiktok', 'threads'] as PlatformKey[]).map((k) => (
              <label key={k} className="row small" style={{ gap: 8 }}>
                <span style={{ width: 80 }}>{PLATFORMS[k].label}</span>
                <input type="time" className="input" value={c.defaultTimes[k] ?? ''} onChange={(e) => setC({ ...c, defaultTimes: { ...c.defaultTimes, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="actions">
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={async () => {
            await setSetting('cadence', c);
            reset();
            app.toast('Saved', { tone: 'good' });
          }}
        >
          Save
        </Button>
        <Button variant="ghost" onClick={() => setC({ ...DEFAULT_CADENCE, resumeOn: c.resumeOn })}>
          Back to the planner’s rhythm
        </Button>
      </div>
    </section>
  );
}

function ChecklistSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'checklist');
  const [items, setItems, dirty, reset] = useDraft<ChecklistItem[]>(stored);
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <ListChecks size={22} className="teal" /> Premium check
      </h2>
      <p className="sub">What every post is checked against before it’s marked Ready.</p>
      {items.map((it, i) => (
        <div key={it.id} className="row top" style={{ gap: 8 }}>
          <input type="checkbox" aria-label={`Use “${it.label}”`} checked={it.on} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} style={{ marginTop: 14 }} />
          <div className="grow stack tight">
            <TextInput aria-label="Check" value={it.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <TextInput aria-label="Hint" value={it.hint} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} />
          </div>
          <button type="button" className="icon-btn plain sm" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ marginTop: 6 }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="actions">
        <Button size="sm" onClick={() => setItems([...items, { id: `custom-${Date.now()}`, label: 'New check', hint: '', on: true }])}>
          <Plus size={16} /> Add a check
        </Button>
        <span className="grow" />
        <Button variant="ghost" onClick={() => setItems(DEFAULT_CHECKLIST)}>
          Back to the original
        </Button>
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={async () => {
            await setSetting('checklist', items);
            reset();
            app.toast('Saved', { tone: 'good' });
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}

function BackupSection() {
  const app = useApp();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <Download size={22} className="teal" /> Backups
      </h2>
      <p className="sub">A file with everything (posts, ideas, clients, proposals, contracts, results). Keep one in Google Drive; restoring or merging never duplicates anything.</p>
      <div className="actions">
        <Button
          onClick={async () => {
            const f = await exportAll();
            downloadBlob(backupBlob(f), backupFileName(f));
          }}
        >
          <Download size={16} /> Download a backup
        </Button>
        <Button onClick={() => input.current?.click()}>
          <Upload size={16} /> Merge a backup
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const file = parseBackup(await readFileAsText(f));
              if (!(await app.confirm({ title: 'Merge this backup?', message: 'Newer copies win; nothing is duplicated or deleted.', confirmLabel: 'Merge' }))) return;
              const s = await mergeBackup(file);
              app.toast(`Merged: ${s.added} new, ${s.updated} updated`, { tone: 'good' });
            } catch (err) {
              app.toast(err instanceof Error ? err.message : 'That file could not be read', { tone: 'bad' });
            }
          }}
        />
      </div>
    </section>
  );
}

function PinSection() {
  const app = useApp();
  const has = !!settingValue(useSettingRows(), 'security').pinHash;
  const [pin, setPin] = useState('');
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <Lock size={22} className="teal" /> Owner PIN
      </h2>
      <p className="sub">For a shared studio computer: switching back to the owner, or changing rates, asks for this PIN. With cloud sync, each person’s own account already limits what they see.</p>
      <div className="row wrap">
        <TextInput aria-label="New PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4–8 digits" style={{ maxWidth: 180 }} />
        <Button
          variant="primary"
          disabled={pin.length < 4}
          onClick={async () => {
            if (has && !(await app.askOwner('Change the owner PIN'))) return;
            await setOwnerPin(pin);
            setPin('');
            app.toast('PIN saved', { tone: 'good' });
          }}
        >
          {has ? 'Change PIN' : 'Set PIN'}
        </Button>
        {has ? (
          <Button
            variant="ghost"
            onClick={async () => {
              if (!(await app.askOwner('Remove the owner PIN'))) return;
              await setOwnerPin(null);
              app.toast('PIN removed');
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** Which build this device runs, and a way to fetch the newest one now. */
function UpdateCheck() {
  const app = useApp();
  const ready = usePwaUpdateReady();
  const [busy, setBusy] = useState(false);
  const built = APP_VERSION.built ? fmtDateTime(Date.parse(APP_VERSION.built)) : 'this computer';
  return (
    <div className="row wrap between" style={{ gap: 8 }}>
      <span className="small muted">
        Version <b className="mono">{APP_VERSION.commit}</b> · built {built}
      </span>
      {ready ? (
        <Button size="sm" variant="primary" onClick={applyUpdate}>
          <RefreshCw size={15} /> Reload to update
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const found = await checkForUpdate();
            setBusy(false);
            if (!found) app.toast('You’re on the latest version.', { tone: 'good' });
          }}
        >
          <RefreshCw size={15} /> {busy ? 'Checking…' : 'Check for updates'}
        </Button>
      )}
    </div>
  );
}

function InstallSection() {
  return (
    <section className="card pad-lg">
      <h2 className="row" style={{ gap: 8 }}>
        <Smartphone size={22} className="teal" /> Install on phones and laptops
      </h2>
      <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>
          <b>Android (Chrome):</b> menu ⋮ → Install app (or Add to Home screen).
        </li>
        <li>
          <b>iPhone (Safari):</b> Share → Add to Home Screen.
        </li>
        <li>
          <b>Laptop (Chrome or Edge):</b> the install icon at the right of the address bar.
        </li>
      </ul>
      <Callout tone="info">It works offline once installed. When a new version arrives, “Update ready” shows at the top until you reload; it also updates by itself while the app sits in the background.</Callout>
      <UpdateCheck />
      <p className="tiny muted">
        <Palette size={12} /> Light, dark or auto: profile menu at the top right.
      </p>
    </section>
  );
}

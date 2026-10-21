import { useState } from 'react';
import { Landmark, Mail, Plus, QrCode, Send, Trash2, Upload, Wallet } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout, IconButton, Toggle } from '../../components/ui';
import { Field, MoneyInput, NumberInput, TextArea, TextInput } from '../../components/form';
import { useSettingRows } from '../../hooks/data';
import { setSetting, settingValue } from '../../db/settings';
import { formatInvoiceNo } from '../../domain/money';
import { emailReady, sendEmail } from '../../email/send';
import { testEmail } from '../../email/templates';
import { CatalogBanner } from '../docs/CatalogBanner';
import { compressImage, readFileAsDataURL } from '../../lib/files';
import { peso } from '../../lib/money';
import { fmtMonth, todayISO } from '../../lib/time';
import type { BirSettings, EmailSettings, MoneySettings, MonthlyTarget, StudioPayMethod } from '../../db/types';

function useDraft<T>(value: T): [T, (v: T) => void, boolean, () => void] {
  const [draft, setDraft] = useState<T | null>(null);
  return [draft ?? value, (v: T) => setDraft(v), draft !== null, () => setDraft(null)];
}

function SaveRow({ dirty, onSave, onReset }: { dirty: boolean; onSave: () => Promise<void>; onReset: () => void }) {
  return (
    <div className="actions">
      <Button variant="primary" disabled={!dirty} onClick={onSave}>
        Save
      </Button>
      {dirty ? (
        <Button variant="ghost" onClick={onReset}>
          Undo changes
        </Button>
      ) : null}
    </div>
  );
}

/** Invoice numbers, the deduction, payment terms and the monthly targets. */
export function MoneySection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'money');
  const [m, setM, dirty, reset] = useDraft<MoneySettings>(stored);
  const year = Number(todayISO().slice(0, 4));
  const setTarget = (i: number, t: Partial<MonthlyTarget>) => setM({ ...m, targets: m.targets.map((x, j) => (j === i ? { ...x, ...t } : x)) });
  return (
    <section id="s-money" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
      <h2 className="row" style={{ gap: 8 }}>
        <Wallet size={22} className="teal" /> Money
      </h2>
      <CatalogBanner />
      <div className="form-grid">
        <Field label="Deduction before the team split" htmlFor="mn-ded" hint="Comes off each payment first (processing and the tax pool).">
          <NumberInput id="mn-ded" value={m.deductionPct} suffix="%" min={0} onChange={(v) => setM({ ...m, deductionPct: v ?? 0 })} />
        </Field>
        <Field label="Down payment on signing" htmlFor="mn-down">
          <NumberInput id="mn-down" value={m.downPct} suffix="%" decimals={false} min={0} onChange={(v) => setM({ ...m, downPct: v ?? 0 })} />
        </Field>
        <Field label="Invoice prefix" htmlFor="mn-pre" hint={`Next invoice: ${formatInvoiceNo(m.invoicePrefix, m.invoiceNext, year)}`}>
          <TextInput id="mn-pre" value={m.invoicePrefix} onChange={(e) => setM({ ...m, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
        </Field>
        <Field label="Next invoice number" htmlFor="mn-next" hint="The app also skips past any number already used.">
          <NumberInput id="mn-next" value={m.invoiceNext} decimals={false} min={1} onChange={(v) => setM({ ...m, invoiceNext: Math.max(1, v ?? 1) })} />
        </Field>
        <Field label="Next receipt number" htmlFor="mn-rec" hint={`Next receipt: ${formatInvoiceNo('AR', m.receiptNext, year)}`}>
          <NumberInput id="mn-rec" value={m.receiptNext} decimals={false} min={1} onChange={(v) => setM({ ...m, receiptNext: Math.max(1, v ?? 1) })} />
        </Field>
        <Field label="Invoices are due after" htmlFor="mn-days">
          <NumberInput id="mn-days" value={m.invoiceDays} suffix="days" decimals={false} min={0} onChange={(v) => setM({ ...m, invoiceDays: v ?? 0 })} />
        </Field>
        <Field label="A big project is at least" htmlFor="mn-big">
          <MoneyInput id="mn-big" value={m.bigProject} onChange={(v) => setM({ ...m, bigProject: v ?? 0 })} />
        </Field>
        <Field label="Expense categories" htmlFor="mn-cats" hint="Separate with commas.">
          <TextInput id="mn-cats" value={m.expenseCategories.join(', ')} onChange={(e) => setM({ ...m, expenseCategories: e.target.value.split(',').map((x) => x.trimStart()) })} />
        </Field>
      </div>
      <Field label="Notes & terms on every invoice" htmlFor="mn-notes" hint="One per line.">
        <TextArea id="mn-notes" rows={4} value={m.invoiceNotes.join('\n')} onChange={(e) => setM({ ...m, invoiceNotes: e.target.value.split('\n') })} />
      </Field>
      <section className="stack tight">
        <div className="row between wrap">
          <h3>Monthly targets</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const last = [...m.targets].sort((a, b) => a.month.localeCompare(b.month)).pop();
              const base = last ? last.month : todayISO().slice(0, 7);
              const [y, mo] = base.split('-').map(Number);
              const next = last ? `${mo === 12 ? y + 1 : y}-${String((mo % 12) + 1).padStart(2, '0')}` : base;
              setM({ ...m, targets: [...m.targets, { month: next, low: last?.low ?? 0, high: last?.high ?? 0 }] });
            }}
          >
            <Plus size={16} /> Add a month
          </Button>
        </div>
        <p className="muted small">The dashboard and reports compare money received each month with these.</p>
        {m.targets.length === 0 ? <p className="muted small">No targets yet.</p> : null}
        <div className="stack tight">
          {m.targets.map((t, i) => (
            <div key={i} className="target-row">
              <input type="month" className="input" aria-label="Month" value={t.month} onChange={(e) => setTarget(i, { month: e.target.value })} />
              <div>
                <MoneyInput ariaLabel={`Target for ${t.month ? fmtMonth(t.month) : 'the month'}`} value={t.low} onChange={(v) => setTarget(i, { low: v ?? 0 })} />
              </div>
              <span className="muted small">to</span>
              <div>
                <MoneyInput ariaLabel="Stretch target" value={t.high} onChange={(v) => setTarget(i, { high: v ?? 0 })} />
              </div>
              <IconButton label="Remove month" size="sm" plain onClick={() => setM({ ...m, targets: m.targets.filter((_, j) => j !== i) })}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      </section>
      <SaveRow
        dirty={dirty}
        onReset={reset}
        onSave={async () => {
          await setSetting('money', {
            ...m,
            expenseCategories: m.expenseCategories.map((x) => x.trim()).filter(Boolean),
            invoiceNotes: m.invoiceNotes.map((x) => x.trim()).filter(Boolean),
            targets: m.targets.filter((t) => /^\d{4}-\d{2}$/.test(t.month)).sort((a, b) => a.month.localeCompare(b.month)),
          });
          reset();
          app.toast('Saved', { tone: 'good' });
        }}
      />
    </section>
  );
}

/** Where clients send money: printed on invoices, contracts and emails. */
export function PayMethodsSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'payMethods');
  const [list, setList, dirty, reset] = useDraft<StudioPayMethod[]>(stored);
  const set = (i: number, p: Partial<StudioPayMethod>) => setList(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <section id="s-pay" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
      <h2 className="row" style={{ gap: 8 }}>
        <QrCode size={22} className="teal" /> How clients pay you
      </h2>
      <p className="muted small">Shown under “Payment details” on invoices and contracts, and under “Where to pay” in emails. Only owners and managers can see these.</p>
      <div className="stack">
        {list.map((pm, i) => (
          <div key={pm.id} className="card stack tight" style={{ background: 'var(--surface-2)' }}>
            <div className="row between wrap">
              <Toggle id={`pm-on-${pm.id}`} checked={pm.on} onChange={(v) => set(i, { on: v })} label={<b>{pm.label || 'Payment method'}</b>} />
              <IconButton label={`Remove ${pm.label}`} size="sm" plain onClick={() => setList(list.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
            <div className="form-grid">
              <Field label="Method" htmlFor={`pm-l-${pm.id}`}>
                <TextInput id={`pm-l-${pm.id}`} value={pm.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="GCash, BPI, MariBank…" />
              </Field>
              <Field label="Account name" htmlFor={`pm-n-${pm.id}`}>
                <TextInput id={`pm-n-${pm.id}`} value={pm.accountName} onChange={(e) => set(i, { accountName: e.target.value })} />
              </Field>
              <Field label="Account or mobile number" htmlFor={`pm-a-${pm.id}`} className="span-2">
                <TextInput id={`pm-a-${pm.id}`} value={pm.accountNumber} onChange={(e) => set(i, { accountNumber: e.target.value })} inputMode="numeric" />
              </Field>
            </div>
            <div className="row wrap">
              {pm.qrImage ? <img src={pm.qrImage} alt={`${pm.label} QR code`} className="qr-preview sm" /> : null}
              <label className="btn sm">
                <Upload size={15} /> {pm.qrImage ? 'Replace QR code' : 'Upload a QR code'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const small = await compressImage(file, 512, 1, 'image/png');
                    set(i, { qrImage: await readFileAsDataURL(small) });
                  }}
                />
              </label>
              {pm.qrImage ? (
                <Button size="sm" variant="ghost" onClick={() => set(i, { qrImage: '' })}>
                  Remove QR
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="row wrap">
        <Button size="sm" variant="ghost" onClick={() => setList([...list, { id: `pm-${Date.now().toString(36)}`, label: '', accountName: '', accountNumber: '', qrImage: '', on: true }])}>
          <Plus size={16} /> Add a payment method
        </Button>
      </div>
      <SaveRow
        dirty={dirty}
        onReset={reset}
        onSave={async () => {
          await setSetting('payMethods', list.filter((x) => x.label.trim()));
          reset();
          app.toast('Saved', { tone: 'good' });
        }}
      />
    </section>
  );
}

/** The 8% income tax option and the non-VAT ceiling. */
export function BirSection() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'bir');
  const [b, setB, dirty, reset] = useDraft<BirSettings>(stored);
  return (
    <section id="s-bir" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
      <h2 className="row" style={{ gap: 8 }}>
        <Landmark size={22} className="teal" /> BIR
      </h2>
      <div className="form-grid">
        <Field label="Registered on" htmlFor="bir-start" hint="Payments from this day count as receipts.">
          <input id="bir-start" type="date" className="input" value={b.startDate} onChange={(e) => setB({ ...b, startDate: e.target.value })} />
        </Field>
        <Field label="Income tax">
          <Toggle id="bir-8" checked={b.eightPct} onChange={(v) => setB({ ...b, eightPct: v })} label="8% of gross receipts (instead of graduated rates)" />
        </Field>
        <Field label="Tax-free each year (8% option)" htmlFor="bir-ex">
          <MoneyInput id="bir-ex" value={b.exemption} onChange={(v) => setB({ ...b, exemption: v ?? 0 })} />
        </Field>
        <Field label="Non-VAT ceiling (12 months)" htmlFor="bir-vat">
          <MoneyInput id="bir-vat" value={b.vatCeiling} onChange={(v) => setB({ ...b, vatCeiling: v ?? 0 })} />
        </Field>
      </div>
      <p className="tiny muted">
        Estimates for planning: 8% of receipts above {peso(b.exemption)} a year, less tax clients withheld (Form 2307). Check returns with an accountant before filing.
      </p>
      <SaveRow
        dirty={dirty}
        onReset={reset}
        onSave={async () => {
          await setSetting('bir', b);
          reset();
          app.toast('Saved', { tone: 'good' });
        }}
      />
    </section>
  );
}

/** EmailJS keys, so invoices, receipts and invites go out from the studio Gmail. */
export function EmailSection() {
  const app = useApp();
  const rows = useSettingRows();
  const stored = settingValue(rows, 'email');
  const business = settingValue(rows, 'business');
  const methods = settingValue(rows, 'payMethods');
  const [e, setE, dirty, reset] = useDraft<EmailSettings>(stored);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = emailReady(e);
  const field = (k: keyof EmailSettings, label: string, hint?: string, placeholder?: string) => (
    <Field label={label} htmlFor={`em-${k}`} hint={hint}>
      <TextInput id={`em-${k}`} value={e[k]} placeholder={placeholder} autoComplete="off" spellCheck={false} onChange={(ev) => setE({ ...e, [k]: ev.target.value.trim() })} />
    </Field>
  );
  return (
    <section id="s-email" className="card pad-lg" style={{ scrollMarginTop: 80 }}>
      <h2 className="row" style={{ gap: 8 }}>
        <Mail size={22} className="teal" /> Email
      </h2>
      <p className="muted small">
        Invoices, payment reminders, receipts, quotes and team invites go out from the studio Gmail through EmailJS (free for 200 emails a month), in the JoshWorks design.
      </p>
      {!ready ? (
        <Callout tone="info" title="Set it up once (about 10 minutes)">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>Sign up at emailjs.com with the studio Gmail, then Email Services → Add → Gmail → connect {business.email || 'the studio Gmail'}.</li>
            <li>Email Templates → Create. Subject: <code>{'{{subject}}'}</code>. To email: <code>{'{{to_email}}'}</code>. From name: <code>{'{{from_name}}'}</code>. Reply to: <code>{'{{reply_to}}'}</code>. Bcc: <code>{'{{cc_email}}'}</code>.</li>
            <li>In the template’s content, switch to the code view and put only <code>{'{{{html}}}'}</code> (three braces).</li>
            <li>Copy the Service ID, Template ID and your Public key (Account → General) here. Full steps: docs/EMAIL_SETUP.md.</li>
          </ol>
        </Callout>
      ) : null}
      <div className="form-grid">
        {field('serviceId', 'Service ID', undefined, 'service_xxxxxxx')}
        {field('templateId', 'Template ID', undefined, 'template_xxxxxxx')}
        {field('publicKey', 'Public key', 'EmailJS → Account → General.')}
        {field('fromName', 'Sender name', 'What people see in their inbox.', 'JoshWorks Studio')}
        {field('replyTo', 'Replies go to', undefined, business.email)}
        {field('copyTo', 'Send me a copy at', 'Optional. A copy of every email (Bcc).')}
      </div>
      <SaveRow
        dirty={dirty}
        onReset={reset}
        onSave={async () => {
          await setSetting('email', e);
          reset();
          app.toast('Saved', { tone: 'good' });
        }}
      />
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <Field label="Send a test to" htmlFor="em-test" className="grow">
          <TextInput id="em-test" type="email" value={to} placeholder={business.email} onChange={(ev) => setTo(ev.target.value.trim())} />
        </Field>
        <Button
          variant="teal"
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const address = to || business.email;
              await sendEmail({ email: address, name: business.name }, testEmail(business, methods), { settings: e, what: 'a test email' });
              app.toast(`Test sent to ${address}. Check the inbox (and Spam, the first time).`, { tone: 'good' });
            } catch (err) {
              app.toast(err instanceof Error ? err.message : 'The test didn’t send', { tone: 'bad' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={16} /> {busy ? 'Sending…' : 'Send a test'}
        </Button>
      </div>
    </section>
  );
}

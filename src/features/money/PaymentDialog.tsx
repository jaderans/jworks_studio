import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/ui';
import { Field, MoneyInput, Select, TextInput } from '../../components/form';
import { useJobs } from '../../hooks/data';
import { PAY_METHODS } from '../../domain/money';
import { savePayment } from '../../services/money';
import { shareReceipt } from './share';
import { peso } from '../../lib/money';
import { todayISO } from '../../lib/time';
import type { PayMethod, Payment } from '../../db/types';

export interface PaymentPreset {
  jobId?: string | null;
  invoiceId?: string | null;
  clientId?: string | null;
  amount?: number;
  kind?: Payment['kind'];
}

/** Record money a client paid. It gets a receipt number, and the designers' shares follow. */
export function PaymentDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: PaymentPreset }) {
  const app = useApp();
  const jobs = useJobs() ?? [];
  const [p, setP] = useState<Partial<Payment> | null>(null);
  const [busy, setBusy] = useState(false);
  if (open && !p) setP({ jobId: preset?.jobId ?? null, invoiceId: preset?.invoiceId ?? null, clientId: preset?.clientId ?? null, amount: preset?.amount ?? 0, kind: preset?.kind ?? 'partial', date: todayISO(), method: 'GCash', reference: '', note: '' });
  if (!open && p) setP(null);
  if (!open || !p) return null;
  const job = jobs.find((j) => j.id === p.jobId);
  const save = async () => {
    if (!p.amount || !p.date) return;
    setBusy(true);
    try {
      const rec = await savePayment({ ...p, amount: p.amount, date: p.date, clientId: p.clientId ?? job?.clientId ?? null });
      app.toast(`Received ${peso(rec.amount)} · receipt ${rec.receiptNo}`, { tone: 'good', action: { label: 'Receipt', onClick: () => void shareReceipt(rec.id) } });
      onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not save the payment', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !p.amount} onClick={save}>
            Save the payment
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Job" htmlFor="pay-job" className="span-2">
          <Select id="pay-job" value={p.jobId ?? ''} onChange={(e) => setP({ ...p, jobId: e.target.value || null, clientId: jobs.find((j) => j.id === e.target.value)?.clientId ?? p.clientId })}>
            <option value="">Not for a job (e.g. a pop-up sale)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.number} · {j.title} {j.clientName ? `· ${j.clientName}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="pay-amount">
          <MoneyInput id="pay-amount" large value={p.amount ?? 0} onChange={(v) => setP({ ...p, amount: v ?? 0 })} autoFocus />
        </Field>
        <Field label="Date received" htmlFor="pay-date">
          <input id="pay-date" type="date" className="input" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} />
        </Field>
        <Field label="Paid by" htmlFor="pay-method">
          <Select id="pay-method" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value as PayMethod })}>
            {PAY_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Which payment" htmlFor="pay-kind">
          <Select id="pay-kind" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Payment['kind'] })}>
            <option value="down">Down payment</option>
            <option value="partial">Partial payment</option>
            <option value="final">Final payment</option>
            <option value="full">Full payment</option>
          </Select>
        </Field>
        <Field label="Reference no." htmlFor="pay-ref" hint="GCash or bank reference, so it’s easy to match." className="span-2">
          <TextInput id="pay-ref" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} />
        </Field>
        <Field label="Note" htmlFor="pay-note" className="span-2">
          <TextInput id="pay-note" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown, Mail, Plus, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { alive, db } from '../../db/db';
import { Dialog } from '../../components/Dialog';
import { Badge, Button, Callout, IconButton } from '../../components/ui';
import { Check, Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { useInvoices } from '../../hooks/data';
import { duplicateNumbers, invoiceTotals } from '../../domain/money';
import { deleteInvoice, saveInvoice } from '../../services/money';
import { peso } from '../../lib/money';
import { fmtIsoDate, todayISO } from '../../lib/time';
import { PaymentDialog } from './PaymentDialog';
import { emailInvoice, shareInvoice } from './share';
import type { Invoice } from '../../db/types';

const STATE_LABEL = { paid: 'Paid', partial: 'Partly paid', unpaid: 'Unpaid' } as const;

export function invoiceBadge(inv: Invoice, t: ReturnType<typeof invoiceTotals>) {
  if (inv.status === 'void') return <Badge>Void</Badge>;
  if (t.state === 'paid') return <Badge tone="good">Paid</Badge>;
  if (t.overdue) return <Badge tone="bad">Overdue</Badge>;
  if (inv.status === 'draft') return <Badge>Draft</Badge>;
  return <Badge tone="yellow">{STATE_LABEL[t.state]}</Badge>;
}

/** Edit an invoice: JoshWorks layout, totals and status worked out from the job's payments. */
export function InvoiceDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const invoices = useInvoices() ?? [];
  const stored = invoices.find((i) => i.id === id) ?? null;
  const [inv, setInv] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (stored && (!inv || inv.id !== stored.id)) setInv({ ...stored });
  if (!id && inv) setInv(null);
  const payments = useLiveQuery(async () => (inv?.jobId ? alive(await db.payments.where('jobId').equals(inv.jobId).toArray()) : []), [inv?.jobId]) ?? [];
  if (!id || !inv) return null;
  const t = invoiceTotals(inv, payments, todayISO());
  const isDupe = invoices.some((i) => i.id !== inv.id && i.status !== 'void' && duplicateNumbers([i.number, inv.number]).length > 0);
  const set = (patch: Partial<Invoice>) => setInv({ ...inv, ...patch });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await saveInvoice(inv);
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog
        open={!!id}
        onClose={onClose}
        size="xwide"
        fullPhone
        title={
          <span className="row wrap" style={{ gap: 8 }}>
            Invoice <span className="mono">{inv.number}</span> {invoiceBadge(inv, t)}
          </span>
        }
        footer={
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!(await app.confirm({ title: `Delete ${inv.number}?`, message: 'To keep the numbers in order, consider marking it Void instead.', confirmLabel: 'Delete', tone: 'danger' }))) return;
                await deleteInvoice(inv.id);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <span className="grow" />
            <Button disabled={!!busy} onClick={() => run('pdf', () => shareInvoice(inv.id))}>
              <FileDown size={16} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                run('email', async () => {
                  const to = await emailInvoice(inv.id, t.overdue ? 'reminder' : 'invoice');
                  app.toast(`${t.overdue ? 'Reminder' : 'Invoice'} emailed to ${to}`, { tone: 'good' });
                })
              }
            >
              <Mail size={16} /> {busy === 'email' ? 'Sending…' : t.overdue ? 'Email a reminder' : 'Email it'}
            </Button>
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                run('save', async () => {
                  app.toast('Saved', { tone: 'good' });
                  onClose();
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {isDupe ? <Callout tone="warn">Another invoice already uses {inv.number}. Give this one a different number.</Callout> : null}
        <div className="editor-grid">
          <div className="stack">
            <div className="form-grid">
              <Field label="Invoice no." htmlFor="iv-no">
                <TextInput id="iv-no" className="mono" value={inv.number} onChange={(e) => set({ number: e.target.value })} />
              </Field>
              <Field label="Status" htmlFor="iv-status" hint="Paid, partly paid and overdue follow the payments.">
                <Select id="iv-status" value={inv.status} onChange={(e) => set({ status: e.target.value as Invoice['status'] })}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="void">Void</option>
                </Select>
              </Field>
              <Field label="Invoice date" htmlFor="iv-date">
                <input id="iv-date" type="date" className="input" value={inv.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
              </Field>
              <Field label="Due date" htmlFor="iv-due">
                <input id="iv-due" type="date" className="input" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </Field>
            </div>
            <section className="stack tight">
              <h3>Bill to</h3>
              <div className="form-grid">
                <Field label="Client / organization" htmlFor="iv-bn">
                  <TextInput id="iv-bn" value={inv.billTo.name} onChange={(e) => set({ billTo: { ...inv.billTo, name: e.target.value } })} />
                </Field>
                <Field label="Contact person" htmlFor="iv-bc">
                  <TextInput id="iv-bc" value={inv.billTo.contact} onChange={(e) => set({ billTo: { ...inv.billTo, contact: e.target.value } })} />
                </Field>
                <Field label="Address" htmlFor="iv-ba">
                  <TextInput id="iv-ba" value={inv.billTo.address} onChange={(e) => set({ billTo: { ...inv.billTo, address: e.target.value } })} />
                </Field>
                <Field label="Email / phone" htmlFor="iv-be">
                  <TextInput id="iv-be" value={inv.billTo.emailPhone} onChange={(e) => set({ billTo: { ...inv.billTo, emailPhone: e.target.value } })} />
                </Field>
              </div>
            </section>
            <section className="stack tight">
              <div className="row between">
                <h3>Items & services</h3>
                <Button size="sm" variant="ghost" onClick={() => set({ items: [...inv.items, { label: '', qty: 1, amount: 0, addOn: false }] })}>
                  <Plus size={16} /> Add a line
                </Button>
              </div>
              {inv.items.length === 0 ? <p className="muted small">No lines yet.</p> : null}
              <div className="price-lines">
                {inv.items.map((it, i) => (
                  <div key={i} className="price-line">
                    <input className="input pl-label" aria-label="Design details / description" placeholder="Design details / description" value={it.label} onChange={(e) => set({ items: inv.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <div className="pl-qty">
                      <NumberInput ariaLabel="Qty" prefix="×" decimals={false} min={1} value={it.qty} onChange={(v) => set({ items: inv.items.map((x, j) => (j === i ? { ...x, qty: v ?? 1 } : x)) })} />
                    </div>
                    <div className="pl-price">
                      <MoneyInput ariaLabel="Amount" value={it.amount} onChange={(v) => set({ items: inv.items.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)) })} />
                    </div>
                    <span className="pl-flag"><Check id={`iv-add-${i}`} checked={it.addOn} onChange={(v) => set({ items: inv.items.map((x, j) => (j === i ? { ...x, addOn: v } : x)) })} label="Add-on" /></span>
                    <IconButton label="Remove line" size="sm" plain onClick={() => set({ items: inv.items.filter((_, j) => j !== i) })}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                ))}
              </div>
              <p className="tiny muted">Amount = the line total (already × qty).</p>
            </section>
            <div className="form-grid">
              <Field label="Discount label" htmlFor="iv-dl">
                <TextInput id="iv-dl" value={inv.discountLabel} onChange={(e) => set({ discountLabel: e.target.value })} placeholder="e.g. 15% org discount" />
              </Field>
              <Field label="Discount" htmlFor="iv-da">
                <MoneyInput id="iv-da" value={inv.discountAmount} onChange={(v) => set({ discountAmount: v ?? 0 })} />
              </Field>
              {!inv.jobId ? (
                <Field label="Payments received so far" htmlFor="iv-paid" hint="This invoice isn’t linked to a job, so enter what’s been paid.">
                  <MoneyInput id="iv-paid" value={inv.paidManual} onChange={(v) => set({ paidManual: v ?? 0 })} />
                </Field>
              ) : null}
            </div>
            <Field label="Notes & terms" htmlFor="iv-notes" hint="One per line; printed at the end.">
              <TextArea id="iv-notes" rows={4} value={inv.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
          <aside className="side-panel">
            <div className="card">
              <span className="eyebrow">Totals</span>
              <div className="waterfall">
                <div className="wf-row">
                  <span>Subtotal</span>
                  <span className="v">{peso(t.subtotal)}</span>
                </div>
                <div className="wf-row sub">
                  <span>Add-ons (+)</span>
                  <span className="v">{peso(t.addOns)}</span>
                </div>
                <div className="wf-row sub">
                  <span>Discount (−)</span>
                  <span className="v">−{peso(t.discount)}</span>
                </div>
                <div className="wf-row">
                  <span>Total</span>
                  <span className="v">{peso(t.total)}</span>
                </div>
                <div className="wf-row sub">
                  <span>Less payments received</span>
                  <span className="v">−{peso(t.paid)}</span>
                </div>
                <div className="wf-row final">
                  <span>Balance due</span>
                  <span className="v">{peso(t.balance)}</span>
                </div>
              </div>
              {inv.jobId && t.balance > 0 ? (
                <Button block variant="teal" onClick={() => setPaying(true)}>
                  <Wallet size={16} /> Record a payment
                </Button>
              ) : null}
            </div>
            {payments.length ? (
              <div className="card stack tight">
                <span className="eyebrow">Payments on this job</span>
                {payments.map((p) => (
                  <div key={p.id} className="row small">
                    <span className="grow">
                      {fmtIsoDate(p.date)} · {p.method}
                    </span>
                    <span className="num">{peso(p.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </Dialog>
      <PaymentDialog open={paying} onClose={() => setPaying(false)} preset={{ jobId: inv.jobId, invoiceId: inv.id, clientId: inv.clientId, amount: t.balance, kind: t.paid ? 'final' : 'down' }} />
    </>
  );
}

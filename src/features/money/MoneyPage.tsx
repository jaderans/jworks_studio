import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router';
import { BellRing, FileDown, Mail, Plus, ReceiptText, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, EmptyState, IconButton, PageHeader, Stat } from '../../components/ui';
import { Field, MoneyInput, SearchInput, Select, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { BarList, ChartFrame } from '../../components/charts';
import { useExpenses, useJobs, usePayments, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { deleteExpense, deletePayment, newInvoice, saveExpense } from '../../services/money';
import { peso } from '../../lib/money';
import { addDays, fmtIsoDate, todayISO } from '../../lib/time';
import { InvoiceDialog, invoiceBadge } from './InvoiceDialog';
import { useInvoiceRows } from '../../hooks/money';
import { PaymentDialog } from './PaymentDialog';
import { emailInvoice, emailReceipt, shareReceipt } from './share';
import { PayoutsTab } from './PayoutsTab';
import { BirTab, ReportsTab } from './ReportsTab';
import type { Expense } from '../../db/types';

export default function MoneyPage() {
  return (
    <div className="page wide">
      <Routes>
        <Route index element={<Navigate to="invoices" replace />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payouts" element={<PayoutsTab />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<ReportsTab />} />
        <Route path="bir" element={<BirTab />} />
      </Routes>
    </div>
  );
}

function Invoices() {
  const app = useApp();
  const rows = useInvoiceRows();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  // Deep link: /money/invoices?invoice=<id>
  useEffect(() => {
    const id = params.get('invoice');
    if (!id) return;
    setOpen(id);
    setParams({}, { replace: true });
  }, [params, setParams]);
  const [filter, setFilter] = useState<'open' | 'all' | 'overdue' | 'paid' | 'draft' | 'void'>('open');
  const [q, setQ] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  if (!rows) return null;
  const live = rows.filter((r) => r.inv.status !== 'void');
  const outstanding = live.filter((r) => r.t.balance > 0 && r.inv.status !== 'draft');
  const overdue = outstanding.filter((r) => r.t.overdue);
  const dueSoon = outstanding.filter((r) => !r.t.overdue && r.inv.dueDate && r.inv.dueDate <= addDays(todayISO(), 3));
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    const ok =
      filter === 'all' ||
      (filter === 'open' && r.inv.status !== 'void' && r.t.balance > 0) ||
      (filter === 'overdue' && r.t.overdue) ||
      (filter === 'paid' && r.t.state === 'paid' && r.inv.status !== 'void') ||
      (filter === 'draft' && r.inv.status === 'draft') ||
      (filter === 'void' && r.inv.status === 'void');
    return ok && (!needle || `${r.inv.number} ${r.inv.billTo.name}`.toLowerCase().includes(needle));
  });
  const remind = async (id: string) => {
    setSending(id);
    try {
      const to = await emailInvoice(id, 'reminder');
      app.toast(`Reminder sent to ${to}`, { tone: 'good' });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not send', { tone: 'bad' });
    } finally {
      setSending(null);
    }
  };
  return (
    <div className="stack loose">
      <PageHeader
        title="Invoices"
        subtitle="JW-numbered invoices on the JoshWorks letterhead. Paid, partly paid and overdue follow the payments you record."
        actions={
          <Button
            variant="primary"
            onClick={async () => {
              const inv = await newInvoice();
              setOpen(inv.id);
            }}
          >
            <Plus size={18} /> New invoice
          </Button>
        }
      />
      <div className="grid-4">
        <Stat label="Outstanding" value={peso(outstanding.reduce((a, r) => a + r.t.balance, 0))} hint={`${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}`} />
        <Stat label="Overdue" value={peso(overdue.reduce((a, r) => a + r.t.balance, 0))} hint={overdue.length ? `${overdue.length} need a reminder` : 'None'} />
        <Stat label="Due in 3 days" value={String(dueSoon.length)} hint={dueSoon.length ? peso(dueSoon.reduce((a, r) => a + r.t.balance, 0)) : 'Nothing soon'} />
        <Stat label="Invoices this year" value={String(live.filter((r) => r.inv.issueDate.startsWith(todayISO().slice(0, 4))).length)} />
      </div>
      {overdue.length || dueSoon.length ? (
        <section className="card stack tight attention">
          <h2 className="dot-title">
            <BellRing size={18} /> Payment reminders
          </h2>
          {[...overdue, ...dueSoon].map((r) => (
            <div key={r.inv.id} className="row wrap">
              <span className="mono small">{r.inv.number}</span>
              <span className="grow">{r.inv.billTo.name || '—'}</span>
              <span className={`small strong ${r.t.overdue ? 'bad' : ''}`}>{r.t.overdue ? `Overdue since ${fmtIsoDate(r.inv.dueDate)}` : `Due ${fmtIsoDate(r.inv.dueDate)}`}</span>
              <span className="num strong">{peso(r.t.balance)}</span>
              <Button size="sm" disabled={sending === r.inv.id} onClick={() => remind(r.inv.id)}>
                <Mail size={15} /> {sending === r.inv.id ? 'Sending…' : 'Email a reminder'}
              </Button>
            </div>
          ))}
        </section>
      ) : null}
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search invoice no. or client" />
        <Select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="open">With a balance</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="draft">Drafts</option>
          <option value="void">Void</option>
          <option value="all">All</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No invoices yet" icon={<ReceiptText size={40} />}>
          Make one from a job (Money tab → Make an invoice), or start a blank one.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>No.</th>
                <th>Bill to</th>
                <th>Date</th>
                <th>Due</th>
                <th className="r">Total</th>
                <th className="r">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ inv, t }) => (
                <tr key={inv.id} className="click" onClick={() => setOpen(inv.id)}>
                  <td data-label="No." className="mono nowrap">{inv.number}</td>
                  <td data-label="Bill to">{inv.billTo.name || '—'}</td>
                  <td data-label="Date" className="nowrap">{fmtIsoDate(inv.issueDate)}</td>
                  <td data-label="Due" className="nowrap">{inv.dueDate ? fmtIsoDate(inv.dueDate) : '—'}</td>
                  <td data-label="Total" className="r num">{peso(t.total)}</td>
                  <td data-label="Balance" className="r num strong">{t.balance ? peso(t.balance) : '—'}</td>
                  <td data-label="Status">{invoiceBadge(inv, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InvoiceDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Payments() {
  const app = useApp();
  const payments = usePayments();
  const jobs = useJobs() ?? [];
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  if (!payments) return null;
  const jobOf = new Map(jobs.map((j) => [j.id, j]));
  const inMonth = payments.filter((p) => !month || p.date.startsWith(month));
  const total = inMonth.reduce((a, p) => a + p.amount, 0);
  const byMethod = new Map<string, number>();
  for (const p of inMonth) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack loose">
      <PageHeader
        title="Payments"
        subtitle="Money clients paid. Each one gets an acknowledgment receipt number, and every designer’s share is worked out automatically."
        actions={
          <Button variant="primary" onClick={() => setPaying(true)}>
            <Wallet size={18} /> Record a payment
          </Button>
        }
      />
      <div className="row wrap">
        <input type="month" className="input" style={{ width: 'auto' }} aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={() => setMonth('')}>
          All time
        </Button>
      </div>
      <div className="grid-2">
        <Stat label={month ? 'Received this month' : 'Received (all time)'} value={peso(total)} hint={`${inMonth.length} payment${inMonth.length === 1 ? '' : 's'}`} hero />
        <section className="card">
          <ChartFrame title="By payment method" table={{ head: ['Method', 'Amount (₱)'], rows: [...byMethod.entries()].map(([m, v]) => [m, v / 100]) }}>
            <BarList rows={[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ key: m, name: m, value: v }))} format={(v) => peso(v)} empty="No payments in this period." />
          </ChartFrame>
        </section>
      </div>
      {inMonth.length === 0 ? (
        <EmptyState title="No payments in this period" />
      ) : (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>Job</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="r">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {inMonth.map((p) => {
                const j = p.jobId ? jobOf.get(p.jobId) : undefined;
                return (
                  <tr key={p.id}>
                    <td data-label="Date" className="nowrap">{fmtIsoDate(p.date)}</td>
                    <td data-label="Receipt" className="mono">{p.receiptNo}</td>
                    <td data-label="Job">{j ? `${j.number} · ${j.clientName || j.title}` : p.note || '—'}</td>
                    <td data-label="Method">{p.method}</td>
                    <td data-label="Reference" className="mono small">{p.reference || '—'}</td>
                    <td data-label="Amount" className="r num strong">{peso(p.amount)}</td>
                    <td className="actions-cell">
                      <IconButton label="Receipt PDF" size="sm" plain disabled={busy === p.id} onClick={() => act(p.id, () => shareReceipt(p.id))}>
                        <FileDown size={15} />
                      </IconButton>
                      <IconButton
                        label="Email the receipt"
                        size="sm"
                        plain
                        disabled={busy === p.id}
                        onClick={() =>
                          act(p.id, async () => {
                            const to = await emailReceipt(p.id);
                            app.toast(`Receipt sent to ${to}`, { tone: 'good' });
                          })
                        }
                      >
                        <Mail size={15} />
                      </IconButton>
                      <IconButton
                        label="Delete payment"
                        size="sm"
                        plain
                        onClick={async () => {
                          if (!(await app.confirm({ title: `Delete the ${peso(p.amount)} payment?`, message: 'The designers’ shares from it are removed too.', confirmLabel: 'Delete', tone: 'danger' }))) return;
                          await deletePayment(p.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaymentDialog open={paying} onClose={() => setPaying(false)} />
    </div>
  );
}

function Expenses() {
  const app = useApp();
  const expenses = useExpenses();
  const money = settingValue(useSettingRows(), 'money');
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  if (!expenses) return null;
  const shown = expenses.filter((x) => !month || x.date.startsWith(month));
  const byCat = new Map<string, number>();
  for (const x of shown) byCat.set(x.category, (byCat.get(x.category) ?? 0) + x.amount);
  return (
    <div className="stack loose">
      <PageHeader
        title="Expenses"
        subtitle="Printing, software, ads, transport… so the income report shows real profit."
        actions={
          <Button variant="primary" onClick={() => setEditing({ date: todayISO(), category: money.expenseCategories[0] ?? 'Other', amount: 0 })}>
            <Plus size={18} /> Add an expense
          </Button>
        }
      />
      <div className="row wrap">
        <input type="month" className="input" style={{ width: 'auto' }} aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={() => setMonth('')}>
          All time
        </Button>
      </div>
      <div className="grid-2">
        <Stat label={month ? 'Spent this month' : 'Spent (all time)'} value={peso(shown.reduce((a, x) => a + x.amount, 0))} hero />
        <section className="card">
          <ChartFrame title="By category" table={{ head: ['Category', 'Amount (₱)'], rows: [...byCat.entries()].map(([c, v]) => [c, v / 100]) }}>
            <BarList rows={[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ key: c, name: c, value: v }))} format={(v) => peso(v)} empty="No expenses in this period." />
          </ChartFrame>
        </section>
      </div>
      {shown.length ? (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor / what</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id} className="click" onClick={() => setEditing(x)}>
                  <td data-label="Date" className="nowrap">{fmtIsoDate(x.date)}</td>
                  <td data-label="Category">
                    <Badge>{x.category}</Badge>
                  </td>
                  <td data-label="Vendor">{[x.vendor, x.note].filter(Boolean).join(' · ') || '—'}</td>
                  <td data-label="Amount" className="r num strong">{peso(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No expenses in this period" />
      )}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Expense' : 'Add an expense'}
        footer={
          <>
            {editing?.id ? (
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteExpense(editing.id as string);
                  setEditing(null);
                }}
              >
                <Trash2 size={16} /> Delete
              </Button>
            ) : null}
            <span className="grow" />
            <Button
              variant="primary"
              disabled={!editing?.amount || !editing?.date}
              onClick={async () => {
                if (!editing?.amount || !editing.date) return;
                await saveExpense({ ...editing, amount: editing.amount, date: editing.date });
                app.toast('Saved', { tone: 'good' });
                setEditing(null);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="form-grid">
            <Field label="Amount" htmlFor="ex-amt">
              <MoneyInput id="ex-amt" large value={editing.amount ?? 0} onChange={(v) => setEditing({ ...editing, amount: v ?? 0 })} autoFocus />
            </Field>
            <Field label="Date" htmlFor="ex-date">
              <input id="ex-date" type="date" className="input" value={editing.date ?? ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Category" htmlFor="ex-cat">
              <Select id="ex-cat" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {money.expenseCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vendor or shop" htmlFor="ex-vendor">
              <TextInput id="ex-vendor" value={editing.vendor ?? ''} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
            </Field>
            <Field label="Note" htmlFor="ex-note" className="span-2">
              <TextInput id="ex-note" value={editing.note ?? ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

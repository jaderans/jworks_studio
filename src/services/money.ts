import { alive, db } from '../db/db';
import { audit, build, create, remove, save } from '../db/write';
import { getSetting } from '../db/settings';
import { earningsForJob, nextDocNumber } from '../domain/money';
import { docTotals } from '../domain/pricing';
import { peso } from '../lib/money';
import { addDays, todayISO } from '../lib/time';
import type { Earning, Expense, Invoice, InvoiceItem, JobMoney, Payment, Payout, PayoutAccount, ProposalItem } from '../db/types';

/**
 * Writes for the money side: payments, invoices, payouts and expenses. Every
 * change to a job's payments or split brings the designers' earnings up to
 * date, so "owed" is always right.
 */

// ----- earnings -----

/** Rebuild the earnings rows of these jobs from their payments and split. Writes only what changed. */
export async function recomputeEarnings(jobIds: readonly string[]): Promise<void> {
  for (const jobId of new Set(jobIds)) {
    const [money, payments, existing] = await Promise.all([
      db.jobMoney.get(jobId),
      db.payments.where('jobId').equals(jobId).toArray(),
      db.earnings.where('jobId').equals(jobId).toArray(),
    ]);
    const want = money && money.deleted !== 1 ? earningsForJob(jobId, money, payments) : [];
    const wantById = new Map(want.map((e) => [e.id, e]));
    const changed: Earning[] = [];
    for (const e of want) {
      const cur = existing.find((x) => x.id === e.id);
      if (!cur || cur.deleted === 1 || cur.amount !== e.amount || cur.date !== e.date || cur.memberId !== e.memberId) {
        changed.push(cur ? { ...cur, ...e, deleted: 0 } : build<Earning>(e));
      }
    }
    for (const cur of existing) if (cur.deleted !== 1 && !wantById.has(cur.id)) changed.push({ ...cur, deleted: 1 });
    for (const e of changed) await save(db.earnings, e);
  }
}

// ----- job money -----

export function blankMoney(fields: Partial<JobMoney> = {}): Omit<JobMoney, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } {
  return { total: 0, items: [], discountAmount: 0, deductionPct: 5, split: [], taxWithheld: 0, form2307: 'na', invoiceNo: '', notes: '', ...fields };
}

/** Save a job's money; earnings follow when the split, deduction or total changed. */
export async function saveJobMoney(jobId: string, changes: Partial<JobMoney>): Promise<JobMoney> {
  const prev = await db.jobMoney.get(jobId);
  const settings = await getSetting('money');
  const next = prev ? await save(db.jobMoney, { ...prev, ...changes, deleted: 0 }) : await create<JobMoney>(db.jobMoney, { ...blankMoney({ deductionPct: settings.deductionPct }), ...changes, id: jobId });
  if (!prev || prev.deductionPct !== next.deductionPct || JSON.stringify(prev.split) !== JSON.stringify(next.split) || prev.deleted === 1) await recomputeEarnings([jobId]);
  if (prev && prev.total !== next.total) await audit('price', 'job', jobId, `Job total ${peso(prev.total)} → ${peso(next.total)}`);
  return next;
}

/** A job's total from price lines (package, add-ons) and a peso discount. */
export const totalOf = (items: ProposalItem[], discountAmount = 0) => docTotals(items, discountAmount).net;

// ----- payments -----

async function nextReceiptNo(year: number): Promise<string> {
  const [money, payments] = await Promise.all([getSetting('money'), db.payments.toArray()]);
  return nextDocNumber('AR', money.receiptNext, year, payments.map((p) => p.receiptNo).filter(Boolean));
}

export async function savePayment(p: Partial<Payment> & { amount: number; date: string }): Promise<Payment> {
  let rec: Payment;
  const prev = p.id ? await db.payments.get(p.id) : undefined;
  if (prev) rec = await save(db.payments, { ...prev, ...p } as Payment);
  else {
    rec = await create<Payment>(db.payments, {
      jobId: p.jobId ?? null,
      invoiceId: p.invoiceId ?? null,
      clientId: p.clientId ?? null,
      amount: p.amount,
      date: p.date,
      method: p.method ?? 'GCash',
      reference: p.reference ?? '',
      kind: p.kind ?? 'partial',
      receiptNo: p.receiptNo || (await nextReceiptNo(Number(p.date.slice(0, 4)) || new Date().getFullYear())),
      note: p.note ?? '',
      ...(p.id ? { id: p.id } : {}),
    });
    await audit('payment', 'payment', rec.id, `Received ${peso(rec.amount)} (${rec.method})${rec.receiptNo ? ` · ${rec.receiptNo}` : ''}`);
  }
  const jobs = [rec.jobId, prev?.jobId].filter((x): x is string => !!x);
  if (jobs.length) await recomputeEarnings(jobs);
  return rec;
}

export async function deletePayment(id: string): Promise<void> {
  const p = await db.payments.get(id);
  await remove(db.payments, id);
  if (p?.jobId) await recomputeEarnings([p.jobId]);
  await audit('delete', 'payment', id, `Deleted a payment of ${peso(p?.amount ?? 0)}`);
}

// ----- payouts -----

export async function savePayout(p: Partial<Payout> & { memberId: string; amount: number }): Promise<Payout> {
  const prev = p.id ? await db.payouts.get(p.id) : undefined;
  if (prev) return save(db.payouts, { ...prev, ...p } as Payout);
  const rec = await create<Payout>(db.payouts, { memberId: p.memberId, amount: p.amount, date: p.date ?? todayISO(), method: p.method ?? '', reference: p.reference ?? '', note: p.note ?? '', ...(p.id ? { id: p.id } : {}) });
  const m = await db.members.get(p.memberId);
  await audit('payout', 'payout', rec.id, `Paid ${m?.name ?? 'a designer'} ${peso(rec.amount)}${rec.method ? ` by ${rec.method}` : ''}`);
  return rec;
}

export async function deletePayout(id: string): Promise<void> {
  await remove(db.payouts, id);
}

export async function savePayoutAccount(memberId: string, a: Omit<PayoutAccount, keyof import('../db/types').Syncable>): Promise<PayoutAccount> {
  const prev = await db.payoutAccounts.get(memberId);
  return prev ? save(db.payoutAccounts, { ...prev, ...a, deleted: 0 }) : create<PayoutAccount>(db.payoutAccounts, { ...a, id: memberId });
}

// ----- invoices -----

export async function nextInvoiceNo(year = new Date().getFullYear()): Promise<string> {
  const [money, invoices, jm] = await Promise.all([getSetting('money'), db.invoices.toArray(), db.jobMoney.toArray()]);
  const used = [...invoices.filter((i) => i.deleted !== 1).map((i) => i.number), ...jm.map((m) => m.invoiceNo).filter(Boolean)];
  return nextDocNumber(money.invoicePrefix, money.invoiceNext, year, used);
}

/** Price lines → invoice lines (percentage add-ons become peso amounts). */
export function invoiceItemsFrom(items: ProposalItem[]): InvoiceItem[] {
  const t = docTotals(items);
  return t.lines.map((l, i) => {
    const src = items.find((x) => x.label === l.label) ?? items[i];
    return { label: l.label, qty: l.qty || 1, amount: l.amount, addOn: !!src && !src.base && items.some((x) => x.base) };
  });
}

export async function newInvoice(fields: Partial<Invoice> = {}): Promise<Invoice> {
  const today = todayISO();
  const money = await getSetting('money');
  const rec = await create<Invoice>(db.invoices, {
    number: fields.number || (await nextInvoiceNo(Number(today.slice(0, 4)))),
    jobId: null,
    clientId: null,
    issueDate: today,
    dueDate: addDays(today, money.invoiceDays || 15),
    billTo: { name: '', contact: '', address: '', emailPhone: '' },
    items: [],
    discountLabel: '',
    discountAmount: 0,
    paidManual: 0,
    status: 'draft',
    sentAt: null,
    notes: money.invoiceNotes.join('\n'),
    ...fields,
  });
  await audit('create', 'invoice', rec.id, `Made invoice ${rec.number}${rec.billTo.name ? ` for ${rec.billTo.name}` : ''}`);
  return rec;
}

/** An invoice for a job: bill-to from the client, lines from the job's price. */
export async function invoiceForJob(jobId: string): Promise<Invoice> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error('That job no longer exists.');
  const [money, client] = await Promise.all([db.jobMoney.get(jobId), job.clientId ? db.clients.get(job.clientId) : undefined]);
  const items: InvoiceItem[] = money?.items.length ? invoiceItemsFrom(money.items) : money?.total ? [{ label: job.title, qty: 1, amount: money.total, addOn: false }] : [];
  return newInvoice({
    jobId,
    clientId: job.clientId,
    billTo: {
      name: client?.name || job.clientName,
      contact: client?.contactName ?? '',
      address: client?.location ?? '',
      emailPhone: [client?.email, client?.phone].filter(Boolean).join(' / '),
    },
    items,
    discountLabel: money?.discountAmount ? 'Discount' : '',
    discountAmount: money?.discountAmount ?? 0,
  });
}

export async function saveInvoice(inv: Invoice): Promise<Invoice> {
  const prev = await db.invoices.get(inv.id);
  const next = await save(db.invoices, { ...inv, sentAt: inv.status === 'sent' ? (inv.sentAt ?? Date.now()) : inv.sentAt });
  if (prev && prev.status !== next.status) await audit('invoice', 'invoice', next.id, `Invoice ${next.number}: ${prev.status} → ${next.status}`);
  return next;
}

export async function deleteInvoice(id: string): Promise<void> {
  const inv = await db.invoices.get(id);
  await remove(db.invoices, id);
  await audit('delete', 'invoice', id, `Deleted invoice ${inv?.number ?? ''}`);
}

// ----- expenses -----

export async function saveExpense(x: Partial<Expense> & { amount: number; date: string }): Promise<Expense> {
  const prev = x.id ? await db.expenses.get(x.id) : undefined;
  if (prev) return save(db.expenses, { ...prev, ...x } as Expense);
  return create<Expense>(db.expenses, { date: x.date, category: x.category ?? 'Other', amount: x.amount, vendor: x.vendor ?? '', jobId: x.jobId ?? null, note: x.note ?? '' });
}

export async function deleteExpense(id: string): Promise<void> {
  await remove(db.expenses, id);
}

/** Everything about one job's money in one read (for dialogs and documents). */
export async function jobLedger(jobId: string) {
  const [money, payments, invoices, earnings] = await Promise.all([
    db.jobMoney.get(jobId),
    db.payments.where('jobId').equals(jobId).toArray(),
    db.invoices.where('jobId').equals(jobId).toArray(),
    db.earnings.where('jobId').equals(jobId).toArray(),
  ]);
  return { money: money && money.deleted !== 1 ? money : null, payments: alive(payments), invoices: alive(invoices), earnings: alive(earnings) };
}

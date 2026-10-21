import { percentOf, sum, type Cents } from '../lib/money';
import type { BirSettings, Earning, Expense, Invoice, JobMoney, JobView, MoneySettings, Payment, Payout, SplitShare, StudioPayMethod } from '../db/types';

/**
 * The studio's money rules, kept free of the database so they can be tested.
 * They follow the owner's commission tracker: a standard deduction (5%) comes
 * off each job before the team split, and every client payment releases the
 * same fraction of each designer's share.
 */

export const DEFAULT_MONEY: MoneySettings = {
  deductionPct: 5,
  invoicePrefix: 'JW',
  invoiceNext: 32,
  receiptNext: 1,
  invoiceDays: 15,
  downPct: 50,
  invoiceNotes: [
    'A 50% down payment is required to begin the project; the balance is due before final file delivery.',
    'Final files are released upon confirmation of full payment.',
    'Please use the invoice number as your payment reference and send a copy of the receipt.',
    'This invoice is valid for 15 days from the invoice date.',
  ],
  bigProject: 1_500_000,
  targets: [
    { month: '2026-11', low: 2_500_000, high: 4_000_000 },
    { month: '2026-12', low: 3_000_000, high: 5_000_000 },
    { month: '2027-01', low: 4_000_000, high: 7_000_000 },
    { month: '2027-02', low: 5_000_000, high: 9_000_000 },
    { month: '2027-03', low: 6_000_000, high: 10_000_000 },
  ],
  defaultSplit: [],
  expenseCategories: ['Printing', 'Software & subscriptions', 'Ads', 'Equipment', 'Transport', 'Food & meetings', 'Fees & permits', 'Other'],
  catalogVersion: 0,
};

export const DEFAULT_BIR: BirSettings = {
  startDate: '2026-11-16',
  eightPct: true,
  exemption: 25_000_000,
  vatCeiling: 300_000_000,
};

/** Where clients pay. Account names, numbers and QR codes are added in Settings (never in the code). */
export const DEFAULT_PAY_METHODS: StudioPayMethod[] = [
  { id: 'gcash', label: 'GCash', accountName: '', accountNumber: '', qrImage: '', on: true },
  { id: 'maribank', label: 'MariBank', accountName: '', accountNumber: '', qrImage: '', on: true },
  { id: 'unionbank', label: 'UnionBank', accountName: '', accountNumber: '', qrImage: '', on: true },
];

export const PAY_METHODS = ['GCash', 'Mari Bank', 'Union Bank', 'On Hand', 'Bank transfer', 'PayPal', 'Wise', 'Other'] as const;

// ----- earnings: each designer's share of each payment -----

/** The part of a payment the team splits, after the standard deduction. */
export const netOf = (amount: Cents, deductionPct: number): Cents => amount - percentOf(amount, deductionPct);

export const splitTotal = (split: readonly SplitShare[]): number => Math.round(sum(split.map((s) => s.pct)) * 1000) / 1000;

/** Merge duplicate members and drop zero shares. */
export function cleanSplit(split: readonly SplitShare[]): SplitShare[] {
  const m = new Map<string, number>();
  for (const s of split) if (s.memberId && s.pct > 0) m.set(s.memberId, (m.get(s.memberId) ?? 0) + s.pct);
  return [...m.entries()].map(([memberId, pct]) => ({ memberId, pct }));
}

/**
 * Each member's share of a cumulative net amount. Everyone but the lead (the
 * largest share) is rounded toward zero; when the split adds up to 100% the lead
 * takes the remainder, so the shares add up to the net exactly. A split under
 * 100% leaves the rest with the studio.
 */
export function sharesOfNet(net: Cents, split: readonly SplitShare[]): Map<string, Cents> {
  const shares = cleanSplit(split);
  const out = new Map<string, Cents>();
  if (!shares.length) return out;
  const full = Math.abs(splitTotal(shares) - 100) < 0.001;
  let lead = -1;
  if (full) shares.forEach((s, i) => (lead < 0 || s.pct > shares[lead].pct ? (lead = i) : undefined));
  let used = 0;
  shares.forEach((s, i) => {
    if (i === lead) return;
    const v = Math.trunc((net * s.pct) / 100);
    out.set(s.memberId, v);
    used += v;
  });
  if (lead >= 0) out.set(shares[lead].memberId, net - used);
  return out;
}

const byPayOrder = (a: Payment, b: Payment) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id);

/**
 * The earnings rows a job's payments should produce (ids are deterministic).
 * Shares are worked out on the running total, and each payment earns the
 * difference, so a job's final shares always equal total × (1 − deduction) × split
 * and refunds (negative payments) take shares back.
 */
export function earningsForJob(jobId: string, money: Pick<JobMoney, 'deductionPct' | 'split'>, payments: readonly Payment[]): Omit<Earning, 'createdAt' | 'updatedAt'>[] {
  const out: Omit<Earning, 'createdAt' | 'updatedAt'>[] = [];
  const pays = payments.filter((p) => p.deleted !== 1 && p.jobId === jobId).sort(byPayOrder);
  let cumPaid = 0;
  let prev = new Map<string, Cents>();
  for (const p of pays) {
    cumPaid += p.amount;
    const now = sharesOfNet(netOf(cumPaid, money.deductionPct), money.split);
    const ids = new Set([...now.keys(), ...prev.keys()]);
    for (const memberId of ids) {
      const amount = (now.get(memberId) ?? 0) - (prev.get(memberId) ?? 0);
      if (amount !== 0) out.push({ id: `${p.id}:${memberId}`, memberId, jobId, paymentId: p.id, amount, date: p.date });
    }
    prev = now;
  }
  return out;
}

/** Paid jobs with no team split yet: their shares aren't going to anyone until one is set. */
export function unsplitJobs(money: ReadonlyMap<string, Pick<JobMoney, 'split' | 'deductionPct'>>, payments: readonly Payment[]): { jobId: string; net: Cents }[] {
  const paid = new Map<string, Cents>();
  for (const p of payments) if (p.deleted !== 1 && p.jobId) paid.set(p.jobId, (paid.get(p.jobId) ?? 0) + p.amount);
  const out: { jobId: string; net: Cents }[] = [];
  for (const [jobId, amount] of paid) {
    const m = money.get(jobId);
    if (amount > 0 && (!m || cleanSplit(m.split).length === 0)) out.push({ jobId, net: netOf(amount, m?.deductionPct ?? 5) });
  }
  return out;
}

/** What each designer has earned, been paid, and is still owed. */
export function payoutSummary(earnings: readonly Earning[], payouts: readonly Payout[]): Map<string, { earned: Cents; paid: Cents; owed: Cents }> {
  const m = new Map<string, { earned: Cents; paid: Cents; owed: Cents }>();
  const row = (id: string) => m.get(id) ?? m.set(id, { earned: 0, paid: 0, owed: 0 }).get(id)!;
  for (const e of earnings) if (e.deleted !== 1) row(e.memberId).earned += e.amount;
  for (const p of payouts) if (p.deleted !== 1) row(p.memberId).paid += p.amount;
  for (const v of m.values()) v.owed = v.earned - v.paid;
  return m;
}

// ----- jobs -----

export interface JobBalance {
  total: Cents;
  paid: Cents;
  balance: Cents;
  state: 'unpriced' | 'unpaid' | 'partial' | 'paid' | 'over';
}

export function jobBalance(money: Pick<JobMoney, 'total'> | null | undefined, payments: readonly Payment[]): JobBalance {
  const total = money?.total ?? 0;
  const paid = sum(payments.filter((p) => p.deleted !== 1).map((p) => p.amount));
  const balance = total - paid;
  const state = total <= 0 ? (paid > 0 ? 'paid' : 'unpriced') : paid <= 0 ? 'unpaid' : balance > 0 ? 'partial' : balance < 0 ? 'over' : 'paid';
  return { total, paid, balance, state };
}

// ----- invoices -----

export interface InvoiceTotals {
  subtotal: Cents;
  addOns: Cents;
  discount: Cents;
  total: Cents;
  paid: Cents;
  balance: Cents;
  state: 'unpaid' | 'partial' | 'paid';
  overdue: boolean;
}

/** Totals for an invoice. `paid` = the job's payments, or the amount typed on an invoice with no job. */
export function invoiceTotals(inv: Pick<Invoice, 'items' | 'discountAmount' | 'paidManual' | 'dueDate' | 'jobId' | 'status'>, jobPayments: readonly Payment[], today: string): InvoiceTotals {
  const subtotal = sum(inv.items.filter((i) => !i.addOn).map((i) => i.amount));
  const addOns = sum(inv.items.filter((i) => i.addOn).map((i) => i.amount));
  const discount = Math.max(0, inv.discountAmount || 0);
  const total = subtotal + addOns - discount;
  const paid = inv.jobId ? sum(jobPayments.filter((p) => p.deleted !== 1).map((p) => p.amount)) : Math.max(0, inv.paidManual || 0);
  const balance = Math.max(0, total - paid);
  const state = total > 0 && balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  const overdue = inv.status !== 'void' && state !== 'paid' && !!inv.dueDate && inv.dueDate < today;
  return { subtotal, addOns, discount, total, paid, balance, state, overdue };
}

/** JW-0032-2026 */
export const formatInvoiceNo = (prefix: string, n: number, year: number): string => `${prefix || 'JW'}-${String(n).padStart(4, '0')}-${year}`;

/** Reads JW-0032-2026, JW-000021_-2026, JW-21-2026… → { n, year }. */
export function parseDocNo(no: string): { n: number; year: number } | null {
  const m = /^[A-Z]+-0*(\d+)\D*-(\d{4})$/i.exec(no.trim());
  return m ? { n: Number(m[1]), year: Number(m[2]) } : null;
}

/** The next free number for a year: after the highest one used, never below the setting. */
export function nextDocNumber(prefix: string, settingNext: number, year: number, existing: readonly string[]): string {
  let max = settingNext - 1;
  for (const no of existing) {
    const p = parseDocNo(no);
    if (p && p.year === year && p.n > max) max = p.n;
  }
  return formatInvoiceNo(prefix, max + 1, year);
}

/** Numbers used more than once (the old invoices had a few). */
export function duplicateNumbers(numbers: readonly string[]): string[] {
  const seen = new Map<string, number>();
  for (const no of numbers) {
    const p = parseDocNo(no);
    const key = p ? `${p.n}-${p.year}` : no.trim().toUpperCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
}

// ----- reports -----

export interface MonthRow {
  month: string;
  booked: Cents;
  received: Cents;
  net: Cents;
  started: number;
  completed: number;
  pending: Cents;
  expenses: Cents;
  bigProjects: number;
  byMember: Record<string, Cents>;
  target: { low: Cents; high: Cents } | null;
}

const monthOf = (d: string) => d.slice(0, 7);

/** The commission tracker's Monthly Summary, from the app's records. */
export function monthlySummary(
  months: readonly string[],
  data: { jobs: readonly JobView[]; money: ReadonlyMap<string, JobMoney>; payments: readonly Payment[]; earnings: readonly Earning[]; expenses: readonly Expense[] },
  settings: Pick<MoneySettings, 'deductionPct' | 'targets' | 'bigProject'>,
): MonthRow[] {
  const rows = new Map<string, MonthRow>(
    months.map((m) => [
      m,
      { month: m, booked: 0, received: 0, net: 0, started: 0, completed: 0, pending: 0, expenses: 0, bigProjects: 0, byMember: {}, target: null },
    ]),
  );
  const jobs = data.jobs.filter((j) => j.deleted !== 1 && j.status !== 'cancelled' && j.status !== 'inquiry');
  const paidByJob = new Map<string, Cents>();
  for (const p of data.payments) if (p.deleted !== 1 && p.jobId) paidByJob.set(p.jobId, (paidByJob.get(p.jobId) ?? 0) + p.amount);
  for (const j of jobs) {
    const total = data.money.get(j.id)?.total ?? 0;
    const start = rows.get(monthOf(j.startDate || ''));
    if (start) {
      start.booked += total;
      start.started += 1;
      start.pending += Math.max(0, total - (paidByJob.get(j.id) ?? 0));
      if (total >= settings.bigProject) start.bigProjects += 1;
    }
    const done = j.status === 'completed' ? rows.get(monthOf(j.completedOn || j.dueDate || j.startDate || '')) : undefined;
    if (done) done.completed += 1;
  }
  for (const p of data.payments) {
    if (p.deleted === 1) continue;
    const r = rows.get(monthOf(p.date));
    if (!r) continue;
    r.received += p.amount;
    const ded = p.jobId ? (data.money.get(p.jobId)?.deductionPct ?? settings.deductionPct) : settings.deductionPct;
    r.net += netOf(p.amount, ded);
  }
  for (const e of data.earnings) {
    if (e.deleted === 1) continue;
    const r = rows.get(monthOf(e.date));
    if (r) r.byMember[e.memberId] = (r.byMember[e.memberId] ?? 0) + e.amount;
  }
  for (const x of data.expenses) {
    if (x.deleted === 1) continue;
    const r = rows.get(monthOf(x.date));
    if (r) r.expenses += x.amount;
  }
  for (const t of settings.targets) {
    const r = rows.get(t.month);
    if (r) r.target = { low: t.low, high: t.high };
  }
  return months.map((m) => rows.get(m)!);
}

/** YYYY-MM for `count` months ending with `last`. */
export function monthRange(last: string, count: number): string[] {
  const [y, m] = last.split('-').map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function topClients(jobs: readonly JobView[], money: ReadonlyMap<string, JobMoney>, nameOf: (j: JobView) => string, limit = 10): { name: string; total: Cents; jobs: number }[] {
  const m = new Map<string, { name: string; total: Cents; jobs: number }>();
  for (const j of jobs) {
    if (j.deleted === 1 || j.status === 'cancelled' || j.status === 'inquiry') continue;
    const name = nameOf(j) || 'No client';
    const key = name.toLowerCase();
    const row = m.get(key) ?? { name, total: 0, jobs: 0 };
    row.total += money.get(j.id)?.total ?? 0;
    row.jobs += 1;
    m.set(key, row);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

// ----- BIR (8% income tax option) -----

export interface BirReturn {
  label: string;
  form: '1701Q' | '1701A';
  due: string;
  from: string;
  to: string;
  /** Receipts in this period. */
  receipts: Cents;
  /** Receipts from January 1 to the end of the period. */
  ytd: Cents;
  taxable: Cents;
  taxYtd: Cents;
  withheldYtd: Cents;
  paidBefore: Cents;
  payable: Cents;
}

/** Receipts that count for BIR: payments from the registration date on. */
export const birReceipts = (payments: readonly Payment[], bir: BirSettings): Payment[] => payments.filter((p) => p.deleted !== 1 && p.date >= bir.startDate);

/**
 * The year's returns under the 8% option: 8% of year-to-date receipts above the
 * ₱250,000 exemption, less tax withheld by clients (2307) and tax paid in earlier
 * quarters of the same year. An estimate to check with an accountant, not tax advice.
 */
export function birReturns(year: number, payments: readonly Payment[], withheld: readonly { date: string; amount: Cents }[], bir: BirSettings): BirReturn[] {
  const periods: { label: string; form: BirReturn['form']; due: string; to: string }[] = [
    { label: `Q1 ${year}`, form: '1701Q', due: `${year}-05-15`, to: `${year}-03-31` },
    { label: `Q2 ${year}`, form: '1701Q', due: `${year}-08-15`, to: `${year}-06-30` },
    { label: `Q3 ${year}`, form: '1701Q', due: `${year}-11-15`, to: `${year}-09-30` },
    { label: `Annual ${year}`, form: '1701A', due: `${year + 1}-04-15`, to: `${year}-12-31` },
  ];
  const yearStart = `${year}-01-01`;
  const counted = birReceipts(payments, bir).filter((p) => p.date >= yearStart && p.date <= `${year}-12-31`);
  let paidBefore = 0;
  let prevTo = `${year - 1}-12-31`;
  const out: BirReturn[] = [];
  for (const per of periods) {
    if (per.to < bir.startDate) {
      prevTo = per.to;
      continue;
    }
    const ytd = sum(counted.filter((p) => p.date <= per.to).map((p) => p.amount));
    const receipts = sum(counted.filter((p) => p.date > prevTo && p.date <= per.to).map((p) => p.amount));
    const taxable = bir.eightPct ? Math.max(0, ytd - bir.exemption) : ytd;
    const taxYtd = bir.eightPct ? percentOf(taxable, 8) : 0;
    const withheldYtd = sum(withheld.filter((w) => w.date >= yearStart && w.date <= per.to).map((w) => w.amount));
    const payable = Math.max(0, taxYtd - withheldYtd - paidBefore);
    out.push({ label: per.label, form: per.form, due: per.due, from: prevTo, to: per.to, receipts, ytd, taxable, taxYtd, withheldYtd, paidBefore, payable });
    if (per.form === '1701Q') paidBefore += payable;
    prevTo = per.to;
  }
  return out;
}

/** Tax a client withheld (2307) counts on the date of the job's last payment. */
export function withheldEntries(money: ReadonlyMap<string, JobMoney>, payments: readonly Payment[], today: string): { date: string; amount: Cents }[] {
  return [...money.values()]
    .filter((m) => m.deleted !== 1 && m.taxWithheld > 0)
    .map((m) => ({ amount: m.taxWithheld, date: payments.filter((p) => p.deleted !== 1 && p.jobId === m.id).map((p) => p.date).sort().pop() ?? today }));
}

/** The next BIR return still to file, or null when none is left this year and next. */
export function nextBirReturn(payments: readonly Payment[], withheld: readonly { date: string; amount: Cents }[], bir: BirSettings, today: string): BirReturn | null {
  const y = Number(today.slice(0, 4));
  const all = [...birReturns(y - 1, payments, withheld, bir), ...birReturns(y, payments, withheld, bir)];
  return all.filter((r) => r.due >= today && r.to < today).sort((a, b) => a.due.localeCompare(b.due))[0] ?? null;
}

/** Receipts in the last 12 months, for the non-VAT ceiling. */
export function last12Receipts(payments: readonly Payment[], today: string, bir: BirSettings): Cents {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  const from = d.toISOString().slice(0, 10);
  return sum(birReceipts(payments, bir).filter((p) => p.date > from && p.date <= today).map((p) => p.amount));
}

/** The tracker's "BIR Check" column: what paperwork a paid job is missing. */
export function birChecks(
  data: { payments: readonly Payment[]; money: ReadonlyMap<string, JobMoney>; invoices: readonly Invoice[]; jobs: readonly JobView[] },
  bir: BirSettings,
): { jobId: string; problem: string }[] {
  const out: { jobId: string; problem: string }[] = [];
  const invoicedJobs = new Set(data.invoices.filter((i) => i.deleted !== 1 && i.status !== 'void' && i.jobId).map((i) => i.jobId as string));
  for (const j of data.jobs) {
    if (j.deleted === 1) continue;
    const pays = birReceipts(data.payments, bir).filter((p) => p.jobId === j.id);
    if (!pays.length) continue;
    const money = data.money.get(j.id);
    if (!invoicedJobs.has(j.id) && !money?.invoiceNo) out.push({ jobId: j.id, problem: 'Add an invoice' });
    if (money && money.taxWithheld > 0 && money.form2307 !== 'yes') out.push({ jobId: j.id, problem: 'Get the 2307' });
  }
  return out;
}

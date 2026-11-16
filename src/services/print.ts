import Dexie from 'dexie';
import { alive, db } from '../db/db';
import { audit, build, create, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { EMPTY_PROGRESS } from '../domain/jobs';
import { exactPct } from '../domain/posFeed';
import { jobBalance } from '../domain/money';
import {
  PRINT_STAGE_LABEL, STAGE_STATUS, addWorkingDays, lineTotal, printStage, printTitle, printTotals, ratesFrom, type PrintStage,
} from '../domain/print';
import { nextJobNo, saveProgress } from './jobs';
import { blankClient } from './clients';
import { recomputeEarnings } from './money';
import { peso, type Cents } from '../lib/money';
import { isoDate, todayISO } from '../lib/time';
import type { Client, Expense, Job, JobMoney, JobProgress, PrintDelivery, PrintJob, PrintLine, PrintRates, ProposalItem } from '../db/types';

/**
 * Sticker printing orders made in Studio, for customers who don't order at a
 * booth event. Each one is a Sticker Printing job: the customer as a client,
 * its lines as the job's price, the down payment and the balance as payments,
 * whoever prints and draws it earning their exact shares as the customer pays,
 * and the courier fee and materials as the job's expenses. The order itself
 * (lines, delivery, shares) is kept on the job's money record.
 */

export interface PrintOrderInput {
  /** A saved client, or a name (and contact) for a new one. */
  clientId: string | null;
  clientName: string;
  contact: string;
  lines: PrintLine[];
  delivery: PrintDelivery;
  printerId: string | null;
  printerPct: number;
  illustratorId: string | null;
  illustratorPct: number;
  designNo: string;
  files: string;
  notes: string;
  /** A JoshWorks POS service coupon, already checked. */
  coupon?: { code: string; couponId: string; discount: Cents } | null;
}

function check(o: PrintOrderInput) {
  if (!o.clientId && !o.clientName.trim()) throw new Error('Add who the order is for.');
  if (!o.lines.length) throw new Error('Add what to make.');
  for (const l of o.lines) {
    if (!l.label.trim()) throw new Error('Every line needs a description.');
    if (!(l.qty > 0)) throw new Error(`Set how many for ${l.label}.`);
    if (!(l.unitPrice >= 0)) throw new Error(`Set the price of ${l.label}.`);
  }
  if (o.delivery.method === 'courier' && !o.delivery.address.trim()) throw new Error('Add the delivery address for the courier.');
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digits = (s: string) => s.replace(/\D+/g, '');

/** "0917…" is a phone, "a@b.ph" an email, "@handle" a handle. */
function contactParts(contact: string): Pick<Client, 'email' | 'phone' | 'handles'> {
  const c = contact.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { email: c, phone: '', handles: {} };
  if (c.startsWith('@')) return { email: '', phone: '', handles: { facebook: c } };
  return { email: '', phone: c, handles: {} };
}

/** The customer: a saved client, matched by email, phone or name, or a new one. */
async function clientFor(o: PrintOrderInput): Promise<{ id: string; name: string }> {
  if (o.clientId) {
    const c = await db.clients.get(o.clientId);
    if (c) return { id: c.id, name: c.name };
  }
  const name = o.clientName.trim();
  const parts = contactParts(o.contact);
  const clients = alive(await db.clients.toArray());
  const found =
    (parts.email && clients.find((x) => x.email && x.email.toLowerCase() === parts.email.toLowerCase())) ||
    (digits(parts.phone).length >= 7 && clients.find((x) => digits(x.phone) === digits(parts.phone))) ||
    clients.find((x) => key(x.name) === key(name));
  if (found) return { id: found.id, name: found.name };
  const rec = await create<Client>(db.clients, blankClient({ name, ...parts, stage: 'active', source: 'Sticker printing', startDate: todayISO(), platforms: [] }));
  await audit('create', 'client', rec.id, `Added the client ${rec.name}`);
  return { id: rec.id, name: rec.name };
}

/** The job's price lines: the order's lines and the delivery fee. */
function itemsOf(lines: readonly PrintLine[], delivery: PrintDelivery): ProposalItem[] {
  return [
    ...lines.map((l) => ({ packageId: null, label: l.label, qty: l.qty, unitPrice: l.unitPrice, unit: 'piece' as const, months: 1, base: true })),
    ...(delivery.method === 'courier' && delivery.fee > 0
      ? [{ packageId: null, label: `Delivery${delivery.courier ? ` (${delivery.courier})` : ''}`, qty: 1, unitPrice: delivery.fee, unit: 'project' as const, months: 1, base: true }]
      : []),
  ];
}

/** "3 × Premium Matte or Glossy… Pickup. Design CS01. Files: …" for the job's brief. */
function briefOf(p: PrintJob): string {
  const what = p.lines.map((l) => `${l.qty} × ${l.label}`).join('; ');
  const how = p.delivery.method === 'courier' ? `Courier${p.delivery.courier ? ` (${p.delivery.courier})` : ''} to ${p.delivery.address}.` : 'Pickup in Iloilo City.';
  return [`Sticker printing: ${what}.`, how, p.designNo ? `Design no. ${p.designNo}.` : '', p.contact ? `Contact: ${p.contact}.` : '', p.notes].filter(Boolean).join('\n');
}

/** Exact shares of the job total for whoever prints and draws it (one person can do both). */
function splitOf(p: PrintJob, totals: ReturnType<typeof printTotals>) {
  const shares = new Map<string, Cents>();
  if (p.printerId && totals.printerShare > 0) shares.set(p.printerId, totals.printerShare);
  if (p.illustratorId && totals.illustratorShare > 0) shares.set(p.illustratorId, (shares.get(p.illustratorId) ?? 0) + totals.illustratorShare);
  return [...shares].map(([memberId, amount]) => ({ memberId, pct: exactPct(amount, totals.total) }));
}

const expenseId = (jobId: string, what: 'materials' | 'courier') => `print-${jobId}-${what}`;

/** The courier fee and the materials (when the rate card has costs) as the job's expenses; gone when there's none. */
async function writeExpenses(jobId: string, number: string, p: PrintJob, totals: ReturnType<typeof printTotals>, date: string) {
  const want: Omit<Expense, 'createdAt' | 'updatedAt'>[] = [];
  if (totals.materialCost > 0)
    want.push({ id: expenseId(jobId, 'materials'), date, category: 'Printing', amount: totals.materialCost, vendor: 'Sticker printing', jobId, note: `Materials for ${totals.a4} A4 sheet${totals.a4 === 1 ? '' : 's'}, ${number}` });
  if (totals.delivery > 0)
    want.push({ id: expenseId(jobId, 'courier'), date, category: 'Transport', amount: totals.delivery, vendor: p.delivery.courier || 'Courier', jobId, note: `Delivery of ${number}${p.delivery.tracking ? `, tracking ${p.delivery.tracking}` : ''}` });
  for (const what of ['materials', 'courier'] as const) {
    const id = expenseId(jobId, what);
    const prev = await db.expenses.get(id);
    const next = want.find((x) => x.id === id);
    if (next) await save(db.expenses, { ...(prev ?? build<Expense>(next)), ...next, deleted: 0 });
    else if (prev && prev.deleted !== 1) await save(db.expenses, { ...prev, deleted: 1 });
  }
}

/** A new order, or changes to one: the job, its client, price, shares and expenses follow. */
export async function savePrintOrder(jobId: string | null, o: PrintOrderInput): Promise<{ jobId: string; number: string; created: boolean }> {
  check(o);
  const rates = await getSetting('printRates');
  const [prevJob, prevMoney] = jobId ? await Promise.all([db.jobs.get(jobId), db.jobMoney.get(jobId)]) : [undefined, undefined];
  if (jobId && (!prevJob || prevJob.deleted === 1)) throw new Error('That order no longer exists.');
  const was = prevMoney?.print;
  const client = await clientFor(o);
  const print: PrintJob = {
    lines: o.lines.map((l) => ({ ...l, label: l.label.trim() })),
    delivery: { ...o.delivery, courier: o.delivery.courier.trim(), address: o.delivery.address.trim(), tracking: o.delivery.tracking.trim(), fee: o.delivery.method === 'courier' ? Math.max(0, o.delivery.fee) : 0 },
    contact: o.contact.trim(),
    printerId: o.printerId,
    printerPct: Math.max(0, o.printerPct),
    illustratorId: o.illustratorId,
    illustratorPct: Math.max(0, o.illustratorPct),
    designNo: o.designNo.trim().toUpperCase(),
    files: o.files.trim(),
    notes: o.notes.trim(),
    downPct: was?.downPct ?? rates.downPct,
    proofAt: was?.proofAt ?? null,
    approvedAt: was?.approvedAt ?? null,
    doneAt: was?.doneAt ?? null,
  };
  const discount = o.coupon?.discount ?? 0;
  const totals = printTotals(print, discount);
  const people = [...new Set([print.printerId, print.illustratorId].filter((x): x is string => !!x))];
  const fields: Partial<Job> = {
    title: printTitle(print.lines),
    type: 'Sticker Printing',
    clientId: client.id,
    clientName: client.name,
    designers: people,
    lead: print.printerId ?? print.illustratorId ?? null,
    brief: briefOf(print),
    revisionsIncluded: 0,
  };
  let job: Job;
  if (prevJob) job = await save(db.jobs, { ...prevJob, ...fields, deleted: 0 });
  else {
    job = await create<Job>(db.jobs, {
      number: await nextJobNo(), priority: 'med', startDate: todayISO(), dueDate: '', rush: false, source: 'Sticker printing', budgetNote: '', ...(fields as Required<Pick<Job, 'title' | 'type' | 'clientId' | 'clientName' | 'designers' | 'lead' | 'brief' | 'revisionsIncluded'>>),
    });
    await create<JobProgress>(db.jobProgress, { ...EMPTY_PROGRESS, status: 'not-started', id: job.id });
  }
  // The design files as a link on the job, for whoever prints or draws it.
  const progress = await db.jobProgress.get(job.id);
  if (progress) {
    const others = progress.links.filter((l) => l.label !== 'Design files');
    const links = print.files ? [{ label: 'Design files', url: print.files }, ...others] : others;
    if (JSON.stringify(links) !== JSON.stringify(progress.links)) await save(db.jobProgress, { ...progress, links });
  }
  const money: Omit<JobMoney, 'createdAt' | 'updatedAt'> = {
    ...(prevMoney ?? { taxWithheld: 0, form2307: 'na' as const, invoiceNo: '' }),
    id: job.id,
    total: totals.total,
    items: itemsOf(print.lines, print.delivery),
    discountAmount: totals.discount,
    couponCode: o.coupon?.code,
    couponId: o.coupon?.couponId,
    deductionPct: 0,
    split: splitOf(print, totals),
    notes: `Sticker printing order. ${print.printerId ? `Printer: ${print.printerPct}% of the print work${totals.discount ? ' after the coupon' : ''}, ${peso(totals.printerShare)}.` : 'No printer set yet.'}${print.illustratorId && totals.illustration ? ` Illustrator: ${print.illustratorPct}% of the illustration, ${peso(totals.illustratorShare)}.` : ''}`,
    print,
    deleted: 0,
  };
  await save(db.jobMoney, (prevMoney ? { ...prevMoney, ...money } : build<JobMoney>(money)) as JobMoney);
  await writeExpenses(job.id, job.number, print, totals, job.startDate || todayISO());
  await recomputeEarnings([job.id]);
  if (prevMoney && prevMoney.total !== totals.total) await audit('price', 'job', job.id, `${job.number}: ${peso(prevMoney.total)} → ${peso(totals.total)}`);
  if (!prevJob) await audit('create', 'job', job.id, `${job.number}: sticker printing for ${client.name}, ${peso(totals.total)}`);
  return { jobId: job.id, number: job.number, created: !prevJob };
}

async function getOrder(jobId: string): Promise<{ job: Job; money: JobMoney; print: PrintJob }> {
  const [job, money] = await Promise.all([db.jobs.get(jobId), db.jobMoney.get(jobId)]);
  if (!job || job.deleted === 1 || !money?.print) throw new Error('That order no longer exists.');
  return { job, money, print: money.print };
}

async function patchPrint(jobId: string, changes: Partial<PrintJob>): Promise<void> {
  const { money, print } = await getOrder(jobId);
  await save(db.jobMoney, { ...money, print: { ...print, ...changes } });
}

export const markProofSent = (jobId: string) => patchPrint(jobId, { proofAt: Date.now() });

/** The customer approved the proof: it's ready by the end of the lead time (working days). */
export async function approvePrint(jobId: string): Promise<string> {
  const { job } = await getOrder(jobId);
  const rates = await getSetting('printRates');
  const due = addWorkingDays(todayISO(), rates.leadDays.max);
  await patchPrint(jobId, { approvedAt: Date.now() });
  await save(db.jobs, { ...job, dueDate: due });
  await audit('job', 'job', jobId, `${job.number}: proof approved, ready by ${due}`);
  return due;
}

/** What's paid and still due, with the down payment to start. */
export async function printBalance(jobId: string) {
  const { money, print } = await getOrder(jobId);
  const payments = alive(await db.payments.where('jobId').equals(jobId).toArray());
  const b = jobBalance(money, payments);
  const t = printTotals(print, money.discountAmount);
  return { ...b, down: t.down, downPaid: b.paid >= t.down };
}

/** Move an order to a column. Done needs the balance paid; moving back from Done reopens it. */
export async function setPrintStage(jobId: string, stage: PrintStage): Promise<void> {
  const { job, print } = await getOrder(jobId);
  if (stage === 'done') {
    const b = await printBalance(jobId);
    if (b.balance > 0) throw new Error(`${job.number} still has ${peso(b.balance)} to pay. Record the balance first.`);
    await saveProgress(jobId, { status: 'completed' });
    await patchPrint(jobId, { doneAt: Date.now() });
    await audit('status', 'job', jobId, `${job.number}: handed over`);
    return;
  }
  if (print.doneAt) await patchPrint(jobId, { doneAt: null });
  await saveProgress(jobId, { status: STAGE_STATUS[stage] });
}

/** Where an order is, for the board. */
export const stageOf = (progress: Pick<JobProgress, 'status'> | undefined, print: PrintJob) => printStage(progress?.status ?? 'not-started', print);
export { PRINT_STAGE_LABEL };

// ----- the rate card -----

export async function savePrintRates(r: PrintRates): Promise<void> {
  await setSetting('printRates', { ...r, ratesVersion: 2 });
  await audit('price', 'settings', 'printRates', 'Saved the sticker printing rate card');
}

/** The POS's own rate card, when the POS is used on this device (opened read-only). */
export async function readDevicePosRates(): Promise<PrintRates | null> {
  if (!(await Dexie.exists('jworks-pos'))) return null;
  const pos = new Dexie('jworks-pos');
  try {
    await pos.open();
    if (!pos.tables.some((t) => t.name === 'settings')) return null;
    const row = (await pos.table('settings').get('printRates')) as { value?: unknown; deleted?: 0 | 1 } | undefined;
    return row && row.deleted !== 1 && row.value ? ratesFrom(row.value) : null;
  } catch {
    return null;
  } finally {
    pos.close();
  }
}

/** The order's lines and totals, for the quote slip. */
export const orderLines = (p: PrintJob) => p.lines.map((l) => ({ label: l.label, qty: l.qty, unitPrice: l.unitPrice, amount: lineTotal(l) }));

/** The date the order was made, as YYYY-MM-DD. */
export const orderDate = (job: Pick<Job, 'startDate' | 'createdAt'>) => job.startDate || isoDate(job.createdAt);

import { alive, db } from '../../db/db';
import { getSetting } from '../../db/settings';
import { invoiceTotals, jobBalance } from '../../domain/money';
import { deliverPdf, renderPdf } from '../../reports/pdf';
import { buildInvoicePdf, buildReceiptPdf } from '../../reports/studioDocs';
import { invoiceEmail, receiptEmail, reminderEmail, type InvoiceEmailData } from '../../email/templates';
import { sendEmail } from '../../email/send';
import { safeFileName } from '../../lib/files';
import { daysFrom, todayISO } from '../../lib/time';
import type { Invoice } from '../../db/types';

/** PDFs and emails for invoices and receipts, built from the saved records. */

const EMAIL_RE = /[^@\s,/]+@[^@\s,/]+\.[^@\s,/]+/;

async function invoiceBundle(id: string) {
  const inv = await db.invoices.get(id);
  if (!inv) throw new Error('That invoice no longer exists.');
  const [business, payMethods, payments, client] = await Promise.all([
    getSetting('business'),
    getSetting('payMethods'),
    inv.jobId ? db.payments.where('jobId').equals(inv.jobId).toArray() : Promise.resolve([]),
    inv.clientId ? db.clients.get(inv.clientId) : Promise.resolve(undefined),
  ]);
  const jobPayments = alive(payments);
  const today = todayISO();
  const t = invoiceTotals(inv, jobPayments, today);
  const email = client?.email || EMAIL_RE.exec(inv.billTo.emailPhone)?.[0] || '';
  return { inv, business, payMethods, jobPayments, t, email, today };
}

const emailData = (inv: Invoice, t: ReturnType<typeof invoiceTotals>): InvoiceEmailData => ({
  number: inv.number,
  clientName: inv.billTo.contact || inv.billTo.name,
  total: t.total,
  paid: t.paid,
  balance: t.balance,
  dueDate: inv.dueDate,
  items: inv.items.map((i) => ({ label: `${i.addOn ? 'Add-on: ' : ''}${i.label}${i.qty > 1 ? ` × ${i.qty}` : ''}`, amount: i.amount })),
});

const invoicePdf = async (b: Awaited<ReturnType<typeof invoiceBundle>>) => buildInvoicePdf(b.inv, { business: b.business, payMethods: b.payMethods, jobPayments: b.jobPayments, today: b.today });
const invoiceFile = (b: Awaited<ReturnType<typeof invoiceBundle>>) => `${safeFileName(`${b.inv.number} ${b.inv.billTo.name}`)}.pdf`;

export async function shareInvoice(id: string): Promise<void> {
  const b = await invoiceBundle(id);
  await deliverPdf(await invoicePdf(b), invoiceFile(b));
}

/** Email the invoice (or a reminder). Returns the address it went to. */
export async function emailInvoice(id: string, kind: 'invoice' | 'reminder' = 'invoice', to?: string): Promise<string> {
  const b = await invoiceBundle(id);
  const address = to || b.email;
  if (!address) throw new Error('This client has no email address. Add one to the client or the invoice’s Bill to.');
  const data = emailData(b.inv, b.t);
  const mail = kind === 'invoice' ? invoiceEmail(b.business, data, b.payMethods) : reminderEmail(b.business, data, b.payMethods, b.inv.dueDate ? daysFrom(b.inv.dueDate, b.today) : 0);
  const attachments = [{ name: invoiceFile(b), blob: await renderPdf(await invoicePdf(b)) }];
  await sendEmail({ email: address, name: data.clientName }, mail, { what: `${kind === 'invoice' ? 'invoice' : 'reminder for'} ${b.inv.number}`, attachments });
  if (kind === 'invoice' && b.inv.status === 'draft') await db.invoices.update(id, { status: 'sent', sentAt: Date.now(), updatedAt: Date.now(), _sync: 1 });
  return address;
}

async function receiptBundle(paymentId: string) {
  const p = await db.payments.get(paymentId);
  if (!p) throw new Error('That payment no longer exists.');
  const [business, payMethods, job, money, client] = await Promise.all([
    getSetting('business'),
    getSetting('payMethods'),
    p.jobId ? db.jobs.get(p.jobId) : Promise.resolve(undefined),
    p.jobId ? db.jobMoney.get(p.jobId) : Promise.resolve(undefined),
    p.clientId ? db.clients.get(p.clientId) : Promise.resolve(undefined),
  ]);
  let balanceAfter: number | null = null;
  if (p.jobId && money) {
    const upTo = alive(await db.payments.where('jobId').equals(p.jobId).toArray()).filter((x) => x.date < p.date || (x.date === p.date && x.createdAt <= p.createdAt));
    balanceAfter = jobBalance(money, upTo).balance;
  }
  const payer = client?.name || job?.clientName || '';
  const forWhat = job ? `${job.number} · ${job.title}` : p.note;
  return { p, business, payMethods, payer, forWhat, balanceAfter, email: client?.email ?? '', contact: client?.contactName || payer };
}

const receiptPdf = async (r: Awaited<ReturnType<typeof receiptBundle>>) => buildReceiptPdf(r.p, { business: r.business, payer: r.payer, forWhat: r.forWhat, balanceAfter: r.balanceAfter, payMethods: r.payMethods });
const receiptFile = (r: Awaited<ReturnType<typeof receiptBundle>>) => `${safeFileName(`${r.p.receiptNo} ${r.payer}`)}.pdf`;

export async function shareReceipt(paymentId: string): Promise<void> {
  const r = await receiptBundle(paymentId);
  await deliverPdf(await receiptPdf(r), receiptFile(r));
}

export async function emailReceipt(paymentId: string, to?: string): Promise<string> {
  const r = await receiptBundle(paymentId);
  const address = to || r.email;
  if (!address) throw new Error('This client has no email address. Add one in Clients.');
  await sendEmail(
    { email: address, name: r.contact },
    receiptEmail(r.business, { clientName: r.contact, amount: r.p.amount, receiptNo: r.p.receiptNo, date: r.p.date, method: r.p.method, forWhat: r.forWhat, balanceAfter: r.balanceAfter }),
    { what: `receipt ${r.p.receiptNo}`, attachments: [{ name: receiptFile(r), blob: await renderPdf(await receiptPdf(r)) }] },
  );
  return address;
}

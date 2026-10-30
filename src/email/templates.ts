import { peso } from '../lib/money';
import { fmtIsoDate } from '../lib/time';
import type { BusinessSettings, StudioPayMethod } from '../db/types';

/**
 * Branded emails: a table layout with inline styles (what Gmail, Outlook and
 * phone mail apps render reliably), the letterhead's teal-to-gold bar, the
 * JoshWorks logo, and a plain-text copy (it helps keep mail out of spam).
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  /** Images shown inside the email (cid → data URL), e.g. the payment QR codes. */
  inline?: Record<string, string>;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const PUBLIC_BASE = 'https://jaderans.github.io/jworks_studio/';

/** Where the published app (and its email logo) lives. Emails sent while testing on this computer still link to the live site. */
export function appBase(): string {
  if (typeof window === 'undefined' || /^(localhost|127\.|192\.168\.)/.test(window.location.hostname)) return PUBLIC_BASE;
  return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
}

const INK = '#231F20';
const TEAL = '#167D88';
const GOLD = '#FEC756';
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

interface Layout {
  preheader: string;
  heading: string;
  paragraphs: string[];
  rows?: [string, string][];
  highlight?: { label: string; value: string };
  button?: { label: string; url: string };
  methods?: StudioPayMethod[];
  note?: string;
  signoff?: string;
}

function layout(b: BusinessSettings, l: Layout): string {
  const logo = `${appBase()}brand/email-logo.png`;
  const p = (t: string) => `<p style="margin:0 0 14px;font:15px/1.6 ${FONT};color:#3A3536">${t}</p>`;
  const rows = l.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border-collapse:collapse;background:#F1F8F9;border-radius:12px">
        ${l.rows
          .map(
            ([k, v], i) =>
              `<tr><td style="padding:10px 16px;font:13px ${FONT};color:#5B5556;${i ? 'border-top:1px solid #DCEBEC;' : ''}">${esc(k)}</td><td align="right" style="padding:10px 16px;font:600 14px ${FONT};color:${INK};${i ? 'border-top:1px solid #DCEBEC;' : ''}">${esc(v)}</td></tr>`,
          )
          .join('')}
      </table>`
    : '';
  const highlight = l.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="padding:16px 18px;border:2px solid ${TEAL};border-radius:12px">
        <div style="font:600 12px ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${TEAL}">${esc(l.highlight.label)}</div>
        <div style="font:800 28px/1.2 ${FONT};color:${INK};margin-top:4px">${esc(l.highlight.value)}</div>
      </td></tr></table>`
    : '';
  const button = l.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="border-radius:999px;background:${GOLD}">
        <a href="${esc(l.button.url)}" style="display:inline-block;padding:13px 26px;font:700 15px ${FONT};color:${INK};text-decoration:none;border-radius:999px">${esc(l.button.label)}</a>
      </td></tr></table>`
    : '';
  // Only the QR codes: account names and numbers never go out by email.
  const qrs = payableMethods(l.methods);
  const methods = qrs.length
    ? `<div style="font:700 13px ${FONT};color:${TEAL};letter-spacing:.06em;text-transform:uppercase;margin:6px 0 8px">Where to pay</div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F1F8F9;border-radius:12px"><tr>${qrs
         .map((m) => `<td align="center" valign="top" style="padding:14px 8px"><img src="cid:${qrCid(m)}" width="140" alt="${esc(m.label)} QR code" style="display:block;width:140px;max-width:100%;height:auto;border:4px solid #FFFFFF;border-radius:8px"><div style="font:700 12px ${FONT};color:${INK};margin-top:6px">Scan to pay · ${esc(m.label)}</div></td>`)
         .join('')}</tr></table>`
    : '';
  const contact = [b.address, b.email, b.website].filter(Boolean).map((x) => esc(x as string)).join(' &middot; ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(l.heading)}</title></head>
<body style="margin:0;padding:0;background:#EDF2F2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDF2F2"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border-collapse:separate">
    <tr><td style="padding:0;line-height:0;font-size:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="60%" style="height:6px;background:${TEAL}"></td><td width="40%" style="height:6px;background:#ECC039"></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:26px 30px 6px"><img src="${logo}" width="180" alt="JoshWorks · Graphic Designer" style="display:block;width:180px;max-width:60%;height:auto;border:0"></td></tr>
    <tr><td style="padding:14px 30px 0">
      <h1 style="margin:0 0 14px;font:800 23px/1.3 ${FONT};color:${INK}">${esc(l.heading)}</h1>
      ${l.paragraphs.map(p).join('')}
      ${highlight}${rows}${button}${methods}
      ${l.note ? `<p style="margin:0 0 14px;font:13px/1.55 ${FONT};color:#6B6566">${l.note}</p>` : ''}
      ${p(l.signoff ?? `Thank you,<br><strong>${esc(b.name || 'JoshWorks')}</strong>`)}
    </td></tr>
    <tr><td style="padding:16px 30px 22px;border-top:1px solid #EEF0F0">
      <p style="margin:0;font:12px/1.6 ${FONT};color:#8A8485">${esc(b.name || 'JoshWorks')} &middot; Graphic Design Studio<br>${contact}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function plain(l: Layout, b: BusinessSettings): string {
  const strip = (s: string) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&middot;/g, '·');
  return [
    l.heading,
    '',
    ...l.paragraphs.map(strip),
    ...(l.highlight ? ['', `${l.highlight.label}: ${l.highlight.value}`] : []),
    ...(l.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(l.button ? ['', `${l.button.label}: ${l.button.url}`] : []),
    ...(payableMethods(l.methods).length ? ['', `To pay, scan the QR code in this email (${payableMethods(l.methods).map((m) => m.label).join(', ')}).`] : []),
    ...(l.note ? ['', strip(l.note)] : []),
    '',
    strip(l.signoff ?? `Thank you,\n${b.name || 'JoshWorks'}`),
    '',
    [b.name, b.address, b.email].filter(Boolean).join(' · '),
  ].join('\n');
}

/** Methods shown to clients: turned on and with a QR code. Their account names and numbers are never sent. */
function payableMethods(methods: StudioPayMethod[] | undefined): StudioPayMethod[] {
  return (methods ?? []).filter((m) => m.on && m.qrImage);
}
const qrCid = (m: StudioPayMethod) => `qr${m.id.replace(/[^a-z0-9]/gi, '')}`;

const build = (b: BusinessSettings, subject: string, l: Layout): EmailContent => ({
  subject,
  html: layout(b, l),
  text: plain(l, b),
  inline: Object.fromEntries(payableMethods(l.methods).filter((m) => m.qrImage).map((m) => [qrCid(m), m.qrImage])),
});

// ----- the emails -----

/** A new team member's login: the app link, their email and the temporary password the owner made. */
export function inviteEmail(b: BusinessSettings, o: { name: string; email: string; link: string; role: string; from: string; password?: string }): EmailContent {
  return build(b, `Your JoshWorks Studio account is ready`, {
    preheader: 'Your login for JoshWorks Studio: jobs, clients, documents and your pay in one place.',
    heading: `Hi ${o.name}, your JoshWorks Studio account is ready`,
    paragraphs: [
      `${esc(o.from)} added you to the JoshWorks team as <strong>${esc(o.role)}</strong>. The app keeps our jobs, clients, documents, money and content calendar in one place, on your phone or laptop.`,
      o.password
        ? 'Open the link below and sign in with your email and the temporary password. Right after, you choose your own password and get a short guide to the app.'
        : 'Open the link below and sign in with your email and password.',
    ],
    rows: [['Email', o.email], ...(o.password ? ([['Temporary password', o.password]] as [string, string][]) : [])],
    button: { label: 'Sign in to JoshWorks Studio', url: o.link },
    note: 'Keep this password private; it stops working once you choose your own. On your phone, add the app to your home screen (Share → Add to Home Screen) so it opens like an app.',
    signoff: `See you inside,<br><strong>${esc(o.from)}</strong>`,
  });
}

export interface InvoiceEmailData {
  number: string;
  clientName: string;
  total: number;
  paid: number;
  balance: number;
  dueDate: string;
  items: { label: string; amount: number }[];
}

export function invoiceEmail(b: BusinessSettings, inv: InvoiceEmailData, methods: StudioPayMethod[]): EmailContent {
  return build(b, `Invoice ${inv.number} from ${b.name || 'JoshWorks'}`, {
    preheader: `Balance due ${peso(inv.balance)}${inv.dueDate ? ` by ${fmtIsoDate(inv.dueDate)}` : ''}.`,
    heading: `Invoice ${inv.number}`,
    paragraphs: [`Hi ${esc(inv.clientName || 'there')}, here’s your invoice for the work we’re doing together.`],
    highlight: { label: inv.balance > 0 ? 'Balance due' : 'Fully paid', value: peso(inv.balance > 0 ? inv.balance : inv.total) },
    rows: [
      ...inv.items.slice(0, 8).map((i) => [i.label, peso(i.amount)] as [string, string]),
      ['Total', peso(inv.total)],
      ...(inv.paid ? ([['Payments received', `−${peso(inv.paid)}`]] as [string, string][]) : []),
      ...(inv.dueDate ? ([['Due by', fmtIsoDate(inv.dueDate)]] as [string, string][]) : []),
    ],
    methods,
    note: `The invoice PDF is attached. Please use <strong>${esc(inv.number)}</strong> as your payment reference and send us a screenshot of the receipt.`,
  });
}

export function reminderEmail(b: BusinessSettings, inv: InvoiceEmailData, methods: StudioPayMethod[], overdueDays: number): EmailContent {
  const late = overdueDays > 0;
  return build(b, late ? `Reminder: invoice ${inv.number} is past due` : `Friendly reminder: invoice ${inv.number}`, {
    preheader: `${peso(inv.balance)} is still open on ${inv.number}.`,
    heading: late ? 'A quick reminder about your balance' : 'A friendly reminder',
    paragraphs: [
      `Hi ${esc(inv.clientName || 'there')}, this is a ${late ? 'gentle' : 'quick'} reminder that <strong>${peso(inv.balance)}</strong> is still open on invoice ${esc(inv.number)}${inv.dueDate ? `, ${late ? `due ${fmtIsoDate(inv.dueDate)}` : `due on ${fmtIsoDate(inv.dueDate)}`}` : ''}.`,
      'Final files are released once the balance is settled. If you’ve already paid, thank you, and please send us the receipt so we can match it.',
    ],
    highlight: { label: 'Balance', value: peso(inv.balance) },
    methods,
  });
}

export function receiptEmail(b: BusinessSettings, o: { clientName: string; amount: number; receiptNo: string; date: string; method: string; forWhat: string; balanceAfter: number | null }): EmailContent {
  return build(b, `Payment received · ${o.receiptNo}`, {
    preheader: `We received ${peso(o.amount)}. Thank you!`,
    heading: 'Payment received. Thank you!',
    paragraphs: [`Hi ${esc(o.clientName || 'there')}, we’ve received your payment.`],
    highlight: { label: 'Amount received', value: peso(o.amount) },
    rows: [
      ['Receipt no.', o.receiptNo],
      ['Date', fmtIsoDate(o.date)],
      ['Paid by', o.method],
      ...(o.forWhat ? ([['For', o.forWhat]] as [string, string][]) : []),
      ...(o.balanceAfter !== null ? ([['Remaining balance', o.balanceAfter > 0 ? peso(o.balanceAfter) : 'Fully paid']] as [string, string][]) : []),
    ],
    note: 'The receipt PDF is attached. It is an acknowledgment receipt for your records, not a BIR official receipt.',
  });
}

export function quoteEmail(b: BusinessSettings, o: { clientName: string; number: string; total: number; validUntil: string; items: { label: string; amount: number }[]; downPct: number }): EmailContent {
  return build(b, `Your quote from ${b.name || 'JoshWorks'} (${o.number})`, {
    preheader: `Total ${peso(o.total)}, valid until ${fmtIsoDate(o.validUntil)}.`,
    heading: 'Here’s your quote',
    paragraphs: [`Hi ${esc(o.clientName || 'there')}, thank you for reaching out. Here’s what we recommend and what it costs.`],
    rows: [...o.items.slice(0, 10).map((i) => [i.label, peso(i.amount)] as [string, string]), ['Total', peso(o.total)], [`${o.downPct}% down payment to start`, peso(Math.round((o.total * o.downPct) / 100))]],
    note: `The quotation PDF is attached. It is valid until ${fmtIsoDate(o.validUntil)}. Reply to this email to go ahead, and we’ll send the contract.`,
  });
}

/** The studio profile & rate card, sent to a client or agency that asked for "all your rates". */
export function rateCardEmail(b: BusinessSettings, o: { name: string; company: string; validUntil: string; portfolioUrl?: string; confidential: boolean }): EmailContent {
  const studio = b.name || 'JoshWorks';
  const url = o.portfolioUrl?.trim();
  return build(b, `${studio} studio profile & rate card${o.company ? ` for ${o.company}` : ''}`, {
    preheader: `Our services, process and rates, valid until ${fmtIsoDate(o.validUntil)}.`,
    heading: 'Our studio profile & rate card',
    paragraphs: [
      `Hi ${esc(o.name || 'there')}, thank you for your interest in ${esc(studio)}. Attached is our studio profile and rate card: who we are, what we do, how we work and our current rates.`,
      'These are baseline rates. Send us the scope and timeline of a project, and we’ll reply with an exact quote.',
    ],
    ...(url ? { button: { label: 'See our portfolio', url: /^https?:\/\//i.test(url) ? url : `https://${url}` } } : {}),
    note: `The rates are valid until ${fmtIsoDate(o.validUntil)}.${o.confidential ? ' They are shared for your internal reference only.' : ''} Reply to this email anytime; we usually answer within a business day.`,
  });
}

export function contractEmail(
  b: BusinessSettings,
  o: { clientName: string; number: string; title: string; total: number; down: number; signUrl?: string },
  methods: StudioPayMethod[] = [],
): EmailContent {
  return build(b, `Your ${o.title} contract (${o.number})`, {
    preheader: `Your contract is ready. ${peso(o.down)} is due on signing.`,
    heading: 'Your contract is ready',
    paragraphs: [
      `Hi ${esc(o.clientName || 'there')}, your ${esc(o.title)} contract is ready. The PDF is attached: please read the terms, the questionnaire and the payment schedule.`,
      o.signUrl
        ? 'You can answer the questionnaire and sign online with the button below, or print, sign and send back the PDF.'
        : 'Please sign it and send it back (a clear photo or scan is fine). Once it’s signed and the down payment is in, we start right away.',
    ],
    rows: [
      ['Contract no.', o.number],
      ['Total project cost', peso(o.total)],
      ['Due on signing', peso(o.down)],
    ],
    button: o.signUrl ? { label: 'Review and sign online', url: o.signUrl } : undefined,
    methods,
  });
}

/** The questionnaire on its own, sent before the contract with a link to answer it online. */
export function questionnaireEmail(b: BusinessSettings, o: { clientName: string; title: string; url: string }): EmailContent {
  return build(b, `A few questions about your project (${o.title})`, {
    preheader: 'Answer the questionnaire online: it takes about 10 minutes.',
    heading: 'Tell us about your project',
    paragraphs: [
      `Hi ${esc(o.clientName || 'there')}, thank you for choosing JoshWorks. Before we start, please answer the ${esc(o.title)} online. It takes about 10 minutes, and most questions are tick boxes.`,
      'Your answers come straight to us and go into your contract, so we design with the right direction from day one.',
    ],
    button: { label: 'Answer the questionnaire', url: o.url },
  });
}

/** Settings → Email → Send a test. */
export function testEmail(b: BusinessSettings, methods: StudioPayMethod[]): EmailContent {
  return build(b, `Test email from ${b.name || 'JoshWorks'} Studio`, {
    preheader: 'Your studio emails are set up and on brand.',
    heading: 'Email is working',
    paragraphs: [
      'Studio emails go out from this Gmail for two jobs: inviting designers to approve and join their account, and sending clients their contracts, invoices and quotations (with the PDF attached), plus receipts and payment reminders. This is how they look.',
      'If this landed in Spam, open it, mark it <strong>Not spam</strong>, and add the studio Gmail to your contacts. That teaches Gmail to trust it.',
    ],
    highlight: { label: 'Sample balance due', value: peso(175000) },
    rows: [
      ['Invoice', 'JW-0000-2026'],
      ['Due', fmtIsoDate(new Date().toISOString().slice(0, 10))],
    ],
    methods,
  });
}

// ----- previews (Settings → Email) -----

export type SampleKind = 'invite' | 'contract' | 'invoice' | 'quote' | 'receipt';

/** Sample emails with made-up numbers, to see the design without sending anything. */
export function sampleEmail(kind: SampleKind, b: BusinessSettings, methods: StudioPayMethod[]): EmailContent {
  const today = new Date().toISOString().slice(0, 10);
  const items = [
    { label: 'Essential Branding', amount: 350000 },
    { label: 'Add-on: Rush (3–5 day turnaround)', amount: 87500 },
  ];
  switch (kind) {
    case 'invite':
      return inviteEmail(b, { name: 'Kaye', email: 'kaye@example.com', link: `${appBase()}#/login`, role: 'Manager', from: b.signatory?.split(',')[0] || 'Joshua', password: 'JW-K7QF-M2XP' });
    case 'contract':
      return contractEmail(b, { clientName: 'Kape Ilonggo', number: 'C-2026-001', title: 'Branding & Visual Identity Agreement', total: 437500, down: 218750, signUrl: `${appBase()}#/c` }, methods);
    case 'invoice':
      return invoiceEmail(b, { number: 'JW-0032-2026', clientName: 'Kape Ilonggo', total: 437500, paid: 218750, balance: 218750, dueDate: today, items }, methods);
    case 'quote':
      return quoteEmail(b, { clientName: 'Kape Ilonggo', number: 'Q-2026-001', total: 437500, validUntil: today, items, downPct: 50 });
    case 'receipt':
      return receiptEmail(b, { clientName: 'Kape Ilonggo', amount: 218750, receiptNo: 'AR-0001-2026', date: today, method: 'GCash', forWhat: 'COM-001 · Logo and brand kit', balanceAfter: 218750 });
  }
}

/** The email's HTML with its inline images (cid:) swapped for the images themselves, for an on-screen preview. */
export const previewHtml = (mail: EmailContent) => mail.html.replace(/cid:([a-z0-9]+)/gi, (m, cid: string) => mail.inline?.[cid] ?? m);

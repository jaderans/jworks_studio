import type { Content, TableCell } from 'pdfmake/interfaces';
import { frame, kpis, table, td, th, waterfall, INK, LINE, MUTED, TEAL } from './pdf';
import { docTotals, proposalTotals } from '../domain/pricing';
import { invoiceTotals, type MonthRow } from '../domain/money';
import { AUTHORITY_STATEMENT, BINDING, CLIENT_ACK, DESIGNER_ACK, OUR_GOAL, WHAT_WE_DO } from '../domain/contractTemplates';
import { UNIT_LABEL } from '../domain/packages';
import { fillTemplate } from '../domain/contract';
import { peso } from '../lib/money';
import { fmtIsoDate, fmtMonth } from '../lib/time';
import type {
  BusinessSettings, Contract, ContractTemplate, Earning, Invoice, Member, MoneySettings, Package, Payment, Payout, PayoutAccount, Proposal, RateSettings, StudioPayMethod,
} from '../db/types';

/**
 * The studio's documents on the JoshWorks letterhead (Legal size, brand-kit
 * frame): invoices, receipts, quotes and contracts, plus payout statements and
 * the income report. Every client document ends with where to pay.
 */

const HEAD = '#D3EEF2';
const HEAD_STRONG = '#B7E2E9';

// headlineLevel marks headings so a page never ends on one (see letterheadDoc).
const sectionTitle = (text: string): Content => ({ text: text.toUpperCase(), style: 'section', headlineLevel: 1 });
/** Invoice amounts read "PHP 3,500", like the studio's own invoice. */
const php = (n: number) => `PHP ${peso(n).replace('₱', '')}`;

/** A tick box drawn with lines (fonts don't all have ☐ ☑). */
function box(checked: boolean, label: string): Content {
  return {
    columns: [
      {
        width: 11,
        canvas: [
          { type: 'rect', x: 0, y: 1.5, w: 8.5, h: 8.5, lineWidth: 0.8, lineColor: INK, r: 1.5 },
          ...(checked
            ? [
                { type: 'line', x1: 1.8, y1: 6, x2: 3.8, y2: 8, lineWidth: 1.4, lineColor: TEAL },
                { type: 'line', x1: 3.8, y1: 8, x2: 7.2, y2: 3, lineWidth: 1.4, lineColor: TEAL },
              ]
            : []),
        ],
      },
      { text: label, bold: checked, fontSize: 8.5 },
    ],
    columnGap: 4,
  } as Content;
}

const gridLayout = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => '#9FB4B7',
  vLineColor: () => '#9FB4B7',
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

/** Where clients pay: the studio's methods, with QR codes when they were added in Settings. */
export function paymentDetails(methods: StudioPayMethod[], fallback = ''): Content[] {
  const on = methods.filter((m) => m.on && (m.accountNumber || m.qrImage || m.accountName));
  if (!on.length) return fallback ? [sectionTitle('Payment details'), { text: fallback }] : [];
  const cells: TableCell[] = on.map((m) => ({
    stack: [
      ...(m.qrImage ? [{ image: m.qrImage, fit: [110, 110], alignment: 'center', margin: [0, 0, 0, 4] }] : []),
      { text: m.label, bold: true, alignment: 'center', color: TEAL },
      ...(m.accountName ? [{ text: m.accountName, alignment: 'center', fontSize: 8.5 }] : []),
      ...(m.accountNumber ? [{ text: m.accountNumber, alignment: 'center', fontSize: 8.5, bold: true }] : []),
    ],
    margin: [0, 4, 0, 4],
  })) as TableCell[];
  const rows: TableCell[][] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row = cells.slice(i, i + 3);
    while (row.length < 3) row.push({ text: '' });
    rows.push(row);
  }
  return [sectionTitle('Payment details'), { table: { widths: ['*', '*', '*'], body: rows, dontBreakRows: true }, layout: 'noBorders', margin: [0, 0, 0, 6] } as Content];
}

const studioLines = (b: BusinessSettings) =>
  [b.name ? `${b.name} — Graphic Design Studio` : '', b.address?.toUpperCase(), b.email, b.website || (b.handles?.facebook ? `facebook.com/${b.handles.facebook.replace(/^@/, '')}` : '')].filter(Boolean) as string[];

// ----- invoice -----

export interface InvoiceCtx {
  business: BusinessSettings;
  payMethods: StudioPayMethod[];
  jobPayments: Payment[];
  today: string;
}

/** The JoshWorks invoice, laid out like the studio's own Word invoice. */
export async function buildInvoicePdf(inv: Invoice, ctx: InvoiceCtx) {
  const t = invoiceTotals(inv, ctx.jobPayments, ctx.today);
  const status = inv.status === 'void' ? 'void' : t.state;
  const b = ctx.business;
  const from = studioLines(b);
  const billRows: [string, string][] = [
    ['Client / Organization:', inv.billTo.name],
    ['Contact Person:', inv.billTo.contact],
    ['Address:', inv.billTo.address],
    ['Email / Phone:', inv.billTo.emailPhone],
  ];
  const items = inv.items.length ? inv.items : [];
  const minRows = Math.max(items.length, 6);
  const content: Content[] = [
    { text: 'JOSHWORKS INVOICE', style: 'docTitle' },
    {
      table: {
        dontBreakRows: true,
        widths: ['*', '*', '*', 170],
        body: [
          [th('Invoice no.'), th('Invoice date'), th('Due date'), th('Payment status')].map((c) => ({ ...(c as object), fillColor: '#FFFFFF', color: INK })) as TableCell[],
          [
            { text: inv.number, bold: true },
            { text: fmtIsoDate(inv.issueDate) },
            { text: inv.dueDate ? fmtIsoDate(inv.dueDate) : '—' },
            {
              columns: [box(status === 'paid', 'PAID'), box(status === 'unpaid', 'UNPAID'), box(status === 'partial', 'PARTIAL')],
              columnGap: 4,
            },
          ] as TableCell[],
        ],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 10],
    } as Content,
    {
      table: {
        dontBreakRows: true,
        widths: ['*', 90, '*'],
        body: [
          [{ text: 'FROM', bold: true, fillColor: HEAD_STRONG, fontSize: 8 }, { text: 'BILL TO', bold: true, fillColor: HEAD_STRONG, fontSize: 8, colSpan: 2 }, {}],
          ...billRows.map(([label, value], i) => [{ text: from[i] ?? '', fontSize: 8.5 }, { text: label, fontSize: 8, color: MUTED }, { text: value || '', fontSize: 8.5, bold: i === 0 }]),
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 12],
    } as Content,
    sectionTitle('Items & Services'),
    {
      table: {
        dontBreakRows: true,
        headerRows: 1,
        widths: [26, '*', 40, 90],
        body: [
          [th('No.'), th('Design details / description'), th('Qty', true), th('Amount', true)].map((c) => ({ ...(c as object), fillColor: HEAD })) as TableCell[],
          ...Array.from({ length: minRows }, (_, i) => {
            const it = items[i];
            return [
              { text: String(i + 1), color: MUTED },
              { text: it ? `${it.addOn ? 'Add-on: ' : ''}${it.label}` : '' },
              { text: it ? String(it.qty) : '', alignment: 'right' },
              { text: it ? php(it.amount) : '', alignment: 'right' },
            ];
          }),
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 10],
    } as Content,
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 260,
          table: {
            dontBreakRows: true,
            widths: ['*', 110],
            body: [
              ['Subtotal', php(t.subtotal)],
              ['Add-ons (+)', `(+) ${php(t.addOns)}`],
              [inv.discountLabel ? `Discount (−) · ${inv.discountLabel}` : 'Discount (−)', `(−) ${php(t.discount)}`],
              ['TOTAL', php(t.total)],
              ['Less: Payments Received', php(t.paid)],
              ['BALANCE DUE', php(t.balance)],
            ].map(([a, v], i) => {
              const strong = i === 3 || i === 5;
              return [
                { text: a, bold: strong, fillColor: strong ? HEAD_STRONG : undefined, fontSize: 9 },
                { text: v, bold: strong, alignment: 'right', fillColor: strong ? HEAD_STRONG : undefined, fontSize: 9 },
              ];
            }) as TableCell[][],
          },
          layout: gridLayout,
        },
      ],
      margin: [0, 0, 0, 8],
    } as Content,
    ...paymentDetails(ctx.payMethods, b.paymentDetails),
  ];
  const notes = inv.notes.split('\n').map((n) => n.trim()).filter(Boolean);
  if (notes.length) content.push(sectionTitle('Notes & Terms'), { ul: notes, fontSize: 8.5, italics: true, color: INK } as Content);
  return frame({ title: `Invoice ${inv.number}`, business: b.name, footerNote: inv.number, letterhead: { frame: 'general', cover: true } }, content);
}

// ----- acknowledgment receipt -----

export async function buildReceiptPdf(p: Payment, ctx: { business: BusinessSettings; payer: string; forWhat: string; balanceAfter: number | null; payMethods: StudioPayMethod[] }) {
  const content: Content[] = [
    { text: 'ACKNOWLEDGMENT RECEIPT', style: 'docTitle' },
    {
      table: {
        dontBreakRows: true,
        widths: ['*', '*'],
        body: [
          [th('Receipt no.'), th('Date received')],
          [{ text: p.receiptNo || '—', bold: true }, { text: fmtIsoDate(p.date) }],
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 14],
    } as Content,
    { text: [{ text: 'Received from ' }, { text: ctx.payer || '________________________', bold: true }, { text: ' the amount of' }], margin: [0, 0, 0, 6] },
    { text: peso(p.amount, { decimals: 2 }), font: 'ManropeX', fontSize: 26, color: TEAL, margin: [0, 0, 0, 6] },
    { text: [{ text: 'For: ' }, { text: ctx.forWhat || '________________________', bold: true }], margin: [0, 0, 0, 12] },
    {
      table: {
        dontBreakRows: true,
        widths: [130, '*'],
        body: [
          ['Payment', { down: 'Down payment', final: 'Final payment', partial: 'Partial payment', full: 'Full payment' }[p.kind]],
          ['Paid by', p.method],
          ['Reference no.', p.reference || '—'],
          ...(ctx.balanceAfter !== null ? [['Balance after this payment', ctx.balanceAfter > 0 ? peso(ctx.balanceAfter) : 'Fully paid']] : []),
        ].map(([a, v]) => [{ text: a, color: MUTED, fontSize: 8.5 }, { text: v, bold: true }]) as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 14],
    } as Content,
    { text: 'Thank you! Please keep this for your records.', margin: [0, 0, 0, 30] },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 220,
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
            { text: `Received by, for ${ctx.business.name}`, style: 'muted', margin: [0, 3, 0, 0] },
          ],
        },
      ],
    } as Content,
    { text: 'This is an acknowledgment receipt for the studio’s records. It is not a BIR official receipt or invoice.', style: 'muted', margin: [0, 24, 0, 0] },
  ];
  return frame({ title: `Receipt ${p.receiptNo}`, business: ctx.business.name, footerNote: p.receiptNo, letterhead: { frame: 'general', cover: true } }, content);
}

// ----- quote -----

export async function buildQuotePdf(p: Proposal, ctx: { business: BusinessSettings; rates: RateSettings; packages: Package[]; payMethods: StudioPayMethod[]; money: MoneySettings }) {
  const t = proposalTotals(p, ctx.rates);
  const pkgById = new Map(ctx.packages.map((x) => [x.id, x]));
  const included = p.items.map((i) => (i.packageId ? pkgById.get(i.packageId) : undefined)).filter((x): x is Package => !!x && x.includes.length > 0);
  const monthly = p.items.some((i) => i.unit === 'month');
  const ordered = [...p.items.filter((i) => i.unit !== 'percent'), ...p.items.filter((i) => i.unit === 'percent')];
  const content: Content[] = [
    { text: 'QUOTATION', style: 'docTitle' },
    {
      table: {
        dontBreakRows: true,
        widths: ['*', 110, 110],
        body: [
          [th('Prepared for'), th('Quote no.'), th('Date · valid until')],
          [{ text: p.clientName || '—', bold: true }, { text: p.number, bold: true }, { text: `${fmtIsoDate(p.date)} · ${fmtIsoDate(p.validUntil)}` }],
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 12],
    } as Content,
  ];
  if (p.intro.trim()) content.push({ text: p.intro.trim(), margin: [0, 0, 0, 10], lineHeight: 1.35 });
  content.push(
    sectionTitle('Items'),
    table(
      ['*', 'auto', 'auto', 'auto'],
      [th('Item'), th('Qty', true), th('Price', true), th('Amount', true)],
      t.lines.map((l, idx) => {
        const item = ordered[idx];
        const priceText = item?.unit === 'percent' ? `+${(item.unitPrice / 100).toFixed(0)}%` : `${peso(l.unitPrice)} ${item ? UNIT_LABEL[item.unit] : ''}`.trim();
        return [td(l.monthly ? `${l.label} (${l.months} months)` : l.label), td(l.qty, true), td(priceText, true), td(peso(l.amount), true)];
      }),
    ),
    waterfall([
      ...(monthly ? [{ label: 'Monthly fee', value: `${peso(t.perMonth)} a month`, kind: 'sub' as const }] : []),
      { label: 'Subtotal', value: peso(t.gross) },
      ...(t.discount ? [{ label: p.discountLabel || 'Discount', value: `−${peso(t.discount)}`, kind: 'sub' as const }] : []),
      ...(p.vat ? [{ label: `VAT ${ctx.rates.vatPct}%`, value: peso(t.vat), kind: 'sub' as const }] : []),
      { label: 'Total', value: peso(t.invoice), kind: 'final' },
      { label: `${ctx.money.downPct}% down payment to start`, value: peso(Math.round((t.invoice * ctx.money.downPct) / 100)), kind: 'sub' as const },
    ]),
  );
  for (const pkg of included) content.push({ text: `${pkg.name}: what’s included`, style: 'h3' }, { ul: [...pkg.includes, ...(pkg.revisions ? [`Revisions: ${pkg.revisions}`] : []), ...(pkg.turnaround ? [`Turnaround: ${pkg.turnaround}`] : [])], fontSize: 8.5 } as Content);
  content.push(
    sectionTitle('Terms'),
    {
      ul: [
        `Full payment or a ${ctx.money.downPct}% down payment before work starts; the balance is due before the final files are released.`,
        `This quote is valid until ${fmtIsoDate(p.validUntil)}. A contract follows once you accept.`,
        'Extra revision rounds are +15% of the package; rush (3–5 days) is +25%; editable source files are +20%.',
        'Printing and physical production are quoted separately.',
      ],
      fontSize: 8.5,
    } as Content,
  );
  if (p.notes.trim()) content.push(sectionTitle('Notes'), { text: p.notes.trim(), fontSize: 8.5 });
  content.push(...paymentDetails(ctx.payMethods, ctx.business.paymentDetails));
  return frame({ title: `Quote ${p.number}`, business: ctx.business.name, footerNote: p.number, letterhead: { frame: 'general', cover: true } }, content);
}

// ----- contract from a template -----

export interface ContractCtx {
  business: BusinessSettings;
  packages: Package[];
  payMethods: StudioPayMethod[];
  payments: Payment[];
}

/** A v1.0 contract, filled in: the studio's own contract layout, on the matching letterhead. */
export async function buildTemplateContractPdf(c: Contract, tpl: ContractTemplate, ctx: ContractCtx) {
  const f = c.fields;
  const items = c.items ?? [];
  const totals = docTotals(items, c.discountAmount ?? 0);
  const down = Math.round((totals.net * (c.downPct ?? 50)) / 100);
  const chosen = new Set(items.map((i) => i.packageId).filter(Boolean));
  const audience = tpl.audience === 'student' || /student/i.test(tpl.subtitle) ? 'student' : 'business';
  const blank = (v?: string) => (v && v.trim() ? v.trim() : '______________________');
  const mainCats = tpl.categories.filter((x) => x !== 'Add-ons' && x !== 'Ownership');
  const pkgs = ctx.packages.filter((p) => p.active === 1 && p.kind !== 'addon' && mainCats.includes(p.category ?? ''));
  const addOns = ctx.packages.filter((p) => p.active === 1 && p.kind === 'addon' && tpl.categories.includes(p.category ?? ''));
  const priceOf = (p: Package) => (p.unit === 'percent' ? `+${p.price / 100}% of package price` : `${peso(audience === 'student' && p.studentPrice ? p.studentPrice : p.price)} ${UNIT_LABEL[p.unit]}`.trim());

  const content: Content[] = [
    { text: 'JOSHWORKS', font: 'Sora', fontSize: 22, color: INK, alignment: 'center' },
    { text: c.title || tpl.name, font: 'Sora', fontSize: 14, color: TEAL, alignment: 'center' },
    { text: tpl.tagline, style: 'muted', alignment: 'center', margin: [0, 0, 0, 8] },
    {
      table: {
        dontBreakRows: true,
        widths: ['*', '*', '*'],
        body: [
          [th('Contract no.'), th('Date made'), th('Pricing tier')],
          [{ text: c.number, bold: true }, { text: f.date ? fmtIsoDate(f.date) : fmtIsoDate(new Date(c.createdAt).toISOString().slice(0, 10)) }, { text: c.subtitle || tpl.subtitle }],
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 10],
    } as Content,
    sectionTitle('Welcome to JoshWorks'),
    { text: tpl.welcome, fontSize: 9, margin: [0, 0, 0, 4] },
    { text: [{ text: 'What We Do: ', bold: true }, WHAT_WE_DO], fontSize: 9, margin: [0, 0, 0, 4] },
    { text: [{ text: 'Our Goal: ', bold: true }, OUR_GOAL], fontSize: 9, margin: [0, 0, 0, 4] },
    { text: [{ text: 'This Agreement Covers: ', bold: true }, tpl.covers], fontSize: 9, margin: [0, 0, 0, 4] },
    sectionTitle('Our process — project phases'),
    {
      table: {
        dontBreakRows: true,
        widths: [46, '*'],
        body: tpl.phases.map((ph, i) => [
          { text: `PHASE\n${i + 1}`, bold: true, alignment: 'center', color: '#FFFFFF', fillColor: TEAL, fontSize: 8 },
          { stack: [{ text: ph.title, bold: true }, { text: ph.text, fontSize: 8.5 }] },
        ]) as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 4],
    } as Content,
    ...(tpl.phasesNote ? [{ text: tpl.phasesNote, style: 'muted' } as Content] : []),
    sectionTitle('Client information'),
    {
      table: {
        dontBreakRows: true,
        widths: [118, '*', 70, 110],
        body: [
          [{ text: 'Client Name / Organization:', bold: true, fontSize: 8.5 }, { text: f['client.name'] || '', fontSize: 9 }, { text: 'Date:', bold: true, fontSize: 8.5 }, { text: f.date ? fmtIsoDate(f.date) : '' }],
          [{ text: 'Contact Person:', bold: true, fontSize: 8.5 }, { text: f['client.contact'] || '', colSpan: 3 }, {}, {}],
          [{ text: 'Email:', bold: true, fontSize: 8.5 }, { text: f['client.email'] || '' }, { text: 'Phone Number:', bold: true, fontSize: 8.5 }, { text: f['client.phone'] || '' }],
          [{ text: 'Address:', bold: true, fontSize: 8.5 }, { text: f['client.address'] || '', colSpan: 3 }, {}, {}],
          [{ text: 'Website / Social Media:', bold: true, fontSize: 8.5 }, { text: f['client.web'] || '', colSpan: 3 }, {}, {}],
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 6],
    } as Content,
  ];

  if (pkgs.length) {
    content.push(sectionTitle(`${mainCats[0] ?? 'Package'} package selection`), { text: 'Selected package marked below.', style: 'muted', margin: [0, 0, 0, 4] });
    const cells: TableCell[] = pkgs.map((p) => {
      const on = chosen.has(p.id);
      return {
        stack: [
          { columns: [box(on, ''), { text: p.name, bold: true, color: on ? TEAL : INK }], columnGap: 2 },
          { text: priceOf(p), bold: true, margin: [0, 2, 0, 2] },
          ...(p.includes.length ? [{ ul: p.includes, fontSize: 8 }] : []),
          ...(p.revisions || p.turnaround ? [{ text: [p.revisions ? `Revisions: ${p.revisions}` : '', p.turnaround ? `  |  Turnaround: ${p.turnaround}` : ''].join(''), fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] }] : []),
        ],
        fillColor: on ? '#EAF7F8' : undefined,
      } as TableCell;
    });
    const rows: TableCell[][] = [];
    for (let i = 0; i < cells.length; i += 2) rows.push([cells[i], cells[i + 1] ?? { text: '' }]);
    content.push({ table: { widths: ['*', '*'], body: rows, dontBreakRows: true }, layout: gridLayout, margin: [0, 0, 0, 6] } as Content);
  }

  const otherLines = items.filter((i) => !i.packageId || !pkgs.some((p) => p.id === i.packageId));
  if (addOns.length) {
    content.push(sectionTitle('Optional add-ons'));
    const qtyOf = (id: string) => items.filter((i) => i.packageId === id).reduce((a, i) => a + i.qty, 0);
    content.push({
      table: {
        dontBreakRows: true,
        widths: ['*', 130],
        body: addOns.map((a) => [box(chosen.has(a.id), `${a.name}${qtyOf(a.id) > 1 ? ` × ${qtyOf(a.id)}` : ''}`), { text: priceOf(a), fontSize: 8.5 }]) as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 6],
    } as Content);
  }
  if (otherLines.filter((i) => !addOns.some((a) => a.id === i.packageId)).length) {
    content.push(sectionTitle('Items for this project'));
    content.push(
      table(
        ['*', 'auto', 'auto'],
        [th('Item'), th('Qty', true), th('Amount', true)],
        totals.lines.filter((l) => otherLines.some((o) => o.label === l.label)).map((l) => [td(l.label), td(l.qty, true), td(peso(l.amount), true)]),
      ),
    );
  }
  content.push({
    table: {
      dontBreakRows: true,
      widths: ['*', 160],
      body: [
        ...(totals.discount ? [[{ text: 'Discount', fontSize: 9 }, { text: `−${peso(totals.discount)}`, alignment: 'right' }]] : []),
        [{ text: 'TOTAL PROJECT COST', bold: true, fillColor: HEAD_STRONG }, { text: peso(totals.net), bold: true, alignment: 'right', fillColor: HEAD_STRONG }],
      ] as TableCell[][],
    },
    layout: gridLayout,
    margin: [0, 6, 0, 6],
  } as Content);

  if (tpl.brief.length) {
    content.push(sectionTitle(tpl.briefTitle || 'Project brief'));
    const answers = new Map((c.brief ?? []).map((b) => [b.q, b.a]));
    for (const q of tpl.brief) {
      const a = answers.get(q)?.trim();
      content.push({ text: q, bold: true, fontSize: 8.5, margin: [0, 4, 0, 2] });
      content.push({ table: { widths: ['*'], body: [[{ text: a || ' \n ', fontSize: 9 }]] }, layout: gridLayout } as Content);
    }
  }

  content.push(sectionTitle('Terms and conditions'));
  tpl.sections
    .filter((s) => s.on)
    .forEach((s, i) => {
      const body = fillTemplate(s.body, f);
      content.push({ text: `${i + 1}. ${s.title}`, bold: true, margin: [0, 6, 0, 2] }, { ul: body.split('\n').filter(Boolean), fontSize: 8.5 } as Content);
    });

  content.push(
    { text: 'CLIENT AGREEMENT STATEMENT', style: 'section', pageBreak: 'before' },
    { text: [{ text: 'By signing below, I, ' }, { text: blank(f.signer || f['client.contact']), bold: true }, { text: ', acknowledge and agree to the following:' }], margin: [0, 0, 0, 6] },
    { ul: tpl.agreement.map((a) => ({ text: a, fontSize: 8.5 })), margin: [0, 0, 0, 6] } as Content,
    { text: AUTHORITY_STATEMENT, bold: true, fontSize: 8.5, margin: [0, 0, 0, 8] },
    sectionTitle('Project timeline'),
    {
      table: {
        dontBreakRows: true,
        widths: [150, '*'],
        body: [
          [{ text: 'Project Start Date:', bold: true }, { text: f.startDate ? fmtIsoDate(f.startDate) : '' }],
          [{ text: 'Expected Completion Date:', bold: true }, { text: f.endDate ? fmtIsoDate(f.endDate) : '' }],
        ] as TableCell[][],
      },
      layout: gridLayout,
    } as Content,
    sectionTitle('Payment schedule'),
    {
      table: {
        dontBreakRows: true,
        widths: [190, '*'],
        body: [
          [{ text: 'Rush Service Requested (+25% of package price)?', bold: true, fontSize: 8.5 }, { columns: [box(!!c.rush, 'Yes'), box(!c.rush, 'No')], columnGap: 8 }],
          [{ text: 'Payment Method:', bold: true, fontSize: 8.5 }, { text: f.paymentMethod || '' }],
          [{ text: 'Initial Payment Due:', bold: true, fontSize: 8.5 }, { text: `${peso(down)}  (due upon signing)` }],
          [{ text: 'Final Payment Due:', bold: true, fontSize: 8.5 }, { text: `${peso(totals.net - down)}  (due before file delivery)` }],
          [
            { text: 'Payment Received:', bold: true, fontSize: 8.5 },
            {
              columns: [box(ctx.payments.some((p) => p.kind === 'down' || p.kind === 'full' || p.kind === 'partial'), 'Initial Payment'), box(ctx.payments.some((p) => p.kind === 'final' || p.kind === 'full'), 'Final Payment')],
              columnGap: 8,
            },
          ],
        ] as TableCell[][],
      },
      layout: gridLayout,
      margin: [0, 0, 0, 6],
    } as Content,
    ...paymentDetails(ctx.payMethods, ctx.business.paymentDetails),
    sectionTitle('Signatures'),
    {
      columns: [
        {
          stack: [
            { text: 'CLIENT ACKNOWLEDGMENT', bold: true, fontSize: 8.5 },
            { text: CLIENT_ACK, fontSize: 8, margin: [0, 2, 0, 26] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
            { text: `Client Name & Signature${f.signer ? `: ${f.signer}` : ''}`, style: 'muted', margin: [0, 2, 0, 18] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
            { text: 'Date', style: 'muted', margin: [0, 2, 0, 0] },
          ],
        },
        {
          stack: [
            { text: 'DESIGNER ACKNOWLEDGMENT', bold: true, fontSize: 8.5 },
            { text: DESIGNER_ACK, fontSize: 8, margin: [0, 2, 0, 26] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
            { text: `Designer Name & Signature${f.designer ? `: ${f.designer}` : ''}`, style: 'muted', margin: [0, 2, 0, 18] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
            { text: 'Date', style: 'muted', margin: [0, 2, 0, 0] },
          ],
        },
      ],
      columnGap: 24,
    } as Content,
    { text: BINDING, style: 'muted', margin: [0, 18, 0, 0] },
  );
  return frame({ title: `${c.title || tpl.name} ${c.number}`, business: ctx.business.name, footerNote: c.number, letterhead: { frame: c.frame ?? tpl.frame } }, content);
}

// ----- payout statement (for a designer) -----

export async function buildPayoutStatementPdf(m: Member, ctx: { business: BusinessSettings; earnings: Earning[]; payouts: Payout[]; jobsById: Map<string, { number: string; title: string }>; account: PayoutAccount | null }) {
  const earned = ctx.earnings.reduce((a, e) => a + e.amount, 0);
  const paid = ctx.payouts.reduce((a, p) => a + p.amount, 0);
  const byJob = new Map<string, number>();
  for (const e of ctx.earnings) byJob.set(e.jobId, (byJob.get(e.jobId) ?? 0) + e.amount);
  const content: Content[] = [
    { text: 'PAYOUT STATEMENT', style: 'docTitle' },
    { text: [{ text: m.name, bold: true }, { text: m.roleLabel ? ` · ${m.roleLabel}` : '' }], alignment: 'center', margin: [0, 0, 0, 10] },
    kpis([
      { label: 'Earned', value: peso(earned) },
      { label: 'Paid out', value: peso(paid) },
      { label: 'Still owed', value: peso(Math.max(0, earned - paid)) },
    ], 3),
    sectionTitle('Earned per job'),
    table(['auto', '*', 'auto'], [th('Job'), th('Title'), th('Earned', true)], [...byJob.entries()].map(([id, amt]) => [td(ctx.jobsById.get(id)?.number ?? '—'), td(ctx.jobsById.get(id)?.title ?? ''), td(peso(amt), true)])),
    sectionTitle('Payouts'),
    table(['auto', '*', 'auto'], [th('Date'), th('Method · reference'), th('Amount', true)], ctx.payouts.map((p) => [td(fmtIsoDate(p.date)), td([p.method, p.reference].filter(Boolean).join(' · ')), td(peso(p.amount), true)])),
  ];
  if (ctx.account) {
    content.push(sectionTitle('Paid to'), { text: [ctx.account.method, ctx.account.accountName, ctx.account.accountNumber].filter(Boolean).join(' · ') });
  }
  return frame({ title: `Payout statement · ${m.name}`, business: ctx.business.name, letterhead: { frame: 'general', cover: true } }, content);
}

// ----- income report -----

export async function buildIncomeReportPdf(rows: MonthRow[], ctx: { business: BusinessSettings; members: Member[]; top: { name: string; total: number; jobs: number }[]; title: string }) {
  const sum = (k: keyof Pick<MonthRow, 'booked' | 'received' | 'net' | 'expenses' | 'pending'>) => rows.reduce((a, r) => a + r[k], 0);
  const people = ctx.members.filter((m) => rows.some((r) => r.byMember[m.id]));
  const content: Content[] = [
    { text: ctx.title, style: 'h1' },
    kpis([
      { label: 'Booked', value: peso(sum('booked')) },
      { label: 'Received', value: peso(sum('received')) },
      { label: 'Net after deduction', value: peso(sum('net')) },
      { label: 'Expenses', value: peso(sum('expenses')) },
    ]),
    { text: 'By month', style: 'h2' },
    table(
      ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
      [th('Month'), th('Booked', true), th('Received', true), th('Net', true), th('Pending', true), th('Expenses', true), th('Target', true)],
      rows.map((r) => [
        td(fmtMonth(r.month)),
        td(peso(r.booked), true),
        td(peso(r.received), true),
        td(peso(r.net), true),
        td(peso(r.pending), true),
        td(peso(r.expenses), true),
        td(r.target ? `${peso(r.target.low)}–${peso(r.target.high)}` : '—', true),
      ]),
    ),
    { text: 'Team earnings', style: 'h2' },
    table(
      ['*', 'auto'],
      [th('Person'), th('Earned', true)],
      people.map((m) => [td(m.name), td(peso(rows.reduce((a, r) => a + (r.byMember[m.id] ?? 0), 0)), true)]),
    ),
    { text: 'Top clients', style: 'h2' },
    table(['*', 'auto', 'auto'], [th('Client'), th('Jobs', true), th('Total', true)], ctx.top.map((t) => [td(t.name), td(t.jobs, true), td(peso(t.total), true)])),
    { text: 'Received = payments by the date they came in. Booked = job totals by start date. Net = received less the standard deduction.', style: 'muted', margin: [0, 10, 0, 0] },
  ];
  return frame({ title: ctx.title, business: ctx.business.name }, content);
}

export { LINE };

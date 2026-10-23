import type { Content, TableCell } from 'pdfmake/interfaces';
import { frame, kpis, nodePages, table, td, th, waterfall, INK, LINE, MUTED, TEAL } from './pdf';
import { docTotals, proposalTotals } from '../domain/pricing';
import { invoiceTotals, type MonthRow } from '../domain/money';
import { AUTHORITY_STATEMENT, BINDING, CLIENT_ACK, DESIGNER_ACK, OUR_GOAL, WHAT_WE_DO } from '../domain/contractTemplates';
import { UNIT_LABEL } from '../domain/packages';
import { fillTemplate } from '../domain/contract';
import { contractAudience, deliverablesOf } from '../domain/contractPlan';
import { answerFor, parseQuestionnaire } from '../domain/questionnaire';
import { peso } from '../lib/money';
import { fmtDateTime, fmtIsoDate, fmtMonth, isoDate } from '../lib/time';
import type {
  BusinessSettings, Contract, ContractSection, ContractTemplate, Earning, Invoice, Member, MoneySettings, Package, Payment, Payout, PayoutAccount, Proposal, RateSettings, StudioPayMethod,
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

/**
 * Where clients pay: only the QR codes added in Settings, each with its method's
 * name. Account names and numbers are never printed (documents get forwarded).
 */
export function paymentDetails(methods: StudioPayMethod[], fallback = ''): Content[] {
  const on = methods.filter((m) => m.on && m.qrImage);
  if (!on.length) return fallback ? [sectionTitle('Payment details'), { text: fallback }] : [];
  const cells: TableCell[] = on.map((m) => ({
    stack: [
      { image: m.qrImage, fit: [110, 110], alignment: 'center', margin: [0, 0, 0, 4] },
      { text: `Scan to pay · ${m.label}`, bold: true, alignment: 'center', color: TEAL },
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
  /** Business or student prices (the editor works it out from the contract, template and client). */
  audience?: 'business' | 'student';
  /** The job's COM number, for the header. */
  jobNumber?: string;
}

const LINE_W = 470;
const answerLine = (): Content => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: LINE_W, y2: 0, lineWidth: 0.6, lineColor: '#9FB4B7' }], margin: [14, 2, 0, 6] });

/** The questionnaire as the studio prints it: numbered questions with lines to write on, tick-box grids, answers already given filled in. */
function questionnaireBlock(title: string, lines: readonly string[], answers: Contract['brief']): Content[] {
  const out: Content[] = [{ text: (title || 'Project questionnaire').toUpperCase(), font: 'Sora', fontSize: 12, alignment: 'center', margin: [0, 0, 0, 6], pageBreak: 'before' }];
  for (const it of parseQuestionnaire(lines)) {
    if (it.kind === 'intro') out.push({ text: it.text, fontSize: 9, margin: [0, 0, 0, 8] });
    else if (it.kind === 'section') out.push({ text: it.title, bold: true, fontSize: 9.5, margin: [0, 8, 0, 4], headlineLevel: 1 } as Content);
    else {
      const a = answerFor(answers, it.q);
      out.push({ text: `${it.n}.  ${it.q}`, fontSize: 8.8, margin: [0, 4, 0, 2] });
      if (it.kind === 'open') {
        if (a?.a.trim()) out.push({ text: a.a.trim(), fontSize: 9, color: TEAL, margin: [14, 2, 0, 0] });
        else out.push({ text: ' ', fontSize: 9, margin: [0, 6, 0, 0] });
        out.push(answerLine());
        continue;
      }
      // Options in their written order: plain ones fill rows, an "Other:"-style option gets a row of its own with a line.
      const rows: TableCell[][] = [];
      let row: TableCell[] = [];
      const flush = () => {
        if (!row.length) return;
        while (row.length < it.cols) row.push({ text: '' });
        rows.push(row);
        row = [];
      };
      for (const o of it.options) {
        const on = !!a?.picks?.includes(o.label);
        if (!o.fill) {
          row.push(box(on, o.label) as TableCell);
          if (row.length === it.cols) flush();
          continue;
        }
        flush();
        rows.push([
          {
            colSpan: it.cols,
            columns: [
              { width: 'auto', ...(box(on, o.label) as object) },
              on && a?.a.trim() ? { text: a.a.trim(), color: TEAL, fontSize: 8.5, margin: [6, 1, 0, 0] } : { canvas: [{ type: 'line', x1: 6, y1: 10, x2: 260, y2: 10, lineWidth: 0.6, lineColor: '#9FB4B7' }] },
            ],
          } as TableCell,
          ...Array.from({ length: it.cols - 1 }, () => ({}) as TableCell),
        ]);
      }
      flush();
      out.push({ table: { widths: Array.from({ length: it.cols }, () => '*'), body: rows, dontBreakRows: true }, layout: { ...gridLayout, paddingTop: () => 3, paddingBottom: () => 3 }, margin: [14, 2, 0, 6] } as Content);
    }
  }
  return out;
}

/** Terms and conditions as one block, so a layout pass can check it sits on a single page. */
function termsBlock(sections: ContractSection[], fields: Record<string, string>, size: number, twoCols: boolean): Content[] {
  const on = sections.filter((s) => s.on);
  const gap = size >= 8.5 ? 5 : size >= 8 ? 4 : 3;
  const part = (list: ContractSection[], from: number): Content[] =>
    list.map((s, i) => ({
      stack: [
        { text: `${from + i + 1}. ${s.title}`, bold: true, fontSize: size + 0.6, margin: [0, i || from ? gap : 0, 0, 1] },
        { ul: fillTemplate(s.body, fields).split('\n').filter(Boolean), fontSize: size, lineHeight: 1.12 },
      ],
    }));
  const half = Math.ceil(on.length / 2);
  const body: Content = twoCols
    ? { columns: [{ stack: part(on.slice(0, half), 0) }, { stack: part(on.slice(half), half) }], columnGap: 16 }
    : { stack: part(on, 0) };
  return [
    { text: 'TERMS AND CONDITIONS', style: 'section', pageBreak: 'before', margin: [0, 0, 0, 6] },
    { ...(body as object), id: 'terms' } as Content,
  ];
}

/** A v1.0 contract, filled in: the studio's own contract layout, on the matching letterhead. */
export async function buildTemplateContractPdf(c: Contract, tpl: ContractTemplate, ctx: ContractCtx) {
  const f = c.fields;
  const items = c.items ?? [];
  const totals = docTotals(items, c.discountAmount ?? 0);
  const down = Math.round((totals.net * (c.downPct ?? 50)) / 100);
  const chosen = new Set(items.map((i) => i.packageId).filter(Boolean));
  const audience = ctx.audience ?? contractAudience(f.rates, tpl.audience, 'business');
  const blank = (v?: string) => (v && v.trim() ? v.trim() : '______________________');
  const mainCats = tpl.categories.filter((x) => x !== 'Add-ons' && x !== 'Ownership');
  const pkgs = ctx.packages.filter((p) => p.active === 1 && p.kind !== 'addon' && mainCats.includes(p.category ?? ''));
  const addOns = ctx.packages.filter((p) => p.active === 1 && p.kind === 'addon' && tpl.categories.includes(p.category ?? ''));
  const priceOf = (p: Package) => (p.unit === 'percent' ? `+${p.price / 100}% of package price` : `${peso(audience === 'student' && p.studentPrice ? p.studentPrice : p.price)} ${UNIT_LABEL[p.unit]}`.trim());
  const made = f.date || new Date(c.createdAt).toISOString().slice(0, 10);
  const dateText = (iso?: string) => (iso ? fmtIsoDate(iso) : '');
  const label = (text: string) => ({ text, bold: true, fontSize: 8.5 });

  const content: Content[] = [
    { text: 'JOSHWORKS', font: 'Sora', fontSize: 22, color: INK, alignment: 'center' },
    { text: c.title || tpl.name, font: 'Sora', fontSize: 14, color: TEAL, alignment: 'center' },
    { text: tpl.tagline, style: 'muted', alignment: 'center', margin: [0, 0, 0, 8] },
    {
      table: {
        dontBreakRows: true,
        widths: ['*', '*', '*', '*'],
        body: [
          [th('Contract no.'), th('Job no.'), th('Date made'), th('Prices valid until')],
          [{ text: c.number, bold: true }, { text: ctx.jobNumber || '—' }, { text: fmtIsoDate(made) }, { text: f.validUntil ? fmtIsoDate(f.validUntil) : '—' }],
          [{ ...(th('Prepared for') as object), fillColor: '#FFFFFF' }, { text: f['client.name'] || '', bold: true, colSpan: 3 }, {}, {}],
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
    ...(f.scope?.trim() ? [{ text: [{ text: 'This Project: ', bold: true }, f.scope.trim()], fontSize: 9, margin: [0, 0, 0, 4] } as Content] : []),
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
          [label('Client Name / Organization:'), { text: f['client.name'] || '', fontSize: 9 }, label('Date:'), { text: dateText(made) }],
          [label('Contact Person:'), { text: f['client.contact'] || '', colSpan: 3 }, {}, {}],
          [label('Email:'), { text: f['client.email'] || '' }, label('Phone Number:'), { text: f['client.phone'] || '' }],
          [label('Address:'), { text: f['client.address'] || '', colSpan: 3 }, {}, {}],
          [label('Website / Social Media:'), { text: f['client.web'] || '', colSpan: 3 }, {}, {}],
          ...(audience === 'business' ? [[label('TIN:'), { text: f['client.tin'] || '', colSpan: 3 }, {}, {}]] : []),
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

  // What the client receives and by when.
  const deliverables = deliverablesOf(items, ctx.packages);
  const milestones = (c.milestones ?? []).filter((m) => m.title.trim());
  if (deliverables.length || milestones.length) {
    content.push(sectionTitle('Deliverables & milestones'));
    if (deliverables.length) content.push({ text: 'You will receive:', bold: true, fontSize: 8.5, margin: [0, 0, 0, 2] }, { ul: deliverables, fontSize: 8.5, margin: [0, 0, 0, 6] } as Content);
    if (milestones.length)
      content.push({
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*', 92, '*'],
          body: [
            [th('Milestone'), th('Target date'), th('What you receive')],
            ...milestones.map((m) => [{ text: m.title, bold: true, fontSize: 8.5 }, { text: m.date ? fmtIsoDate(m.date) : '', fontSize: 8.5 }, { text: m.what, fontSize: 8.5 }]),
          ] as TableCell[][],
        },
        layout: gridLayout,
        margin: [0, 0, 0, 4],
      } as Content);
    content.push({ text: 'Dates assume the down payment and complete materials arrive on the start date, and replies within the agreed time.', style: 'muted' });
  }

  if (tpl.brief.length) content.push(...questionnaireBlock(tpl.briefTitle, tpl.brief, c.brief));

  // Agreement, schedule and signatures share one page; where to pay (with the QR codes) follows.
  const tight = { ...gridLayout, paddingTop: () => 3, paddingBottom: () => 3 };
  const afterTerms: Content[] = [
    { text: 'CLIENT AGREEMENT STATEMENT', style: 'section', pageBreak: 'before' },
    { text: [{ text: 'By signing below, I, ' }, { text: blank(f.signer || f['client.contact']), bold: true }, { text: ', acknowledge and agree to the following:' }], fontSize: 9, margin: [0, 0, 0, 4] },
    { ul: tpl.agreement.map((a) => ({ text: a, fontSize: 8.2 })), lineHeight: 1.12, margin: [0, 0, 0, 4] } as Content,
    { text: AUTHORITY_STATEMENT, bold: true, fontSize: 8.2, margin: [0, 0, 0, 4] },
    sectionTitle('Project timeline & payment schedule'),
    {
      table: {
        dontBreakRows: true,
        widths: [150, '*', 110, '*'],
        body: [
          [label('Project Start Date:'), { text: dateText(f.startDate) }, label('Expected Completion:'), { text: dateText(f.endDate) }],
          [label('Rush Service (+25% of package)?'), { columns: [box(!!c.rush, 'Yes'), box(!c.rush, 'No')], columnGap: 8 }, label('Payment Method:'), { text: f.paymentMethod || '' }],
          [label('Initial Payment Due:'), { text: `${peso(down)} (upon signing)` }, label('Final Payment Due:'), { text: `${peso(totals.net - down)} (before file delivery)` }],
          [
            label('Payment Received:'),
            {
              colSpan: 3,
              columns: [box(ctx.payments.some((p) => p.kind === 'down' || p.kind === 'full' || p.kind === 'partial'), 'Initial Payment'), box(ctx.payments.some((p) => p.kind === 'final' || p.kind === 'full'), 'Final Payment')],
              columnGap: 8,
            },
            {},
            {},
          ],
        ] as TableCell[][],
      },
      layout: tight,
      margin: [0, 0, 0, 4],
    } as Content,
    sectionTitle('Communication & delivery'),
    {
      table: {
        dontBreakRows: true,
        widths: [150, '*'],
        body: [
          [label('Official channel:'), { text: f.channel || '', fontSize: 9 }],
          [label('Reply time & working hours:'), { text: f.hours || '', fontSize: 9 }],
          [label('How files are delivered:'), { text: f.delivery || '', fontSize: 9 }],
        ] as TableCell[][],
      },
      layout: tight,
      margin: [0, 0, 0, 4],
    } as Content,
    {
      unbreakable: true,
      stack: [
        sectionTitle('Signatures'),
        {
          columns: [
            signatureBlock('CLIENT ACKNOWLEDGMENT', CLIENT_ACK, 'Client', f.signer || '', c.clientSignature, c.signedOnline ? isoDate(c.signedOnline.at) : '', c.signedOnline ? `Signed online · ${fmtDateTime(c.signedOnline.at)}` : ''),
            signatureBlock('DESIGNER ACKNOWLEDGMENT', DESIGNER_ACK, 'Designer', f.designer || ctx.business.signatory || '', c.useSignature !== false ? ctx.business.signature : undefined, c.useSignature !== false && ctx.business.signature ? made : '', ''),
          ],
          columnGap: 24,
        },
        { text: BINDING, style: 'muted', margin: [0, 10, 0, 0] },
      ],
    } as Content,
    ...paymentDetails(ctx.payMethods, ctx.business.paymentDetails),
  ];

  const doc = (size: number, twoCols: boolean) =>
    frame({ title: `${c.title || tpl.name} ${c.number}`, business: ctx.business.name, footerNote: c.number, letterhead: { frame: c.frame ?? tpl.frame } }, [...content, ...termsBlock(c.sections, f, size, twoCols), ...afterTerms]);
  // The terms always fit on one page: try the house size first, then tighter, then two columns.
  for (const [size, two] of [[8.5, false], [8, false], [7.5, false], [8, true], [7.5, true]] as [number, boolean][]) {
    const d = await doc(size, two);
    if ((await nodePages(d)).get('terms')?.length === 1) return d;
  }
  return doc(7.5, true);
}

/**
 * One side of the signature block: who, the acknowledgment, the signature (if
 * saved or signed online) on the line, the signer's name in print below it, and
 * the date. `person` is "Name, Title"; the title goes on its own line.
 */
function signatureBlock(title: string, ack: string, role: 'Client' | 'Designer', person: string, signature: string | undefined, date: string, note: string): Content {
  const cut = person.indexOf(',');
  const name = (cut > 0 ? person.slice(0, cut) : person).trim();
  const role2 = cut > 0 ? person.slice(cut + 1).trim() : '';
  return {
    stack: [
      { text: title, bold: true, fontSize: 8.5 },
      { text: ack, fontSize: 8, margin: [0, 2, 0, signature ? 2 : 30] },
      // The signature sits on the line, clear of the printed name below it.
      ...(signature ? [{ image: signature, fit: [160, 46], margin: [6, 0, 0, 0] } as Content] : []),
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
      ...(name ? [{ text: name, bold: true, fontSize: 9.5, margin: [0, 4, 0, 0] } as Content] : []),
      ...(role2 ? [{ text: role2, fontSize: 8, color: MUTED } as Content] : []),
      { text: `${role} Name & Signature`, style: 'muted', fontSize: 7.5, margin: [0, name ? 1 : 3, 0, 0] },
      ...(note ? [{ text: note, style: 'muted', fontSize: 7, color: TEAL } as Content] : []),
      { text: date ? fmtIsoDate(date) : ' ', margin: [0, 8, 0, 0], fontSize: 9 },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.7, lineColor: MUTED }] },
      { text: 'Date', style: 'muted', margin: [0, 2, 0, 0] },
    ],
  };
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

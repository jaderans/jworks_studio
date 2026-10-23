import type { Content, TableCell } from 'pdfmake/interfaces';
import { barChartSvg, frame, kpis, signatureLine, table, td, th, waterfall, MUTED, TEAL } from './pdf';
import { fillTemplate } from '../domain/contract';
import { proposalTotals } from '../domain/pricing';
import { UNIT_LABEL } from '../domain/packages';
import { compactNumber, groupBy, totals, weeklySeries } from '../domain/metrics';
import { PLATFORMS } from '../domain/platforms';
import { STATUS_LABEL } from '../domain/calendar';
import { composeCaption } from '../domain/captions';
import { stripStyles } from '../domain/captions';
import { peso, formatPct } from '../lib/money';
import { fmtIsoDate, fmtIsoWeekday, fmtMonth } from '../lib/time';
import type { BusinessSettings, Client, Contract, Metric, Package, Post, Proposal, RateSettings } from '../db/types';

const contactLine = (b: BusinessSettings) => [b.name, b.registration, b.address, b.contact, b.email, b.website].filter(Boolean).join(' · ');

/** A client-facing proposal: what's included and what it costs (not our costs). */
export async function buildProposalPdf(p: Proposal, business: BusinessSettings, rates: RateSettings, packages: Package[]) {
  const t = proposalTotals(p, rates);
  const pkgById = new Map(packages.map((x) => [x.id, x]));
  const included = p.items.map((i) => (i.packageId ? pkgById.get(i.packageId) : undefined)).filter((x): x is Package => !!x && x.includes.length > 0);
  const monthly = p.items.some((i) => i.unit === 'month');
  const content: Content[] = [
    { text: 'Proposal', style: 'h1' },
    {
      columns: [
        { stack: [{ text: 'FOR', style: 'label' }, { text: p.clientName || '—', bold: true }] },
        { stack: [{ text: 'PROPOSAL', style: 'label', alignment: 'right' }, { text: p.number, bold: true, alignment: 'right' }, { text: `${fmtIsoDate(p.date)} · valid until ${fmtIsoDate(p.validUntil)}`, style: 'muted', alignment: 'right' }] },
      ],
      margin: [0, 6, 0, 12],
    },
  ];
  if (p.intro.trim()) content.push({ text: p.intro.trim(), margin: [0, 0, 0, 10], lineHeight: 1.35 });
  content.push(
    table(
      ['*', 'auto', 'auto', 'auto', 'auto'],
      [th('Item'), th('Qty', true), th('Months', true), th('Price', true), th('Amount', true)],
      t.lines.map((l, idx) => {
        const item = p.items.filter((i) => i.unit !== 'percent').concat(p.items.filter((i) => i.unit === 'percent'))[idx];
        const priceText = item?.unit === 'percent' ? `${(item.unitPrice / 100).toFixed(0)}%` : `${peso(l.unitPrice)} ${item ? UNIT_LABEL[item.unit] : ''}`.trim();
        return [td(l.label), td(l.qty, true), td(l.monthly ? l.months : '—', true), td(priceText, true), td(peso(l.amount), true)];
      }),
    ),
    waterfall([
      ...(monthly ? [{ label: 'Monthly fee', value: `${peso(t.perMonth)} a month`, kind: 'sub' as const }] : []),
      ...(t.oneTime ? [{ label: 'One-time work', value: peso(t.oneTime), kind: 'sub' as const }] : []),
      { label: 'Subtotal', value: peso(t.gross) },
      ...(t.discount ? [{ label: p.discountLabel || `Introductory discount (${p.discountPct}% for ${p.discountMonths} months)`, value: `−${peso(t.discount)}`, kind: 'sub' as const }] : []),
      ...(p.vat ? [{ label: `VAT ${rates.vatPct}%`, value: peso(t.vat), kind: 'sub' as const }] : []),
      { label: 'Total', value: peso(t.invoice), kind: 'final' },
      ...(p.ewt ? [{ label: `Less ${rates.ewtPct}% expanded withholding tax (with BIR 2307)`, value: `−${peso(t.ewt)}`, kind: 'sub' as const }, { label: 'Amount payable', value: peso(t.payable), kind: 'total' as const }] : []),
    ]),
  );
  for (const pkg of included) {
    content.push({ text: `${pkg.name}: what’s included`, style: 'h3' }, { ul: pkg.includes, margin: [0, 0, 0, 4] } as Content);
  }
  const terms = [
    monthly ? `Monthly services start with a minimum of ${Math.max(...p.items.filter((i) => i.unit === 'month').map((i) => i.months), 1)} months and are billed in two payments a month.` : '',
    p.items.some((i) => i.unit === 'project') ? '50% downpayment to start one-time projects, balance on delivery.' : '',
    'Two revision rounds per piece are included; more are billed per round. Rush work (within 24 hours) is +25%.',
    monthly ? 'Social media results depend on platform algorithms and your participation; we report every month and adjust.' : '',
    'A written agreement follows once you accept. Prices are in Philippine pesos.',
  ].filter(Boolean);
  content.push({ text: 'Terms', style: 'h3' }, { ul: terms, style: 'muted' } as Content);
  if (p.notes.trim()) content.push({ text: 'Notes', style: 'h3' }, { text: p.notes.trim(), style: 'muted' });
  if (business.paymentDetails.trim()) content.push({ text: 'How to pay', style: 'h3' }, { text: business.paymentDetails.trim() });
  content.push(
    { text: contactLine(business), style: 'muted', margin: [0, 18, 0, 0] },
    { columns: [signatureLine(`For ${business.name}`), signatureLine('Accepted by the client')], margin: [0, 24, 0, 0] } as Content,
  );
  return frame({ title: 'Proposal', subtitle: p.number, business: business.name }, content);
}

/** The agreement, with every {{field}} filled in. Unfilled fields print as blanks to complete by hand. */
export async function buildContractPdf(c: Contract, business: BusinessSettings) {
  const sections = c.sections.filter((s) => s.on);
  const content: Content[] = [
    { text: 'Social Media Management Agreement', style: 'h1' },
    { text: `${c.number}${c.fields.effectiveDate ? ` · starts ${c.fields.effectiveDate}` : ''}`, style: 'muted', margin: [0, 0, 0, 10] },
  ];
  sections.forEach((s, i) => {
    content.push({ text: `${i + 1}. ${s.title}`, style: 'h2' });
    const body = fillTemplate(s.body, c.fields);
    const lines = body.split('\n');
    const bullets = lines.filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, ''));
    const paras = lines.filter((l) => !/^\s*-\s+/.test(l) && l.trim());
    for (const para of paras) content.push({ text: para, lineHeight: 1.35, margin: [0, 0, 0, 4] });
    if (bullets.length) content.push({ ul: bullets, lineHeight: 1.3, margin: [0, 0, 0, 4] } as Content);
  });
  content.push(
    { text: `${sections.length + 1}. Signatures`, style: 'h2' },
    { text: 'Signed by the parties on the dates below.', style: 'muted' },
    {
      columns: [
        { stack: [signatureLine(`For ${c.fields['studio.name'] || business.name}: ${c.fields['studio.signatory'] || ''}`, c.useSignature !== false ? business.signature : undefined), signatureLine('Date')] },
        { stack: [signatureLine(`For ${c.fields['client.name'] || 'the Client'}: ${c.fields['client.contact'] || ''}`), signatureLine('Date')] },
      ],
      margin: [0, 18, 0, 0],
    } as Content,
  );
  return frame({ title: 'Agreement', subtitle: c.number, business: business.name, footerNote: `${c.number} · ${c.fields['client.name'] || ''}` }, content);
}

/** The monthly analytics report for a client (or for JoshWorks itself). */
export async function buildReportPdf(opts: { business: BusinessSettings; clientName: string; month: string; metrics: Metric[]; posts: Post[]; worked: string; next: string }) {
  const { business, metrics } = opts;
  const t = totals(metrics);
  const weekly = weeklySeries(metrics, 'views');
  const byPlatform = groupBy(metrics, (m) => [m.platform], (k) => PLATFORMS[k as keyof typeof PLATFORMS].label);
  const top = [...metrics].sort((a, b) => (b.saves ?? 0) + (b.shares ?? 0) - ((a.saves ?? 0) + (a.shares ?? 0))).slice(0, 8);
  const posted = opts.posts.filter((p) => p.status === 'posted').length;
  const content: Content[] = [
    { text: `${fmtMonth(opts.month)} report`, style: 'h1' },
    { text: opts.clientName, style: 'muted', margin: [0, 0, 0, 8] },
    kpis([
      { label: 'Posts published', value: String(posted || t.posts) },
      { label: 'Views', value: compactNumber(t.views) },
      { label: 'Reach', value: compactNumber(t.reach) },
      { label: 'Engagement rate', value: formatPct(t.engagementRate, 1), hint: 'likes + comments + saves + shares ÷ reach' },
      { label: 'Saves', value: compactNumber(t.saves), hint: 'people keeping it for later' },
      { label: 'Shares', value: compactNumber(t.shares), hint: 'people sending it to others' },
      { label: 'New follows', value: compactNumber(t.follows) },
      { label: 'Leads', value: compactNumber(t.leads), hint: 'DMs and inquiries' },
    ]),
  ];
  if (weekly.length > 1) content.push({ text: 'Views per week', style: 'h2' }, { svg: barChartSvg(weekly.map((w) => ({ label: fmtIsoDate(w.week).replace(/, \d{4}$/, ''), value: w.value }))) } as Content);
  if (top.length)
    content.push(
      { text: 'Best posts (by saves and shares)', style: 'h2' },
      table(['*', 'auto', 'auto', 'auto', 'auto'], [th('Post'), th('Platform'), th('Views', true), th('Saves', true), th('Shares', true)], top.map((m) => [td(m.title), td(PLATFORMS[m.platform].label), td(m.views ?? '—', true), td(m.saves ?? 0, true), td(m.shares ?? 0, true)])),
    );
  if (byPlatform.length > 1)
    content.push({ text: 'By platform', style: 'h2' }, table(['*', 'auto', 'auto', 'auto', 'auto'], [th('Platform'), th('Posts', true), th('Avg views', true), th('Saves', true), th('Shares', true)], byPlatform.map((g) => [td(g.label), td(g.posts, true), td(Math.round(g.avgViews), true), td(g.saves, true), td(g.shares, true)])));
  if (opts.worked.trim()) content.push({ text: 'What worked', style: 'h2' }, { text: opts.worked.trim(), lineHeight: 1.35 });
  if (opts.next.trim()) content.push({ text: 'Next month', style: 'h2' }, { text: opts.next.trim(), lineHeight: 1.35 });
  content.push({ text: contactLine(business), style: 'muted', margin: [0, 18, 0, 0] });
  return frame({ title: 'Monthly report', subtitle: opts.clientName, business: business.name }, content);
}

/** The month's posts for a client to approve: date, format, the caption as it will go out. */
export async function buildApprovalPdf(opts: { business: BusinessSettings; client: Client | null; month: string; posts: Post[] }) {
  const rows = [...opts.posts].filter((p) => p.date).sort((a, b) => (a.date as string).localeCompare(b.date as string));
  const content: Content[] = [
    { text: `Content plan · ${fmtMonth(opts.month)}`, style: 'h1' },
    { text: `${opts.client?.name ?? opts.business.name} · ${rows.length} posts`, style: 'muted', margin: [0, 0, 0, 6] },
    {
      text: `Please reply “Approved” or with your changes for each post${opts.client?.approvalHours ? ` within ${opts.client.approvalHours} hours` : ''}. Posts not answered in time may move to a later date.`,
      margin: [0, 0, 0, 10],
    },
  ];
  rows.forEach((p, i) => {
    const pf = p.platforms[0] ?? 'facebook';
    const caption = stripStyles(composeCaption(p, pf));
    content.push({
      table: {
        widths: ['auto', '*'],
        body: [
          [
            { text: `${i + 1}`, style: 'big', color: TEAL, rowSpan: 2 } as TableCell,
            { stack: [{ text: p.title, bold: true }, { text: `${fmtIsoWeekday(p.date as string)}${p.time ? ` · ${p.time}` : ''} · ${p.format || 'Post'} · ${p.platforms.map((k) => PLATFORMS[k].label).join(', ')} · ${STATUS_LABEL[p.status]}`, style: 'muted' }] },
          ],
          ['', { text: caption || '(caption to follow)', color: caption ? undefined : MUTED, lineHeight: 1.3 }],
        ],
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#DAE3E3', paddingTop: () => 6, paddingBottom: () => 6 },
      margin: [0, 0, 0, 8],
      unbreakable: caption.length < 900,
    } as Content);
    content.push({ text: '[   ] Approved      [   ] Changes: ________________________________________________', style: 'muted', margin: [24, -2, 0, 10] });
  });
  return frame({ title: 'Content plan for approval', subtitle: fmtMonth(opts.month), business: opts.business.name }, content);
}

import { percentOf, toCents, type Cents } from '../lib/money';
import type { Package, Proposal, ProposalItem, RateSettings } from '../db/types';

/**
 * Prices and margins. A package's cost is the hours it takes at the team's own
 * hourly rates, plus overhead; the margin shows whether the price pays for that
 * time. Margin = profit ÷ price (not markup — see the POS pricing calculator).
 */

/** JoshWorks' rates from the Pricing Calculator workbook (SETTINGS tab). */
export const DEFAULT_RATES: RateSettings = {
  roles: [
    { name: 'Creative Director / Owner', rate: toCents(500), covers: 'Concept, client pitching, final approval' },
    { name: 'Senior Designer', rate: toCents(380), covers: 'Branding, complex layout, art direction' },
    { name: 'Illustrator', rate: toCents(350), covers: 'Custom illustration, lettering, characters' },
    { name: 'Mid Designer', rate: toCents(280), covers: 'Social media sets, standard layout, reels' },
    { name: 'Junior Designer', rate: toCents(180), covers: 'Resizing, stories, simple edits' },
    { name: 'Admin / Coordination', rate: toCents(120), covers: 'Captions, scheduling, client comms, reports' },
    { name: 'Trainee / OJT', rate: toCents(80), covers: 'Supervised community replies' },
  ],
  overheadPct: 25,
  targetMarginPct: 45,
  minMarginPct: 30,
  vatPct: 12,
  ewtPct: 2,
  rushPct: 25,
  revisionPct: 15,
};

export interface CostLine {
  label: string;
  qty: number;
  hours: number;
  role: string;
  rate: Cents;
  cost: Cents;
}

export interface CostCheck {
  lines: CostLine[];
  hours: number;
  direct: Cents;
  /** Direct cost plus overhead. */
  cost: Cents;
  margin: number | null;
  verdict: 'loss' | 'thin' | 'ok' | 'none';
  /** Price that would earn the minimum and the target margin. */
  minPrice: Cents;
  targetPrice: Cents;
}

export function rateOf(rates: RateSettings, role: string): Cents {
  return rates.roles.find((r) => r.name === role)?.rate ?? rates.roles.find((r) => /mid/i.test(r.name))?.rate ?? 0;
}

export function costCheck(pkg: Pick<Package, 'deliverables' | 'price' | 'unit'>, rates: RateSettings): CostCheck {
  const lines = pkg.deliverables.map((d) => {
    const rate = rateOf(rates, d.role);
    return { label: d.label, qty: d.qty, hours: d.qty * d.hours, role: d.role, rate, cost: Math.round(d.qty * d.hours * rate) };
  });
  const direct = lines.reduce((a, l) => a + l.cost, 0);
  const cost = direct + percentOf(direct, rates.overheadPct);
  const hours = lines.reduce((a, l) => a + l.hours, 0);
  const priceCounts = pkg.unit !== 'percent' && pkg.price > 0;
  const margin = priceCounts && cost > 0 ? ((pkg.price - cost) / pkg.price) * 100 : null;
  const verdict: CostCheck['verdict'] = margin === null ? 'none' : margin < 0 ? 'loss' : margin < rates.minMarginPct ? 'thin' : 'ok';
  const priceFor = (pct: number) => (pct >= 100 ? cost : Math.ceil(cost / (1 - pct / 100) / 5000) * 5000);
  return { lines, hours, direct, cost, margin, verdict, minPrice: priceFor(rates.minMarginPct), targetPrice: priceFor(rates.targetMarginPct) };
}

/** Totals for a contract, a job or an invoice: no VAT, no withholding, an optional peso discount. */
export function docTotals(items: ProposalItem[], discountAmount = 0): ProposalTotals {
  return proposalTotals({ items, discountPct: 0, discountMonths: 0, vat: false, ewt: false, discountAmount }, { vatPct: 12, ewtPct: 2 });
}

export interface ProposalLine {
  label: string;
  qty: number;
  unitPrice: Cents;
  months: number;
  monthly: boolean;
  amount: Cents;
}

export interface ProposalTotals {
  lines: ProposalLine[];
  /** Monthly items, per month. */
  perMonth: Cents;
  oneTime: Cents;
  gross: Cents;
  discount: Cents;
  net: Cents;
  vat: Cents;
  invoice: Cents;
  ewt: Cents;
  payable: Cents;
}

/**
 * Totals for a proposal: monthly items × months, one-off items, percentage
 * add-ons (rush) on the one-off work, an introductory discount on the first
 * months, then VAT and the 2% withholding tax (on the amount before VAT).
 */
export function proposalTotals(
  p: Pick<Proposal, 'items' | 'discountPct' | 'discountMonths' | 'vat' | 'ewt'> & { discountAmount?: Cents },
  rates: Pick<RateSettings, 'vatPct' | 'ewtPct'>,
): ProposalTotals {
  const base = p.items.filter((i) => i.unit !== 'percent');
  const lines: ProposalLine[] = base.map((i) => {
    const monthly = i.unit === 'month';
    const months = monthly ? Math.max(1, i.months || 1) : 1;
    return { label: i.label, qty: i.qty, unitPrice: i.unitPrice, months, monthly, amount: i.unitPrice * i.qty * months };
  });
  const oneTimeBase = lines.filter((l) => !l.monthly).reduce((a, l) => a + l.amount, 0);
  // Percentage add-ons are on the package price when package lines are marked, otherwise on all one-off work.
  const packageBase = base.some((i) => i.base) ? base.filter((i) => i.base && i.unit !== 'month').reduce((a, i) => a + i.unitPrice * i.qty, 0) : oneTimeBase;
  for (const i of p.items.filter((x) => x.unit === 'percent')) {
    // For percentage items, unitPrice holds the percent × 100 (2500 = 25%).
    const amount = Math.round((packageBase * i.unitPrice) / 10000) * Math.max(1, i.qty);
    lines.push({ label: i.label, qty: i.qty, unitPrice: i.unitPrice, months: 1, monthly: false, amount });
  }
  const perMonth = lines.filter((l) => l.monthly).reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const oneTime = lines.filter((l) => !l.monthly).reduce((a, l) => a + l.amount, 0);
  const gross = lines.reduce((a, l) => a + l.amount, 0);
  const discountBase = lines.filter((l) => l.monthly).reduce((a, l) => a + l.unitPrice * l.qty * Math.min(l.months, Math.max(0, p.discountMonths)), 0);
  const discount = (p.discountPct > 0 ? percentOf(discountBase, p.discountPct) : 0) + Math.max(0, Math.min(p.discountAmount ?? 0, oneTime));
  const net = gross - discount;
  const vat = p.vat ? percentOf(net, rates.vatPct) : 0;
  const invoice = net + vat;
  const ewt = p.ewt ? percentOf(net, rates.ewtPct) : 0;
  return { lines, perMonth, oneTime, gross, discount, net, vat, invoice, ewt, payable: invoice - ewt };
}

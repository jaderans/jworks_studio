import { sum, type Cents } from '../lib/money';
import { isoDate } from '../lib/time';
import { sharesOfNet } from './money';
import type { JobStatus, Member, PayMethod, Payment, SplitShare } from '../db/types';

/**
 * Booth sales from JoshWorks POS. The POS writes a summary per event (and per
 * commission order) that Studio reads from the POS database on this device
 * (both apps live on jaderans.github.io) or from a file. Importing turns it into
 * a job with fixed ids (pos-<eventId>), so importing again updates it.
 */

// ----- the POS summary (version 1; JoshWorks POS src/db/types.ts StudioFeed) -----

export type PosPayKind = 'cash' | 'ewallet' | 'bank' | 'card' | 'other';

export interface PosMethod {
  methodId: string;
  name: string;
  kind: PosPayKind;
  amount: Cents;
}

export interface PosPerson {
  memberId: string;
  name: string;
  email: string;
  kind: 'staff' | 'royalty' | 'partner';
  role: string;
  amount: Cents;
  paid: Cents;
  paidAt: number | null;
  method: string;
}

export interface PosEventFeed {
  type: 'event';
  v: 1;
  eventId: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'live' | 'closed' | 'reported';
  business: string;
  gross: Cents;
  transactions: number;
  itemsSold: number;
  discounts: Cents;
  methods: PosMethod[];
  cogs: Cents;
  cogsMissing: number;
  boothFee: Cents;
  supplies: Cents;
  people: PosPerson[];
  tradingProfit: Cents;
  joshworksNet: Cents;
  depositsHeld: Cents;
}

export interface PosOrderPayment {
  saleId: string;
  date: string;
  name: string;
  kind: PosPayKind;
  amount: Cents;
  stage: 'deposit' | 'pickup';
}

export interface PosOrderFeed {
  type: 'order';
  v: 1;
  orderId: string;
  number: string;
  eventId: string;
  eventName: string;
  customer: { name: string; email: string; phone: string; handle: string };
  designer: { memberId: string; name: string; email: string } | null;
  lines: { name: string; qty: number; unitPrice: Cents }[];
  total: Cents;
  dueAt: string;
  status: 'new' | 'in-progress' | 'ready' | 'picked-up' | 'cancelled';
  createdAt: number;
  payments: PosOrderPayment[];
  notes: string;
}

export type PosFeed = PosEventFeed | PosOrderFeed;

const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown) => typeof x === 'string';

/** A summary this version of Studio understands. */
export function isPosFeed(x: unknown): x is PosFeed {
  const f = x as Record<string, unknown> | null;
  if (!f || typeof f !== 'object' || f.v !== 1) return false;
  if (f.type === 'event') return isStr(f.eventId) && isStr(f.name) && isNum(f.gross) && Array.isArray(f.methods) && Array.isArray(f.people);
  if (f.type === 'order') return isStr(f.orderId) && isStr(f.number) && isNum(f.total) && Array.isArray(f.payments) && Array.isArray(f.lines);
  return false;
}

/** The file "Download Studio file" saves in the POS. */
export function parsePosFile(text: string): PosFeed[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That isn’t a JoshWorks POS file. In the POS, use Event → Report → Download Studio file.');
  }
  const d = data as { app?: unknown; kind?: unknown; v?: unknown; feeds?: unknown };
  if (d?.app !== 'jworks-pos' || d.kind !== 'studio-feed' || !Array.isArray(d.feeds)) throw new Error('That isn’t a JoshWorks POS file. In the POS, use Event → Report → Download Studio file.');
  if (typeof d.v === 'number' && d.v > 1) throw new Error('This file is from a newer JoshWorks POS. Reload Studio to update it, then try again.');
  return d.feeds.filter(isPosFeed);
}

export const posKey = (f: PosFeed) => (f.type === 'event' ? `event:${f.eventId}` : `order:${f.orderId}`);
export const posJobId = (f: PosFeed) => (f.type === 'event' ? `pos-${f.eventId}` : `pos-order-${f.orderId}`);
/** Every payment, expense and payout an import writes starts with this. */
export const posPrefix = (f: PosFeed) => `${posJobId(f)}-`;

/** A short fingerprint of the summary, stamped on the job so Studio can tell when the POS numbers change. */
export function posFingerprint(f: PosFeed): string {
  let h = 0x811c9dc5;
  const s = JSON.stringify(f);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
export const posStamp = (f: PosFeed) => `(POS summary ${posFingerprint(f)})`;

export type PosImportState = 'new' | 'current' | 'changed';
export function posImportState(f: PosFeed, job: { brief: string; deleted?: 0 | 1 } | undefined): PosImportState {
  if (!job || job.deleted === 1) return 'new';
  return job.brief.includes(posStamp(f)) ? 'current' : 'changed';
}

/** POS payment method → Studio's. */
export function payMethodFor(m: { name: string; kind: string }): PayMethod {
  const n = m.name.toLowerCase();
  if (/g-?cash/.test(n)) return 'GCash';
  if (/mari/.test(n)) return 'Mari Bank';
  if (/union/.test(n)) return 'Union Bank';
  if (/paypal/.test(n)) return 'PayPal';
  if (/wise/.test(n)) return 'Wise';
  if (m.kind === 'cash') return 'On Hand';
  if (m.kind === 'bank') return 'Bank transfer';
  return 'Other';
}

// ----- people -----

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const first = (s: string) => norm(s).split(' ')[0] ?? '';

/** By email, then full name, then a first name only one person on the team has. */
export function matchMember(p: { name: string; email: string }, members: readonly Member[]): Member | undefined {
  const email = p.email.trim().toLowerCase();
  if (email) {
    const hit = members.find((m) => m.email && m.email.trim().toLowerCase() === email);
    if (hit) return hit;
  }
  const full = norm(p.name);
  if (!full) return undefined;
  const byName = members.find((m) => norm(m.name) === full);
  if (byName) return byName;
  const firsts = members.filter((m) => first(m.name) === first(p.name));
  return firsts.length === 1 ? firsts[0] : undefined;
}

export const personKey = (p: Pick<PosPerson, 'kind' | 'memberId'>) => `${p.kind}:${p.memberId}`;
/** Person → a Studio member id, or 'expense' (paid as a booth cost, not a share). */
export type PeopleChoices = Record<string, string>;

export function defaultChoices(feed: PosEventFeed, members: readonly Member[], remembered: Record<string, string> = {}): PeopleChoices {
  const out: PeopleChoices = {};
  for (const p of feed.people) {
    if (p.kind === 'partner') {
      out[personKey(p)] = 'expense';
      continue;
    }
    const known = remembered[p.memberId];
    out[personKey(p)] = (known && members.some((m) => m.id === known) ? known : matchMember(p, members)?.id) ?? 'expense';
  }
  return out;
}

/**
 * The split % that gives exactly this amount. Studio rounds each share down,
 * so the % sits half a centavo above the amount.
 */
export function exactPct(amount: Cents, gross: Cents): number {
  if (gross <= 0 || amount <= 0) return 0;
  let pct = Math.round(((amount + 0.5) / gross) * 100 * 1e8) / 1e8;
  for (let i = 0; i < 1000 && Math.trunc((gross * pct) / 100) < amount; i++) pct += 1e-8;
  for (let i = 0; i < 1000 && Math.trunc((gross * pct) / 100) > amount; i++) pct -= 1e-8;
  return pct;
}

// ----- what an import writes -----

export interface PlannedPayment {
  id: string;
  amount: Cents;
  date: string;
  method: PayMethod;
  kind: Payment['kind'];
  note: string;
}
export interface PlannedExpense {
  id: string;
  amount: Cents;
  date: string;
  category: string;
  vendor: string;
  note: string;
}
export interface PlannedPayout {
  id: string;
  memberId: string;
  amount: Cents;
  date: string;
  method: string;
  note: string;
}

export interface EventPlan {
  jobId: string;
  split: SplitShare[];
  /** Each member's share, as the POS worked it out. */
  shares: Map<string, Cents>;
  lead: string | null;
  payments: PlannedPayment[];
  expenses: PlannedExpense[];
  payouts: PlannedPayout[];
  /** What the studio keeps: sales less shares and expenses. */
  studioKeeps: Cents;
  warnings: string[];
}

export function planEventImport(feed: PosEventFeed, choices: PeopleChoices): EventPlan {
  const jobId = posJobId(feed);
  const pre = posPrefix(feed);
  const date = feed.endDate || feed.startDate || isoDate();
  const warnings: string[] = [];
  const shares = new Map<string, Cents>();
  const paid = new Map<string, { amount: Cents; at: number; method: string }>();
  const expenses: PlannedExpense[] = [];
  const cost = (id: string, amount: Cents, category: string, vendor: string, note: string) => {
    if (amount > 0) expenses.push({ id: `${pre}${id}`, amount, date, category, vendor, note });
  };
  cost('booth', feed.boothFee, 'Fees & permits', feed.venue || feed.name, `Booth fee, ${feed.name}`);
  cost('supplies', feed.supplies, 'Other', feed.name, 'Booth supplies (used up, plus this event’s share of stands and displays)');
  cost('cogs', feed.cogs, 'Printing', feed.name, 'Production cost of what sold (materials, labor)');

  for (const p of feed.people) {
    const to = feed.gross > 0 ? (choices[personKey(p)] ?? 'expense') : 'expense';
    if (p.kind === 'partner' || to === 'expense') {
      const what = p.kind === 'partner' ? `Partner share for ${p.name} (${p.role})` : p.kind === 'royalty' ? `Design royalty for ${p.name}` : `Booth pay for ${p.name} (${p.role || 'staff'})`;
      cost(`${p.kind}-${p.memberId}`, p.amount, 'Other', p.name, `${what}, ${feed.name}`);
      continue;
    }
    shares.set(to, (shares.get(to) ?? 0) + p.amount);
    if (p.paid > 0) {
      const cur = paid.get(to) ?? { amount: 0, at: 0, method: '' };
      paid.set(to, { amount: cur.amount + p.paid, at: Math.max(cur.at, p.paidAt ?? 0), method: cur.method || p.method });
    }
  }
  if (feed.gross <= 0 && feed.people.some((p) => p.amount > 0 && p.kind !== 'partner')) warnings.push('No sales, so the team’s pay is recorded as expenses.');

  const split = [...shares.entries()].filter(([, a]) => a > 0).map(([memberId, a]) => ({ memberId, pct: exactPct(a, feed.gross) }));
  const check = sharesOfNet(feed.gross, split);
  for (const [memberId, a] of shares) if (a > 0 && check.get(memberId) !== a) warnings.push('A share may be off by a centavo; check the job’s split.');
  const lead = [...shares.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const methods = feed.methods.filter((m) => m.amount !== 0);
  const payments: PlannedPayment[] = methods.map((m) => ({
    id: `${pre}pay-${m.methodId}`,
    amount: m.amount,
    date,
    method: payMethodFor(m),
    kind: methods.length === 1 ? 'full' : 'partial',
    note: `Booth sales at ${feed.name} (${m.name}), from JoshWorks POS`,
  }));
  const payouts: PlannedPayout[] = [...paid.entries()].map(([memberId, v]) => ({
    id: `${pre}paid-${memberId}`,
    memberId,
    amount: v.amount,
    date: v.at ? isoDate(v.at) : date,
    method: v.method,
    note: `Paid at ${feed.name} (JoshWorks POS)`,
  }));
  const studioKeeps = feed.gross - sum([...shares.values()]) - sum(expenses.map((x) => x.amount));
  return { jobId, split, shares, lead, payments, expenses, payouts, studioKeeps, warnings: [...new Set(warnings)] };
}

export interface OrderPlan {
  jobId: string;
  title: string;
  status: JobStatus;
  payments: PlannedPayment[];
}

const ORDER_STATUS: Record<PosOrderFeed['status'], JobStatus> = {
  new: 'not-started',
  'in-progress': 'in-progress',
  ready: 'completed',
  'picked-up': 'completed',
  cancelled: 'cancelled',
};

export function planOrderImport(feed: PosOrderFeed): OrderPlan {
  const pre = posPrefix(feed);
  const seen = new Map<string, number>();
  const payments = feed.payments
    .filter((p) => p.amount !== 0)
    .map((p) => {
      const k = seen.get(p.saleId) ?? 0;
      seen.set(p.saleId, k + 1);
      const full = feed.payments.length === 1 && p.amount >= feed.total;
      return {
        id: `${pre}${p.saleId}-${k}`,
        amount: p.amount,
        date: p.date,
        method: payMethodFor(p),
        kind: full ? 'full' : p.stage === 'deposit' ? 'down' : 'final',
        note: `${p.stage === 'deposit' ? 'Deposit' : 'Paid at pickup'} for POS order ${feed.number}`,
      } satisfies PlannedPayment;
    });
  const title = feed.lines.map((l) => (l.qty > 1 ? `${l.qty} × ${l.name}` : l.name)).join(', ').slice(0, 80) || `Order ${feed.number}`;
  return { jobId: posJobId(feed), title, status: ORDER_STATUS[feed.status] ?? 'not-started', payments };
}

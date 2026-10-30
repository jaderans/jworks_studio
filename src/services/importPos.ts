import Dexie from 'dexie';
import { alive, db } from '../db/db';
import { audit, build, save } from '../db/write';
import { getSetting } from '../db/settings';
import { nextJobNumber } from '../domain/jobs';
import {
  isPosFeed, personKey, planEventImport, planOrderImport, posJobId, posPrefix, posStamp, matchMember,
  type PeopleChoices, type PosEventFeed, type PosFeed, type PosOrderFeed,
} from '../domain/posFeed';
import { recomputeEarnings } from './money';
import { blankClient } from './clients';
import { peso } from '../lib/money';
import { isoDate, todayISO } from '../lib/time';
import type { Client, Expense, Job, JobMoney, JobProgress, Payment, Payout } from '../db/types';

/** The POS keeps its data in this database on the same site. */
const POS_DB = 'jworks-pos';

/**
 * Summaries the POS on this device has sent ("Send to Studio"). Opened
 * read-only and closed straight away; nothing is created when the POS has
 * never been used here.
 */
export async function readDevicePosFeeds(): Promise<{ found: boolean; feeds: PosFeed[] }> {
  if (!(await Dexie.exists(POS_DB))) return { found: false, feeds: [] };
  const pos = new Dexie(POS_DB);
  try {
    await pos.open();
    if (!pos.tables.some((t) => t.name === 'studioFeed')) return { found: true, feeds: [] };
    const rows = (await pos.table('studioFeed').toArray()) as { deleted?: 0 | 1; feed?: unknown }[];
    return { found: true, feeds: rows.filter((r) => r.deleted !== 1).map((r) => r.feed).filter(isPosFeed) };
  } catch {
    return { found: true, feeds: [] };
  } finally {
    pos.close();
  }
}

// Who each POS person was matched to, remembered on this device for the next import.
const PEOPLE_KEY = 'jwcamp-pos-people';
export function rememberedPeople(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function rememberPeople(feed: PosEventFeed, choices: PeopleChoices) {
  try {
    const known = rememberedPeople();
    for (const p of feed.people) {
      const to = choices[personKey(p)];
      if (to && to !== 'expense') known[p.memberId] = to;
    }
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(known));
  } catch {
    // Private windows can refuse storage; matching by email and name still works.
  }
}

/** People last recorded as expenses on this import stay that way by default. */
export async function expenseChoices(feed: PosEventFeed): Promise<Set<string>> {
  const rows = alive(await db.expenses.where('id').startsWith(posPrefix(feed)).toArray());
  const ids = new Set(rows.map((r) => r.id));
  return new Set(feed.people.filter((p) => ids.has(`${posPrefix(feed)}${p.kind}-${p.memberId}`)).map(personKey));
}

/** Mark anything an earlier import wrote that this one no longer has. */
async function retire(prefix: string, keep: Set<string>) {
  for (const table of [db.payments, db.expenses, db.payouts] as const) {
    const rows = await (table as Dexie.Table<Payment | Expense | Payout, string>).where('id').startsWith(prefix).toArray();
    for (const r of rows) if (r.deleted !== 1 && !keep.has(r.id)) await save(table as Dexie.Table<typeof r, string>, { ...r, deleted: 1 });
  }
}

async function jobNumberFor(id: string): Promise<{ existing: Job | undefined; number: string }> {
  const [existing, all] = await Promise.all([db.jobs.get(id), db.jobs.toArray()]);
  return { existing, number: existing?.number || nextJobNumber(all.map((j) => j.number)) };
}

const blankJob = (id: string, number: string) =>
  build<Job>({ id, number, title: '', type: 'Pop-up / Stickers', clientId: null, clientName: '', priority: 'med', startDate: '', dueDate: '', rush: false, designers: [], lead: null, revisionsIncluded: 0, brief: '', source: '', budgetNote: '' });
const blankProgress = (id: string) => build<JobProgress>({ id, status: 'not-started', completedOn: '', revisionsUsed: 0, checklist: {}, links: [], notes: '' });
const blankJobMoney = (id: string, deductionPct: number) =>
  build<JobMoney>({ id, total: 0, items: [], discountAmount: 0, deductionPct, split: [], taxWithheld: 0, form2307: 'na', invoiceNo: '', notes: '' });

async function writePayments(jobId: string, clientId: string | null, planned: ReturnType<typeof planOrderImport>['payments']) {
  for (const p of planned) {
    const prev = await db.payments.get(p.id);
    await save(db.payments, {
      ...(prev ?? build<Payment>({ id: p.id, jobId, invoiceId: null, clientId, amount: 0, date: p.date, method: p.method, reference: '', kind: p.kind, receiptNo: '', note: '' })),
      jobId,
      clientId,
      amount: p.amount,
      date: p.date,
      method: p.method,
      kind: p.kind,
      note: p.note,
      deleted: 0,
    });
  }
}

/** Add or update a booth event as a Pop-up / Stickers job. */
export async function applyEventImport(feed: PosEventFeed, choices: PeopleChoices): Promise<{ jobId: string; created: boolean }> {
  const plan = planEventImport(feed, choices);
  const id = plan.jobId;
  const { existing, number } = await jobNumberFor(id);
  const completed = feed.status === 'closed' || feed.status === 'reported';
  const dates = feed.startDate && feed.endDate && feed.endDate !== feed.startDate ? `${feed.startDate} to ${feed.endDate}` : feed.startDate;

  await save(db.jobs, {
    ...(existing ?? blankJob(id, number)),
    number,
    title: `Booth: ${feed.name}`,
    type: existing?.type ?? 'Pop-up / Stickers',
    clientName: existing?.clientName || feed.venue || 'Booth sales',
    startDate: feed.startDate,
    dueDate: feed.endDate || feed.startDate,
    designers: [...plan.shares.keys()],
    lead: plan.lead,
    brief: `Booth sales from JoshWorks POS${dates ? `, ${dates}` : ''}: ${feed.transactions} sales, ${feed.itemsSold} items. ${posStamp(feed)}`,
    source: 'JoshWorks POS',
    deleted: 0,
  });
  const prevProgress = await db.jobProgress.get(id);
  await save(db.jobProgress, {
    ...(prevProgress ?? blankProgress(id)),
    status: completed ? 'completed' : 'in-progress',
    completedOn: completed ? prevProgress?.completedOn || feed.endDate || feed.startDate : '',
    deleted: 0,
  });
  const prevMoney = await db.jobMoney.get(id);
  await save(db.jobMoney, {
    ...(prevMoney ?? blankJobMoney(id, 0)),
    total: feed.gross,
    items: feed.gross ? [{ packageId: null, label: `Booth sales at ${feed.name}`, qty: 1, unitPrice: feed.gross, unit: 'project', months: 1, base: true }] : [],
    discountAmount: 0,
    deductionPct: 0,
    split: plan.split,
    notes: `From JoshWorks POS. Trading profit ${peso(feed.tradingProfit)}; JoshWorks net ${peso(feed.joshworksNet)}.${feed.depositsHeld ? ` ${peso(feed.depositsHeld)} in order deposits held for pickups.` : ''}`,
    deleted: 0,
  });

  await writePayments(id, null, plan.payments);
  for (const planned of plan.expenses) {
    // The payoff is shown before importing; the note carries it on the expense.
    const { payoff, ...x } = planned;
    const prev = await db.expenses.get(x.id);
    await save(db.expenses, { ...(prev ?? build<Expense>({ id: x.id, date: x.date, category: x.category, amount: 0, vendor: '', jobId: id, note: '' })), ...x, jobId: id, deleted: 0 });
  }
  for (const p of plan.payouts) {
    const prev = await db.payouts.get(p.id);
    await save(db.payouts, { ...(prev ?? build<Payout>({ id: p.id, memberId: p.memberId, amount: 0, date: p.date, method: '', reference: '', note: '' })), ...p, deleted: 0 });
  }
  await retire(posPrefix(feed), new Set([...plan.payments, ...plan.expenses, ...plan.payouts].map((r) => r.id)));
  await recomputeEarnings([id]);
  rememberPeople(feed, choices);
  await audit('import', 'job', id, `${existing ? 'Updated' : 'Added'} booth event ${feed.name} from JoshWorks POS: ${peso(feed.gross)} in sales`);
  return { jobId: id, created: !existing };
}

const clientKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Add or update a commission order as a job: the customer as a client, the designer, every payment. */
export async function applyOrderImport(feed: PosOrderFeed, designerId: string | null): Promise<{ jobId: string; created: boolean }> {
  const plan = planOrderImport(feed);
  const id = plan.jobId;
  const { existing, number } = await jobNumberFor(id);

  // The customer: by email, then by name; added as a client when new.
  let clientId: string | null = existing?.clientId ?? null;
  const c = feed.customer;
  if (!clientId && c.name.trim()) {
    const clients = alive(await db.clients.toArray());
    const email = c.email.trim().toLowerCase();
    const found = (email && clients.find((x) => x.email && x.email.toLowerCase() === email)) || clients.find((x) => clientKey(x.name) === clientKey(c.name));
    if (found) clientId = found.id;
    else {
      const rec = build<Client>({ ...blankClient({ name: c.name.trim(), email: c.email, phone: c.phone, source: 'JoshWorks POS', stage: feed.status === 'picked-up' ? 'completed' : 'active', startDate: isoDate(feed.createdAt), platforms: [] }) });
      await save(db.clients, rec);
      clientId = rec.id;
    }
  }

  await save(db.jobs, {
    ...(existing ?? blankJob(id, number)),
    number,
    title: existing?.title || plan.title,
    type: existing?.type ?? 'General',
    clientId,
    clientName: c.name,
    startDate: existing?.startDate || isoDate(feed.createdAt),
    dueDate: feed.dueAt.slice(0, 10),
    designers: designerId ? [designerId] : (existing?.designers ?? []),
    lead: designerId ?? existing?.lead ?? null,
    brief: `POS order ${feed.number}${feed.eventName ? ` at ${feed.eventName}` : ''}: ${feed.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}.${feed.notes ? ` ${feed.notes}` : ''} ${posStamp(feed)}`,
    source: 'JoshWorks POS',
    deleted: 0,
  });
  const prevProgress = await db.jobProgress.get(id);
  await save(db.jobProgress, {
    ...(prevProgress ?? blankProgress(id)),
    status: plan.status,
    completedOn: plan.status === 'completed' ? prevProgress?.completedOn || todayISO() : '',
    deleted: 0,
  });
  const prevMoney = await db.jobMoney.get(id);
  const money = await getSetting('money');
  await save(db.jobMoney, {
    ...(prevMoney ?? blankJobMoney(id, money.deductionPct)),
    total: feed.total,
    items: feed.lines.map((l) => ({ packageId: null, label: l.name, qty: l.qty, unitPrice: l.unitPrice, unit: 'piece' as const, months: 1, base: true })),
    deleted: 0,
  });
  await writePayments(id, clientId, plan.payments);
  await retire(posPrefix(feed), new Set(plan.payments.map((p) => p.id)));
  await recomputeEarnings([id]);
  await audit('import', 'job', id, `${existing ? 'Updated' : 'Added'} POS order ${feed.number} (${c.name}) as job ${number}`);
  return { jobId: id, created: !existing };
}

/** Default designer for an order: the POS maker, matched by email or name. */
export async function orderDesigner(feed: PosOrderFeed): Promise<string | null> {
  const existing = await db.jobs.get(posJobId(feed));
  if (existing?.lead) return existing.lead;
  if (!feed.designer) return null;
  return matchMember(feed.designer, alive(await db.members.toArray()))?.id ?? null;
}

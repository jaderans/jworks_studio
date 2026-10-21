import { alive, db } from '../db/db';
import { audit, build, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { trackerPayments, type TrackerImport, type TrackerJob } from '../domain/tracker';
import { nextJobNumber } from '../domain/jobs';
import { earningsForJob, payoutSummary } from '../domain/money';
import { recomputeEarnings } from './money';
import { saveMember } from './team';
import { blankClient } from './clients';
import type { Cents } from '../lib/money';
import { todayISO } from '../lib/time';
import type { Client, ClientStage, Job, JobMoney, JobProgress, Member, Payment, Payout, SplitShare } from '../db/types';

/**
 * Brings the commission tracker into the app: jobs, their money and team
 * split, client payments (and so every designer's earnings), clients, targets
 * and BIR settings. Ids are fixed per job (tracker-COM-005), so importing the
 * same workbook again updates instead of duplicating.
 */

export interface TrackerOptions {
  /** Jobs with no Payment Designation row: the owner gets 100% of the share. */
  ownerTakesUnsplit: boolean;
  /** Record one "settled before the app" payout per person, so past work doesn't show as owed. */
  settlePast: boolean;
  importTargets: boolean;
  importBir: boolean;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = { ownerTakesUnsplit: true, settlePast: true, importTargets: true, importBir: true };

export interface TrackerPreview {
  jobs: { number: string; title: string; clientName: string; total: Cents; paid: Cents; status: TrackerJob['status']; split: string; update: boolean }[];
  newJobs: number;
  updatedJobs: number;
  payments: number;
  paid: Cents;
  guessedDates: number;
  /** Tracker column name → the member it goes to ('' = a new designer is added). */
  people: { name: string; memberName: string; isNew: boolean }[];
  newClients: string[];
  unsplit: string[];
  /** Jobs already in the app with payments recorded here: their tracker payments are skipped. */
  keepAppPayments: string[];
  /** What each person earned on the tracker's payments: recorded as already paid out when settlePast is on. */
  settle: { name: string; amount: Cents }[];
  nextJobNumber: string;
  warnings: string[];
}

const PREFIX = 'tracker-';
const firstName = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
const clientKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface Matches {
  members: Member[];
  memberByName: Map<string, Member | null>;
  owner: Member | undefined;
  jobsByNumber: Map<string, Job>;
  clients: Client[];
  appPaid: Set<string>;
}

async function match(t: TrackerImport): Promise<Matches> {
  const [members, jobs, clients, payments] = await Promise.all([db.members.toArray(), db.jobs.toArray(), db.clients.toArray(), db.payments.toArray()]);
  const live = alive(members);
  const owner = live.find((m) => m.appRole === 'owner');
  const memberByName = new Map<string, Member | null>();
  for (const name of t.people) memberByName.set(name, live.find((m) => firstName(m.name) === firstName(name)) ?? null);
  const jobsByNumber = new Map(alive(jobs).map((j) => [j.number.toUpperCase(), j]));
  const appPaid = new Set(alive(payments).filter((p) => p.jobId && !p.id.startsWith(PREFIX)).map((p) => p.jobId as string));
  return { members: live, memberByName, owner, jobsByNumber, clients: alive(clients), appPaid };
}

function findClient(clients: Client[], j: Pick<TrackerJob, 'clientName' | 'clientEmail'>): Client | undefined {
  if (j.clientEmail) {
    const byEmail = clients.find((c) => c.email && c.email.toLowerCase() === j.clientEmail);
    if (byEmail) return byEmail;
  }
  const key = clientKey(j.clientName);
  return key ? clients.find((c) => clientKey(c.name) === key) : undefined;
}

export async function previewTracker(t: TrackerImport, opts: TrackerOptions): Promise<TrackerPreview> {
  const m = await match(t);
  const today = todayISO();
  const newClients = new Map<string, string>();
  let payments = 0;
  let paid = 0;
  let guessed = 0;
  const keepAppPayments: string[] = [];
  const rows = t.jobs.map((j) => {
    const existing = m.jobsByNumber.get(j.number);
    if (j.clientName && !findClient(m.clients, j) && !newClients.has(clientKey(j.clientName))) newClients.set(clientKey(j.clientName), j.clientName);
    if (existing && m.appPaid.has(existing.id)) keepAppPayments.push(j.number);
    else
      for (const p of trackerPayments(j, today)) {
        payments += 1;
        paid += p.amount;
        if (p.guessed) guessed += 1;
      }
    const s = t.splits.get(j.number);
    const split = s?.shares.length ? s.shares.map((x) => `${x.name} ${x.pct}%`).join(', ') : opts.ownerTakesUnsplit && m.owner ? `${m.owner.name.split(' ')[0]} 100% (no split row)` : 'No split';
    return { number: j.number, title: j.title, clientName: j.clientName, total: j.total, paid: j.initial + j.final, status: j.status, split, update: !!existing };
  });
  // Each person's share of the tracker's payments (what "settled before the app" records).
  const shares = new Map<string, Cents>();
  for (const j of t.jobs) {
    const existing = m.jobsByNumber.get(j.number);
    if (existing && m.appPaid.has(existing.id)) continue;
    const s = t.splits.get(j.number);
    const split = s?.shares.length ? s.shares.map((x) => ({ memberId: x.name, pct: x.pct })) : opts.ownerTakesUnsplit && m.owner ? [{ memberId: m.owner.name.split(' ')[0], pct: 100 }] : [];
    const pays = trackerPayments(j, today).map((p, i) => ({ id: `${j.number}-${i}`, jobId: j.number, amount: p.amount, date: p.date, createdAt: i, deleted: 0 }) as unknown as Payment);
    for (const e of earningsForJob(j.number, { deductionPct: s ? s.deductionPct : 0, split }, pays)) shares.set(e.memberId, (shares.get(e.memberId) ?? 0) + e.amount);
  }
  const existingNumbers = [...m.jobsByNumber.keys()];
  return {
    jobs: rows,
    newJobs: rows.filter((r) => !r.update).length,
    updatedJobs: rows.filter((r) => r.update).length,
    payments,
    paid,
    guessedDates: guessed,
    people: t.people.map((name) => {
      const hit = m.memberByName.get(name);
      return { name, memberName: hit?.name ?? name, isNew: !hit };
    }),
    newClients: [...newClients.values()],
    unsplit: t.jobs.filter((j) => !t.splits.get(j.number)?.shares.length && (j.initial + j.final > 0 || j.total > 0)).map((j) => j.number),
    keepAppPayments,
    settle: [...shares.entries()].map(([name, amount]) => ({ name, amount })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount),
    nextJobNumber: nextJobNumber([...existingNumbers, ...t.jobs.map((j) => j.number)]),
    warnings: t.warnings,
  };
}

export interface TrackerSummary {
  jobs: number;
  payments: number;
  members: number;
  clients: number;
  settled: number;
}

const stageFor = (statuses: TrackerJob['status'][]): ClientStage =>
  statuses.some((s) => ['not-started', 'in-progress', 'review', 'revisions'].includes(s)) ? 'active' : statuses.every((s) => s === 'blocked' || s === 'cancelled') ? 'lost' : 'completed';

export async function applyTracker(t: TrackerImport, opts: TrackerOptions): Promise<TrackerSummary> {
  const today = todayISO();
  const m = await match(t);
  const summary: TrackerSummary = { jobs: 0, payments: 0, members: 0, clients: 0, settled: 0 };

  // People: match tracker columns to the team by first name; add anyone missing as a designer.
  const memberIdByName = new Map<string, string>();
  for (const name of t.people) {
    let hit = m.memberByName.get(name);
    if (!hit) {
      const pretty = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      hit = await saveMember({ name: pretty, appRole: 'designer', roleLabel: 'Designer' });
      summary.members += 1;
    }
    memberIdByName.set(name, hit.id);
  }

  // Clients: by email, then by name; new ones are added.
  const clients = [...m.clients];
  const clientIdFor = async (j: TrackerJob): Promise<string | null> => {
    if (!j.clientName) return null;
    const found = findClient(clients, j);
    if (found) {
      if (j.clientEmail && !found.email) {
        const next = await save(db.clients, { ...found, email: j.clientEmail });
        clients.splice(clients.indexOf(found), 1, next);
      }
      return found.id;
    }
    const statuses = t.jobs.filter((x) => clientKey(x.clientName) === clientKey(j.clientName)).map((x) => x.status);
    const firstJob = t.jobs.filter((x) => clientKey(x.clientName) === clientKey(j.clientName)).map((x) => x.startDate || x.createdOn).filter(Boolean).sort()[0] ?? '';
    const rec = build<Client>({ ...blankClient({ name: j.clientName, email: j.clientEmail, source: 'Commission tracker', stage: stageFor(statuses), startDate: firstJob, platforms: [] }) });
    await save(db.clients, rec);
    clients.push(rec);
    summary.clients += 1;
    return rec.id;
  };

  const touched: string[] = [];
  for (const j of t.jobs) {
    const existing = m.jobsByNumber.get(j.number);
    const id = existing?.id ?? `${PREFIX}${j.number}`;
    const clientId = await clientIdFor(j);
    const s = t.splits.get(j.number);
    let split: SplitShare[] = (s?.shares ?? []).map((x) => ({ memberId: memberIdByName.get(x.name) ?? '', pct: x.pct })).filter((x) => x.memberId);
    if (!split.length && opts.ownerTakesUnsplit && m.owner) split = [{ memberId: m.owner.id, pct: 100 }];
    const team = split.map((x) => x.memberId);
    const lead = [...split].sort((a, b) => b.pct - a.pct)[0]?.memberId ?? null;

    const job: Job = {
      ...(existing ?? build<Job>({ id, number: j.number, title: '', type: 'General', clientId: null, clientName: '', priority: 'med', startDate: '', dueDate: '', rush: false, designers: [], lead: null, revisionsIncluded: 2, brief: '', source: '', budgetNote: '' })),
      number: j.number,
      title: j.title,
      type: j.type,
      clientId,
      clientName: j.clientName,
      priority: j.priority,
      startDate: j.startDate || j.createdOn,
      dueDate: j.dueDate,
      rush: j.rush,
      designers: existing?.designers.length ? existing.designers : team,
      lead: existing?.lead ?? lead,
      deleted: 0,
    };
    await save(db.jobs, job);

    const prevProgress = await db.jobProgress.get(id);
    const progress: JobProgress = {
      ...(prevProgress ?? build<JobProgress>({ id, status: 'not-started', completedOn: '', revisionsUsed: 0, checklist: {}, links: [], notes: '' })),
      status: j.status,
      completedOn: j.status === 'completed' ? j.completedOn || j.dueDate || prevProgress?.completedOn || '' : '',
      notes: prevProgress?.notes || j.notes,
      deleted: 0,
    };
    await save(db.jobProgress, progress);

    const prevMoney = await db.jobMoney.get(id);
    const moneyRec: JobMoney = {
      ...(prevMoney ?? build<JobMoney>({ id, total: 0, items: [], discountAmount: 0, deductionPct: 0, split: [], taxWithheld: 0, form2307: 'na', invoiceNo: '', notes: '' })),
      total: j.total,
      items: prevMoney?.items.length ? prevMoney.items : j.total ? [{ packageId: null, label: j.title, qty: 1, unitPrice: j.total, unit: 'project', months: 1, base: true }] : [],
      deductionPct: s ? s.deductionPct : (prevMoney?.deductionPct ?? 0),
      split,
      taxWithheld: j.taxWithheld,
      form2307: j.form2307,
      invoiceNo: j.invoiceNo,
      notes: j.notes,
      deleted: 0,
    };
    await save(db.jobMoney, moneyRec);

    // Payments, unless this job already has payments recorded in the app.
    if (!(existing && m.appPaid.has(existing.id))) {
      const want = trackerPayments(j, today);
      const keys = new Set(want.map((p) => `${PREFIX}${j.number}-${p.key}`));
      for (const p of want) {
        const pid = `${PREFIX}${j.number}-${p.key}`;
        const prev = await db.payments.get(pid);
        const rec: Payment = {
          ...(prev ?? build<Payment>({ id: pid, jobId: id, invoiceId: null, clientId, amount: 0, date: p.date, method: j.method, reference: '', kind: 'partial', receiptNo: '', note: '' })),
          jobId: id,
          clientId,
          amount: p.amount,
          date: p.date,
          method: j.method,
          kind: p.key === 'initial' ? (j.final > 0 || p.amount < j.total ? 'down' : 'full') : 'final',
          note: `From the commission tracker${p.guessed ? ' (date taken from the job dates)' : ''}`,
          deleted: 0,
        };
        await save(db.payments, rec);
        summary.payments += 1;
      }
      // A payment cleared in the tracker is removed here too.
      for (const old of ['initial', 'final'].map((k) => `${PREFIX}${j.number}-${k}`).filter((k) => !keys.has(k))) {
        const prev = await db.payments.get(old);
        if (prev && prev.deleted !== 1) await save(db.payments, { ...prev, deleted: 1 });
      }
    }
    touched.push(id);
    summary.jobs += 1;
  }

  await recomputeEarnings(touched);

  // Past work was paid outside the app: one payout per person up to today.
  if (opts.settlePast) {
    // Only shares of the tracker's own payments; money recorded in the app stays owed until paid out.
    const earnings = alive(await db.earnings.toArray()).filter((e) => e.paymentId.startsWith(PREFIX));
    const owners = new Set([...earnings.map((e) => e.memberId), ...alive(await db.payouts.toArray()).filter((p) => p.id.startsWith(`${PREFIX}settled-`)).map((p) => p.memberId)]);
    const earned = payoutSummary(earnings, []);
    for (const memberId of owners) {
      const amount = Math.max(0, earned.get(memberId)?.earned ?? 0);
      const id = `${PREFIX}settled-${memberId}`;
      const prev = await db.payouts.get(id);
      if (!amount && !prev) continue;
      await save(db.payouts, {
        ...(prev ?? build<Payout>({ id, memberId, amount: 0, date: today, method: 'Other', reference: '', note: '' })),
        amount,
        date: prev?.date ?? today,
        note: 'Settled before JoshWorks Studio (from the commission tracker)',
        deleted: amount ? 0 : 1,
      });
      if (amount) summary.settled += 1;
    }
  }

  // Targets, the big-project line and BIR.
  if (opts.importTargets && (t.targets.length || t.bigProject)) {
    const money = await getSetting('money');
    const months = new Set(t.targets.map((x) => x.month));
    await setSetting('money', {
      ...money,
      targets: [...money.targets.filter((x) => !months.has(x.month)), ...t.targets].sort((a, b) => a.month.localeCompare(b.month)),
      bigProject: t.bigProject ?? money.bigProject,
    });
  }
  if (opts.importBir && Object.keys(t.bir).length) await setSetting('bir', { ...(await getSetting('bir')), ...t.bir });

  await audit('import', 'job', null, `Imported the commission tracker: ${summary.jobs} jobs, ${summary.payments} payments`);
  return summary;
}

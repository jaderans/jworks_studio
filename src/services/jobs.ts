import { alive, db } from '../db/db';
import { audit, create, remove, save } from '../db/write';
import { getSetting } from '../db/settings';
import { EMPTY_PROGRESS, JOB_STATUS_LABEL, nextJobNumber } from '../domain/jobs';
import { todayISO } from '../lib/time';
import { saveJobMoney } from './money';
import { saveClient } from './clients';
import type { Client, Job, JobMoney, JobProgress, JobStatus } from '../db/types';

/**
 * Jobs (commissions). The plan (client, dates, people) is written by the owner
 * or a manager; progress (status, revisions, checklist) by anyone on the team.
 */

export function blankJob(fields: Partial<Job> = {}): Omit<Job, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    number: '',
    title: '',
    type: 'General',
    clientId: null,
    clientName: '',
    priority: 'med',
    startDate: todayISO(),
    dueDate: '',
    rush: false,
    designers: [],
    lead: null,
    revisionsIncluded: 2,
    brief: '',
    source: '',
    budgetNote: '',
    ...fields,
  };
}

export async function nextJobNo(): Promise<string> {
  return nextJobNumber((await db.jobs.toArray()).map((j) => j.number));
}

/** A new job with its progress record and, for managers, its money record. */
export async function newJob(fields: Partial<Job> & { title: string }, opts: { status?: JobStatus; money?: Partial<JobMoney> } = {}): Promise<Job> {
  const job = await create<Job>(db.jobs, { ...blankJob(fields), number: fields.number || (await nextJobNo()) });
  await create<JobProgress>(db.jobProgress, { ...EMPTY_PROGRESS, status: opts.status ?? 'not-started', id: job.id });
  const settings = await getSetting('money');
  const split = settings.defaultSplit.length ? settings.defaultSplit : job.lead ? [{ memberId: job.lead, pct: 100 }] : [];
  await saveJobMoney(job.id, { deductionPct: settings.deductionPct, split, ...opts.money });
  await audit('create', 'job', job.id, `${job.number}: ${job.title}${job.clientName ? ` for ${job.clientName}` : ''}`);
  return job;
}

export async function saveJob(j: Job): Promise<Job> {
  const prev = await db.jobs.get(j.id);
  const next = await save(db.jobs, j);
  if (prev && prev.dueDate !== next.dueDate && next.dueDate) await audit('job', 'job', next.id, `${next.number}: due ${next.dueDate}`);
  return next;
}

export async function saveProgress(jobId: string, changes: Partial<JobProgress>): Promise<JobProgress> {
  const prev = await db.jobProgress.get(jobId);
  const base = prev ?? ({ ...EMPTY_PROGRESS, id: jobId, createdAt: Date.now(), updatedAt: 0 } as JobProgress);
  const next: JobProgress = { ...base, ...changes, deleted: 0 };
  if (changes.status === 'completed' && !next.completedOn) next.completedOn = todayISO();
  if (changes.status && changes.status !== 'completed' && prev?.status === 'completed') next.completedOn = '';
  const saved = await save(db.jobProgress, next);
  if (changes.status && prev?.status !== changes.status) {
    const job = await db.jobs.get(jobId);
    await audit('status', 'job', jobId, `${job?.number ?? 'Job'}: ${JOB_STATUS_LABEL[prev?.status ?? 'not-started']} → ${JOB_STATUS_LABEL[changes.status]}`);
  }
  return saved;
}

export const setJobStatus = (jobId: string, status: JobStatus) => saveProgress(jobId, { status });

export async function deleteJob(id: string): Promise<void> {
  const job = await db.jobs.get(id);
  const [payments, invoices] = await Promise.all([db.payments.where('jobId').equals(id).toArray(), db.invoices.where('jobId').equals(id).toArray()]);
  if (alive(payments).length) throw new Error(`${job?.number ?? 'This job'} has payments. Mark it Cancelled instead, so the money records stay right.`);
  for (const inv of alive(invoices)) await save(db.invoices, { ...inv, status: 'void' as const });
  await remove(db.jobs, id);
  if (await db.jobProgress.get(id)) await remove(db.jobProgress, id);
  if (await db.jobMoney.get(id)) await remove(db.jobMoney, id);
  await audit('delete', 'job', id, `Deleted ${job?.number ?? 'a job'} ${job?.title ?? ''}`);
}

/** Inquiry intake: a client (new or existing) and a job in "Inquiry", in one step. */
export async function takeInquiry(input: {
  clientId: string | null;
  client?: Partial<Client> & { name: string };
  title: string;
  type: Job['type'];
  dueDate: string;
  budgetNote: string;
  source: string;
  brief: string;
}): Promise<Job> {
  let clientId = input.clientId;
  let clientName = '';
  if (!clientId && input.client) {
    const c = await saveClient({ ...input.client, stage: 'inquiry', source: input.source });
    clientId = c.id;
    clientName = c.name;
  } else if (clientId) {
    clientName = (await db.clients.get(clientId))?.name ?? '';
  }
  return newJob(
    { title: input.title, type: input.type, clientId, clientName, dueDate: input.dueDate, budgetNote: input.budgetNote, source: input.source, brief: input.brief, startDate: '' },
    { status: 'inquiry' },
  );
}

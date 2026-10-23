import { alive, db } from '../db/db';
import { audit, create, save } from '../db/write';
import { getSetting } from '../db/settings';
import { docTotals, proposalTotals } from '../domain/pricing';
import { CLIENT_KINDS } from '../domain/clients';
import { nextNumber, setClientStage } from './clients';
import { newJob } from './jobs';
import { saveJobMoney } from './money';
import { addDays, todayISO } from '../lib/time';
import { PRICES_HOLD_DAYS } from '../domain/contractTemplates';
import { completionDate, planMilestones } from '../domain/contractPlan';
import { questionsOf } from '../domain/questionnaire';
import type { Contract, ContractTemplate, Job, ProposalItem } from '../db/types';

/**
 * The document flow: quote → contract → job → invoice. Each step carries the
 * client, the price lines and the discount forward, so nothing is typed twice.
 */

/** The template that fits a job type and client kind (falls back to the first). */
export function suggestTemplate(templates: ContractTemplate[], o: { jobType?: Job['type']; student?: boolean }): ContractTemplate | undefined {
  const want = o.student ? 'student' : 'business';
  const byType: Record<string, string> = {
    Branding: 'tpl-branding',
    Merch: 'tpl-merch',
    'Pop-up / Stickers': 'tpl-merch',
    Campaign: 'tpl-event',
    Publication: 'tpl-workbook',
    General: 'tpl-event',
    'Video Editing': 'tpl-motion',
    Motion: 'tpl-motion',
    '3D Model': 'tpl-motion',
    Web: 'tpl-web',
    'SMM / Retainer': 'tpl-branding-smm',
    Training: 'tpl-training',
  };
  const prefix = o.jobType ? byType[o.jobType] : undefined;
  const live = templates.filter((t) => t.active === 1 && t.deleted !== 1);
  return (prefix && (live.find((t) => t.id.startsWith(prefix) && t.id.endsWith(want)) ?? live.find((t) => t.id.startsWith(prefix)))) || live[0];
}

/** A contract from a template, filled from the client, the job or the quote. */
export async function newTemplateContract(opts: { templateId: string; clientId?: string | null; jobId?: string | null; proposalId?: string | null }): Promise<Contract> {
  const tpl = await db.contractTemplates.get(opts.templateId);
  if (!tpl) throw new Error('That contract template no longer exists.');
  const [business, money, payMethods] = await Promise.all([getSetting('business'), getSetting('money'), getSetting('payMethods')]);
  const job = opts.jobId ? await db.jobs.get(opts.jobId) : undefined;
  const jm = opts.jobId ? await db.jobMoney.get(opts.jobId) : undefined;
  const quote = opts.proposalId ? await db.proposals.get(opts.proposalId) : undefined;
  const clientId = opts.clientId ?? job?.clientId ?? quote?.clientId ?? null;
  const client = clientId ? await db.clients.get(clientId) : undefined;
  const owner = alive(await db.members.toArray()).find((m) => m.appRole === 'owner');
  const packages = alive(await db.packages.toArray());
  const items: ProposalItem[] = jm?.items.length ? jm.items : (quote?.items ?? []);
  const today = todayISO();
  const startDate = job?.startDate ?? '';
  const endDate = job?.dueDate || completionDate(startDate, items, packages, job?.rush);
  const fields: Record<string, string> = {
    'client.name': client?.name ?? job?.clientName ?? quote?.clientName ?? '',
    'client.contact': client?.contactName ?? '',
    'client.email': client?.email ?? '',
    'client.phone': client?.phone ?? '',
    'client.address': client?.location ?? '',
    'client.web': client ? Object.values(client.handles ?? {}).filter(Boolean).join(' · ') : '',
    'client.tin': client?.tin ?? '',
    scope: job?.title ?? '',
    date: today,
    validUntil: addDays(today, PRICES_HOLD_DAYS),
    startDate,
    endDate,
    paymentMethod: payMethods.find((m) => m.on)?.label ?? 'GCash',
    signer: client?.contactName ?? '',
    designer: business.signatory || (owner ? `${owner.name}, ${owner.roleLabel.split(' · ')[0] || 'Head Designer'}` : ''),
    channel: business.channel ?? '',
    hours: business.hours ?? '',
    delivery: business.delivery ?? '',
  };
  const nameQuestion = questionsOf(tpl.brief).find((x) => /^What is (your|the) (business\/organization|organization\/event|candidate)/i.test(x.q));
  const rec = await create<Contract>(db.contracts, {
    number: await nextNumber('C', 'contracts'),
    clientId,
    proposalId: quote?.id ?? null,
    packageId: items.find((i) => i.base)?.packageId ?? null,
    status: 'draft',
    fields,
    sections: tpl.sections.map((s) => ({ ...s })),
    signedAt: null,
    notes: '',
    templateId: tpl.id,
    title: tpl.name,
    subtitle: tpl.subtitle,
    frame: tpl.frame,
    items,
    discountAmount: jm?.discountAmount ?? quote?.discountAmount ?? 0,
    brief: nameQuestion && client?.name ? [{ q: nameQuestion.q, a: client.name }] : [],
    rush: job?.rush ?? false,
    downPct: money.downPct,
    jobId: job?.id ?? null,
    milestones: planMilestones(tpl.phases, startDate, endDate),
    useSignature: true,
  });
  await audit('create', 'contract', rec.id, `Drafted ${tpl.name} ${rec.number}${fields['client.name'] ? ` for ${fields['client.name']}` : ''}`);
  return rec;
}

/** A confirmed quote becomes a job with the same price lines. */
export async function jobFromQuote(proposalId: string): Promise<Job> {
  const q = await db.proposals.get(proposalId);
  if (!q) throw new Error('That quote no longer exists.');
  if (q.jobId && (await db.jobs.get(q.jobId))) return (await db.jobs.get(q.jobId)) as Job;
  const rates = await getSetting('rates');
  const total = proposalTotals(q, rates).invoice;
  const first = q.items.find((i) => i.unit !== 'percent')?.label ?? 'New job';
  const job = await newJob(
    { title: q.items.length > 1 ? `${first} + ${q.items.length - 1} more` : first, clientId: q.clientId, clientName: q.clientName, type: 'General' },
    { money: { items: q.items, discountAmount: q.discountAmount ?? 0, total } },
  );
  await save(db.proposals, { ...q, jobId: job.id, status: 'won' });
  if (q.clientId) await setClientStage(q.clientId, 'booked');
  return job;
}

/** A signed contract becomes (or updates) its job's price. */
export async function jobFromContract(contractId: string): Promise<Job> {
  const c = await db.contracts.get(contractId);
  if (!c) throw new Error('That contract no longer exists.');
  const items = c.items ?? [];
  const total = docTotals(items, c.discountAmount ?? 0).net;
  if (c.jobId) {
    const job = await db.jobs.get(c.jobId);
    if (job) {
      await saveJobMoney(job.id, { items, discountAmount: c.discountAmount ?? 0, total });
      return job;
    }
  }
  const client = c.clientId ? await db.clients.get(c.clientId) : undefined;
  const tpl = c.templateId ? await db.contractTemplates.get(c.templateId) : undefined;
  const type: Job['type'] = tpl?.id.startsWith('tpl-merch') ? 'Merch' : tpl?.id.startsWith('tpl-branding') ? 'Branding' : tpl?.id.startsWith('tpl-web') ? 'Web' : tpl?.id.startsWith('tpl-motion') ? 'Motion' : tpl?.id.startsWith('tpl-training') ? 'Training' : 'General';
  const job = await newJob(
    {
      title: `${c.title || tpl?.name || 'Project'}${client ? ` · ${client.name}` : ''}`,
      clientId: c.clientId,
      clientName: client?.name ?? c.fields['client.name'] ?? '',
      type,
      startDate: c.fields.startDate || todayISO(),
      dueDate: c.fields.endDate ?? '',
      rush: !!c.rush,
      revisionsIncluded: Math.max(0, ...((await db.packages.bulkGet(items.map((i) => i.packageId ?? '').filter(Boolean))).map((p) => p?.revisions ?? 0))),
    },
    { money: { items, discountAmount: c.discountAmount ?? 0, total } },
  );
  await save(db.contracts, { ...c, jobId: job.id });
  if (c.clientId) await setClientStage(c.clientId, 'booked');
  return job;
}

/** Business or student prices for a client. */
export async function audienceOf(clientId: string | null | undefined): Promise<'business' | 'student'> {
  if (!clientId) return 'business';
  const c = await db.clients.get(clientId);
  return CLIENT_KINDS.find((k) => k.key === c?.kind)?.audience ?? 'business';
}

/** Save an edited contract template (owner and managers). */
export async function saveTemplate(t: ContractTemplate): Promise<ContractTemplate> {
  const next = await save(db.contractTemplates, t);
  await audit('template', 'contractTemplate', t.id, `Edited the ${t.name} (${t.subtitle}) template`);
  return next;
}

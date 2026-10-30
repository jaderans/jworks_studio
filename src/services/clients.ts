import { alive, db } from '../db/db';
import { audit, create, patch, remove, save } from '../db/write';
import { getSetting } from '../db/settings';
import { stageLabel } from '../domain/clients';
import { fieldsFor } from '../domain/contract';
import { addDays, todayISO } from '../lib/time';
import { EMPTY_PERSONA } from './campaigns';
import type { Client, ClientStage, Contract, Package, Proposal } from '../db/types';

// ----- clients -----

export function blankClient(fields: Partial<Client> = {}): Omit<Client, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    industry: '',
    contactName: '',
    email: '',
    phone: '',
    location: '',
    stage: 'inquiry',
    kind: 'business',
    source: '',
    platforms: ['facebook', 'instagram'],
    handles: {},
    brandKitLink: '',
    packageId: null,
    startDate: '',
    renewalDate: '',
    approvalHours: 48,
    goals: '',
    persona: EMPTY_PERSONA,
    checklist: {},
    notes: '',
    ...fields,
  };
}

export async function saveClient(c: Partial<Client> & { name: string }): Promise<Client> {
  if (c.id) {
    const prev = await db.clients.get(c.id);
    if (prev) {
      const next = await save(db.clients, { ...prev, ...c } as Client);
      if (prev.stage !== next.stage) await audit('stage', 'client', next.id, `${next.name}: ${stageLabel(prev.stage)} → ${stageLabel(next.stage)}`);
      return next;
    }
  }
  const rec = await create<Client>(db.clients, blankClient(c));
  await audit('create', 'client', rec.id, `Added the client ${rec.name}`);
  return rec;
}

export async function setClientStage(id: string, stage: ClientStage): Promise<void> {
  const c = await db.clients.get(id);
  if (!c || c.stage === stage) return;
  await patch(db.clients, id, { stage, ...(stage === 'active' && !c.startDate ? { startDate: todayISO() } : {}) });
  await audit('stage', 'client', id, `${c.name}: ${stageLabel(c.stage)} → ${stageLabel(stage)}`);
}

export async function toggleClientCheck(id: string, itemId: string, done: boolean): Promise<void> {
  const c = await db.clients.get(id);
  if (!c) return;
  await patch(db.clients, id, { checklist: { ...c.checklist, [itemId]: done } });
}

export async function deleteClient(id: string): Promise<void> {
  const c = await db.clients.get(id);
  const posts = alive(await db.posts.where('clientId').equals(id).toArray());
  if (posts.some((p) => p.status === 'posted')) throw new Error(`${c?.name ?? 'This client'} has posted content and results. Mark them Completed or Lost instead.`);
  const jobs = alive(await db.jobs.where('clientId').equals(id).toArray());
  if (jobs.length) throw new Error(`${c?.name ?? 'This client'} has ${jobs.length} job${jobs.length === 1 ? '' : 's'}. Mark them Completed or Lost instead.`);
  for (const p of posts) await remove(db.posts, p.id);
  await remove(db.clients, id);
  await audit('delete', 'client', id, `Deleted the client ${c?.name ?? ''}`);
}

// ----- packages -----

export async function savePackage(p: Partial<Package> & { name: string; kind: Package['kind'] }): Promise<Package> {
  if (p.id) {
    const prev = await db.packages.get(p.id);
    if (prev) {
      const next = await save(db.packages, { ...prev, ...p } as Package);
      if (prev.price !== next.price) await audit('price', 'package', next.id, `Changed the ${next.name} price`);
      return next;
    }
  }
  const count = await db.packages.count();
  return create<Package>(db.packages, {
    kind: p.kind,
    name: p.name,
    tagline: p.tagline ?? '',
    price: p.price ?? 0,
    unit: p.unit ?? (p.kind === 'smm' ? 'month' : 'project'),
    platforms: p.platforms ?? [],
    deliverables: p.deliverables ?? [],
    includes: p.includes ?? [],
    revisionsPerPost: p.revisionsPerPost ?? 2,
    minTermMonths: p.minTermMonths ?? (p.kind === 'smm' ? 3 : 0),
    service: p.service ?? '',
    active: p.active ?? 1,
    sort: p.sort ?? count,
    notes: p.notes ?? '',
    category: p.category ?? '',
    audience: p.audience ?? 'any',
    studentPrice: p.studentPrice ?? null,
    turnaround: p.turnaround ?? '',
    revisions: p.revisions ?? 0,
    ...(p.templateId ? { templateId: p.templateId } : {}),
  });
}

export async function deletePackage(id: string): Promise<void> {
  await remove(db.packages, id);
}

// ----- proposals -----

export async function nextNumber(prefix: 'P' | 'C', table: 'proposals' | 'contracts'): Promise<string> {
  const year = new Date().getFullYear();
  const rows = (await db[table].toArray()) as { number: string }[];
  const used = rows.map((r) => Number(new RegExp(`^${prefix}-${year}-(\\d+)$`).exec(r.number)?.[1] ?? 0));
  return `${prefix}-${year}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
}

export async function newProposal(fields: Partial<Proposal> = {}): Promise<Proposal> {
  const today = todayISO();
  const rec = await create<Proposal>(db.proposals, {
    number: await nextNumber('P', 'proposals'),
    clientId: null,
    clientName: '',
    date: today,
    validUntil: addDays(today, 30),
    items: [],
    discountPct: 0,
    discountMonths: 0,
    discountLabel: '',
    vat: false,
    ewt: false,
    status: 'draft',
    intro: '',
    notes: '',
    ...fields,
  });
  await audit('create', 'proposal', rec.id, `Started proposal ${rec.number}${rec.clientName ? ` for ${rec.clientName}` : ''}`);
  return rec;
}

export async function saveProposal(p: Proposal): Promise<Proposal> {
  const prev = await db.proposals.get(p.id);
  const next = await save(db.proposals, p);
  if (prev && prev.status !== next.status) await audit('proposal', 'proposal', next.id, `Proposal ${next.number}: ${prev.status} → ${next.status}`);
  return next;
}

export async function deleteProposal(id: string): Promise<void> {
  await remove(db.proposals, id);
}

// ----- contracts -----

export async function newContract(opts: { clientId: string | null; packageId: string | null; proposalId?: string | null }): Promise<Contract> {
  const [business, sections] = await Promise.all([getSetting('business'), getSetting('contract')]);
  const client = opts.clientId ? ((await db.clients.get(opts.clientId)) ?? null) : null;
  const pkg = opts.packageId ? ((await db.packages.get(opts.packageId)) ?? null) : null;
  const owner = alive(await db.members.toArray()).find((m) => m.appRole === 'owner');
  const rec = await create<Contract>(db.contracts, {
    number: await nextNumber('C', 'contracts'),
    clientId: opts.clientId,
    proposalId: opts.proposalId ?? null,
    packageId: opts.packageId,
    status: 'draft',
    fields: fieldsFor(business, client, pkg, { signatory: owner ? `${owner.name}, ${owner.roleLabel.split(' · ')[0] || 'Owner'}` : '' }),
    sections: sections.map((s) => ({ ...s })),
    signedAt: null,
    notes: '',
  });
  await audit('create', 'contract', rec.id, `Drafted contract ${rec.number}${client ? ` for ${client.name}` : ''}`);
  return rec;
}

export async function saveContract(c: Contract): Promise<Contract> {
  const prev = await db.contracts.get(c.id);
  const next = await save(db.contracts, { ...c, signedAt: c.status === 'signed' ? (c.signedAt ?? Date.now()) : c.signedAt });
  if (prev && prev.status !== next.status) await audit('contract', 'contract', next.id, `Contract ${next.number}: ${prev.status} → ${next.status}`);
  return next;
}

export async function deleteContract(id: string): Promise<void> {
  await remove(db.contracts, id);
}

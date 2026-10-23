import { setAnswer } from './questionnaire';
import { dayStart } from '../lib/time';
import type { BriefAnswer, BusinessSettings, Contract, ContractTemplate, Package, Payment, StudioPayMethod } from '../db/types';

/**
 * Client links: the client answers the questionnaire, or reviews and signs the
 * contract, on their phone. The link holds a snapshot of what they need to see
 * (never the studio's other records); their answers come back and are merged
 * into the contract on the owner's devices.
 */

export type LinkKind = 'questionnaire' | 'sign';

export interface LinkSnapshot {
  contract: Contract;
  template: ContractTemplate;
  business: BusinessSettings;
  payMethods: StudioPayMethod[];
  /** Only the price list sections this contract offers. */
  packages: Package[];
  audience: 'business' | 'student';
  jobNumber?: string;
  /** Which payments are in, for the contract's "Payment received" boxes. */
  payments: Pick<Payment, 'kind'>[];
}

export interface LinkResponse {
  answers: BriefAnswer[];
  name?: string;
  /** Drawn signature, a PNG data URL. */
  signature?: string;
  agreed?: boolean;
  device?: string;
}

const DAY = 86_400_000;

/** Open until a week after the prices' valid-until date, or 30 days; never less than 3 days from now. */
export function linkExpiry(validUntil: string | undefined, now = Date.now()): number {
  const fromPrices = validUntil ? dayStart(validUntil) + 8 * DAY : 0;
  return Math.max(fromPrices || now + 30 * DAY, now + 3 * DAY);
}

export function linkSnapshot(o: Omit<LinkSnapshot, 'packages' | 'payments' | 'contract'> & { contract: Contract; packages: Package[]; payments: Payment[] }): LinkSnapshot {
  const { contract, packages, payments, ...rest } = o;
  // The client sees the contract as it stands, without anything only the studio keeps.
  const { _sync, link, clientSignature, signedOnline, notes, ...shown } = contract as Contract & { _sync?: unknown };
  void _sync;
  void link;
  void clientSignature;
  void signedOnline;
  void notes;
  return {
    ...rest,
    // Anyone holding the link can read it: payment methods travel as QR codes only.
    payMethods: rest.payMethods.filter((m) => m.on && m.qrImage).map((m) => ({ ...m, accountName: '', accountNumber: '' })),
    contract: { ...shown, notes: '' } as Contract,
    packages: packages.filter((p) => p.active === 1 && o.template.categories.includes(p.category ?? '')),
    payments: payments.map((p) => ({ kind: p.kind })),
  };
}

/** Merge what the client sent into the contract (answers always; a signature signs it). */
export function applyLinkResponse(c: Contract, kind: LinkKind, r: LinkResponse, at: number): Contract {
  let brief = c.brief ?? [];
  for (const a of r.answers ?? []) {
    if (typeof a?.q !== 'string') continue;
    brief = setAnswer(brief, a.q, { a: String(a.a ?? '').slice(0, 4000), ...(Array.isArray(a.picks) ? { picks: a.picks.filter((x) => typeof x === 'string').slice(0, 40) } : {}) });
  }
  const next: Contract = { ...c, brief };
  if (kind === 'sign' && r.signature && r.name) {
    next.clientSignature = r.signature;
    next.signedOnline = { name: r.name.trim(), at, device: (r.device ?? '').slice(0, 300) };
    next.status = 'signed';
    next.signedAt = at;
    next.fields = { ...c.fields, signer: c.fields.signer || r.name.trim() };
  }
  if (c.link) next.link = { ...c.link, status: 'applied', respondedAt: at };
  return next;
}

/** Firestore keeps documents under 1 MB; leave room for the response. */
export const SNAPSHOT_LIMIT = 850_000;

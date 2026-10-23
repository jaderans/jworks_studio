import { Timestamp, collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { alive, db } from '../db/db';
import { audit, save } from '../db/write';
import { getSetting } from '../db/settings';
import { CLIENT_KINDS } from '../domain/clients';
import { contractAudience } from '../domain/contractPlan';
import { SNAPSHOT_LIMIT, applyLinkResponse, linkExpiry, linkSnapshot, type LinkKind, type LinkResponse, type LinkSnapshot } from '../domain/clientLink';
import { appBase } from '../email/templates';
import { cloudContext } from './cloud';
import { encodeLinkData } from './config';
import type { ClientLinkState, Contract } from '../db/types';

/**
 * The owner's side of client links: make one for a contract (a snapshot the
 * client can read with the link), keep it up to date while it's open, turn it
 * off, and merge the client's answers and signature into the contract when they
 * arrive. Needs cloud sync, signed in as the owner or a manager.
 */

export class LinkError extends Error {}

function need() {
  const ctx = cloudContext();
  if (!ctx) throw new LinkError('Client links need cloud sync. Turn it on in Settings → Cloud sync and sign in as the owner.');
  if (ctx.role === 'designer') throw new LinkError('Only the owner or a manager can share contracts with clients.');
  return ctx;
}

export const clientLinksAvailable = () => {
  const ctx = cloudContext();
  return !!ctx && ctx.role !== 'designer';
};

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** What the client's page shows, built from this device's records. */
export async function buildSnapshot(c: Contract): Promise<LinkSnapshot> {
  if (!c.templateId) throw new LinkError('Only contracts made from a template can be shared online.');
  const tpl = await db.contractTemplates.get(c.templateId);
  if (!tpl) throw new LinkError('That contract’s template no longer exists.');
  const [business, payMethods, packages, client, job, payments] = await Promise.all([
    getSetting('business'),
    getSetting('payMethods'),
    db.packages.toArray(),
    c.clientId ? db.clients.get(c.clientId) : Promise.resolve(undefined),
    c.jobId ? db.jobs.get(c.jobId) : Promise.resolve(undefined),
    c.jobId ? db.payments.where('jobId').equals(c.jobId).toArray() : Promise.resolve([]),
  ]);
  const clientAudience = CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience ?? 'business';
  return linkSnapshot({
    contract: c,
    template: tpl,
    business,
    payMethods: payMethods.filter((m) => m.on),
    packages: alive(packages),
    audience: contractAudience(c.fields.rates, tpl.audience, clientAudience),
    jobNumber: job?.number,
    payments: alive(payments),
  });
}

function checkSize(s: LinkSnapshot) {
  if (JSON.stringify(s).length > SNAPSHOT_LIMIT) throw new LinkError('This contract is too large to share online (very large QR or signature pictures). Upload smaller pictures in Settings and try again.');
}

export function linkUrl(token: string): string {
  const { cfg } = need();
  return `${appBase()}#/c?d=${encodeLinkData({ f: cfg.firebase, w: cfg.ws, t: token })}`;
}

/** Make a new link (any earlier open link for this contract is turned off). Returns the contract with its link. */
export async function makeClientLink(c: Contract, kind: LinkKind): Promise<Contract> {
  const { fs, cfg, uid } = need();
  if (c.link?.status === 'open') await turnOffClientLink(c).catch(() => undefined);
  const snapshot = await buildSnapshot(c);
  checkSize(snapshot);
  const token = newToken();
  const now = Date.now();
  const expiresAt = linkExpiry(c.fields.validUntil, now);
  await setDoc(doc(fs, 'camp', cfg.ws, 'share', token), { kind, status: 'open', contractId: c.id, createdAt: now, expiresAt: Timestamp.fromMillis(expiresAt), snapshot, _by: uid });
  const link: ClientLinkState = { token, kind, status: 'open', url: linkUrl(token), createdAt: now, expiresAt };
  const next = await save(db.contracts, { ...c, link, status: c.status === 'draft' ? 'sent' : c.status });
  await audit('share', 'contract', c.id, `Made a ${kind === 'sign' ? 'signing' : 'questionnaire'} link for ${c.number}`);
  return next;
}

/** Keep an open link showing the contract as it is now. */
export async function refreshClientLink(c: Contract): Promise<void> {
  if (c.link?.status !== 'open' || !clientLinksAvailable()) return;
  const { fs, cfg } = need();
  const snapshot = await buildSnapshot(c);
  checkSize(snapshot);
  await updateDoc(doc(fs, 'camp', cfg.ws, 'share', c.link.token), { snapshot, expiresAt: Timestamp.fromMillis(linkExpiry(c.fields.validUntil)) });
}

export async function turnOffClientLink(c: Contract): Promise<Contract> {
  if (!c.link) return c;
  const { fs, cfg } = need();
  await updateDoc(doc(fs, 'camp', cfg.ws, 'share', c.link.token), { status: 'off' }).catch(() => undefined);
  return save(db.contracts, { ...c, link: { ...c.link, status: 'off' } });
}

/** Merge one client response into its contract, then mark the link applied. */
async function applyResponse(token: string, data: { kind: LinkKind; contractId: string; response?: LinkResponse; respondedAt?: Timestamp }): Promise<void> {
  const { fs, cfg } = need();
  const c = await db.contracts.get(data.contractId);
  if (c && data.response) {
    const at = data.respondedAt?.toMillis?.() ?? Date.now();
    const next = applyLinkResponse(c, data.kind, data.response, at);
    // An answer to an older link: keep the contract's current link as it is.
    if (c.link?.token !== token) next.link = c.link ?? null;
    await save(db.contracts, next);
    const who = data.response.name || c.fields['client.name'] || 'The client';
    const summary = data.kind === 'sign' && data.response.signature ? `${who} signed ${c.number} online` : `${who} answered the questionnaire for ${c.number}`;
    await audit('share', 'contract', c.id, summary);
    window.dispatchEvent(new CustomEvent('jw-client-response', { detail: { contractId: c.id, summary } }));
  }
  await updateDoc(doc(fs, 'camp', cfg.ws, 'share', token), { status: 'applied' });
}

/** Live: responded links are merged as soon as they arrive (owner and managers). */
export function watchClientResponses(): Unsubscribe | null {
  const ctx = cloudContext();
  if (!ctx || ctx.role === 'designer') return null;
  const q = query(collection(ctx.fs, 'camp', ctx.cfg.ws, 'share'), where('status', '==', 'responded'));
  return onSnapshot(
    q,
    (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed') continue;
        void applyResponse(ch.doc.id, ch.doc.data() as Parameters<typeof applyResponse>[1]).catch((e) => console.warn('Client response not applied yet', e));
      }
    },
    () => undefined,
  );
}

/** The link's current state in the cloud (for the editor's status line). */
export async function readLinkStatus(token: string): Promise<ClientLinkState['status'] | null> {
  const { fs, cfg } = need();
  const d = await getDoc(doc(fs, 'camp', cfg.ws, 'share', token)).catch(() => null);
  return d?.exists() ? (d.data().status as ClientLinkState['status']) : null;
}

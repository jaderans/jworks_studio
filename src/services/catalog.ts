import { alive, db } from '../db/db';
import { audit, build, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { CATALOG_VERSION, PRICE_CHANGES, SEED_PACKAGES } from '../domain/packages';
import { SEED_TEMPLATES, TEMPLATE_CHANGES } from '../domain/contractTemplates';
import { upgradeTemplate } from '../domain/contractTemplatesV1';
import type { ContractTemplate, Package } from '../db/types';

/**
 * The price list and contract templates. New installs get them during setup;
 * other devices load each new catalog version once from Documents: missing
 * items and templates are added, and a changed price or template detail is
 * taken only where the old one is still in place, so the studio's edits stay.
 * (Loading the first version archives the old SMM-only packages, never
 * deleting them, so old quotes still open.)
 */

/** The catalog version this device has loaded (0 = never) and whether a newer one is waiting. */
export async function catalogStatus(): Promise<{ version: number; needs: boolean }> {
  const version = (await getSetting('money')).catalogVersion ?? 0;
  return { version, needs: version < CATALOG_VERSION };
}

export async function catalogNeedsUpdate(): Promise<boolean> {
  return (await catalogStatus()).needs;
}

/** JSON with object keys sorted: a template synced through the cloud can come back with its fields in another order. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Add the current catalog and templates. Existing items keep any edits; only missing ones are added. */
export async function loadCatalog(opts: { archiveOld?: boolean } = {}): Promise<{ added: number; templates: number; archived: number; repriced: number; updated: number }> {
  const from = (await getSetting('money')).catalogVersion ?? 0;
  let added = 0;
  let templates = 0;
  let archived = 0;
  let repriced = 0;
  let updated = 0;
  const existing = new Map((await db.packages.toArray()).map((p) => [p.id, p]));
  for (const seed of SEED_PACKAGES) {
    if (existing.has(seed.id)) continue;
    await db.packages.put(build<Package>(seed));
    added++;
  }
  if (opts.archiveOld ?? from < 1) {
    for (const old of alive([...existing.values()]).filter((p) => p.id.startsWith('seed-pkg-') && p.active === 1)) {
      await save(db.packages, { ...old, active: 0 as const, notes: old.notes || 'Archived: replaced by the October 2026 price list.' });
      archived++;
    }
  }
  // New prices from later versions, where the old price is still the one on this device.
  for (const c of PRICE_CHANGES.filter((x) => x.version > from)) {
    const p = existing.get(c.id);
    if (!p || p.deleted === 1 || p.price !== c.from) continue;
    // Later versions see this price, so one item can change twice (₱250 → ₱220 in version 2, back to ₱250 in 4).
    existing.set(c.id, await save(db.packages, { ...p, price: c.to }));
    repriced++;
  }
  const stored = new Map((await db.contractTemplates.toArray()).map((t) => [t.id, t]));
  for (const t of SEED_TEMPLATES) {
    if (stored.has(t.id)) continue;
    await db.contractTemplates.put(build<ContractTemplate>(t));
    templates++;
  }
  // Template details from later versions (e.g. Motion Graphics now offers Video), where unedited.
  const pending = TEMPLATE_CHANGES.filter((x) => x.version > from);
  for (const id of new Set(pending.map((x) => x.id))) {
    const t = stored.get(id);
    if (!t || t.deleted === 1) continue;
    const patch: Partial<ContractTemplate> = {};
    for (const c of pending.filter((x) => x.id === id)) if (same(t[c.field], c.from)) Object.assign(patch, { [c.field]: c.to });
    if (!Object.keys(patch).length) continue;
    await save(db.contractTemplates, { ...t, ...patch });
    updated++;
  }
  const money = await getSetting('money');
  await setSetting('money', { ...money, catalogVersion: CATALOG_VERSION });
  if (added || templates) await audit('price', 'package', null, `Loaded the price list (${added} items) and ${templates} contract templates`);
  if (repriced) await audit('price', 'package', null, `${repriced} price list items took the new prices of catalog version ${CATALOG_VERSION}`);
  await upgradeTemplates();
  return { added, templates, archived, repriced, updated };
}

/** 2 = the original questionnaires, the questionnaires for every commission type, and the October 2026 terms. */
export const TEMPLATE_VERSION = 2;

/**
 * Bring loaded templates up to the current questionnaires and terms. Parts the
 * studio edited stay as they are (the template editor offers a reset).
 */
export async function upgradeTemplates(): Promise<{ updated: number; edited: string[] }> {
  const money = await getSetting('money');
  if ((money.templateVersion ?? 1) >= TEMPLATE_VERSION) return { updated: 0, edited: [] };
  const latest = new Map(SEED_TEMPLATES.map((t) => [t.id, t]));
  let updated = 0;
  const edited: string[] = [];
  for (const t of alive(await db.contractTemplates.toArray())) {
    const seed = latest.get(t.id);
    if (!seed) continue;
    const r = upgradeTemplate(t, seed);
    if (r.edited.length) edited.push(`${t.name} (${t.subtitle}): ${r.edited.join(', ')}`);
    if (!Object.keys(r.patch).length) continue;
    await save(db.contractTemplates, { ...t, ...r.patch });
    updated++;
  }
  await setSetting('money', { ...(await getSetting('money')), templateVersion: TEMPLATE_VERSION });
  if (updated) await audit('template', 'contractTemplate', null, `Updated ${updated} contract templates to the new questionnaires and terms`);
  return { updated, edited };
}

/** The shipped version of one template's questionnaire, terms and agreement (for "Reset to the latest version"). */
export const latestTemplate = (id: string) => SEED_TEMPLATES.find((t) => t.id === id);

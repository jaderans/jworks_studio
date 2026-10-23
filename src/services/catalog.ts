import { alive, db } from '../db/db';
import { audit, build, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { CATALOG_VERSION, SEED_PACKAGES } from '../domain/packages';
import { SEED_TEMPLATES } from '../domain/contractTemplates';
import { upgradeTemplate } from '../domain/contractTemplatesV1';
import type { ContractTemplate, Package } from '../db/types';

/**
 * The price list and contract templates. New installs get them during setup;
 * devices from the first version of the app load them once from Documents
 * (the old SMM-only packages are archived, never deleted, so old quotes still
 * open).
 */

export async function catalogNeedsUpdate(): Promise<boolean> {
  const money = await getSetting('money');
  return (money.catalogVersion ?? 0) < CATALOG_VERSION;
}

/** Add the current catalog and templates. Existing items keep any edits; only missing ones are added. */
export async function loadCatalog(opts: { archiveOld?: boolean } = {}): Promise<{ added: number; templates: number; archived: number }> {
  let added = 0;
  let templates = 0;
  let archived = 0;
  const existing = new Map((await db.packages.toArray()).map((p) => [p.id, p]));
  for (const seed of SEED_PACKAGES) {
    if (existing.has(seed.id)) continue;
    await db.packages.put(build<Package>(seed));
    added++;
  }
  if (opts.archiveOld !== false) {
    for (const old of alive([...existing.values()]).filter((p) => p.id.startsWith('seed-pkg-') && p.active === 1)) {
      await save(db.packages, { ...old, active: 0 as const, notes: old.notes || 'Archived: replaced by the October 2026 price list.' });
      archived++;
    }
  }
  const tpls = new Set((await db.contractTemplates.toArray()).map((t) => t.id));
  for (const t of SEED_TEMPLATES) {
    if (tpls.has(t.id)) continue;
    await db.contractTemplates.put(build<ContractTemplate>(t));
    templates++;
  }
  const money = await getSetting('money');
  await setSetting('money', { ...money, catalogVersion: CATALOG_VERSION });
  if (added || templates) await audit('price', 'package', null, `Loaded the price list (${added} items) and ${templates} contract templates`);
  await upgradeTemplates();
  return { added, templates, archived };
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

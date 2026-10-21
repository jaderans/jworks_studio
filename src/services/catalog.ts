import { alive, db } from '../db/db';
import { audit, build, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { CATALOG_VERSION, SEED_PACKAGES } from '../domain/packages';
import { SEED_TEMPLATES } from '../domain/contractTemplates';
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
  return { added, templates, archived };
}

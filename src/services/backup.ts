import { db, SYNCED_TABLES, syncedTable, type SyncedTableName } from '../db/db';
import { ensureDevice } from '../db/local';
import { audit } from '../db/write';
import type { Syncable } from '../db/types';

/**
 * Backups and device merges use the same file: every synced record with its
 * updatedAt. Merging keeps the newer copy of each record, so importing the
 * same file twice can never duplicate anything.
 */

export interface BackupFile {
  app: 'jworks-campaigns';
  version: 1;
  exportedAt: number;
  device: { deviceId: string; name: string };
  tables: Partial<Record<SyncedTableName, Syncable[]>>;
}

export async function exportAll(): Promise<BackupFile> {
  const device = await ensureDevice();
  const tables: BackupFile['tables'] = {};
  for (const name of SYNCED_TABLES) {
    const rows = (await syncedTable(name).toArray()) as Syncable[];
    tables[name] = rows.map(({ _sync, ...rest }) => rest as Syncable);
  }
  return { app: 'jworks-campaigns', version: 1, exportedAt: Date.now(), device, tables };
}

export const backupBlob = (file: BackupFile): Blob => new Blob([JSON.stringify(file)], { type: 'application/json' });

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t a JoshWorks Studio backup (it isn’t valid JSON).');
  }
  const f = data as Partial<BackupFile>;
  if (!f || f.app !== 'jworks-campaigns' || typeof f.tables !== 'object' || f.tables === null) throw new Error('This file isn’t a JoshWorks Studio backup.');
  if (f.version !== 1) throw new Error('This backup was made by a newer version of the app. Update the app, then try again.');
  for (const [name, rows] of Object.entries(f.tables)) {
    if (!(SYNCED_TABLES as readonly string[]).includes(name)) continue;
    if (!Array.isArray(rows)) throw new Error(`The backup’s ${name} section is damaged.`);
    for (const r of rows as Syncable[]) if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') throw new Error(`The backup’s ${name} section has a damaged record.`);
  }
  return f as BackupFile;
}

/** Newer wins; on a tie the higher device id wins, so every device ends with the same result. */
export function isNewer(incoming: Syncable, local: Syncable | undefined): boolean {
  if (!local) return true;
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt;
  return (incoming._dev ?? '') > (local._dev ?? '');
}

export interface MergeStats {
  added: number;
  updated: number;
  unchanged: number;
}

export async function mergeBackup(file: BackupFile, opts: { markForUpload: boolean } = { markForUpload: true }): Promise<MergeStats> {
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };
  const names = SYNCED_TABLES.filter((n) => Array.isArray(file.tables[n]));
  await db.transaction('rw', names.map((n) => syncedTable(n)), async () => {
    for (const name of names) {
      const table = syncedTable(name);
      const incoming = file.tables[name] as Syncable[];
      const existing = (await table.bulkGet(incoming.map((r) => r.id))) as (Syncable | undefined)[];
      const toPut: Syncable[] = [];
      incoming.forEach((rec, i) => {
        const local = existing[i];
        if (!isNewer(rec, local)) {
          stats.unchanged++;
          return;
        }
        if (local) stats.updated++;
        else stats.added++;
        toPut.push({ ...rec, _sync: opts.markForUpload ? 1 : 0 });
      });
      if (toPut.length) await table.bulkPut(toPut);
    }
  });
  await audit('merge', 'app', null, `Merged a backup from ${file.device?.name ?? 'another device'}: ${stats.added} new, ${stats.updated} updated`);
  return stats;
}

export function backupFileName(file: BackupFile): string {
  const d = new Date(file.exportedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `jworks-campaigns-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

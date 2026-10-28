import { useSyncExternalStore } from 'react';
import type { AppRole } from '../db/types';

export interface CloudAccess {
  role: AppRole;
  memberId: string | null;
  active: boolean;
  /** Still on the temporary password the owner made: choose a new one first. */
  mustChangePassword?: boolean;
  /** Their own email (a renewed login signs in with a +jw tagged copy of it). */
  email?: string;
}

/** Cloud sync status, shared by the sync engine and the UI. */
export interface SyncStatus {
  enabled: boolean;
  state: 'idle' | 'syncing' | 'ok' | 'error' | 'signed-out';
  message: string;
  lastSyncAt: number | null;
  userEmail: string | null;
  access: CloudAccess | null;
  ws: string | null;
  /** Changes the cloud refused (usually: the security rules need republishing). They stay on the device and are retried. */
  refused: number;
  /** Which kinds of records were refused, e.g. "jobs (20)". */
  refusedTables: string[];
}

let status: SyncStatus = {
  enabled: false,
  state: 'idle',
  message: 'Cloud sync is not set up.',
  lastSyncAt: null,
  userEmail: null,
  access: null,
  ws: null,
  refused: 0,
  refusedTables: [],
};
const listeners = new Set<() => void>();

export function setSyncStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export const getSyncStatus = () => status;

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );
}

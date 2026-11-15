import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { collection, doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { cloudContext } from '../sync/cloud';
import { useSyncStatus } from '../sync/useSync';
import { isPosFeed, posImportState, posJobId, type PosFeed } from '../domain/posFeed';
import { useJobs } from '../hooks/data';

/**
 * JoshWorks POS, live. With both apps in one Firebase project and Studio
 * signed in as the owner (the same login as in the POS), the POS's feed —
 * booth events, commission and Couple-of-Stickers orders, print orders —
 * comes straight from the cloud, on any device, as it changes. The POS says
 * where its data is in owners/{uid}.pos when the owner connects there.
 */
export interface PosLive {
  /**
   * off: not signed in as the owner. looking: finding the POS. none: no POS
   * has connected with this login yet. denied: the cloud refused (rules from
   * before the live link, or a different login). live: listening.
   */
  state: 'off' | 'looking' | 'none' | 'denied' | 'live';
  feeds: PosFeed[];
  removed: PosFeed[];
  /** When the feed last arrived. */
  at: number;
  /** The POS's business name. */
  business: string;
}

const OFF: PosLive = { state: 'off', feeds: [], removed: [], at: 0, business: '' };
let current: PosLive = OFF;
const listeners = new Set<() => void>();
let unsub: Unsubscribe | null = null;
/** The login being watched ("uid", then "uid|ws" once found). */
let watching = '';

function set(next: PosLive) {
  current = next;
  listeners.forEach((l) => l());
}

function stop() {
  unsub?.();
  unsub = null;
  watching = '';
  if (current.state !== 'off') set(OFF);
}

/** Listen to the POS for the owner signed in now; stop when nobody (or not the owner) is. */
export async function watchPos(): Promise<void> {
  const ctx = cloudContext();
  if (!ctx || ctx.role !== 'owner') return stop();
  if (watching === ctx.uid || watching.startsWith(`${ctx.uid}|`)) return;
  stop();
  watching = ctx.uid;
  set({ ...OFF, state: 'looking' });
  try {
    const owner = await getDoc(doc(ctx.fs, 'owners', ctx.uid));
    const pos = owner.exists() ? (owner.data().pos as { ws?: string; name?: string } | undefined) : undefined;
    if (watching !== ctx.uid) return;
    if (!pos?.ws) return set({ ...OFF, state: 'none' });
    watching = `${ctx.uid}|${pos.ws}`;
    unsub = onSnapshot(
      collection(ctx.fs, 'ws', pos.ws, 't_studioFeed'),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as { feed?: unknown; deleted?: number });
        const of = (gone: boolean) => rows.filter((r) => (r.deleted === 1) === gone).map((r) => r.feed).filter(isPosFeed);
        set({ state: 'live', feeds: of(false), removed: of(true), at: Date.now(), business: pos.name ?? '' });
      },
      () => set({ ...OFF, state: 'denied' }),
    );
  } catch {
    if (watching.startsWith(ctx.uid)) set({ ...OFF, state: 'denied' });
  }
}

/** The POS feed from the cloud, kept live while the owner is signed in. */
export function usePosLive(): PosLive {
  const status = useSyncStatus();
  useEffect(() => {
    void watchPos();
  }, [status.state, status.access?.role, status.ws]);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** How many POS items are waiting for the owner: not in Studio yet, or changed since (for the menu's count). */
export function usePosWaiting(): number {
  const live = usePosLive();
  const jobs = useJobs();
  return useMemo(() => {
    if (live.state !== 'live' || !jobs) return 0;
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return live.feeds.filter((f) => posImportState(f, byId.get(posJobId(f))) !== 'current').length;
  }, [live, jobs]);
}

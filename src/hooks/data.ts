import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { alive, db, SYNCED_TABLES, syncedTable } from '../db/db';
import { viewOf } from '../domain/jobs';
import type { JobMoney, JobView, SettingRow } from '../db/types';

/** Live queries: components re-render whenever the underlying rows change. */

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
const byDate = <T extends { date: string | null; sort: number }>(a: T, b: T) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.sort - b.sort;

export const useMembers = () => useLiveQuery(async () => alive(await db.members.toArray()).sort(byName), []);
export const usePosts = () => useLiveQuery(async () => alive(await db.posts.toArray()).sort(byDate), []);
export function usePost(id: string | null | undefined) {
  return useLiveQuery(async () => (id ? ((await db.posts.get(id)) ?? null) : null), [id]);
}
export const useComments = (postId: string | null | undefined) =>
  useLiveQuery(async () => (postId ? alive(await db.comments.where('postId').equals(postId).toArray()).sort((a, b) => a.at - b.at) : []), [postId]);
export const useCampaigns = () => useLiveQuery(async () => alive(await db.campaigns.toArray()).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || b.createdAt - a.createdAt), []);
export const useFunnels = () => useLiveQuery(async () => alive(await db.funnels.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
export const useIdeas = () => useLiveQuery(async () => alive(await db.ideas.toArray()).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)), []);
export const useSnippets = () => useLiveQuery(async () => alive(await db.snippets.toArray()).sort((a, b) => a.sort - b.sort), []);
export const useTrends = () => useLiveQuery(async () => alive(await db.trends.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
export const useHooks = () => useLiveQuery(async () => alive(await db.hooks.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
export const useReports = () => useLiveQuery(async () => alive(await db.reports.toArray()).sort((a, b) => b.weekOf.localeCompare(a.weekOf) || b.generatedAt - a.generatedAt), []);
export const useMetrics = () => useLiveQuery(async () => alive(await db.metrics.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
export const useClients = () => useLiveQuery(async () => alive(await db.clients.toArray()).sort(byName), []);
export const usePackages = () => useLiveQuery(async () => alive(await db.packages.toArray()).sort((a, b) => a.sort - b.sort), []);
export const useProposals = () => useLiveQuery(async () => alive(await db.proposals.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
export const useContracts = () => useLiveQuery(async () => alive(await db.contracts.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
export const useContractTemplates = () => useLiveQuery(async () => alive(await db.contractTemplates.toArray()).sort((a, b) => a.sort - b.sort), []);

/** Jobs with their progress, newest number first. */
export const useJobs = () =>
  useLiveQuery(async (): Promise<JobView[]> => {
    const [jobs, progress] = await Promise.all([db.jobs.toArray(), db.jobProgress.toArray()]);
    const byId = new Map(progress.map((p) => [p.id, p]));
    return alive(jobs)
      .map((j) => viewOf(j, byId.get(j.id)))
      .sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
  }, []);
export const useJobMoney = () => useLiveQuery(async () => new Map(alive(await db.jobMoney.toArray()).map((m) => [m.id, m] as [string, JobMoney])), []);
export const usePayments = () => useLiveQuery(async () => alive(await db.payments.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), []);
export const useEarnings = () => useLiveQuery(async () => alive(await db.earnings.toArray()), []);
export const usePayouts = () => useLiveQuery(async () => alive(await db.payouts.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), []);
export const usePayoutAccounts = () => useLiveQuery(async () => alive(await db.payoutAccounts.toArray()), []);
export const useInvoices = () => useLiveQuery(async () => alive(await db.invoices.toArray()).sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true })), []);
export const useExpenses = () => useLiveQuery(async () => alive(await db.expenses.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
export const useChats = () => useLiveQuery(async () => (await db.chats.toArray()).sort((a, b) => b.updatedAt - a.updatedAt), []);
export const useAudit = (limit = 300) => useLiveQuery(async () => (await db.audit.orderBy('at').reverse().limit(limit).toArray()).filter((a) => a.deleted !== 1), [limit]);
export const useSettingRows = () => useLiveQuery(async () => (await db.settings.toArray()) as SettingRow[], []);
export const useLocal = <T,>(key: string, fallback: T) =>
  useLiveQuery(async () => {
    const row = await db.local.get(key);
    return row === undefined ? fallback : (row.value as T);
  }, [key]);

/** Number of records changed on this device and not uploaded yet. */
export const usePendingCount = () =>
  useLiveQuery(async () => {
    let n = 0;
    for (const t of SYNCED_TABLES) n += await syncedTable(t).where('_sync').equals(1).count();
    return n;
  }, []);

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

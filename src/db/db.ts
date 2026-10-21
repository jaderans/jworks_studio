import Dexie, { type Table } from 'dexie';
import type {
  AuditEntry, Campaign, Chat, Client, Comment, Contract, ContractTemplate, Earning, Expense, Funnel, Hook, Idea, Invoice, Job, JobMoney, JobProgress, LocalRow,
  Member, Metric, Package, Payment, Payout, PayoutAccount, Post, Proposal, SettingRow, Snippet, Trend, TrendReport,
} from './types';

/**
 * The on-device database (IndexedDB). This is the source of truth: the app
 * reads and writes here first, so it keeps working with no internet.
 * (Its name differs from JoshWorks POS's, so both apps can share a domain.)
 */
export class CampDB extends Dexie {
  settings!: Table<SettingRow, string>;
  members!: Table<Member, string>;
  posts!: Table<Post, string>;
  comments!: Table<Comment, string>;
  campaigns!: Table<Campaign, string>;
  funnels!: Table<Funnel, string>;
  ideas!: Table<Idea, string>;
  snippets!: Table<Snippet, string>;
  trends!: Table<Trend, string>;
  hooks!: Table<Hook, string>;
  reports!: Table<TrendReport, string>;
  metrics!: Table<Metric, string>;
  clients!: Table<Client, string>;
  packages!: Table<Package, string>;
  proposals!: Table<Proposal, string>;
  contracts!: Table<Contract, string>;
  audit!: Table<AuditEntry, string>;
  jobs!: Table<Job, string>;
  jobProgress!: Table<JobProgress, string>;
  jobMoney!: Table<JobMoney, string>;
  payments!: Table<Payment, string>;
  earnings!: Table<Earning, string>;
  payouts!: Table<Payout, string>;
  payoutAccounts!: Table<PayoutAccount, string>;
  invoices!: Table<Invoice, string>;
  expenses!: Table<Expense, string>;
  contractTemplates!: Table<ContractTemplate, string>;
  // Device-only tables (never synced)
  local!: Table<LocalRow, string>;
  chats!: Table<Chat, string>;

  constructor(name = 'jworks-campaigns') {
    super(name);
    this.version(1).stores({
      settings: 'id, updatedAt, _sync',
      members: 'id, appRole, email, updatedAt, _sync',
      posts: 'id, date, status, clientId, campaignId, updatedAt, _sync',
      comments: 'id, postId, at, updatedAt, _sync',
      campaigns: 'id, clientId, status, updatedAt, _sync',
      funnels: 'id, clientId, campaignId, updatedAt, _sync',
      ideas: 'id, kind, status, updatedAt, _sync',
      snippets: 'id, kind, updatedAt, _sync',
      trends: 'id, kind, status, updatedAt, _sync',
      hooks: 'id, memberId, practiceDate, updatedAt, _sync',
      reports: 'id, weekOf, updatedAt, _sync',
      metrics: 'id, postId, clientId, date, platform, updatedAt, _sync',
      clients: 'id, stage, updatedAt, _sync',
      packages: 'id, kind, updatedAt, _sync',
      proposals: 'id, clientId, status, updatedAt, _sync',
      contracts: 'id, clientId, status, updatedAt, _sync',
      audit: 'id, at, entity, entityId, updatedAt, _sync',
      local: 'key',
      chats: 'id, updatedAt',
    });
    // JoshWorks Studio: the commission tracker, money and documents. Version 1 data stays as it is.
    this.version(2).stores({
      jobs: 'id, number, clientId, dueDate, updatedAt, _sync',
      jobProgress: 'id, status, updatedAt, _sync',
      jobMoney: 'id, updatedAt, _sync',
      payments: 'id, jobId, invoiceId, clientId, date, updatedAt, _sync',
      earnings: 'id, memberId, jobId, paymentId, updatedAt, _sync',
      payouts: 'id, memberId, date, updatedAt, _sync',
      payoutAccounts: 'id, updatedAt, _sync',
      invoices: 'id, number, jobId, clientId, status, updatedAt, _sync',
      expenses: 'id, date, updatedAt, _sync',
      contractTemplates: 'id, updatedAt, _sync',
    });
  }
}

export const db = new CampDB();

/** Tables that sync between devices and to the cloud, in upload order. */
export const SYNCED_TABLES = [
  'settings', 'members', 'clients', 'packages', 'campaigns', 'funnels', 'ideas', 'snippets', 'posts', 'comments',
  'trends', 'hooks', 'reports', 'metrics', 'proposals', 'contracts', 'audit',
  'contractTemplates', 'jobs', 'jobProgress', 'jobMoney', 'payments', 'earnings', 'payouts', 'payoutAccounts', 'invoices', 'expenses',
] as const;
export type SyncedTableName = (typeof SYNCED_TABLES)[number];

/** Money and legal documents: only the owner and managers receive them. */
export const MANAGER_TABLES: readonly SyncedTableName[] = [
  'packages', 'proposals', 'contracts', 'contractTemplates', 'jobMoney', 'payments', 'invoices', 'expenses',
];

/** Designers receive only their own rows of these (filtered by memberId). */
export const OWN_ROW_TABLES: readonly SyncedTableName[] = ['earnings', 'payouts'];

export function syncedTable(name: SyncedTableName): Table<any, string> {
  return (db as unknown as Record<string, Table<any, string>>)[name];
}

/** Drop tombstones. */
export const alive = <T extends { deleted?: 0 | 1 }>(rows: readonly T[]): T[] => rows.filter((r) => r.deleted !== 1);

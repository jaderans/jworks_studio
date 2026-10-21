import type { ClientKind, ClientStage, LegacyClientStage } from '../db/types';

/**
 * Clients of every kind (businesses, student orgs, schools, individuals, LGUs)
 * move through one pipeline: inquiry → quoted → booked → active → completed.
 * Each stage has the checklist that keeps nothing from slipping.
 */
export interface StageDef {
  key: ClientStage;
  label: string;
  hint: string;
  checklist: { id: string; label: string }[];
}

export const PIPELINE: StageDef[] = [
  {
    key: 'inquiry',
    label: 'Inquiry',
    hint: 'They messaged, commented, walked in or were referred.',
    checklist: [
      { id: 'inq-reply', label: 'Replied within the day' },
      { id: 'inq-needs', label: 'Know what they need, by when, and their budget' },
      { id: 'inq-kind', label: 'Business or student rate decided' },
    ],
  },
  {
    key: 'quoted',
    label: 'Quoted',
    hint: 'Recommend one package; offer one step up and one step down.',
    checklist: [
      { id: 'quo-made', label: 'Quote made from the price list' },
      { id: 'quo-sent', label: 'Quote sent' },
      { id: 'quo-follow', label: 'Followed up after 2 days' },
    ],
  },
  {
    key: 'booked',
    label: 'Booked',
    hint: 'Never start without a signed contract and the down payment.',
    checklist: [
      { id: 'boo-contract', label: 'Contract generated and signed' },
      { id: 'boo-down', label: 'Down payment received (receipt sent)' },
      { id: 'boo-brief', label: 'Brief or questionnaire answered' },
      { id: 'boo-assets', label: 'Logo files, photos and content received' },
      { id: 'boo-access', label: 'Page access via partner access, never passwords (social media work)' },
    ],
  },
  { key: 'active', label: 'Active', hint: 'Work in progress or an ongoing retainer.', checklist: [] },
  {
    key: 'completed',
    label: 'Completed',
    hint: 'Delivered and paid.',
    checklist: [
      { id: 'com-paid', label: 'Paid in full' },
      { id: 'com-files', label: 'Final files delivered' },
      { id: 'com-testimonial', label: 'Asked for a testimonial' },
    ],
  },
  { key: 'lost', label: 'Lost', hint: 'Didn’t go ahead; note why.', checklist: [] },
];

/** Board columns, in order. */
export const PIPELINE_BOARD: ClientStage[] = ['inquiry', 'quoted', 'booked', 'active', 'completed'];

/** The first version of the app used social-media-management stages. */
const LEGACY: Record<LegacyClientStage, ClientStage> = {
  lead: 'inquiry',
  discovery: 'inquiry',
  proposal: 'quoted',
  contract: 'booked',
  onboarding: 'booked',
  strategy: 'active',
  paused: 'active',
  ended: 'completed',
};

export function normalizeStage(stage: ClientStage | LegacyClientStage | string | undefined): ClientStage {
  if (!stage) return 'inquiry';
  if ((PIPELINE as { key: string }[]).some((s) => s.key === stage)) return stage as ClientStage;
  return LEGACY[stage as LegacyClientStage] ?? 'inquiry';
}

export const STAGE_LABEL = Object.fromEntries(PIPELINE.map((s) => [s.key, s.label])) as Record<ClientStage, string>;
export const stageLabel = (stage: ClientStage | LegacyClientStage | string | undefined) => STAGE_LABEL[normalizeStage(stage)];

export const CLIENT_KINDS: { key: ClientKind; label: string; audience: 'business' | 'student' }[] = [
  { key: 'business', label: 'Business', audience: 'business' },
  { key: 'student-org', label: 'Student organization', audience: 'student' },
  { key: 'school', label: 'School or university', audience: 'business' },
  { key: 'individual', label: 'Individual', audience: 'business' },
  { key: 'government', label: 'LGU or government office', audience: 'business' },
];

export const CLIENT_KIND_LABEL = Object.fromEntries(CLIENT_KINDS.map((k) => [k.key, k.label])) as Record<ClientKind, string>;

/** Where inquiries come from. */
export const SOURCES = ['Messenger', 'Facebook', 'Instagram', 'TikTok', 'Referral', 'Walk-in / pop-up', 'Email', 'Repeat client', 'Other'];

/** Monthly cycle for retainer (SMM) clients; ids get the month appended (e.g. cyc-create:2026-11). */
export const MONTHLY_CYCLE = [
  { id: 'cyc-create', label: 'Content created' },
  { id: 'cyc-approve', label: 'Approved by the client' },
  { id: 'cyc-schedule', label: 'Scheduled' },
  { id: 'cyc-engage', label: 'Replies and engagement done' },
  { id: 'cyc-report', label: 'Monthly report sent' },
  { id: 'cyc-invoice', label: 'Invoice sent and paid' },
];

export function stageProgress(stage: ClientStage | LegacyClientStage, checklist: Record<string, boolean>): { done: number; total: number } {
  const def = PIPELINE.find((s) => s.key === normalizeStage(stage));
  const items = def?.checklist ?? [];
  return { done: items.filter((i) => checklist[i.id]).length, total: items.length };
}

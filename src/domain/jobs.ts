import type { Job, JobProgress, JobStatus, JobType, JobView, Priority, Syncable } from '../db/types';

/** Jobs are the commission tracker's rows: one client commission each. */

export const JOB_TYPES: JobType[] = [
  'Branding', 'General', 'Merch', 'Publication', 'Campaign', 'Video Editing', 'Motion', '3D Model', 'Web', 'SMM / Retainer', 'Pop-up / Stickers', 'Training',
];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  inquiry: 'Inquiry',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  review: 'For review',
  revisions: 'Revisions',
  completed: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

/** Board columns, in order. */
export const JOB_BOARD: JobStatus[] = ['inquiry', 'not-started', 'in-progress', 'review', 'revisions', 'completed'];

export const OPEN_STATUSES: readonly JobStatus[] = ['not-started', 'in-progress', 'review', 'revisions', 'blocked'];
export const isOpen = (j: Pick<JobView, 'status'>) => OPEN_STATUSES.includes(j.status);

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', med: 'Med', high: 'High' };

/** Tracker values → app values. */
export function statusFromTracker(text: string): JobStatus {
  const t = text.trim().toLowerCase();
  if (t.startsWith('complete') || t === 'done') return 'completed';
  if (t.startsWith('in progress') || t === 'ongoing') return 'in-progress';
  if (t.startsWith('block')) return 'blocked';
  if (t.startsWith('cancel')) return 'cancelled';
  if (t.includes('review')) return 'review';
  if (t.includes('revision')) return 'revisions';
  if (t.includes('inquir')) return 'inquiry';
  return 'not-started';
}

export function priorityFromTracker(text: string): Priority {
  const t = text.trim().toLowerCase();
  return t.startsWith('h') ? 'high' : t.startsWith('l') ? 'low' : 'med';
}

export function typeFromTracker(text: string): JobType {
  const t = text.trim().toLowerCase();
  const hit = JOB_TYPES.find((x) => x.toLowerCase() === t);
  if (hit) return hit;
  if (t.includes('smm') || t.includes('retainer')) return 'SMM / Retainer';
  if (t.includes('sticker') || t.includes('pop')) return 'Pop-up / Stickers';
  if (t.includes('video')) return 'Video Editing';
  if (t.includes('3d')) return '3D Model';
  return 'General';
}

/** Steps between "done" and "closed": what's easy to forget at the end of a job. */
export const DELIVERY_CHECKLIST = [
  { id: 'dl-final', label: 'Final files sent (PNG, JPEG, PDF)' },
  { id: 'dl-source', label: 'Source files sent (only if paid for)' },
  { id: 'dl-confirmed', label: 'Client confirmed they received everything' },
  { id: 'dl-backup', label: 'Backed up to the studio drive' },
  { id: 'dl-portfolio', label: 'Portfolio-ready (or NDA noted)' },
  { id: 'dl-testimonial', label: 'Asked for a testimonial' },
];

export function deliveryProgress(job: Pick<JobProgress, 'checklist'>): { done: number; total: number } {
  return { done: DELIVERY_CHECKLIST.filter((c) => job.checklist?.[c.id]).length, total: DELIVERY_CHECKLIST.length };
}

/** Revision rounds beyond the package limit (each is billed at the extra-revision rate). */
export const extraRevisions = (job: Pick<JobView, 'revisionsIncluded' | 'revisionsUsed'>): number =>
  Math.max(0, (job.revisionsUsed || 0) - (job.revisionsIncluded || 0));

/** "COM-041" → 41. */
export function jobSeq(no: string): number {
  const m = /(\d+)\s*$/.exec(no);
  return m ? Number(m[1]) : 0;
}

export const formatJobNo = (n: number) => `COM-${String(n).padStart(3, '0')}`;

export function nextJobNumber(existing: readonly string[]): string {
  return formatJobNo(Math.max(0, ...existing.map(jobSeq)) + 1);
}

/** Days until due (negative = late). null when there's no due date. */
export function daysLeft(job: Pick<Job, 'dueDate'>, today: string): number | null {
  if (!job.dueDate) return null;
  return Math.round((Date.parse(`${job.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export const EMPTY_PROGRESS: Omit<JobProgress, keyof Syncable> = { status: 'not-started', completedOn: '', revisionsUsed: 0, checklist: {}, links: [], notes: '' };

/** A job with its progress (a missing progress record means "not started"). */
export function viewOf(job: Job, progress: JobProgress | undefined): JobView {
  const p = progress && progress.deleted !== 1 ? progress : null;
  return {
    ...job,
    status: p?.status ?? EMPTY_PROGRESS.status,
    completedOn: p?.completedOn ?? '',
    revisionsUsed: p?.revisionsUsed ?? 0,
    checklist: p?.checklist ?? {},
    links: p?.links ?? [],
    notes: p?.notes ?? '',
    progressAt: p?.updatedAt ?? 0,
  };
}

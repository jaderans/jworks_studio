import { CalendarClock } from 'lucide-react';
import { daysLeft } from '../domain/jobs';
import { fmtIsoDate } from '../lib/time';
import type { JobView } from '../db/types';

/** How long until a job is due, coloured once it is close or late. */
export function DueChip({ job, today }: { job: Pick<JobView, 'dueDate' | 'status'>; today: string }) {
  const d = daysLeft(job, today);
  if (d === null || job.status === 'completed' || job.status === 'cancelled') return job.dueDate ? <span className="tiny muted">{fmtIsoDate(job.dueDate)}</span> : null;
  const tone = d < 0 ? 'bad' : d <= 3 ? 'warn' : undefined;
  const text = d < 0 ? `${-d} day${d === -1 ? '' : 's'} late` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d} days`;
  return (
    <span className={`due-chip ${tone ?? ''}`} title={fmtIsoDate(job.dueDate)}>
      <CalendarClock size={12} aria-hidden="true" /> {text}
    </span>
  );
}

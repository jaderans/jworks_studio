import { addDays, daysFrom } from '../lib/time';
import type { Audience, Milestone, Package, ProposalItem } from '../db/types';

/**
 * The schedule side of a contract: when it should finish (from the package
 * turnaround), the milestones along the way (one per phase) and what the
 * client receives (the chosen packages' "includes").
 */

/** "7–14 days" → 14, "2–3 weeks" → 21, "1 month" → 30, "10 business days" → 14. Null when there's no number. */
export function turnaroundDays(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)(?:\s*[–—-]\s*(\d+))?\s*(business\s+days?|working\s+days?|days?|weeks?|months?)/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  const unit = m[3].toLowerCase();
  if (unit.startsWith('week')) return n * 7;
  if (unit.startsWith('month')) return n * 30;
  if (unit.startsWith('business') || unit.startsWith('working')) return Math.ceil((n * 7) / 5);
  return n;
}

/** Rush service promises 3–5 days. */
export const RUSH_DAYS = 5;

/** The longest turnaround among the chosen packages (add-ons don't count). */
export function projectDays(items: readonly ProposalItem[], packages: readonly Package[], rush = false): number | null {
  const byId = new Map(packages.map((p) => [p.id, p]));
  const days = items
    .map((i) => (i.packageId ? byId.get(i.packageId) : undefined))
    .filter((p): p is Package => !!p && p.kind !== 'addon')
    .map((p) => turnaroundDays(p.turnaround))
    .filter((d): d is number => d !== null);
  if (!days.length) return rush ? RUSH_DAYS : null;
  const longest = Math.max(...days);
  return rush ? Math.min(longest, RUSH_DAYS) : longest;
}

export function completionDate(start: string, items: readonly ProposalItem[], packages: readonly Package[], rush = false): string {
  const days = projectDays(items, packages, rush);
  return start && days ? addDays(start, days) : '';
}

/** A short "what you receive" for a phase, from its title. */
export function phaseReceives(title: string): string {
  if (/brief|discovery|onboarding|planning|assessment|selection|content review|strategy/i.test(title)) return 'Kick-off: questionnaire answered and brief confirmed';
  if (/storyboard/i.test(title)) return 'Storyboard to approve';
  if (/concept|direction|design|layout|production|cover|template/i.test(title)) return 'Designs to review';
  if (/revision|refine|review|critique/i.test(title)) return 'Revised designs (within your revision rounds)';
  if (/final|handoff|hand-off|delivery|launch|certification|render|print/i.test(title)) return 'Final files, after full payment';
  return '';
}

/** One milestone per phase, dated evenly between start and finish (undated when either is missing). */
export function planMilestones(phases: readonly { title: string }[], start: string, end: string): Milestone[] {
  const span = start && end ? Math.max(0, daysFrom(start, end)) : 0;
  return phases.map((ph, i) => ({
    title: ph.title,
    date: start && end ? (i === phases.length - 1 ? end : addDays(start, Math.round(((i + 1) * span) / phases.length))) : '',
    what: phaseReceives(ph.title),
  }));
}

/** What the client receives: the chosen packages' contents, then any extra lines by name. */
export function deliverablesOf(items: readonly ProposalItem[], packages: readonly Package[]): string[] {
  const byId = new Map(packages.map((p) => [p.id, p]));
  const out: string[] = [];
  for (const i of items) {
    const p = i.packageId ? byId.get(i.packageId) : undefined;
    if (i.unit === 'percent') continue;
    const add = p && p.kind !== 'addon' && p.includes.length ? p.includes : [i.qty > 1 ? `${i.label} × ${i.qty}` : i.label];
    for (const x of add) if (!out.includes(x)) out.push(x);
  }
  return out;
}

/**
 * Which prices a contract uses: its own choice ("Rates" in the editor), else the
 * template's audience, else the client's kind (for universal templates).
 */
export function contractAudience(choice: string | undefined, template: Audience, client: 'business' | 'student'): 'business' | 'student' {
  if (choice === 'business' || choice === 'student') return choice;
  if (template === 'business' || template === 'student') return template;
  return client;
}

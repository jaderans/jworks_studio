import type { BriefAnswer } from '../db/types';

/**
 * A contract's questionnaire, written as plain lines so the template editor
 * stays a text box:
 *
 *   > Intro sentence under the title
 *   ## Section heading
 *   An open question?                         (printed with answer lines)
 *   A tick-box question? :: A | B | Other:    (an option ending in ":" gets a fill-in line)
 *
 * Questions are numbered in order. Answers are kept by question text.
 */

export interface QOption {
  label: string;
  /** "Other:" style options carry a line to write on. */
  fill: boolean;
}

export type QItem =
  | { kind: 'intro'; text: string }
  | { kind: 'section'; title: string }
  | { kind: 'open'; n: number; q: string }
  | { kind: 'choice'; n: number; q: string; options: QOption[]; cols: number };

/** Short options sit four to a row, longer ones three or two, like the studio's Word questionnaire (never more columns than options). */
export function columnsFor(options: QOption[]): number {
  const plain = options.filter((o) => !o.fill);
  const longest = Math.max(0, ...plain.map((o) => o.label.length));
  return Math.max(1, Math.min(longest <= 16 ? 4 : longest <= 22 ? 3 : 2, plain.length));
}

export function parseQuestionnaire(lines: readonly string[]): QItem[] {
  const out: QItem[] = [];
  let n = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('##')) {
      out.push({ kind: 'section', title: line.replace(/^#+\s*/, '') });
      continue;
    }
    if (line.startsWith('>')) {
      out.push({ kind: 'intro', text: line.replace(/^>\s*/, '') });
      continue;
    }
    const split = line.indexOf('::');
    if (split > 0) {
      const options = line
        .slice(split + 2)
        .split('|')
        .map((o) => o.trim())
        .filter(Boolean)
        .map((label) => ({ label, fill: label.endsWith(':') }));
      if (options.length) {
        out.push({ kind: 'choice', n: ++n, q: line.slice(0, split).trim(), options, cols: columnsFor(options) });
        continue;
      }
    }
    out.push({ kind: 'open', n: ++n, q: line });
  }
  return out;
}

/** The questions alone (no headings), in order. */
export const questionsOf = (lines: readonly string[]) => parseQuestionnaire(lines).filter((i): i is Extract<QItem, { kind: 'open' | 'choice' }> => i.kind === 'open' || i.kind === 'choice');

export const answerFor = (answers: readonly BriefAnswer[] | undefined, q: string): BriefAnswer | undefined => answers?.find((a) => a.q === q);

/** Set one question's answer, keeping the others (and answers to questions no longer asked). */
export function setAnswer(answers: readonly BriefAnswer[] | undefined, q: string, patch: Partial<Omit<BriefAnswer, 'q'>>): BriefAnswer[] {
  const list = [...(answers ?? [])];
  const i = list.findIndex((a) => a.q === q);
  const next = { ...(i >= 0 ? list[i] : { q, a: '' }), ...patch };
  if (i >= 0) list[i] = next;
  else list.push(next);
  return list;
}

/** Answers given to questions that are no longer in the questionnaire (kept, shown apart). */
export function earlierAnswers(lines: readonly string[], answers: readonly BriefAnswer[] | undefined): BriefAnswer[] {
  const asked = new Set(questionsOf(lines).map((x) => x.q));
  return (answers ?? []).filter((a) => !asked.has(a.q) && (a.a.trim() || a.picks?.length));
}

/** Answered questions count (for "7 of 22 answered"). */
export function answeredCount(lines: readonly string[], answers: readonly BriefAnswer[] | undefined): { done: number; total: number } {
  const qs = questionsOf(lines);
  const done = qs.filter((x) => {
    const a = answerFor(answers, x.q);
    return !!(a && (a.a.trim() || a.picks?.length));
  }).length;
  return { done, total: qs.length };
}

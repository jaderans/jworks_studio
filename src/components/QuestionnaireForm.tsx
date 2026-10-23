import { answerFor, answeredCount, earlierAnswers, parseQuestionnaire, setAnswer } from '../domain/questionnaire';
import { Field, TextArea, TextInput } from './form';
import type { BriefAnswer } from '../db/types';

/**
 * A contract questionnaire to fill in: open questions as text boxes, tick-box
 * questions as chips (an "Other:" chip opens a line to write on). The contract
 * editor and the client's online link both use it.
 */
export function QuestionnaireForm({
  lines,
  answers,
  onChange,
  idPrefix = 'q',
  showEarlier = true,
}: {
  lines: readonly string[];
  answers: readonly BriefAnswer[] | undefined;
  onChange: (next: BriefAnswer[]) => void;
  idPrefix?: string;
  /** List answers to questions the questionnaire no longer asks. */
  showEarlier?: boolean;
}) {
  const items = parseQuestionnaire(lines);
  const count = answeredCount(lines, answers);
  const earlier = showEarlier ? earlierAnswers(lines, answers) : [];
  return (
    <div className="stack questionnaire">
      <p className="tiny muted strong">
        {count.done} of {count.total} answered
      </p>
      {items.map((it, i) => {
        if (it.kind === 'intro') return <p key={i} className="small muted">{it.text}</p>;
        if (it.kind === 'section') return <h3 key={i} className="q-section">{it.title}</h3>;
        const a = answerFor(answers, it.q);
        const id = `${idPrefix}-${it.n}`;
        if (it.kind === 'open')
          return (
            <Field key={i} label={`${it.n}. ${it.q}`} htmlFor={id}>
              <TextArea id={id} rows={2} value={a?.a ?? ''} onChange={(e) => onChange(setAnswer(answers, it.q, { a: e.target.value }))} />
            </Field>
          );
        const picks = a?.picks ?? [];
        const fillPicked = it.options.some((o) => o.fill && picks.includes(o.label));
        return (
          <div key={i} className="field">
            <span className="label" id={`${id}-l`}>
              {it.n}. {it.q}
            </span>
            <div className="chip-row" role="group" aria-labelledby={`${id}-l`}>
              {it.options.map((o) => {
                const on = picks.includes(o.label);
                return (
                  <button
                    key={o.label}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => onChange(setAnswer(answers, it.q, { picks: on ? picks.filter((x) => x !== o.label) : [...picks, o.label] }))}
                  >
                    {o.fill ? o.label.replace(/:$/, '') : o.label}
                  </button>
                );
              })}
            </div>
            {fillPicked ? (
              <TextInput aria-label={`${it.q}: details`} placeholder="Please specify" value={a?.a ?? ''} onChange={(e) => onChange(setAnswer(answers, it.q, { a: e.target.value }))} />
            ) : null}
          </div>
        );
      })}
      {earlier.length ? (
        <div className="card stack tight">
          <span className="eyebrow">Answers to earlier questions</span>
          {earlier.map((x) => (
            <p key={x.q} className="small">
              <b>{x.q}</b> {[x.picks?.join(', '), x.a].filter(Boolean).join(' · ')}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

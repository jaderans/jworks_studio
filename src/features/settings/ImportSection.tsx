import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout } from '../../components/ui';
import { Check, Field } from '../../components/form';
import { readXlsx } from '../../domain/xlsx';
import { defaultSkipRow, parsePlanner, type PlannerImport } from '../../domain/planner';
import { applyPlanner, defaultRestart, previewPlanner, type PlannerOptions, type PlannerPreview } from '../../services/importPlanner';
import { fmtIsoDate, fmtIsoWeekday } from '../../lib/time';

/**
 * Bring the Google Sheets content planner in. The file is read on this device;
 * nothing is uploaded. Already-posted rows can be skipped, and everything not
 * posted yet can restart from a new date.
 */
export function ImportSection({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const app = useApp();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState('');
  const [parsed, setParsed] = useState<PlannerImport | null>(null);
  const [opts, setOpts] = useState<PlannerOptions | null>(null);
  const [preview, setPreview] = useState<PlannerPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const load = async (f: File) => {
    setError('');
    setPreview(null);
    try {
      const p = parsePlanner(readXlsx(new Uint8Array(await f.arrayBuffer())));
      if (!p.rows.length && !p.ideas.length) throw new Error('No content calendar or idea bank was found in that workbook.');
      setFile(f.name);
      setParsed(p);
      const skip = defaultSkipRow(p.rows);
      const firstOpen = p.rows.find((r) => r.kind === 'post' && r.row > skip && r.date);
      const past = !!firstOpen?.date && firstOpen.date < new Date().toISOString().slice(0, 10);
      setOpts({ skipThroughRow: skip, restartOn: past ? defaultRestart() : null, team: true, themes: true, scripts: true, ideas: true, concepts: true, metrics: true, snippets: true, breaks: p.rows.some((r) => r.kind === 'break' && r.date), replaceOld: true });
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  };

  const doPreview = async () => {
    if (!parsed || !opts) return;
    setPreview(await previewPlanner(parsed, opts));
  };

  const doImport = async () => {
    if (!parsed || !opts || !preview) return;
    setBusy(true);
    try {
      const s = await applyPlanner(parsed, opts, preview);
      app.toast(`Imported ${s.posts} posts${s.backlog ? ` (+${s.backlog} waiting for a date)` : ''}, ${s.ideas} ideas, ${s.scripts} scripts, ${s.metrics} results${s.alreadyThere ? `; ${s.alreadyThere} ${s.alreadyThere === 1 ? 'was' : 'were'} already here` : ''}`, { tone: 'good', ms: 9000 });
      setParsed(null);
      setPreview(null);
      setFile('');
      onDone?.();
      if (!onDone) navigate('/calendar');
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'The import failed', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const posts = parsed?.rows.filter((r) => r.kind === 'post') ?? [];
  const skipped = opts ? posts.filter((r) => r.row <= opts.skipThroughRow) : [];
  const lastSkipped = skipped[skipped.length - 1];

  return (
    <div className="stack">
      {!compact ? <p className="sub">The JoshWorks content planner (Google Sheets → File → Download → Microsoft Excel). It’s read on this device; nothing is uploaded. Importing twice never duplicates anything.</p> : null}
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') input.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void load(f);
        }}
      >
        <FileSpreadsheet size={28} />
        <div className="strong">{file || 'Choose or drop the planner (.xlsx)'}</div>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}

      {parsed && opts ? (
        <div className="stack">
          <div className="row wrap">
            <Badge tone="teal">{posts.length} calendar rows</Badge>
            <Badge>{parsed.briefs.length} scripts</Badge>
            <Badge>{parsed.ideas.length} ideas</Badge>
            <Badge>{parsed.concepts.length} WHAT IF / concepts</Badge>
            <Badge>{parsed.metrics.length} results</Badge>
            <Badge>{parsed.snippets.length} caption blocks</Badge>
            <Badge>{parsed.team.length} people</Badge>
          </div>
          {parsed.droppedLinks ? <Callout tone="info">{parsed.droppedLinks} asset link was left out because it didn’t point to a real Drive folder.</Callout> : null}
          <div className="form-grid">
            <Field label="Skip the rows already posted, up to row" htmlFor="im-skip" hint={lastSkipped ? `${skipped.length} posts through ${lastSkipped.date ? fmtIsoDate(lastSkipped.date) : `row ${lastSkipped.row}`} are left out.` : 'Nothing is skipped.'}>
              <input
                id="im-skip"
                className="input num"
                inputMode="numeric"
                value={opts.skipThroughRow}
                onChange={(e) => {
                  setOpts({ ...opts, skipThroughRow: Number(e.target.value.replace(/\D/g, '')) || 0 });
                  setPreview(null);
                }}
              />
            </Field>
            <Field label="Start posting again on" htmlFor="im-restart" hint={opts.restartOn ? `Everything not posted yet gets new dates from ${fmtIsoWeekday(opts.restartOn)}.` : 'Keep the planner’s own dates.'}>
              <div className="row">
                <input
                  id="im-restart"
                  type="date"
                  className="input"
                  value={opts.restartOn ?? ''}
                  onChange={(e) => {
                    setOpts({ ...opts, restartOn: e.target.value || null });
                    setPreview(null);
                  }}
                />
                {opts.restartOn ? (
                  <Button size="sm" variant="ghost" onClick={() => { setOpts({ ...opts, restartOn: null }); setPreview(null); }}>
                    Keep dates
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>
          <div className="grid-2">
            <Check id="im-team" checked={opts.team} onChange={(v) => setOpts({ ...opts, team: v })} label="Team" sub={parsed.team.map((t) => t.name).join(', ')} />
            <Check id="im-themes" checked={opts.themes} onChange={(v) => setOpts({ ...opts, themes: v })} label="Weekly themes and Friday rotation" />
            <Check id="im-scripts" checked={opts.scripts} onChange={(v) => setOpts({ ...opts, scripts: v })} label="Carousel scripts" />
            <Check id="im-ideas" checked={opts.ideas} onChange={(v) => setOpts({ ...opts, ideas: v })} label="Idea bank" />
            <Check id="im-concepts" checked={opts.concepts} onChange={(v) => setOpts({ ...opts, concepts: v })} label="WHAT IF series and Concept Drops" />
            <Check id="im-metrics" checked={opts.metrics} onChange={(v) => setOpts({ ...opts, metrics: v })} label="Past results (Performance Tracker)" sub="Kept as history for the Results page." />
            <Check id="im-snips" checked={opts.snippets} onChange={(v) => setOpts({ ...opts, snippets: v })} label="Hashtag and caption bank" />
            {parsed.rows.some((r) => r.kind === 'break' && r.date) ? (
              <Check id="im-breaks" checked={opts.breaks} onChange={(v) => setOpts({ ...opts, breaks: v })} label="Use the planner’s break weeks" sub={`${parsed.rows.filter((r) => r.kind === 'break' && r.date).length} break weeks, instead of the last-Monday rule.`} />
            ) : null}
            <Check id="im-replace" checked={opts.replaceOld} onChange={(v) => { setOpts({ ...opts, replaceOld: v }); setPreview(null); }} label="Replace the older plan’s unposted posts" sub="Posted posts and their results stay." />
          </div>
          {!preview ? (
            <div>
              <Button variant="primary" onClick={doPreview}>
                <Upload size={16} /> Preview
              </Button>
            </div>
          ) : (
            <div className="stack">
              <Callout tone="good" title={`${preview.posts.length} posts go on the calendar`}>
                {preview.skipped ? `${preview.skipped} already-posted rows are skipped. ` : ''}
                {preview.replaced ? `${preview.replaced} unposted posts from the older plan are removed. ` : ''}
                {preview.posts.length && preview.posts[0].date ? ` First: ${fmtIsoWeekday(preview.posts[0].date as string)}. Last: ${fmtIsoWeekday(preview.posts[preview.posts.length - 1].date as string)}.` : ''}
              </Callout>
              <div className="table-wrap" style={{ maxHeight: 360 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>New date</th>
                      <th>Post</th>
                      <th>Was</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.posts.map((x) => (
                      <tr key={x.row.row}>
                        <td className="nowrap">{x.date ? fmtIsoWeekday(x.date) : '—'}</td>
                        <td>
                          {x.row.title || '(topic to pick)'}
                          {x.note ? <div className="tiny muted">{x.note}</div> : null}
                        </td>
                        <td className="nowrap muted small">{x.row.date ? fmtIsoDate(x.row.date) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.unplaced.length ? (
                <Callout tone="warn" title={`${preview.unplaced.length} wait in the backlog for your decision`}>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {preview.unplaced.map((u) => (
                      <li key={u.row.row}>
                        <b>{u.row.title}</b>: {u.note}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              <div className="actions">
                <Button onClick={() => setPreview(null)}>Change options</Button>
                <Button variant="primary" onClick={doImport} disabled={busy}>
                  Import
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

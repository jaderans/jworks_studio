import { useId, useState, type ReactNode } from 'react';
import { Table2 } from 'lucide-react';
import { compactNumber } from '../domain/metrics';
import { STAGES, STAGE_META } from '../domain/funnel';
import { fmtDateShort, dayStart } from '../lib/time';
import type { FunnelStage } from '../db/types';

/** Round a maximum up to a readable axis top (1, 2, 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** A chart with a "Show as table" switch: the table is the accessible twin of every chart. */
export function ChartFrame({ title, table, children, actions }: { title: ReactNode; table: { head: string[]; rows: (string | number)[][] }; children: ReactNode; actions?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure className="stack tight" style={{ margin: 0 }} aria-labelledby={id}>
      <div className="card-head">
        <h3 id={id} className="dot-title">
          {title}
        </h3>
        <div className="row" style={{ gap: 6 }}>
          {actions}
          <button type="button" className="btn sm ghost" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            <Table2 size={16} /> {asTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>
      {asTable ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={i ? 'r' : ''}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j ? 'r' : ''}>
                      {typeof c === 'number' ? c.toLocaleString('en-PH', { maximumFractionDigits: 1 }) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

/** Weekly columns for one measure (one series: no legend, the title names it). */
export function WeekColumns({ data, label, height = 200 }: { data: { week: string; value: number; posts: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="muted small">No results logged yet.</p>;
  const W = 640;
  const H = height;
  const padL = 44;
  const padB = 24;
  const padT = 10;
  const top = niceMax(Math.max(...data.map((d) => d.value)));
  const plotW = W - padL - 6;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.max(4, Math.min(24, slot - 2));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(data.length / 8));
  const hv = hover !== null ? data[hover] : null;
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} by week`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="axis" x1={padL} x2={W - 6} y1={y(top * f)} y2={y(top * f)} />
            <text className="lbl" x={padL - 8} y={y(top * f) + 4} textAnchor="end">
              {compactNumber(top * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = d.value > 0 ? Math.max(2, plotH - (y(d.value) - padT)) : 0;
          const r = Math.min(4, barW / 2, h);
          const x0 = cx - barW / 2;
          const yTop = padT + plotH - h;
          return (
            <g
              key={d.week}
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Week of ${fmtDateShort(dayStart(d.week))}: ${d.value.toLocaleString()} ${label.toLowerCase()}, ${d.posts} posts`}
            >
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              {h > 0 ? (
                <path className={`bar ${hover === i ? 'on' : ''}`} d={`M${x0},${padT + plotH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${padT + plotH} Z`} />
              ) : null}
              {i % every === 0 ? (
                <text className="lbl" x={cx} y={H - 6} textAnchor="middle">
                  {fmtDateShort(dayStart(d.week))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hv ? (
        <div className="chart-tip" style={{ left: `${((padL + slot * (hover as number) + slot / 2) / W) * 100}%`, top: `${(y(hv.value) / H) * 100}%` }}>
          <b>{hv.value.toLocaleString()}</b> {label.toLowerCase()} · week of {fmtDateShort(dayStart(hv.week))} · {hv.posts} post{hv.posts === 1 ? '' : 's'}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Monthly columns for one money measure, with an optional target per month
 * drawn as a short dashed marker on the same axis.
 */
export function MonthColumns({ data, label, format, height = 220 }: { data: { month: string; value: number; target?: number | null }[]; label: string; format: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="muted small">Nothing yet.</p>;
  const W = 640;
  const H = height;
  const padL = 56;
  const padB = 24;
  const padT = 12;
  const top = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.target ?? 0)), 1));
  const plotW = W - padL - 6;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.max(6, Math.min(34, slot - 8));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short' }) + (m.endsWith('-01') ? ` ’${m.slice(2, 4)}` : '');
  const hv = hover !== null ? data[hover] : null;
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} by month`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="axis" x1={padL} x2={W - 6} y1={y(top * f)} y2={y(top * f)} />
            <text className="lbl" x={padL - 8} y={y(top * f) + 4} textAnchor="end">
              {format(top * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = d.value > 0 ? Math.max(2, plotH - (y(d.value) - padT)) : 0;
          const r = Math.min(4, barW / 2, h);
          const x0 = cx - barW / 2;
          const yTop = padT + plotH - h;
          return (
            <g
              key={d.month}
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${monthLabel(d.month)}: ${format(d.value)}${d.target ? `, target ${format(d.target)}` : ''}`}
            >
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              {h > 0 ? <path className={`bar ${hover === i ? 'on' : ''}`} d={`M${x0},${padT + plotH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${padT + plotH} Z`} /> : null}
              {d.target ? <line className="target-mark" x1={x0 - 4} x2={x0 + barW + 4} y1={y(d.target)} y2={y(d.target)} /> : null}
              <text className="lbl" x={cx} y={H - 6} textAnchor="middle">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {hv ? (
        <div className="chart-tip" style={{ left: `${((padL + slot * (hover as number) + slot / 2) / W) * 100}%`, top: `${(y(Math.max(hv.value, hv.target ?? 0)) / H) * 100}%` }}>
          <b>{format(hv.value)}</b> {label.toLowerCase()} · {monthLabel(hv.month)}
          {hv.target ? ` · target ${format(hv.target)}` : ''}
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal ranked bars, one colour (or an emphasised few). */
export function BarList({
  rows,
  format = (v) => compactNumber(v),
  empty = 'Nothing yet.',
}: {
  rows: { key: string; name: ReactNode; value: number; sub?: ReactNode; emphasis?: boolean; swatch?: ReactNode }[];
  format?: (v: number) => ReactNode;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="muted small">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const anyEmphasis = rows.some((r) => r.emphasis);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.key} className="bar-row" title={typeof r.name === 'string' ? r.name : undefined}>
          <span className="name row" style={{ gap: 6 }}>
            {r.swatch}
            <span className="ellipsis">{r.name}</span>
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, display: 'block', background: anyEmphasis && !r.emphasis ? 'var(--line-strong)' : undefined }} />
          </span>
          <span className="val">
            {format(r.value)}
            {r.sub ? <span className="muted tiny"> {r.sub}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Progress toward a target. */
export function Meter({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="stack tight">
      <div className="row between small">
        <span className="strong">{label}</span>
        <span className="num">
          {compactNumber(value)} / {compactNumber(target)}
        </span>
      </div>
      <div className={`meter-track ${pct >= 100 ? '' : 'short'}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`meter-fill ${pct >= 100 ? '' : 'short'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The five funnel stages as stacked trapezoids (ordinal teal ramp), with planned posts per stage. */
export function FunnelChart({ counts, labels }: { counts: Record<FunnelStage, number>; labels?: Partial<Record<FunnelStage, string>> }) {
  const W = 520;
  const rowH = 46;
  const gap = 4;
  const H = STAGES.length * (rowH + gap);
  const cx = 150;
  return (
    <svg className="funnel-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Funnel: ${STAGES.map((s) => `${STAGE_META[s].label} ${counts[s]} posts`).join(', ')}`}>
      {STAGES.map((s, i) => {
        const top = 280 - i * 46;
        const bottom = 280 - (i + 1) * 46;
        const y = i * (rowH + gap);
        const pts = [
          [cx - top / 2, y],
          [cx + top / 2, y],
          [cx + bottom / 2, y + rowH],
          [cx - bottom / 2, y + rowH],
        ]
          .map((p) => p.join(','))
          .join(' ');
        return (
          <g key={s}>
            <polygon className={`fun-${i + 1}`} points={pts} />
            <text className="lbl" x={cx + 160} y={y + 20}>
              {STAGE_META[s].label} · {counts[s]} post{counts[s] === 1 ? '' : 's'}
            </text>
            <text className="sub" x={cx + 160} y={y + 36}>
              {(labels?.[s] || STAGE_META[s].kpi).slice(0, 48)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The last 30 days of hook practice: done or not (two states, labelled). */
export function StreakHeat({ days, today }: { days: { date: string; done: boolean }[]; today: string }) {
  return (
    <div className="heat" role="img" aria-label={`${days.filter((d) => d.done).length} of the last 30 days practised`}>
      {days.map((d) => (
        <span key={d.date} className={`${d.done ? 'on' : ''} ${d.date === today ? 'today' : ''}`} title={`${fmtDateShort(dayStart(d.date))}: ${d.done ? 'practised' : 'not yet'}`} />
      ))}
    </div>
  );
}

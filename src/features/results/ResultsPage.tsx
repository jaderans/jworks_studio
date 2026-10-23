import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, EmptyState, IconButton, PageHeader, Segmented, Stat } from '../../components/ui';
import { Field, NumberInput, Select, TextInput } from '../../components/form';
import { FilterBar } from '../../components/FilterBar';
import { Dialog } from '../../components/Dialog';
import { BarList, ChartFrame, WeekColumns } from '../../components/charts';
import { MemberDot, useMemberMap } from '../../components/people';
import { useMembers, useMetrics, usePosts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { METRIC_LABEL, WEEKDAY_KEYS, compactNumber, groupBy, outliers, ratesOf, totals, weekdayKey, weeklySeries, type GroupRow, type MetricKey } from '../../domain/metrics';
import { PLATFORMS, PLATFORM_ORDER } from '../../domain/platforms';
import { blankMetric, deleteMetric, saveMetric } from '../../services/growth';
import { downloadBlob, toCSV } from '../../lib/files';
import { DOW_NAMES, addDays, fmtIsoDate, todayISO } from '../../lib/time';
import { formatPct } from '../../lib/money';
import type { Metric, PlatformKey } from '../../db/types';

type Period = '30' | '90' | 'all';

export default function ResultsPage() {
  const app = useApp();
  const metrics = useMetrics();
  const posts = usePosts() ?? [];
  const members = useMembers() ?? [];
  const memberMap = useMemberMap();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const [period, setPeriod] = useState<Period>('all');
  const [platform, setPlatform] = useState<PlatformKey | ''>('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [measure, setMeasure] = useState<MetricKey>('views');
  const [edit, setEdit] = useState<Partial<Metric> | null>(null);
  const today = todayISO();
  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);

  const rows = useMemo(
    () =>
      (metrics ?? []).filter(
        (m) =>
          app.inScope(m.clientId) &&
          (period === 'all' || m.date >= addDays(today, -Number(period))) &&
          (!platform || m.platform === platform) &&
          (!who || m.memberIds.includes(who)) &&
          (!q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [metrics, app, period, platform, who, q, today],
  );
  const t = totals(rows);
  const out = useMemo(() => outliers((metrics ?? []).filter((m) => app.inScope(m.clientId))), [metrics, app]);

  if (!metrics) return null;

  const themeOf = (m: Metric) => {
    const p = m.postId ? postById.get(m.postId) : undefined;
    const theme = p ? cadence.themes.find((x) => x.key === p.themeKey)?.name : '';
    return [theme || m.series || 'Other'];
  };
  const formatOf = (m: Metric) => [(m.postId ? postById.get(m.postId)?.format : '') || m.format || 'Not set'];
  const byDesigner = groupBy(rows, (m) => (m.memberIds.length ? m.memberIds : m.designerText ? [`text:${m.designerText}`] : []), (k) => (k.startsWith('text:') ? k.slice(5) : (memberMap.get(k)?.name ?? 'Someone')));
  const byTheme = groupBy(rows, themeOf);
  const byFormat = groupBy(rows, formatOf);
  const byDay = groupBy(rows, weekdayKey, (k) => DOW_NAMES[Number(k)]).sort((a, b) => WEEKDAY_KEYS.indexOf(a.key) - WEEKDAY_KEYS.indexOf(b.key));
  const byPlatform = groupBy(rows, (m) => [m.platform], (k) => PLATFORMS[k as PlatformKey].label);
  const series = weeklySeries(rows, measure);
  const top = (k: 'saves' | 'shares' | 'views') => [...rows].sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0)).slice(0, 6);

  const compare = (title: string, data: GroupRow[], swatch?: (key: string) => React.ReactNode) => (
    <section className="card">
      <ChartFrame title={title} table={{ head: ['Group', 'Posts', 'Avg views', 'Saves', 'Shares'], rows: data.map((g) => [g.label, g.posts, Math.round(g.avgViews), g.saves, g.shares]) }}>
        <BarList rows={data.map((g) => ({ key: g.key, name: g.label, value: g.avgViews, sub: `${g.posts} post${g.posts === 1 ? '' : 's'}`, swatch: swatch?.(g.key) }))} empty="Not enough results yet." />
        <p className="tiny muted">Average views per post.</p>
      </ChartFrame>
    </section>
  );

  const exportCsv = () => {
    const csv = toCSV([
      ['Date', 'Title', 'Platform', 'Designers', 'Views', 'Reach', 'Likes', 'Comments', 'Saves', 'Shares', 'Follows', 'Leads', 'Engagement rate %'],
      ...rows.map((m) => [m.date, m.title, PLATFORMS[m.platform].label, m.memberIds.map((id) => memberMap.get(id)?.name ?? '').join(' + ') || m.designerText, m.views, m.reach, m.likes, m.comments, m.saves, m.shares, m.follows, m.leads, ratesOf(m).engagement?.toFixed(2) ?? '']),
    ]);
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `results-${today}.csv`);
  };

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Results"
        subtitle="Log numbers 48–72 hours after posting. Saves show value, shares show reach to new people: make more of whatever wins on both."
        actions={
          <>
            <Button onClick={exportCsv} disabled={!rows.length}>
              <Download size={18} /> CSV
            </Button>
            <Button variant="primary" onClick={() => setEdit({ ...blankMetric(), platform: 'facebook' })}>
              <Plus size={18} /> Log results
            </Button>
          </>
        }
      />
      <FilterBar
        id="results"
        lead={
          <Segmented<Period>
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
        search={{ value: q, onChange: setQ, placeholder: 'Search post titles' }}
        active={(platform ? 1 : 0) + (who ? 1 : 0)}
        onClear={() => {
          setQ('');
          setPlatform('');
          setWho('');
        }}
      >
        <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as PlatformKey | '')}>
          <option value="">All platforms</option>
          {PLATFORM_ORDER.map((k) => (
            <option key={k} value={k}>
              {PLATFORMS[k].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Designer" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="No results for this selection">Open a posted post → Publish &amp; results, or press Log results. Importing the planner brings in its Performance Tracker too.</EmptyState>
      ) : (
        <>
          <div className="stats">
            <Stat label="Posts logged" value={t.posts.toLocaleString()} />
            <Stat label="Views" value={compactNumber(t.views)} />
            <Stat label="Reach" value={compactNumber(t.reach)} />
            <Stat label="Saves" value={compactNumber(t.saves)} hint={t.reach ? `${formatPct((t.saves / t.reach) * 100, 1)} of reach` : undefined} />
            <Stat label="Shares" value={compactNumber(t.shares)} hint={t.reach ? `${formatPct((t.shares / t.reach) * 100, 1)} of reach` : undefined} />
            <Stat label="Engagement rate" value={formatPct(t.engagementRate, 1)} hint="Likes, comments, saves and shares ÷ reach" />
          </div>

          <section className="card">
            <ChartFrame
              title={`${METRIC_LABEL[measure]} per week`}
              table={{ head: ['Week of', METRIC_LABEL[measure], 'Posts'], rows: series.map((s) => [fmtIsoDate(s.week), s.value, s.posts]) }}
              actions={
                <Select aria-label="Measure" value={measure} onChange={(e) => setMeasure(e.target.value as MetricKey)} style={{ width: 'auto', height: 36 }}>
                  {(['views', 'reach', 'saves', 'shares', 'likes', 'comments', 'leads'] as MetricKey[]).map((k) => (
                    <option key={k} value={k}>
                      {METRIC_LABEL[k]}
                    </option>
                  ))}
                </Select>
              }
            >
              {series.length >= 2 ? (
                <WeekColumns data={series} label={METRIC_LABEL[measure]} />
              ) : (
                <p className="muted small">
                  {series.length === 1
                    ? `All of these results are from the week of ${fmtIsoDate(series[0].week)} (${series[0].value.toLocaleString()} ${METRIC_LABEL[measure].toLowerCase()}). The weekly chart fills in as you log more weeks.`
                    : 'No results with dates yet.'}
                </p>
              )}
            </ChartFrame>
          </section>

          <div className="grid-3">
            {(['saves', 'shares', 'views'] as const).map((k) => (
              <section key={k} className="card">
                <ChartFrame title={`Top by ${METRIC_LABEL[k].toLowerCase()}`} table={{ head: ['Post', METRIC_LABEL[k]], rows: top(k).map((m) => [m.title, m[k] ?? 0]) }}>
                  <BarList rows={top(k).map((m) => ({ key: m.id, name: m.title, value: m[k] ?? 0, emphasis: out.has(m.id), sub: out.has(m.id) ? 'outlier' : undefined }))} />
                </ChartFrame>
              </section>
            ))}
          </div>

          <div className="grid-2">
            {compare('By designer', byDesigner, (k) => {
              const m = memberMap.get(k);
              return m ? <MemberDot member={m} /> : null;
            })}
            {compare('By theme or series', byTheme)}
            {compare('By format', byFormat)}
            {compare('By day of the week', byDay)}
            {compare('By platform', byPlatform)}
          </div>

          <section className="card flush">
            <div className="card-head" style={{ padding: '14px 16px 6px' }}>
              <h2 className="dot-title">Every result</h2>
            </div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Post</th>
                    <th>Platform</th>
                    <th className="r">Views</th>
                    <th className="r">Reach</th>
                    <th className="r">Saves</th>
                    <th className="r">Shares</th>
                    <th className="r">Eng. rate</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="nowrap">{fmtIsoDate(m.date)}</td>
                      <td>
                        <span className="t-ellipsis">{m.title}</span>
                        {out.has(m.id) ? <Badge tone="good">{out.get(m.id)!.ratio.toFixed(1)}× usual</Badge> : null}
                      </td>
                      <td>{PLATFORMS[m.platform].short}</td>
                      <td className="r">{m.views?.toLocaleString() ?? '—'}</td>
                      <td className="r">{m.reach?.toLocaleString() ?? '—'}</td>
                      <td className="r">{m.saves ?? '—'}</td>
                      <td className="r">{m.shares ?? '—'}</td>
                      <td className="r">{formatPct(ratesOf(m).engagement, 1)}</td>
                      <td className="nowrap">
                        <IconButton label="Edit" size="sm" plain onClick={() => setEdit(m)}>
                          <Pencil size={14} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <MetricDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function MetricDialog({ value, onClose }: { value: Partial<Metric> | null; onClose: () => void }) {
  const app = useApp();
  const posts = (usePosts() ?? []).filter((p) => p.status === 'posted' || p.date);
  const members = useMembers() ?? [];
  const [m, setM] = useState<Partial<Metric>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? 'new')) {
    setM(value);
    setKey(value.id ?? 'new');
  }
  if (!value && key !== null) setKey(null);
  const num = (k: MetricKey) => (
    <Field key={k} label={METRIC_LABEL[k]} htmlFor={`md-${k}`}>
      <NumberInput id={`md-${k}`} value={(m[k] as number | null | undefined) ?? null} onChange={(v) => setM({ ...m, [k]: v })} decimals={false} />
    </Field>
  );
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={value?.id ? 'Edit results' : 'Log results'}
      footer={
        <>
          {value?.id ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteMetric(value.id as string);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!m.title?.trim()}
            onClick={async () => {
              await saveMetric({ ...(m as Metric), title: m.title!.trim(), platform: m.platform ?? 'facebook' });
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Post" htmlFor="md-post" hint="Pick the post, or type a title below for one that isn’t in the app.">
        <Select
          id="md-post"
          value={m.postId ?? ''}
          onChange={(e) => {
            const p = posts.find((x) => x.id === e.target.value);
            setM(p ? { ...m, postId: p.id, title: p.title, date: p.date ?? m.date, series: p.series, format: p.format, memberIds: p.assignees, clientId: p.clientId } : { ...m, postId: null });
          }}
        >
          <option value="">Not in the app</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.date ?? ''} · {p.title}
            </option>
          ))}
        </Select>
      </Field>
      <div className="form-grid">
        <Field label="Title" htmlFor="md-title">
          <TextInput id="md-title" value={m.title ?? ''} onChange={(e) => setM({ ...m, title: e.target.value })} />
        </Field>
        <Field label="Posted on" htmlFor="md-date">
          <input id="md-date" type="date" className="input" value={m.date ?? ''} onChange={(e) => setM({ ...m, date: e.target.value })} />
        </Field>
        <Field label="Platform" htmlFor="md-pf">
          <Select id="md-pf" value={m.platform ?? 'facebook'} onChange={(e) => setM({ ...m, platform: e.target.value as PlatformKey })}>
            {PLATFORM_ORDER.map((k) => (
              <option key={k} value={k}>
                {PLATFORMS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Designer" htmlFor="md-who">
          <Select id="md-who" value={m.memberIds?.[0] ?? ''} onChange={(e) => setM({ ...m, memberIds: e.target.value ? [e.target.value] : [] })}>
            <option value="">{m.designerText || 'Not set'}</option>
            {members.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid-3">{(['views', 'reach', 'likes', 'comments', 'saves', 'shares', 'follows', 'clicks', 'leads'] as MetricKey[]).map(num)}</div>
    </Dialog>
  );
}

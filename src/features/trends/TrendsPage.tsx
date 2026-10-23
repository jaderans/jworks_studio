import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { Bookmark, Bot, CalendarPlus, Copy, ExternalLink, Flame, Loader2, PenLine, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, IconButton, PageHeader, Tabs } from '../../components/ui';
import { Field, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { FilterBar } from '../../components/FilterBar';
import { Dialog } from '../../components/Dialog';
import { StreakHeat } from '../../components/charts';
import { MemberDot } from '../../components/people';
import { useHooks, useMembers, useMetrics, useReports, useSettingRows, useTrends } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { HOOK_PATTERNS, streak } from '../../domain/hooks';
import { outliers } from '../../domain/metrics';
import { PLAYBOOK } from '../../domain/playbook';
import { PLATFORMS, PLATFORM_ORDER, platformLabel } from '../../domain/platforms';
import { parseTrendFeed } from '../../domain/trendFeed';
import { getApiKey, streamChat } from '../../ai/claude';
import { TREND_REPORT_PROMPT, buildSystemPrompt, extractJson } from '../../ai/prompts';
import { openInClaude, webPrompt } from '../../ai/claudeWeb';
import { createPost, saveIdea } from '../../services/content';
import { deleteHook, deleteTrend, fetchFeed, saveHook, saveTrend, saveTrendItem, storeReport } from '../../services/growth';
import { copyText } from '../../lib/text';
import { fmtIsoDate, mondayOf, todayISO } from '../../lib/time';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PlatformKey, Trend, TrendItem, TrendStatus } from '../../db/types';

export default function TrendsPage() {
  return (
    <div className="page">
      <PageHeader title="Trends" subtitle="What’s working right now, what we’re trying, and the habits that make content grow." />
      <Tabs
        items={[
          { to: '/trends', label: 'This week', end: true },
          { to: '/trends/board', label: 'Trend board' },
          { to: '/trends/outliers', label: 'Outliers' },
          { to: '/trends/hooks', label: 'Hooks' },
          { to: '/trends/playbook', label: 'Playbook' },
        ]}
      />
      <Routes>
        <Route index element={<ThisWeek />} />
        <Route path="board" element={<Board />} />
        <Route path="outliers" element={<Outliers />} />
        <Route path="hooks" element={<Hooks />} />
        <Route path="playbook" element={<Playbook />} />
      </Routes>
    </div>
  );
}

function ThisWeek() {
  const app = useApp();
  const navigate = useNavigate();
  const reports = useReports();
  const hasKey = useLiveQuery(() => getApiKey().then((k) => !!k), []);
  const ai = settingValue(useSettingRows(), 'ai');
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const report = (reports ?? []).find((r) => r.id === pick) ?? reports?.[0];
  const kinds = [...new Set((report?.items ?? []).map((it) => it.kind).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const items = (report?.items ?? []).filter(
    (it) => (!platform || it.platform === platform) && (!kind || it.kind === kind) && (!needle || `${it.title} ${it.what} ${it.howJoshWorks}`.toLowerCase().includes(needle)),
  );
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const researchInClaude = async () => {
    const prompt = webPrompt({ system: await buildSystemPrompt(), ask: TREND_REPORT_PROMPT(mondayOf(todayISO())), webSearch: true });
    const ok = await openInClaude(prompt);
    setPasting(true);
    app.toast(ok ? 'Copied. Paste it into Claude.ai (turn on web search), then paste the whole answer back here.' : 'Couldn’t copy the prompt.', { tone: ok ? 'good' : 'bad', ms: 9000 });
  };
  const savePasted = async () => {
    try {
      const parsed = parseTrendFeed(extractJson(pasted), 'assistant');
      if (!parsed) throw new Error('That doesn’t look like the report. Paste Claude’s whole answer, including the part in { }.');
      const saved = await storeReport(parsed);
      setPick(saved.id);
      setPasted('');
      setPasting(false);
      app.toast(`Saved the report: ${parsed.items.length} trends. The team sees it too.`, { tone: 'good' });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not read that report', { tone: 'bad' });
    }
  };

  const refresh = async () => {
    setBusy(true);
    setStatus('Starting…');
    try {
      const weekOf = mondayOf(todayISO());
      const res = await streamChat({
        system: await buildSystemPrompt(),
        turns: [{ role: 'user', text: TREND_REPORT_PROMPT(weekOf) }],
        model: ai.model,
        effort: 'medium',
        webSearch: true,
        maxSearches: 8,
        onText: () => setStatus('Writing the report…'),
        onStatus: setStatus,
      });
      const parsed = parseTrendFeed(extractJson(res.text), 'assistant');
      if (!parsed) throw new Error('Claude’s report came back in an unexpected shape. Try again.');
      if (!parsed.sources.length) parsed.sources = res.sources.slice(0, 10);
      const saved = await storeReport(parsed);
      setPick(saved.id);
      app.toast(`New trend report · about $${res.usage.costUsd.toFixed(2)}`, { tone: 'good' });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not get the report', { tone: 'bad' });
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const makePost = async (it: TrendItem) => {
    const p = await createPost({
      title: it.postIdea?.title || it.title,
      date: null,
      format: it.postIdea?.format ?? '',
      themeKey: it.postIdea?.themeKey ?? '',
      brief: [it.howJoshWorks, it.why ? `Why now: ${it.why}` : '', it.sources[0] ? `Source: ${it.sources[0].url}` : ''].filter(Boolean).join('\n'),
      note: `From the trend report (week of ${report?.weekOf}).`,
      status: 'idea',
    });
    app.toast('Added to the backlog', { tone: 'good', action: { label: 'Open', onClick: () => navigate(`/calendar?post=${p.id}`) } });
  };

  return (
    <div className="stack loose">
      <div className="row wrap between">
        <div className="row wrap">
          {reports && reports.length > 1 ? (
            <Select aria-label="Report" value={report?.id ?? ''} onChange={(e) => setPick(e.target.value)} style={{ width: 'auto' }}>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  Week of {fmtIsoDate(r.weekOf)} · {r.source === 'feed' ? 'weekly report' : 'assistant'}
                </option>
              ))}
            </Select>
          ) : null}
          <Button size="sm" variant="ghost" onClick={async () => app.toast((await fetchFeed()) ? 'Checked for a new weekly report' : 'No weekly report published yet', { tone: 'info' })}>
            <RefreshCw size={16} /> Check for the weekly report
          </Button>
        </div>
        {hasKey ? (
          <Button variant="primary" onClick={refresh} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Bot size={18} />} {busy ? status || 'Researching…' : 'Research trends now'}
          </Button>
        ) : (
          <Button variant="primary" onClick={researchInClaude}>
            <ExternalLink size={18} /> Research in Claude.ai
          </Button>
        )}
      </div>
      {pasting ? (
        <section className="card stack tight">
          <h2 className="dot-title">Paste Claude’s report</h2>
          <p className="small muted">In Claude.ai, turn on web search, paste the prompt and send. When it finishes, copy the whole answer and paste it here.</p>
          <TextArea aria-label="Claude’s report" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="{ &quot;weekOf&quot;: … }" />
          <div className="row wrap between">
            <Button variant="ghost" onClick={() => setPasting(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!pasted.trim()} onClick={savePasted}>
              Save the report
            </Button>
          </div>
        </section>
      ) : null}
      {busy ? <Callout tone="info">Claude is searching the web and writing this week’s report. It takes a minute or two and costs about 10–30 US cents.</Callout> : null}
      {!reports ? null : !report ? (
        <EmptyState icon={<Flame size={40} />} title="No trend report yet">
          Run /trend-report in Claude Code each Monday to publish one here for the whole team, or research one now.
        </EmptyState>
      ) : (
        <>
          <section className="card pad-lg stack tight">
            <span className="eyebrow">
              Week of {fmtIsoDate(report.weekOf)} · {report.source === 'feed' ? 'weekly Claude report' : 'researched in the app'}
            </span>
            <p>{report.summary}</p>
          </section>
          <FilterBar
            id="trends"
            search={{ value: q, onChange: setQ, placeholder: 'Search this week’s trends' }}
            active={(platform ? 1 : 0) + (kind ? 1 : 0)}
            onClear={() => {
              setQ('');
              setPlatform('');
              setKind('');
            }}
          >
            <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">All platforms</option>
              <option value="any">Any platform</option>
              {PLATFORM_ORDER.map((k) => (
                <option key={k} value={k}>
                  {PLATFORMS[k].label}
                </option>
              ))}
            </Select>
            <Select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Every kind</option>
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </FilterBar>
          {items.length === 0 ? <EmptyState title="Nothing matches" /> : null}
          <div className="trend-grid">
            {items.map((it) => (
              <article key={it.id} className="card trend-card">
                <div className="row wrap">
                  <Badge tone="teal">{platformLabel(it.platform)}</Badge>
                  <Badge>{it.kind}</Badge>
                  {it.expires ? <span className="tiny muted">until {fmtIsoDate(it.expires)}</span> : null}
                </div>
                <h3>{it.title}</h3>
                {it.what ? (
                  <div className="block">
                    <b>What it is</b>
                    {it.what}
                  </div>
                ) : null}
                {it.why ? (
                  <div className="block">
                    <b>Why it works</b>
                    {it.why}
                  </div>
                ) : null}
                {it.howJoshWorks ? (
                  <div className="block">
                    <b>How we use it</b>
                    {it.howJoshWorks}
                  </div>
                ) : null}
                {it.sources.length ? (
                  <div className="src-list">
                    {it.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener">
                        {s.title || new URL(s.url).hostname} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="actions">
                  <Button size="sm" variant="teal" onClick={() => makePost(it)}>
                    <CalendarPlus size={16} /> Make a post
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await saveTrendItem(it, report.source === 'feed' ? 'feed' : 'claude');
                      app.toast('Saved to the trend board', { tone: 'good' });
                    }}
                  >
                    <Bookmark size={16} /> Save
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {report.dates.length ? (
            <section className="card">
              <h2 className="dot-title">Dates to plan around</h2>
              <div className="dash-list">
                {report.dates.map((d) => (
                  <div key={`${d.date}${d.name}`} className="dash-row">
                    <b className="nowrap">{fmtIsoDate(d.date)}</b>
                    <span className="grow">
                      <b className="small">{d.name}</b>
                      <span className="tiny muted">{d.idea}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

const STATUS_COLS: { key: TrendStatus; label: string }[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'trying', label: 'Trying this week' },
  { key: 'used', label: 'Used' },
  { key: 'expired', label: 'Expired' },
];

function Board() {
  const trends = (useTrends() ?? []).filter((t) => t.kind !== 'outlier');
  const [edit, setEdit] = useState<Partial<Trend> | null>(null);
  return (
    <div className="stack">
      <div className="row between wrap">
        <p className="muted">Trends the team saved. Move one to Trying when someone is making it; Expired happens on its date.</p>
        <Button variant="primary" onClick={() => setEdit({ kind: 'trend', platform: 'tiktok', status: 'watching' })}>
          <Plus size={16} /> Save a trend
        </Button>
      </div>
      <div className="board">
        {STATUS_COLS.map((c) => {
          const list = trends.filter((t) => (t.status === 'skipped' ? 'expired' : t.status) === c.key);
          return (
            <section key={c.key} className="bcol" aria-label={c.label}>
              <div className="bcol-head">
                {c.label}
                <span className="count">{list.length}</span>
              </div>
              {list.map((t) => (
                <button key={t.id} type="button" className="pcard" onClick={() => setEdit(t)}>
                  <span className="title">{t.title}</span>
                  <span className="meta">
                    <Badge tone="teal">{platformLabel(t.platform)}</Badge>
                    {t.expiresOn ? <span>until {fmtIsoDate(t.expiresOn)}</span> : null}
                  </span>
                  {t.howWeUseIt ? <span className="tiny muted">{t.howWeUseIt}</span> : null}
                </button>
              ))}
            </section>
          );
        })}
      </div>
      <TrendDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function TrendDialog({ value, onClose }: { value: Partial<Trend> | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const [t, setT] = useState<Partial<Trend>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? `new-${value.kind}`)) {
    setT(value);
    setKey(value.id ?? `new-${value.kind}`);
  }
  if (!value && key !== null) setKey(null);
  const outlier = t.kind === 'outlier';
  const ratio = t.views && t.creatorAvgViews ? t.views / t.creatorAvgViews : null;
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={value?.id ? t.title : outlier ? 'Save an outlier' : 'Save a trend'}
      footer={
        <>
          {value?.id ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteTrend(value.id as string);
                  onClose();
                }}
              >
                <Trash2 size={16} /> Delete
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const idea = await saveIdea({ kind: 'idea', title: `Our version: ${t.title}`, category: 'Video / Reel', format: 'Reel', angle: [t.hook && `Hook: ${t.hook}`, t.howWeUseIt].filter(Boolean).join(' · '), notes: t.url ?? '' });
                  await saveTrend({ ...(t as Trend), status: 'trying' });
                  app.toast('Added to the idea bank', { tone: 'good', action: { label: 'Ideas', onClick: () => navigate('/ideas') } });
                  void idea;
                  onClose();
                }}
              >
                Make our version
              </Button>
            </>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!t.title?.trim()}
            onClick={async () => {
              await saveTrend({ ...(t as Trend), title: t.title!.trim() });
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label={outlier ? 'What the post is' : 'Trend'} htmlFor="tr-title">
        <TextInput id="tr-title" value={t.title ?? ''} onChange={(e) => setT({ ...t, title: e.target.value })} />
      </Field>
      <div className="form-grid">
        <Field label="Platform" htmlFor="tr-pf">
          <Select id="tr-pf" value={t.platform ?? 'any'} onChange={(e) => setT({ ...t, platform: e.target.value as PlatformKey | 'any' })}>
            <option value="any">Any</option>
            {PLATFORM_ORDER.map((k) => (
              <option key={k} value={k}>
                {PLATFORMS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        {outlier ? (
          <Field label="Creator" htmlFor="tr-creator">
            <TextInput id="tr-creator" value={t.creator ?? ''} onChange={(e) => setT({ ...t, creator: e.target.value })} />
          </Field>
        ) : (
          <Field label="Status" htmlFor="tr-status">
            <Select id="tr-status" value={t.status ?? 'watching'} onChange={(e) => setT({ ...t, status: e.target.value as TrendStatus })}>
              {STATUS_COLS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Link" htmlFor="tr-url">
        <TextInput id="tr-url" value={t.url ?? ''} onChange={(e) => setT({ ...t, url: e.target.value })} placeholder="https://" />
      </Field>
      {outlier ? (
        <div className="form-grid">
          <Field label="Its views" htmlFor="tr-views">
            <NumberInput id="tr-views" value={t.views ?? null} onChange={(v) => setT({ ...t, views: v })} decimals={false} />
          </Field>
          <Field label="Their usual views" htmlFor="tr-avg" hint={ratio ? `${ratio.toFixed(1)}× their usual: ${ratio >= 2 ? 'a real outlier' : 'not much above normal'}` : 'Look at their last 10 posts.'}>
            <NumberInput id="tr-avg" value={t.creatorAvgViews ?? null} onChange={(v) => setT({ ...t, creatorAvgViews: v })} decimals={false} />
          </Field>
        </div>
      ) : null}
      <Field label="The hook" htmlFor="tr-hook" hint="Write down the first line or first 3 seconds word for word.">
        <TextInput id="tr-hook" value={t.hook ?? ''} onChange={(e) => setT({ ...t, hook: e.target.value })} />
      </Field>
      <Field label={outlier ? 'Why it caught my attention' : 'Why it works'} htmlFor="tr-why">
        <TextArea id="tr-why" rows={3} value={t.whyItWorks ?? ''} onChange={(e) => setT({ ...t, whyItWorks: e.target.value })} />
      </Field>
      <Field label="How we’d use it" htmlFor="tr-how">
        <TextArea id="tr-how" rows={2} value={t.howWeUseIt ?? ''} onChange={(e) => setT({ ...t, howWeUseIt: e.target.value })} />
      </Field>
      {!outlier ? (
        <Field label="Use before" htmlFor="tr-exp" hint="Trends fade fast; most last 1–3 weeks.">
          <input id="tr-exp" type="date" className="input" value={t.expiresOn ?? ''} onChange={(e) => setT({ ...t, expiresOn: e.target.value || null })} />
        </Field>
      ) : null}
    </Dialog>
  );
}

function Outliers() {
  const app = useApp();
  const trends = (useTrends() ?? []).filter((t) => t.kind === 'outlier');
  const metrics = useMetrics() ?? [];
  const [edit, setEdit] = useState<Partial<Trend> | null>(null);
  const ours = useMemo(() => {
    const scoped = metrics.filter((m) => app.inScope(m.clientId));
    const out = outliers(scoped);
    return scoped.filter((m) => out.has(m.id)).map((m) => ({ m, ratio: out.get(m.id)!.ratio })).sort((a, b) => b.ratio - a.ratio);
  }, [metrics, app]);
  return (
    <div className="stack loose">
      <Callout tone="info" title="Study outliers, not averages">
        An outlier is a post that did at least 2× its account’s usual views. Save every scroll-stopping reel and write down why it caught you; your own outliers show what to make more of.
      </Callout>
      <section className="stack">
        <h2>Our outliers</h2>
        {ours.length === 0 ? (
          <p className="muted small">Log results for at least 4 posts on a platform and the ones that beat your usual views show up here.</p>
        ) : (
          <div className="card flush">
            <div className="list">
              {ours.map(({ m, ratio }) => (
                <div key={m.id} className="list-item">
                  <TrendingUp size={20} className="good" />
                  <span className="main-text">
                    <b>{m.title}</b>
                    <span>
                      {PLATFORMS[m.platform].label} · {fmtIsoDate(m.date)} · {(m.views ?? 0).toLocaleString()} views
                    </span>
                  </span>
                  <Badge tone="good">{ratio.toFixed(1)}× usual</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="stack">
        <div className="row between wrap">
          <h2>Saved from other creators</h2>
          <Button variant="primary" onClick={() => setEdit({ kind: 'outlier', platform: 'instagram', status: 'watching' })}>
            <Plus size={16} /> Save an outlier
          </Button>
        </div>
        {trends.length === 0 ? <p className="muted small">Nothing saved yet.</p> : null}
        <div className="trend-grid">
          {trends.map((t) => {
            const ratio = t.views && t.creatorAvgViews ? t.views / t.creatorAvgViews : null;
            return (
              <button key={t.id} type="button" className="card trend-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setEdit(t)}>
                <div className="row wrap">
                  <Badge tone="teal">{platformLabel(t.platform)}</Badge>
                  {ratio ? <Badge tone={ratio >= 2 ? 'good' : undefined}>{ratio.toFixed(1)}× their usual</Badge> : null}
                </div>
                <b>{t.title}</b>
                {t.hook ? <span className="small">“{t.hook}”</span> : null}
                {t.whyItWorks ? <span className="tiny muted">{t.whyItWorks}</span> : null}
              </button>
            );
          })}
        </div>
      </section>
      <TrendDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Hooks() {
  const app = useApp();
  const hooks = useHooks() ?? [];
  const members = useMembers() ?? [];
  const today = todayISO();
  const me = app.member;
  const mine = hooks.filter((h) => h.memberId === (me?.id ?? null) && h.practiceDate);
  const s = streak(mine.map((h) => h.practiceDate as string), today);
  const [original, setOriginal] = useState('');
  const [rewrite, setRewrite] = useState('');
  const [why, setWhy] = useState('');
  const [pattern, setPattern] = useState('');
  const doneToday = mine.some((h) => h.practiceDate === today);
  const team = members
    .filter((m) => m.active === 1)
    .map((m) => ({ m, s: streak(hooks.filter((h) => h.memberId === m.id && h.practiceDate).map((h) => h.practiceDate as string), today) }))
    .sort((a, b) => b.s.current - a.s.current);
  return (
    <div className="stack loose">
      <section className="card pad-lg stack">
        <div className="row between wrap">
          <h2 className="dot-title">Hook of the day</h2>
          <span className="row">
            <Badge tone={s.current ? 'good' : undefined}>
              {s.current} day streak
            </Badge>
            <span className="muted small">Best {s.best}</span>
          </span>
        </div>
        <p className="muted small">Rewrite one viral hook in your own words, every day for 30 days. Paste a hook that stopped your scroll, then say it your way.</p>
        <StreakHeat days={s.last30} today={today} />
        {doneToday ? (
          <Callout tone="good">Done for today. See you tomorrow.</Callout>
        ) : (
          <div className="stack">
            <Field label="A hook that stopped your scroll" htmlFor="hk-orig">
              <TextInput id="hk-orig" value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="Paste or type it word for word" />
            </Field>
            <Field label="Your version" htmlFor="hk-new" hint="Same idea, our topic and our voice.">
              <TextInput id="hk-new" value={rewrite} onChange={(e) => setRewrite(e.target.value)} />
            </Field>
            <div className="form-grid">
              <Field label="Pattern" htmlFor="hk-pat">
                <Select id="hk-pat" value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  <option value="">Pick one</option>
                  {HOOK_PATTERNS.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Why it works" htmlFor="hk-why">
                <TextInput id="hk-why" value={why} onChange={(e) => setWhy(e.target.value)} />
              </Field>
            </div>
            <div>
              <Button
                variant="primary"
                disabled={!rewrite.trim()}
                onClick={async () => {
                  await saveHook({ text: original.trim() || rewrite.trim(), rewrite: rewrite.trim(), pattern, whyItWorks: why, memberId: me?.id ?? null, practiceDate: today });
                  setOriginal('');
                  setRewrite('');
                  setWhy('');
                  setPattern('');
                  app.toast('Nice. Streak kept.', { tone: 'good' });
                }}
              >
                <PenLine size={16} /> Save today’s hook
              </Button>
            </div>
          </div>
        )}
        {team.length > 1 ? (
          <div className="stack tight">
            <span className="eyebrow">Team streaks</span>
            <div className="chip-row">
              {team.map(({ m, s: ms }) => (
                <span key={m.id} className="chip" style={{ cursor: 'default' }}>
                  <MemberDot member={m} /> {m.name}: {ms.current}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <section className="stack">
        <h2>Hook patterns</h2>
        <div className="trend-grid">
          {HOOK_PATTERNS.map((p) => (
            <article key={p.id} className="card trend-card">
              <b>{p.name}</b>
              <span className="small muted">{p.template}</span>
              <span className="small">“{p.example}”</span>
            </article>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2>Hook bank</h2>
        {hooks.length === 0 ? <p className="muted small">Your daily hooks collect here.</p> : null}
        <div className="card flush">
          <div className="list">
            {hooks.map((h) => (
              <div key={h.id} className="list-item">
                <span className="main-text">
                  <b>{h.rewrite || h.text}</b>
                  <span>
                    {h.rewrite && h.text !== h.rewrite ? `From: “${h.text}” · ` : ''}
                    {h.pattern}
                    {h.practiceDate ? ` · ${fmtIsoDate(h.practiceDate)}` : ''}
                  </span>
                </span>
                <IconButton label="Copy" size="sm" onClick={async () => app.toast((await copyText(h.rewrite || h.text)) ? 'Copied' : 'Couldn’t copy', { tone: 'good' })}>
                  <Copy size={16} />
                </IconButton>
                <IconButton label="Delete" size="sm" plain onClick={() => deleteHook(h.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const LEVELS = [
  { level: 1, title: 'Level 1 creator', items: ['Copies trends blindly', 'Feels cringe posting', 'Posting but not growing', 'Hides their personality', 'Waiting to feel ready'] },
  { level: 2, title: 'Level 2 creator', items: ['Studies why reels work', 'Learns consistent hooks', 'Stabilises 10K views', 'Trusts their own voice', 'Shows up every week'] },
  { level: 3, title: 'Level 3 creator', items: ['Creates what others copy', 'Viral becomes normal', 'Builds community, not followers', 'Brands reach out first', 'Content becomes income'] },
];

function Playbook() {
  return (
    <div className="stack loose">
      <div className="trend-grid">
        {PLAYBOOK.map((c) => (
          <article key={c.id} className="card trend-card playbook-card">
            <h3>{c.title}</h3>
            <ul>
              {c.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <div className="src-list">
              {c.sources.map((s) =>
                s.url ? (
                  <a key={s.title} href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title} <ExternalLink size={11} />
                  </a>
                ) : (
                  <span key={s.title} className="muted">
                    {s.title}
                  </span>
                ),
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="stack">
        <h2>Where are we as creators?</h2>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <article key={l.level} className="card">
              <b>{l.title}</b>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                {l.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

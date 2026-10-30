import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Download, Plus, Wand2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, PageHeader, Segmented } from '../../components/ui';
import { Field, SearchInput, Select } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { MemberDots, MemberPicker, StatusBadge, useMemberMap } from '../../components/people';
import { useCampaigns, useIdeas, useMembers, usePosts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { STATUS_LABEL, STATUS_ORDER, isBreak, isDone, planMonth, restartDay, themeForDate, weekInfo, type MonthPlanRow } from '../../domain/calendar';
import { holidayName } from '../../domain/seasons';
import { campaignColor, campaignEnd, campaignsBetween, campaignsOn } from '../../domain/campaignDays';
import { applyReschedule, createPost, movePost, previewReschedule } from '../../services/content';
import { downloadBlob, toCSV } from '../../lib/files';
import { DOW_SHORT, addDays, fmtDateRange, fmtIsoDate, fmtIsoWeekday, fmtMonth, isoDate, mondayOf, nextMonthStart, mondayOnOrAfter, todayISO } from '../../lib/time';
import { useNow } from '../../hooks/useNow';
import { PostDialog } from './PostDialog';
import type { Campaign, Post, PostStatus } from '../../db/types';

type View = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const today = isoDate(useNow(60_000));
  const posts = usePosts();
  const members = useMembers() ?? [];
  const memberMap = useMemberMap();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const navigate = useNavigate();
  const campaigns = (useCampaigns() ?? []).filter((c) => app.inScope(c.clientId));
  const openCampaign = (id: string) => navigate(`/campaigns?open=${id}`);
  const [view, setView] = useState<View>(() => (params.get('view') as View) || (window.innerWidth < 760 ? 'list' : 'month'));
  const [anchor, setAnchor] = useState(() => params.get('date') ?? today);
  const [who, setWho] = useState<string[]>([]);
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ id: string | null; draft?: Partial<Post> } | null>(() => (params.get('post') ? { id: params.get('post') } : params.get('new') ? { id: null } : null));
  const [planOpen, setPlanOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      (posts ?? []).filter(
        (p) =>
          app.inScope(p.clientId) &&
          (!who.length || p.assignees.some((a) => who.includes(a))) &&
          (!status || p.status === status) &&
          (!q.trim() || `${p.title} ${p.brief} ${p.series}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [posts, app, who, status, q],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of visible) if (p.date) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [visible]);
  const backlog = visible.filter((p) => !p.date && !isDone(p.status));
  const overdue = visible.filter((p) => p.date && p.date < today && !isDone(p.status) && p.status !== 'scheduled');

  const openPost = (id: string) => {
    setOpen({ id });
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('post', id);
      return n;
    }, { replace: true });
  };
  const closePost = () => {
    setOpen(null);
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('post');
      n.delete('new');
      return n;
    }, { replace: true });
  };
  const newOn = (date: string | null) => setOpen({ id: null, draft: { date, themeKey: date ? (themeForDate(cadence, date)?.key ?? '') : '' } });

  const onDrop = async (e: DragEvent, date: string | null) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drop');
    const id = e.dataTransfer.getData('text/post-id');
    if (id) {
      await movePost(id, date);
      app.toast(date ? `Moved to ${fmtIsoWeekday(date)}` : 'Moved to the backlog', { tone: 'good' });
    }
  };
  const dropProps = (date: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes('text/post-id')) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.add('drop');
      }
    },
    onDragLeave: (e: DragEvent) => (e.currentTarget as HTMLElement).classList.remove('drop'),
    onDrop: (e: DragEvent) => void onDrop(e, date),
  });

  const shift = (dir: number) => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      setAnchor(isoDate(new Date(y, m - 1 + dir, 1).getTime()));
    } else setAnchor(addDays(anchor, dir * 7));
  };

  const exportCsv = () => {
    const rows = [...visible].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
    const csv = toCSV([
      ['Date', 'Day', 'Theme', 'Title', 'Format', 'Status', 'Designers', 'Series', 'Brief', 'Asset link'],
      ...rows.map((p) => [p.date ?? '', p.date ? DOW_SHORT[new Date(`${p.date}T00:00:00`).getDay()] : '', cadence.themes.find((t) => t.key === p.themeKey)?.name ?? '', p.title, p.format, STATUS_LABEL[p.status], p.assignees.map((a) => memberMap.get(a)?.name ?? '').join(' + '), p.series, p.brief, p.assetLink]),
    ]);
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `content-calendar-${today}.csv`);
  };

  const wk = weekInfo(cadence, view === 'month' ? today : anchor);

  return (
    <div className="page" style={{ maxWidth: 1480 }}>
      <PageHeader
        eyebrow={cadence.resumeOn && cadence.resumeOn > today ? `Posting restarts ${fmtIsoWeekday(restartDay(cadence))}` : `${wk.label}${wk.friday ? ` · Friday: ${wk.friday}` : ''}`}
        title="Content calendar"
        subtitle="Monday educational, Tuesday portfolio, Wednesday flex, Thursday designer, Friday behind JoshWorks. One break week a month."
        actions={
          <>
            <Button onClick={() => setPlanOpen(true)}>
              <Wand2 size={18} /> Plan a month
            </Button>
            <Button onClick={() => setMoveOpen(true)} disabled={!overdue.length && !backlog.length}>
              <CalendarClock size={18} /> Reschedule
            </Button>
            <Button variant="primary" onClick={() => newOn(view === 'list' ? null : today)}>
              <CalendarPlus size={18} /> New post
            </Button>
          </>
        }
      />

      {overdue.length ? (
        <Callout tone="warn" title={`${overdue.length} post${overdue.length === 1 ? ' is' : 's are'} past their date and not posted`}>
          Open them to post or move them, or use Reschedule to give them new dates in one go.
        </Callout>
      ) : null}

      <div className="filter-row">
        <Segmented<View>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'list', label: 'List' },
          ]}
        />
        {view !== 'list' ? (
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="icon-btn sm plain" aria-label="Previous" onClick={() => shift(-1)}>
              <ChevronLeft size={18} />
            </button>
            <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <button type="button" className="icon-btn sm plain" aria-label="Next" onClick={() => shift(1)}>
              <ChevronRight size={18} />
            </button>
            <b style={{ marginLeft: 6 }}>{view === 'month' ? fmtMonth(anchor) : `Week of ${fmtIsoDate(mondayOf(anchor))}`}</b>
          </div>
        ) : null}
        <span className="grow" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as PostStatus | '')}>
          <option value="">Any status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <div style={{ minWidth: 200 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search posts" />
        </div>
      </div>
      {members.length ? <MemberPicker value={who} onChange={setWho} members={members} label="Show posts by" /> : null}

      {view !== 'list' ? (
        <CampaignLegend
          campaigns={view === 'month' ? campaignsBetween(campaigns, mondayOf(`${anchor.slice(0, 7)}-01`), addDays(mondayOf(`${anchor.slice(0, 7)}-01`), 41)) : campaignsBetween(campaigns, mondayOf(anchor), addDays(mondayOf(anchor), 6))}
          onOpen={openCampaign}
        />
      ) : null}
      {view === 'month' ? (
        <MonthView anchor={anchor} today={today} byDate={byDate} memberMap={memberMap} campaigns={campaigns} onCampaign={openCampaign} onOpen={openPost} onNew={newOn} onMore={setDayOpen} dropProps={dropProps} />
      ) : view === 'week' ? (
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i)).map((d) => {
            const theme = themeForDate(cadence, d);
            const brk = isBreak(cadence, d);
            const hol = holidayName(d);
            const on = campaignsOn(campaigns, d);
            return (
              <div key={d} className={`wday ${d === today ? 'today' : ''} ${brk ? 'brk' : ''} ${on.length ? 'in-camp' : ''}`} style={campStyle(on)} {...dropProps(d)}>
                <div className="row between">
                  <b>{fmtIsoWeekday(d)}</b>
                  <button type="button" className="icon-btn sm plain" aria-label={`New post on ${fmtIsoWeekday(d)}`} onClick={() => newOn(d)}>
                    <Plus size={16} />
                  </button>
                </div>
                <span className="mtheme">{brk ? 'Break week' : hol ? hol : theme?.name ?? ''}</span>
                <CampaignBands list={on} day={d} rowStart onOpen={openCampaign} />
                {(byDate.get(d) ?? []).map((p) => (
                  <PostCard key={p.id} p={p} memberMap={memberMap} onOpen={() => openPost(p.id)} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <ListView posts={visible} memberMap={memberMap} onOpen={openPost} onExport={exportCsv} />
      )}

      <section className="card" {...dropProps(null)} aria-labelledby="backlog-title">
        <div className="card-head">
          <h2 id="backlog-title" className="dot-title">
            Backlog <span className="muted small">(no date yet)</span>
          </h2>
          <Button size="sm" onClick={() => newOn(null)}>
            <Plus size={16} /> Add to backlog
          </Button>
        </div>
        {backlog.length === 0 ? (
          <p className="muted small">Nothing waiting. Drag a post here to take it off the calendar.</p>
        ) : (
          <div className="trend-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {backlog.map((p) => (
              <PostCard key={p.id} p={p} memberMap={memberMap} onOpen={() => openPost(p.id)} showNote />
            ))}
          </div>
        )}
      </section>

      <PostDialog open={!!open} postId={open?.id ?? null} draft={open?.draft} onClose={closePost} />
      <PlanMonthDialog open={planOpen} onClose={() => setPlanOpen(false)} />
      <RescheduleDialog open={moveOpen} onClose={() => setMoveOpen(false)} candidates={[...overdue, ...backlog]} />
      <Dialog open={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? fmtIsoWeekday(dayOpen) : ''}>
        {(dayOpen ? (byDate.get(dayOpen) ?? []) : []).map((p) => (
          <PostCard
            key={p.id}
            p={p}
            memberMap={memberMap}
            onOpen={() => {
              setDayOpen(null);
              openPost(p.id);
            }}
          />
        ))}
      </Dialog>
    </div>
  );
}

function MonthView({
  anchor,
  today,
  byDate,
  memberMap,
  campaigns,
  onCampaign,
  onOpen,
  onNew,
  onMore,
  dropProps,
}: {
  anchor: string;
  today: string;
  byDate: Map<string, Post[]>;
  memberMap: ReturnType<typeof useMemberMap>;
  campaigns: Campaign[];
  onCampaign: (id: string) => void;
  onOpen: (id: string) => void;
  onNew: (d: string) => void;
  onMore: (d: string) => void;
  dropProps: (d: string | null) => Record<string, unknown>;
}) {
  const cadence = settingValue(useSettingRows(), 'cadence');
  const month = anchor.slice(0, 7);
  const start = mondayOf(`${month}-01`);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = days.slice(35).some((d) => d.slice(0, 7) === month) ? days : days.slice(0, 35);
  const colorOf = new Map(campaigns.map((c) => [c.id, campaignColor(c)]));
  return (
    <div className="month" role="grid" aria-label={fmtMonth(month)}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="month-wd" role="columnheader">
          {d}
        </div>
      ))}
      {weeks.map((d, i) => {
        const list = byDate.get(d) ?? [];
        const theme = themeForDate(cadence, d);
        const brk = isBreak(cadence, d);
        const hol = holidayName(d);
        const on = campaignsOn(campaigns, d);
        return (
          <div key={d} role="gridcell" className={`mday ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''} ${brk ? 'brk' : ''} ${on.length ? 'in-camp' : ''}`} style={campStyle(on)} {...dropProps(d)}>
            <div className="mday-head">
              <span className="mnum">{Number(d.slice(8))}</span>
              <span className="mtheme">{brk ? 'Break' : theme && !theme.flex ? theme.short : ''}</span>
              <button type="button" className="icon-btn sm plain add" aria-label={`New post on ${fmtIsoWeekday(d)}`} onClick={() => onNew(d)}>
                <Plus size={14} />
              </button>
            </div>
            <CampaignBands list={on} day={d} rowStart={i % 7 === 0} onOpen={onCampaign} />
            {hol ? <span className="mholiday">{hol}</span> : null}
            {list.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`post-chip ${p.status} ${p.campaignId && colorOf.has(p.campaignId) ? 'in-campaign' : ''}`}
                style={p.campaignId && colorOf.has(p.campaignId) ? ({ '--camp': colorOf.get(p.campaignId) } as CSSProperties) : undefined}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/post-id', p.id);
                  e.dataTransfer.effectAllowed = 'move';
                  (e.currentTarget as HTMLElement).classList.add('dragging');
                }}
                onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove('dragging')}
                onClick={() => onOpen(p.id)}
                title={`${p.title} · ${STATUS_LABEL[p.status]}`}
              >
                <span className={`sdot ${p.status}`} aria-hidden="true" />
                <span className="t">{p.title}</span>
                <MemberDots ids={p.assignees} members={memberMap} max={2} />
              </button>
            ))}
            {list.length > 3 ? (
              <button type="button" className="mmore" onClick={() => onMore(d)}>
                +{list.length - 3} more
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** A day in a campaign is tinted in the campaign's color (the earliest one, when several overlap). */
const campStyle = (on: Campaign[]): CSSProperties | undefined => (on.length ? ({ '--camp': campaignColor(on[0]) } as CSSProperties) : undefined);

/** The campaigns running that day: a band in each one's color, named on its first day and at the start of each week row. */
function CampaignBands({ list, day, rowStart, onOpen }: { list: Campaign[]; day: string; rowStart: boolean; onOpen: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <>
      {list.slice(0, 2).map((c) => {
        const start = c.startDate === day;
        const end = campaignEnd(c) === day;
        return (
          <button
            key={c.id}
            type="button"
            className={`camp-band ${start ? 'start' : ''} ${end ? 'end' : ''}`}
            style={{ '--camp': campaignColor(c) } as CSSProperties}
            title={`${c.name} · ${fmtDateRange(c.startDate, campaignEnd(c))}`}
            aria-label={`Campaign ${c.name}, ${fmtDateRange(c.startDate, campaignEnd(c))}`}
            onClick={() => onOpen(c.id)}
          >
            {start || rowStart ? c.name : '\u00a0'}
          </button>
        );
      })}
      {list.length > 2 ? <span className="tiny muted">+{list.length - 2} more campaigns</span> : null}
    </>
  );
}

/** The campaigns in view, in their colors; each opens its campaign. */
function CampaignLegend({ campaigns, onOpen }: { campaigns: Campaign[]; onOpen: (id: string) => void }) {
  if (!campaigns.length) return null;
  return (
    <div className="camp-legend" aria-label="Campaigns">
      {campaigns.map((c) => (
        <button key={c.id} type="button" className="camp-chip" style={{ '--camp': campaignColor(c) } as CSSProperties} onClick={() => onOpen(c.id)}>
          <span className="camp-dot" aria-hidden="true" />
          {c.name}
          <span className="muted">{fmtDateRange(c.startDate, campaignEnd(c))}</span>
        </button>
      ))}
    </div>
  );
}

export function PostCard({ p, memberMap, onOpen, showNote }: { p: Post; memberMap: ReturnType<typeof useMemberMap>; onOpen: () => void; showNote?: boolean }) {
  const cadence = settingValue(useSettingRows(), 'cadence');
  const theme = cadence.themes.find((t) => t.key === p.themeKey);
  return (
    <button
      type="button"
      className={`pcard ${p.status}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/post-id', p.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).classList.add('dragging');
      }}
      onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove('dragging')}
      onClick={onOpen}
    >
      <span className="title">{p.title}</span>
      <span className="meta">
        <StatusBadge status={p.status} />
        {p.format ? <span>{p.format}</span> : null}
        {theme ? <span>· {theme.short}</span> : null}
        {p.date ? <span>· {fmtIsoDate(p.date)}</span> : null}
        <span className="grow" />
        <MemberDots ids={p.assignees} members={memberMap} />
      </span>
      {showNote && p.note ? <span className="tiny muted">{p.note}</span> : null}
    </button>
  );
}

function ListView({ posts, memberMap, onOpen, onExport }: { posts: Post[]; memberMap: ReturnType<typeof useMemberMap>; onOpen: (id: string) => void; onExport: () => void }) {
  const cadence = settingValue(useSettingRows(), 'cadence');
  const today = todayISO();
  const [range, setRange] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const shown = posts
    .filter((p) => p.date && (range === 'all' || (range === 'upcoming' ? p.date >= today : p.date < today)))
    .sort((a, b) => (range === 'past' ? (b.date as string).localeCompare(a.date as string) : (a.date as string).localeCompare(b.date as string)));
  return (
    <div className="stack">
      <div className="row between wrap">
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Button size="sm" onClick={onExport}>
          <Download size={16} /> CSV
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No posts here">Add one with New post, or plan a whole month from the idea bank.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Theme</th>
                <th>Title</th>
                <th>Format</th>
                <th>Who</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="click" onClick={() => onOpen(p.id)}>
                  <td className="nowrap">{fmtIsoWeekday(p.date as string)}</td>
                  <td className="nowrap muted">{cadence.themes.find((t) => t.key === p.themeKey)?.short ?? ''}</td>
                  <td>
                    <span className="t-ellipsis strong">{p.title}</span>
                  </td>
                  <td className="nowrap">{p.format}</td>
                  <td>
                    <MemberDots ids={p.assignees} members={memberMap} />
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlanMonthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const posts = usePosts() ?? [];
  const ideas = useIdeas() ?? [];
  const members = useMembers() ?? [];
  const today = todayISO();
  const [month, setMonth] = useState(() => nextMonthStart(today).slice(0, 7));
  const [rows, setRows] = useState<(MonthPlanRow & { include: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const make = () => {
    const busyDates = new Set(posts.filter((p) => p.date && app.inScope(p.clientId) && p.status !== 'skipped').map((p) => p.date as string));
    const load = new Map<string, number>();
    for (const p of posts) if (p.date?.startsWith(month)) for (const a of p.assignees) load.set(a, (load.get(a) ?? 0) + 1);
    setRows(planMonth(cadence, month, { busyDates, ideas, members, load }).map((r) => ({ ...r, include: true })));
  };
  const create = async () => {
    if (!rows) return;
    setBusy(true);
    const clientId = app.scope !== 'all' && app.scope !== 'own' ? app.scope : null;
    let n = 0;
    for (const r of rows.filter((x) => x.include)) {
      await createPost({ title: r.title, date: r.date, themeKey: r.themeKey, format: r.format, assignees: r.assignees, ideaId: r.ideaId, status: 'todo', clientId });
      n++;
    }
    setBusy(false);
    app.toast(`Added ${n} post${n === 1 ? '' : 's'} to ${fmtMonth(month)}`, { tone: 'good' });
    setRows(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title="Plan a month"
      footer={
        rows ? (
          <>
            <Button onClick={() => setRows(null)}>Back</Button>
            <Button variant="primary" disabled={busy || !rows.some((r) => r.include)} onClick={create}>
              Add {rows.filter((r) => r.include).length} posts
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={make}>
            Suggest posts
          </Button>
        )
      }
    >
      {!rows ? (
        <div className="stack">
          <p className="muted">Fills every free themed day (not break weeks or holidays) with an unused idea from the idea bank that fits the day, given to whoever it’s best for and has the fewest posts that month.</p>
          <Field label="Month" htmlFor="pm-month">
            <input id="pm-month" type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        </div>
      ) : rows.length === 0 ? (
        <p className="muted">Every themed day in {fmtMonth(month)} already has a post.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Day</th>
                <th>Suggested post</th>
                <th>Who</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.date}>
                  <td>
                    <input type="checkbox" aria-label={`Include ${r.title}`} checked={r.include} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                  </td>
                  <td className="nowrap">
                    {fmtIsoWeekday(r.date)}
                    <div className="tiny muted">{cadence.themes.find((t) => t.key === r.themeKey)?.name}</div>
                  </td>
                  <td>
                    <input className="input" value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Title" />
                    {!r.ideaId ? <span className="tiny warn">No matching idea left; pick a topic.</span> : null}
                  </td>
                  <td>
                    <select className="select" value={r.assignees[0] ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, assignees: e.target.value ? [e.target.value] : [] } : x)))} aria-label="Who">
                      <option value="">Nobody yet</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}

function RescheduleDialog({ open, onClose, candidates }: { open: boolean; onClose: () => void; candidates: Post[] }) {
  const app = useApp();
  const today = todayISO();
  const [start, setStart] = useState(() => mondayOnOrAfter(addDays(today, 1)));
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewReschedule>> | null>(null);
  const ids = picked ?? new Set(candidates.map((p) => p.id));
  const title = (id: string) => candidates.find((p) => p.id === id)?.title ?? '';
  return (
    <Dialog
      open={open}
      onClose={() => {
        setPreview(null);
        onClose();
      }}
      size="wide"
      title="Reschedule"
      footer={
        preview ? (
          <>
            <Button onClick={() => setPreview(null)}>Back</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await applyReschedule(preview);
                app.toast(`Gave ${preview.placed.length} posts new dates`, { tone: 'good' });
                setPreview(null);
                onClose();
              }}
            >
              Apply new dates
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={!ids.size} onClick={async () => setPreview(await previewReschedule([...ids], start))}>
            Preview
          </Button>
        )
      }
    >
      {!preview ? (
        <div className="stack">
          <p className="muted">Gives late and undated posts new dates from the day you pick: each keeps its weekday theme, break weeks and holidays are skipped, days that already have a post are left alone, and seasonal posts stay in season.</p>
          <Field label="Start from" htmlFor="rs-start">
            <input id="rs-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <div className="card flush">
            <div className="list">
              {candidates.map((p) => (
                <label key={p.id} className="list-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ids.has(p.id)}
                    onChange={(e) => {
                      const n = new Set(ids);
                      if (e.target.checked) n.add(p.id);
                      else n.delete(p.id);
                      setPicked(n);
                    }}
                  />
                  <span className="main-text">
                    <b>{p.title}</b>
                    <span>{p.date ? `Was ${fmtIsoWeekday(p.date)}` : 'No date'}</span>
                  </span>
                  <StatusBadge status={p.status} />
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>New date</th>
                  <th>Post</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {preview.placed.map((x) => (
                  <tr key={x.id}>
                    <td className="nowrap">{fmtIsoWeekday(x.date)}</td>
                    <td>{title(x.id)}</td>
                    <td className="muted small">{x.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.unplaced.length ? (
            <Callout tone="warn" title="These need your decision">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {preview.unplaced.map((u) => (
                  <li key={u.id}>
                    <b>{title(u.id)}</b>: {u.reason}
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}
          <Badge tone="teal">{preview.placed.length} posts get new dates</Badge>
        </div>
      )}
    </Dialog>
  );
}

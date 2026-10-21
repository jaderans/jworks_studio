import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertTriangle, BarChart3, Bot, Briefcase, Inbox, ReceiptText, Wrench, CalendarClock, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileSignature, Flame, Hourglass,
  Megaphone, MessageSquareWarning, PenLine, Sparkles,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { useAudit, useClients, useContracts, useHooks, useJobs, useMembers, useMetrics, usePosts, useProposals, useReports, useSettingRows, useTrends } from '../../hooks/data';
import { useNow } from '../../hooks/useNow';
import { settingValue } from '../../db/settings';
import { Badge, Button, Loading, Stat } from '../../components/ui';
import { BarList } from '../../components/charts';
import { MemberDot, MemberDots, StatusBadge, useMemberMap } from '../../components/people';
import { isBreak, isDone, restartDay, themeForDate, weekInfo } from '../../domain/calendar';
import { compactNumber, outliers, totals } from '../../domain/metrics';
import { holidayName, upcomingDates } from '../../domain/seasons';
import { platformLabel } from '../../domain/platforms';
import { addDays, dayStart, daysFrom, fmtIsoDate, fmtIsoWeekday, isoDate, mondayOf, relativeTime } from '../../lib/time';
import { ACTIVITY_LABELS, activityTone } from '../activity/labels';
import { PostDialog } from '../calendar/PostDialog';
import type { Post } from '../../db/types';
import { JobsCard, MoneyCard, MyPayCard } from './StudioCards';
import { useInvoiceRows } from '../../hooks/money';
import './dashboard.css';

const longDateFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });
const dayNameFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The start screen: the time, money and jobs, what needs doing, then this week's posts, trends and results. */
export default function DashboardPage() {
  const app = useApp();
  const posts = usePosts();
  const [open, setOpen] = useState<string | null>(null);
  const scoped = useMemo(() => (posts ?? []).filter((p) => app.inScope(p.clientId)), [posts, app]);
  return (
    <div className="page dash">
      <div className="dash-grid">
        <Hero posts={scoped} loaded={!!posts} />
        {app.can('money') ? <MoneyCard /> : app.can('mypay') ? <MyPayCard /> : null}
        <JobsCard />
        <CalendarCard posts={scoped} onOpen={setOpen} />
        <WeekCard posts={scoped} onOpen={setOpen} loaded={!!posts} />
        <AttentionCard posts={scoped} onOpen={setOpen} />
        <TrendsCard />
        <ResultsCard />
        <TeamCard posts={scoped} />
        <ActivityCard />
      </div>
      <PostDialog open={!!open} postId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Hero({ posts, loaded }: { posts: Post[]; loaded: boolean }) {
  const app = useApp();
  const navigate = useNavigate();
  const now = useNow(1000);
  const cadence = settingValue(useSettingRows(), 'cadence');
  const d = new Date(now);
  const h = d.getHours();
  const greeting = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = (app.member?.name ?? '').trim().split(/\s+/)[0];
  const today = isoDate(now);
  const wk = weekInfo(cadence, today);
  const paused = cadence.resumeOn && cadence.resumeOn > today;
  const firstWeek = paused ? posts.filter((p) => p.date && p.date >= cadence.resumeOn && p.date < addDays(cadence.resumeOn, 14)) : [];
  const readyFirst = firstWeek.filter((p) => p.status === 'ready' || p.status === 'scheduled').length;
  const restart = paused ? restartDay(cadence) : '';
  return (
    <section className="dash-hero" aria-label="Today">
      <div className="hero-main">
        <span className="hero-date">{longDateFmt.format(now)}</span>
        <h1>
          {greeting}
          {first ? `, ${first}` : ''}
        </h1>
        <div className="hero-time" aria-label={`The time is ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`}>
          <span className="hm" aria-hidden="true">
            {h % 12 || 12}:{String(d.getMinutes()).padStart(2, '0')}
          </span>
          <span className="ss" aria-hidden="true">
            :{String(d.getSeconds()).padStart(2, '0')}
          </span>
          <span className="ap" aria-hidden="true">
            {h < 12 ? 'AM' : 'PM'}
          </span>
        </div>
        <p className="hero-event">
          {paused ? (
            <>
              <span className="hero-note">
                <Hourglass size={16} aria-hidden="true" /> Posting restarts {fmtIsoWeekday(restart)} · in {daysFrom(today, restart)} days
              </span>
              {loaded ? (
                <span>
                  {firstWeek.length
                    ? `${readyFirst} of ${firstWeek.length} posts for the first two weeks back are ready. Batch the rest now.`
                    : 'Nothing planned for the first two weeks back yet: plan a month or import the planner.'}
                </span>
              ) : null}
            </>
          ) : wk.isBreak ? (
            <span className="hero-note">Break week: batch next month, reply to DMs, repost a top performer.</span>
          ) : (
            <>
              <b>{wk.label}</b>
              {wk.friday ? <span>Friday focus: {wk.friday}</span> : null}
            </>
          )}
        </p>
        <div className="hero-actions">
          {app.can('editJobs') ? (
            <>
              <Button variant="primary" onClick={() => navigate('/jobs?new=inquiry')}>
                <Inbox size={18} /> New inquiry
              </Button>
              <button type="button" className="btn on-dark" onClick={() => navigate('/jobs?new=job')}>
                <Briefcase size={18} /> New job
              </button>
            </>
          ) : (
            <Button variant="primary" onClick={() => navigate('/jobs')}>
              <Briefcase size={18} /> My jobs
            </Button>
          )}
          <button type="button" className="btn on-dark" onClick={() => navigate('/calendar?new=1')}>
            <CalendarPlus size={18} /> New post
          </button>
          {app.can('editCampaigns') ? (
            <button type="button" className="btn on-dark hide-phone" onClick={() => navigate('/campaigns?new=1')}>
              <Megaphone size={18} /> Plan a campaign
            </button>
          ) : null}
          {app.can('assistant') ? (
            <button type="button" className="btn on-dark hide-phone" onClick={() => navigate('/assistant')}>
              <Bot size={18} /> Ask Claude
            </button>
          ) : null}
        </div>
      </div>
      <AnalogClock now={now} />
    </section>
  );
}

function AnalogClock({ now }: { now: number }) {
  const d = new Date(now);
  const s = d.getSeconds();
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  return (
    <svg className="analog" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="95" className="face" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="100" y1={i % 5 === 0 ? 11 : 13} x2="100" y2={i % 5 === 0 ? 25 : 19} className={i % 5 === 0 ? 'tick major' : 'tick'} transform={`rotate(${i * 6} 100 100)`} />
      ))}
      <line x1="100" y1="100" x2="100" y2="54" className="hand hour" transform={`rotate(${h * 30} 100 100)`} />
      <line x1="100" y1="100" x2="100" y2="32" className="hand minute" transform={`rotate(${m * 6} 100 100)`} />
      <line x1="100" y1="116" x2="100" y2="24" className="hand second" transform={`rotate(${s * 6} 100 100)`} />
      <circle cx="100" cy="100" r="5.5" className="pin" />
    </svg>
  );
}

function CalendarCard({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
  const today = isoDate(useNow(60_000));
  const cadence = settingValue(useSettingRows(), 'cadence');
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [sel, setSel] = useState<string | null>(null);
  const [y, mo] = month.split('-').map(Number);
  const firstDay = new Date(y, mo - 1, 1);
  const gridStart = mondayOf(`${month}-01`);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const byDate = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) if (p.date) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [posts]);
  const go = (delta: number) => {
    setMonth(isoDate(new Date(y, mo - 1 + delta, 1).getTime()).slice(0, 7));
    setSel(null);
  };
  const upcoming = upcomingDates(today, 45).slice(0, 4);
  const selected = sel ? (byDate.get(sel) ?? []) : [];
  return (
    <section className="card dash-cal" aria-labelledby="cal-title">
      <div className="cal-head">
        <h2 id="cal-title" className="dot-title">
          {monthFmt.format(firstDay)}
        </h2>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="icon-btn sm plain" aria-label="Previous month" onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSel(null);
            }}
          >
            Today
          </button>
          <button type="button" className="icon-btn sm plain" aria-label="Next month" onClick={() => go(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="cal-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {days.map((iso) => {
          const list = byDate.get(iso) ?? [];
          const live = list.some((p) => p.status === 'posted');
          const brk = isBreak(cadence, iso);
          const cls = ['cal-day', iso.slice(0, 7) !== month ? 'out' : '', iso === today ? 'today' : '', list.length ? 'has rs re' : '', live ? 'live' : '', sel === iso ? 'sel' : ''].filter(Boolean).join(' ');
          return (
            <button
              key={iso}
              type="button"
              className={cls}
              style={brk && !list.length ? { opacity: 0.45 } : undefined}
              aria-pressed={sel === iso}
              aria-label={`${dayNameFmt.format(dayStart(iso))}${iso === today ? ' (today)' : ''}${brk ? ', break week' : ''}${list.length ? `: ${list.length} post${list.length === 1 ? '' : 's'}` : ''}`}
              onClick={() => setSel(sel === iso ? null : iso)}
            >
              <span className="n">{Number(iso.slice(8))}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-list">
        <div className="row between">
          <span className="eyebrow">{sel ? dayNameFmt.format(dayStart(sel)) : 'Dates coming up'}</span>
          {sel ? (
            <button type="button" className="btn link small" onClick={() => setSel(null)}>
              Show dates
            </button>
          ) : null}
        </div>
        {sel ? (
          selected.length ? (
            selected.map((p) => (
              <button key={p.id} type="button" className="cal-ev" onClick={() => onOpen(p.id)}>
                <span className={`bar ${p.status === 'posted' ? 'live' : ''}`} aria-hidden="true" />
                <span className="grow">
                  <b>{p.title}</b>
                  <span className="muted small">{themeForDate(cadence, p.date as string)?.name ?? p.format}</span>
                </span>
                <StatusBadge status={p.status} />
              </button>
            ))
          ) : (
            <span className="muted small">{isBreak(cadence, sel) ? 'Break week.' : 'Nothing planned.'}</span>
          )
        ) : upcoming.length ? (
          upcoming.map((d) => (
            <div key={`${d.date}${d.name}`} className="cal-ev" style={{ cursor: 'default' }}>
              <span className="bar" aria-hidden="true" />
              <span className="grow">
                <b>{d.name}</b>
                <span className="muted small">
                  {fmtIsoWeekday(d.date)}
                  {d.idea ? ` · ${d.idea}` : ''}
                </span>
              </span>
            </div>
          ))
        ) : (
          <span className="muted small">No notable dates in the next weeks.</span>
        )}
      </div>
    </section>
  );
}

function WeekCard({ posts, onOpen, loaded }: { posts: Post[]; onOpen: (id: string) => void; loaded: boolean }) {
  const today = isoDate(useNow(60_000));
  const cadence = settingValue(useSettingRows(), 'cadence');
  const memberMap = useMemberMap();
  const paused = cadence.resumeOn && cadence.resumeOn > today;
  const monday = mondayOf(paused ? cadence.resumeOn : today);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const label = paused ? `First week back · ${fmtIsoDate(monday)}` : 'This week';
  return (
    <section className="card dash-week" aria-labelledby="wk-title">
      <div className="card-head">
        <h2 id="wk-title" className="dot-title">
          {label}
        </h2>
        <Link to="/calendar?view=week" className="btn sm">
          Calendar
        </Link>
      </div>
      {!loaded ? (
        <Loading />
      ) : isBreak(cadence, monday) ? (
        <p className="muted">Break week. Use it to batch-create next month’s posts, reply to DMs and repost a top performer.</p>
      ) : (
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {days.map((d) => {
            const theme = themeForDate(cadence, d);
            const list = posts.filter((p) => p.date === d);
            return (
              <div key={d} className="stack tight" style={{ minWidth: 0 }}>
                <span className="eyebrow">
                  {fmtIsoWeekday(d)}
                  {theme ? ` · ${theme.short}` : ''}
                </span>
                {list.length ? (
                  list.map((p) => (
                    <button key={p.id} type="button" className={`post-chip wrap ${p.status}`} onClick={() => onOpen(p.id)} title={p.title}>
                      <span className={`sdot ${p.status}`} aria-hidden="true" />
                      <span className="t">{p.title}</span>
                      <MemberDots ids={p.assignees} members={memberMap} max={2} />
                    </button>
                  ))
                ) : (
                  <span className="tiny muted">{holidayName(d) ?? (theme?.flex ? 'Flex: open' : 'Nothing yet')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface Todo {
  key: string;
  icon: ReactNode;
  tone: 'warn' | 'info';
  text: ReactNode;
  cta: string;
  go: () => void;
}

function AttentionCard({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const today = isoDate(useNow(60_000));
  const metrics = useMetrics();
  const proposals = useProposals();
  const contracts = useContracts();
  const clients = useClients();
  const trends = useTrends();
  const hooks = useHooks();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const jobs = useJobs();
  const invoiceRows = useInvoiceRows();

  const todos = useMemo<Todo[] | null>(() => {
    if (!metrics || !trends || !hooks) return null;
    const out: Todo[] = [];
    if (app.can('money') && invoiceRows) {
      const overdue = invoiceRows.filter((r) => r.t.overdue);
      if (overdue.length)
        out.push({ key: 'inv-overdue', icon: <ReceiptText size={18} />, tone: 'warn', text: <><b>{overdue.length}</b> invoice{overdue.length === 1 ? ' is' : 's are'} overdue. Send a reminder.</>, cta: 'Invoices', go: () => navigate('/money/invoices') });
    }
    if (jobs) {
      const meId = app.member?.id;
      const minej = (j: { designers: string[]; lead: string | null }) => app.role !== 'designer' || (!!meId && (j.designers.includes(meId) || j.lead === meId));
      const lateJobs = jobs.filter((j) => j.dueDate && j.dueDate < today && ['not-started', 'in-progress', 'review', 'revisions'].includes(j.status) && minej(j));
      if (lateJobs.length)
        out.push({ key: 'jobs-late', icon: <AlertTriangle size={18} />, tone: 'warn', text: <><b>{lateJobs.length}</b> job{lateJobs.length === 1 ? ' is' : 's are'} past the due date</>, cta: 'Deadlines', go: () => navigate('/jobs/deadlines') });
      const revisions = jobs.filter((j) => j.status === 'revisions' && minej(j));
      for (const j of revisions.slice(0, 2)) out.push({ key: `rev-${j.id}`, icon: <Wrench size={18} />, tone: 'info', text: <>Revisions asked on {j.number} “{j.title}”</>, cta: 'Open', go: () => navigate(`/jobs?job=${j.id}`) });
      if (app.can('editJobs')) {
        const waiting = jobs.filter((j) => j.status === 'inquiry' && daysFrom(isoDate(j.createdAt), today) >= 1);
        if (waiting.length)
          out.push({ key: 'inq', icon: <Inbox size={18} />, tone: 'warn', text: <><b>{waiting.length}</b> inquir{waiting.length === 1 ? 'y' : 'ies'} waiting a day or more for a quote</>, cta: 'Answer', go: () => navigate('/jobs') });
      }
    }
    const mine = (p: Post) => !app.member || app.role !== 'designer' || p.assignees.includes(app.member.id);
    const overdue = posts.filter((p) => p.date && p.date < today && !isDone(p.status) && p.status !== 'scheduled' && mine(p));
    if (overdue.length)
      out.push({ key: 'overdue', icon: <AlertTriangle size={18} />, tone: 'warn', text: <><b>{overdue.length}</b> post{overdue.length === 1 ? ' is' : 's are'} past their date and not posted</>, cta: 'Reschedule', go: () => navigate('/calendar') });
    const soon = posts.filter((p) => p.date && p.date >= today && p.date <= addDays(today, 3) && ['idea', 'todo', 'doing'].includes(p.status) && mine(p));
    for (const p of soon.slice(0, 3))
      out.push({ key: `soon-${p.id}`, icon: <PenLine size={18} />, tone: 'warn', text: <>“{p.title}” is due {fmtIsoWeekday(p.date as string)} and isn’t ready</>, cta: 'Open', go: () => onOpen(p.id) });
    if (cadence.resumeOn && cadence.resumeOn > today) {
      const first = posts.filter((p) => p.date && p.date >= cadence.resumeOn && p.date < addDays(cadence.resumeOn, 14) && !['ready', 'scheduled', 'posted'].includes(p.status));
      if (first.length)
        out.push({ key: 'batch', icon: <CalendarClock size={18} />, tone: 'info', text: <><b>{first.length}</b> post{first.length === 1 ? '' : 's'} for the first two weeks back still to make</>, cta: 'Board', go: () => navigate('/board') });
    }
    if (app.role !== 'designer') {
      const review = posts.filter((p) => p.approval.state === 'requested');
      if (review.length)
        out.push({ key: 'review', icon: <ClipboardCheck size={18} />, tone: 'warn', text: <><b>{review.length}</b> post{review.length === 1 ? '' : 's'} waiting for your review</>, cta: 'Review', go: () => onOpen(review[0].id) });
    }
    const changes = posts.filter((p) => p.approval.state === 'changes' && mine(p) && !isDone(p.status));
    for (const p of changes.slice(0, 2)) out.push({ key: `chg-${p.id}`, icon: <MessageSquareWarning size={18} />, tone: 'warn', text: <>Changes asked on “{p.title}”</>, cta: 'Open', go: () => onOpen(p.id) });
    const logged = new Set(metrics.map((m) => m.postId));
    const needNumbers = posts.filter((p) => p.status === 'posted' && p.date && daysFrom(p.date, today) >= 2 && daysFrom(p.date, today) <= 10 && !logged.has(p.id));
    if (needNumbers.length)
      out.push({ key: 'numbers', icon: <BarChart3 size={18} />, tone: 'info', text: <><b>{needNumbers.length}</b> posted post{needNumbers.length === 1 ? ' needs' : 's need'} results logged (48–72 h after posting)</>, cta: 'Log', go: () => onOpen(needNumbers[0].id) });
    const decide = posts.filter((p) => !p.date && !isDone(p.status) && /season|no free day/i.test(p.note));
    if (decide.length)
      out.push({ key: 'decide', icon: <Hourglass size={18} />, tone: 'info', text: <><b>{decide.length}</b> post{decide.length === 1 ? '' : 's'} in the backlog need a new date (their season passed)</>, cta: 'Backlog', go: () => navigate('/calendar') });
    if (app.can('money') && proposals && contracts) {
      const stale = proposals.filter((p) => p.status === 'sent' && daysFrom(p.date, today) >= 3);
      if (stale.length) out.push({ key: 'prop', icon: <Sparkles size={18} />, tone: 'info', text: <><b>{stale.length}</b> quote{stale.length === 1 ? '' : 's'} sent 3+ days ago. Follow up.</>, cta: 'Quotes', go: () => navigate('/docs/quotes') });
      const unsigned = contracts.filter((c) => c.status === 'sent');
      if (unsigned.length) out.push({ key: 'con', icon: <FileSignature size={18} />, tone: 'info', text: <><b>{unsigned.length}</b> contract{unsigned.length === 1 ? '' : 's'} waiting for a signature</>, cta: 'Contracts', go: () => navigate('/docs/contracts') });
    }
    if (app.can('clients') && clients) {
      const renew = clients.filter((c) => c.renewalDate && c.renewalDate >= today && c.renewalDate <= addDays(today, 14));
      for (const c of renew.slice(0, 2)) out.push({ key: `ren-${c.id}`, icon: <CalendarClock size={18} />, tone: 'info', text: <>{c.name} renews {fmtIsoDate(c.renewalDate)}</>, cta: 'Client', go: () => navigate(`/clients?id=${c.id}`) });
    }
    const expiring = trends.filter((t) => (t.status === 'watching' || t.status === 'trying') && t.expiresOn && t.expiresOn >= today && t.expiresOn <= addDays(today, 5));
    if (expiring.length) out.push({ key: 'trend', icon: <Flame size={18} />, tone: 'info', text: <><b>{expiring.length}</b> trend{expiring.length === 1 ? '' : 's'} on the board expire this week. Use or drop them.</>, cta: 'Trends', go: () => navigate('/trends/board') });
    if (app.member && !hooks.some((h) => h.memberId === app.member?.id && h.practiceDate === today))
      out.push({ key: 'hook', icon: <PenLine size={18} />, tone: 'info', text: <>Today’s hook practice: rewrite one viral hook in your own words</>, cta: 'Practise', go: () => navigate('/trends/hooks') });
    return out;
  }, [posts, metrics, proposals, contracts, clients, trends, hooks, today, app, navigate, onOpen, cadence, jobs, invoiceRows]);

  return (
    <section className="card dash-attn" aria-labelledby="attn-title">
      <div className="card-head">
        <h2 id="attn-title" className="dot-title">
          Needs attention
        </h2>
        {todos && todos.length ? <Badge tone="warn">{todos.length}</Badge> : null}
      </div>
      {!todos ? (
        <Loading />
      ) : todos.length === 0 ? (
        <div className="row muted">
          <CheckCircle2 size={20} className="good" /> All clear. Nothing waiting on you.
        </div>
      ) : (
        <div className="dash-list">
          {todos.map((t) => (
            <div key={t.key} className="dash-row">
              <span className={`attn-ic ${t.tone}`} aria-hidden="true">
                {t.icon}
              </span>
              <span className="attn-text small">{t.text}</span>
              <button type="button" className="btn sm" onClick={t.go}>
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TrendsCard() {
  const reports = useReports();
  const latest = reports?.[0];
  return (
    <section className="card dash-trends" aria-labelledby="tr-title">
      <div className="card-head">
        <h2 id="tr-title" className="dot-title">
          Trends this week
        </h2>
        <Link to="/trends" className="small strong">
          All trends
        </Link>
      </div>
      {!reports ? (
        <Loading />
      ) : !latest ? (
        <p className="muted small">No trend report yet. Ask Claude for one on the Trends page, or set up the weekly report.</p>
      ) : (
        <div className="dash-list">
          <span className="tiny muted">
            Week of {fmtIsoDate(latest.weekOf)} · {latest.source === 'feed' ? 'weekly report' : 'from the assistant'}
          </span>
          {latest.items.slice(0, 3).map((it) => (
            <div key={it.id} className="dash-row top">
              <Badge tone="teal">{platformLabel(it.platform)}</Badge>
              <span className="grow">
                <b className="small">{it.title}</b>
                <span className="tiny muted ellipsis">{it.howJoshWorks || it.what}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ResultsCard() {
  const app = useApp();
  const metrics = useMetrics();
  const today = isoDate(useNow(60_000));
  if (!metrics)
    return (
      <section className="card dash-results">
        <Loading />
      </section>
    );
  const scoped = metrics.filter((m) => app.inScope(m.clientId));
  const recent = scoped.filter((m) => m.date >= addDays(today, -30));
  const t = totals(recent.length ? recent : scoped);
  const out = outliers(scoped);
  const best = [...scoped].sort((a, b) => (b.shares ?? 0) + (b.saves ?? 0) - ((a.shares ?? 0) + (a.saves ?? 0)))[0];
  return (
    <section className="card dash-results" aria-labelledby="res-title">
      <div className="card-head">
        <h2 id="res-title" className="dot-title">
          {recent.length ? 'Last 30 days' : 'Results so far'}
        </h2>
        <Link to="/results" className="small strong">
          Results
        </Link>
      </div>
      {scoped.length === 0 ? (
        <p className="muted small">Log a post’s numbers 48–72 hours after it goes up. Saves and shares tell you what to make more of.</p>
      ) : (
        <>
          <div className="dash-kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Stat label="Views" value={compactNumber(t.views)} hint={`${t.posts} post${t.posts === 1 ? '' : 's'}`} />
            <Stat label="Shares" value={compactNumber(t.shares)} hint={`${compactNumber(t.saves)} saves`} />
          </div>
          {best ? (
            <p className="small">
              Most shared and saved: <b>{best.title}</b>
              {out.has(best.id) ? <Badge tone="good">{out.get(best.id)!.ratio.toFixed(1)}× usual views</Badge> : null}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function TeamCard({ posts }: { posts: Post[] }) {
  const members = useMembers();
  const today = isoDate(useNow(60_000));
  const month = today.slice(0, 7);
  const rows = (members ?? [])
    .filter((m) => m.active === 1)
    .map((m) => {
      const mine = posts.filter((p) => p.assignees.includes(m.id) && (p.date ?? '').startsWith(month));
      return { key: m.id, name: m.name, value: mine.length, sub: `${mine.filter((p) => p.status === 'posted').length} posted`, swatch: <MemberDot member={m} /> };
    })
    .sort((a, b) => b.value - a.value);
  return (
    <section className="card dash-team" aria-labelledby="team-title">
      <div className="card-head">
        <h2 id="team-title" className="dot-title">
          Posts per designer · {monthFmt.format(dayStart(`${month}-01`))}
        </h2>
      </div>
      <BarList rows={rows} format={(v) => String(v)} empty="Add the team in Team, then assign posts." />
    </section>
  );
}

function ActivityCard() {
  const app = useApp();
  const audit = useAudit(6);
  const members = useMembers();
  useNow(30_000);
  if (!app.can('activity')) return <section className="card dash-act" style={{ display: 'none' }} />;
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  return (
    <section className="card dash-act" aria-labelledby="act-title">
      <div className="card-head">
        <h2 id="act-title" className="dot-title">
          Activity
        </h2>
        <Link to="/activity" className="small strong">
          See all
        </Link>
      </div>
      {!audit ? (
        <Loading />
      ) : audit.length === 0 ? (
        <p className="muted small">Nothing yet. New posts, status changes and approvals show up here.</p>
      ) : (
        <div className="dash-list">
          {audit.map((a) => (
            <div key={a.id} className="dash-row top">
              <Badge tone={activityTone(a.action)}>{ACTIVITY_LABELS[a.action] ?? a.action}</Badge>
              <span className="grow">
                <span className="act-text">{a.summary}</span>
                <span className="muted tiny">
                  {relativeTime(a.at)}
                  {a.actorId ? ` · ${names.get(a.actorId) ?? 'someone'}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

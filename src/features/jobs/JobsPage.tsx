import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router';
import { AlertTriangle, Inbox, Plus, Zap } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, EmptyState, PageHeader } from '../../components/ui';
import { SearchInput, Select } from '../../components/form';
import { BarList } from '../../components/charts';
import { MemberDot, MemberDots, useMemberMap } from '../../components/people';
import { useJobMoney, useJobs, usePayments } from '../../hooks/data';
import { JOB_BOARD, JOB_STATUS_LABEL, JOB_TYPES, PRIORITY_LABEL, isOpen } from '../../domain/jobs';
import { jobBalance } from '../../domain/money';
import { setJobStatus } from '../../services/jobs';
import { peso } from '../../lib/money';
import { addDays, mondayOf, todayISO } from '../../lib/time';
import { JobDialog } from './JobDialog';
import { DueChip } from '../../components/DueChip';
import { InquiryDialog } from './InquiryDialog';
import type { JobStatus, JobView, Payment } from '../../db/types';

export default function JobsPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<'job' | 'inquiry' | null>(null);
  const [forClient, setForClient] = useState<string | null>(null);
  // Deep links: /jobs?job=<id>, /jobs?new=inquiry&client=<id>
  useEffect(() => {
    const id = params.get('job');
    const n = params.get('new');
    if (id) setOpen(id);
    if (n === 'inquiry' || n === 'job') {
      setNewKind(n);
      setForClient(params.get('client'));
    }
    if (id || n) setParams({}, { replace: true });
  }, [params, setParams]);
  return (
    <div className="page wide">
      <PageHeader
        title="Jobs"
        subtitle="Every commission from inquiry to delivered and paid. Drag a card to change its status."
        actions={
          app.can('editJobs') ? (
            <>
              <Button onClick={() => setNewKind('inquiry')}>
                <Inbox size={18} /> New inquiry
              </Button>
              <Button variant="primary" onClick={() => setNewKind('job')}>
                <Plus size={18} /> New job
              </Button>
            </>
          ) : undefined
        }
      />
      <Routes>
        <Route index element={<Board onOpen={setOpen} />} />
        <Route path="list" element={<List onOpen={setOpen} />} />
        <Route path="deadlines" element={<Deadlines onOpen={setOpen} />} />
        <Route path="workload" element={<Workload onOpen={setOpen} />} />
      </Routes>
      <JobDialog id={open} onClose={() => setOpen(null)} />
      <InquiryDialog open={newKind !== null} kind={newKind ?? 'job'} clientId={forClient} onClose={() => {
          setNewKind(null);
          setForClient(null);
        }} onCreated={(id) => setOpen(id)} />
    </div>
  );
}

/** Money per job, for owner and managers (designers never load it). */
function useBalances(): Map<string, ReturnType<typeof jobBalance>> | null {
  const app = useApp();
  const money = useJobMoney();
  const payments = usePayments();
  return useMemo(() => {
    if (!app.can('money') || !money || !payments) return null;
    const byJob = new Map<string, Payment[]>();
    for (const p of payments) if (p.jobId) byJob.set(p.jobId, [...(byJob.get(p.jobId) ?? []), p]);
    const out = new Map<string, ReturnType<typeof jobBalance>>();
    for (const [id, m] of money) out.set(id, jobBalance(m, byJob.get(id) ?? []));
    return out;
  }, [app, money, payments]);
}

export function JobCard({ job, onOpen, balance, draggable }: { job: JobView; onOpen: (id: string) => void; balance?: ReturnType<typeof jobBalance>; draggable?: boolean }) {
  const members = useMemberMap();
  const today = todayISO();
  return (
    <button
      type="button"
      className={`job-card ${job.priority === 'high' ? 'hot' : ''}`}
      onClick={() => onOpen(job.id)}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/job', job.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <span className="job-card-top">
        <span className="mono tiny muted">{job.number}</span>
        {job.rush ? (
          <Badge tone="warn">
            <Zap size={11} /> Rush
          </Badge>
        ) : null}
        {job.priority === 'high' ? <Badge tone="bad">High</Badge> : null}
      </span>
      <b className="job-title">{job.title || 'Untitled job'}</b>
      <span className="small muted ellipsis">{job.clientName || 'No client yet'}</span>
      <span className="job-card-foot">
        <DueChip job={job} today={today} />
        <span className="grow" />
        {balance && balance.total > 0 && balance.balance > 0 ? <span className="tiny strong balance">{peso(balance.balance)} due</span> : null}
        {balance && balance.state === 'paid' && balance.total > 0 ? <Badge tone="good">Paid</Badge> : null}
        <MemberDots ids={job.designers} members={members} max={3} />
      </span>
    </button>
  );
}

function Board({ onOpen }: { onOpen: (id: string) => void }) {
  const jobs = useJobs();
  const balances = useBalances();
  const [over, setOver] = useState<JobStatus | null>(null);
  const [showDone, setShowDone] = useState(false);
  if (!jobs) return null;
  if (jobs.length === 0)
    return (
      <EmptyState title="No jobs yet" icon={<Inbox size={40} />}>
        Add a new inquiry or job, or import your commission tracker in Settings → Import.
      </EmptyState>
    );
  const blocked = jobs.filter((j) => j.status === 'blocked');
  const columns: JobStatus[] = [...JOB_BOARD, ...(blocked.length ? (['blocked'] as JobStatus[]) : [])];
  const recentDone = (j: JobView) => j.status !== 'completed' || showDone || (j.completedOn && j.completedOn >= addDays(todayISO(), -30));
  return (
    <div className="stack">
      <div className="job-board" role="list">
        {columns.map((s) => {
          const list = jobs.filter((j) => j.status === s && recentDone(j)).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
          return (
            <section
              key={s}
              className={`job-col ${over === s ? 'over' : ''} st-${s}`}
              role="listitem"
              aria-label={JOB_STATUS_LABEL[s]}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/job');
                if (id) void setJobStatus(id, s);
              }}
            >
              <header className="job-col-head">
                <span className={`sdot job-${s}`} aria-hidden="true" />
                <b>{JOB_STATUS_LABEL[s]}</b>
                <span className="count">{list.length}</span>
              </header>
              <div className="job-col-body">
                {list.map((j) => (
                  <JobCard key={j.id} job={j} onOpen={onOpen} balance={balances?.get(j.id)} draggable />
                ))}
                {s === 'completed' && !showDone && jobs.some((j) => j.status === 'completed' && !recentDone(j)) ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowDone(true)}>
                    Show older completed jobs
                  </Button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const app = useApp();
  const jobs = useJobs();
  const balances = useBalances();
  const members = useMemberMap();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'open' | 'all' | JobStatus>('open');
  const [type, setType] = useState('');
  const [who, setWho] = useState('');
  if (!jobs) return null;
  const today = todayISO();
  const needle = q.trim().toLowerCase();
  const shown = jobs.filter(
    (j) =>
      (status === 'all' || (status === 'open' ? isOpen(j) || j.status === 'inquiry' : j.status === status)) &&
      (!type || j.type === type) &&
      (!who || j.designers.includes(who)) &&
      (!needle || `${j.number} ${j.title} ${j.clientName}`.toLowerCase().includes(needle)),
  );
  const money = app.can('money');
  return (
    <div className="stack">
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search jobs, clients, COM numbers" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="open">Open and inquiries</option>
          <option value="all">All statuses</option>
          {Object.entries(JOB_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {JOB_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select aria-label="Designer" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {[...members.values()]
            .filter((m) => m.active === 1)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
      </div>
      <p className="muted small">{shown.length} of {jobs.length} jobs</p>
      <div className="table-wrap">
        <table className="table cards-on-phone">
          <thead>
            <tr>
              <th>No.</th>
              <th>Job</th>
              <th>Client</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Team</th>
              {money ? <th className="r">Total</th> : null}
              {money ? <th className="r">Balance</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => {
              const b = balances?.get(j.id);
              return (
                <tr key={j.id} className="click" onClick={() => onOpen(j.id)}>
                  <td data-label="No." className="mono nowrap">{j.number}</td>
                  <td data-label="Job">
                    <b>{j.title || 'Untitled job'}</b>
                    {j.rush ? <Badge tone="warn">Rush</Badge> : null}
                  </td>
                  <td data-label="Client">{j.clientName || '—'}</td>
                  <td data-label="Type">{j.type}</td>
                  <td data-label="Status">
                    <span className={`status-text job-${j.status}`}>{JOB_STATUS_LABEL[j.status]}</span>
                  </td>
                  <td data-label="Due" className="nowrap">
                    <DueChip job={j} today={today} />
                  </td>
                  <td data-label="Team">
                    <MemberDots ids={j.designers} members={members} max={4} />
                  </td>
                  {money ? <td data-label="Total" className="r num">{b?.total ? peso(b.total) : '—'}</td> : null}
                  {money ? (
                    <td data-label="Balance" className={`r num ${b && b.balance > 0 ? 'strong' : ''}`}>
                      {b ? (b.total ? (b.balance > 0 ? peso(b.balance) : 'Paid') : '—') : '—'}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Deadlines({ onOpen }: { onOpen: (id: string) => void }) {
  const jobs = useJobs();
  const balances = useBalances();
  if (!jobs) return null;
  const today = todayISO();
  const thisMon = mondayOf(today);
  const nextMon = addDays(thisMon, 7);
  const after = addDays(thisMon, 14);
  const open = jobs.filter((j) => isOpen(j));
  const groups: { key: string; title: string; tone?: 'bad'; list: JobView[] }[] = [
    { key: 'late', title: 'Late', tone: 'bad', list: open.filter((j) => j.dueDate && j.dueDate < today) },
    { key: 'week', title: 'This week', list: open.filter((j) => j.dueDate && j.dueDate >= today && j.dueDate < nextMon) },
    { key: 'next', title: 'Next week', list: open.filter((j) => j.dueDate && j.dueDate >= nextMon && j.dueDate < after) },
    { key: 'later', title: 'Later', list: open.filter((j) => j.dueDate && j.dueDate >= after) },
    { key: 'none', title: 'No due date yet', list: open.filter((j) => !j.dueDate) },
  ];
  if (!open.length) return <EmptyState title="Nothing open">Every job is done. Nice.</EmptyState>;
  return (
    <div className="stack loose">
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.key} className="stack tight">
            <h2 className={`dot-title ${g.tone === 'bad' ? 'bad' : ''}`}>
              {g.tone === 'bad' ? <AlertTriangle size={18} /> : null} {g.title} <span className="muted small">({g.list.length})</span>
            </h2>
            <div className="job-grid">
              {g.list
                .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
                .map((j) => (
                  <JobCard key={j.id} job={j} onOpen={onOpen} balance={balances?.get(j.id)} />
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function Workload({ onOpen }: { onOpen: (id: string) => void }) {
  const jobs = useJobs();
  const members = useMemberMap();
  if (!jobs) return null;
  const today = todayISO();
  const week = addDays(today, 7);
  const open = jobs.filter((j) => isOpen(j));
  const people = [...members.values()].filter((m) => m.active === 1);
  const rows = people
    .map((m) => {
      const mine = open.filter((j) => j.designers.includes(m.id) || j.lead === m.id);
      return { m, mine, soon: mine.filter((j) => j.dueDate && j.dueDate <= week && j.dueDate >= today).length, late: mine.filter((j) => j.dueDate && j.dueDate < today).length };
    })
    .sort((a, b) => b.mine.length - a.mine.length);
  const unassigned = open.filter((j) => !j.designers.length && !j.lead);
  return (
    <div className="stack loose">
      <section className="card stack">
        <h2 className="dot-title">Open jobs per person</h2>
        <BarList
          rows={rows.map((r) => ({ key: r.m.id, name: r.m.name, value: r.mine.length, sub: r.late ? `${r.late} late` : undefined, swatch: <MemberDot member={r.m} /> }))}
          format={(v) => String(v)}
          empty="No one on the team yet."
        />
      </section>
      <div className="grid-2">
        {rows.map((r) => (
          <section key={r.m.id} className="card stack tight">
            <div className="row">
              <MemberDot member={r.m} size="lg" />
              <div className="grow">
                <b>{r.m.name}</b>
                <div className="tiny muted">{r.m.roleLabel}</div>
              </div>
              {r.late ? <Badge tone="bad">{r.late} late</Badge> : null}
              {r.soon ? <Badge tone="warn">{r.soon} due this week</Badge> : null}
            </div>
            {r.mine.length === 0 ? <p className="muted small">Nothing open: free for new work.</p> : null}
            {r.mine
              .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
              .map((j) => (
                <button key={j.id} type="button" className="mini-row" onClick={() => onOpen(j.id)}>
                  <span className="mono tiny muted">{j.number}</span>
                  <span className="grow ellipsis">{j.title}</span>
                  <DueChip job={j} today={today} />
                </button>
              ))}
          </section>
        ))}
        {unassigned.length ? (
          <section className="card stack tight">
            <b>Not assigned yet</b>
            {unassigned.map((j) => (
              <button key={j.id} type="button" className="mini-row" onClick={() => onOpen(j.id)}>
                <span className="mono tiny muted">{j.number}</span>
                <span className="grow ellipsis">{j.title}</span>
                <span className="tiny muted">{PRIORITY_LABEL[j.priority]}</span>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

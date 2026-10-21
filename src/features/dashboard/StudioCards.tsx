import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, CalendarClock, Landmark, ReceiptText, Send, Wallet } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Loading } from '../../components/ui';
import { MemberDot, useMemberMap } from '../../components/people';
import { useEarnings, useJobMoney, useJobs, usePayments, usePayouts, useSettingRows } from '../../hooks/data';
import { useNow } from '../../hooks/useNow';
import { settingValue } from '../../db/settings';
import { isOpen } from '../../domain/jobs';
import { jobBalance, nextBirReturn, payoutSummary, withheldEntries } from '../../domain/money';
import { peso } from '../../lib/money';
import { addDays, daysFrom, fmtIsoDate, isoDate } from '../../lib/time';
import { useInvoiceRows } from '../../hooks/money';
import { DueChip } from '../../components/DueChip';
import type { Payment } from '../../db/types';

const monthFmt = new Intl.DateTimeFormat('en-PH', { month: 'long' });

/** Owner and managers: this month's money against the target, what's unpaid, payouts to send, the next BIR return. */
export function MoneyCard() {
  const navigate = useNavigate();
  const today = isoDate(useNow(60_000));
  const rows = useInvoiceRows();
  const payments = usePayments();
  const money = useJobMoney();
  const earnings = useEarnings();
  const payouts = usePayouts();
  const settings = useSettingRows();
  const target = settingValue(settings, 'money').targets.find((t) => t.month === today.slice(0, 7));
  const bir = settingValue(settings, 'bir');
  const data = useMemo(() => {
    if (!rows || !payments || !money || !earnings || !payouts) return null;
    const month = today.slice(0, 7);
    const received = payments.filter((p) => p.date.startsWith(month)).reduce((a, p) => a + p.amount, 0);
    const live = rows.filter((r) => r.inv.status !== 'void' && r.inv.status !== 'draft' && r.t.balance > 0);
    const overdue = live.filter((r) => r.t.overdue);
    // Unpaid = what's left on priced jobs (covers jobs that have no invoice yet).
    const byJob = new Map<string, Payment[]>();
    for (const p of payments) if (p.jobId) byJob.set(p.jobId, [...(byJob.get(p.jobId) ?? []), p]);
    let unpaid = 0;
    for (const [id, m] of money) unpaid += Math.max(0, jobBalance(m, byJob.get(id) ?? []).balance);
    const owed = [...payoutSummary(earnings, payouts).values()].reduce((a, s) => a + Math.max(0, s.owed), 0);
    const next = nextBirReturn(payments, withheldEntries(money, payments, today), bir, today);
    return { received, overdue, unpaid, owed, next };
  }, [rows, payments, money, earnings, payouts, today, bir]);
  return (
    <section className="card dash-money" aria-labelledby="money-title">
      <div className="card-head">
        <h2 id="money-title" className="dot-title">
          Money · {monthFmt.format(new Date(`${today}T00:00:00`))}
        </h2>
        <Link className="btn sm ghost" to="/money/reports">
          Reports
        </Link>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className="stack">
          <div className="stack tight">
            <span className="eyebrow">Received this month</span>
            <span className="big num">{peso(data.received)}</span>
            {target ? (
              <>
                <div className="prog" role="img" aria-label={`${Math.round((data.received / Math.max(1, target.low)) * 100)}% of the ${peso(target.low)} target`}>
                  <span style={{ width: `${Math.min(100, (data.received / Math.max(1, target.low)) * 100)}%` }} />
                </div>
                <span className="tiny muted">
                  Target {peso(target.low)}
                  {target.high > target.low ? ` to ${peso(target.high)}` : ''}
                  {data.received < target.low ? ` · ${peso(target.low - data.received)} to go` : ' · reached'}
                </span>
              </>
            ) : (
              <span className="tiny muted">No target for this month. Set one in Settings → Money.</span>
            )}
          </div>
          <div className="dash-list">
            <button type="button" className="mini-row" onClick={() => navigate('/money/invoices')}>
              <ReceiptText size={16} aria-hidden="true" />
              <span className="grow">Still to collect</span>
              <b className="num">{peso(data.unpaid)}</b>
            </button>
            {data.overdue.length ? (
              <button type="button" className="mini-row" onClick={() => navigate('/money/invoices')}>
                <CalendarClock size={16} aria-hidden="true" className="bad" />
                <span className="grow">
                  {data.overdue.length} overdue invoice{data.overdue.length === 1 ? '' : 's'}
                </span>
                <b className="num bad">{peso(data.overdue.reduce((a, r) => a + r.t.balance, 0))}</b>
              </button>
            ) : null}
            <button type="button" className="mini-row" onClick={() => navigate('/money/payouts')}>
              <Send size={16} aria-hidden="true" />
              <span className="grow">Payouts to send</span>
              <b className="num">{peso(data.owed)}</b>
            </button>
            <button type="button" className="mini-row" onClick={() => navigate('/money/bir')}>
              <Landmark size={16} aria-hidden="true" />
              <span className="grow">
                {data.next
                  ? `BIR ${data.next.form} (${data.next.label}) due ${fmtIsoDate(data.next.due)}`
                  : bir.startDate > today
                    ? `BIR filing starts ${fmtIsoDate(bir.startDate)}`
                    : 'No BIR return due'}
              </span>
              {data.next ? <Badge tone={daysFrom(today, data.next.due) <= 14 ? 'warn' : undefined}>{daysFrom(today, data.next.due)} days</Badge> : null}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A designer's pay at a glance. */
export function MyPayCard() {
  const app = useApp();
  const earnings = useEarnings();
  const payouts = usePayouts();
  const today = isoDate(useNow(60_000));
  const me = app.member;
  if (!me) return null;
  const mine = (earnings ?? []).filter((e) => e.memberId === me.id);
  const s = payoutSummary(mine, (payouts ?? []).filter((p) => p.memberId === me.id)).get(me.id) ?? { earned: 0, paid: 0, owed: 0 };
  const month = mine.filter((e) => e.date.startsWith(today.slice(0, 7))).reduce((a, e) => a + e.amount, 0);
  return (
    <section className="card dash-money" aria-labelledby="pay-title">
      <div className="card-head">
        <h2 id="pay-title" className="dot-title">
          My pay
        </h2>
        <Link className="btn sm ghost" to="/mypay">
          <Wallet size={15} /> Details
        </Link>
      </div>
      <div className="stack tight">
        <span className="eyebrow">Owed to you</span>
        <span className="big num">{peso(Math.max(0, s.owed))}</span>
        <span className="tiny muted">
          {peso(month)} earned this month · {peso(s.paid)} paid to you so far
        </span>
      </div>
    </section>
  );
}

/** Jobs due soon and late; designers see their own. */
export function JobsCard() {
  const app = useApp();
  const navigate = useNavigate();
  const jobs = useJobs();
  const members = useMemberMap();
  const today = isoDate(useNow(60_000));
  if (!app.can('jobs')) return null;
  const me = app.member?.id;
  const mineOnly = app.role === 'designer';
  const open = (jobs ?? []).filter((j) => isOpen(j) && (!mineOnly || (me && (j.designers.includes(me) || j.lead === me))));
  const week = addDays(today, 7);
  const late = open.filter((j) => j.dueDate && j.dueDate < today);
  const soon = open.filter((j) => j.dueDate && j.dueDate >= today && j.dueDate <= week);
  const inquiries = mineOnly ? [] : (jobs ?? []).filter((j) => j.status === 'inquiry');
  const list = [...late, ...soon].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 7);
  const load = mineOnly
    ? []
    : [...members.values()]
        .filter((m) => m.active === 1)
        .map((m) => ({ m, n: open.filter((j) => j.designers.includes(m.id) || j.lead === m.id).length }))
        .filter((r) => r.n)
        .sort((a, b) => b.n - a.n);
  return (
    <section className="card dash-jobs" aria-labelledby="jobs-title">
      <div className="card-head">
        <h2 id="jobs-title" className="dot-title">
          {mineOnly ? 'My jobs' : 'Jobs'}
        </h2>
        <span className="row" style={{ gap: 6 }}>
          {late.length ? <Badge tone="bad">{late.length} late</Badge> : null}
          <Badge tone="teal">{open.length} open</Badge>
        </span>
      </div>
      {!jobs ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="muted small">{open.length ? 'Nothing due in the next 7 days.' : 'No open jobs.'}</p>
      ) : (
        <div className="dash-list">
          {list.map((j) => (
            <button key={j.id} type="button" className="mini-row" onClick={() => navigate(`/jobs?job=${j.id}`)}>
              <span className="mono tiny muted">{j.number}</span>
              <span className="grow ellipsis">
                {j.title}
                {j.clientName ? <span className="muted"> · {j.clientName}</span> : null}
              </span>
              <DueChip job={j} today={today} />
            </button>
          ))}
        </div>
      )}
      {load.length ? (
        <div className="row wrap" style={{ gap: 10 }} aria-label="Open jobs per person">
          {load.map((r) => (
            <span key={r.m.id} className="row tiny" style={{ gap: 5 }}>
              <MemberDot member={r.m} /> {r.n}
            </span>
          ))}
        </div>
      ) : null}
      <div className="row wrap">
        <Button size="sm" onClick={() => navigate('/jobs')}>
          <Briefcase size={15} /> Job board
        </Button>
        {inquiries.length ? (
          <Button size="sm" variant="ghost" onClick={() => navigate('/jobs')}>
            {inquiries.length} inquir{inquiries.length === 1 ? 'y' : 'ies'} to answer
          </Button>
        ) : null}
      </div>
    </section>
  );
}

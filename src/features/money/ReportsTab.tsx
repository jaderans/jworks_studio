import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, FileDown, FileSpreadsheet } from 'lucide-react';
import { Badge, Button, Callout, PageHeader, Segmented, Stat } from '../../components/ui';
import { BarList, ChartFrame, Meter, MonthColumns } from '../../components/charts';
import { MemberDot } from '../../components/people';
import { useEarnings, useExpenses, useInvoices, useJobMoney, useJobs, useMembers, usePayments, usePayouts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { birChecks, birReceipts, birReturns, last12Receipts, monthRange, monthlySummary, topClients, withheldEntries } from '../../domain/money';
import { buildIncomeReportPdf } from '../../reports/studioDocs';
import { deliverPdf } from '../../reports/pdf';
import { downloadBlob, toCSV } from '../../lib/files';
import { compactNumber } from '../../domain/metrics';
import { peso } from '../../lib/money';
import { fmtIsoDate, fmtMonth, todayISO } from '../../lib/time';

type Range = '6' | '12' | 'year' | 'all';

const pesoShort = (c: number) => `₱${compactNumber(c / 100)}`;

export function ReportsTab() {
  const jobs = useJobs();
  const money = useJobMoney();
  const payments = usePayments();
  const earnings = useEarnings();
  const expenses = useExpenses();
  const payouts = usePayouts();
  const members = useMembers() ?? [];
  const rows = useSettingRows();
  const settings = settingValue(rows, 'money');
  const business = settingValue(rows, 'business');
  const [range, setRange] = useState<Range>('6');
  const today = todayISO();
  const months = useMemo(() => {
    const cur = today.slice(0, 7);
    if (range === '6') return monthRange(cur, 6);
    if (range === '12') return monthRange(cur, 12);
    if (range === 'year') return monthRange(cur, Number(cur.slice(5, 7)));
    const first = [...(payments ?? []).map((p) => p.date), ...(jobs ?? []).map((j) => j.startDate)].filter(Boolean).sort()[0]?.slice(0, 7) ?? cur;
    const [y1, m1] = first.split('-').map(Number);
    const [y2, m2] = cur.split('-').map(Number);
    return monthRange(cur, Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1));
  }, [range, today, payments, jobs]);
  if (!jobs || !money || !payments || !earnings || !expenses || !payouts) return null;
  const data = monthlySummary(months, { jobs, money, payments, earnings, expenses }, settings);
  const sum = (k: 'booked' | 'received' | 'net' | 'expenses' | 'pending') => data.reduce((a, r) => a + r[k], 0);
  const cur = data[data.length - 1];
  const people = members.filter((m) => data.some((r) => r.byMember[m.id]));
  const top = topClients(jobs, money, (j) => j.clientName);
  const paidOut = payouts.filter((p) => months.includes(p.date.slice(0, 7))).reduce((a, p) => a + p.amount, 0);
  const title = `Income report · ${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])}`;
  return (
    <div className="stack loose">
      <PageHeader
        title="Reports"
        subtitle="Like the tracker’s Monthly and Yearly Summary: money booked and received, the team’s earnings, targets and top clients."
        actions={
          <>
            <Button
              onClick={() =>
                downloadBlob(
                  new Blob(
                    [
                      toCSV([
                        ['Month', 'Booked', 'Received', 'Net', 'Pending', 'Expenses', 'Target low', 'Target high', 'Projects started', 'Completed', ...people.map((m) => m.name)],
                        ...data.map((r) => [
                          r.month,
                          r.booked / 100,
                          r.received / 100,
                          r.net / 100,
                          r.pending / 100,
                          r.expenses / 100,
                          r.target ? r.target.low / 100 : '',
                          r.target ? r.target.high / 100 : '',
                          r.started,
                          r.completed,
                          ...people.map((m) => (r.byMember[m.id] ?? 0) / 100),
                        ]),
                      ]),
                    ],
                    { type: 'text/csv' },
                  ),
                  `JoshWorks income ${months[0]} to ${months[months.length - 1]}.csv`,
                )
              }
            >
              <FileSpreadsheet size={16} /> Spreadsheet
            </Button>
            <Button variant="primary" onClick={async () => deliverPdf(await buildIncomeReportPdf(data, { business, members, top, title }), `${title}.pdf`)}>
              <FileDown size={16} /> PDF
            </Button>
          </>
        }
      />
      <Segmented<Range>
        label="Period"
        value={range}
        onChange={setRange}
        options={[
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
          { value: 'year', label: 'This year' },
          { value: 'all', label: 'All time' },
        ]}
      />
      <div className="grid-4">
        <Stat label="Received" value={peso(sum('received'))} hint="Payments in, by date paid" />
        <Stat label="Net after deduction" value={peso(sum('net'))} hint={`After the ${settings.deductionPct}% deduction`} />
        <Stat label="Booked" value={peso(sum('booked'))} hint="Job totals, by start date" />
        <Stat label="Cash after expenses" value={peso(sum('received') - sum('expenses'))} hint={`Expenses ${peso(sum('expenses'))} · paid to the team ${peso(paidOut)}`} />
      </div>
      {cur?.target ? (
        <section className="card stack tight">
          <Meter value={cur.received / 100} target={cur.target.low / 100} label={`${fmtMonth(cur.month)}: received vs the low target (${peso(cur.target.low)}–${peso(cur.target.high)})`} />
        </section>
      ) : null}
      <section className="card">
        <ChartFrame
          title="Received each month"
          table={{ head: ['Month', 'Received (₱)', 'Target low (₱)', 'Booked (₱)', 'Pending (₱)', 'Started', 'Completed'], rows: data.map((r) => [fmtMonth(r.month), r.received / 100, r.target ? r.target.low / 100 : '—', r.booked / 100, r.pending / 100, r.started, r.completed]) }}
        >
          <MonthColumns data={data.map((r) => ({ month: r.month, value: r.received, target: r.target?.low ?? null }))} label="Received" format={pesoShort} />
          <p className="tiny muted">Dashed marks: the month’s low target from the 150-day plan.</p>
        </ChartFrame>
      </section>
      <div className="grid-2">
        <section className="card">
          <ChartFrame title="Team earnings" table={{ head: ['Person', 'Earned (₱)'], rows: people.map((m) => [m.name, data.reduce((a, r) => a + (r.byMember[m.id] ?? 0), 0) / 100]) }}>
            <BarList
              rows={people
                .map((m) => ({ key: m.id, name: m.name, value: data.reduce((a, r) => a + (r.byMember[m.id] ?? 0), 0), swatch: <MemberDot member={m} /> }))
                .sort((a, b) => b.value - a.value)}
              format={(v) => peso(v)}
              empty="No earnings in this period."
            />
          </ChartFrame>
        </section>
        <section className="card">
          <ChartFrame title="Top clients (all time)" table={{ head: ['Client', 'Jobs', 'Total (₱)'], rows: top.map((t) => [t.name, t.jobs, t.total / 100]) }}>
            <BarList rows={top.map((t) => ({ key: t.name, name: t.name, value: t.total, sub: `${t.jobs} job${t.jobs === 1 ? '' : 's'}` }))} format={(v) => peso(v)} empty="No priced jobs yet." />
          </ChartFrame>
        </section>
      </div>
      <p className="muted small">
        Big projects ({peso(settings.bigProject)} and up) booked in this period: {data.reduce((a, r) => a + r.bigProjects, 0)}. Targets and the deduction are set in{' '}
        <Link to="/settings#s-money">Settings → Money</Link>.
      </p>
    </div>
  );
}

export function BirTab() {
  const payments = usePayments();
  const money = useJobMoney();
  const invoices = useInvoices();
  const jobs = useJobs();
  const bir = settingValue(useSettingRows(), 'bir');
  const today = todayISO();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  if (!payments || !money || !invoices || !jobs) return null;
  const counted = birReceipts(payments, bir);
  const withheld = withheldEntries(money, payments, today);
  const returns = birReturns(year, payments, withheld, bir);
  const checks = birChecks({ payments, money, invoices, jobs }, bir);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const ceiling = last12Receipts(payments, today, bir);
  const months = new Map<string, number>();
  for (const p of counted) months.set(p.date.slice(0, 7), (months.get(p.date.slice(0, 7)) ?? 0) + p.amount);
  const next = returns.find((r) => r.due >= today);
  return (
    <div className="stack loose">
      <PageHeader title="BIR" subtitle={`Receipts from ${fmtIsoDate(bir.startDate)} (registration) under the ${bir.eightPct ? '8% income tax option' : 'graduated rates'}. Estimates to check with your accountant.`} />
      {today < bir.startDate ? <Callout tone="info">BIR tracking starts {fmtIsoDate(bir.startDate)}. Payments before that date aren’t counted.</Callout> : null}
      <div className="grid-3">
        <Stat label="Receipts counted" value={peso(counted.reduce((a, p) => a + p.amount, 0))} hint={`Since ${fmtIsoDate(bir.startDate)}`} />
        <Stat label="Next return" value={next ? `${next.form} · ${next.label}` : '—'} hint={next ? `Due ${fmtIsoDate(next.due)} · est. ${peso(next.payable)}` : undefined} />
        <Stat label="Last 12 months" value={peso(ceiling)} hint={`Non-VAT ceiling ${peso(bir.vatCeiling)}`} />
      </div>
      <section className="card stack tight">
        <Meter value={ceiling / 100} target={bir.vatCeiling / 100} label="Receipts in the last 12 months vs the ₱3M non-VAT ceiling" />
      </section>
      {checks.length ? (
        <section className="card stack tight attention">
          <h2 className="dot-title">
            <AlertTriangle size={18} /> Paperwork to fix
          </h2>
          {checks.map((c, i) => {
            const j = jobById.get(c.jobId);
            return (
              <div key={i} className="row wrap">
                <span className="mono small">{j?.number}</span>
                <span className="grow">{j?.title}</span>
                <Badge tone="warn">{c.problem}</Badge>
                <Link className="btn sm" to={`/jobs?job=${c.jobId}`}>
                  Open
                </Link>
              </div>
            );
          })}
        </section>
      ) : null}
      <section className="stack tight">
        <div className="row between wrap">
          <h2 className="dot-title">Returns {year}</h2>
          <Segmented<string>
            label="Year"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
        {returns.length === 0 ? (
          <p className="muted">No returns for {year} (before the registration date).</p>
        ) : (
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Return</th>
                  <th>Form</th>
                  <th>Due</th>
                  <th className="r">Receipts</th>
                  <th className="r">Year to date</th>
                  <th className="r">Above ₱250k</th>
                  <th className="r">8% tax (YTD)</th>
                  <th className="r">Withheld</th>
                  <th className="r">Est. payable</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.label}>
                    <td data-label="Return">{r.label}</td>
                    <td data-label="Form" className="mono">{r.form}</td>
                    <td data-label="Due" className="nowrap">{fmtIsoDate(r.due)}</td>
                    <td data-label="Receipts" className="r num">{peso(r.receipts)}</td>
                    <td data-label="Year to date" className="r num">{peso(r.ytd)}</td>
                    <td data-label="Above ₱250k" className="r num">{peso(r.taxable)}</td>
                    <td data-label="8% tax" className="r num">{peso(r.taxYtd)}</td>
                    <td data-label="Withheld" className="r num">{peso(r.withheldYtd)}</td>
                    <td data-label="Est. payable" className="r num strong">{peso(r.payable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card">
        <ChartFrame title="Receipts by month (BIR)" table={{ head: ['Month', 'Receipts (₱)'], rows: [...months.entries()].sort().map(([m, v]) => [fmtMonth(m), v / 100]) }}>
          <MonthColumns data={[...months.entries()].sort().map(([m, v]) => ({ month: m, value: v }))} label="Receipts" format={pesoShort} />
        </ChartFrame>
      </section>
      <p className="tiny muted">
        Under the 8% option, the tax is 8% of gross receipts above ₱250,000 for the year, less tax withheld by clients (Form 2307) and less tax paid in earlier quarters. This page is a planning aid, not tax advice.
      </p>
    </div>
  );
}

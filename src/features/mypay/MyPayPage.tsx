import { useState } from 'react';
import { FileDown, Pencil, QrCode } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, EmptyState, PageHeader, Stat } from '../../components/ui';
import { useEarnings, useJobs, usePayoutAccounts, usePayouts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { payoutSummary } from '../../domain/money';
import { buildPayoutStatementPdf } from '../../reports/studioDocs';
import { deliverPdf } from '../../reports/pdf';
import { peso } from '../../lib/money';
import { fmtIsoDate, todayISO } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import { PayoutAccountDialog, maskNumber } from '../money/PayoutsTab';

/** A designer's own pay: what they've earned as clients pay, what's been sent, and where to send it. */
export default function MyPayPage() {
  const app = useApp();
  const me = app.member;
  const earnings = useEarnings();
  const payouts = usePayouts();
  const accounts = usePayoutAccounts() ?? [];
  const jobs = useJobs() ?? [];
  const business = settingValue(useSettingRows(), 'business');
  const [editing, setEditing] = useState(false);
  if (!me) return <div className="page narrow"><EmptyState title="Who’s using this device?">Pick yourself from the menu at the top right.</EmptyState></div>;
  if (!earnings || !payouts) return null;
  const mine = earnings.filter((e) => e.memberId === me.id);
  const paid = payouts.filter((p) => p.memberId === me.id);
  const s = payoutSummary(mine, paid).get(me.id) ?? { earned: 0, paid: 0, owed: 0 };
  const account = accounts.find((a) => a.id === me.id) ?? null;
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const byJob = new Map<string, number>();
  for (const e of mine) byJob.set(e.jobId, (byJob.get(e.jobId) ?? 0) + e.amount);
  const month = todayISO().slice(0, 7);
  return (
    <div className="page narrow">
      <PageHeader
        title="My pay"
        subtitle="Your share of each job is released as the client pays (after the studio’s 5% deduction)."
        actions={
          <Button
            onClick={async () =>
              deliverPdf(
                await buildPayoutStatementPdf(me, { business, earnings: mine, payouts: paid, jobsById: new Map(jobs.map((j) => [j.id, { number: j.number, title: j.title }])), account }),
                `${safeFileName(`Payout statement ${me.name} ${todayISO()}`)}.pdf`,
                true,
              )
            }
          >
            <FileDown size={16} /> Statement
          </Button>
        }
      />
      <div className="grid-3">
        <Stat label="Owed to you" value={peso(Math.max(0, s.owed))} hero />
        <Stat label="Earned this month" value={peso(mine.filter((e) => e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0))} />
        <Stat label="Paid to you (all time)" value={peso(s.paid)} />
      </div>
      <section className="card stack tight">
        <div className="row between wrap">
          <h2 className="dot-title">Where you get paid</h2>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil size={15} /> {account ? 'Edit' : 'Add your details'}
          </Button>
        </div>
        {account && (account.accountNumber || account.accountName) ? (
          <div className="row wrap" style={{ gap: 8 }}>
            <b>{account.method}</b>
            <span>{account.accountName}</span>
            <span className="mono">{maskNumber(account.accountNumber)}</span>
            {account.qrImage ? <QrCode size={16} aria-label="QR code added" /> : null}
          </div>
        ) : (
          <p className="muted small">Add your GCash, Maya or bank details so the owner knows where to send your share.</p>
        )}
      </section>
      <section className="stack tight">
        <h2 className="dot-title">Earned per job</h2>
        {byJob.size === 0 ? (
          <EmptyState title="Nothing yet">When a client pays for a job you’re on, your share shows up here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Client</th>
                  <th className="r">Earned</th>
                </tr>
              </thead>
              <tbody>
                {[...byJob.entries()].map(([id, amt]) => {
                  const j = jobById.get(id);
                  return (
                    <tr key={id}>
                      <td data-label="Job">
                        <span className="mono tiny muted">{j?.number}</span> {j?.title ?? 'A job'}
                      </td>
                      <td data-label="Client">{j?.clientName ?? '—'}</td>
                      <td data-label="Earned" className="r num strong">{peso(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="stack tight">
        <h2 className="dot-title">Payouts</h2>
        {paid.length === 0 ? (
          <p className="muted small">No payouts recorded yet.</p>
        ) : (
          <div className="list card flush">
            {paid.map((p) => (
              <div key={p.id} className="list-item">
                <span className="main-text">
                  <b>{peso(p.amount)}</b>
                  <span>
                    {fmtIsoDate(p.date)} · {p.method}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <PayoutAccountDialog member={editing ? me : null} account={account} onClose={() => setEditing(false)} />
    </div>
  );
}

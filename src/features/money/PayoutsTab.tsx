import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FileDown, Pencil, QrCode, Send, Trash2, Upload } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, IconButton, PageHeader, Stat } from '../../components/ui';
import { Field, MoneyInput, Select, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { MemberDot } from '../../components/people';
import { useEarnings, useJobMoney, useJobs, useMembers, usePayments, usePayoutAccounts, usePayouts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { payoutSummary, unsplitJobs } from '../../domain/money';
import { deletePayout, savePayout, savePayoutAccount } from '../../services/money';
import { buildPayoutStatementPdf } from '../../reports/studioDocs';
import { deliverPdf } from '../../reports/pdf';
import { compressImage, readFileAsDataURL, safeFileName } from '../../lib/files';
import { peso } from '../../lib/money';
import { fmtIsoDate, todayISO } from '../../lib/time';
import type { Member, Payout, PayoutAccount } from '../../db/types';

export const PAYOUT_METHODS = ['GCash', 'Maya', 'Mari Bank', 'Union Bank', 'BPI', 'BDO', 'Cash', 'Other'];

/** "09171234567" → "•••• 4567" (the full number only shows when editing). */
export const maskNumber = (n: string) => (n.replace(/\s/g, '').length > 4 ? `•••• ${n.replace(/\s/g, '').slice(-4)}` : n);

export function PayoutsTab() {
  const app = useApp();
  const members = (useMembers() ?? []).filter((m) => m.active === 1 || m.appRole !== 'owner');
  const earnings = useEarnings();
  const payouts = usePayouts();
  const accounts = usePayoutAccounts() ?? [];
  const jobs = useJobs() ?? [];
  const business = settingValue(useSettingRows(), 'business');
  const jobMoney = useJobMoney();
  const payments = usePayments();
  const navigate = useNavigate();
  const [paying, setPaying] = useState<Partial<Payout> | null>(null);
  const [editingAccount, setEditingAccount] = useState<Member | null>(null);
  if (!earnings || !payouts) return null;
  const summary = payoutSummary(earnings, payouts);
  const people = members.filter((m) => m.active === 1 || summary.has(m.id));
  const unsplit = jobMoney && payments ? unsplitJobs(jobMoney, payments) : [];
  const owedTotal = [...summary.values()].reduce((a, s) => a + Math.max(0, s.owed), 0);
  const account = (id: string) => accounts.find((a) => a.id === id) ?? null;
  const statement = async (m: Member) => {
    const jobsById = new Map(jobs.map((j) => [j.id, { number: j.number, title: j.title }]));
    await deliverPdf(
      await buildPayoutStatementPdf(m, { business, earnings: earnings.filter((e) => e.memberId === m.id), payouts: payouts.filter((p) => p.memberId === m.id), jobsById, account: account(m.id) }),
      `${safeFileName(`Payout statement ${m.name} ${todayISO()}`)}.pdf`,
      true,
    );
  };
  return (
    <div className="stack loose">
      <PageHeader title="Designer payouts" subtitle="Each client payment releases every designer’s share (after the 5% deduction). Send what’s owed and record it here." />
      <div className="grid-3">
        <Stat label="Owed to the team" value={peso(owedTotal)} hero />
        <Stat label="Paid out this month" value={peso(payouts.filter((p) => p.date.startsWith(todayISO().slice(0, 7))).reduce((a, p) => a + p.amount, 0))} />
        <Stat label="Earned this month" value={peso(earnings.filter((e) => e.date.startsWith(todayISO().slice(0, 7))).reduce((a, e) => a + e.amount, 0))} />
      </div>
      {unsplit.length ? (
        <Callout tone="warn" title={`${peso(unsplit.reduce((a, u) => a + u.net, 0))} isn’t assigned to anyone yet`}>
          <span>These paid jobs have no team split, so no one has earned their share. Open the job → Money → Team split.</span>
          <span className="row wrap" style={{ gap: 6 }}>
            {unsplit.map((u) => {
              const j = jobs.find((x) => x.id === u.jobId);
              return (
                <Button key={u.jobId} size="sm" onClick={() => navigate(`/jobs?job=${u.jobId}`)}>
                  {j?.number ?? 'Job'} · {peso(u.net)}
                </Button>
              );
            })}
          </span>
        </Callout>
      ) : null}
      <div className="grid-2">
        {people.map((m) => {
          const s = summary.get(m.id) ?? { earned: 0, paid: 0, owed: 0 };
          const acc = account(m.id);
          return (
            <section key={m.id} className="card stack tight payout-card">
              <div className="row">
                <MemberDot member={m} size="lg" />
                <div className="grow">
                  <b>{m.name}</b>
                  <div className="tiny muted">{m.roleLabel}</div>
                </div>
                {s.owed > 0 ? <Badge tone="yellow">Owed {peso(s.owed)}</Badge> : s.earned ? <Badge tone="good">Paid up</Badge> : null}
              </div>
              <div className="kv-grid small">
                <span>Earned</span>
                <b className="num">{peso(s.earned)}</b>
                <span>Paid</span>
                <b className="num">{peso(s.paid)}</b>
              </div>
              <div className="pay-to">
                <span className="tiny muted strong">PAY TO</span>
                {acc && (acc.accountNumber || acc.accountName) ? (
                  <span className="row wrap" style={{ gap: 6 }}>
                    <b>{acc.method}</b> {acc.accountName ? <span>{acc.accountName}</span> : null} <span className="mono">{maskNumber(acc.accountNumber)}</span>
                    {acc.qrImage ? <QrCode size={14} aria-label="Has a QR code" /> : null}
                  </span>
                ) : (
                  <span className="muted small">No payout details yet</span>
                )}
                <IconButton label={`Edit where ${m.name} gets paid`} size="sm" plain onClick={() => setEditingAccount(m)}>
                  <Pencil size={14} />
                </IconButton>
              </div>
              <div className="row wrap">
                <Button size="sm" variant="primary" disabled={s.owed <= 0} onClick={() => setPaying({ memberId: m.id, amount: Math.max(0, s.owed), method: acc?.method ?? 'GCash', date: todayISO(), reference: '', note: '' })}>
                  <Send size={15} /> Pay now
                </Button>
                <Button size="sm" variant="ghost" onClick={() => statement(m)}>
                  <FileDown size={15} /> Statement
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      <section className="stack tight">
        <h2 className="dot-title">Payout history</h2>
        {payouts.length === 0 ? (
          <EmptyState title="No payouts recorded yet" />
        ) : (
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Person</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="r">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Date" className="nowrap">{fmtIsoDate(p.date)}</td>
                    <td data-label="Person">{members.find((m) => m.id === p.memberId)?.name ?? '—'}</td>
                    <td data-label="Method">{p.method || '—'}</td>
                    <td data-label="Reference" className="mono small">{p.reference || p.note || '—'}</td>
                    <td data-label="Amount" className="r num strong">{peso(p.amount)}</td>
                    <td className="actions-cell">
                      <IconButton
                        label="Delete payout"
                        size="sm"
                        plain
                        onClick={async () => {
                          if (!(await app.confirm({ title: `Delete this ${peso(p.amount)} payout?`, confirmLabel: 'Delete', tone: 'danger' }))) return;
                          await deletePayout(p.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <PayoutDialog value={paying} onClose={() => setPaying(null)} account={paying?.memberId ? account(paying.memberId) : null} name={members.find((m) => m.id === paying?.memberId)?.name ?? ''} />
      <PayoutAccountDialog member={editingAccount} account={editingAccount ? account(editingAccount.id) : null} onClose={() => setEditingAccount(null)} />
    </div>
  );
}

function PayoutDialog({ value, onClose, account, name }: { value: Partial<Payout> | null; onClose: () => void; account: PayoutAccount | null; name: string }) {
  const app = useApp();
  const [p, setP] = useState<Partial<Payout> | null>(null);
  if (value && (!p || p.memberId !== value.memberId)) setP(value);
  if (!value && p) setP(null);
  if (!value || !p) return null;
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={`Pay ${name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!p.amount}
            onClick={async () => {
              if (!p.memberId || !p.amount) return;
              await savePayout({ ...p, memberId: p.memberId, amount: p.amount });
              app.toast(`Recorded ${peso(p.amount)} paid to ${name}`, { tone: 'good' });
              onClose();
            }}
          >
            Record the payout
          </Button>
        </>
      }
    >
      {account && (account.accountNumber || account.qrImage) ? (
        <section className="card stack tight center-text">
          <span className="eyebrow">Send to</span>
          {account.qrImage ? <img src={account.qrImage} alt={`${name}'s ${account.method} QR code`} className="qr-preview" /> : null}
          <b>{account.method}</b>
          <span>{account.accountName}</span>
          <span className="mono big">{account.accountNumber}</span>
        </section>
      ) : (
        <p className="muted small">{name} hasn’t added payout details yet. They can add them in My pay, or you can add them here under Pay to.</p>
      )}
      <div className="form-grid">
        <Field label="Amount" htmlFor="po-amt">
          <MoneyInput id="po-amt" large value={p.amount ?? 0} onChange={(v) => setP({ ...p, amount: v ?? 0 })} />
        </Field>
        <Field label="Date" htmlFor="po-date">
          <input id="po-date" type="date" className="input" value={p.date ?? todayISO()} onChange={(e) => setP({ ...p, date: e.target.value })} />
        </Field>
        <Field label="Sent by" htmlFor="po-method">
          <Select id="po-method" value={p.method ?? 'GCash'} onChange={(e) => setP({ ...p, method: e.target.value })}>
            {PAYOUT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reference no." htmlFor="po-ref">
          <TextInput id="po-ref" value={p.reference ?? ''} onChange={(e) => setP({ ...p, reference: e.target.value })} />
        </Field>
        <Field label="Note" htmlFor="po-note" className="span-2">
          <TextInput id="po-note" value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="e.g. COM-037 down payment share" />
        </Field>
      </div>
    </Dialog>
  );
}

/** Where a designer gets paid. Designers edit their own in My pay; the owner and managers can edit anyone's. */
export function PayoutAccountDialog({ member, account, onClose }: { member: Member | null; account: PayoutAccount | null; onClose: () => void }) {
  const app = useApp();
  const [a, setA] = useState<Omit<PayoutAccount, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if (member && forId !== member.id) {
    setA({ method: account?.method ?? 'GCash', accountName: account?.accountName ?? member.name, accountNumber: account?.accountNumber ?? '', qrImage: account?.qrImage ?? '', notes: account?.notes ?? '' });
    setForId(member.id);
  }
  if (!member && forId) {
    setForId(null);
    setA(null);
  }
  if (!member || !a) return null;
  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title={`Where ${member.name} gets paid`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await savePayoutAccount(member.id, a);
              app.toast('Payout details saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <p className="muted small">Only {member.name}, the owner and managers can see these details.</p>
      <div className="form-grid">
        <Field label="Method" htmlFor="pa-method">
          <Select id="pa-method" value={a.method} onChange={(e) => setA({ ...a, method: e.target.value })}>
            {PAYOUT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Account name" htmlFor="pa-name">
          <TextInput id="pa-name" value={a.accountName} onChange={(e) => setA({ ...a, accountName: e.target.value })} />
        </Field>
        <Field label="Number" htmlFor="pa-num" className="span-2" hint="GCash or Maya number, or the bank account number.">
          <TextInput id="pa-num" inputMode="numeric" value={a.accountNumber} onChange={(e) => setA({ ...a, accountNumber: e.target.value })} />
        </Field>
        <div className="field span-2">
          <span className="label">QR code (optional)</span>
          <div className="row wrap">
            {a.qrImage ? <img src={a.qrImage} alt="QR code" className="qr-preview sm" /> : null}
            <label className="btn sm">
              <Upload size={15} /> {a.qrImage ? 'Replace' : 'Upload a QR code'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const small = await compressImage(file, 512, 1, 'image/png');
                  setA({ ...a, qrImage: await readFileAsDataURL(small) });
                }}
              />
            </label>
            {a.qrImage ? (
              <Button size="sm" variant="ghost" onClick={() => setA({ ...a, qrImage: '' })}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        <Field label="Notes" htmlFor="pa-notes" className="span-2">
          <TextInput id="pa-notes" value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

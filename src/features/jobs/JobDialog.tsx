import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSignature, FileText, Minus, Plus, ReceiptText, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { alive, db } from '../../db/db';
import { Dialog } from '../../components/Dialog';
import { Badge, Button, Callout, IconButton, Segmented } from '../../components/ui';
import { Check, Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { MemberDot, MemberPicker, useMemberMap } from '../../components/people';
import { PriceLinesEditor, TotalsCard } from '../../components/PriceLines';
import { useClients, useJobs, useMembers } from '../../hooks/data';
import { DELIVERY_CHECKLIST, JOB_STATUS_LABEL, JOB_TYPES, PRIORITY_LABEL, extraRevisions } from '../../domain/jobs';
import { CLIENT_KINDS } from '../../domain/clients';
import { cleanSplit, invoiceTotals, jobBalance, splitTotal } from '../../domain/money';
import { docTotals } from '../../domain/pricing';
import { deleteJob, saveJob, saveProgress } from '../../services/jobs';
import { invoiceForJob, saveJobMoney } from '../../services/money';
import { peso } from '../../lib/money';
import { fmtIsoDate, todayISO } from '../../lib/time';
import { PaymentDialog } from '../money/PaymentDialog';
import { InvoiceDialog } from '../money/InvoiceDialog';
import type { Job, JobMoney, JobProgress, JobStatus, Priority, ProposalItem, SplitShare } from '../../db/types';

type Tab = 'work' | 'delivery' | 'money';

const EXTRA_REVISION = 'Extra revision round';

export function JobDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const jobs = useJobs();
  const clients = useClients() ?? [];
  const members = (useMembers() ?? []).filter((m) => m.active === 1);
  const memberMap = useMemberMap();
  const canPlan = app.can('editJobs');
  const canMoney = app.can('money');
  const view = jobs?.find((j) => j.id === id) ?? null;
  const ledger = useLiveQuery(async () => {
    if (!id || !canMoney) return null;
    const [money, payments, invoices, earnings] = await Promise.all([
      db.jobMoney.get(id),
      db.payments.where('jobId').equals(id).toArray(),
      db.invoices.where('jobId').equals(id).toArray(),
      db.earnings.where('jobId').equals(id).toArray(),
    ]);
    return { money: money && money.deleted !== 1 ? money : null, payments: alive(payments).sort((a, b) => a.date.localeCompare(b.date)), invoices: alive(invoices), earnings: alive(earnings) };
  }, [id, canMoney]);

  const [tab, setTab] = useState<Tab>('work');
  const [plan, setPlan] = useState<Job | null>(null);
  const [prog, setProg] = useState<Omit<JobProgress, 'createdAt' | 'updatedAt'> | null>(null);
  const [money, setMoney] = useState<Partial<JobMoney> | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (view && loadedFor !== view.id) {
    const { status, completedOn, revisionsUsed, checklist, links, notes, progressAt, ...job } = view;
    void progressAt;
    setPlan(job);
    setProg({ id: view.id, status, completedOn, revisionsUsed, checklist, links, notes });
    setMoney(null);
    setLoadedFor(view.id);
    setTab('work');
  }
  if (!id && loadedFor) {
    setLoadedFor(null);
    setPlan(null);
    setProg(null);
    setMoney(null);
  }
  // The money record arrives a moment after the job; take it once.
  if (canMoney && ledger && plan && money === null && loadedFor === plan.id) {
    setMoney(ledger.money ?? { total: 0, items: [], discountAmount: 0, deductionPct: 5, split: [], taxWithheld: 0, form2307: 'na', invoiceNo: '', notes: '' });
  }
  if (!id || !plan || !prog) return null;

  const client = clients.find((c) => c.id === plan.clientId) ?? null;
  const audience = CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience ?? 'business';
  const extra = extraRevisions({ revisionsIncluded: plan.revisionsIncluded, revisionsUsed: prog.revisionsUsed });
  const items = money?.items ?? [];
  const total = items.length ? docTotals(items, money?.discountAmount ?? 0).net : (money?.total ?? 0);
  const bal = jobBalance({ total }, ledger?.payments ?? []);
  const split = money?.split ?? [];
  const splitSum = splitTotal(split);

  const setP = (patch: Partial<Job>) => setPlan({ ...plan, ...patch });
  const setG = (patch: Partial<JobProgress>) => setProg({ ...prog, ...patch });
  const setM = (patch: Partial<JobMoney>) => setMoney({ ...(money ?? {}), ...patch });

  const save = async (close = true) => {
    setBusy(true);
    try {
      if (canPlan) await saveJob(plan);
      await saveProgress(plan.id, prog);
      if (canMoney && money) await saveJobMoney(plan.id, { ...money, total, split: cleanSplit(split) });
      app.toast('Saved', { tone: 'good' });
      if (close) onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not save', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const addExtraRevisions = () => {
    const rest = items.filter((i) => i.label !== EXTRA_REVISION);
    const line: ProposalItem = { packageId: 'cat-add-ons-extra-revision-round', label: EXTRA_REVISION, qty: extra, unitPrice: 1500, unit: 'percent', months: 1 };
    setM({ items: [...rest, line] });
    setTab('money');
    app.toast(`Added ${extra} extra revision round${extra === 1 ? '' : 's'} (+15% each) to the price`, { tone: 'good' });
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: 'work', label: 'Work' },
    { value: 'delivery', label: 'Delivery' },
    ...(canMoney ? [{ value: 'money' as Tab, label: 'Money' }] : []),
  ];

  return (
    <>
      <Dialog
        open={!!id}
        onClose={onClose}
        size="xwide"
        fullPhone
        title={
          <span className="row wrap" style={{ gap: 8 }}>
            <span className="mono muted">{plan.number}</span> {plan.title || 'Untitled job'}
          </span>
        }
        footer={
          <>
            {canPlan ? (
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  if (!(await app.confirm({ title: `Delete ${plan.number}?`, message: 'Jobs with payments can’t be deleted; mark them Cancelled instead.', confirmLabel: 'Delete', tone: 'danger' }))) return;
                  try {
                    await deleteJob(plan.id);
                    onClose();
                  } catch (e) {
                    app.toast(e instanceof Error ? e.message : 'Could not delete', { tone: 'bad' });
                  }
                }}
              >
                <Trash2 size={16} /> Delete
              </Button>
            ) : null}
            <span className="grow" />
            {canMoney ? (
              <Button
                onClick={async () => {
                  await save(false);
                  onClose();
                  navigate(`/docs/contracts?job=${plan.id}`);
                }}
              >
                <FileSignature size={16} /> Contract
              </Button>
            ) : null}
            <Button variant="primary" disabled={busy} onClick={() => save()}>
              Save
            </Button>
          </>
        }
      >
        <div className="row wrap between">
          <Segmented<Tab> label="Section" value={tab} onChange={setTab} options={tabs} />
          <label className="row small strong" style={{ gap: 8 }}>
            Status
            <Select aria-label="Status" value={prog.status} onChange={(e) => setG({ status: e.target.value as JobStatus })} style={{ width: 'auto' }}>
              {Object.entries(JOB_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {tab === 'work' ? (
          <div className="stack">
            {canPlan ? (
              <div className="form-grid">
                <Field label="Job" htmlFor="jb-title" className="span-2">
                  <TextInput id="jb-title" value={plan.title} onChange={(e) => setP({ title: e.target.value })} placeholder="e.g. Brand identity for Kape Ilonggo" />
                </Field>
                <Field label="Client" htmlFor="jb-client">
                  <Select
                    id="jb-client"
                    value={plan.clientId ?? ''}
                    onChange={(e) => setP({ clientId: e.target.value || null, clientName: clients.find((c) => c.id === e.target.value)?.name ?? plan.clientName })}
                  >
                    <option value="">{plan.clientName ? `${plan.clientName} (not in Clients)` : 'No client'}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type" htmlFor="jb-type">
                  <Select id="jb-type" value={plan.type} onChange={(e) => setP({ type: e.target.value as Job['type'] })}>
                    {JOB_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Start" htmlFor="jb-start">
                  <input id="jb-start" type="date" className="input" value={plan.startDate} onChange={(e) => setP({ startDate: e.target.value })} />
                </Field>
                <Field label="Due" htmlFor="jb-due">
                  <input id="jb-due" type="date" className="input" value={plan.dueDate} onChange={(e) => setP({ dueDate: e.target.value })} />
                </Field>
                <Field label="Priority" htmlFor="jb-pri">
                  <Select id="jb-pri" value={plan.priority} onChange={(e) => setP({ priority: e.target.value as Priority })}>
                    {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Revision rounds included" htmlFor="jb-revinc">
                  <NumberInput id="jb-revinc" decimals={false} min={0} value={plan.revisionsIncluded} onChange={(v) => setP({ revisionsIncluded: v ?? 0 })} />
                </Field>
                <div className="span-2">
                  <MemberPicker label="Who works on it" value={plan.designers} members={members} onChange={(ids) => setP({ designers: ids, lead: ids.includes(plan.lead ?? '') ? plan.lead : (ids[0] ?? null) })} />
                </div>
                <Field label="Lead" htmlFor="jb-lead">
                  <Select id="jb-lead" value={plan.lead ?? ''} onChange={(e) => setP({ lead: e.target.value || null })}>
                    <option value="">No lead</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="field">
                  <span className="label">Rush</span>
                  <Check id="jb-rush" checked={plan.rush} onChange={(v) => setP({ rush: v })} label="Rush service (+25% of the package)" />
                </div>
                <Field label="Brief" htmlFor="jb-brief" className="span-2">
                  <TextArea id="jb-brief" rows={3} value={plan.brief} onChange={(e) => setP({ brief: e.target.value })} placeholder="What the client wants, references, sizes, text to use…" />
                </Field>
              </div>
            ) : (
              <div className="kv-grid">
                <span>Client</span>
                <b>{plan.clientName || '—'}</b>
                <span>Type</span>
                <b>{plan.type}</b>
                <span>Due</span>
                <b>{plan.dueDate ? fmtIsoDate(plan.dueDate) : '—'}</b>
                <span>Team</span>
                <span className="row wrap" style={{ gap: 6 }}>
                  {plan.designers.map((d) => (memberMap.get(d) ? <MemberDot key={d} member={memberMap.get(d)!} /> : null))}
                </span>
                <span>Brief</span>
                <span className="pre-wrap">{plan.brief || '—'}</span>
              </div>
            )}

            <section className="card stack tight">
              <div className="row between wrap">
                <b>Revisions</b>
                <span className="muted small">{plan.revisionsIncluded} included in the package</span>
              </div>
              <div className="row wrap">
                <IconButton label="One less revision" onClick={() => setG({ revisionsUsed: Math.max(0, prog.revisionsUsed - 1) })}>
                  <Minus size={16} />
                </IconButton>
                <span className="big num" aria-live="polite">
                  {prog.revisionsUsed}
                </span>
                <IconButton label="One more revision" onClick={() => setG({ revisionsUsed: prog.revisionsUsed + 1 })}>
                  <Plus size={16} />
                </IconButton>
                <span className="small">used</span>
                {extra ? <Badge tone="warn">{extra} beyond the package</Badge> : null}
              </div>
              {extra && canMoney ? (
                <Callout tone="warn" title={`${extra} extra revision round${extra === 1 ? '' : 's'}`}>
                  <div className="row wrap between">
                    <span>The contract charges +15% of the package per extra round.</span>
                    <Button size="sm" variant="teal" onClick={addExtraRevisions}>
                      Add to the price
                    </Button>
                  </div>
                </Callout>
              ) : null}
            </section>
            <Field label="Notes" htmlFor="jb-notes">
              <TextArea id="jb-notes" rows={2} value={prog.notes} onChange={(e) => setG({ notes: e.target.value })} />
            </Field>
          </div>
        ) : null}

        {tab === 'delivery' ? (
          <div className="stack">
            <section className="card stack tight">
              <b>Delivery checklist</b>
              {DELIVERY_CHECKLIST.map((c) => (
                <Check key={c.id} id={`dl-${c.id}`} checked={!!prog.checklist[c.id]} onChange={(v) => setG({ checklist: { ...prog.checklist, [c.id]: v } })} label={c.label} />
              ))}
            </section>
            <section className="card stack tight">
              <div className="row between">
                <b>Files and links</b>
                <Button size="sm" variant="ghost" onClick={() => setG({ links: [...prog.links, { label: '', url: '' }] })}>
                  <Plus size={16} /> Add a link
                </Button>
              </div>
              {prog.links.length === 0 ? <p className="muted small">Add the Drive folder, final files or the client’s brand kit.</p> : null}
              {prog.links.map((l, i) => (
                <div key={i} className="link-row">
                  <input className="input" aria-label="What it is" placeholder="e.g. Final files" value={l.label} onChange={(e) => setG({ links: prog.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input className="input" aria-label="Link" placeholder="https://drive.google.com/…" value={l.url} onChange={(e) => setG({ links: prog.links.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)) })} />
                  {/^https?:\/\//.test(l.url) ? (
                    <a className="icon-btn" href={l.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${l.label || 'link'}`}>
                      <FileText size={16} />
                    </a>
                  ) : null}
                  <IconButton label="Remove link" size="sm" plain onClick={() => setG({ links: prog.links.filter((_, j) => j !== i) })}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {tab === 'money' && canMoney ? (
          money ? (
            <div className="editor-grid">
              <div className="stack">
                <section className="stack tight">
                  <h3>Price</h3>
                  <PriceLinesEditor items={items} onChange={(next) => setM({ items: next })} audience={audience} />
                  <div className="form-grid">
                    {items.length === 0 ? (
                      <Field label="Total (no price lines)" htmlFor="jm-total" hint="Or add lines from the price list.">
                        <MoneyInput id="jm-total" value={money.total ?? 0} onChange={(v) => setM({ total: v ?? 0 })} />
                      </Field>
                    ) : null}
                    <Field label="Discount" htmlFor="jm-disc" hint="e.g. REPYOURORG15 or a bulk discount, in pesos.">
                      <MoneyInput id="jm-disc" value={money.discountAmount ?? 0} onChange={(v) => setM({ discountAmount: v ?? 0 })} />
                    </Field>
                  </div>
                </section>

                <section className="stack tight">
                  <div className="row between wrap">
                    <h3>Team split</h3>
                    <Badge tone={split.length === 0 ? 'warn' : Math.abs(splitSum - 100) < 0.01 ? 'good' : 'bad'}>{split.length ? `${splitSum}%` : 'No split yet'}</Badge>
                  </div>
                  <p className="muted small">
                    {money.deductionPct ?? 5}% comes off first (processing and tax pool), then the rest is shared. Each client payment releases the same share, so designers can be paid as the money comes in.
                  </p>
                  {split.map((s, i) => (
                    <div key={i} className="split-row">
                      <Select aria-label="Designer" value={s.memberId} onChange={(e) => setM({ split: split.map((x, j) => (j === i ? { ...x, memberId: e.target.value } : x)) })}>
                        <option value="">Pick someone</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                      <div style={{ width: 120 }}>
                        <NumberInput ariaLabel="Share" suffix="%" value={s.pct} onChange={(v) => setM({ split: split.map((x, j) => (j === i ? { ...x, pct: v ?? 0 } : x)) })} />
                      </div>
                      <span className="small muted num nowrap">{peso(Math.round(((total - Math.round((total * (money.deductionPct ?? 5)) / 100)) * s.pct) / 100))}</span>
                      <IconButton label="Remove" size="sm" plain onClick={() => setM({ split: split.filter((_, j) => j !== i) })}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  ))}
                  <div className="row wrap">
                    <Button size="sm" variant="ghost" onClick={() => setM({ split: [...split, { memberId: plan.designers.find((d) => !split.some((s) => s.memberId === d)) ?? '', pct: Math.max(0, 100 - splitSum) } as SplitShare] })}>
                      <Plus size={16} /> Add a person
                    </Button>
                    {plan.designers.length ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const n = plan.designers.length;
                          const each = Math.floor((100 / n) * 10) / 10;
                          setM({ split: plan.designers.map((m, i) => ({ memberId: m, pct: i === 0 ? Math.round((100 - each * (n - 1)) * 10) / 10 : each })) });
                        }}
                      >
                        Split evenly between the team
                      </Button>
                    ) : null}
                  </div>
                  <div className="form-grid">
                    <Field label="Deduction before the split" htmlFor="jm-ded">
                      <NumberInput id="jm-ded" suffix="%" value={money.deductionPct ?? 5} onChange={(v) => setM({ deductionPct: v ?? 0 })} />
                    </Field>
                    <Field label="Tax withheld by the client" htmlFor="jm-tax" hint="Schools, LGUs and companies may withhold and give a Form 2307.">
                      <MoneyInput id="jm-tax" value={money.taxWithheld ?? 0} onChange={(v) => setM({ taxWithheld: v ?? 0 })} />
                    </Field>
                    {money.taxWithheld ? (
                      <Field label="Form 2307 received?" htmlFor="jm-2307">
                        <Select id="jm-2307" value={money.form2307 ?? 'no'} onChange={(e) => setM({ form2307: e.target.value as JobMoney['form2307'] })}>
                          <option value="no">Not yet</option>
                          <option value="yes">Yes</option>
                          <option value="na">Not needed</option>
                        </Select>
                      </Field>
                    ) : null}
                  </div>
                </section>

                <section className="stack tight">
                  <div className="row between wrap">
                    <h3>Payments</h3>
                    <Button size="sm" variant="teal" onClick={async () => { await save(false); setPaying(true); }}>
                      <Wallet size={16} /> Record a payment
                    </Button>
                  </div>
                  {ledger?.payments.length ? (
                    <div className="table-wrap">
                      <table className="table cards-on-phone">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Receipt</th>
                            <th>Method</th>
                            <th className="r">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.payments.map((p) => (
                            <tr key={p.id}>
                              <td data-label="Date">{fmtIsoDate(p.date)}</td>
                              <td data-label="Receipt" className="mono">{p.receiptNo}</td>
                              <td data-label="Method">{p.method}</td>
                              <td data-label="Amount" className="r num">{peso(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted small">No payments yet.</p>
                  )}
                </section>

                <section className="stack tight">
                  <div className="row between wrap">
                    <h3>Invoices</h3>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await save(false);
                        const inv = await invoiceForJob(plan.id);
                        setInvoiceId(inv.id);
                      }}
                    >
                      <ReceiptText size={16} /> Make an invoice
                    </Button>
                  </div>
                  {ledger?.invoices.length ? (
                    <div className="list card flush">
                      {ledger.invoices.map((inv) => {
                        const it = invoiceTotals(inv, ledger.payments, todayISO());
                        return (
                          <button key={inv.id} type="button" className="list-item click more-item" onClick={() => setInvoiceId(inv.id)}>
                            <span className="mono">{inv.number}</span>
                            <span className="main-text">
                              <span>{fmtIsoDate(inv.issueDate)}</span>
                            </span>
                            <Badge tone={it.state === 'paid' ? 'good' : it.overdue ? 'bad' : it.state === 'partial' ? 'yellow' : undefined}>{inv.status === 'void' ? 'Void' : it.overdue ? 'Overdue' : it.state}</Badge>
                            <span className="num">{peso(it.total)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted small">No invoices yet.</p>
                  )}
                </section>
              </div>
              <aside className="side-panel">
                <div className="card">
                  <span className="eyebrow">Job total</span>
                  {items.length ? <TotalsCard items={items} discountAmount={money.discountAmount ?? 0} /> : <div className="big">{peso(total)}</div>}
                  <div className="waterfall">
                    <div className="wf-row sub">
                      <span>Paid</span>
                      <span className="v">{peso(bal.paid)}</span>
                    </div>
                    <div className="wf-row final">
                      <span>Balance</span>
                      <span className="v">{peso(Math.max(0, bal.balance))}</span>
                    </div>
                  </div>
                </div>
                <div className="card stack tight">
                  <span className="eyebrow">Earned so far</span>
                  {split.length === 0 ? <p className="muted small">Set the team split to see each person’s share.</p> : null}
                  {cleanSplit(split).map((s) => {
                    const m = memberMap.get(s.memberId);
                    const earned = (ledger?.earnings ?? []).filter((e) => e.memberId === s.memberId).reduce((a, e) => a + e.amount, 0);
                    return (
                      <div key={s.memberId} className="row">
                        {m ? <MemberDot member={m} /> : null}
                        <span className="grow">{m?.name ?? 'Someone'}</span>
                        <span className="num small">{peso(earned)}</span>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          ) : (
            <p className="muted">Loading the money side…</p>
          )
        ) : null}
      </Dialog>
      <PaymentDialog
        open={paying}
        onClose={() => setPaying(false)}
        preset={{ jobId: plan.id, clientId: plan.clientId, amount: bal.paid === 0 && total ? Math.round(total / 2) : Math.max(0, bal.balance), kind: bal.paid === 0 ? 'down' : 'final' }}
      />
      <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId(null)} />
    </>
  );
}

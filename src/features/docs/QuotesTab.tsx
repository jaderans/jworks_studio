import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Briefcase, FileDown, FileSignature, Mail, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, EmptyState, PageHeader, Toggle } from '../../components/ui';
import { Field, MoneyInput, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { PriceLinesEditor } from '../../components/PriceLines';
import { useClients, usePackages, useProposals, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { CLIENT_KINDS } from '../../domain/clients';
import { DISCOUNT_CODES, FOUNDING_OFFER } from '../../domain/packages';
import { proposalTotals } from '../../domain/pricing';
import { deleteProposal, newProposal, saveProposal } from '../../services/clients';
import { jobFromQuote } from '../../services/documents';
import { buildQuotePdf } from '../../reports/studioDocs';
import { deliverPdf } from '../../reports/pdf';
import { quoteEmail } from '../../email/templates';
import { sendEmail } from '../../email/send';
import { peso } from '../../lib/money';
import { addDays, fmtIsoDate, inPeriod, type Period } from '../../lib/time';
import { FilterBar, PeriodSelect } from '../../components/FilterBar';
import { safeFileName } from '../../lib/files';
import type { Proposal } from '../../db/types';

const STATUS_TONE = { won: 'good', sent: 'yellow', lost: 'bad', draft: undefined } as const;

export function QuotesTab() {
  const [params, setParams] = useSearchParams();
  const proposals = useProposals();
  const clients = useClients() ?? [];
  const rates = settingValue(useSettingRows(), 'rates');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Proposal['status']>('');
  const [period, setPeriod] = useState<Period>('');
  useEffect(() => {
    const openId = params.get('open');
    if (openId) {
      setOpen(openId);
      setParams({}, { replace: true });
      return;
    }
    const clientId = params.get('client');
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    setParams({}, { replace: true });
    newProposal({ clientId, clientName: c.name }).then((p) => setOpen(p.id));
  }, [params, clients, setParams]);
  if (!proposals) return null;
  const won = proposals.filter((p) => p.status === 'won').length;
  const decided = proposals.filter((p) => p.status === 'won' || p.status === 'lost').length;
  const needle = q.trim().toLowerCase();
  const shown = proposals.filter((p) => (!status || p.status === status) && inPeriod(p.date, period) && (!needle || `${p.number} ${p.clientName}`.toLowerCase().includes(needle)));
  return (
    <div className="stack loose">
      <PageHeader
        title="Quotes"
        subtitle={decided ? `Win rate ${Math.round((won / decided) * 100)}% (${won} of ${decided}). A won quote becomes a contract and a job in one click.` : 'Price a project from the price list, send it, then turn it into a contract and a job.'}
        actions={
          <Button
            variant="primary"
            onClick={async () => {
              const p = await newProposal();
              setOpen(p.id);
            }}
          >
            <Plus size={18} /> New quote
          </Button>
        }
      />
      {proposals.length ? (
        <FilterBar
          id="quotes"
          search={{ value: q, onChange: setQ, placeholder: 'Search quote no. or client' }}
          active={(status ? 1 : 0) + (period ? 1 : 0)}
          onClear={() => {
            setQ('');
            setStatus('');
            setPeriod('');
          }}
        >
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </Select>
          <PeriodSelect value={period} onChange={setPeriod} />
        </FilterBar>
      ) : null}
      {proposals.length === 0 ? (
        <EmptyState title="No quotes yet">Start one here, or from a client.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing matches" />
      ) : (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>No.</th>
                <th>Client</th>
                <th>Date</th>
                <th className="r">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const t = proposalTotals(p, rates);
                return (
                  <tr key={p.id} className="click" onClick={() => setOpen(p.id)}>
                    <td data-label="No." className="mono">{p.number}</td>
                    <td data-label="Client">{p.clientName || '—'}</td>
                    <td data-label="Date" className="nowrap">{fmtIsoDate(p.date)}</td>
                    <td data-label="Total" className="r num">{t.perMonth ? `${peso(t.perMonth)}/mo` : peso(t.invoice)}</td>
                    <td data-label="Status">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <QuoteDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function QuoteDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const proposals = useProposals() ?? [];
  const packages = usePackages() ?? [];
  const clients = useClients() ?? [];
  const rows = useSettingRows();
  const rates = settingValue(rows, 'rates');
  const business = settingValue(rows, 'business');
  const payMethods = settingValue(rows, 'payMethods');
  const money = settingValue(rows, 'money');
  const stored = proposals.find((p) => p.id === id) ?? null;
  const [p, setP] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState('');
  if (stored && (!p || p.id !== stored.id)) setP({ ...stored });
  if (!id && p) setP(null);
  if (!p) return null;
  const client = clients.find((c) => c.id === p.clientId);
  const audience = CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience ?? 'business';
  const t = proposalTotals(p, rates);
  const founding = p.discountPct === FOUNDING_OFFER.pct && p.discountMonths === FOUNDING_OFFER.months;
  const hasMonthly = p.items.some((i) => i.unit === 'month');

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await saveProposal(p);
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  const applyCode = () => {
    const d = DISCOUNT_CODES.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
    if (!d) {
      app.toast('That code isn’t on the list', { tone: 'bad' });
      return;
    }
    setP({ ...p, discountAmount: Math.round((t.oneTime * d.pct) / 100), discountLabel: d.label });
    app.toast(`${d.code} applied: ${d.pct}% off`, { tone: 'good' });
  };

  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      size="xwide"
      fullPhone
      title={`Quote ${p.number}`}
      footer={
        <>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!(await app.confirm({ title: 'Delete this quote?', confirmLabel: 'Delete', tone: 'danger' }))) return;
              await deleteProposal(p.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> Delete
          </Button>
          <span className="grow" />
          <Button disabled={!!busy} onClick={() => run('pdf', async () => deliverPdf(await buildQuotePdf(p, { business, rates, packages, payMethods, money }), `${safeFileName(`${p.number} ${p.clientName}`)}.pdf`))}>
            <FileDown size={16} /> PDF
          </Button>
          <Button
            disabled={!!busy || !client?.email}
            title={client?.email ? undefined : 'Add an email to the client first'}
            onClick={() =>
              run('email', async () => {
                await sendEmail(
                  { email: client?.email ?? '', name: client?.contactName || p.clientName },
                  quoteEmail(business, { clientName: client?.contactName || p.clientName, number: p.number, total: t.invoice, validUntil: p.validUntil, items: t.lines.map((l) => ({ label: l.label, amount: l.amount })), downPct: money.downPct }),
                  { what: `quote ${p.number}` },
                );
                setP({ ...p, status: p.status === 'draft' ? 'sent' : p.status });
                await saveProposal({ ...p, status: p.status === 'draft' ? 'sent' : p.status });
                app.toast(`Quote emailed to ${client?.email}`, { tone: 'good' });
              })
            }
          >
            <Mail size={16} /> Email
          </Button>
          <Button
            disabled={!!busy || !p.items.length}
            onClick={() =>
              run('contract', async () => {
                onClose();
                navigate(`/docs/contracts?proposal=${p.id}${p.clientId ? `&client=${p.clientId}` : ''}`);
              })
            }
          >
            <FileSignature size={16} /> Make the contract
          </Button>
          <Button
            variant="primary"
            disabled={!!busy || !p.items.length}
            onClick={() =>
              run('job', async () => {
                const job = await jobFromQuote(p.id);
                app.toast(`${job.number} is on the job board`, { tone: 'good', action: { label: 'Open', onClick: () => navigate(`/jobs?job=${job.id}`) } });
                onClose();
              })
            }
          >
            <Briefcase size={16} /> {p.jobId ? 'Open the job' : 'Make the job'}
          </Button>
        </>
      }
    >
      <div className="editor-grid">
        <div className="stack">
          <div className="form-grid">
            <Field label="Client" htmlFor="qt-client" hint={client ? `${CLIENT_KINDS.find((k) => k.key === client.kind)?.label ?? 'Business'} · ${audience === 'student' ? 'student' : 'business'} prices` : undefined}>
              <Select id="qt-client" value={p.clientId ?? ''} onChange={(e) => setP({ ...p, clientId: e.target.value || null, clientName: clients.find((c) => c.id === e.target.value)?.name ?? p.clientName })}>
                <option value="">Not in the client list</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name on the quote" htmlFor="qt-name">
              <TextInput id="qt-name" value={p.clientName} onChange={(e) => setP({ ...p, clientName: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor="qt-date">
              <input id="qt-date" type="date" className="input" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value, validUntil: addDays(e.target.value, money.invoiceDays || 15) })} />
            </Field>
            <Field label="Status" htmlFor="qt-status">
              <Select id="qt-status" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as Proposal['status'] })}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </Select>
            </Field>
          </div>
          <Field label="Opening message" htmlFor="qt-intro" hint="Two or three sentences: what they asked for and what you recommend.">
            <TextArea id="qt-intro" rows={3} value={p.intro} onChange={(e) => setP({ ...p, intro: e.target.value })} />
          </Field>
          <section className="stack tight">
            <h3>Items</h3>
            <PriceLinesEditor items={p.items} onChange={(items) => setP({ ...p, items })} audience={audience} />
          </section>
          <section className="stack tight">
            <h3>Discounts</h3>
            <div className="row wrap">
              <TextInput aria-label="Discount code" placeholder="Code, e.g. REPYOURORG15" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 240 }} />
              <Button size="sm" onClick={applyCode} disabled={!code.trim()}>
                Apply code
              </Button>
            </div>
            <div className="form-grid">
              <Field label="Discount label" htmlFor="qt-dl">
                <TextInput id="qt-dl" value={p.discountLabel} onChange={(e) => setP({ ...p, discountLabel: e.target.value })} />
              </Field>
              <Field label="Discount on the one-off work" htmlFor="qt-da">
                <MoneyInput id="qt-da" value={p.discountAmount ?? 0} onChange={(v) => setP({ ...p, discountAmount: v ?? 0 })} />
              </Field>
            </div>
            {hasMonthly ? (
              <Toggle
                id="qt-found"
                checked={founding}
                onChange={(v) => setP({ ...p, discountPct: v ? FOUNDING_OFFER.pct : 0, discountMonths: v ? FOUNDING_OFFER.months : 0, discountLabel: v ? `Founding client: ${FOUNDING_OFFER.pct}% off the first ${FOUNDING_OFFER.months} months` : p.discountLabel })}
                label={`Founding SMM client (${FOUNDING_OFFER.pct}% off the first ${FOUNDING_OFFER.months} months)`}
              />
            ) : null}
            <div className="row wrap">
              <Toggle id="qt-vat" checked={p.vat} onChange={(v) => setP({ ...p, vat: v })} label={`Add ${rates.vatPct}% VAT (only if VAT-registered)`} />
              <Toggle id="qt-ewt" checked={p.ewt} onChange={(v) => setP({ ...p, ewt: v })} label={`Client withholds ${rates.ewtPct}%`} />
            </div>
          </section>
          <Field label="Notes on the quote" htmlFor="qt-notes">
            <TextArea id="qt-notes" rows={2} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
          </Field>
        </div>
        <aside className="side-panel">
          <div className="card">
            <span className="eyebrow">Total</span>
            <div className="waterfall">
              {t.perMonth ? (
                <div className="wf-row sub">
                  <span>Monthly</span>
                  <span className="v">{peso(t.perMonth)}</span>
                </div>
              ) : null}
              <div className="wf-row">
                <span>Subtotal</span>
                <span className="v">{peso(t.gross)}</span>
              </div>
              {t.discount ? (
                <div className="wf-row sub">
                  <span>Discount</span>
                  <span className="v">−{peso(t.discount)}</span>
                </div>
              ) : null}
              {t.vat ? (
                <div className="wf-row sub">
                  <span>VAT</span>
                  <span className="v">{peso(t.vat)}</span>
                </div>
              ) : null}
              <div className="wf-row final">
                <span>Total</span>
                <span className="v">{peso(t.invoice)}</span>
              </div>
              <div className="wf-row sub">
                <span>{money.downPct}% to start</span>
                <span className="v">{peso(Math.round((t.invoice * money.downPct) / 100))}</span>
              </div>
            </div>
          </div>
          <p className="tiny muted">Valid until {fmtIsoDate(p.validUntil)}. Prices come from Documents → Price list.</p>
        </aside>
      </div>
    </Dialog>
  );
}

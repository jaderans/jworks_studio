import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Briefcase, FileDown, Mail, Plus, ReceiptText, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { alive, db } from '../../db/db';
import { Badge, Button, Callout, EmptyState, IconButton, PageHeader, Segmented, Toggle } from '../../components/ui';
import { Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { QuestionnaireForm } from '../../components/QuestionnaireForm';
import { Dialog } from '../../components/Dialog';
import { PriceLinesEditor, TotalsCard } from '../../components/PriceLines';
import { useClients, useContracts, useContractTemplates, useJobs, usePackages, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { CONTRACT_FIELD_GROUPS } from '../../domain/contractTemplates';
import { completionDate, contractAudience, deliverablesOf, planMilestones, projectDays } from '../../domain/contractPlan';
import { CLIENT_KINDS } from '../../domain/clients';
import { docTotals } from '../../domain/pricing';
import { deleteContract, saveContract } from '../../services/clients';
import { jobFromContract, newTemplateContract, suggestTemplate } from '../../services/documents';
import { invoiceForJob } from '../../services/money';
import { buildTemplateContractPdf } from '../../reports/studioDocs';
import { deliverPdf, renderPdf } from '../../reports/pdf';
import { contractEmail } from '../../email/templates';
import { sendEmail } from '../../email/send';
import { peso } from '../../lib/money';
import { fmtIsoDate, inPeriod, todayISO, type Period } from '../../lib/time';
import { FilterBar, PeriodSelect } from '../../components/FilterBar';
import { safeFileName } from '../../lib/files';
import { ContractEditor } from '../contracts/ContractsPage';
import { InvoiceDialog } from '../money/InvoiceDialog';
import type { Contract, ContractSection, Milestone, ProposalItem, StudioPayMethod } from '../../db/types';

const RUSH_LABEL = 'Rush (3–5 day turnaround)';

const sameTerms = (a: ContractSection[], b: ContractSection[]) => JSON.stringify(a.map((s) => [s.id, s.title, s.body, s.on])) === JSON.stringify(b.map((s) => [s.id, s.title, s.body, s.on]));

export function ContractsTab() {
  const [params, setParams] = useSearchParams();
  const contracts = useContracts();
  const clients = useClients() ?? [];
  const templates = useContractTemplates() ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ clientId: string | null; jobId: string | null; proposalId: string | null } | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Contract['status']>('');
  const [kind, setKind] = useState('');
  const [period, setPeriod] = useState<Period>('');
  useEffect(() => {
    const jobId = params.get('job');
    const proposalId = params.get('proposal');
    const clientId = params.get('client');
    const openId = params.get('open');
    if (openId) {
      setOpen(openId);
      setParams({}, { replace: true });
    } else if (jobId || proposalId || clientId) {
      setPicking({ jobId, proposalId, clientId });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  if (!contracts) return null;
  const clientName = (c: Contract) => c.fields['client.name'] || clients.find((x) => x.id === c.clientId)?.name || '—';
  const openOne = contracts.find((c) => c.id === open);
  const dateOf = (c: Contract) => c.fields.date || new Date(c.createdAt).toISOString().slice(0, 10);
  const kinds = [...new Set(templates.map((t) => t.name))];
  const needle = q.trim().toLowerCase();
  const shown = contracts.filter(
    (c) =>
      (!status || c.status === status) &&
      (!kind || (c.title || templates.find((t) => t.id === c.templateId)?.name) === kind) &&
      inPeriod(dateOf(c), period) &&
      (!needle || `${c.number} ${c.title ?? ''} ${clientName(c)}`.toLowerCase().includes(needle)),
  );
  return (
    <div className="stack loose">
      <PageHeader
        title="Contracts"
        subtitle="The JoshWorks v1.0 contract set, filled in for each client and printed on the matching letterhead."
        actions={
          <Button variant="primary" onClick={() => setPicking({ clientId: null, jobId: null, proposalId: null })}>
            <Plus size={18} /> New contract
          </Button>
        }
      />
      {contracts.length ? (
        <FilterBar
          id="contracts"
          search={{ value: q, onChange: setQ, placeholder: 'Search contract no., client or title' }}
          active={(status ? 1 : 0) + (kind ? 1 : 0) + (period ? 1 : 0)}
          onClear={() => {
            setQ('');
            setStatus('');
            setKind('');
            setPeriod('');
          }}
        >
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="ended">Ended</option>
          </Select>
          <Select aria-label="Contract type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Every contract type</option>
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
          <PeriodSelect value={period} onChange={setPeriod} />
        </FilterBar>
      ) : null}
      {contracts.length === 0 ? (
        <EmptyState title="No contracts yet">Make one here, from a won quote, or from a job.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing matches" />
      ) : (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>No.</th>
                <th>Contract</th>
                <th>Client</th>
                <th>Date</th>
                <th className="r">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="click" onClick={() => setOpen(c.id)}>
                  <td data-label="No." className="mono">{c.number}</td>
                  <td data-label="Contract">{c.title || 'SMM agreement (first version)'}</td>
                  <td data-label="Client">{clientName(c)}</td>
                  <td data-label="Date" className="nowrap">{fmtIsoDate(new Date(c.createdAt).toISOString().slice(0, 10))}</td>
                  <td data-label="Total" className="r num">{c.items ? peso(docTotals(c.items, c.discountAmount ?? 0).net) : c.fields.fee || '—'}</td>
                  <td data-label="Status">
                    <Badge tone={c.status === 'signed' ? 'good' : c.status === 'sent' ? 'yellow' : undefined}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TemplatePicker value={picking} onClose={() => setPicking(null)} onMade={(id) => setOpen(id)} />
      {openOne && !openOne.templateId ? <ContractEditor id={open} onClose={() => setOpen(null)} /> : <TemplateContractEditor id={openOne?.templateId ? open : null} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TemplatePicker({ value, onClose, onMade }: { value: { clientId: string | null; jobId: string | null; proposalId: string | null } | null; onClose: () => void; onMade: (id: string) => void }) {
  const app = useApp();
  const templates = (useContractTemplates() ?? []).filter((t) => t.active === 1);
  const clients = useClients() ?? [];
  const jobs = useJobs() ?? [];
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [tplId, setTplId] = useState('');
  const [initFor, setInitFor] = useState<typeof value>(null);
  if (value && value !== initFor) {
    const job = jobs.find((j) => j.id === value.jobId);
    const cid = value.clientId ?? job?.clientId ?? '';
    const client = clients.find((c) => c.id === cid);
    const student = CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience === 'student';
    setClientId(cid);
    setJobId(value.jobId ?? '');
    setTplId(suggestTemplate(templates, { jobType: job?.type, student })?.id ?? '');
    setInitFor(value);
  }
  if (!value && initFor) setInitFor(null);
  if (!value) return null;
  if (!templates.length)
    return (
      <Dialog open onClose={onClose} title="New contract">
        <Callout tone="info" title="No contract templates yet">
          Load the price list and contract templates first: Documents → Price list → Load the current price list.
        </Callout>
      </Dialog>
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title="New contract"
      size="wide"
      fullPhone
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!tplId}
            onClick={async () => {
              try {
                const c = await newTemplateContract({ templateId: tplId, clientId: clientId || null, jobId: jobId || null, proposalId: value.proposalId });
                onClose();
                onMade(c.id);
              } catch (e) {
                app.toast(e instanceof Error ? e.message : 'Could not make the contract', { tone: 'bad' });
              }
            }}
          >
            Make the contract
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Client" htmlFor="tp-client">
          <Select id="tp-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client yet</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="For a job (optional)" htmlFor="tp-job" hint="Its price lines, dates and rush come along.">
          <Select id="tp-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No job yet</option>
            {jobs
              .filter((j) => !clientId || j.clientId === clientId)
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.number} · {j.title}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <span className="eyebrow">Contract</span>
      <div className="template-grid" role="radiogroup" aria-label="Contract template">
        {templates.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={tplId === t.id} className={`template-card ${tplId === t.id ? 'on' : ''}`} onClick={() => setTplId(t.id)}>
            <b>{t.name}</b>
            <span className="tiny strong teal">{t.subtitle}</span>
            <span className="small muted">{t.tagline}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

type Part = 'details' | 'price' | 'schedule' | 'brief' | 'terms';

/** The payment method choices: the studio's methods from Settings, then cash and "any". */
function payChoices(methods: StudioPayMethod[], current: string): string[] {
  const list = [...methods.filter((m) => m.on).map((m) => m.label), 'Cash', 'Any of the above'];
  return current && !list.includes(current) ? [current, ...list] : list;
}

function TemplateContractEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const contracts = useContracts() ?? [];
  const templates = useContractTemplates() ?? [];
  const packages = usePackages() ?? [];
  const clients = useClients() ?? [];
  const jobs = useJobs() ?? [];
  const rows = useSettingRows();
  const business = settingValue(rows, 'business');
  const payMethods = settingValue(rows, 'payMethods');
  const stored = contracts.find((c) => c.id === id) ?? null;
  const [c, setC] = useState<Contract | null>(null);
  const [part, setPart] = useState<Part>('details');
  const [busy, setBusy] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  if (stored && (!c || c.id !== stored.id)) {
    setC({ ...stored });
    setPart('details');
  }
  if (!id && c) setC(null);
  const payments = useLiveQuery(async () => (c?.jobId ? alive(await db.payments.where('jobId').equals(c.jobId).toArray()) : []), [c?.jobId]) ?? [];
  if (!id || !c) return null;
  const tpl = templates.find((t) => t.id === c.templateId);
  if (!tpl) return null;
  const client = clients.find((x) => x.id === c.clientId);
  const clientAudience = CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience ?? 'business';
  const audience = contractAudience(c.fields.rates, tpl.audience, clientAudience);
  const items = c.items ?? [];
  const totals = docTotals(items, c.discountAmount ?? 0);
  const down = Math.round((totals.net * (c.downPct ?? 50)) / 100);
  const setF = (key: string, v: string) => {
    const fields = { ...c.fields, [key]: v };
    // A start date with no finish yet: finish when the package turnaround says.
    if (key === 'startDate' && v && !c.fields.endDate) fields.endDate = completionDate(v, items, packages, c.rush);
    setC({ ...c, fields });
  };
  const replan = () => {
    const start = c.fields.startDate || todayISO();
    const end = completionDate(start, items, packages, c.rush) || c.fields.endDate;
    setC({ ...c, fields: { ...c.fields, startDate: start, endDate: end }, milestones: planMilestones(tpl.phases, start, end) });
  };
  const milestones = c.milestones ?? planMilestones(tpl.phases, c.fields.startDate ?? '', c.fields.endDate ?? '');
  const setMilestones = (m: Milestone[]) => setC({ ...c, milestones: m });
  const setRush = (on: boolean) => {
    const rest = items.filter((i) => i.label !== RUSH_LABEL);
    const line: ProposalItem = { packageId: 'cat-add-ons-rush-3-5-day-turnaround', label: RUSH_LABEL, qty: 1, unitPrice: 2500, unit: 'percent', months: 1 };
    setC({ ...c, rush: on, items: on ? [...rest, line] : rest });
  };

  const contractPdf = () => buildTemplateContractPdf(c, tpl, { business, packages, payMethods, payments, audience, jobNumber: jobs.find((j) => j.id === c.jobId)?.number });
  const pdfName = `${safeFileName(`${c.number} ${c.fields['client.name'] || ''} ${tpl.name}`)}.pdf`;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await saveContract(c);
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dialog
        open={!!id}
        onClose={onClose}
        size="xwide"
        fullPhone
        title={
          <span className="row wrap" style={{ gap: 8 }}>
            <span className="mono muted">{c.number}</span> {c.title || tpl.name}
            <Badge tone="teal">{c.subtitle || tpl.subtitle}</Badge>
          </span>
        }
        footer={
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!(await app.confirm({ title: `Delete ${c.number}?`, confirmLabel: 'Delete', tone: 'danger' }))) return;
                await deleteContract(c.id);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <span className="grow" />
            <Button disabled={!!busy} onClick={() => run('pdf', async () => deliverPdf(await contractPdf(), pdfName))}>
              <FileDown size={16} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
            </Button>
            <Button
              disabled={!!busy || !(c.fields['client.email'] || client?.email)}
              title={c.fields['client.email'] || client?.email ? undefined : 'Add the client’s email first'}
              onClick={() =>
                run('email', async () => {
                  const to = c.fields['client.email'] || client?.email || '';
                  await sendEmail({ email: to, name: c.fields['client.contact'] }, contractEmail(business, { clientName: c.fields['client.contact'] || c.fields['client.name'], number: c.number, title: c.title || tpl.name, total: totals.net, down }, payMethods), { what: `contract ${c.number}`, attachments: [{ name: pdfName, blob: await renderPdf(await contractPdf()) }] });
                  if (c.status === 'draft') await saveContract({ ...c, status: 'sent' });
                  app.toast(`Contract emailed to ${to}`, { tone: 'good' });
                })
              }
            >
              <Mail size={16} /> Email
            </Button>
            <Button
              disabled={!!busy || !items.length}
              onClick={() =>
                run('invoice', async () => {
                  const job = await jobFromContract(c.id);
                  const inv = await invoiceForJob(job.id);
                  setInvoiceId(inv.id);
                })
              }
            >
              <ReceiptText size={16} /> Invoice
            </Button>
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                run('job', async () => {
                  if (items.length) {
                    const job = await jobFromContract(c.id);
                    app.toast(`${job.number} is on the job board with this contract’s price`, { tone: 'good', action: { label: 'Open', onClick: () => navigate(`/jobs?job=${job.id}`) } });
                  } else app.toast('Saved', { tone: 'good' });
                  onClose();
                })
              }
            >
              <Briefcase size={16} /> {c.jobId ? 'Save' : 'Save & make the job'}
            </Button>
          </>
        }
      >
        <div className="row wrap between">
          <Segmented<Part>
            label="Part"
            value={part}
            onChange={setPart}
            options={[
              { value: 'details', label: 'Client & dates' },
              { value: 'price', label: 'Package & price' },
              { value: 'schedule', label: 'Schedule' },
              { value: 'brief', label: tpl.briefTitle || 'Questionnaire' },
              { value: 'terms', label: 'Terms' },
            ]}
          />
          <label className="row small strong" style={{ gap: 8 }}>
            Status
            <Select aria-label="Status" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as Contract['status'] })} style={{ width: 'auto' }}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="ended">Ended</option>
            </Select>
          </label>
        </div>

        {part === 'details' ? (
          <div className="stack loose">
            {CONTRACT_FIELD_GROUPS.map((g) => (
              <section key={g.title} className="stack tight">
                <span className="eyebrow">{g.title}</span>
                <div className="form-grid">
                  {g.fields
                    .filter((f) => !f.business || audience === 'business')
                    .map((f) => (
                      <Field key={f.key} label={f.label} htmlFor={`ct-${f.key}`} hint={f.hint} className={f.kind === 'long' ? 'span-2' : ''}>
                        {f.kind === 'date' ? (
                          <input id={`ct-${f.key}`} type="date" className="input" value={c.fields[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)} />
                        ) : f.kind === 'payment' ? (
                          <Select id={`ct-${f.key}`} value={c.fields[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)}>
                            <option value="">Choose a payment method</option>
                            {payChoices(payMethods, c.fields[f.key] ?? '').map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </Select>
                        ) : (
                          <TextInput id={`ct-${f.key}`} value={c.fields[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)} />
                        )}
                      </Field>
                    ))}
                </div>
              </section>
            ))}
            <section className="stack tight">
              <span className="eyebrow">Printing</span>
              <div className="form-grid">
                <Field label="Rates" htmlFor="ct-rates" hint="Which prices the package list shows. Not printed.">
                  <Select id="ct-rates" value={c.fields.rates ?? ''} onChange={(e) => setF('rates', e.target.value)}>
                    <option value="">{tpl.audience === 'any' ? `By client (${clientAudience === 'student' ? 'student' : 'business'})` : `Template (${tpl.audience})`}</option>
                    <option value="business">Business prices</option>
                    <option value="student">Student prices</option>
                  </Select>
                </Field>
                <Field label="Letterhead" htmlFor="ct-frame" hint="The brand-kit frame the PDF is printed on.">
                  <Select id="ct-frame" value={c.frame ?? tpl.frame} onChange={(e) => setC({ ...c, frame: e.target.value as Contract['frame'] })}>
                    <option value="general">Commission contract</option>
                    <option value="logo">Logo and branding</option>
                    <option value="merch">Merchandise design</option>
                    <option value="web">Web design</option>
                  </Select>
                </Field>
                <div className="field span-2">
                  <Toggle id="ct-sig" checked={c.useSignature !== false} onChange={(v) => setC({ ...c, useSignature: v })} label="Sign with my saved signature" />
                  <span className="hint">
                    {business.signature ? 'Your signature prints above the “Signing for JoshWorks” line.' : 'No signature saved yet: add it in Settings → Business.'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {part === 'schedule' ? (
          <div className="stack loose">
            <section className="stack tight">
              <span className="eyebrow">Deliverables</span>
              {deliverablesOf(items, packages).length ? (
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {deliverablesOf(items, packages).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Pick a package under Package & price; what it includes is listed here and on the contract.</p>
              )}
            </section>
            <section className="stack tight">
              <div className="row wrap between">
                <span className="eyebrow">Milestones</span>
                <Button size="sm" variant="ghost" onClick={replan}>
                  <RotateCcw size={15} /> Fill from the package and dates
                </Button>
              </div>
              <p className="tiny muted">
                {c.fields.startDate ? `Start ${fmtIsoDate(c.fields.startDate)}` : 'No start date yet'} · {c.fields.endDate ? `finish ${fmtIsoDate(c.fields.endDate)}` : 'no finish date yet'}
                {projectDays(items, packages, c.rush) ? ` · package turnaround ${projectDays(items, packages, c.rush)} days` : ''}
              </p>
              {milestones.map((m, i) => (
                <div key={i} className="milestone-row">
                  <TextInput aria-label={`Milestone ${i + 1}`} value={m.title} onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <input aria-label={`Milestone ${i + 1} date`} type="date" className="input" value={m.date} onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  <TextInput aria-label={`What the client receives at milestone ${i + 1}`} placeholder="What the client receives" value={m.what} onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)))} />
                  <IconButton label={`Remove milestone ${i + 1}`} size="sm" plain onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
              <div>
                <Button size="sm" variant="ghost" onClick={() => setMilestones([...milestones, { title: '', date: '', what: '' }])}>
                  <Plus size={15} /> Add a milestone
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        {part === 'price' ? (
          <div className="editor-grid">
            <div className="stack">
              <PriceLinesEditor items={items} onChange={(next) => setC({ ...c, items: next, rush: next.some((i) => i.label === RUSH_LABEL) })} audience={audience} categories={tpl.categories} />
              <div className="form-grid">
                <Field label="Discount" htmlFor="ct-disc">
                  <MoneyInput id="ct-disc" value={c.discountAmount ?? 0} onChange={(v) => setC({ ...c, discountAmount: v ?? 0 })} />
                </Field>
                <Field label="Due on signing" htmlFor="ct-down">
                  <NumberInput id="ct-down" suffix="%" value={c.downPct ?? 50} onChange={(v) => setC({ ...c, downPct: v ?? 50 })} />
                </Field>
              </div>
              <Toggle id="ct-rush" checked={!!c.rush} onChange={setRush} label="Rush service requested (+25% of the package price)" />
            </div>
            <aside className="side-panel">
              <div className="card">
                <span className="eyebrow">Total project cost</span>
                <TotalsCard items={items} discountAmount={c.discountAmount ?? 0} downPct={c.downPct ?? 50} />
              </div>
            </aside>
          </div>
        ) : null}

        {part === 'brief' ? (
          <div className="stack">
            <p className="tiny muted">Fill in what the client already told you. Anything left empty prints as lines and tick boxes they fill in by hand.</p>
            <QuestionnaireForm lines={tpl.brief} answers={c.brief} onChange={(brief) => setC({ ...c, brief })} idPrefix="ct-q" />
          </div>
        ) : null}

        {part === 'terms' ? (
          <div className="stack">
            {!sameTerms(c.sections, tpl.sections) ? (
              <Callout tone="info">This contract has its own copy of the terms, different from the template’s current ones (for example, made before the October 2026 terms). Press Reset to the template to use the current terms.</Callout>
            ) : null}
            <div className="row between wrap">
              <p className="muted small">The standard terms. Untick a section to leave it out, or edit its points (one per line).</p>
              <Button size="sm" variant="ghost" onClick={() => setC({ ...c, sections: tpl.sections.map((s) => ({ ...s })) })}>
                <RotateCcw size={15} /> Reset to the template
              </Button>
            </div>
            {c.sections.map((s, i) => (
              <section key={s.id} className="card stack tight">
                <Toggle id={`ct-sec-${s.id}`} checked={s.on} onChange={(v) => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, on: v } : x)) })} label={`${i + 1}. ${s.title}`} />
                {s.on ? <TextArea aria-label={s.title} rows={Math.min(8, s.body.split('\n').length + 1)} value={s.body} onChange={(e) => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} /> : null}
              </section>
            ))}
          </div>
        ) : null}
      </Dialog>
      <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId(null)} />
    </>
  );
}

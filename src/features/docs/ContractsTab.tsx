import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Briefcase, FileDown, Mail, Plus, ReceiptText, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { alive, db } from '../../db/db';
import { Badge, Button, Callout, EmptyState, PageHeader, Segmented, Toggle } from '../../components/ui';
import { Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { PriceLinesEditor, TotalsCard } from '../../components/PriceLines';
import { useClients, useContracts, useContractTemplates, useJobs, usePackages, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { CLIENT_FIELDS } from '../../domain/contractTemplates';
import { CLIENT_KINDS } from '../../domain/clients';
import { docTotals } from '../../domain/pricing';
import { deleteContract, saveContract } from '../../services/clients';
import { jobFromContract, newTemplateContract, suggestTemplate } from '../../services/documents';
import { invoiceForJob } from '../../services/money';
import { buildTemplateContractPdf } from '../../reports/studioDocs';
import { deliverPdf } from '../../reports/pdf';
import { contractEmail } from '../../email/templates';
import { sendEmail } from '../../email/send';
import { peso } from '../../lib/money';
import { fmtIsoDate } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import { ContractEditor } from '../contracts/ContractsPage';
import { InvoiceDialog } from '../money/InvoiceDialog';
import type { Contract, ProposalItem } from '../../db/types';

const RUSH_LABEL = 'Rush (3–5 day turnaround)';

export function ContractsTab() {
  const [params, setParams] = useSearchParams();
  const contracts = useContracts();
  const clients = useClients() ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ clientId: string | null; jobId: string | null; proposalId: string | null } | null>(null);
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
      {contracts.length === 0 ? (
        <EmptyState title="No contracts yet">Make one here, from a won quote, or from a job.</EmptyState>
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
              {contracts.map((c) => (
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

type Part = 'details' | 'price' | 'brief' | 'terms';

function TemplateContractEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const contracts = useContracts() ?? [];
  const templates = useContractTemplates() ?? [];
  const packages = usePackages() ?? [];
  const clients = useClients() ?? [];
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
  const audience = /student/i.test(c.subtitle ?? tpl.subtitle) || CLIENT_KINDS.find((k) => k.key === client?.kind)?.audience === 'student' ? 'student' : 'business';
  const items = c.items ?? [];
  const totals = docTotals(items, c.discountAmount ?? 0);
  const down = Math.round((totals.net * (c.downPct ?? 50)) / 100);
  const setF = (key: string, v: string) => setC({ ...c, fields: { ...c.fields, [key]: v } });
  const setRush = (on: boolean) => {
    const rest = items.filter((i) => i.label !== RUSH_LABEL);
    const line: ProposalItem = { packageId: 'cat-add-ons-rush-3-5-day-turnaround', label: RUSH_LABEL, qty: 1, unitPrice: 2500, unit: 'percent', months: 1 };
    setC({ ...c, rush: on, items: on ? [...rest, line] : rest });
  };

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
            <Button disabled={!!busy} onClick={() => run('pdf', async () => deliverPdf(await buildTemplateContractPdf(c, tpl, { business, packages, payMethods, payments }), `${safeFileName(`${c.number} ${c.fields['client.name'] || ''} ${tpl.name}`)}.pdf`))}>
              <FileDown size={16} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
            </Button>
            <Button
              disabled={!!busy || !(c.fields['client.email'] || client?.email)}
              title={c.fields['client.email'] || client?.email ? undefined : 'Add the client’s email first'}
              onClick={() =>
                run('email', async () => {
                  const to = c.fields['client.email'] || client?.email || '';
                  await sendEmail({ email: to, name: c.fields['client.contact'] }, contractEmail(business, { clientName: c.fields['client.contact'] || c.fields['client.name'], number: c.number, title: c.title || tpl.name, total: totals.net, down }), { what: `contract ${c.number}` });
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
              { value: 'brief', label: tpl.briefTitle || 'Brief' },
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
          <div className="form-grid">
            {CLIENT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`ct-${f.key}`}>
                {['date', 'startDate', 'endDate'].includes(f.key) ? (
                  <input id={`ct-${f.key}`} type="date" className="input" value={c.fields[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)} />
                ) : (
                  <TextInput id={`ct-${f.key}`} value={c.fields[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)} />
                )}
              </Field>
            ))}
            <Field label="Pricing tier line" htmlFor="ct-tier">
              <TextInput id="ct-tier" value={c.subtitle ?? ''} onChange={(e) => setC({ ...c, subtitle: e.target.value })} />
            </Field>
            <Field label="Letterhead" htmlFor="ct-frame" hint="The brand-kit frame the PDF is printed on.">
              <Select id="ct-frame" value={c.frame ?? tpl.frame} onChange={(e) => setC({ ...c, frame: e.target.value as Contract['frame'] })}>
                <option value="general">Commission contract</option>
                <option value="logo">Logo and branding</option>
                <option value="merch">Merchandise design</option>
                <option value="web">Web design</option>
              </Select>
            </Field>
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
            {(c.brief ?? tpl.brief.map((q) => ({ q, a: '' }))).map((b, i) => (
              <Field key={i} label={b.q} htmlFor={`ct-brief-${i}`}>
                <TextArea id={`ct-brief-${i}`} rows={2} value={b.a} onChange={(e) => setC({ ...c, brief: (c.brief ?? tpl.brief.map((q) => ({ q, a: '' }))).map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
              </Field>
            ))}
            <p className="tiny muted">Leave answers empty to print blank boxes the client fills in by hand.</p>
          </div>
        ) : null}

        {part === 'terms' ? (
          <div className="stack">
            <div className="row between wrap">
              <p className="muted small">The standard terms 1–10. Untick a section to leave it out, or edit its points (one per line).</p>
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

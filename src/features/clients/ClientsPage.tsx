import { useMemo, useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Briefcase, CalendarDays, FileDown, FileSignature, FileText, Inbox, Loader2, Megaphone, Plus, Repeat, ShieldAlert, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, PageHeader, Segmented, Stat } from '../../components/ui';
import { Check, Field, SearchInput, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { StatusBadge } from '../../components/people';
import { useClients, useContracts, useInvoices, useJobMoney, useJobs, useMetrics, usePackages, usePayments, usePosts, useProposals, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { CLIENT_KINDS, CLIENT_KIND_LABEL, MONTHLY_CYCLE, PIPELINE, PIPELINE_BOARD, SOURCES, normalizeStage, stageLabel, stageProgress } from '../../domain/clients';
import { JOB_STATUS_LABEL, isOpen } from '../../domain/jobs';
import { invoiceTotals } from '../../domain/money';
import { PLATFORMS, PLATFORM_ORDER } from '../../domain/platforms';
import { blankClient, deleteClient, saveClient, setClientStage, toggleClientCheck } from '../../services/clients';
import { getApiKey, streamChat } from '../../ai/claude';
import { openInClaude, webPrompt } from '../../ai/claudeWeb';
import { RECIPES, buildContext, buildSystemPrompt } from '../../ai/prompts';
import { buildApprovalPdf, buildReportPdf } from '../../reports/docs';
import { deliverPdf } from '../../reports/pdf';
import { peso, type Cents } from '../../lib/money';
import { fmtIsoDate, fmtIsoWeekday, fmtMonth, todayISO } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import { invoiceBadge } from '../money/InvoiceDialog';
import type { Client, ClientKind, ClientStage, Persona, PlatformKey } from '../../db/types';

interface ClientStats {
  jobs: number;
  open: number;
  paid: Cents;
  lastJob: string;
}

/** Jobs and money per client, for the list and the history tab. */
function useClientStats(): Map<string, ClientStats> {
  const jobs = useJobs();
  const payments = usePayments();
  return useMemo(() => {
    const out = new Map<string, ClientStats>();
    const get = (id: string) => {
      let s = out.get(id);
      if (!s) out.set(id, (s = { jobs: 0, open: 0, paid: 0, lastJob: '' }));
      return s;
    };
    const clientOfJob = new Map<string, string>();
    for (const j of jobs ?? []) {
      if (!j.clientId || j.status === 'cancelled') continue;
      clientOfJob.set(j.id, j.clientId);
      const s = get(j.clientId);
      if (j.status !== 'inquiry') s.jobs += 1;
      if (isOpen(j)) s.open += 1;
      const d = j.startDate || j.dueDate;
      if (d > s.lastJob) s.lastJob = d;
    }
    for (const p of payments ?? []) {
      const id = p.clientId || (p.jobId ? clientOfJob.get(p.jobId) : undefined);
      if (id) get(id).paid += p.amount;
    }
    return out;
  }, [jobs, payments]);
}

const EMPTY_STATS: ClientStats = { jobs: 0, open: 0, paid: 0, lastJob: '' };

export default function ClientsPage() {
  const app = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const clients = useClients();
  const stats = useClientStats();
  const [view, setView] = useState<'pipeline' | 'all'>('pipeline');
  const [kind, setKind] = useState<ClientKind | ''>('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(() => params.get('id'));
  const [creating, setCreating] = useState(() => params.get('new') === '1');
  const money = app.can('money');

  const onDrop = async (e: DragEvent, stage: ClientStage) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drop');
    const id = e.dataTransfer.getData('text/client-id');
    if (id) await setClientStage(id, stage);
  };

  if (!clients) return null;
  const needle = q.trim().toLowerCase();
  const shown = clients.filter(
    (c) => (!kind || (c.kind ?? 'business') === kind) && (!needle || `${c.name} ${c.contactName} ${c.industry} ${c.email} ${c.phone}`.toLowerCase().includes(needle)),
  );
  const repeat = (id: string) => (stats.get(id)?.jobs ?? 0) >= 2;
  return (
    <div className="page wide">
      <PageHeader
        title="Clients"
        subtitle="Businesses, student orgs, schools, individuals and LGUs. Inquiry → quoted → booked → active → completed."
        actions={
          <>
            <Button onClick={() => navigate('/jobs?new=inquiry')}>
              <Inbox size={18} /> New inquiry
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> Add a client
            </Button>
          </>
        }
      />
      <div className="filters">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'pipeline', label: 'Pipeline' },
            { value: 'all', label: 'All clients' },
          ]}
        />
        <Select aria-label="Kind of client" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as ClientKind | '')}>
          <option value="">Every kind</option>
          {CLIENT_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </Select>
        <SearchInput value={q} onChange={setQ} placeholder="Find a client" />
      </div>
      {clients.length === 0 ? (
        <EmptyState icon={<Briefcase size={40} />} title="No clients yet" action={<Button variant="primary" onClick={() => setCreating(true)}>Add your first client</Button>}>
          Add people as soon as they message. The pipeline keeps every next step in view.
        </EmptyState>
      ) : view === 'pipeline' ? (
        <div className="pipeline">
          {PIPELINE_BOARD.map((stage) => {
            const list = shown.filter((c) => normalizeStage(c.stage) === stage);
            return (
              <section
                key={stage}
                className="bcol"
                aria-label={stageLabel(stage)}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('text/client-id')) {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).classList.add('drop');
                  }
                }}
                onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove('drop')}
                onDrop={(e) => void onDrop(e, stage)}
              >
                <div className="bcol-head">
                  {stageLabel(stage)}
                  <span className="count">{list.length}</span>
                </div>
                {list.map((c) => {
                  const prog = stageProgress(c.stage, c.checklist);
                  const s = stats.get(c.id) ?? EMPTY_STATS;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="pcard"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/client-id', c.id)}
                      onClick={() => setOpenId(c.id)}
                    >
                      <span className="title">{c.name}</span>
                      <span className="meta">
                        <span>{CLIENT_KIND_LABEL[c.kind ?? 'business']}</span>
                        {repeat(c.id) ? (
                          <Badge tone="teal">
                            <Repeat size={11} /> Repeat
                          </Badge>
                        ) : null}
                        {s.open ? <Badge tone="yellow">{s.open} open</Badge> : null}
                      </span>
                      {prog.total ? (
                        <>
                          <div className="prog">
                            <span style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                          </div>
                          <span className="tiny muted">
                            {prog.done}/{prog.total} done
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table cards-on-phone">
            <thead>
              <tr>
                <th>Client</th>
                <th>Stage</th>
                <th>Contact</th>
                <th className="r">Jobs</th>
                {money ? <th className="r">Paid to date</th> : null}
                <th>Last job</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const s = stats.get(c.id) ?? EMPTY_STATS;
                const stage = normalizeStage(c.stage);
                return (
                  <tr key={c.id} className="click" onClick={() => setOpenId(c.id)}>
                    <td data-label="Client">
                      <b>{c.name}</b> {repeat(c.id) ? <Badge tone="teal">Repeat</Badge> : null}
                      <div className="tiny muted">{[CLIENT_KIND_LABEL[c.kind ?? 'business'], c.industry].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td data-label="Stage">
                      <Badge tone={stage === 'active' ? 'good' : stage === 'lost' || stage === 'completed' ? undefined : 'teal'}>{stageLabel(stage)}</Badge>
                    </td>
                    <td data-label="Contact" className="small">
                      {[c.contactName, c.phone || c.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td data-label="Jobs" className="r num">
                      {s.jobs}
                    </td>
                    {money ? (
                      <td data-label="Paid to date" className="r num">
                        {s.paid ? peso(s.paid) : '—'}
                      </td>
                    ) : null}
                    <td data-label="Last job" className="nowrap">
                      {s.lastJob ? fmtIsoDate(s.lastJob) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <NewClientDialog
        open={creating}
        onClose={(id) => {
          setCreating(false);
          if (params.get('new')) setParams({}, { replace: true });
          if (id) setOpenId(id);
        }}
      />
      <ClientDialog
        id={openId}
        onClose={() => {
          setOpenId(null);
          if (params.get('id')) setParams({}, { replace: true });
        }}
      />
    </div>
  );
}

function SourceList() {
  return (
    <datalist id="client-sources">
      {SOURCES.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );
}

function NewClientDialog({ open, onClose }: { open: boolean; onClose: (id?: string) => void }) {
  const app = useApp();
  const empty = { name: '', kind: 'business' as ClientKind, contact: '', phone: '', email: '', source: '' };
  const [f, setF] = useState(empty);
  const set = (patch: Partial<typeof empty>) => setF({ ...f, ...patch });
  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      title="Add a client"
      footer={
        <>
          <Button onClick={() => onClose()}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!f.name.trim()}
            onClick={async () => {
              const c = await saveClient({ name: f.name.trim(), kind: f.kind, contactName: f.contact, phone: f.phone, email: f.email, source: f.source, stage: 'inquiry' });
              app.toast(`${c.name} added`, { tone: 'good' });
              setF(empty);
              onClose(c.id);
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name (business, org or person)" htmlFor="nc-name" className="span-2">
          <TextInput id="nc-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Kape Ilonggo" />
        </Field>
        <Field label="Kind" htmlFor="nc-kind" hint="Student orgs get student prices.">
          <Select id="nc-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as ClientKind })}>
            {CLIENT_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact person" htmlFor="nc-contact">
          <TextInput id="nc-contact" value={f.contact} onChange={(e) => set({ contact: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="nc-phone">
          <TextInput id="nc-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="nc-email">
          <TextInput id="nc-email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="How they found us" htmlFor="nc-src" className="span-2">
          <TextInput id="nc-src" list="client-sources" value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="Messenger, referral, booth…" />
        </Field>
      </div>
      <SourceList />
    </Dialog>
  );
}

type DTab = 'overview' | 'history' | 'checklist' | 'content' | 'report';

function ClientDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const clients = useClients() ?? [];
  const packages = (usePackages() ?? []).filter((p) => p.kind === 'smm' && p.active === 1);
  const posts = usePosts() ?? [];
  const stored = clients.find((c) => c.id === id) ?? null;
  const [tab, setTab] = useState<DTab>('overview');
  const [c, setC] = useState<Client | null>(null);
  const [dirty, setDirty] = useState(false);
  if (stored && (!c || c.id !== stored.id)) {
    setC({ ...blankClient(), ...stored, stage: normalizeStage(stored.stage) });
    setDirty(false);
    setTab('overview');
  }
  if (!id && c) setC(null);
  if (!c || !stored) return null;
  const set = <K extends keyof Client>(k: K, v: Client[K]) => {
    setC({ ...c, [k]: v });
    setDirty(true);
  };
  const setPersona = (k: keyof Persona, v: string) => set('persona', { ...c.persona, [k]: v });
  const save = async () => {
    await saveClient(c);
    setDirty(false);
    app.toast('Saved', { tone: 'good' });
  };
  // Social media tabs only for clients we post for.
  const social = !!c.packageId || posts.some((p) => p.clientId === c.id);
  const tabs: [DTab, string][] = [
    ['overview', 'Details'],
    ['history', 'History'],
    ['checklist', 'Checklist'],
    ...(social
      ? ([
          ['content', 'Posts'],
          ['report', 'Social report'],
        ] as [DTab, string][])
      : []),
  ];
  const stage = normalizeStage(c.stage);
  return (
    <Dialog
      open={!!id}
      onClose={async () => {
        if (dirty && !(await app.confirm({ title: 'Discard your changes?', confirmLabel: 'Discard', tone: 'danger' }))) return;
        onClose();
      }}
      size="xwide"
      fullPhone
      title={
        <span className="row wrap" style={{ gap: 10 }}>
          {c.name} <Badge tone={stage === 'active' ? 'good' : 'teal'}>{stageLabel(stage)}</Badge>
        </span>
      }
      footer={
        <>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!(await app.confirm({ title: `Delete ${c.name}?`, message: 'Their unposted posts are deleted too. To keep their history, set the stage to Completed or Lost instead.', confirmLabel: 'Delete', tone: 'danger' }))) return;
              try {
                await deleteClient(c.id);
                onClose();
              } catch (e) {
                app.toast(e instanceof Error ? e.message : 'Could not delete', { tone: 'bad' });
              }
            }}
          >
            <Trash2 size={16} /> Delete
          </Button>
          {app.can('assistant') ? (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/assistant?client=${c.id}&recipe=proposal`)}>
              <Bot size={16} /> Ask Claude
            </Button>
          ) : null}
          <span className="grow" />
          <Select aria-label="Stage" style={{ width: 'auto' }} value={stage} onChange={(e) => set('stage', e.target.value as ClientStage)}>
            {PIPELINE.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      <nav className="tabs" aria-label="Client sections">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <div className="stack loose">
          <div className="form-grid">
            <Field label="Name" htmlFor="cl-name">
              <TextInput id="cl-name" value={c.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Kind" htmlFor="cl-kind" hint="Student orgs get student prices on quotes.">
              <Select id="cl-kind" value={c.kind ?? 'business'} onChange={(e) => set('kind', e.target.value as ClientKind)}>
                {CLIENT_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Industry or school" htmlFor="cl-ind">
              <TextInput id="cl-ind" value={c.industry} onChange={(e) => set('industry', e.target.value)} />
            </Field>
            <Field label="Contact person" htmlFor="cl-contact">
              <TextInput id="cl-contact" value={c.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="cl-phone">
              <TextInput id="cl-phone" value={c.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label="Email" htmlFor="cl-email">
              <TextInput id="cl-email" value={c.email} onChange={(e) => set('email', e.target.value)} type="email" />
            </Field>
            <Field label="Address" htmlFor="cl-loc">
              <TextInput id="cl-loc" value={c.location} onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label="How they found us" htmlFor="cl-src">
              <TextInput id="cl-src" list="client-sources" value={c.source} onChange={(e) => set('source', e.target.value)} />
            </Field>
            <Field label="Client since" htmlFor="cl-start">
              <input id="cl-start" type="date" className="input" value={c.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Brand kit folder" htmlFor="cl-kit">
              <TextInput id="cl-kit" value={c.brandKitLink} onChange={(e) => set('brandKitLink', e.target.value)} placeholder="Google Drive link with logos, fonts, photos" />
            </Field>
          </div>
          <SourceList />
          <Field label="Notes" htmlFor="cl-notes">
            <TextArea id="cl-notes" rows={3} value={c.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <details className="card disclosure" open={!!c.packageId}>
            <summary>
              <b>Social media management</b> <span className="muted small">(only for clients whose pages we run)</span>
            </summary>
            <div className="stack loose" style={{ marginTop: 12 }}>
              <Callout tone="warn" title="Never store client passwords here">
                Ask them to add JoshWorks as a partner in Meta Business settings (Users → Partners) and TikTok Business Center (Partners → Add partner). You get access without their password, and they can remove it any time.
              </Callout>
              <div className="form-grid">
                <Field label="Retainer" htmlFor="cl-pkg">
                  <Select id="cl-pkg" value={c.packageId ?? ''} onChange={(e) => set('packageId', e.target.value || null)}>
                    <option value="">None</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {peso(p.price)}/month
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Approves content within (hours)" htmlFor="cl-appr">
                  <input id="cl-appr" className="input num" inputMode="numeric" value={c.approvalHours} onChange={(e) => set('approvalHours', Number(e.target.value.replace(/\D/g, '')) || 0)} />
                </Field>
                <Field label="Renews" htmlFor="cl-renew">
                  <input id="cl-renew" type="date" className="input" value={c.renewalDate} onChange={(e) => set('renewalDate', e.target.value)} />
                </Field>
              </div>
              <Field label="Platforms">
                <div className="chip-row">
                  {PLATFORM_ORDER.slice(0, 7).map((k) => {
                    const on = c.platforms.includes(k);
                    return (
                      <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => set('platforms', on ? c.platforms.filter((x) => x !== k) : [...c.platforms, k])}>
                        {PLATFORMS[k].label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {c.platforms.length ? (
                <div className="form-grid">
                  {c.platforms.map((k) => (
                    <Field key={k} label={`${PLATFORMS[k].label} page or handle`} htmlFor={`cl-h-${k}`}>
                      <TextInput id={`cl-h-${k}`} value={c.handles[k] ?? ''} onChange={(e) => set('handles', { ...c.handles, [k as PlatformKey]: e.target.value })} />
                    </Field>
                  ))}
                </div>
              ) : null}
              <Field label="Goals (what success looks like in 3 months)" htmlFor="cl-goals">
                <TextArea id="cl-goals" rows={2} value={c.goals} onChange={(e) => set('goals', e.target.value)} />
              </Field>
              <section className="stack">
                <h3>Their customers</h3>
                <div className="form-grid">
                  {(
                    [
                      ['who', 'Who they are'],
                      ['pains', 'What frustrates them'],
                      ['wants', 'What they want'],
                      ['objections', 'What makes them hesitate'],
                      ['whereTheyAre', 'Where they are online'],
                      ['triggers', 'When they buy'],
                    ] as [keyof Persona, string][]
                  ).map(([k, label]) => (
                    <Field key={k} label={label} htmlFor={`cl-p-${k}`}>
                      <TextArea id={`cl-p-${k}`} rows={2} value={c.persona[k]} onChange={(e) => setPersona(k, e.target.value)} />
                    </Field>
                  ))}
                </div>
              </section>
            </div>
          </details>
        </div>
      ) : null}
      {tab === 'history' ? <ClientHistory client={stored} /> : null}
      {tab === 'checklist' ? <ClientChecklist client={stored} /> : null}
      {tab === 'content' ? <ClientContent client={stored} /> : null}
      {tab === 'report' ? <ClientReport client={stored} /> : null}
    </Dialog>
  );
}

/** Everything we've done for a client: jobs, quotes, contracts, invoices and what they've paid. */
function ClientHistory({ client }: { client: Client }) {
  const app = useApp();
  const navigate = useNavigate();
  const money = app.can('money');
  const jobs = (useJobs() ?? []).filter((j) => j.clientId === client.id);
  const jobMoney = useJobMoney();
  const payments = (usePayments() ?? []).filter((p) => p.clientId === client.id || (p.jobId && jobs.some((j) => j.id === p.jobId)));
  const invoices = (useInvoices() ?? []).filter((i) => i.clientId === client.id);
  const quotes = (useProposals() ?? []).filter((p) => p.clientId === client.id);
  const contracts = (useContracts() ?? []).filter((c) => c.clientId === client.id);
  const today = todayISO();
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const billed = jobs.filter((j) => j.status !== 'cancelled' && j.status !== 'inquiry').reduce((a, j) => a + (jobMoney?.get(j.id)?.total ?? 0), 0);
  const done = jobs.filter((j) => j.status === 'completed').length;
  return (
    <div className="stack loose">
      <div className="actions">
        <Button size="sm" onClick={() => navigate(`/jobs?new=job&client=${client.id}`)}>
          <Briefcase size={16} /> New job
        </Button>
        {money ? (
          <>
            <Button size="sm" onClick={() => navigate(`/docs/quotes?client=${client.id}`)}>
              <FileText size={16} /> New quote
            </Button>
            <Button size="sm" onClick={() => navigate(`/docs/contracts?client=${client.id}`)}>
              <FileSignature size={16} /> New contract
            </Button>
          </>
        ) : null}
      </div>
      <div className="grid-3">
        <Stat label="Jobs" value={jobs.filter((j) => j.status !== 'inquiry' && j.status !== 'cancelled').length} hint={done ? `${done} completed` : undefined} />
        {money ? <Stat label="Paid to date" value={peso(paid)} hero /> : null}
        {money ? <Stat label="Still to pay" value={peso(Math.max(0, billed - paid))} /> : null}
      </div>
      <section className="stack tight">
        <h3>Jobs</h3>
        {jobs.length === 0 ? <p className="muted small">No jobs yet.</p> : null}
        <div className="list card flush">
          {jobs.map((j) => (
            <button key={j.id} type="button" className="list-item click" onClick={() => navigate(`/jobs?job=${j.id}`)}>
              <span className="main-text">
                <b>
                  <span className="mono tiny muted">{j.number}</span> {j.title || 'Untitled job'}
                </b>
                <span>
                  {JOB_STATUS_LABEL[j.status]}
                  {j.dueDate ? ` · due ${fmtIsoDate(j.dueDate)}` : ''}
                </span>
              </span>
              {money && jobMoney?.get(j.id)?.total ? <span className="num small">{peso(jobMoney.get(j.id)!.total)}</span> : null}
            </button>
          ))}
        </div>
      </section>
      {money ? (
        <>
          <section className="stack tight">
            <h3>Invoices</h3>
            {invoices.length === 0 ? <p className="muted small">None yet.</p> : null}
            <div className="list card flush">
              {invoices.map((inv) => {
                const t = invoiceTotals(inv, inv.jobId ? payments.filter((p) => p.jobId === inv.jobId) : [], today);
                return (
                  <button key={inv.id} type="button" className="list-item click" onClick={() => navigate(`/money/invoices?invoice=${inv.id}`)}>
                    <span className="main-text">
                      <b className="mono">{inv.number}</b>
                      <span>
                        {fmtIsoDate(inv.issueDate)} · {peso(t.total)}
                        {t.balance > 0 && inv.status !== 'void' ? ` · ${peso(t.balance)} due` : ''}
                      </span>
                    </span>
                    {invoiceBadge(inv, t)}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="stack tight">
            <h3>Payments</h3>
            {payments.length === 0 ? <p className="muted small">None yet.</p> : null}
            <div className="list card flush">
              {payments.map((p) => (
                <div key={p.id} className="list-item">
                  <span className="main-text">
                    <b>{peso(p.amount)}</b>
                    <span>
                      {fmtIsoDate(p.date)} · {p.method}
                      {p.receiptNo ? ` · ${p.receiptNo}` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="stack tight">
            <h3>Quotes and contracts</h3>
            {quotes.length + contracts.length === 0 ? <p className="muted small">None yet. Never start work without a signed contract and the down payment.</p> : null}
            <div className="list card flush">
              {quotes.map((p) => (
                <button key={p.id} type="button" className="list-item click" onClick={() => navigate(`/docs/quotes?open=${p.id}`)}>
                  <span className="main-text">
                    <b>Quote {p.number}</b>
                    <span>{fmtIsoDate(p.date)}</span>
                  </span>
                  <Badge tone={p.status === 'won' ? 'good' : p.status === 'sent' ? 'yellow' : undefined}>{p.status}</Badge>
                </button>
              ))}
              {contracts.map((k) => (
                <button key={k.id} type="button" className="list-item click" onClick={() => navigate(`/docs/contracts?open=${k.id}`)}>
                  <span className="main-text">
                    <b>
                      {k.title || 'Contract'} {k.number}
                    </b>
                    <span>{k.fields.date ? fmtIsoDate(k.fields.date) : k.fields.effectiveDate || ''}</span>
                  </span>
                  <Badge tone={k.status === 'signed' ? 'good' : k.status === 'sent' ? 'yellow' : undefined}>{k.status}</Badge>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ClientChecklist({ client }: { client: Client }) {
  const month = todayISO().slice(0, 7);
  const stage = normalizeStage(client.stage);
  const current = PIPELINE.find((s) => s.key === stage);
  const done = (id: string) => !!client.checklist[id];
  return (
    <div className="stack loose">
      {stage === 'active' && client.packageId ? (
        <section className="card stack">
          <h3>This month ({fmtMonth(month)})</h3>
          {MONTHLY_CYCLE.map((i) => (
            <Check key={i.id} id={`cyc-${i.id}`} checked={done(`${i.id}:${month}`)} onChange={(v) => toggleClientCheck(client.id, `${i.id}:${month}`, v)} label={i.label} />
          ))}
        </section>
      ) : null}
      {PIPELINE.filter((s) => s.checklist.length).map((s) => (
        <section key={s.key} className="card stack" style={s.key === current?.key ? { borderColor: 'var(--teal)' } : undefined}>
          <div className="row between">
            <h3>{s.label}</h3>
            {s.key === current?.key ? <Badge tone="teal">Now</Badge> : null}
          </div>
          <p className="small muted">{s.hint}</p>
          {s.checklist.map((i) => (
            <Check key={i.id} id={`ck-${i.id}`} checked={done(i.id)} onChange={(v) => toggleClientCheck(client.id, i.id, v)} label={i.label} />
          ))}
        </section>
      ))}
    </div>
  );
}

function ClientContent({ client }: { client: Client }) {
  const app = useApp();
  const navigate = useNavigate();
  const posts = (usePosts() ?? []).filter((p) => p.clientId === client.id);
  const business = settingValue(useSettingRows(), 'business');
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const upcoming = posts.filter((p) => !p.date || p.date >= todayISO()).slice(0, 30);
  return (
    <div className="stack loose">
      <div className="actions">
        <Button
          onClick={() => {
            app.setScope(client.id);
            navigate('/calendar');
          }}
        >
          <CalendarDays size={16} /> Open their calendar
        </Button>
        <Button
          onClick={() => {
            app.setScope(client.id);
            navigate('/campaigns?new=1');
          }}
        >
          <Megaphone size={16} /> Plan a campaign
        </Button>
      </div>
      <section className="card stack">
        <h3>Content plan for approval</h3>
        <p className="small muted">A PDF of the month’s posts with each caption, for the client to approve or comment on.</p>
        <div className="row wrap">
          <input type="month" className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          <Button
            variant="teal"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const list = posts.filter((p) => p.date?.startsWith(month));
                if (!list.length) {
                  app.toast(`No posts for ${client.name} in ${fmtMonth(month)} yet.`, { tone: 'bad' });
                  return;
                }
                await deliverPdf(await buildApprovalPdf({ business, client, month, posts: list }), `${safeFileName(client.name)} content plan ${month}.pdf`);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileDown size={16} /> Approval PDF
          </Button>
        </div>
      </section>
      <section className="stack">
        <h3>Coming up</h3>
        {upcoming.length === 0 ? <p className="muted small">No posts yet. Plan a campaign or add posts on their calendar.</p> : null}
        <div className="card flush">
          <div className="list">
            {upcoming.map((p) => (
              <button key={p.id} type="button" className="list-item click" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', width: '100%' }} onClick={() => navigate(`/calendar?post=${p.id}`)}>
                <span className="main-text">
                  <b>{p.title}</b>
                  <span>{p.date ? fmtIsoWeekday(p.date) : 'No date'}</span>
                </span>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ClientReport({ client }: { client: Client }) {
  const app = useApp();
  const metrics = useMetrics() ?? [];
  const posts = usePosts() ?? [];
  const business = settingValue(useSettingRows(), 'business');
  const ai = settingValue(useSettingRows(), 'ai');
  const hasKey = useLiveQuery(() => getApiKey().then((k) => !!k), []);
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [worked, setWorked] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = useMemo(() => metrics.filter((m) => m.clientId === client.id && m.date.startsWith(month)), [metrics, client.id, month]);
  const monthPosts = posts.filter((p) => p.clientId === client.id && p.date?.startsWith(month));
  const draft = async () => {
    setBusy(true);
    try {
      const context = await buildContext({ kind: 'client', id: client.id }, { includeResults: true });
      const recipe = RECIPES.find((r) => r.id === 'report')!;
      const res = await streamChat({
        system: await buildSystemPrompt(),
        turns: [{ role: 'user', text: `${context}\n\n---\n\n${recipe.prompt.replace('{topic}', ` Only use ${fmtMonth(month)}'s numbers. Reply in two parts headed exactly "What worked" and "Next month", plain sentences, no tables.`)}` }],
        model: ai.model,
        effort: 'low',
        webSearch: false,
        onText: () => undefined,
      });
      const [, a = '', b = ''] = /what worked[^\n]*\n([\s\S]*?)\n[#*\s]*next month[^\n]*\n([\s\S]*)/i.exec(res.text) ?? [];
      setWorked((a || res.text).replace(/[#*]/g, '').trim());
      setNext(b.replace(/[#*]/g, '').trim());
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not draft it', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="row wrap">
        <input type="month" className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <span className="muted small">
          {mine.length} result{mine.length === 1 ? '' : 's'} logged · {monthPosts.filter((p) => p.status === 'posted').length} posts published
        </span>
      </div>
      {mine.length === 0 ? <Callout tone="info">Log results on {client.name}’s posted posts (open a post → Publish &amp; results), then come back for the report.</Callout> : null}
      <Field label="What worked" htmlFor="rp-worked">
        <TextArea id="rp-worked" rows={4} value={worked} onChange={(e) => setWorked(e.target.value)} placeholder="Which posts got saved and shared, and why." />
      </Field>
      <Field label="Next month" htmlFor="rp-next">
        <TextArea id="rp-next" rows={4} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Three things we’ll do next month." />
      </Field>
      <div className="actions">
        {hasKey ? (
          <Button onClick={draft} disabled={busy || !mine.length}>
            {busy ? <Loader2 size={16} className="spin" /> : <Bot size={16} />} Draft with Claude
          </Button>
        ) : hasKey === false ? (
          <Button
            disabled={!mine.length}
            onClick={async () => {
              const context = await buildContext({ kind: 'client', id: client.id }, { includeResults: true });
              const recipe = RECIPES.find((r) => r.id === 'report')!;
              const ask = recipe.prompt.replace('{topic}', ` Only use ${fmtMonth(month)}'s numbers. Reply in two parts headed exactly "What worked" and "Next month", plain sentences, no tables.`);
              const ok = await openInClaude(webPrompt({ system: await buildSystemPrompt(), context, ask }));
              app.toast(ok ? 'Copied. Paste it into Claude.ai, then paste its two parts into the boxes above.' : 'Couldn’t copy the prompt.', { tone: ok ? 'good' : 'bad', ms: 8000 });
            }}
          >
            <Bot size={16} /> Copy for Claude.ai
          </Button>
        ) : null}
        <Button
          variant="primary"
          disabled={!mine.length}
          onClick={async () => deliverPdf(await buildReportPdf({ business, clientName: client.name, month, metrics: mine, posts: monthPosts, worked, next }), `${safeFileName(client.name)} report ${month}.pdf`)}
        >
          <FileDown size={16} /> Report PDF
        </Button>
      </div>
      <p className="tiny muted">
        <ShieldAlert size={12} /> The report shows only this client’s numbers.
      </p>
    </div>
  );
}

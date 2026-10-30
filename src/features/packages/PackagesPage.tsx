import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router';
import { FileDown, FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, IconButton, PageHeader, Tabs, Toggle } from '../../components/ui';
import { Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useClients, usePackages, useProposals, useSettingRows } from '../../hooks/data';
import { setSetting, settingValue } from '../../db/settings';
import { CATEGORIES, FOUNDING_OFFER, UNIT_LABEL } from '../../domain/packages';
import { costCheck, proposalTotals, type CostCheck } from '../../domain/pricing';
import { PLATFORMS, PLATFORM_ORDER } from '../../domain/platforms';
import { SERVICE_LABEL } from '../../domain/campaignTemplates';
import { deletePackage, deleteProposal, newProposal, savePackage, saveProposal } from '../../services/clients';
import { buildProposalPdf } from '../../reports/docs';
import { deliverPdf } from '../../reports/pdf';
import { formatPct, peso, toCents } from '../../lib/money';
import { addDays, fmtIsoDate } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import type { Package, Proposal, ProposalItem, RateSettings, ServiceKey } from '../../db/types';

export default function PackagesPage() {
  return (
    <div className="page">
      <PageHeader title="Packages & pricing" subtitle="What we sell, what it costs us in hours, and the proposals that go out." />
      <Tabs
        items={[
          { to: '/packages', label: 'SMM packages', end: true },
          { to: '/packages/design', label: 'Design services' },
          { to: '/packages/addons', label: 'Add-ons' },
          { to: '/packages/proposals', label: 'Proposals' },
          { to: '/packages/rates', label: 'Our rates' },
        ]}
      />
      <Routes>
        <Route index element={<PackageList kind="smm" />} />
        <Route path="design" element={<PackageList kind="design" />} />
        <Route path="addons" element={<PackageList kind="addon" />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="rates" element={<Rates />} />
      </Routes>
    </div>
  );
}

function priceText(p: Pick<Package, 'price' | 'unit'>) {
  return p.unit === 'percent' ? `+${(p.price / 100).toFixed(0)}%` : peso(p.price);
}

export function MarginLine({ check, rates }: { check: CostCheck; rates: RateSettings }) {
  if (check.verdict === 'none') return null;
  const pct = Math.max(0, Math.min(100, check.margin ?? 0));
  return (
    <div className="stack tight">
      <div className={`margin-bar ${check.verdict === 'loss' ? 'loss' : check.verdict === 'thin' ? 'thin' : ''}`} role="img" aria-label={`Margin ${formatPct(check.margin)}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className={`tiny strong ${check.verdict === 'loss' ? 'bad' : check.verdict === 'thin' ? 'warn' : 'good'}`}>
        {check.verdict === 'loss' ? 'Loses money' : check.verdict === 'thin' ? `Below your ${rates.minMarginPct}% minimum` : 'Healthy'} · margin {formatPct(check.margin)} · {check.hours.toFixed(1)} h · costs {peso(check.cost)}
      </span>
    </div>
  );
}

function PackageList({ kind }: { kind: Package['kind'] }) {
  const app = useApp();
  const packages = (usePackages() ?? []).filter((p) => p.kind === kind);
  const rates = settingValue(useSettingRows(), 'rates');
  const [edit, setEdit] = useState<Partial<Package> | null>(null);
  return (
    <div className="stack">
      {kind === 'smm' ? (
        <Callout tone="info" title="Introductory rates">
          Priced for a studio starting its SMM service (2026 Philippine market: beginners ₱3–5K, intermediate ₱5–10K, experienced ₱10–25K a month). The margin line uses your own hourly rates; raise prices as results and testimonials come in. {FOUNDING_OFFER.label}.
        </Callout>
      ) : null}
      <div>
        <Button variant="primary" onClick={() => setEdit({ kind, unit: kind === 'smm' ? 'month' : kind === 'addon' ? 'piece' : 'project', deliverables: [], includes: [], platforms: kind === 'smm' ? ['facebook', 'instagram'] : [], revisionsPerPost: 2 })}>
          <Plus size={16} /> New {kind === 'smm' ? 'package' : kind === 'design' ? 'service' : 'add-on'}
        </Button>
      </div>
      {packages.length === 0 ? <EmptyState title="Nothing here yet" /> : null}
      <div className="pkg-grid">
        {packages.map((p) => {
          const check = costCheck(p, rates);
          return (
            <article key={p.id} className={`card pkg ${p.active ? '' : 'muted'}`}>
              <div className="row between top">
                <div>
                  <h3>{p.name}</h3>
                  {p.service ? <span className="tiny muted">{SERVICE_LABEL[p.service as ServiceKey]}</span> : null}
                </div>
                {!p.active ? <Badge>Hidden</Badge> : null}
              </div>
              <div className="price">
                {priceText(p)} <small>{UNIT_LABEL[p.unit]}</small>
              </div>
              {p.tagline ? <p className="small muted">{p.tagline}</p> : null}
              {p.includes.length ? (
                <ul>
                  {p.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : null}
              {app.can('money') ? <MarginLine check={check} rates={rates} /> : null}
              <div>
                <Button size="sm" onClick={() => setEdit(p)}>
                  <Pencil size={16} /> Edit
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <PackageDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

export function PackageDialog({ value, onClose, onSaved }: { value: Partial<Package> | null; onClose: () => void; onSaved?: (p: Package) => void }) {
  const app = useApp();
  // Section names to pick from: the house ones and any made since.
  const sections = [...new Set([...CATEGORIES, ...(usePackages() ?? []).map((x) => x.category ?? '').filter(Boolean)])];
  const rates = settingValue(useSettingRows(), 'rates');
  const [p, setP] = useState<Partial<Package>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? `new-${value.kind}`)) {
    setP({ deliverables: [], includes: [], platforms: [], ...value });
    setKey(value.id ?? `new-${value.kind}`);
  }
  if (!value && key !== null) setKey(null);
  const check = costCheck({ deliverables: p.deliverables ?? [], price: p.price ?? 0, unit: p.unit ?? 'month' }, rates);
  const dl = p.deliverables ?? [];
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      size="wide"
      title={value?.id ? `Edit ${p.name}` : 'New'}
      footer={
        <>
          {value?.id ? (
            <Button
              variant="danger"
              onClick={async () => {
                if (!(await app.confirm({ title: `Delete ${p.name}?`, confirmLabel: 'Delete', tone: 'danger' }))) return;
                await deletePackage(value.id as string);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!p.name?.trim()}
            onClick={async () => {
              const saved = await savePackage({ ...(p as Package), name: p.name!.trim(), kind: p.kind ?? 'smm', category: p.category?.trim() ?? '' });
              app.toast('Saved', { tone: 'good' });
              onSaved?.(saved);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" htmlFor="pk-name">
          <TextInput id="pk-name" value={p.name ?? ''} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Field>
        <Field label={p.unit === 'percent' ? 'Percent' : 'Price'} htmlFor="pk-price">
          {p.unit === 'percent' ? (
            <NumberInput id="pk-price" suffix="%" value={(p.price ?? 0) / 100} onChange={(v) => setP({ ...p, price: Math.round((v ?? 0) * 100) })} />
          ) : (
            <MoneyInput id="pk-price" value={p.price ?? null} onChange={(v) => setP({ ...p, price: v ?? 0 })} />
          )}
        </Field>
        <Field label="Per" htmlFor="pk-unit">
          <Select id="pk-unit" value={p.unit ?? 'month'} onChange={(e) => setP({ ...p, unit: e.target.value as Package['unit'] })}>
            <option value="month">Month</option>
            <option value="project">Project</option>
            <option value="piece">Piece</option>
            <option value="hour">Hour</option>
            <option value="participant">Participant</option>
            <option value="percent">Percent of the package price</option>
          </Select>
        </Field>
        <Field label="Service" htmlFor="pk-svc">
          <Select id="pk-svc" value={p.service ?? ''} onChange={(e) => setP({ ...p, service: e.target.value as ServiceKey })}>
            <option value="">None</option>
            {(Object.keys(SERVICE_LABEL) as ServiceKey[]).map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price list section" htmlFor="pk-cat">
          <TextInput id="pk-cat" list="pk-cats" value={p.category ?? ''} onChange={(e) => setP({ ...p, category: e.target.value })} placeholder="e.g. Branding, Merch" />
          <datalist id="pk-cats">
            {sections.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {p.unit !== 'percent' ? (
          <Field label="Student-org price" htmlFor="pk-student" hint="Leave empty when it’s the same for everyone.">
            <MoneyInput id="pk-student" value={p.studentPrice ?? null} onChange={(v) => setP({ ...p, studentPrice: v })} />
          </Field>
        ) : null}
        <Field label="Turnaround" htmlFor="pk-turn">
          <TextInput id="pk-turn" value={p.turnaround ?? ''} onChange={(e) => setP({ ...p, turnaround: e.target.value })} placeholder="e.g. 7–14 days" />
        </Field>
        <Field label="Revision rounds included" htmlFor="pk-revs">
          <NumberInput id="pk-revs" decimals={false} min={0} value={p.revisions ?? null} onChange={(v) => setP({ ...p, revisions: v ?? 0 })} />
        </Field>
        <Field label="One-line description" htmlFor="pk-tag" className="span-2">
          <TextInput id="pk-tag" value={p.tagline ?? ''} onChange={(e) => setP({ ...p, tagline: e.target.value })} />
        </Field>
        <Field label="Revisions included per piece" htmlFor="pk-rev">
          <NumberInput id="pk-rev" value={p.revisionsPerPost ?? 2} onChange={(v) => setP({ ...p, revisionsPerPost: v ?? 0 })} decimals={false} />
        </Field>
        <Field label="Minimum term (months)" htmlFor="pk-term">
          <NumberInput id="pk-term" value={p.minTermMonths ?? 0} onChange={(v) => setP({ ...p, minTermMonths: v ?? 0 })} decimals={false} />
        </Field>
      </div>
      {p.kind === 'smm' ? (
        <Field label="Platforms">
          <div className="chip-row">
            {PLATFORM_ORDER.slice(0, 7).map((k) => {
              const on = (p.platforms ?? []).includes(k);
              return (
                <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => setP({ ...p, platforms: on ? (p.platforms ?? []).filter((x) => x !== k) : [...(p.platforms ?? []), k] })}>
                  {PLATFORMS[k].label}
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}
      <Field label="What’s included (one per line; shown on proposals)" htmlFor="pk-inc">
        <TextArea id="pk-inc" rows={5} value={(p.includes ?? []).join('\n')} onChange={(e) => setP({ ...p, includes: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
      </Field>
      <section className="stack">
        <h3>Hours it takes (for the margin check)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Work</th>
                <th className="r">How many</th>
                <th className="r">Hours each</th>
                <th>Who</th>
                <th className="r">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dl.map((d, i) => (
                <tr key={i}>
                  <td>
                    <input className="input" value={d.label} onChange={(e) => setP({ ...p, deliverables: dl.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Work" />
                  </td>
                  <td className="r">
                    <input className="input num" style={{ width: 70 }} inputMode="decimal" value={d.qty} onChange={(e) => setP({ ...p, deliverables: dl.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)) })} aria-label="How many" />
                  </td>
                  <td className="r">
                    <input className="input num" style={{ width: 70 }} inputMode="decimal" value={d.hours} onChange={(e) => setP({ ...p, deliverables: dl.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) || 0 } : x)) })} aria-label="Hours each" />
                  </td>
                  <td>
                    <select className="select" value={d.role} onChange={(e) => setP({ ...p, deliverables: dl.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} aria-label="Who">
                      {rates.roles.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} · {peso(r.rate)}/h
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="r">{peso(check.lines[i]?.cost ?? 0)}</td>
                  <td>
                    <IconButton label="Remove" size="sm" plain onClick={() => setP({ ...p, deliverables: dl.filter((_, j) => j !== i) })}>
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button size="sm" onClick={() => setP({ ...p, deliverables: [...dl, { label: '', qty: 1, hours: 1, role: rates.roles[3]?.name ?? rates.roles[0].name }] })}>
            <Plus size={16} /> Add work
          </Button>
        </div>
        <MarginLine check={check} rates={rates} />
        {check.verdict !== 'none' ? (
          <p className="tiny muted">
            With {rates.overheadPct}% overhead. Price for your {rates.minMarginPct}% minimum: {peso(check.minPrice)} · for your {rates.targetMarginPct}% target: {peso(check.targetPrice)}.
          </p>
        ) : null}
      </section>
      <Toggle id="pk-active" checked={(p.active ?? 1) === 1} onChange={(v) => setP({ ...p, active: v ? 1 : 0 })} label="Offer it (shown when making proposals)" />
    </Dialog>
  );
}

function Proposals() {
  const [params, setParams] = useSearchParams();
  const proposals = useProposals();
  const clients = useClients() ?? [];
  const rates = settingValue(useSettingRows(), 'rates');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
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
  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="muted">{decided ? `Win rate ${Math.round((won / decided) * 100)}% (${won} of ${decided})` : 'Track every proposal to learn what wins.'}</span>
        <Button
          variant="primary"
          onClick={async () => {
            const p = await newProposal();
            setOpen(p.id);
          }}
        >
          <Plus size={16} /> New proposal
        </Button>
      </div>
      {proposals.length === 0 ? <EmptyState title="No proposals yet">Start one from a client, or here.</EmptyState> : null}
      {proposals.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Client</th>
                <th>Date</th>
                <th className="r">Monthly</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => {
                const t = proposalTotals(p, rates);
                return (
                  <tr key={p.id} className="click" onClick={() => setOpen(p.id)}>
                    <td className="mono">{p.number}</td>
                    <td>{p.clientName || '—'}</td>
                    <td className="nowrap">{fmtIsoDate(p.date)}</td>
                    <td className="r">{t.perMonth ? peso(t.perMonth) : peso(t.net)}</td>
                    <td>
                      <Badge tone={p.status === 'won' ? 'good' : p.status === 'sent' ? 'yellow' : p.status === 'lost' ? 'bad' : undefined}>{p.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <ProposalDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ProposalDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const proposals = useProposals() ?? [];
  const packages = (usePackages() ?? []).filter((p) => p.active === 1);
  const clients = useClients() ?? [];
  const rows = useSettingRows();
  const rates = settingValue(rows, 'rates');
  const business = settingValue(rows, 'business');
  const stored = proposals.find((p) => p.id === id) ?? null;
  const [p, setP] = useState<Proposal | null>(null);
  if (stored && (!p || p.id !== stored.id)) setP({ ...stored });
  if (!id && p) setP(null);
  if (!p) return null;
  const t = proposalTotals(p, rates);
  const addPkg = (pkg: Package) => {
    const item: ProposalItem = { packageId: pkg.id, label: pkg.name, qty: 1, unitPrice: pkg.price, unit: pkg.unit, months: pkg.unit === 'month' ? Math.max(1, pkg.minTermMonths || 3) : 1 };
    setP({ ...p, items: [...p.items, item] });
  };
  const founding = p.discountPct === FOUNDING_OFFER.pct && p.discountMonths === FOUNDING_OFFER.months;
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      size="xwide"
      title={`Proposal ${p.number}`}
      footer={
        <>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!(await app.confirm({ title: 'Delete this proposal?', confirmLabel: 'Delete', tone: 'danger' }))) return;
              await deleteProposal(p.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> Delete
          </Button>
          <span className="grow" />
          <Button
            onClick={async () => {
              await saveProposal(p);
              await deliverPdf(await buildProposalPdf(p, business, rates, packages), `${safeFileName(`${p.number} ${p.clientName}`)}.pdf`);
            }}
          >
            <FileDown size={16} /> PDF
          </Button>
          {p.status === 'won' && p.clientId ? (
            <Button
              onClick={async () => {
                await saveProposal(p);
                onClose();
                navigate(`/contracts?client=${p.clientId}&proposal=${p.id}`);
              }}
            >
              <FileSignature size={16} /> Make the contract
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={async () => {
              await saveProposal(p);
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="editor-grid">
        <div className="stack">
          <div className="form-grid">
            <Field label="Client" htmlFor="pp-client">
              <Select id="pp-client" value={p.clientId ?? ''} onChange={(e) => setP({ ...p, clientId: e.target.value || null, clientName: clients.find((c) => c.id === e.target.value)?.name ?? p.clientName })}>
                <option value="">Not in the client list</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name on the proposal" htmlFor="pp-name">
              <TextInput id="pp-name" value={p.clientName} onChange={(e) => setP({ ...p, clientName: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor="pp-date">
              <input id="pp-date" type="date" className="input" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value, validUntil: addDays(e.target.value, 30) })} />
            </Field>
            <Field label="Status" htmlFor="pp-status">
              <Select id="pp-status" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as Proposal['status'] })}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </Select>
            </Field>
          </div>
          <Field label="Opening message" htmlFor="pp-intro" hint="Two or three sentences: what you noticed and what you recommend.">
            <TextArea id="pp-intro" rows={3} value={p.intro} onChange={(e) => setP({ ...p, intro: e.target.value })} />
          </Field>
          <section className="stack">
            <h3>Items</h3>
            {p.items.length === 0 ? <p className="muted small">Add a package or service from the right.</p> : null}
            {p.items.map((it, i) => (
              <div key={i} className="row wrap card" style={{ padding: '10px 12px' }}>
                <b className="grow">{it.label}</b>
                {it.unit === 'percent' ? (
                  <span className="small">+{(it.unitPrice / 100).toFixed(0)}% of one-off work</span>
                ) : (
                  <>
                    <label className="small row" style={{ gap: 4 }}>
                      Qty
                      <input className="input num" style={{ width: 64 }} inputMode="numeric" value={it.qty} onChange={(e) => setP({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 1 } : x)) })} />
                    </label>
                    {it.unit === 'month' ? (
                      <label className="small row" style={{ gap: 4 }}>
                        Months
                        <input className="input num" style={{ width: 64 }} inputMode="numeric" value={it.months} onChange={(e) => setP({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, months: Number(e.target.value) || 1 } : x)) })} />
                      </label>
                    ) : null}
                    <div style={{ width: 140 }}>
                      <MoneyInput ariaLabel="Price" value={it.unitPrice} onChange={(v) => setP({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, unitPrice: v ?? 0 } : x)) })} />
                    </div>
                  </>
                )}
                <IconButton label="Remove" size="sm" plain onClick={() => setP({ ...p, items: p.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </section>
          <Toggle
            id="pp-found"
            checked={founding}
            onChange={(v) => setP({ ...p, discountPct: v ? FOUNDING_OFFER.pct : 0, discountMonths: v ? FOUNDING_OFFER.months : 0, discountLabel: v ? `Founding client: ${FOUNDING_OFFER.pct}% off the first ${FOUNDING_OFFER.months} months` : '' })}
            label={`Founding client offer (${FOUNDING_OFFER.pct}% off the first ${FOUNDING_OFFER.months} months)`}
          />
          <div className="row wrap">
            <Toggle id="pp-vat" checked={p.vat} onChange={(v) => setP({ ...p, vat: v })} label={`Add ${rates.vatPct}% VAT (only if VAT-registered)`} />
            <Toggle id="pp-ewt" checked={p.ewt} onChange={(v) => setP({ ...p, ewt: v })} label={`Client withholds ${rates.ewtPct}% (schools, LGUs, companies)`} />
          </div>
          <Field label="Notes on the proposal" htmlFor="pp-notes">
            <TextArea id="pp-notes" rows={2} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
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
              {t.oneTime ? (
                <div className="wf-row sub">
                  <span>One-time</span>
                  <span className="v">{peso(t.oneTime)}</span>
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
              {t.ewt ? (
                <div className="wf-row sub">
                  <span>Payable after {rates.ewtPct}% withholding</span>
                  <span className="v">{peso(t.payable)}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="card">
            <span className="eyebrow">Add</span>
            {(['smm', 'design', 'addon'] as const).map((k) => (
              <div key={k} className="stack tight">
                <span className="tiny muted strong">{k === 'smm' ? 'SMM packages' : k === 'design' ? 'Design services' : 'Add-ons'}</span>
                <div className="chip-row">
                  {packages
                    .filter((x) => x.kind === k)
                    .map((x) => (
                      <button key={x.id} type="button" className="chip" onClick={() => addPkg(x)}>
                        {x.name} · {priceText(x)}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setP({ ...p, items: [...p.items, { packageId: null, label: 'Custom item', qty: 1, unitPrice: toCents(1000), unit: 'project', months: 1 }] })}
            >
              <Plus size={16} /> Custom item
            </Button>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}

export function Rates() {
  const app = useApp();
  const stored = settingValue(useSettingRows(), 'rates');
  const [r, setR] = useState<RateSettings | null>(null);
  const cur = r ?? stored;
  const set = (patch: Partial<RateSettings>) => setR({ ...cur, ...patch });
  const pct = (k: 'overheadPct' | 'targetMarginPct' | 'minMarginPct' | 'vatPct' | 'ewtPct' | 'rushPct' | 'revisionPct', label: string, hint?: string) => (
    <Field label={label} htmlFor={`rt-${k}`} hint={hint}>
      <NumberInput id={`rt-${k}`} suffix="%" value={cur[k]} onChange={(v) => set({ [k]: v ?? 0 } as Partial<RateSettings>)} />
    </Field>
  );
  return (
    <div className="stack loose">
      <p className="muted">The same rates as the POS pricing calculator. Every package’s margin line uses them.</p>
      <section className="card stack">
        <h3>Hourly rates</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th className="r">₱ / hour</th>
                <th>Covers</th>
              </tr>
            </thead>
            <tbody>
              {cur.roles.map((role, i) => (
                <tr key={i}>
                  <td>
                    <input className="input" value={role.name} onChange={(e) => set({ roles: cur.roles.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Role" />
                  </td>
                  <td className="r" style={{ width: 160 }}>
                    <MoneyInput ariaLabel="Rate" value={role.rate} onChange={(v) => set({ roles: cur.roles.map((x, j) => (j === i ? { ...x, rate: v ?? 0 } : x)) })} />
                  </td>
                  <td>
                    <input className="input" value={role.covers} onChange={(e) => set({ roles: cur.roles.map((x, j) => (j === i ? { ...x, covers: e.target.value } : x)) })} aria-label="Covers" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="form-grid">
          {pct('overheadPct', 'Overhead', 'Rent, internet, software, power: 20–30% is normal.')}
          {pct('minMarginPct', 'Minimum margin', 'Below this, the margin line turns orange.')}
          {pct('targetMarginPct', 'Target margin')}
          {pct('rushPct', 'Rush fee')}
          {pct('revisionPct', 'Extra revision round')}
          {pct('vatPct', 'VAT', 'Only charge it if VAT-registered.')}
          {pct('ewtPct', 'Expanded withholding tax', 'Schools, LGUs and companies withhold this and give you a BIR 2307.')}
        </div>
      </section>
      <div>
        <Button
          variant="primary"
          disabled={!r}
          onClick={async () => {
            if (!(await app.askOwner('Change rates'))) return;
            await setSetting('rates', cur);
            setR(null);
            app.toast('Rates saved', { tone: 'good' });
          }}
        >
          Save rates
        </Button>
      </div>
    </div>
  );
}

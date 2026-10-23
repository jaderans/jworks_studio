import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FilterBar } from '../../components/FilterBar';
import { useApp } from '../../app/AppContext';
import { Badge, Button, EmptyState, IconButton, PageHeader, Segmented, Toggle } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { priceText } from '../../components/PriceLines';
import { useContractTemplates, usePackages } from '../../hooks/data';
import { CATEGORIES } from '../../domain/packages';
import { saveTemplate } from '../../services/documents';
import { peso } from '../../lib/money';
import { PackageDialog, Rates } from '../packages/PackagesPage';
import { QuotesTab } from './QuotesTab';
import { ContractsTab } from './ContractsTab';
import { CatalogBanner } from './CatalogBanner';
import type { ContractTemplate, FrameKey, Package } from '../../db/types';

export default function DocsPage() {
  return (
    <div className="page wide">
      <Routes>
        <Route index element={<Navigate to="quotes" replace />} />
        <Route path="quotes" element={<QuotesTab />} />
        <Route path="contracts" element={<ContractsTab />} />
        <Route path="prices" element={<Prices />} />
        <Route path="templates" element={<Templates />} />
        <Route
          path="rates"
          element={
            <div className="stack loose">
              <PageHeader title="Team rates" subtitle="Hourly rates and margins (from the POS pricing calculator). Package margin lines use them." />
              <Rates />
            </div>
          }
        />
      </Routes>
    </div>
  );
}

function Prices() {
  const packages = usePackages();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Partial<Package> | null>(null);
  if (!packages) return null;
  const needle = q.trim().toLowerCase();
  const catOf = (p: Package) => p.category || (p.kind === 'smm' ? 'Social media management' : p.kind === 'addon' ? 'Add-ons' : 'Other');
  const shown = packages.filter((p) => (showArchived || p.active === 1) && (!cat || catOf(p) === cat) && (!needle || `${p.name} ${catOf(p)} ${p.includes.join(' ')}`.toLowerCase().includes(needle)));
  const cats = [...new Set(packages.filter((p) => showArchived || p.active === 1).map(catOf))].sort((a, b) => (CATEGORIES.indexOf(a) + 1 || 999) - (CATEGORIES.indexOf(b) + 1 || 999));
  const groups = cats.map((c) => ({ c, list: shown.filter((p) => catOf(p) === c) })).filter((g) => g.list.length);
  return (
    <div className="stack loose">
      <PageHeader
        title="Price list"
        subtitle="Everything JoshWorks sells. Quotes, contracts and jobs pick from here; student orgs get the student price automatically."
        actions={
          <Button variant="primary" onClick={() => setEdit({ kind: 'design', unit: 'project', deliverables: [], includes: [], platforms: [], revisionsPerPost: 0, category: cat || '' })}>
            <Plus size={18} /> New item
          </Button>
        }
      />
      <CatalogBanner />
      <FilterBar
        id="prices"
        search={{ value: q, onChange: setQ, placeholder: 'Search the price list' }}
        active={(cat ? 1 : 0) + (showArchived ? 1 : 0)}
        onClear={() => {
          setQ('');
          setCat('');
          setShowArchived(false);
        }}
      >
        <Select aria-label="Section" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All sections</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Toggle id="pl-arch" checked={showArchived} onChange={setShowArchived} label="Show archived" />
      </FilterBar>
      {groups.length === 0 ? <EmptyState title="Nothing matches" /> : null}
      {groups.map((g) => (
        <section key={g.c} className="stack tight">
          <h2 className="dot-title">{g.c}</h2>
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>What’s in it</th>
                  <th>Revisions · turnaround</th>
                  <th className="r">Business</th>
                  <th className="r">Student</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.list.map((p) => (
                  <tr key={p.id} className={p.active ? '' : 'muted'}>
                    <td data-label="Item">
                      <b>{p.name}</b> {p.active ? null : <Badge>Archived</Badge>}
                      {p.notes ? <div className="tiny muted">{p.notes}</div> : null}
                    </td>
                    <td data-label="What’s in it" className="small">{p.includes.join(' · ') || p.tagline || '—'}</td>
                    <td data-label="Revisions" className="small nowrap">{[p.revisions ? `${p.revisions} rounds` : '', p.turnaround].filter(Boolean).join(' · ') || '—'}</td>
                    <td data-label="Business" className="r num nowrap">{priceText(p)}</td>
                    <td data-label="Student" className="r num nowrap">{p.studentPrice ? peso(p.studentPrice) : '—'}</td>
                    <td className="actions-cell">
                      <IconButton label={`Edit ${p.name}`} size="sm" plain onClick={() => setEdit(p)}>
                        <Pencil size={15} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <PackageDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Templates() {
  const templates = useContractTemplates();
  const [open, setOpen] = useState<ContractTemplate | null>(null);
  const [q, setQ] = useState('');
  const [audience, setAudience] = useState('');
  const [archived, setArchived] = useState(false);
  if (!templates) return null;
  const needle = q.trim().toLowerCase();
  const shown = templates.filter(
    (t) =>
      (archived || t.active === 1) &&
      (!audience || t.audience === audience) &&
      (!needle || `${t.name} ${t.subtitle} ${t.tagline}`.toLowerCase().includes(needle)),
  );
  return (
    <div className="stack loose">
      <PageHeader title="Contract templates" subtitle="The v1.0 contract set. Edits here apply to new contracts; contracts already made keep their own copy." />
      <CatalogBanner />
      {templates.length === 0 ? (
        <EmptyState title="No templates yet">Load them with the button above.</EmptyState>
      ) : (
        <FilterBar
          id="templates"
          search={{ value: q, onChange: setQ, placeholder: 'Find a template' }}
          active={(audience ? 1 : 0) + (archived ? 1 : 0)}
          onClear={() => {
            setQ('');
            setAudience('');
            setArchived(false);
          }}
        >
          <Select aria-label="For" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="">Every client type</option>
            <option value="business">Business</option>
            <option value="student">Student / school org</option>
            <option value="any">Universal</option>
          </Select>
          <Toggle id="tpl-arch" checked={archived} onChange={setArchived} label="Show turned-off" />
        </FilterBar>
      )}
      {templates.length && !shown.length ? <EmptyState title="Nothing matches" /> : null}
      <div className="template-grid">
        {shown.map((t) => (
          <button key={t.id} type="button" className={`template-card ${t.active ? '' : 'muted'}`} onClick={() => setOpen(t)}>
            <b>{t.name}</b>
            <span className="tiny strong teal">{t.subtitle}</span>
            <span className="small muted">{t.tagline}</span>
            <span className="tiny muted">
              {t.phases.length} phases · {t.brief.length} brief questions · {t.sections.filter((s) => s.on).length} terms
            </span>
          </button>
        ))}
      </div>
      <TemplateEditor value={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function TemplateEditor({ value, onClose }: { value: ContractTemplate | null; onClose: () => void }) {
  const app = useApp();
  const [t, setT] = useState<ContractTemplate | null>(null);
  const [part, setPart] = useState<'about' | 'process' | 'brief' | 'terms'>('about');
  if (value && (!t || t.id !== value.id)) {
    setT({ ...value });
    setPart('about');
  }
  if (!value && t) setT(null);
  if (!value || !t) return null;
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  return (
    <Dialog
      open
      onClose={onClose}
      size="xwide"
      fullPhone
      title={`${t.name} · ${t.subtitle}`}
      footer={
        <>
          <Toggle id="te-active" checked={t.active === 1} onChange={(v) => setT({ ...t, active: v ? 1 : 0 })} label="Offer it" />
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await saveTemplate(t);
              app.toast('Template saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Segmented<typeof part>
        label="Part"
        value={part}
        onChange={setPart}
        options={[
          { value: 'about', label: 'About' },
          { value: 'process', label: 'Process' },
          { value: 'brief', label: 'Brief & agreement' },
          { value: 'terms', label: 'Terms' },
        ]}
      />
      {part === 'about' ? (
        <div className="form-grid">
          <Field label="Name" htmlFor="te-name">
            <TextInput id="te-name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          </Field>
          <Field label="Pricing tier line" htmlFor="te-sub">
            <TextInput id="te-sub" value={t.subtitle} onChange={(e) => setT({ ...t, subtitle: e.target.value })} />
          </Field>
          <Field label="Tagline" htmlFor="te-tag" className="span-2">
            <TextInput id="te-tag" value={t.tagline} onChange={(e) => setT({ ...t, tagline: e.target.value })} />
          </Field>
          <Field label="Letterhead" htmlFor="te-frame">
            <Select id="te-frame" value={t.frame} onChange={(e) => setT({ ...t, frame: e.target.value as FrameKey })}>
              <option value="general">Commission contract</option>
              <option value="logo">Logo and branding</option>
              <option value="merch">Merchandise design</option>
              <option value="web">Web design</option>
            </Select>
          </Field>
          <Field label="Prices for" htmlFor="te-aud">
            <Select id="te-aud" value={t.audience} onChange={(e) => setT({ ...t, audience: e.target.value as ContractTemplate['audience'] })}>
              <option value="business">Business</option>
              <option value="student">Student orgs</option>
              <option value="any">Either (by client)</option>
            </Select>
          </Field>
          <div className="field span-2">
            <span className="label">Price list sections it offers</span>
            <div className="chip-row">
              {CATEGORIES.map((c) => {
                const on = t.categories.includes(c);
                return (
                  <button key={c} type="button" className="chip" aria-pressed={on} onClick={() => setT({ ...t, categories: on ? t.categories.filter((x) => x !== c) : [...t.categories, c] })}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="This agreement covers" htmlFor="te-cov" className="span-2">
            <TextArea id="te-cov" rows={2} value={t.covers} onChange={(e) => setT({ ...t, covers: e.target.value })} />
          </Field>
          <Field label="Welcome" htmlFor="te-wel" className="span-2">
            <TextArea id="te-wel" rows={3} value={t.welcome} onChange={(e) => setT({ ...t, welcome: e.target.value })} />
          </Field>
        </div>
      ) : null}
      {part === 'process' ? (
        <div className="stack">
          {t.phases.map((ph, i) => (
            <div key={i} className="card stack tight">
              <div className="row">
                <b>Phase {i + 1}</b>
                <span className="grow" />
                <IconButton label="Remove phase" size="sm" plain onClick={() => setT({ ...t, phases: t.phases.filter((_, j) => j !== i) })}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
              <TextInput aria-label="Phase title" value={ph.title} onChange={(e) => setT({ ...t, phases: t.phases.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <TextArea aria-label="Phase text" rows={2} value={ph.text} onChange={(e) => setT({ ...t, phases: t.phases.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            </div>
          ))}
          <div>
            <Button size="sm" variant="ghost" onClick={() => setT({ ...t, phases: [...t.phases, { title: '', text: '' }] })}>
              <Plus size={16} /> Add a phase
            </Button>
          </div>
          <Field label="Note under the phases" htmlFor="te-pn">
            <TextArea id="te-pn" rows={2} value={t.phasesNote} onChange={(e) => setT({ ...t, phasesNote: e.target.value })} />
          </Field>
        </div>
      ) : null}
      {part === 'brief' ? (
        <div className="stack">
          <Field label="Brief title" htmlFor="te-bt">
            <TextInput id="te-bt" value={t.briefTitle} onChange={(e) => setT({ ...t, briefTitle: e.target.value })} />
          </Field>
          <Field label="Questions (one per line)" htmlFor="te-bq">
            <TextArea id="te-bq" rows={8} value={t.brief.join('\n')} onChange={(e) => setT({ ...t, brief: lines(e.target.value) })} />
          </Field>
          <Field label="Client agreement statement (one point per line)" htmlFor="te-ag">
            <TextArea id="te-ag" rows={10} value={t.agreement.join('\n')} onChange={(e) => setT({ ...t, agreement: lines(e.target.value) })} />
          </Field>
        </div>
      ) : null}
      {part === 'terms' ? (
        <div className="stack">
          {t.sections.map((s, i) => (
            <section key={s.id} className="card stack tight">
              <Toggle id={`te-s-${s.id}`} checked={s.on} onChange={(v) => setT({ ...t, sections: t.sections.map((x, j) => (j === i ? { ...x, on: v } : x)) })} label={`${i + 1}. ${s.title}`} />
              <TextArea aria-label={s.title} rows={Math.min(8, s.body.split('\n').length + 1)} value={s.body} onChange={(e) => setT({ ...t, sections: t.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
            </section>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}

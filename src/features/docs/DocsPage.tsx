import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Blocks, Copy, FileDown, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { latestTemplate, upgradeTemplates } from '../../services/catalog';
import { questionsOf } from '../../domain/questionnaire';
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
import { ContractBuilder } from './ContractBuilder';
import { RateCardDialog } from './RateCardDialog';
import { blankTemplate, builtCopy, type TemplateDraft } from '../../domain/contractBlocks';
import type { ContractTemplate, FrameKey, Package } from '../../db/types';

export default function DocsPage() {
  const app = useApp();
  const canEdit = app.can('money');
  // Once per studio: move loaded templates to the new questionnaires and terms (edited parts are kept).
  useEffect(() => {
    if (!canEdit) return;
    upgradeTemplates()
      .then((r) => {
        if (r.updated) app.toast(`Contract templates updated: the original questionnaires and the new terms${r.edited.length ? '. Edited parts were kept (Contract templates → Reset to the latest version)' : ''}.`, { tone: 'good', ms: 9000 });
      })
      .catch(() => undefined);
  }, [canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const [rateCard, setRateCard] = useState(false);
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
          <>
            <Button onClick={() => setRateCard(true)}>
              <FileDown size={18} /> Rate card PDF
            </Button>
            <Button variant="primary" onClick={() => setEdit({ kind: 'design', unit: 'project', deliverables: [], includes: [], platforms: [], revisionsPerPost: 0, category: cat || '' })}>
              <Plus size={18} /> New item
            </Button>
          </>
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
      <RateCardDialog open={rateCard} onClose={() => setRateCard(false)} />
    </div>
  );
}

function Templates() {
  const templates = useContractTemplates();
  const [open, setOpen] = useState<ContractTemplate | null>(null);
  const [building, setBuilding] = useState<TemplateDraft | null>(null);
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
      <PageHeader
        title="Contract templates"
        subtitle="The v1.0 contract set and the ones you build. Edits here apply to new contracts; contracts already made keep their own terms."
        actions={
          <Button variant="primary" onClick={() => setBuilding(blankTemplate())}>
            <Blocks size={18} /> Build a new contract
          </Button>
        }
      />
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
          <button key={t.id} type="button" className={`template-card ${t.active ? '' : 'muted'}`} onClick={() => (t.blocks ? setBuilding(t) : setOpen(t))}>
            <b>{t.name}</b>
            <span className="tiny strong teal">{t.blocks ? 'Built in the contract builder' : t.subtitle}</span>
            <span className="small muted">{t.tagline}</span>
            <span className="tiny muted">
              {t.blocks ? `${t.blocks.length} blocks · ` : ''}
              {t.phases.length} phases · {questionsOf(t.brief).length} questions · {t.sections.filter((s) => s.on).length} terms
            </span>
          </button>
        ))}
      </div>
      <TemplateEditor
        value={open}
        onClose={() => setOpen(null)}
        onCopy={(t) => {
          setOpen(null);
          setBuilding(builtCopy(t));
        }}
      />
      <ContractBuilder value={building} onClose={() => setBuilding(null)} />
    </div>
  );
}

/** Puts the shipped questionnaire, terms and agreement back on an edited template. */
function ResetToLatest({ t, onReset }: { t: ContractTemplate; onReset: (t: ContractTemplate) => void }) {
  const app = useApp();
  const latest = latestTemplate(t.id);
  if (!latest) return null;
  const same = JSON.stringify([t.brief, t.briefTitle, t.sections, t.agreement]) === JSON.stringify([latest.brief, latest.briefTitle, latest.sections, latest.agreement]);
  if (same) return <p className="tiny muted">This template has the latest questionnaire, terms and agreement.</p>;
  return (
    <div className="row wrap between">
      <span className="small muted">This template’s questionnaire, terms or agreement differ from the latest version.</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          if (!(await app.confirm({ title: 'Use the latest version?', message: 'Replaces this template’s questionnaire, terms and agreement with the current ones. Contracts already made keep their own copy. Press Save to keep it.', confirmLabel: 'Use the latest' }))) return;
          onReset({ ...t, brief: latest.brief, briefTitle: latest.briefTitle, sections: latest.sections.map((s) => ({ ...s })), agreement: latest.agreement });
        }}
      >
        <RotateCcw size={15} /> Reset to the latest version
      </Button>
    </div>
  );
}

function TemplateEditor({ value, onClose, onCopy }: { value: ContractTemplate | null; onClose: () => void; onCopy: (t: ContractTemplate) => void }) {
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
          <Button onClick={() => onCopy(t)} title="A copy you can rearrange and add your own blocks to; this template stays as it is">
            <Copy size={16} /> Copy into the builder
          </Button>
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
          { value: 'brief', label: 'Questionnaire & agreement' },
          { value: 'terms', label: 'Terms' },
        ]}
      />
      {part === 'about' ? (
        <div className="form-grid">
          <Field label="Name" htmlFor="te-name">
            <TextInput id="te-name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          </Field>
          <Field label="Rate line" htmlFor="te-sub" hint="Shown in the app to tell versions apart; not printed.">
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
      {part === 'brief' || part === 'terms' ? <ResetToLatest t={t} onReset={setT} /> : null}
      {part === 'brief' ? (
        <div className="stack">
          <Field label="Questionnaire title" htmlFor="te-bt">
            <TextInput id="te-bt" value={t.briefTitle} onChange={(e) => setT({ ...t, briefTitle: e.target.value })} />
          </Field>
          <Field
            label={`Questionnaire · ${questionsOf(t.brief).length} questions`}
            htmlFor="te-bq"
            hint="One per line. “## Heading” starts a section, “> text” is the intro, and “Question? :: A | B | Other:” makes tick boxes (an option ending in “:” gets a line to write on)."
          >
            <TextArea id="te-bq" rows={16} value={t.brief.join('\n')} onChange={(e) => setT({ ...t, brief: lines(e.target.value) })} />
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

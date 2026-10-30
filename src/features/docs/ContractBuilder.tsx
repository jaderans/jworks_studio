import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, Import, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, IconButton, Toggle } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useContractTemplates } from '../../hooks/data';
import { CATEGORIES } from '../../domain/packages';
import { questionsOf } from '../../domain/questionnaire';
import { BLOCK_INFO, BLOCK_KINDS, borrowFrom, moveBlock, newBlock, type BorrowParts, type TemplateDraft } from '../../domain/contractBlocks';
import { saveTemplate } from '../../services/documents';
import { getSetting } from '../../db/settings';
import { db, alive } from '../../db/db';
import { uid } from '../../lib/ids';
import { todayISO } from '../../lib/time';
import type { Contract, ContractBlock, ContractBlockKind, ContractTemplate, FrameKey } from '../../db/types';

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Build a contract template block by block: start blank (or from a copy),
 * add the parts in the order they should print, borrow parts from the other
 * templates, and preview the PDF. Contracts are then made from it as usual.
 */
export function ContractBuilder({ value, onClose }: { value: TemplateDraft | null; onClose: () => void }) {
  const app = useApp();
  const [t, setT] = useState<TemplateDraft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (value && (!t || t.id !== value.id)) {
    setT(structuredClone(value));
    setOpen(null);
  }
  if (!value && t) setT(null);
  if (!value || !t) return null;
  const blocks = t.blocks ?? [];
  const setBlocks = (next: ContractBlock[]) => setT({ ...t, blocks: next });
  const setBlock = (id: string, patch: Partial<ContractBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = (kind: ContractBlockKind) => {
    const b = newBlock(kind);
    setBlocks([...blocks, b]);
    setOpen(kind === 'pagebreak' ? null : b.id);
    setAdding(false);
  };

  const preview = async () => {
    setBusy(true);
    try {
      const [business, payMethods, packages, { buildTemplateContractPdf }, { deliverPdf }] = await Promise.all([
        getSetting('business'),
        getSetting('payMethods'),
        db.packages.toArray().then(alive),
        import('../../reports/studioDocs'),
        import('../../reports/pdf'),
      ]);
      const today = todayISO();
      const sample = {
        id: `preview-${uid()}`,
        number: 'PREVIEW',
        clientId: null,
        proposalId: null,
        packageId: null,
        status: 'draft',
        fields: {
          date: today,
          designer: business.signatory ?? '',
          channel: business.channel ?? '',
          hours: business.hours ?? '',
          delivery: business.delivery ?? '',
        },
        sections: t.sections,
        signedAt: null,
        notes: '',
        templateId: t.id,
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: 0,
      } as unknown as Contract;
      await deliverPdf(
        await buildTemplateContractPdf(sample, t as ContractTemplate, {
          business,
          packages,
          payMethods,
          payments: [],
        }),
        `${t.name || 'Contract'} (preview).pdf`,
      );
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'The preview didn’t work', {
        tone: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="xwide"
      fullPhone
      title="Contract builder"
      footer={
        <>
          <Toggle id="cb-active" checked={t.active === 1} onChange={(v) => setT({ ...t, active: v ? 1 : 0 })} label="Offer it" />
          <span className="grow" />
          <Button onClick={preview} disabled={busy}>
            <Eye size={16} /> {busy ? 'Making…' : 'Preview PDF'}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!t.name.trim()}
            onClick={async () => {
              await saveTemplate(t as ContractTemplate);
              app.toast(`${t.name} saved. Make a contract from it in Documents → Contracts.`, { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label="Contract name" htmlFor="cb-name">
            <TextInput id="cb-name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          </Field>
          <Field label="Line under the title" htmlFor="cb-tag" hint="e.g. Logo, packaging and launch kit for a café">
            <TextInput id="cb-tag" value={t.tagline} onChange={(e) => setT({ ...t, tagline: e.target.value })} />
          </Field>
          <Field label="Letterhead" htmlFor="cb-frame">
            <Select id="cb-frame" value={t.frame} onChange={(e) => setT({ ...t, frame: e.target.value as FrameKey })}>
              <option value="general">Commission contract</option>
              <option value="logo">Logo and branding</option>
              <option value="merch">Merchandise design</option>
              <option value="web">Web design</option>
            </Select>
          </Field>
          <Field label="Prices for" htmlFor="cb-aud">
            <Select
              id="cb-aud"
              value={t.audience}
              onChange={(e) =>
                setT({
                  ...t,
                  audience: e.target.value as ContractTemplate['audience'],
                })
              }
            >
              <option value="any">Either (by client)</option>
              <option value="business">Business</option>
              <option value="student">Student orgs</option>
            </Select>
          </Field>
        </div>

        <div className="row wrap between">
          <h3 style={{ margin: 0 }}>The contract, top to bottom</h3>
          <div className="actions">
            <Button size="sm" onClick={() => setBorrowing(true)}>
              <Import size={16} /> Borrow from a template
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add a block
            </Button>
          </div>
        </div>

        <div className="builder-list">
          <div className="builder-block fixed">
            <span className="builder-num">·</span>
            <span className="main-text">
              <b>Header</b>
              <span className="small muted">JOSHWORKS, the contract name, contract and job numbers, dates and who it’s prepared for. Always first.</span>
            </span>
          </div>
          {blocks.map((b, i) => {
            const info = BLOCK_INFO[b.kind];
            const isOpen = open === b.id;
            const canEdit = b.kind !== 'pagebreak';
            return (
              <div key={b.id} className={`builder-block ${isOpen ? 'open' : ''}`}>
                <div className="builder-head">
                  <span className="builder-num">{i + 1}</span>
                  <button type="button" className="builder-title" onClick={() => canEdit && setOpen(isOpen ? null : b.id)} aria-expanded={canEdit ? isOpen : undefined}>
                    {canEdit ? isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : null}
                    <span className="main-text">
                      <b>{b.kind === 'text' && b.title?.trim() ? b.title : info.label}</b>
                      <span className="small muted">{b.kind === 'text' ? 'Your own text' : info.hint}</span>
                    </span>
                  </button>
                  <IconButton label={`Move ${info.label} up`} size="sm" plain disabled={i === 0} onClick={() => setBlocks(moveBlock(blocks, b.id, -1))}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton label={`Move ${info.label} down`} size="sm" plain disabled={i === blocks.length - 1} onClick={() => setBlocks(moveBlock(blocks, b.id, 1))}>
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton label={`Remove ${info.label}`} size="sm" plain onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
                {isOpen ? <div className="builder-body">{blockEditor(b, t, setT, (patch) => setBlock(b.id, patch))}</div> : null}
              </div>
            );
          })}
          {!blocks.length ? (
            <Callout tone="info" title="A blank slate">
              Add the blocks in the order they should print (Welcome, Packages & price, Terms, Signatures…), or borrow parts from one of your templates.
            </Callout>
          ) : null}
        </div>
      </div>

      <AddBlock open={adding} have={blocks} onPick={add} onClose={() => setAdding(false)} />
      <Borrow open={borrowing} self={t.id} onClose={() => setBorrowing(false)} onBorrow={(from, parts) => setT(borrowFrom(t, from, parts))} />
    </Dialog>
  );
}

/** The fields under an opened block: the template's own text that the block prints. */
function blockEditor(b: ContractBlock, t: TemplateDraft, setT: (t: TemplateDraft) => void, setBlock: (patch: Partial<ContractBlock>) => void) {
  switch (b.kind) {
    case 'welcome':
      return (
        <div className="stack tight">
          <Field label="Welcome" htmlFor={`cb-w-${b.id}`} hint="“What we do” and “Our goal” follow it, then what the agreement covers and the project scope.">
            <TextArea id={`cb-w-${b.id}`} rows={3} value={t.welcome} onChange={(e) => setT({ ...t, welcome: e.target.value })} />
          </Field>
          <Field label="This agreement covers" htmlFor={`cb-c-${b.id}`}>
            <TextArea id={`cb-c-${b.id}`} rows={2} value={t.covers} onChange={(e) => setT({ ...t, covers: e.target.value })} />
          </Field>
        </div>
      );
    case 'process':
      return (
        <div className="stack tight">
          {t.phases.map((ph, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <b className="small" style={{ paddingTop: 10, minWidth: 54 }}>
                Phase {i + 1}
              </b>
              <div className="stack tight grow">
                <TextInput
                  aria-label={`Phase ${i + 1} title`}
                  value={ph.title}
                  placeholder="Discovery & brief"
                  onChange={(e) =>
                    setT({
                      ...t,
                      phases: t.phases.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    })
                  }
                />
                <TextArea
                  aria-label={`Phase ${i + 1} text`}
                  rows={2}
                  value={ph.text}
                  onChange={(e) =>
                    setT({
                      ...t,
                      phases: t.phases.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                    })
                  }
                />
              </div>
              <IconButton label={`Remove phase ${i + 1}`} size="sm" plain onClick={() => setT({ ...t, phases: t.phases.filter((_, j) => j !== i) })}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          <div>
            <Button size="sm" variant="ghost" onClick={() => setT({ ...t, phases: [...t.phases, { title: '', text: '' }] })}>
              <Plus size={16} /> Add a phase
            </Button>
          </div>
          <Field label="Note under the phases" htmlFor={`cb-pn-${b.id}`}>
            <TextArea id={`cb-pn-${b.id}`} rows={2} value={t.phasesNote} onChange={(e) => setT({ ...t, phasesNote: e.target.value })} />
          </Field>
        </div>
      );
    case 'packages':
      return (
        <div className="stack tight">
          <span className="label">Price list sections it offers (their packages and add-ons print to tick)</span>
          <div className="chip-row">
            {CATEGORIES.map((c) => {
              const on = t.categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() =>
                    setT({
                      ...t,
                      categories: on ? t.categories.filter((x) => x !== c) : [...t.categories, c],
                    })
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
          <p className="tiny muted">With no sections, only the items added on the contract print, with the total.</p>
        </div>
      );
    case 'questionnaire':
      return (
        <div className="stack tight">
          <Field label="Questionnaire title" htmlFor={`cb-bt-${b.id}`}>
            <TextInput id={`cb-bt-${b.id}`} value={t.briefTitle} onChange={(e) => setT({ ...t, briefTitle: e.target.value })} />
          </Field>
          <Field
            label={`Questions · ${questionsOf(t.brief).length}`}
            htmlFor={`cb-bq-${b.id}`}
            hint="One per line. “## Heading” starts a section, “> text” is the intro, and “Question? :: A | B | Other:” makes tick boxes."
          >
            <TextArea id={`cb-bq-${b.id}`} rows={10} value={t.brief.join('\n')} onChange={(e) => setT({ ...t, brief: lines(e.target.value) })} />
          </Field>
        </div>
      );
    case 'terms':
      return (
        <div className="stack tight">
          {t.sections.map((s, i) => (
            <div key={s.id} className="card stack tight">
              <div className="row">
                <Toggle
                  id={`cb-s-${s.id}`}
                  checked={s.on}
                  onChange={(v) =>
                    setT({
                      ...t,
                      sections: t.sections.map((x, j) => (j === i ? { ...x, on: v } : x)),
                    })
                  }
                  label={`${i + 1}.`}
                />
                <TextInput
                  aria-label={`Term ${i + 1} title`}
                  className="grow"
                  value={s.title}
                  onChange={(e) =>
                    setT({
                      ...t,
                      sections: t.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    })
                  }
                />
                <IconButton
                  label={`Remove ${s.title || `term ${i + 1}`}`}
                  size="sm"
                  plain
                  onClick={() =>
                    setT({
                      ...t,
                      sections: t.sections.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
              <TextArea
                aria-label={`${s.title || `Term ${i + 1}`} text`}
                rows={Math.min(8, s.body.split('\n').length + 1)}
                value={s.body}
                onChange={(e) =>
                  setT({
                    ...t,
                    sections: t.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)),
                  })
                }
              />
            </div>
          ))}
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setT({
                  ...t,
                  sections: [
                    ...t.sections,
                    {
                      id: `own-${uid().slice(0, 6)}`,
                      title: '',
                      body: '',
                      on: true,
                    },
                  ],
                })
              }
            >
              <Plus size={16} /> Add a term
            </Button>
          </div>
          <p className="tiny muted">Each line of a term prints as a bullet. Borrow terms from your templates with “Borrow from a template”.</p>
        </div>
      );
    case 'agreement':
      return (
        <Field label="What the client agrees to (one point per line)" htmlFor={`cb-ag-${b.id}`}>
          <TextArea id={`cb-ag-${b.id}`} rows={8} value={t.agreement.join('\n')} onChange={(e) => setT({ ...t, agreement: lines(e.target.value) })} />
        </Field>
      );
    case 'text':
      return (
        <div className="stack tight">
          <Field label="Heading" htmlFor={`cb-tt-${b.id}`}>
            <TextInput id={`cb-tt-${b.id}`} value={b.title ?? ''} placeholder="Usage rights" onChange={(e) => setBlock({ title: e.target.value })} />
          </Field>
          <Field label="Text" htmlFor={`cb-tb-${b.id}`} hint="Start a line with “- ” for a bullet. {{client.name}}, {{scope}} and {{startDate}} fill in from the contract.">
            <TextArea id={`cb-tb-${b.id}`} rows={6} value={b.body ?? ''} onChange={(e) => setBlock({ body: e.target.value })} />
          </Field>
        </div>
      );
    default:
      return <p className="small muted">{BLOCK_INFO[b.kind].hint} It fills in from each contract; nothing to set here.</p>;
  }
}

function AddBlock({ open, have, onPick, onClose }: { open: boolean; have: ContractBlock[]; onPick: (k: ContractBlockKind) => void; onClose: () => void }) {
  if (!open) return null;
  const kinds = BLOCK_KINDS.filter((k) => BLOCK_INFO[k].repeat || !have.some((b) => b.kind === k));
  return (
    <Dialog open onClose={onClose} title="Add a block" size="wide">
      <p className="small muted">It goes at the end; move it with the arrows.</p>
      <div className="template-grid">
        {kinds.map((k) => (
          <button key={k} type="button" className="template-card" onClick={() => onPick(k)}>
            <b>{BLOCK_INFO[k].label}</b>
            <span className="small muted">{BLOCK_INFO[k].hint}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function Borrow({ open, self, onClose, onBorrow }: { open: boolean; self: string; onClose: () => void; onBorrow: (from: ContractTemplate, parts: BorrowParts) => void }) {
  const app = useApp();
  const templates = (useContractTemplates() ?? []).filter((x) => x.id !== self);
  const [fromId, setFromId] = useState('');
  const [parts, setParts] = useState<BorrowParts>({});
  if (!open) return null;
  const from = templates.find((x) => x.id === fromId);
  const tick = (k: keyof Omit<BorrowParts, 'sections'>) => (v: boolean) => setParts({ ...parts, [k]: v });
  const sections = parts.sections ?? [];
  const count = Object.entries(parts).filter(([k, v]) => (k === 'sections' ? (v as string[]).length : v)).length;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Borrow from a template"
      size="wide"
      fullPhone
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!from || !count}
            onClick={() => {
              if (!from) return;
              onBorrow(from, parts);
              app.toast(`Added from ${from.name}. Lists were added to; single texts were replaced.`, { tone: 'good' });
              setParts({});
              onClose();
            }}
          >
            Add to my contract
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Template" htmlFor="cb-from">
          <Select
            id="cb-from"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value);
              setParts({});
            }}
          >
            <option value="">Choose a template…</option>
            {templates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.subtitle}
              </option>
            ))}
          </Select>
        </Field>
        {from ? (
          <>
            <div className="stack tight">
              {from.welcome ? <Toggle id="cb-bw" checked={!!parts.welcome} onChange={tick('welcome')} label="Welcome text" /> : null}
              {from.covers ? <Toggle id="cb-bc" checked={!!parts.covers} onChange={tick('covers')} label="What the agreement covers" /> : null}
              {from.phases.length ? <Toggle id="cb-bp" checked={!!parts.phases} onChange={tick('phases')} label={`Process: ${from.phases.length} phases`} /> : null}
              {from.brief.length ? (
                <Toggle id="cb-bq" checked={!!parts.questionnaire} onChange={tick('questionnaire')} label={`${from.briefTitle || 'Questionnaire'}: ${questionsOf(from.brief).length} questions`} />
              ) : null}
              {from.agreement.length ? <Toggle id="cb-ba" checked={!!parts.agreement} onChange={tick('agreement')} label={`Agreement statement: ${from.agreement.length} points`} /> : null}
              {from.categories.length ? <Toggle id="cb-bk" checked={!!parts.categories} onChange={tick('categories')} label={`Price list sections: ${from.categories.join(', ')}`} /> : null}
            </div>
            {from.sections.length ? (
              <div className="stack tight">
                <div className="row between">
                  <span className="label">Terms</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setParts({
                        ...parts,
                        sections: sections.length === from.sections.length ? [] : from.sections.map((s) => s.id),
                      })
                    }
                  >
                    {sections.length === from.sections.length ? 'None' : 'All'}
                  </Button>
                </div>
                <div className="chip-row">
                  {from.sections.map((s) => {
                    const on = sections.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="chip"
                        aria-pressed={on}
                        onClick={() =>
                          setParts({
                            ...parts,
                            sections: on ? sections.filter((x) => x !== s.id) : [...sections, s.id],
                          })
                        }
                      >
                        {s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="tiny muted">
              <Badge>Tip</Badge> Lists (phases, questions, terms, agreement points, sections) are added to what you have; the welcome text and what it covers are replaced. The block that prints each
              part is added if it’s missing.
            </p>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

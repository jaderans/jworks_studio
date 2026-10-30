import { useState } from 'react';
import { CopyPlus, Pencil, Plus } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, IconButton } from '../../components/ui';
import { usePackages } from '../../hooks/data';
import { CATEGORIES } from '../../domain/packages';
import { rateText, sectionOf } from '../../domain/rateCard';
import { savePackage } from '../../services/clients';
import { PackageDialog } from '../packages/PackagesPage';
import type { Package } from '../../db/types';

const order = (a: string, b: string) => (CATEGORIES.indexOf(a) + 1 || 999) - (CATEGORIES.indexOf(b) + 1 || 999) || a.localeCompare(b);

/**
 * A contract template's pricing: which price list sections it offers, plus its
 * own packages and add-ons in sections you name. "Make my own copy" copies a
 * price list section so this template's prices can change without touching
 * the price list. Its own items are saved right away, like any price list item.
 */
export function TemplatePricing({ templateId, templateName, categories, onCategories }: { templateId: string; templateName: string; categories: string[]; onCategories: (next: string[]) => void }) {
  const app = useApp();
  const packages = (usePackages() ?? []).filter((p) => p.active === 1 && (!p.templateId || p.templateId === templateId));
  const [edit, setEdit] = useState<Partial<Package> | null>(null);
  const [busy, setBusy] = useState(false);
  const own = (cat: string) => packages.some((p) => sectionOf(p) === cat && p.templateId === templateId);
  const shared = [...new Set(packages.filter((p) => !p.templateId).map(sectionOf))].sort(order);
  const chosen = categories.filter((c) => packages.some((p) => sectionOf(p) === c));
  const ownName = (templateName.trim() || 'This contract').replace(/\s+/g, ' ');
  const add = (cat: string) => (categories.includes(cat) ? categories : [...categories, cat]);

  /** Copy a price list section into this template's own section, and offer the copy instead. */
  const copySection = async (cat: string) => {
    let name = `${cat} · ${ownName}`;
    for (let n = 2; packages.some((p) => sectionOf(p) === name); n++) name = `${cat} · ${ownName} ${n}`;
    setBusy(true);
    try {
      const items = packages.filter((p) => sectionOf(p) === cat && !p.templateId);
      for (const p of items) {
        // A new record with the same contents (the rest leaves out the original's id and sync fields).
        const { id, createdAt, updatedAt, deleted, _sync, _dev, ...fields } = p;
        await savePackage({ ...fields, category: name, templateId, notes: '' });
      }
      onCategories(categories.map((c) => (c === cat ? name : c)));
      app.toast(`${items.length} items copied into “${name}”. Change their prices here; the price list stays the same.`, { tone: 'good', ms: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="stack tight">
        <span className="label">Price list sections it offers (their packages and add-ons print to tick)</span>
        <div className="chip-row">
          {shared.map((c) => {
            const on = categories.includes(c);
            return (
              <button key={c} type="button" className="chip" aria-pressed={on} onClick={() => onCategories(on ? categories.filter((x) => x !== c) : [...categories, c])}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {chosen.map((cat) => {
        const items = packages.filter((p) => sectionOf(p) === cat).sort((a, b) => Number(a.kind === 'addon') - Number(b.kind === 'addon') || a.sort - b.sort);
        const mine = own(cat);
        return (
          <div key={cat} className="card stack tight">
            <div className="row wrap between">
              <b>
                {cat} {mine ? <Badge tone="teal">This contract’s own</Badge> : <Badge>Price list</Badge>}
              </b>
              <div className="actions">
                {mine ? (
                  <>
                    <Button size="sm" onClick={() => setEdit({ kind: 'design', unit: 'project', category: cat, templateId, includes: [], deliverables: [], platforms: [], revisionsPerPost: 0 })}>
                      <Plus size={15} /> Package
                    </Button>
                    <Button size="sm" onClick={() => setEdit({ kind: 'addon', unit: 'project', category: cat, templateId, includes: [], deliverables: [], platforms: [], revisionsPerPost: 0 })}>
                      <Plus size={15} /> Add-on
                    </Button>
                  </>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => copySection(cat)} title="Copy this section so this contract can have its own prices">
                    <CopyPlus size={15} /> Make my own copy
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onCategories(categories.filter((x) => x !== cat))}>
                  Leave out
                </Button>
              </div>
            </div>
            <div className="list">
              {items.map((p) => (
                <div key={p.id} className="list-item">
                  <span className="main-text">
                    <b>{p.name}</b>
                    <span className="small muted">
                      {p.kind === 'addon' ? 'Add-on · ' : ''}
                      {rateText(p, 'business')}
                      {p.studentPrice ? ` · students ${rateText(p, 'student')}` : ''}
                    </span>
                  </span>
                  <IconButton label={`Edit ${p.name}`} size="sm" plain onClick={() => setEdit(p)}>
                    <Pencil size={15} />
                  </IconButton>
                </div>
              ))}
            </div>
            {!mine ? <p className="tiny muted">Editing these changes the price list for every contract that offers {cat}. For prices just for this contract, use Make my own copy.</p> : null}
          </div>
        );
      })}

      <div className="row wrap">
        <Button
          size="sm"
          variant="primary"
          onClick={() => setEdit({ kind: 'design', unit: 'project', category: `${ownName} packages`, templateId, includes: [], deliverables: [], platforms: [], revisionsPerPost: 0 })}
        >
          <Plus size={15} /> New package in a new category
        </Button>
        <span className="tiny muted">Type the category under “Price list section”, e.g. Café packages or Menu add-ons.</span>
      </div>

      <PackageDialog value={edit} onClose={() => setEdit(null)} onSaved={(p) => p.category && onCategories(add(p.category))} />
    </div>
  );
}

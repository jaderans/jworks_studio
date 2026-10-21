import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button, IconButton } from './ui';
import { MoneyInput, NumberInput } from './form';
import { Dialog } from './Dialog';
import { usePackages } from '../hooks/data';
import { CATEGORIES, UNIT_LABEL, priceFor } from '../domain/packages';
import { docTotals } from '../domain/pricing';
import { peso } from '../lib/money';
import type { Package, ProposalItem } from '../db/types';

/**
 * Price lines for quotes, contracts and jobs, picked from the studio price list.
 * Package lines are marked `base`, so percentage add-ons (rush, extra revisions,
 * source files, ownership) are worked out on the package price, as the contracts say.
 */

export type PriceAudience = 'business' | 'student';

export function itemFromPackage(p: Package, audience: PriceAudience): ProposalItem {
  const monthly = p.unit === 'month';
  return {
    packageId: p.id,
    label: p.name,
    qty: 1,
    unitPrice: p.unit === 'percent' ? p.price : priceFor(p, audience),
    unit: p.unit,
    months: monthly ? Math.max(1, p.minTermMonths || 1) : 1,
    base: p.kind !== 'addon',
  };
}

export function priceText(p: Pick<Package, 'price' | 'unit' | 'studentPrice'>, audience?: PriceAudience): string {
  if (p.unit === 'percent') return `+${(p.price / 100).toFixed(p.price % 100 ? 1 : 0)}%`;
  const price = audience ? priceFor(p, audience) : p.price;
  return `${peso(price)} ${UNIT_LABEL[p.unit]}`.trim();
}

export function PriceLinesEditor({
  items,
  onChange,
  audience,
  categories,
  readOnly,
}: {
  items: ProposalItem[];
  onChange: (items: ProposalItem[]) => void;
  audience: PriceAudience;
  /** Price list sections to show first in the picker (a contract template's). */
  categories?: string[];
  readOnly?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const set = (i: number, patch: Partial<ProposalItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const t = docTotals(items);
  return (
    <div className="stack tight">
      {items.length === 0 ? <p className="muted small">No lines yet. Add a package or item from the price list.</p> : null}
      <div className="price-lines">
        {items.map((it, i) => (
          <div key={i} className="price-line">
            <input className="input pl-label" aria-label="Line" value={it.label} disabled={readOnly} onChange={(e) => set(i, { label: e.target.value })} />
            {it.unit === 'percent' ? (
              <span className="pl-pct small">
                +{(it.unitPrice / 100).toFixed(it.unitPrice % 100 ? 1 : 0)}% of the {items.some((x) => x.base) ? 'package' : 'work'}
                {it.qty > 1 ? ` × ${it.qty}` : ''}
                <span className="muted"> · {peso(t.lines.find((l) => l.label === it.label)?.amount ?? 0)}</span>
              </span>
            ) : (
              <>
                <div className="pl-qty">
                  <NumberInput ariaLabel="Quantity" value={it.qty} decimals={false} min={1} disabled={readOnly} onChange={(v) => set(i, { qty: v ?? 1 })} prefix="×" />
                </div>
                {it.unit === 'month' ? (
                  <div className="pl-qty">
                    <NumberInput ariaLabel="Months" value={it.months} decimals={false} min={1} disabled={readOnly} onChange={(v) => set(i, { months: v ?? 1 })} suffix="mo" />
                  </div>
                ) : null}
                <div className="pl-price">
                  <MoneyInput ariaLabel="Price" value={it.unitPrice} disabled={readOnly} onChange={(v) => set(i, { unitPrice: v ?? 0 })} />
                </div>
              </>
            )}
            {it.unit === 'percent' ? (
              <div className="pl-qty">
                <NumberInput ariaLabel="Times" value={it.qty} decimals={false} min={1} disabled={readOnly} onChange={(v) => set(i, { qty: v ?? 1 })} prefix="×" />
              </div>
            ) : null}
            {readOnly ? null : (
              <IconButton label={`Remove ${it.label}`} size="sm" plain onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            )}
          </div>
        ))}
      </div>
      {readOnly ? null : (
        <div className="row wrap">
          <Button size="sm" variant="teal" onClick={() => setPicking(true)}>
            <Plus size={16} /> Add from the price list
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([...items, { packageId: null, label: 'Custom item', qty: 1, unitPrice: 0, unit: 'project', months: 1, base: !items.some((x) => x.base) }])}>
            <Plus size={16} /> Custom line
          </Button>
        </div>
      )}
      <CatalogPicker
        open={picking}
        onClose={() => setPicking(false)}
        audience={audience}
        categories={categories}
        onPick={(p) => onChange([...items, itemFromPackage(p, audience)])}
      />
    </div>
  );
}

/** Subtotal, add-ons, discount and total for a set of lines. */
export function TotalsCard({ items, discountAmount = 0, discountLabel = 'Discount', downPct }: { items: ProposalItem[]; discountAmount?: number; discountLabel?: string; downPct?: number }) {
  const t = docTotals(items, discountAmount);
  const base = t.lines.filter((_, i) => items[i]?.base || !items.some((x) => x.base)).reduce((a, l) => a + l.amount, 0);
  const addOns = t.gross - base;
  return (
    <div className="waterfall">
      {t.perMonth ? (
        <div className="wf-row sub">
          <span>Monthly</span>
          <span className="v">{peso(t.perMonth)}</span>
        </div>
      ) : null}
      <div className="wf-row">
        <span>{addOns ? 'Package' : 'Subtotal'}</span>
        <span className="v">{peso(base)}</span>
      </div>
      {addOns ? (
        <div className="wf-row sub">
          <span>Add-ons (+)</span>
          <span className="v">{peso(addOns)}</span>
        </div>
      ) : null}
      {t.discount ? (
        <div className="wf-row sub">
          <span>{discountLabel} (−)</span>
          <span className="v">−{peso(t.discount)}</span>
        </div>
      ) : null}
      <div className="wf-row final">
        <span>Total</span>
        <span className="v">{peso(t.net)}</span>
      </div>
      {downPct ? (
        <div className="wf-row sub">
          <span>{downPct}% due on signing</span>
          <span className="v">{peso(Math.round((t.net * downPct) / 100))}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Searchable price list, grouped by section, with business and student prices. */
export function CatalogPicker({
  open,
  onClose,
  onPick,
  audience,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: Package) => void;
  audience: PriceAudience;
  categories?: string[];
}) {
  const packages = (usePackages() ?? []).filter((p) => p.active === 1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [added, setAdded] = useState(0);
  const cats = useMemo(() => {
    const present = [...new Set(packages.map((p) => p.category || (p.kind === 'addon' ? 'Add-ons' : 'Other')))];
    const order = [...(categories ?? []), ...CATEGORIES];
    return present.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
  }, [packages, categories]);
  const active = cat || (categories?.[0] && cats.includes(categories[0]) ? categories[0] : '');
  const needle = q.trim().toLowerCase();
  const shown = packages.filter((p) => {
    const c = p.category || (p.kind === 'addon' ? 'Add-ons' : 'Other');
    if (needle) return `${p.name} ${c} ${p.includes.join(' ')}`.toLowerCase().includes(needle);
    return !active || c === active;
  });
  return (
    <Dialog
      open={open}
      onClose={() => {
        setQ('');
        setCat('');
        setAdded(0);
        onClose();
      }}
      title="Add from the price list"
      size="wide"
      fullPhone
      footer={
        <Button variant="primary" onClick={() => { setAdded(0); onClose(); }}>
          {added ? `Done (${added} added)` : 'Done'}
        </Button>
      }
    >
      <div className="search">
        <Search size={18} aria-hidden="true" />
        <input className="input" type="search" aria-label="Search the price list" placeholder="Search: logo, shirt, yearbook, rush…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {needle ? null : (
        <div className="chip-row scroll-x" role="group" aria-label="Sections">
          <button type="button" className="chip" aria-pressed={!active} onClick={() => setCat('')}>
            All
          </button>
          {cats.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={active === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="list card flush">
        {shown.length === 0 ? <p className="muted small" style={{ padding: 14 }}>Nothing matches.</p> : null}
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            className="list-item click catalog-row"
            onClick={() => {
              onPick(p);
              setAdded((n) => n + 1);
            }}
          >
            <span className="main-text">
              <b>{p.name}</b>
              <span>
                {[p.category, p.turnaround, p.revisions ? `${p.revisions} revisions` : '', p.includes.slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="catalog-price">
              <b>{priceText(p, audience)}</b>
              {p.studentPrice && p.unit !== 'percent' ? <span className="tiny muted">{audience === 'student' ? `Business ${peso(p.price)}` : `Student ${peso(p.studentPrice)}`}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

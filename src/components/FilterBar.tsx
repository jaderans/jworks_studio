import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from './ui';
import { SearchInput, Select } from './form';
import { PERIOD_LABEL, type Period } from '../lib/time';

/**
 * The list pages' filter bar: search, a Filters button that shows or hides the
 * dropdowns (remembered per page), and Clear when anything is filtered.
 * Dropdowns inside size to their content instead of stretching across the page.
 */

const prefKey = (id: string) => `jw-filters-${id}`;

function readOpen(id: string): boolean {
  try {
    return localStorage.getItem(prefKey(id)) === '1';
  } catch {
    return false;
  }
}

function writeOpen(id: string, open: boolean) {
  try {
    localStorage.setItem(prefKey(id), open ? '1' : '0');
  } catch {
    /* private mode: it just won't be remembered */
  }
}

export function FilterBar({
  id,
  search,
  active = 0,
  onClear,
  lead,
  trail,
  children,
}: {
  /** Remembers whether this page's filters are shown. */
  id: string;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** How many filters differ from their default (shown on the button). */
  active?: number;
  /** Resets the filters and the search. */
  onClear?: () => void;
  /** Always-visible control before the search, e.g. a view switch. */
  lead?: ReactNode;
  /** Always-visible control after the Filters button. */
  trail?: ReactNode;
  /** The dropdowns and toggles that the Filters button shows and hides. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id));
  const toggle = () => {
    setOpen(!open);
    writeOpen(id, !open);
  };
  const searching = !!search?.value.trim();
  return (
    <div className="filter-bar">
      <div className="filters">
        {lead}
        {search ? <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} /> : null}
        {children ? (
          <Button className={`filter-toggle${active ? ' on' : ''}`} aria-expanded={open} aria-controls={`filters-${id}`} onClick={toggle}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {active ? <span className="filter-count">{active}</span> : null}
          </Button>
        ) : null}
        {onClear && (active > 0 || searching) ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X size={15} aria-hidden="true" /> Clear
          </Button>
        ) : null}
        {trail}
      </div>
      {children && open ? (
        <div className="filters filter-panel" id={`filters-${id}`} role="group" aria-label="Filters">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** "Any time / This month / … / Last year", for lists with dates. */
export function PeriodSelect({ value, onChange, label = 'When' }: { value: Period; onChange: (p: Period) => void; label?: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Period)}>
      <option value="">Any time</option>
      {(Object.keys(PERIOD_LABEL) as Exclude<Period, ''>[]).map((p) => (
        <option key={p} value={p}>
          {PERIOD_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}

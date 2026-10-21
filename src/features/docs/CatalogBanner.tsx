import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DownloadCloud } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout } from '../../components/ui';
import { catalogNeedsUpdate, loadCatalog } from '../../services/catalog';

/** One-time upgrade banner for devices from the first version of the app. */
export function CatalogBanner() {
  const app = useApp();
  const needs = useLiveQuery(catalogNeedsUpdate, []);
  const [busy, setBusy] = useState(false);
  if (!needs || !app.can('money')) return null;
  return (
    <Callout tone="info" title="Load the current price list and contract templates">
      <div className="row wrap between">
        <span>Adds the October 2026 price list (business and student prices, add-ons, ownership) and the 13 v1.0 contract templates. The old SMM-only packages are archived, so old quotes still open.</span>
        <Button
          variant="teal"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadCatalog();
              app.toast(`Loaded ${r.added} price list items and ${r.templates} contract templates`, { tone: 'good' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <DownloadCloud size={16} /> {busy ? 'Loading…' : 'Load it'}
        </Button>
      </div>
    </Callout>
  );
}

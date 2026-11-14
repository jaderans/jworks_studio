import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DownloadCloud } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout } from '../../components/ui';
import { catalogStatus, loadCatalog } from '../../services/catalog';
import { SEED_TEMPLATES } from '../../domain/contractTemplates';

/** Offers the current price list and contract templates once per catalog version (edited items stay as they are). */
export function CatalogBanner() {
  const app = useApp();
  const status = useLiveQuery(catalogStatus, []);
  const [busy, setBusy] = useState(false);
  if (!status?.needs || !app.can('money')) return null;
  const first = status.version < 1;
  return (
    <Callout tone="info" title={first ? 'Load the current price list and contract templates' : 'New: 8 contract templates and 12 price list sections'}>
      <div className="row wrap between">
        <span>
          {first
            ? `Adds the price list (business and student prices, add-ons, ownership, merch production, printing, kits and video) and the ${SEED_TEMPLATES.length} contract templates. The old SMM-only packages are archived, so old quotes still open.`
            : 'Merch Production, Packaging & Labels, Illustration & Mascot, Design Retainer, Weddings & Celebrations, Thesis & Research Visuals, Company Profile & Pitch Deck, and Government & LGU, each with its prices; plus situation kits, stationery, printing (sintra menu boards, sticker labels, tarps), video, and sticker design prices that match the POS. Items you edited stay as they are.'}
        </span>
        <Button
          variant="teal"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadCatalog();
              const extra = [r.repriced ? `${r.repriced} sticker prices now match the POS` : '', r.updated ? 'Motion Graphics now offers video' : ''].filter(Boolean).join('; ');
              app.toast(`Added ${r.added} price list items and ${r.templates} contract templates${extra ? `. ${extra}` : ''}`, { tone: 'good', ms: 8000 });
            } finally {
              setBusy(false);
            }
          }}
        >
          <DownloadCloud size={16} /> {busy ? 'Adding…' : first ? 'Load it' : 'Add them'}
        </Button>
      </div>
    </Callout>
  );
}

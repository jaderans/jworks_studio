import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DownloadCloud } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout } from '../../components/ui';
import { catalogStatus, loadCatalog } from '../../services/catalog';
import { SEED_TEMPLATES } from '../../domain/contractTemplates';

const ACADEMIC =
  'Academic commissions: thesis and research brochures, proposal-defense, class report and lecture slides, slide templates, reviewers, capstone logos and a Thesis Defense Kit (slides, poster and brochure), with student prices; the Thesis & Research contract becomes Academic & Thesis Visuals.';

/** Offers the current price list and contract templates once per catalog version (edited items stay as they are). */
export function CatalogBanner() {
  const app = useApp();
  const status = useLiveQuery(catalogStatus, []);
  const [busy, setBusy] = useState(false);
  if (!status?.needs || !app.can('money')) return null;
  const v = status.version;
  const title = v < 1 ? 'Load the current price list and contract templates' : v < 2 ? 'New: 8 contract templates and 12 price list sections' : 'New in the price list: academic commissions';
  const body =
    v < 1
      ? `Adds the price list (business and student prices, add-ons, ownership, merch production, printing, kits, academic work and video) and the ${SEED_TEMPLATES.length} contract templates. The old SMM-only packages are archived, so old quotes still open.`
      : v < 2
        ? `Merch Production, Packaging & Labels, Illustration & Mascot, Design Retainer, Weddings & Celebrations, Academic & Thesis Visuals, Company Profile & Pitch Deck, and Government & LGU, each with its prices; plus situation kits, stationery, printing (sintra menu boards, sticker labels, tarps), video, and sticker design prices that match the POS. ${ACADEMIC} Items you edited stay as they are.`
        : `${ACADEMIC} Items you edited stay as they are.`;
  return (
    <Callout tone="info" title={title}>
      <div className="row wrap between">
        <span>{body}</span>
        <Button
          variant="teal"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadCatalog();
              const extra = [r.repriced ? `${r.repriced} sticker prices now match the POS` : '', r.updated ? `${r.updated} template${r.updated === 1 ? '' : 's'} updated` : ''].filter(Boolean).join('; ');
              app.toast(`Added ${r.added} price list items${r.templates ? ` and ${r.templates} contract templates` : ''}${extra ? `. ${extra}` : ''}`, { tone: 'good', ms: 8000 });
            } finally {
              setBusy(false);
            }
          }}
        >
          <DownloadCloud size={16} /> {busy ? 'Adding…' : v < 1 ? 'Load it' : 'Add them'}
        </Button>
      </div>
    </Callout>
  );
}

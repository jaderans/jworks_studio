import { toCents } from '../lib/money';
import type { Audience, Deliverable, Package, ServiceKey, Syncable } from '../db/types';

/**
 * The studio catalog, from the JoshWorks Price List (October 2026, current
 * prices). Contract-set packages carry both the business and the student-org
 * price. Client-specific quotes are not here: they're added per quote.
 */

export type SeedPackage = Omit<Package, keyof Syncable>;
export type CatalogSeed = SeedPackage & { id: string };

const d = (label: string, qty: number, hours: number, role: string): Deliverable => ({ label, qty, hours, role });
const SR = 'Senior Designer';
const MID = 'Mid Designer';
const JR = 'Junior Designer';
const ADMIN = 'Admin / Coordination';
const OJT = 'Trainee / OJT';
const OWNER = 'Creative Director / Owner';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

let order = 0;

interface Opts {
  student?: number | null;
  includes?: string;
  revisions?: number;
  turnaround?: string;
  unit?: Package['unit'];
  audience?: Audience;
  tagline?: string;
  kind?: Package['kind'];
  notes?: string;
}

function item(category: string, service: ServiceKey | '', name: string, price: number, o: Opts = {}): CatalogSeed {
  const percent = o.unit === 'percent';
  return {
    id: `cat-${slug(category)}-${slug(name)}`,
    kind: o.kind ?? 'design',
    name,
    tagline: o.tagline ?? '',
    price: percent ? Math.round(price * 100) : toCents(price),
    studentPrice: o.student ? toCents(o.student) : null,
    unit: o.unit ?? 'project',
    platforms: [],
    deliverables: [],
    includes: o.includes ? o.includes.split(/\s*;\s*/).filter(Boolean) : [],
    revisionsPerPost: 0,
    minTermMonths: 0,
    service,
    active: 1,
    sort: order++,
    notes: o.notes ?? '',
    category,
    audience: o.audience ?? (o.student ? 'any' : 'any'),
    turnaround: o.turnaround ?? '',
    revisions: o.revisions ?? 0,
  };
}

const addon = (category: string, name: string, price: number, o: Opts = {}) => item(category, '', name, price, { ...o, kind: 'addon' });
const pct = (category: string, name: string, percent: number, o: Opts = {}) => addon(category, name, percent, { ...o, unit: 'percent' });

const B = 'Branding';
const SMM = 'Social media management';
const MERCH = 'Merch';
const EVENT = 'Event & publication campaign';
const ELECT = 'Student election';
const TOUR = 'Tournament';
const YB = 'Yearbook';
const WB = 'Academic workbook';
const STORY = 'Storybook';
const ANIM = 'Animated storybook';
const BOOK = 'Accreditation booklet';
const INST = 'Institutional branding';
const WEB = 'Web design';
const MOTION = 'Motion graphics';
const MAP = 'Isometric map';
const TRAIN = 'Design training';
// November 2026 additions
const RET = 'Design retainer';
const MAKE = 'Merch production';
const PACK = 'Packaging & labels';
const ILLUS = 'Illustration & mascots';
const STAT = 'Print & stationery design';
const PRINT = 'Printing';
const KITS = 'Situation kits';
const CELEB = 'Weddings & celebrations';
const RESEARCH = 'Research & academic visuals';
const GOV = 'Government & LGU';
const DECK = 'Presentations & company profiles';
const VIDEO = 'Video';
export const ADDONS = 'Add-ons';
export const OWNERSHIP = 'Ownership';

/** A monthly design retainer: up to a set number of designs, three months at least. */
function retainer(name: string, price: number, student: number, o: Opts, deliverables: Deliverable[]): CatalogSeed {
  return { ...item(RET, 'other', name, price, { ...o, student, unit: 'month' }), deliverables, minTermMonths: 3 };
}

/** Partner-shop printing: the internal note every such line carries. */
const PARTNER = 'Printed by a partner shop: confirm their current rate before quoting.';
/** The POS sticker printing rate card (JoshWorks Sticker Printing · Rates 2026). */
const POS_RATES = 'Same as the POS sticker printing rate card. Minimum 3 sheets.';

export const SEED_PACKAGES: CatalogSeed[] = [
  // ----- Branding (contract set v1.0) -----
  item(B, 'branding', 'Budget Logo', 2450, { student: 1800, revisions: 2, turnaround: '7–14 days', includes: '2 logo concepts; Primary logo only; Typography selection; PNG files' }),
  item(B, 'branding', 'Essential Branding', 3500, { student: 2700, revisions: 3, turnaround: '7–14 days', includes: '3 logo concepts; Primary + secondary logo; Font selection; PNG, JPEG and PDF files' }),
  item(B, 'branding', 'Professional Branding', 5800, {
    student: 4500,
    revisions: 3,
    turnaround: '12–18 days',
    includes: 'Everything in Essential; 5-color palette; Mini brand board; Basic brand guide; Facebook + Instagram social kit',
    notes: 'Raised rate card (not yet in the contracts): ₱9,800.',
  }),
  item(B, 'branding', 'Complete Branding', 10700, {
    student: 8300,
    revisions: 3,
    turnaround: '14–21 days',
    includes: 'Everything in Professional; 2 social post templates; Simple style guide; Business card; Letterhead',
    notes: 'Raised rate card: ₱12,500.',
  }),
  item(B, 'branding', 'Premium Branding', 16500, {
    student: 12800,
    revisions: 4,
    turnaround: '21–30 days',
    includes: 'Everything in Complete; Full style guide; Up to 5 merch designs; 3 social post templates',
    notes: 'Raised rate card: ₱18,800.',
  }),
  item(B, 'branding', 'Elite Branding', 26000, {
    student: 20000,
    revisions: 5,
    turnaround: '30–40 days',
    includes: 'Everything in Premium; 5 social post templates; Certificate; PowerPoint template; Packaging; Tarpaulin; Priority support',
    notes: 'Raised rate card: ₱29,800.',
  }),
  item(B, 'branding', 'Brand + Website', 37000, { student: 30000, revisions: 6, turnaround: '30–45 days', includes: 'Premium Branding; Website up to 5 pages; Mobile-responsive; Basic SEO' }),

  // ----- Social media management (current retainers) -----
  {
    ...item(SMM, 'smm', 'Starter', 4500, { kind: 'smm', unit: 'month', revisions: 2, tagline: 'A steady, good-looking feed for a small business.' }),
    platforms: ['facebook', 'instagram'],
    deliverables: [d('Static and carousel posts', 8, 0.75, MID), d('Captions, hashtags and scheduling', 8, 0.25, ADMIN), d('Monthly mini report', 1, 1, ADMIN), d('Client check-ins', 1, 1, ADMIN)],
    includes: ['Facebook + Instagram', '8 posts a month (static and carousels)', 'Captions and hashtags written per platform', 'Scheduling at the best local times', '2 revisions per post', '1-page monthly report'],
    revisionsPerPost: 2,
    minTermMonths: 3,
  },
  {
    ...item(SMM, 'smm', 'Growth', 7500, { kind: 'smm', unit: 'month', revisions: 2, tagline: 'Adds reels, stories and replies so the page grows.' }),
    platforms: ['facebook', 'instagram'],
    deliverables: [
      d('Static and carousel posts', 10, 0.75, MID),
      d('Short reels (template-based)', 2, 1.5, MID),
      d('Stories', 4, 0.25, JR),
      d('Captions, hashtags and scheduling', 12, 0.25, ADMIN),
      d('Community replies, 15 min, 3× a week', 13, 0.25, OJT),
      d('Monthly report with next steps', 1, 1.5, ADMIN),
    ],
    includes: ['Facebook + Instagram', '12 posts a month (10 static/carousel + 2 reels)', '4 stories a month', 'Comment and message replies 3× a week', 'Monthly report with next steps', '2 revisions per post'],
    revisionsPerPost: 2,
    minTermMonths: 3,
  },
  {
    ...item(SMM, 'smm', 'Plus', 12000, { kind: 'smm', unit: 'month', revisions: 2, tagline: 'Three platforms, motion and a monthly strategy call.' }),
    platforms: ['facebook', 'instagram', 'tiktok'],
    deliverables: [
      d('Static and carousel posts', 8, 0.75, MID),
      d('Reels / TikToks (template-based)', 6, 1.25, MID),
      d('Motion graphics on 2 reels', 2, 1, MID),
      d('Stories', 8, 0.25, JR),
      d('Captions, hashtags and scheduling', 14, 0.25, ADMIN),
      d('Community replies, 15 min every weekday', 22, 0.25, OJT),
      d('Monthly analytics report', 1, 2, ADMIN),
      d('Strategy call', 1, 1, OWNER),
    ],
    includes: ['Facebook + Instagram + TikTok', '14 posts a month (8 static + 6 reels, 2 with motion)', '8 stories a month', 'Replies every weekday', 'Monthly analytics report and strategy call', '2 revisions per post'],
    revisionsPerPost: 2,
    minTermMonths: 3,
  },

  // ----- Design retainer (monthly design support, no posting) -----
  retainer('Retainer Lite: 8 designs a month', 3800, 3000, {
    revisions: 2,
    turnaround: '2–3 working days a request',
    tagline: 'Steady design for a small business or org, without posting.',
    includes: 'Up to 8 designs a month (pubmats, posts, flyers, simple layouts); 2 revisions per design; One request channel; Brand kit kept on file',
    notes: 'Minimum 3 months. Unused designs don’t carry over.',
  }, [d('Designs', 8, 0.6, MID), d('Requests and coordination', 1, 1.5, ADMIN)]),
  retainer('Retainer Standard: 15 designs a month', 6800, 5400, {
    revisions: 2,
    turnaround: '2 working days a request',
    tagline: 'For pages and teams that post and print every week.',
    includes: 'Up to 15 designs a month; Resizes for 2 platforms; 2 revisions per design; Priority over one-off jobs; Monthly recap',
    notes: 'Minimum 3 months. Unused designs don’t carry over.',
  }, [d('Designs', 15, 0.6, MID), d('Resizes', 15, 0.1, JR), d('Requests and coordination', 1, 2, ADMIN)]),
  retainer('Retainer Pro: 25 designs a month', 12500, 9800, {
    revisions: 3,
    turnaround: 'Next working day a request',
    tagline: 'A design team on call, print layouts included.',
    includes: 'Up to 25 designs a month, incl. 2 print layouts (tarp, brochure or menu); Resizes for every platform; 3 revisions per design; Same-week priority; Monthly design call',
    notes: 'Minimum 3 months. Unused designs don’t carry over.',
  }, [d('Designs', 25, 0.6, MID), d('Print layouts', 2, 2, SR), d('Resizes', 25, 0.1, JR), d('Design call and coordination', 1, 3, ADMIN)]),
  addon(RET, 'Extra design beyond the monthly limit', 500, { unit: 'piece' }),
  addon(RET, 'Same-day rush request', 300, { unit: 'piece' }),
  addon(RET, 'Animated version of a design (5–10 s)', 800, { unit: 'piece' }),

  // ----- Merch, shirt and print design (design fees; printing quoted separately) -----
  // Sticker design rates match the POS sticker illustration rate card.
  item(MERCH, 'stickers', 'Sticker: small / simple', 100, { unit: 'piece' }),
  item(MERCH, 'stickers', 'Sticker: detailed', 220, { unit: 'piece' }),
  item(MERCH, 'stickers', 'Stickers: 2 designs (small)', 180),
  item(MERCH, 'stickers', 'Stickers: 2 designs (detailed)', 390),
  item(MERCH, 'stickers', 'Stickers: 5 designs (small)', 450),
  item(MERCH, 'stickers', 'Stickers: 5 designs (detailed)', 950),
  item(MERCH, 'stickers', 'Stickers: 10 designs (small)', 850),
  item(MERCH, 'stickers', 'Stickers: 10 designs (detailed)', 1700),
  item(MERCH, 'merch', 'ID lanyard (org-themed / custom pattern)', 500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Button pin: simple', 100, { unit: 'piece' }),
  item(MERCH, 'merch', 'Button pin: detailed illustration', 250, { unit: 'piece' }),
  item(MERCH, 'merch', 'Shirt: minimal (chest / pocket)', 200, { unit: 'piece' }),
  item(MERCH, 'merch', 'Shirt: full front OR back', 900, { unit: 'piece' }),
  item(MERCH, 'merch', 'Shirt: detailed front + back', 1500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Shirt: bundle of 3', 2500),
  item(MERCH, 'merch', 'Shirt: bundle of 5', 3800),
  item(MERCH, 'merch', 'Shirt: sublimation front + back', 2000, { unit: 'piece' }),
  item(MERCH, 'merch', 'Polo shirt: simple (logo + name)', 500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Polo shirt: front & back', 800, { unit: 'piece' }),
  item(MERCH, 'merch', 'Polo shirt: full custom', 1200, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tote bag: simple front', 200, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tote bag: full graphic', 700, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tote bags: set of 3', 1800),
  item(MERCH, 'merch', 'Hoodie: front + back', 650, { unit: 'piece' }),
  item(MERCH, 'merch', 'Hoodie: full custom', 1000, { unit: 'piece' }),
  item(MERCH, 'merch', 'Windbreaker: full layout', 1500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Varsity jacket: front + back patches', 900, { unit: 'piece' }),
  item(MERCH, 'merch', 'Varsity jacket: full custom', 1300, { unit: 'piece' }),
  item(MERCH, 'merch', 'Jersey: single (shirt + shorts)', 1500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Jersey: full team set (name, number, logo)', 2000),
  item(MERCH, 'merch', 'Cap: embroidery-style front', 350, { unit: 'piece' }),
  item(MERCH, 'merch', 'Cap: full custom', 600, { unit: 'piece' }),
  item(MERCH, 'merch', 'Mug: simple logo / text', 250, { unit: 'piece' }),
  item(MERCH, 'merch', 'Mug: full wrap illustration', 500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Mugs: set of 3', 1200),
  item(MERCH, 'merch', 'Tumbler: minimal / name', 300, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tumbler: full wrap', 600, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tumblers: set of 3', 1500),
  item(MERCH, 'merch', 'Keychain: simple icon / logo', 100, { unit: 'piece' }),
  item(MERCH, 'merch', 'Keychain: character / detailed', 200, { unit: 'piece' }),
  item(MERCH, 'merch', 'Keychains: set of 3', 500),
  item(MERCH, 'merch', 'Keychains: set of 5', 800),
  item(MERCH, 'merch', 'Notebook: simple cover', 250, { unit: 'piece' }),
  item(MERCH, 'merch', 'Notebook: full custom cover', 500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Notebooks: set of 3 covers', 1200),
  item(MERCH, 'merch', 'Tarpaulin: standard event', 500, { unit: 'piece' }),
  item(MERCH, 'merch', 'Tarpaulin: large / detailed', 900, { unit: 'piece' }),
  item(MERCH, 'merch', 'Event poster / pubmat', 300, { unit: 'piece' }),
  item(MERCH, 'merch', 'Event set (poster + story + profile frame)', 700),
  item(MERCH, 'merch', 'Full campaign set (5 graphics)', 1400),
  addon(MERCH, 'ID card template (matches the lanyard)', 150),
  addon(MERCH, 'Mockup', 150),
  addon(MERCH, 'Team mockup', 200),
  addon(MERCH, 'Tarpaulin rush (within 24 hours)', 200),

  // ----- Merch production (made by JoshWorks or its partners; per piece, by quantity; design is separate) -----
  item(MAKE, 'merch', 'Button pins 58 mm (20–99 pcs)', 35, { unit: 'piece', turnaround: '3–5 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 58 mm (100+ pcs)', 28, { unit: 'piece', turnaround: '5–7 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 44 mm (20–99 pcs)', 30, { unit: 'piece', turnaround: '3–5 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 44 mm (100+ pcs)', 22, { unit: 'piece', turnaround: '5–7 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 32 mm (20–99 pcs)', 25, { unit: 'piece', turnaround: '3–5 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 32 mm (100+ pcs)', 18, { unit: 'piece', turnaround: '5–7 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 25 mm (20–99 pcs)', 22, { unit: 'piece', turnaround: '3–5 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Button pins 25 mm (100+ pcs)', 15, { unit: 'piece', turnaround: '5–7 working days', includes: 'Full-color print; Glossy or matte; Safety-pin back' }),
  item(MAKE, 'merch', 'Enamel pins, soft enamel up to 1.25 in (50–99 pcs)', 180, {
    unit: 'piece',
    turnaround: '4–6 weeks after proof',
    includes: 'Custom mold and colors; Rubber clutch back; Poly bag each',
    notes: 'Partner factory: get their quote (mold, colors, shipping) first. Hard enamel, glitter, glow or bigger sizes are quoted per order.',
  }),
  item(MAKE, 'merch', 'Enamel pins, soft enamel up to 1.25 in (100+ pcs)', 135, {
    unit: 'piece',
    turnaround: '4–6 weeks after proof',
    includes: 'Custom mold and colors; Rubber clutch back; Poly bag each',
    notes: 'Partner factory: get their quote (mold, colors, shipping) first.',
  }),
  item(MAKE, 'merch', 'Acrylic keychains 2 in, double-sided (20–49 pcs)', 85, { unit: 'piece', turnaround: '7–14 days', includes: 'Clear acrylic 3 mm; Printed both sides; Ring or lobster clasp' }),
  item(MAKE, 'merch', 'Acrylic keychains 2 in, double-sided (50+ pcs)', 65, { unit: 'piece', turnaround: '7–14 days', includes: 'Clear acrylic 3 mm; Printed both sides; Ring or lobster clasp' }),
  item(MAKE, 'merch', 'Acrylic shaker keychains (20+ pcs)', 190, { unit: 'piece', turnaround: '10–14 days', includes: 'Two-layer acrylic; Glitter or charms inside; Ring or lobster clasp' }),
  item(MAKE, 'merch', 'Acrylic standees 4–5 in (10+ pcs)', 180, { unit: 'piece', turnaround: '7–14 days', includes: 'Clear acrylic with base; Full-color print' }),
  item(MAKE, 'stickers', 'Sticker sheet A4: standard matte or glossy vinyl', 60, { unit: 'piece', turnaround: '4–7 days', includes: 'Waterproof vinyl; Kiss cut; About 15 stickers of 2 × 2 in a sheet', notes: POS_RATES }),
  item(MAKE, 'stickers', 'Sticker sheet A4: premium matte or glossy vinyl', 80, { unit: 'piece', turnaround: '4–7 days', includes: 'Thicker premium vinyl; Kiss cut', notes: POS_RATES }),
  item(MAKE, 'stickers', 'Sticker sheet A4: satin, glitter or prismatic', 85, { unit: 'piece', turnaround: '4–7 days', includes: 'Premium finish; Kiss cut', notes: POS_RATES }),
  item(MAKE, 'stickers', 'Sticker sheet A4: holo rainbow or broken glass', 90, { unit: 'piece', turnaround: '4–7 days', includes: 'Holographic finish; Kiss cut', notes: POS_RATES }),
  item(MAKE, 'stickers', 'Sticker sheet A4: holo stars, hearts or sparkle', 95, { unit: 'piece', turnaround: '4–7 days', includes: 'Holographic pattern; Kiss cut', notes: POS_RATES }),
  item(MAKE, 'stickers', 'Sticker sheet A4: transparent (clear)', 100, { unit: 'piece', turnaround: '4–7 days', includes: 'Clear vinyl; Kiss cut', notes: POS_RATES }),
  addon(MAKE, 'Die cut (per A4 sheet)', 10, { unit: 'piece', notes: POS_RATES }),
  addon(MAKE, 'Peel-off sheet cut: kiss + die (per A4 sheet)', 17, { unit: 'piece', notes: POS_RATES }),
  item(MAKE, 'merch', 'ID laces, full-color sublimation (50–99 pcs)', 85, { unit: 'piece', turnaround: '10–14 days', includes: '3/4 in polyester; Printed both sides; Metal hook', notes: 'Partner supplier. ID cards are separate (Printing).' }),
  item(MAKE, 'merch', 'ID laces, full-color sublimation (100+ pcs)', 65, { unit: 'piece', turnaround: '10–14 days', includes: '3/4 in polyester; Printed both sides; Metal hook', notes: 'Partner supplier.' }),
  item(MAKE, 'merch', 'Shirts + DTF print, front (12–49 pcs)', 380, { unit: 'piece', turnaround: '7–10 days', includes: 'Cotton shirt, S–XL; Full-color print up to A4; Your shirt color', notes: PARTNER }),
  item(MAKE, 'merch', 'Shirts + DTF print, front and back (12–49 pcs)', 480, { unit: 'piece', turnaround: '7–10 days', includes: 'Cotton shirt, S–XL; Full-color prints up to A4, front and back', notes: PARTNER }),
  item(MAKE, 'merch', 'Shirts + DTF print, front (50+ pcs)', 330, { unit: 'piece', turnaround: '10–14 days', includes: 'Cotton shirt, S–XL; Full-color print up to A4', notes: PARTNER }),
  item(MAKE, 'merch', 'Full sublimation shirts, dri-fit (12+ pcs)', 480, { unit: 'piece', turnaround: '10–14 days', includes: 'All-over print; Dri-fit fabric; Round neck', notes: PARTNER }),
  addon(MAKE, 'Shirt size 2XL and up', 50, { unit: 'piece' }),
  item(MAKE, 'merch', 'Canvas tote bags + print (20+ pcs)', 230, { unit: 'piece', turnaround: '7–10 days', includes: 'Canvas tote 12 × 14 in; Full-color print, one side', notes: PARTNER }),
  item(MAKE, 'merch', 'Sublimation mugs 11 oz, full wrap (12+ pcs)', 180, { unit: 'piece', turnaround: '5–7 days', includes: 'White ceramic mug; Full-wrap print; Gift box', notes: PARTNER }),
  item(MAKE, 'merch', 'Tumblers with print, 20 oz (12+ pcs)', 350, { unit: 'piece', turnaround: '7–10 days', includes: 'Stainless steel; Wrap or logo print', notes: PARTNER }),
  item(MAKE, 'merch', 'Ref magnets 2 × 3 in (50+ pcs)', 30, { unit: 'piece', turnaround: '5–7 days', includes: 'Full-color print; Flexible magnet' }),
  item(MAKE, 'merch', 'Bookmarks 2 × 6 in, laminated (50+ pcs)', 18, { unit: 'piece', turnaround: '3–5 days', includes: 'Full color, both sides; Matte or glossy laminate' }),
  item(MAKE, 'merch', 'Postcards 4 × 6 in (20+ pcs)', 25, { unit: 'piece', turnaround: '3–5 days', includes: 'Full color on 300 gsm card' }),
  item(MAKE, 'merch', 'Art prints A5', 50, { unit: 'piece', turnaround: '2–3 days', includes: 'Full color on matte or glossy card' }),
  item(MAKE, 'merch', 'Art prints A4', 80, { unit: 'piece', turnaround: '2–3 days', includes: 'Full color on matte or glossy card' }),
  item(MAKE, 'merch', 'Notebooks A5 with custom cover (20+ pcs)', 160, { unit: 'piece', turnaround: '7–10 days', includes: 'Printed cover; 80 ruled or plain pages', notes: PARTNER }),
  item(MAKE, 'merch', 'Embroidered patches up to 3 in (50+ pcs)', 95, { unit: 'piece', turnaround: '3–4 weeks', includes: 'Up to 7 thread colors; Iron-on or sew-on back', notes: 'Partner factory: confirm their quote first.' }),
  addon(MAKE, 'Pin back upgrade: magnet, keychain, mirror or bottle opener', 15, { unit: 'piece' }),
  addon(MAKE, 'Individual packing: backing card + sleeve (from)', 12, { unit: 'piece', notes: 'POS rate card: small ₱11–14, medium ₱13–16, large ₱16–19; full packs ₱17–27.' }),
  addon(MAKE, 'Physical sample before the full run (from)', 200),

  // ----- Packaging & labels (design; label printing is under Printing) -----
  item(PACK, 'packaging', 'Product label: one design', 1800, { revisions: 2, turnaround: '5–7 days', includes: '2 concepts; One label size; Room for your required label details; Print-ready PDF' }),
  item(PACK, 'packaging', 'Product labels: up to 3 variants', 3200, { revisions: 2, turnaround: '7–10 days', includes: 'One master design; 3 flavors, scents or sizes; Print-ready PDFs' }),
  item(PACK, 'packaging', 'Bottle or jar wrap label', 2200, { revisions: 2, turnaround: '5–7 days', includes: 'Wrap-around layout; Front, side and back panels; Print-ready PDF' }),
  item(PACK, 'packaging', 'Pouch or sachet (front + back)', 3500, { revisions: 3, turnaround: '7–10 days', includes: 'Front and back; On the printer’s dieline; 3D mockup' }),
  item(PACK, 'packaging', 'Box packaging with dieline (one box)', 4500, { revisions: 3, turnaround: '10–14 days', includes: 'Every panel; Dieline set-up; 3D mockup; Print-ready PDF' }),
  item(PACK, 'packaging', 'Packaging line: up to 5 products', 12800, { revisions: 3, turnaround: '14–21 days', includes: 'Label system for 5 products; One box or pouch; Mockups; Print-ready dielines' }),
  item(PACK, 'packaging', 'Hang tag + thank-you card', 1200, { revisions: 2, turnaround: '3–5 days', includes: 'Both pieces, front and back; Print-ready PDF' }),
  item(PACK, 'packaging', 'Sticker seal or packaging sticker', 600, { revisions: 2, turnaround: '2–4 days', includes: 'Round or custom shape; Print-ready file' }),
  item(PACK, 'packaging', 'Paper bag or tissue print', 1200, { revisions: 2, turnaround: '3–5 days', includes: 'Repeat pattern or logo layout; Print-ready file' }),
  addon(PACK, 'Nutrition facts table layout', 500),
  addon(PACK, 'Dieline set-up or adjustment', 800),
  addon(PACK, '3D packaging mockup', 500, { unit: 'piece' }),

  // ----- Illustration & mascots -----
  item(ILLUS, 'illustration', 'Spot illustration: simple', 800, { student: 600, revisions: 2, turnaround: '3–5 days', includes: 'One subject; Flat colors; Transparent PNG' }),
  item(ILLUS, 'illustration', 'Spot illustration: detailed', 1500, { student: 1100, revisions: 2, turnaround: '4–6 days', includes: 'One subject with shading and texture; Transparent PNG' }),
  item(ILLUS, 'illustration', 'Full illustration with background', 2800, { student: 2200, revisions: 3, turnaround: '7–10 days', includes: 'Characters in a full scene; Print size up to A3; PNG + PDF' }),
  item(ILLUS, 'illustration', 'Portrait: 1 person or pet', 1200, { student: 900, revisions: 2, turnaround: '4–6 days', includes: 'From your photo; Simple background; PNG' }),
  item(ILLUS, 'illustration', 'Chibi or sticker-style character', 600, { student: 450, revisions: 2, turnaround: '3–5 days', includes: 'One character; Transparent PNG' }),
  item(ILLUS, 'illustration', 'Character design: one character', 2500, { student: 1900, revisions: 3, turnaround: '5–7 days', includes: '2 concept sketches; Front view; Color palette' }),
  item(ILLUS, 'illustration', 'Mascot design: character + 3 poses', 5500, { student: 4200, revisions: 3, turnaround: '10–14 days', includes: 'Mascot design; 3 poses; Name lettering; PNG + PDF' }),
  item(ILLUS, 'illustration', 'Mascot kit: character sheet, 6 expressions, 3 poses', 9800, { student: 7500, revisions: 4, turnaround: '14–21 days', includes: 'Front, side and back views; 6 expressions; 3 poses; Usage guide' }),
  item(ILLUS, 'illustration', 'Comic strip or illustrated post (up to 4 panels)', 2200, { student: 1700, revisions: 2, turnaround: '5–7 days', includes: 'Script polish; Up to 4 panels; Lettering' }),
  addon(ILLUS, 'Extra person or pet in a portrait', 600),
  addon(ILLUS, 'Extra pose', 800),
  addon(ILLUS, 'Extra expression', 300),
  addon(ILLUS, 'Turnaround sheet (front, side, back)', 1500),
  pct(ILLUS, 'Commercial-use license (products for sale, ads, packaging)', 25, { tagline: 'Personal use is included; this adds commercial use.' }),

  // ----- Print & stationery design -----
  item(STAT, 'other', 'Business card (2 sides)', 600, { student: 450, revisions: 2, turnaround: '2–3 days' }),
  item(STAT, 'other', 'Letterhead + envelope', 900, { student: 700, revisions: 2, turnaround: '3–4 days' }),
  item(STAT, 'other', 'Certificate (one layout)', 600, { student: 450, revisions: 2, turnaround: '2–3 days' }),
  item(STAT, 'other', 'Flyer or poster (A4 / A5)', 800, { student: 600, revisions: 2, turnaround: '3–4 days' }),
  item(STAT, 'other', 'Bifold brochure (4 panels)', 1800, { student: 1400, revisions: 2, turnaround: '4–6 days' }),
  item(STAT, 'other', 'Trifold brochure (6 panels)', 2500, { student: 1900, revisions: 3, turnaround: '5–7 days' }),
  item(STAT, 'other', 'Menu: 1 page', 1500, { revisions: 2, turnaround: '3–5 days', includes: 'Layout of your dishes and prices; Print-ready PDF' }),
  item(STAT, 'other', 'Menu: up to 4 pages', 3500, { revisions: 3, turnaround: '5–7 days', includes: 'Cover and inside pages; Photos placed; Print-ready PDF' }),
  item(STAT, 'other', 'Menu board (wall or counter)', 1800, { revisions: 2, turnaround: '3–5 days', includes: 'Large-format layout; Ready for sintra or tarpaulin' }),
  item(STAT, 'other', 'Signage or storefront', 2000, { revisions: 2, turnaround: '4–6 days', includes: 'Shop sign layout; Mockup on your storefront photo' }),
  item(STAT, 'other', 'Roll-up banner or standee', 1200, { student: 900, revisions: 2, turnaround: '2–4 days' }),
  item(STAT, 'other', 'Social media graphics: set of 5', 1500, { student: 1100, revisions: 2, turnaround: '3–5 days' }),
  item(STAT, 'other', 'Book cover (front, spine, back)', 4500, { student: 3500, revisions: 3, turnaround: '7–10 days' }),
  item(STAT, 'other', 'Album or single cover art', 2500, { student: 1900, revisions: 3, turnaround: '5–7 days' }),
  item(STAT, 'other', 'Calendar (12 months)', 3500, { student: 2700, revisions: 2, turnaround: '7–10 days' }),
  item(STAT, 'other', 'Resume / CV', 800, { student: 600, revisions: 2, turnaround: '2–3 days' }),
  item(STAT, 'other', 'Gift certificate or loyalty card', 500, { student: 400, revisions: 2, turnaround: '2–3 days' }),
  item(STAT, 'other', 'Photo retouching (per photo)', 150, { unit: 'piece', includes: 'Color, skin and blemish clean-up' }),
  item(STAT, 'other', 'Background removal (per photo)', 60, { unit: 'piece' }),

  // ----- Printing (sticker labels from the POS rate card; the rest by partner shops) -----
  item(PRINT, 'stickers', 'Sticker labels A4: label paper, matte or glossy (food labels)', 60, { unit: 'piece', turnaround: '4–7 days', includes: 'One A4 sheet; Kiss cut', notes: POS_RATES }),
  item(PRINT, 'stickers', 'Sticker labels A4: waterproof vinyl', 60, { unit: 'piece', turnaround: '4–7 days', includes: 'One A4 sheet; Kiss cut', notes: POS_RATES }),
  item(PRINT, 'stickers', 'Sticker labels A4: kraft paper (no white ink)', 50, { unit: 'piece', turnaround: '4–7 days', includes: 'One A4 sheet; Kiss cut', notes: POS_RATES }),
  item(PRINT, 'stickers', 'Sticker labels A4: transparent (clear)', 100, { unit: 'piece', turnaround: '4–7 days', includes: 'One A4 sheet; Kiss cut', notes: POS_RATES }),
  addon(PRINT, 'Die-cut labels (per A4 sheet)', 10, { unit: 'piece', notes: POS_RATES }),
  item(PRINT, 'other', 'Photo paper print A4, glossy', 50, { unit: 'piece', turnaround: '1–2 days', notes: POS_RATES }),
  item(PRINT, 'other', 'Tarpaulin, 13 oz', 22, { unit: 'sqft', turnaround: '1–2 days', includes: 'Full color; Eyelets on request', notes: `${PARTNER} 10 oz is cheaper; 18 oz or backlit costs more.` }),
  item(PRINT, 'other', 'Sintra board menu board, 3 mm', 120, { unit: 'sqft', turnaround: '2–4 days', includes: 'Printed sticker on 3 mm sintra; Laminated; Cut to size', notes: PARTNER }),
  item(PRINT, 'other', 'Sintra board signage, 5 mm', 150, { unit: 'sqft', turnaround: '3–5 days', includes: 'Printed sticker on 5 mm sintra; Laminated; Cut to size', notes: PARTNER }),
  item(PRINT, 'other', 'Acrylic sign with print (from)', 450, { unit: 'sqft', turnaround: '5–7 days', includes: 'Clear or white acrylic; UV print or sticker', notes: PARTNER }),
  item(PRINT, 'other', 'Roll-up banner 2 × 5 ft (print + stand)', 1800, { unit: 'piece', turnaround: '2–3 days', includes: 'Print; Aluminum stand; Carry bag', notes: PARTNER }),
  item(PRINT, 'other', 'X-banner 2 × 5 ft (print + stand)', 1200, { unit: 'piece', turnaround: '2–3 days', includes: 'Print; X-stand', notes: PARTNER }),
  item(PRINT, 'other', 'Business cards, matte, 2 sides (min. 100)', 4.5, { unit: 'piece', turnaround: '2–3 days', notes: PARTNER }),
  item(PRINT, 'other', 'Business cards, laminated or textured (min. 100)', 6.5, { unit: 'piece', turnaround: '3–4 days', notes: PARTNER }),
  item(PRINT, 'other', 'Flyers A5, full color (min. 100)', 8, { unit: 'piece', turnaround: '2–3 days', notes: PARTNER }),
  item(PRINT, 'other', 'Flyers A4, full color (min. 50)', 15, { unit: 'piece', turnaround: '2–3 days', notes: PARTNER }),
  item(PRINT, 'other', 'Posters A3, full color', 45, { unit: 'piece', turnaround: '1–2 days', notes: PARTNER }),
  item(PRINT, 'other', 'Certificates on specialty paper', 25, { unit: 'piece', turnaround: '1–2 days', notes: PARTNER }),
  item(PRINT, 'other', 'PVC ID cards, 2 sides', 75, { unit: 'piece', turnaround: '3–5 days', notes: PARTNER }),
  item(PRINT, 'other', 'Menus A4, laminated', 60, { unit: 'piece', turnaround: '1–2 days', notes: PARTNER }),
  addon(PRINT, 'Delivery or installation in Iloilo City (from)', 300),

  // ----- Event & publication campaign -----
  item(EVENT, 'other', 'Digital Campaign Starter', 20800, { student: 16000, revisions: 2, turnaround: '14–18 days', includes: '12 publication materials; 4 flyers / posters; 6-page newsletter; FB cover + DP frame' }),
  item(EVENT, 'other', 'Digital Campaign Expansion', 25800, { student: 20000, revisions: 3, turnaround: '18–24 days', includes: '15 publication materials; 5 flyers; 8-page newsletter; Basic template system' }),
  item(EVENT, 'other', 'Full Digital Media System', 30800, { student: 24000, revisions: 4, turnaround: '24–30 days', includes: '18 publication materials; 6 flyers; 10-page newsletter; Template kit; Mini brand guide' }),
  item(EVENT, 'other', 'Premium Media Campaign', 40800, { student: 32000, revisions: 5, turnaround: '30–40 days', includes: '22 publication materials; 8 flyers; 12-page newsletter; Full layout system; Editable Canva workspace' }),

  // ----- Situation kits (bundles for one moment, about 15% under the items one by one) -----
  item(KITS, 'other', 'Grand Opening Kit', 5500, { revisions: 2, turnaround: '7–10 days', tagline: 'A new shop, café or branch opening.', includes: 'Opening pubmat + 3 countdown posts; Tarpaulin design; FB cover + profile frame; Standee design; 1-page menu or price list' }),
  item(KITS, 'other', 'Food Stall Starter Kit', 6800, { revisions: 2, turnaround: '10–14 days', tagline: 'Everything a new food stall or kiosk needs.', includes: 'Budget logo (2 concepts); Menu board design; Product label or sticker seal; Tarpaulin design; FB page kit (cover, profile, 3 posts)' }),
  item(KITS, 'other', 'Bazaar & Pop-up Vendor Kit', 3800, { revisions: 2, turnaround: '5–7 days', tagline: 'For a booth at a bazaar, art market or pop-up.', includes: 'Booth banner or tarpaulin design; Price list or menu board; QR payment standee; Business card; Sticker seal; 3 promo posts' }),
  item(KITS, 'other', 'Product Launch Kit', 6500, { revisions: 2, turnaround: '7–10 days', tagline: 'Launching a new product or menu item.', includes: 'Launch pubmat + 4 teaser posts; 2 product mockups; Flyer; Standee design; 3 story templates' }),
  item(KITS, 'other', 'Clinic & Small Office Kit', 5800, { revisions: 2, turnaround: '7–10 days', tagline: 'Clinics, law and accounting offices, small practices.', includes: 'Signage design; Business card; Letterhead; Appointment or loyalty card; FB cover' }),
  item(KITS, 'other', 'Corporate Christmas Kit', 4800, { revisions: 2, turnaround: '5–7 days', tagline: 'The office party and client giveaways.', includes: 'Greeting card (print + digital); Giveaway tags + sticker seal; Party tarpaulin; Program; Raffle tickets; 3 holiday posts' }),
  item(KITS, 'other', 'Org Week & Foundation Day Kit', 4500, { student: 3500, revisions: 2, turnaround: '7–10 days', tagline: 'A school or org’s week-long celebration.', includes: 'Event logo; 5 pubmats; Tarpaulin; Shirt design (front + back); Certificate; ID + lanyard template' }),
  item(KITS, 'other', 'Intramurals & Sports Fest Kit', 6800, { student: 5200, revisions: 2, turnaround: '10–14 days', tagline: 'School intramurals and company sports fests.', includes: 'Event logo; Up to 4 team logos; Jersey template in 4 colorways; Tarpaulin; Bracket graphic; Certificate' }),
  item(KITS, 'other', 'Recognition & Graduation Kit', 3800, { student: 2900, revisions: 2, turnaround: '7–10 days', tagline: 'Recognition day, moving up and graduation.', includes: 'Program (up to 8 pages); Certificate; Stage backdrop; Invitation; Congratulations post template' }),
  item(KITS, 'other', 'Seminar & Webinar Kit', 2500, { student: 1900, revisions: 2, turnaround: '3–5 days', tagline: 'A talk, training or webinar.', includes: 'Pubmat; Speaker cards (up to 3); Certificate; Virtual background; Countdown post' }),
  item(KITS, 'other', 'Fun Run & Charity Event Kit', 5500, { student: 4200, revisions: 2, turnaround: '7–10 days', tagline: 'Fun runs, walks and fundraisers.', includes: 'Event logo; Race bib design; Finisher shirt design; Medal design; Tarpaulin + route map; 3 pubmats' }),
  item(KITS, 'other', 'Fiesta & Festival Kit', 9800, { revisions: 3, turnaround: '14–21 days', tagline: 'Town and barangay fiestas, Dinagyang and local festivals.', includes: 'Festival logo; 8 pubmats; Tarpaulin + streamer; Shirt design; Stage backdrop; Program' }),

  // ----- Weddings & celebrations -----
  item(CELEB, 'other', 'Digital invitation (e-vite)', 1500, { revisions: 2, turnaround: '3–5 days', includes: 'Custom design; Post and story sizes; RSVP details' }),
  item(CELEB, 'other', 'Animated e-vite (30–45 s video)', 3500, { revisions: 2, turnaround: '5–7 days', includes: 'Motion invitation; Music; Vertical and square versions' }),
  item(CELEB, 'other', 'Wedding monogram', 1500, { revisions: 3, turnaround: '3–5 days', includes: '2 concepts; Color and one-color versions' }),
  item(CELEB, 'other', 'Invitation suite: invitation, RSVP and details card', 4500, { revisions: 3, turnaround: '7–10 days', includes: 'Custom layout; Entourage page; Print-ready files' }),
  item(CELEB, 'other', 'Wedding stationery set', 9800, { revisions: 3, turnaround: '14–21 days', includes: 'Invitation suite; Monogram; Welcome sign; Seating chart; Program; Menu card; Souvenir tag' }),
  item(CELEB, 'other', 'Debut package', 4500, { revisions: 3, turnaround: '7–10 days', includes: 'Invitation; 18 roses and 18 candles list; Welcome sign; Program; Souvenir tag' }),
  item(CELEB, 'other', 'Christening or birthday package', 2500, { revisions: 2, turnaround: '5–7 days', includes: 'Invitation; Tarpaulin or backdrop; Welcome sign; Souvenir tag' }),
  item(CELEB, 'other', 'Welcome sign or seating chart (per design)', 900, { revisions: 2, turnaround: '3–5 days' }),
  item(CELEB, 'other', 'Souvenir tags or thank-you cards', 500, { revisions: 2, turnaround: '2–3 days' }),
  item(CELEB, 'other', 'LED wall or screen backdrop', 1500, { revisions: 2, turnaround: '3–5 days', includes: 'Still or looping backdrop; Sized for the venue screen' }),
  addon(CELEB, 'Printed invitations 5 × 7 in, textured cardstock (from)', 45, { unit: 'piece', notes: PARTNER }),
  addon(CELEB, 'Envelope with wax seal', 35, { unit: 'piece' }),
  addon(CELEB, 'Vellum overlay', 20, { unit: 'piece' }),
  addon(CELEB, 'Guest name on each invitation', 10, { unit: 'piece' }),

  // ----- Student election campaign -----
  item(ELECT, 'other', 'Standard Candidate Campaign', 4800, { audience: 'student', revisions: 2, turnaround: '4–6 days', includes: 'Campaign logo; Basic branding; Profile + cover; DP frame; 6 posts (template only)' }),
  item(ELECT, 'other', 'Partylist Campaign Kit', 8800, { audience: 'student', revisions: 4, turnaround: '7–14 days', includes: 'Up to 10 candidates; 10 posts; DP frame; Cover; Branding' }),
  item(ELECT, 'other', 'Full Campaign System', 12800, { audience: 'student', revisions: 5, turnaround: '14–21 days', includes: 'Up to 20 candidates; Full campaign branding; Individual + party DP frames' }),

  // ----- Tournament / sports event -----
  item(TOUR, 'other', 'Tournament Brand Kit', 15800, { revisions: 3, turnaround: '1–1.5 weeks', includes: '3 logo concepts; Logo variations; Colors and type; Guidelines; 5 social templates' }),
  item(TOUR, 'other', 'Complete Tournament Package', 29800, { revisions: 3, turnaround: '2–3 weeks', includes: 'Brand Kit; Registration and officials uniforms; Tarpaulin; Medal; Entrance arch; Certificate' }),
  item(TOUR, 'other', 'Complete Tournament Package (loaded)', 38800, { revisions: 3, turnaround: '2.5–3.5 weeks', includes: 'Complete package; Poster; Bracket graphic; Accreditation IDs + lanyard; Stage backdrop' }),
  addon(TOUR, 'Accreditation IDs + lanyard', 2500),
  addon(TOUR, 'Certificate', 1500),
  addon(TOUR, 'Poster', 1500),
  addon(TOUR, 'Bracket & schedule', 2000),
  addon(TOUR, 'Stage backdrop', 3500),
  addon(TOUR, 'Jersey (per design)', 1500, { unit: 'piece' }),
  addon(TOUR, 'Standee', 1200),
  addon(TOUR, 'Wayfinding set', 2500),
  addon(TOUR, 'Animated event logo', 5000),
  addon(TOUR, 'Live-stream overlays', 6000),
  addon(TOUR, 'Hype video', 4000),
  addon(TOUR, 'Souvenir program (from)', 8000),
  addon(TOUR, 'Sponsorship deck', 5000),

  // ----- Yearbook -----
  item(YB, 'other', 'Basic Yearbook Template', 15800, { revisions: 2, turnaround: '14–18 days', includes: 'Illustrated cover (1 concept); 8 interior templates; Editable InDesign file' }),
  item(YB, 'other', 'Standard Yearbook Template', 20800, { revisions: 3, turnaround: '18–24 days', includes: 'Illustrated cover (2 concepts); 10 templates; Master pages; Asset folder' }),
  item(YB, 'other', 'Premium Yearbook Template', 28800, { revisions: 4, turnaround: '24–30 days', includes: 'Custom cover (2 concepts); 12 templates; Grid + type system; Basic style guide' }),
  item(YB, 'other', 'Signature Yearbook Template', 40800, { revisions: 5, turnaround: '30–40 days', includes: 'Premium cover (3 concepts); 14 templates; Editable cover art; Yearbook brand guide; Ready for future batches' }),

  // ----- Research & academic visuals (design of the client's own content) -----
  item(RESEARCH, 'other', 'Research poster (A1 to 3 × 4 ft)', 1800, { student: 1200, revisions: 2, turnaround: '3–5 days', includes: 'Layout of your final content; Charts and figures placed; School logos; Print-ready PDF' }),
  item(RESEARCH, 'other', 'Conference poster + 1-page handout', 2500, { student: 1800, revisions: 2, turnaround: '4–6 days', includes: 'Poster and matching handout; Print-ready PDFs' }),
  item(RESEARCH, 'other', 'Infographic: one page', 1500, { student: 1000, revisions: 2, turnaround: '3–5 days', includes: 'Your findings as a visual summary; PNG + PDF' }),
  item(RESEARCH, 'other', 'Graphical abstract', 900, { student: 650, revisions: 2, turnaround: '2–3 days', includes: 'Journal-ready size; PNG + TIFF' }),
  item(RESEARCH, 'other', 'Defense or presentation slides (up to 20)', 2500, { student: 1800, revisions: 2, turnaround: '4–6 days', includes: 'Slide master; Up to 20 slides; Charts redrawn; PPTX + PDF' }),
  item(RESEARCH, 'other', 'Chart or figure redraw', 250, { student: 180, unit: 'piece', turnaround: '1–2 days' }),
  item(RESEARCH, 'other', 'Thesis cover or title page', 500, { student: 350, revisions: 2, turnaround: '1–2 days' }),
  item(RESEARCH, 'other', 'Colloquium program or abstract booklet (up to 16 pages)', 4500, { student: 3500, revisions: 2, turnaround: '7–10 days', includes: 'Cover; Program; Abstracts laid out; Print-ready PDF' }),
  // Academic commissions (catalog version 3): brochures, other slides, reviewers, capstone logos and a defense kit.
  item(RESEARCH, 'other', 'Research or thesis brochure (trifold)', 2500, { student: 1700, revisions: 2, turnaround: '4–6 days', includes: 'Six panels of your study; Charts and photos placed; QR code to the full paper; Print-ready PDF' }),
  item(RESEARCH, 'other', 'Proposal or title defense slides (up to 12)', 1800, { student: 1200, revisions: 2, turnaround: '3–5 days', includes: 'Slide master; Up to 12 slides; Charts redrawn; PPTX + PDF' }),
  item(RESEARCH, 'other', 'Class report slides (up to 15)', 1200, { student: 800, revisions: 2, turnaround: '2–3 days', includes: 'Designed from your outline; Up to 15 slides; Icons and simple charts; PPTX + PDF' }),
  item(RESEARCH, 'other', 'Lecture slides for teachers (up to 30)', 3500, { revisions: 2, turnaround: '5–7 days', includes: 'Lesson slide template; Up to 30 slides; Diagrams redrawn; PowerPoint or Google Slides' }),
  item(RESEARCH, 'other', 'Slide template for a class, org or department', 1800, { student: 1200, revisions: 2, turnaround: '3–5 days', includes: 'Master + 8 layouts; Your school or org colors; PowerPoint, Google Slides or Canva' }),
  item(RESEARCH, 'other', 'Reviewer or handout layout (up to 10 pages)', 1500, { student: 1000, revisions: 2, turnaround: '3–5 days', includes: 'Clean layout of your notes; Headings, tables and diagrams; Print-ready PDF' }),
  item(RESEARCH, 'other', 'Capstone or thesis project logo', 1200, { student: 800, revisions: 2, turnaround: '3–5 days', includes: '2 concepts; For your system, app or study; PNG + SVG' }),
  item(RESEARCH, 'other', 'Thesis Defense Kit: slides, poster and brochure', 5800, {
    student: 3900,
    revisions: 2,
    turnaround: '7–10 days',
    tagline: 'One look across everything for the defense.',
    includes: 'Defense slides (up to 20); Research poster (A1 to 3 × 4 ft); Trifold research brochure',
  }),
  addon(RESEARCH, 'Extra slide', 100, { unit: 'piece' }),

  // ----- Academic workbook -----
  item(WB, 'other', 'Essential Workbook', 28000, { revisions: 2, turnaround: '3–4 weeks', includes: 'Logo design (2 concepts); Basic branding system; 30–40 page workbook layout; Cover + inside pages; Graphic illustrations; Teaching guide (answer key); Print-ready PDF' }),
  item(WB, 'other', 'Standard Educational', 38000, { revisions: 3, turnaround: '5–6 weeks', includes: 'Logo design (3 concepts); Full academic branding system; 40–50 page layout; Section dividers; Print-ready + digital PDF; Editable source files' }),
  item(WB, 'other', 'Premium Educational', 48000, { revisions: 4, turnaround: '7–9 weeks', includes: 'Standard + animated logo; Custom icon set; 50–70 pages; Illustration set; Interactive PDF; Style guide; Printer coordination' }),

  // ----- Storybooks -----
  item(STORY, 'illustration', 'Mini Storybook (5–6 pages)', 5500, { revisions: 2, notes: 'Minimalist style: ₱3,500.' }),
  item(STORY, 'illustration', 'Standard Storybook (8–12 pages)', 10800, { revisions: 3, notes: 'Minimalist style: ₱6,800.' }),
  item(STORY, 'illustration', 'Premium Storybook (16–24 pages)', 18800, { revisions: 4, notes: 'Minimalist style: ₱12,800.' }),
  item(STORY, 'illustration', 'Signature Storybook (24–32+ pages)', 32800, { revisions: 5, notes: 'Minimalist style: ₱22,800.' }),
  item(STORY, 'illustration', 'Mini Storybook, minimalist', 3500, { revisions: 2 }),
  item(STORY, 'illustration', 'Standard Storybook, minimalist', 6800, { revisions: 3 }),
  item(STORY, 'illustration', 'Premium Storybook, minimalist', 12800, { revisions: 4 }),
  item(STORY, 'illustration', 'Signature Storybook, minimalist', 22800, { revisions: 5 }),
  addon(STORY, 'Extra 2-page spread', 1000, { notes: 'Minimalist: ₱700.' }),
  addon(STORY, 'Extra character', 700, { notes: 'Minimalist: ₱500.' }),
  addon(STORY, 'Extra illustration', 500, { notes: 'Minimalist: ₱350.' }),
  addon(STORY, 'E-commerce cover', 1200),
  addon(STORY, 'Interactive PDF', 2000),
  addon(STORY, 'Read-along video', 3500),
  addon(STORY, 'Book trailer', 4500),
  addon(STORY, 'Printer coordination', 2000),

  item(ANIM, 'motion', 'Mini Animated Storybook (5–7 min)', 12800, { student: 9800, revisions: 2, turnaround: '2–3 weeks' }),
  item(ANIM, 'motion', 'Standard Animated Storybook (7–10 min)', 22800, { student: 17800, revisions: 3, turnaround: '3–5 weeks' }),
  item(ANIM, 'motion', 'Premium Animated Storybook (10–15 min)', 38800, { student: 30800, revisions: 4, turnaround: '5–8 weeks' }),
  item(ANIM, 'motion', 'Signature Animated Storybook (15+ min)', 58800, { student: 46800, revisions: 5, turnaround: '8–12 weeks' }),
  addon(ANIM, 'Extra minute', 1800),
  addon(ANIM, 'Extra subtitle language', 1000),
  addon(ANIM, 'Lip-sync upgrade (from)', 3000),
  addon(ANIM, 'Teaser cut', 3500),
  addon(ANIM, 'Vertical 9:16 version', 2500),

  // ----- Accreditation booklet -----
  item(BOOK, 'other', 'Essential Booklet (20–24 pages)', 18000, { revisions: 2, turnaround: '2–3 weeks', includes: 'Layout system; Covers; Section dividers; Spot illustrations; Simple tables; InDesign file' }),
  item(BOOK, 'other', 'Standard Booklet (24–28 pages)', 26000, { revisions: 3, turnaround: '3–5 weeks', includes: 'Themed dividers; Custom spot illustrations; Icon set; Infographics; InDesign file' }),
  item(BOOK, 'other', 'Premium Booklet (28–30 pages)', 36000, { revisions: 4, turnaround: '5–7 weeks', includes: 'Feature illustrations; Advanced data visuals; Illustrated cover; Photo styling; Mini style guide; InDesign file' }),
  item(BOOK, 'other', 'Signature Booklet (30+ pages)', 50000, { revisions: 5, turnaround: '7–10 weeks', includes: 'Full visual system; Custom cover + endpapers; Data-visualization suite; Style guide; Printer coordination; InDesign file' }),
  addon(BOOK, 'Extra 2-page spread', 1200),
  addon(BOOK, 'Feature illustration', 1500),
  addon(BOOK, 'Spot illustration / icon', 500),
  addon(BOOK, 'Infographic set', 2000),
  addon(BOOK, 'Photo retouching (per 10 photos)', 1500),
  addon(BOOK, 'Clickable PDF', 2500),

  // ----- Institutional branding (universities and offices) -----
  item(INST, 'branding', 'Institutional Professional Branding', 12800, { revisions: 3, turnaround: '12–18 days', includes: '3 concepts; Primary + secondary logo; Palette; Mini brand board; Basic guide; Social kit' }),
  item(INST, 'branding', 'Institutional Complete Branding', 16800, { revisions: 3, turnaround: '14–21 days', includes: 'Professional + 2 templates; Simple style guide; Business card; Letterhead' }),
  item(INST, 'branding', 'Institutional Premium Branding', 24800, { revisions: 4, turnaround: '21–30 days', includes: 'Professional + full style guide; Up to 5 merch designs; 3 templates' }),
  item(INST, 'branding', 'Institutional Elite Branding', 38800, { revisions: 5, turnaround: '30–40 days', includes: 'Premium + 5 templates; Certificate; PowerPoint; Packaging; Tarpaulin; Priority support' }),

  // ----- Government & LGU (paid after delivery, inspection and acceptance) -----
  item(GOV, 'other', 'IEC material: flyer or brochure', 1800, { revisions: 3, turnaround: '5–7 days', includes: 'Layout of your approved text; English, Filipino or Hiligaynon; Print-ready PDF' }),
  item(GOV, 'other', 'IEC set: brochure, poster and 3 social cards', 5500, { revisions: 3, turnaround: '7–10 days', includes: 'Matching set; Office seal and required logos; Print and web files' }),
  item(GOV, 'other', 'Streamers and tarpaulins (3 sizes)', 1800, { revisions: 2, turnaround: '3–5 days', includes: 'One design in 3 sizes; Print-ready files' }),
  item(GOV, 'other', 'Program or event branding kit', 12800, { revisions: 3, turnaround: '14–21 days', includes: 'Event logo; 5 pubmats; Tarpaulin; Stage backdrop; Certificate; ID' }),
  item(GOV, 'other', 'Citizen’s Charter layout', 3500, { revisions: 3, turnaround: '5–7 days', tagline: 'Under the Ease of Doing Business Act (RA 11032).', includes: 'Services, steps and fees from your approved text; Large-format print file' }),
  item(GOV, 'illustration', 'Tourism or town map (illustrated)', 8500, { revisions: 3, turnaround: '21–30 days', includes: 'Landmarks and attractions; Roads and barangays; Legend; Print + web versions' }),
  item(GOV, 'other', 'Annual or accomplishment report (up to 24 pages)', 18000, { revisions: 3, turnaround: '21–30 days', includes: 'Layout and infographics; Photos placed; Print-ready + web PDF' }),
  item(GOV, 'other', 'Signage and wayfinding set (up to 10 signs)', 9800, { revisions: 3, turnaround: '14–21 days', includes: 'Sign system; Directional and room signs; Install-ready files' }),
  item(GOV, 'other', 'Announcement cards for social media (set of 10)', 3500, { revisions: 2, turnaround: '5–7 days', includes: '10 cards on one template; Editable Canva copy' }),
  item(GOV, 'other', 'Infographic report (one page)', 1800, { revisions: 2, turnaround: '3–5 days' }),
  addon(GOV, 'Same material in another language', 500, { unit: 'piece', tagline: 'Translated text supplied by the office.' }),

  // ----- Presentations & company profiles -----
  item(DECK, 'other', 'Presentation template (master + 10 layouts)', 3500, { revisions: 2, turnaround: '5–7 days', includes: 'Slide master; 10 layouts; Icon and chart styles; PowerPoint or Google Slides' }),
  item(DECK, 'other', 'Pitch deck (up to 12 slides)', 5500, { revisions: 3, turnaround: '7–10 days', includes: 'Story outline; Up to 12 designed slides; Charts; PDF + editable file' }),
  item(DECK, 'other', 'Pitch deck (up to 20 slides)', 8500, { revisions: 3, turnaround: '10–14 days', includes: 'Story outline; Up to 20 designed slides; Charts; PDF + editable file' }),
  item(DECK, 'other', 'Company profile (up to 8 pages)', 6500, { revisions: 3, turnaround: '7–10 days', includes: 'Cover; About, services, clients and contact pages; Print + web PDF' }),
  item(DECK, 'other', 'Company profile (up to 16 pages)', 11500, { revisions: 3, turnaround: '14–21 days', includes: 'Everything in 8 pages; Case studies; Infographics; Print + web PDF' }),
  item(DECK, 'other', 'Capability statement or one-pager', 1800, { revisions: 2, turnaround: '3–5 days' }),
  item(DECK, 'other', 'Product catalog (up to 12 pages)', 7500, { revisions: 3, turnaround: '10–14 days', includes: 'Product grid system; Photos placed; Price pages; Print + web PDF' }),
  addon(DECK, 'Extra slide or page', 350, { unit: 'piece' }),
  addon(DECK, 'Copywriting (per slide or page, from)', 300, { unit: 'piece' }),
  addon(DECK, 'Custom icon set (10 icons)', 1500),
  addon(DECK, 'Chart or data visual', 300, { unit: 'piece' }),

  // ----- Web design -----
  item(WEB, 'web', 'Landing Page (one-pager)', 9000, { revisions: 2, turnaround: '7–12 days', includes: 'Up to 5 sections; Mobile-responsive; Contact form; Basic SEO' }),
  item(WEB, 'web', 'Starter Website', 16000, { revisions: 3, turnaround: '12–18 days', includes: 'Up to 3 pages; Custom layout; Contact form; Google Maps; Basic SEO' }),
  item(WEB, 'web', 'Business Website', 26000, { revisions: 4, turnaround: '18–25 days', includes: 'Up to 5 pages; Inquiry forms; SEO setup; Maps + social links' }),
  item(WEB, 'web', 'Professional Website', 42000, { revisions: 5, turnaround: '25–35 days', includes: 'Up to 8 pages; Blog / CMS; Interactive elements; Analytics' }),
  item(WEB, 'web', 'E-Commerce / Online Store', 58000, { revisions: 5, turnaround: '35–50 days', includes: 'Up to 30 products; Cart + checkout; GCash / PayMongo / card; Order dashboard' }),
  addon(WEB, 'Extra page', 2500, { unit: 'piece' }),
  addon(WEB, 'Copywriting (per page, from)', 800, { unit: 'piece' }),
  addon(WEB, '10 more product uploads', 1500),
  addon(WEB, 'Website maintenance (from)', 2500, { unit: 'month' }),

  // ----- Motion graphics -----
  item(MOTION, 'motion', 'Starter Motion', 2500, { revisions: 2, includes: '2–3 seconds; Basic logo animation; MP4 1080p' }),
  item(MOTION, 'motion', 'Essential Motion', 3500, { revisions: 2, includes: '2–3 seconds; Concept + storyboard; Transparent MOV' }),
  item(MOTION, 'motion', 'Professional Motion', 5500, { revisions: 3, includes: '3–5 seconds; Custom illustrations; Motion type; Social versions' }),
  item(MOTION, 'motion', 'Brand Story Motion', 7500, { revisions: 4, includes: '5–6 seconds; Up to 3 concepts; 1080p + 4K' }),
  item(MOTION, 'motion', 'Signature Motion', 10000, { revisions: 5, includes: '6–8 seconds; Premium illustration + sound; Intro & outro versions' }),
  item(MOTION, 'motion', 'Motion Branding Suite', 15000, { revisions: 5, includes: 'Intro (5–8 sec); Outro; Logo reveal; Title card; End card; Lower thirds' }),
  addon(MOTION, 'Extra scene', 800),
  addon(MOTION, 'Extra illustration', 750),
  addon(MOTION, 'Extra aspect ratio', 750),
  addon(MOTION, 'Extra storyboard frame', 250),

  // ----- Video (edited from the client's footage and photos) -----
  item(VIDEO, 'motion', 'Short-form reel edit (up to 60 s)', 1200, { student: 900, revisions: 2, turnaround: '2–3 days', includes: 'From your footage; Captions; Music; Vertical 9:16' }),
  item(VIDEO, 'motion', 'Reels pack: 4 edits', 4200, { student: 3200, revisions: 2, turnaround: '5–7 days', includes: '4 reels up to 60 s; Captions; Music; Cover frames' }),
  item(VIDEO, 'motion', 'Event highlights video (2–3 min)', 4500, { student: 3500, revisions: 2, turnaround: '5–7 days', includes: 'From your footage; Music; Titles; 16:9 + 9:16 cut' }),
  item(VIDEO, 'motion', 'AVP / audio-visual presentation (3–5 min)', 6500, { student: 5000, revisions: 3, turnaround: '7–10 days', includes: 'Script polish; Motion titles; Music; Voiceover placed' }),
  item(VIDEO, 'motion', 'Promotional or corporate video (1–2 min)', 9800, { revisions: 3, turnaround: '10–14 days', includes: 'Editing; Motion graphics; Music; Subtitles' }),
  item(VIDEO, 'motion', 'Testimonial or interview edit (up to 3 min)', 3500, { student: 2700, revisions: 2, turnaround: '4–6 days', includes: 'Cuts; Lower thirds; Subtitles; Music' }),
  item(VIDEO, 'motion', 'Tribute or photo montage (up to 5 min)', 2500, { student: 1900, revisions: 2, turnaround: '4–6 days', includes: 'From your photos and clips; Music; Titles' }),
  item(VIDEO, 'motion', 'YouTube video edit (up to 10 min)', 3800, { student: 2900, revisions: 2, turnaround: '4–6 days', includes: 'Cuts; Titles; Music; Thumbnail' }),
  addon(VIDEO, 'Subtitles (per video, up to 5 min)', 500),
  addon(VIDEO, 'Extra minute of edited video', 800, { unit: 'piece' }),
  addon(VIDEO, 'Color grading', 800),
  addon(VIDEO, 'Voiceover (per minute)', 600, { unit: 'piece' }),
  addon(VIDEO, 'Video thumbnail', 300, { unit: 'piece' }),

  // ----- Isometric maps -----
  item(MAP, 'illustration', 'Key Landmarks Map', 1800, { revisions: 2, turnaround: '7–10 days', includes: 'Selected buildings (up to 6); Roads and greenery; 1 custom character; Labels' }),
  item(MAP, 'illustration', 'Complete Campus / Area Map', 2800, { revisions: 3, turnaround: '14–18 days', includes: 'Every building in the area; Full grounds detail; Full labels; Legend; Large-format ready', notes: 'Bigger areas: medium ₱4,500 · large campus ₱6,500+.' }),
  addon(MAP, 'Extra character', 400),
  addon(MAP, 'Extra building', 200),
  addon(MAP, 'Animated version', 1500),
  addon(MAP, 'Extra size / orientation', 500),

  // ----- Design training -----
  item(TRAIN, 'other', 'Essential Design Training', 9000, { unit: 'participant', turnaround: '3 days · 21 hours', includes: 'Illustrator + InDesign fundamentals; Hands-on exercises; Certificate' }),
  item(TRAIN, 'other', 'Professional Design Workflow Training', 12500, { unit: 'participant', turnaround: '4 days · 28 hours', includes: 'Essential + real project exercises; Branding & layout workflow; Print prep; Critiques' }),

  // ----- Standard add-ons (every contract) -----
  pct(ADDONS, 'Extra revision round', 15, { tagline: 'Per round beyond what is included.' }),
  pct(ADDONS, 'Editable source files (AI / PSD / SVG / INDD)', 20),
  pct(ADDONS, 'Rush (3–5 day turnaround)', 25),
  addon(ADDONS, 'Brand mascot design', 3000),
  addon(ADDONS, '5 extra social media templates', 1500),
  addon(ADDONS, 'PowerPoint / presentation template', 3000),
  addon(ADDONS, 'Advanced logo animation', 5000),
  addon(ADDONS, '3D logo', 2500),
  addon(ADDONS, 'Tarpaulin / banner design', 800),
  addon(ADDONS, 'Extra static post (SMM)', 450, { unit: 'piece' }),
  addon(ADDONS, 'Extra reel (SMM)', 1000, { unit: 'piece' }),
  addon(ADDONS, 'Ads management (SMM)', 2500, { unit: 'month', tagline: 'Ad budget is paid by the client, directly to Meta.' }),

  // ----- Ownership and buy-out (on the full package price, before discounts) -----
  pct(OWNERSHIP, 'Full IP ownership transfer', 35),
  pct(OWNERSHIP, 'NDA / no portfolio display', 15, { notes: 'Or a flat ₱2,000–3,000 on small projects.' }),
  pct(OWNERSHIP, 'Full buy-out (source files + IP + NDA)', 60),
];

/**
 * Current catalog version; bump when SEED_PACKAGES changes in a way devices should pick up.
 * 1 = the October 2026 price list and the 13 v1.0 contract templates.
 * 2 = November 2026: twelve new sections (retainer, merch production, packaging, illustration, stationery,
 *     printing, situation kits, celebrations, research, government, presentations, video), 8 more
 *     templates, and the sticker design prices of the POS rate card.
 * 3 = academic commissions: brochures, report, proposal and lecture slides, slide templates, reviewers,
 *     capstone logos and a thesis defense kit; the research template becomes Academic & Thesis Visuals.
 */
export const CATALOG_VERSION = 3;

/** Prices changed by a catalog version. A device takes the new price only where the old one is still in place, so edits stay. */
export const PRICE_CHANGES: { version: number; id: string; from: number; to: number }[] = [
  { version: 2, id: 'cat-merch-sticker-detailed', from: toCents(250), to: toCents(220) },
  { version: 2, id: 'cat-merch-stickers-2-designs-detailed', from: toCents(450), to: toCents(390) },
  { version: 2, id: 'cat-merch-stickers-5-designs-detailed', from: toCents(1100), to: toCents(950) },
  { version: 2, id: 'cat-merch-stickers-10-designs-detailed', from: toCents(2000), to: toCents(1700) },
];

/** Categories in price-list order. */
export const CATEGORIES = [...new Set(SEED_PACKAGES.map((p) => p.category as string))];

/** The introductory offer for the first SMM clients. */
export const FOUNDING_OFFER = { pct: 10, months: 3, label: 'Founding client: 10% off the first 3 months (in exchange for a testimonial and a case study)' };

export interface DiscountCode {
  code: string;
  pct: number;
  label: string;
}

export const DISCOUNT_CODES: DiscountCode[] = [{ code: 'REPYOURORG15', pct: 15, label: 'REP YOUR ORG: 15% off for the first 15 student orgs' }];

export const UNIT_LABEL: Record<Package['unit'], string> = {
  month: '/ month',
  project: '/ project',
  piece: '/ piece',
  hour: '/ hour',
  percent: '',
  participant: '/ participant',
  sqft: '/ sq ft',
};

/** The price for a client: the student price for student orgs, when there is one. */
export const priceFor = (p: Pick<Package, 'price' | 'studentPrice'>, audience: 'business' | 'student'): number =>
  audience === 'student' && p.studentPrice ? p.studentPrice : p.price;

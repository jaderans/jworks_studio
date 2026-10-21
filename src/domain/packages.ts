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
export const ADDONS = 'Add-ons';
export const OWNERSHIP = 'Ownership';

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

  // ----- Merch, shirt and print design (design fees; printing quoted separately) -----
  item(MERCH, 'stickers', 'Sticker: small / simple', 100, { unit: 'piece' }),
  item(MERCH, 'stickers', 'Sticker: detailed', 250, { unit: 'piece' }),
  item(MERCH, 'stickers', 'Stickers: 2 designs (small)', 180),
  item(MERCH, 'stickers', 'Stickers: 2 designs (detailed)', 450),
  item(MERCH, 'stickers', 'Stickers: 5 designs (small)', 450),
  item(MERCH, 'stickers', 'Stickers: 5 designs (detailed)', 1100),
  item(MERCH, 'stickers', 'Stickers: 10 designs (small)', 850),
  item(MERCH, 'stickers', 'Stickers: 10 designs (detailed)', 2000),
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

  // ----- Event & publication campaign -----
  item(EVENT, 'other', 'Digital Campaign Starter', 20800, { student: 16000, revisions: 2, turnaround: '14–18 days', includes: '12 publication materials; 4 flyers / posters; 6-page newsletter; FB cover + DP frame' }),
  item(EVENT, 'other', 'Digital Campaign Expansion', 25800, { student: 20000, revisions: 3, turnaround: '18–24 days', includes: '15 publication materials; 5 flyers; 8-page newsletter; Basic template system' }),
  item(EVENT, 'other', 'Full Digital Media System', 30800, { student: 24000, revisions: 4, turnaround: '24–30 days', includes: '18 publication materials; 6 flyers; 10-page newsletter; Template kit; Mini brand guide' }),
  item(EVENT, 'other', 'Premium Media Campaign', 40800, { student: 32000, revisions: 5, turnaround: '30–40 days', includes: '22 publication materials; 8 flyers; 12-page newsletter; Full layout system; Editable Canva workspace' }),

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

/** Current catalog version; bump when SEED_PACKAGES changes in a way devices should pick up. */
export const CATALOG_VERSION = 1;

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
};

/** The price for a client: the student price for student orgs, when there is one. */
export const priceFor = (p: Pick<Package, 'price' | 'studentPrice'>, audience: 'business' | 'student'): number =>
  audience === 'student' && p.studentPrice ? p.studentPrice : p.price;

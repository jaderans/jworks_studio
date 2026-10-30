import { CATEGORIES, UNIT_LABEL } from './packages';
import { OUR_GOAL, WELCOME } from './contractTemplates';
import { peso } from '../lib/money';
import type { Package, RateCardSettings } from '../db/types';

/**
 * The studio profile & rate card: an introduction to JoshWorks and the price
 * list, for clients and agencies who ask for "all your rates". Only what a
 * client should see prints: never the price list's internal notes or the
 * team's own rates and margins.
 */

export const DEFAULT_RATE_CARD: RateCardSettings = {
  title: 'Studio Profile & Rate Card',
  about: [WELCOME, OUR_GOAL].join('\n'),
  services: [
    'Branding & visual identity: logos, brand boards, style guides and social kits',
    'Social media management: monthly content, captions, posting and reports',
    'Merchandise design: shirts, lanyards, stickers, totes and more, ready for print',
    'Event & publication campaigns: pubmats, tarpaulins, programs and campaign kits',
    'Yearbooks & publications: yearbooks, workbooks, storybooks and booklets',
    'Motion graphics: animated posts, logo animation, explainers and animated storybooks',
    'Web design: landing pages and websites',
    'Design training: workshops for teams and student organizations',
  ].join('\n'),
  process: [
    'Inquiry & brief: tell us what you need; we send a quote and a short questionnaire',
    'Agreement & down payment: sign the contract and pay 50% to book your slot',
    'Concepts: first designs within the agreed turnaround',
    'Revisions: consolidated feedback rounds, as included in your package',
    'Final files: once the balance is paid, files are delivered by Google Drive',
  ].join('\n'),
  why: [
    'Original, human-made design: we use AI only to support our process, never to replace it',
    'A small team of specialists in branding, illustration, layout, motion and web',
    'Clear packages, fixed prices and a written agreement for every project',
    'Student-organization rates and rush service when you need them',
  ].join('\n'),
  portfolioUrl: '',
  credentials: ['Around seven years of design experience', 'DTI-registered design studio based in Iloilo City'].join('\n'),
  clients: '',
  notes: [
    'All prices are in Philippine pesos (PHP) and exclude VAT.',
    'A 50% down payment starts the project; the balance is due before final files are released.',
    'Revision rounds and turnaround times are listed per item; extra rounds, rush service and source files are add-ons.',
    'These are baseline rates: the final quote depends on scope, quantity and timeline.',
  ].join('\n'),
  validDays: 30,
  sections: [],
  prices: 'business',
  hidden: [],
  parts: { intro: true, portfolio: true, prices: true, notes: true },
};

export const sectionOf = (p: Package) => p.category || (p.kind === 'smm' ? 'Social media management' : p.kind === 'addon' ? 'Add-ons' : 'Other');

export interface RateCardSection {
  name: string;
  items: Package[];
  addOns: Package[];
}

/** The price list sections that print, in price-list order, with only the items chosen to show (never a contract's own prices). */
export function rateCardSections(packages: readonly Package[], s: Pick<RateCardSettings, 'sections' | 'hidden'>): RateCardSection[] {
  const shown = packages.filter((p) => p.active === 1 && !p.deleted && !p.templateId && !s.hidden.includes(p.id) && (!s.sections.length || s.sections.includes(sectionOf(p))));
  const names = [...new Set(shown.map(sectionOf))].sort((a, b) => (CATEGORIES.indexOf(a) + 1 || 999) - (CATEGORIES.indexOf(b) + 1 || 999));
  const bySort = (a: Package, b: Package) => a.sort - b.sort || a.name.localeCompare(b.name);
  return names.map((name) => {
    const list = shown.filter((p) => sectionOf(p) === name);
    return {
      name,
      items: list.filter((p) => p.kind !== 'addon').sort(bySort),
      addOns: list.filter((p) => p.kind === 'addon').sort(bySort),
    };
  });
}

/** "₱3,500 / project", "+25% of the package price", or for students their price (the business one when there's none). */
export function rateText(p: Package, who: 'business' | 'student'): string {
  if (p.unit === 'percent') return `+${p.price / 100}% of the package price`;
  const amount = who === 'student' && p.studentPrice ? p.studentPrice : p.price;
  return `${peso(amount)} ${UNIT_LABEL[p.unit]}`.trim();
}

/** Lines of a multi-line setting, without blanks. */
export const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** "Name: what it covers" → its two parts (just the text when there's no colon). */
export function splitLine(line: string): { head: string; text: string } {
  const at = line.indexOf(':');
  return at > 0 && at < 60 ? { head: line.slice(0, at).trim(), text: line.slice(at + 1).trim() } : { head: '', text: line };
}

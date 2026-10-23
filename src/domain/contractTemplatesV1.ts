import type { ContractSection, ContractTemplate } from '../db/types';

/**
 * The contract templates as first shipped (v1, June 2026). Only used to tell
 * whether a template on this device is still untouched, so an upgrade can
 * replace it without overwriting the studio's own edits.
 */

const lines = (...l: string[]) => l.join('\n');

const TERMS: ContractSection[] = [
  {
    id: 'payment',
    title: 'Payment Terms',
    on: true,
    body: lines(
      'Full payment or a 50% down payment is REQUIRED before delivery of the final design.',
      'The client receives final, high-resolution files only upon successful receipt of full payment.',
      'The down payment confirms the client’s commitment and reserves the project slot.',
      'Any remaining balance must be settled before final file delivery.',
      'Accepted payment methods and details are provided upon booking.',
    ),
  },
  {
    id: 'cancellation',
    title: 'Project Cancellation Policy',
    on: true,
    body: lines(
      'Cancellations during the production phase are NOT allowed; once production begins, the project is considered final and the down payment is non-refundable.',
      'This protects the time and resources committed by both parties.',
      'Logos and brand identity designs do not include editable / source files by default, as they are exclusive brand assets. Source files are released only under a separate written agreement and may carry additional fees.',
    ),
  },
  {
    id: 'client',
    title: 'Client Responsibilities',
    on: true,
    body: lines(
      'The client must provide clear, detailed instructions, brand guidelines, and references (style, color, content) at the start of the project.',
      'The client should communicate the desired completion deadline.',
      'All feedback, approvals, and revision requests must be submitted in writing through the agreed communication channel.',
      'Project timelines begin only once the down payment and complete project materials are received.',
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual Property Rights',
    on: true,
    body: lines(
      'Upon full payment, the client receives the right to use the commissioned design for its intended purpose.',
      'The designer retains intellectual property rights, including the right to display the work in their portfolio, unless otherwise negotiated.',
      'The designer reserves the right to use the work for self-promotion.',
      'Transfer of full ownership / IP is NOT included unless explicitly agreed in writing, and may carry an additional fee.',
    ),
  },
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement',
    on: true,
    body: lines(
      'If the client requires confidentiality, an NDA must be requested and agreed in writing before the project begins.',
      'Under an active NDA, the designer will not display, share, or include the work in any public portfolio or promotional material.',
      'NDA coverage may incur an additional fee depending on scope and duration.',
      'Without a signed NDA, the designer retains the right to feature completed work in their portfolio.',
    ),
  },
  {
    id: 'revisions',
    title: 'Revision Policy',
    on: true,
    body: lines(
      'Revisions are limited to the number specified in the selected package.',
      'Additional revisions beyond the package limit incur extra charges (see Add-ons).',
      'Major concept changes after approval are treated as new projects or change orders.',
    ),
  },
  {
    id: 'timeline',
    title: 'Timeline and Delivery',
    on: true,
    body: lines(
      'Standard turnaround follows the selected package; rush service is available for an added fee.',
      'Delays caused by late client feedback, incomplete materials, or unpaid balances may extend the timeline and are not the designer’s responsibility.',
      'Final delivery is made via email or cloud storage.',
      'The client is responsible for downloading and backing up all delivered files.',
    ),
  },
  {
    id: 'files',
    title: 'File Formats and Usage',
    on: true,
    body: lines(
      'Standard deliverables include high-resolution PNG, JPEG, and PDF (plus package-specific formats).',
      'Editable source files (AI, PSD, SVG, INDD) are available as paid add-ons only.',
      'Files are optimized for both print and digital use.',
      'Printing and physical production costs are not included unless stated and are quoted separately.',
    ),
  },
  {
    id: 'ai',
    title: 'Originality & Use of AI',
    on: true,
    body: lines(
      'All designs are produced through original human creative work.',
      'AI may be used only as an assistive tool (for efficiency and support) and never to auto-generate final creative output that replaces human design.',
    ),
  },
  {
    id: 'law',
    title: 'Governing Law',
    on: true,
    body: lines(
      'This agreement is governed by the laws of the Republic of the Philippines.',
      'Disputes will first be settled amicably; if unresolved, the proper venue is Iloilo City, Philippines.',
    ),
  },
];

const AGREEMENT = [
  'I have read, understood, and agree to all terms and conditions in this contract.',
  'I agree to the selected package pricing and any additional add-on services.',
  'I understand and accept the payment terms requiring payment before final delivery.',
  'I acknowledge that project cancellations during production are not allowed.',
  'I agree to provide clear instructions and feedback in writing.',
  'I understand the revision limits and additional charges for extra revisions.',
  'I accept the package turnaround unless rush service is selected.',
  'I understand that intellectual property rights remain with the designer for portfolio use unless otherwise agreed in writing.',
  'I acknowledge my responsibility to download and back up all delivered files.',
  'I agree that major concept changes after approval constitute new projects.',
];

const BRANDING_QUESTIONS = [
  'What is your business / organization name?',
  'What industry or field are you in?',
  'What products or services do you offer? (write N/A if none)',
  'Who is your target audience? (age, demographics, interests)',
  'What makes you different from competitors?',
  'Describe the personality / tone you want (e.g. modern, playful, premium, minimal).',
  'Are there colors you want included or avoided?',
  'Share 2–3 brands or designs you admire and why.',
  'Where will the brand mainly be used? (print, social media, packaging, web)',
];

const brief = (what: string) => [
  `Briefly describe your ${what} and its goal.`,
  'Who is the target audience / who will see this?',
  'Preferred style, colors, themes, or references.',
  'Key dates or deadline.',
  'Content you will provide (text, photos, logo, etc.).',
];

const WEB = [
  'Do you have an existing website or domain? If yes, please share the link.',
  'What pages do you need? (e.g. Home, About, Services, Products, Contact)',
  'What features do you need? (contact form, gallery, booking, online store, blog, maps)',
  'Share 2–3 websites you like and what you like about them.',
  'Who will provide the content (text, images, logo)?',
  'Target launch date.',
];

const TRAINING = ['Number of participants and their current skill level.', 'Preferred training dates and venue.', 'Software versions available on the venue PCs (Adobe 2021 or later).', 'Topics or outputs you want the training to focus on.'];

const BRIEFS: Record<string, string[]> = {
  'tpl-branding-business': BRANDING_QUESTIONS,
  'tpl-branding-student': BRANDING_QUESTIONS,
  'tpl-branding-smm-business': BRANDING_QUESTIONS,
  'tpl-branding-smm-student': BRANDING_QUESTIONS,
  'tpl-merch': brief('merch order'),
  'tpl-event-business': brief('event or campaign'),
  'tpl-event-student': brief('event or campaign'),
  'tpl-election': brief('election campaign'),
  'tpl-yearbook': brief('yearbook'),
  'tpl-workbook': brief('workbook or publication'),
  'tpl-motion': brief('motion project'),
  'tpl-web': WEB,
  'tpl-training': TRAINING,
};

export const V1 = { sections: TERMS as ContractSection[], agreement: AGREEMENT, briefs: BRIEFS };

const BRIEF_TITLES: Record<string, string> = {
  'tpl-branding-business': 'Branding Questionnaire',
  'tpl-branding-student': 'Branding Questionnaire',
  'tpl-branding-smm-business': 'Branding Questionnaire',
  'tpl-branding-smm-student': 'Branding Questionnaire',
  'tpl-merch': 'Merch Brief',
  'tpl-web': 'Website Brief',
  'tpl-training': 'Training Details',
};

const sameLines = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameSections = (a: readonly ContractSection[], b: readonly ContractSection[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id && x.title === b[i].title && x.body === b[i].body && x.on === b[i].on);

type Upgradable = Pick<ContractTemplate, 'id' | 'brief' | 'briefTitle' | 'sections' | 'agreement'>;

/**
 * What an upgrade changes on one template: parts still exactly as first
 * shipped take the new version; parts the studio edited are kept and named.
 */
export function upgradeTemplate(stored: Upgradable, latest: Upgradable): { patch: Partial<Upgradable>; edited: string[] } {
  const patch: Partial<Upgradable> = {};
  const edited: string[] = [];
  const v1Brief = BRIEFS[stored.id];
  if (v1Brief && sameLines(stored.brief, v1Brief)) {
    patch.brief = latest.brief;
    if (stored.briefTitle === (BRIEF_TITLES[stored.id] ?? 'Project Brief')) patch.briefTitle = latest.briefTitle;
  } else if (!sameLines(stored.brief, latest.brief)) edited.push('questionnaire');
  if (sameSections(stored.sections, TERMS)) patch.sections = latest.sections;
  else if (!sameSections(stored.sections, latest.sections)) edited.push('terms');
  if (sameLines(stored.agreement, AGREEMENT)) patch.agreement = latest.agreement;
  else if (!sameLines(stored.agreement, latest.agreement)) edited.push('agreement');
  return { patch, edited };
}

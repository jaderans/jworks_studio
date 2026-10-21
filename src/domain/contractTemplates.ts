import type { ContractSection, ContractTemplate, Syncable } from '../db/types';

/**
 * The JoshWorks v1.0 contract set (June 2026), as templates. Every contract
 * shares the welcome, the terms and conditions and the client agreement
 * statement; each one has its own scope, phases, brief and packages.
 */

export type TemplateSeed = Omit<ContractTemplate, keyof Syncable> & { id: string };

export const WELCOME =
  'JoshWorks is a graphic design studio based in Iloilo City, Philippines. With around seven years of design experience and a small team of specialists across branding, illustration, layout, motion, and web, we help businesses, schools, organizations, and creatives build clear, memorable visual identities.';
export const WHAT_WE_DO =
  'Branding & visual identity, social media management, merchandise design, motion graphics, event & publication campaigns, yearbook & publication layout, and design training.';
export const OUR_GOAL =
  'To deliver professional, original, human-made design that genuinely represents you. We treat every project as a partnership — we listen first, then craft. We use modern tools, including AI, only to support our process, never to replace the human creativity and craft at the heart of every project.';

const lines = (...l: string[]) => l.join('\n');

/** Terms and conditions 1–10, the same in every contract. One point per line. */
export const STANDARD_TERMS: ContractSection[] = [
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

export const STANDARD_AGREEMENT = [
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

export const AUTHORITY_STATEMENT =
  'I confirm that all information provided is accurate and that I have the authority to enter into this agreement on behalf of my business / organization.';
export const CLIENT_ACK = 'By signing below, I confirm that I have read, understood, and agree to all terms, conditions, pricing, and services outlined in this agreement.';
export const DESIGNER_ACK = 'By signing below, I confirm my commitment to deliver the agreed services according to the terms in this contract.';
export const BINDING = 'This agreement is binding upon signature by both parties and remains in effect until project completion and final payment.';

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

const p = (title: string, text: string) => ({ title, text });

const BRANDING_PHASES = [
  p('Discovery & Brand Brief', 'We collect your goals, audience, and preferences through the questionnaire and a short consultation, so we design with the right direction from day one.'),
  p('Research & Direction', 'We study your market and set a clear visual direction — mood, references, and the color and typography territory we’ll explore.'),
  p('Concept & Design', 'We design your logo and core brand elements, then present the initial concepts for your reaction.'),
  p('Revisions & Refinement', 'You send written feedback and we refine the chosen direction within your package’s revision rounds.'),
  p('Finalization & Handoff', 'We prepare your final files, brand guide, and deliverables. Once the balance is settled, everything is released to you.'),
];

const SMM_PHASES = [
  p('Onboarding & Strategy', 'We align on your brand voice, goals, and posting cadence for the month.'),
  p('Content Calendar', 'We plan the month’s posts and themes and send them for your approval.'),
  p('Design & Production', 'We produce the static and motion posts included in your monthly package.'),
  p('Review & Scheduling', 'You approve the batch; we finalize and hand off ready-to-post files (scheduling handled if agreed).'),
  p('Monthly Review', 'We review what performed best and plan the next content cycle with you.'),
];

const EVENT_PHASES = [
  p('Brief & Planning', 'We map out every material your event needs, the timeline, and the key dates to hit.'),
  p('Layout & Template System', 'We establish the campaign’s visual system and reusable templates for a consistent look.'),
  p('Production', 'We design the publication materials, flyers, newsletter, and frames in your package.'),
  p('Revisions', 'You send written feedback and we refine within your package’s revision rounds.'),
  p('Delivery', 'Canva-ready and print-ready files are delivered, ready to publish and print.'),
];

const STD = { sections: STANDARD_TERMS, agreement: STANDARD_AGREEMENT, welcome: WELCOME, active: 1 as const, phasesNote: '' };
const ADD = ['Add-ons', 'Ownership'];

export const SEED_TEMPLATES: TemplateSeed[] = [
  {
    ...STD,
    id: 'tpl-branding-business',
    name: 'Branding & Visual Identity Agreement',
    tagline: 'Logo design, brand systems & visual identity',
    subtitle: 'Business / Commercial',
    frame: 'logo',
    categories: ['Branding', ...ADD],
    audience: 'business',
    covers: 'Logo and full brand identity design — from a single logo to a complete brand system with guidelines.',
    phases: BRANDING_PHASES,
    briefTitle: 'Branding Questionnaire',
    brief: BRANDING_QUESTIONS,
    sort: 0,
  },
  {
    ...STD,
    id: 'tpl-branding-student',
    name: 'Branding & Visual Identity Agreement',
    tagline: 'Logo design, brand systems & visual identity',
    subtitle: 'Student / School-Org',
    frame: 'logo',
    categories: ['Branding', ...ADD],
    audience: 'student',
    covers: 'Logo and full brand identity design at discounted student and school-organization rates.',
    phases: BRANDING_PHASES,
    briefTitle: 'Branding Questionnaire',
    brief: BRANDING_QUESTIONS,
    sort: 1,
  },
  {
    ...STD,
    id: 'tpl-branding-smm-business',
    name: 'Branding + Social Media Management',
    tagline: 'Brand identity plus monthly content & postings',
    subtitle: 'Business / Commercial',
    frame: 'logo',
    categories: ['Branding', 'Social media management', ...ADD],
    audience: 'business',
    covers: 'Brand identity design plus monthly social media content and postings — ideal for businesses that want a complete look and an active online presence.',
    phases: SMM_PHASES,
    phasesNote: 'For branding work in this agreement, we follow our standard branding phases (Discovery → Direction → Concept → Revisions → Handoff). The phases above describe the monthly social media management cycle.',
    briefTitle: 'Branding Questionnaire',
    brief: BRANDING_QUESTIONS,
    sort: 2,
  },
  {
    ...STD,
    id: 'tpl-branding-smm-student',
    name: 'Branding + Social Media Management',
    tagline: 'Brand identity plus monthly content & postings',
    subtitle: 'Student / School-Org',
    frame: 'logo',
    categories: ['Branding', 'Social media management', ...ADD],
    audience: 'student',
    covers: 'Brand identity design plus monthly social media content and postings, at discounted student and school-organization rates.',
    phases: SMM_PHASES,
    phasesNote: 'For branding work in this agreement, we follow our standard branding phases (Discovery → Direction → Concept → Revisions → Handoff). The phases above describe the monthly social media management cycle.',
    briefTitle: 'Branding Questionnaire',
    brief: BRANDING_QUESTIONS,
    sort: 3,
  },
  {
    ...STD,
    id: 'tpl-merch',
    name: 'Merch Design Agreement',
    tagline: 'Apparel, accessories & event merchandise design',
    subtitle: 'Universal (Business / Student)',
    frame: 'merch',
    categories: ['Merch', ...ADD],
    audience: 'any',
    covers: 'Design for apparel, accessories, and event merchandise — shirts, jackets, tote bags, mugs, IDs, stickers, and more, priced per item.',
    phases: [
      p('Selection & Brief', 'You tick the merch you need and describe the design intent, theme, and any text or logos.'),
      p('Concept', 'We draft initial concepts for each selected item.'),
      p('Design & Revision', 'We refine the chosen direction within the agreed revision rounds.'),
      p('Print-Ready Handoff', 'We deliver final print-ready files, plus mockups or editable source files if added on.'),
    ],
    briefTitle: 'Merch Brief',
    brief: brief('merch order'),
    sort: 4,
  },
  {
    ...STD,
    id: 'tpl-event-business',
    name: 'Event & Publication Campaign',
    tagline: 'Graphics, publication materials & media for any event',
    subtitle: 'Business / Commercial',
    frame: 'general',
    categories: ['Event & publication campaign', ...ADD],
    audience: 'business',
    covers: 'Complete graphics, publication materials, and media for any event — launches, conferences, fairs, programs, and more.',
    phases: EVENT_PHASES,
    briefTitle: 'Project Brief',
    brief: brief('event or campaign'),
    sort: 5,
  },
  {
    ...STD,
    id: 'tpl-event-student',
    name: 'Event & Publication Campaign',
    tagline: 'Graphics, publication materials & media for any event',
    subtitle: 'Student / School-Org',
    frame: 'general',
    categories: ['Event & publication campaign', ...ADD],
    audience: 'student',
    covers: 'Complete graphics, publication materials, and media for any school or organization event, at discounted student rates.',
    phases: EVENT_PHASES,
    briefTitle: 'Project Brief',
    brief: brief('event or campaign'),
    sort: 6,
  },
  {
    ...STD,
    id: 'tpl-election',
    name: 'Student Election Campaign',
    tagline: 'Branding & content kits for candidates and partylists',
    subtitle: 'Student Election',
    frame: 'general',
    categories: ['Student election', ...ADD],
    audience: 'student',
    covers: 'Campaign branding and ready-to-post content kits for individual candidates and partylists running in student elections.',
    phases: [
      p('Strategy & Brand', 'We create the campaign name, logo, and visual identity for the candidate or partylist.'),
      p('Content Plan', 'We map the full set of social posts and the rollout sequence from launch to election day.'),
      p('Production', 'We design the posts, frames, covers, and — for partylists — the per-candidate layouts.'),
      p('Revisions', 'Written feedback and refinement within your package’s revision rounds.'),
      p('Rollout Handoff', 'Canva-ready files and a mini brand guide are delivered so your team can post with confidence.'),
    ],
    briefTitle: 'Project Brief',
    brief: brief('election campaign'),
    sort: 7,
  },
  {
    ...STD,
    id: 'tpl-yearbook',
    name: 'Yearbook Design Agreement',
    tagline: 'Cover artwork, interior templates & full yearbook systems',
    subtitle: 'Institution / School-Org',
    frame: 'general',
    categories: ['Yearbook', ...ADD],
    audience: 'any',
    covers: 'Cover artwork, interior templates, and complete yearbook systems for schools and organizations, with optional printing.',
    phases: [
      p('Planning & Page Map', 'We confirm the sections, page count, and template scope of your yearbook.'),
      p('Cover Design', 'We design and refine the cover concepts (front, spine, and back).'),
      p('Interior Templates', 'We build the systemized interior layouts and master pages.'),
      p('Content Layout', 'Your content is placed into the templates, or the templates are handed off for your team to populate.'),
      p('Print Prep & Handoff', 'Print-ready master setup and editable INDD files are delivered, with optional printing handled through our partner press.'),
    ],
    briefTitle: 'Project Brief',
    brief: brief('yearbook'),
    sort: 8,
  },
  {
    ...STD,
    id: 'tpl-workbook',
    name: 'Academic Publication & Workbook',
    tagline: 'Workbooks, modules & educational publication design',
    subtitle: 'Academic / Educational',
    frame: 'general',
    categories: ['Academic workbook', 'Storybook', 'Accreditation booklet', ...ADD],
    audience: 'any',
    covers: 'Design and layout for workbooks, modules, and educational publications — including branding, illustration, and print-ready output.',
    phases: [
      p('Content Review & Structure', 'We review your manuscript and plan the learning flow and page structure.'),
      p('Branding & Cover', 'We design the workbook’s identity and cover.'),
      p('Layout & Illustration', 'We lay out the pages and create the supporting illustrations and visual accents.'),
      p('Revisions', 'Written feedback and refinement within your package’s revision rounds.'),
      p('Print-Ready Handoff', 'Final print-ready and digital PDF, plus editable source files, are delivered.'),
    ],
    briefTitle: 'Project Brief',
    brief: brief('workbook or publication'),
    sort: 9,
  },
  {
    ...STD,
    id: 'tpl-motion',
    name: 'Motion Graphics Agreement',
    tagline: 'Logo animation, motion branding & animated content',
    subtitle: 'Universal',
    frame: 'general',
    categories: ['Motion graphics', 'Animated storybook', ...ADD],
    audience: 'any',
    covers: 'Logo animation, motion branding, and animated content — from quick logo reveals to full motion branding suites.',
    phases: [
      p('Concept & Script', 'We define the idea, message, and timing of your animation.'),
      p('Storyboard', 'We map the scenes and key frames and send them for your approval before animating.'),
      p('Design & Illustration', 'We build the visual assets and style that the animation will use.'),
      p('Animation & Sound', 'We animate the piece and add sound design and effects.'),
      p('Review & Final Render', 'You review, we refine within your rounds, then export the final formats (MP4, MOV, and more).'),
    ],
    briefTitle: 'Project Brief',
    brief: brief('motion project'),
    sort: 10,
  },
  {
    ...STD,
    id: 'tpl-web',
    name: 'Web Design & Development',
    tagline: 'Landing pages, business websites & online stores',
    subtitle: 'Business / Commercial',
    frame: 'web',
    categories: ['Web design', ...ADD],
    audience: 'any',
    covers: 'Custom website design and development — from one-page landing sites to full business websites and online stores.',
    phases: [
      p('Discovery & Planning', 'We gather your goals, audience, and content, then map the site structure (sitemap) and pages.'),
      p('Design & Layout', 'We design the visual layout of each page, matched to your brand, and present it for your approval.'),
      p('Development & Build', 'We build the responsive website and integrate your content, forms, and features.'),
      p('Review & Revisions', 'You review a live preview and we refine within your package’s revision rounds.'),
      p('Launch & Handoff', 'We connect your domain, run final checks, launch the site, and hand off access and a short how-to guide.'),
    ],
    phasesNote: 'Hosting and domain are billed at the provider’s cost.',
    briefTitle: 'Website Brief',
    brief: [
      'Do you have an existing website or domain? If yes, please share the link.',
      'What pages do you need? (e.g. Home, About, Services, Products, Contact)',
      'What features do you need? (contact form, gallery, booking, online store, blog, maps)',
      'Share 2–3 websites you like and what you like about them.',
      'Who will provide the content (text, images, logo)?',
      'Target launch date.',
    ],
    sort: 11,
  },
  {
    ...STD,
    id: 'tpl-training',
    name: 'Design Training Seminar',
    tagline: 'Hands-on Adobe Illustrator & InDesign training',
    subtitle: 'Per Participant',
    frame: 'general',
    categories: ['Design training'],
    audience: 'any',
    covers: 'Hands-on Adobe Illustrator and InDesign training — practical sessions that teach how professional designers actually work.',
    phases: [
      p('Assessment & Scheduling', 'We confirm the participant count, skill level, and training dates.'),
      p('Materials Prep', 'We prepare the slides, practice files, and resource packs for the sessions.'),
      p('Training Delivery', 'Live, hands-on sessions run according to the agreed schedule.'),
      p('Practice & Critique', 'Participants work through guided exercises and receive direct feedback.'),
      p('Certification', 'Certificates of completion and the resource pack are handed off at the end.'),
    ],
    phasesNote: 'Daily flow: 9:00 AM training · short break · training · lunch · afternoon training session. Exact times are arranged with the organizer.',
    briefTitle: 'Training Details',
    brief: ['Number of participants and their current skill level.', 'Preferred training dates and venue.', 'Software versions available on the venue PCs (Adobe 2021 or later).', 'Topics or outputs you want the training to focus on.'],
    sort: 12,
  },
];

/** Contract fields every template fills from the client and the studio. */
export const CLIENT_FIELDS = [
  { key: 'client.name', label: 'Client name / organization' },
  { key: 'client.contact', label: 'Contact person' },
  { key: 'client.email', label: 'Email' },
  { key: 'client.phone', label: 'Phone number' },
  { key: 'client.address', label: 'Address' },
  { key: 'client.web', label: 'Website / social media' },
  { key: 'date', label: 'Date' },
  { key: 'startDate', label: 'Project start date' },
  { key: 'endDate', label: 'Expected completion date' },
  { key: 'paymentMethod', label: 'Payment method' },
  { key: 'signer', label: 'Name of the person signing (client)' },
  { key: 'designer', label: 'Designer signing for JoshWorks' },
] as const;

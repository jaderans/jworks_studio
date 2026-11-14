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
  'Branding & visual identity, social media management, illustration & mascots, packaging, merchandise design & production, motion graphics & video, event & publication campaigns, yearbook & publication layout, presentations, and design training.';
export const OUR_GOAL =
  'To deliver professional, original, human-made design that genuinely represents you. We treat every project as a partnership — we listen first, then craft. We use modern tools, including AI, only to support our process, never to replace the human creativity and craft at the heart of every project.';

const lines = (...l: string[]) => l.join('\n');

/** Terms and conditions 1–11, the same in every contract. One point per line. */
export const STANDARD_TERMS: ContractSection[] = [
  {
    id: 'payment',
    title: 'Payment Terms',
    on: true,
    body: lines(
      'Full payment or a 50% down payment is REQUIRED before delivery of the final design.',
      'The client receives final, high-resolution files only upon successful receipt of full payment.',
      'The down payment confirms the client’s commitment and reserves the project slot.',
      'A balance still unpaid 7 days after its due date keeps the files on hold and adds a late fee of 5% of the balance per week (up to 20%).',
      'The prices in this contract hold for 14 days; an unsigned contract after that may be re-quoted.',
    ),
  },
  {
    id: 'cancellation',
    title: 'Project Cancellation Policy',
    on: true,
    body: lines(
      'Cancellations during the production phase are NOT allowed; once production begins, the project is considered final and the down payment is non-refundable.',
      'This protects the time and resources committed by both parties.',
      'Logos and brand identity designs do not include editable / source files by default. Source files are released only under a separate written agreement and may carry additional fees.',
    ),
  },
  {
    id: 'client',
    title: 'Client Responsibilities',
    on: true,
    body: lines(
      'The client must provide clear, detailed instructions, brand guidelines, and references (style, color, content) at the start of the project.',
      'All feedback, approvals, and revision requests must be submitted in writing through the agreed communication channel.',
      'Project timelines begin only once the down payment and complete project materials are received.',
      'If the client does not reply for 30 days, the project is put on hold; after 60 days it is closed, payments made are kept, and a restart fee applies to resume it.',
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual Property Rights',
    on: true,
    body: lines(
      'Upon full payment, the client receives the right to use the commissioned design for its intended purpose.',
      'The designer retains intellectual property rights, including the right to display the work in their portfolio and use it for self-promotion, unless otherwise negotiated.',
      'Transfer of full ownership / IP is NOT included unless explicitly agreed in writing, and may carry an additional fee.',
      'JoshWorks may place a small “Designed by JoshWorks” credit on yearbooks, websites, and publications unless agreed otherwise.',
    ),
  },
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement',
    on: true,
    body: lines(
      'If the client requires confidentiality, an NDA must be requested and agreed in writing before the project begins; it may incur an additional fee.',
      'Under an active NDA, the designer will not display, share, or include the work in any public portfolio or promotional material.',
      'Without a signed NDA, the designer retains the right to feature completed work in their portfolio.',
    ),
  },
  {
    id: 'revisions',
    title: 'Revision Policy',
    on: true,
    body: lines(
      'One revision round is one consolidated, written list of changes.',
      'Revisions are limited to the number specified in the selected package; additional rounds incur extra charges (see Add-ons).',
      'A draft counts as approved if no written feedback arrives within 7 days of sending it.',
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
      'Final delivery is made via email or cloud storage; the client is responsible for downloading and backing up all delivered files.',
    ),
  },
  {
    id: 'files',
    title: 'File Formats and Usage',
    on: true,
    body: lines(
      'Standard deliverables include high-resolution PNG, JPEG, and PDF (plus package-specific formats), optimized for print and digital use.',
      'Editable source files (AI, PSD, SVG, INDD) are available as paid add-ons only.',
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
    id: 'privacy',
    title: 'Privacy, Signatures and Taxes',
    on: true,
    body: lines(
      'JoshWorks keeps the client’s personal details only for this project and its records, under the Data Privacy Act of 2012 (RA 10173).',
      'Electronic, online, and scanned signatures are as binding as handwritten ones (RA 8792, Electronic Commerce Act of 2000).',
      'Prices do not include VAT. A client who withholds tax gives JoshWorks BIR Form 2307 within 30 days of payment.',
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
  'I understand and accept the payment terms requiring payment before final delivery, and that late balances put files on hold and add a late fee.',
  'I acknowledge that project cancellations during production are not allowed.',
  'I agree to provide clear instructions and feedback in writing, and that a draft counts as approved if I send no feedback within 7 days.',
  'I understand the revision limits and additional charges for extra revisions.',
  'I accept the package turnaround unless rush service is selected.',
  'I understand that intellectual property rights remain with the designer for portfolio use unless otherwise agreed in writing.',
  'I acknowledge my responsibility to download and back up all delivered files.',
  'I agree that major concept changes after approval constitute new projects.',
  'I consent to JoshWorks keeping my details for this project, and I accept electronic signatures on this agreement.',
];

export const AUTHORITY_STATEMENT =
  'I confirm that all information provided is accurate and that I have the authority to enter into this agreement on behalf of my business / organization.';
export const CLIENT_ACK = 'By signing below, I confirm that I have read, understood, and agree to all terms, conditions, pricing, and services outlined in this agreement.';
export const DESIGNER_ACK = 'By signing below, I confirm my commitment to deliver the agreed services according to the terms in this contract.';
export const BINDING = 'This agreement is binding upon signature by both parties and remains in effect until project completion and final payment.';

/*
 * Questionnaires, in the format of domain/questionnaire.ts:
 * "## Section", "> intro", "Question?" or "Question? :: Option | Option | Other:".
 */

/** The studio's own Branding Questionnaire, word for word from the Word contracts (numbered 1–22; the original skipped 18). */
const BRANDING_QUESTIONS = [
  '> Please answer the following questions to help create the perfect brand identity for your organization:',
  '## About Your Business/Organization',
  'What is your business/organization name?',
  'What industry/field are you in?',
  'What products or services do you offer? (N/A if none)',
  'Who is your target audience? (Age, demographics, interests)',
  "What is your organization's mission statement?",
  'What are three words that describe your organization?',
  '## Visual Identity Preferences',
  'Do you have any existing brand colors? If yes, what are they?',
  'What color palette do you prefer? (Warm, cool, neutral, vibrant, muted)',
  'Are there any colors you absolutely want to avoid?',
  'What style/mood do you want your brand to convey? :: Professional & Corporate | Fun & Playful | Modern & Minimalist | Classic & Traditional | Bold & Edgy | Elegant & Sophisticated | Friendly & Approachable | Creative & Artistic | Other:',
  'Do you have any logo style preferences? :: Wordmark/Logotype (text-only) | Lettermark/Monogram (initials) | Pictorial/Brand mark (icon/symbol) | Abstract logo mark | Combination mark (text + symbol) | Emblem/Badge logo | Vintage/Retro logo | Minimalist logo | Other:',
  'Are there any specific elements you want included in your logo? (e.g., specific shapes, symbols, icons) Can you give me 3-5?',
  'What feeling should people have when they first see your logo?',
  '## Inspiration and References',
  'Can you provide examples of logos/brands you admire? (Please provide links, images, or descriptions)',
  'What do you like about these examples?',
  'Are there any logos/brands in your industry that you want to differentiate from?',
  'Do you have any existing marketing materials or brand elements?',
  '## Technical Requirements',
  'Where will your logo primarily be used?',
  'What file formats do you require? :: PNG | JPEG/JPG | PDF | SVG (vector) | AI | EPS | PSD (Photoshop) | All formats',
  'Will you need the logo in different orientations? :: Horizontal layout | Vertical layout | Square/circular layout | Stacked layout | Icon-only version | All orientations',
  'Do you have brand guidelines or style restrictions to follow? :: Yes (please attach/describe): | No restrictions',
  'Any additional requests or special considerations?',
];

const LAST = 'Any additional requests or special considerations?';
const APPROVER = 'Who approves the designs, and how fast can they reply?';

const SMM_QUESTIONS = [
  ...BRANDING_QUESTIONS.slice(0, -1),
  '## Social Media Management',
  'Which platforms should we manage? :: Facebook | Instagram | TikTok | YouTube | LinkedIn | X (Twitter) | Other:',
  'Links to your current pages and their follower counts.',
  'What should social media do for you? :: Brand awareness | Engagement | Inquiries/leads | Sales | Event turnout | Other:',
  'How many times a week do you want to post?',
  'What topics or content pillars should we cover? (products, tips, behind-the-scenes, promos, events)',
  'What tone should the captions use? :: Formal | Friendly | Playful | Inspirational | English | Taglish | Hiligaynon | Other:',
  'Who approves the posts, and how fast can they reply?',
  'Do you have photos or videos we can use, or will you need a shoot?',
  'Any dates, launches, or promos coming up in the next three months?',
  LAST,
];

const MERCH_QUESTIONS = [
  '> Tick what applies and answer in a few words. Blank lines can be filled in by hand.',
  '## About the Order',
  'What is your organization/event name, and what is the merch for?',
  'When do you need the designs, and when is the event or release date?',
  'Who is the merch for? (members, attendees, customers, staff)',
  '## Items & Printing',
  'Which items do you need designed? :: T-shirt | Polo shirt | Jacket/Hoodie | Tote bag | Mug/Tumbler | ID lace/Lanyard | Stickers | Pins/Badges | Cap | Other:',
  'Where will the design go? :: Front only | Front and back | Sleeve | Full print',
  'How will it be printed? :: Screen print | DTF | Sublimation | Embroidery | Not sure yet',
  'What colors are the shirts or items?',
  'How many pieces, and in what sizes? (if we arrange the printing)',
  'Do you already have a printer or supplier? :: Yes, our own printer | No, please recommend one',
  '## Design Direction',
  'What text, names, logos, or slogans must appear?',
  'What style/mood do you want? :: Professional & Corporate | Fun & Playful | Modern & Minimalist | Bold & Edgy | Vintage/Retro | Cute/Kawaii | Elegant & Sophisticated | Other:',
  'Are there colors you want to use or avoid?',
  'Can you share 2–3 designs or merch you like? (links or photos)',
  'What file formats do you require? :: PNG | PDF | AI | SVG (vector) | Mockups | All formats',
  APPROVER,
  LAST,
];

const EVENT_QUESTIONS = [
  '> Please answer so we can plan every material your event needs.',
  '## About the Event',
  'What is the event’s name, and who is organizing it?',
  'When and where is it happening?',
  'What is the goal of the campaign? :: Awareness | Registration/attendance | Sponsorships | Documentation | Fundraising | Other:',
  'Who is the target audience?',
  '## Materials',
  'Which materials do you need? :: Pubmats/Posters | Social media posts | Tarpaulins | Frames/Photo booth | Newsletter | Certificates | IDs/Lanyards | Programs/Invitations | Other:',
  'How many of each, and in what sizes?',
  'When do you need each material? (list the deadlines)',
  'Will these be printed? :: Yes, we print them | Yes, please arrange it | Digital only',
  '## Branding & Content',
  'Do you have an existing logo, theme, or color palette? If yes, please attach.',
  'What style/mood do you want? :: Professional & Corporate | Fun & Playful | Modern & Minimalist | Bold & Edgy | Elegant & Sophisticated | Youthful & Vibrant | Other:',
  'What content will you provide? (text, photos, speaker and sponsor logos)',
  'Can you share 2–3 event materials you like? (links or photos)',
  APPROVER,
  LAST,
];

const ELECTION_QUESTIONS = [
  '> For candidates and partylists. Answer what applies; blank lines can be filled in by hand.',
  '## About the Campaign',
  'What is the candidate’s or partylist’s name?',
  'Which position(s) are you running for, and how many candidates are in the slate?',
  'Which school and organization is the election for?',
  'What are the key dates? (filing, campaign period, election day)',
  '## Platform & Message',
  'What are your top 3–5 platforms or advocacies?',
  'Do you have a slogan or tagline? If not, any ideas?',
  'What should voters feel about your campaign? :: Trustworthy | Fresh & Youthful | Bold & Decisive | Friendly & Approachable | Serious & Competent | Other:',
  '## Visual Direction',
  'Do you have party colors or an existing logo? If yes, what are they?',
  'What style do you prefer? :: Modern & Minimalist | Bold & Edgy | Fun & Playful | Classic & Formal | Other:',
  'Can you share 2–3 campaign materials you like? (links or photos)',
  '## Content Kit',
  'What do you need? :: Campaign logo | Candidate posters | Platform posts | Countdown posts | Frames | Infographics | Video/Motion | Other:',
  'Who will provide the candidates’ photos, or do you need a photo shoot?',
  'What are the school’s rules for campaign materials? (sizes, number of posts, approvals)',
  APPROVER,
  LAST,
];

const YEARBOOK_QUESTIONS = [
  '> Help us plan your yearbook. Answer what you know; we will settle the rest together.',
  '## About the Yearbook',
  'What is the school or organization, and which batch/year is this for?',
  'Do you have a theme or title in mind?',
  'What page size do you want? :: A4 | Letter (8.5 × 11 in) | 8 × 10 in | Not sure yet | Other:',
  'About how many pages, and how many graduates or profiles?',
  '## Sections & Content',
  'Which sections should it have? :: Messages | Faculty & Staff | Graduates | Organizations | Events | Candid photos | Acknowledgments | Other:',
  'Who will provide the photos and write-ups, and in what format?',
  'When will all the content be ready?',
  '## Design Direction',
  'What style/mood do you want? :: Classic & Formal | Modern & Minimalist | Fun & Playful | Elegant & Sophisticated | Vintage/Retro | Other:',
  'Which school or batch colors should we use?',
  'Can you share 2–3 yearbooks or layouts you like? (links or photos)',
  '## Printing & Delivery',
  'What cover and binding do you want? :: Hardbound | Softbound | Not sure yet',
  'Should we arrange the printing? :: Yes, through your partner press | No, we have our own printer | Digital copy only',
  'When do you need the final yearbook released?',
  'Who approves the pages, and how fast can they reply?',
  LAST,
];

const WORKBOOK_QUESTIONS = [
  '> Tell us about your publication so we can plan its layout and illustrations.',
  '## About the Publication',
  'What is the title and subject?',
  'Who are the learners? (grade level, course, age)',
  'How many lessons, modules, or pages?',
  'What is the status of the manuscript? :: Final | Draft | Outline only | Not started',
  '## Design & Illustration',
  'What illustrations do you need? :: A few spot illustrations | Many illustrations | Characters/Mascot | Diagrams & infographics | None',
  'What style/mood do you want? :: Fun & Playful | Clean & Academic | Colorful & Vibrant | Modern & Minimalist | Other:',
  'Which school, department, or program logos and colors should we use?',
  'Are there format rules to follow? (DepEd, CHED, school template, accreditation)',
  '## Output & Printing',
  'What size? :: A4 | Letter (8.5 × 11 in) | B5 | Digital only | Other:',
  'What color printing? :: Full color | Black & white | Two-color',
  'Should we arrange the printing? :: Yes, please | No, we print it ourselves | Digital only',
  'When do you need the final files?',
  'Who approves the pages, and how fast can they reply?',
  LAST,
];

const MOTION_QUESTIONS = [
  '> Tell us about the motion piece so we can script and storyboard it.',
  '## About the Project',
  'What do you need? :: Logo animation | Explainer video | Social media reels | Event intro/AVP | Animated storybook | Other:',
  'What message or story should it tell?',
  'Who will watch it, and where will it be shown?',
  'How long should it be?',
  'What shape is the video? :: 16:9 landscape | 9:16 vertical | 1:1 square | 4:5 portrait | Several sizes',
  '## Script & Sound',
  'Who provides the script? :: We provide it | Please write it | Not needed',
  'Do you need a voiceover? :: Yes, English | Yes, Filipino/Hiligaynon | No voiceover',
  'What music should it use? :: Royalty-free music | We provide the music | No music',
  '## Visual Direction',
  'What style do you want? :: 2D flat animation | Kinetic typography | Character animation | Motion collage | Logo-based | Other:',
  'Which brand assets should we use? (logo, colors, fonts, photos, footage)',
  'Can you share 2–3 animations you like? (links)',
  'What file formats do you require? :: MP4 | MOV | GIF | WebM | Other:',
  'When do you need the final video?',
  LAST,
];

const WEB_QUESTIONS = [
  '> Tell us about your website so we can plan its pages and features.',
  '## About the Website',
  'What is the website for? (business, organization, portfolio, online store)',
  'Do you have an existing website? If yes, please share the link.',
  'Do you have a domain name? :: Yes, I have one | No, please help me get one',
  'Who will visit the site, and what should they do there?',
  '## Pages & Features',
  'Which pages do you need? :: Home | About | Services | Products | Portfolio/Gallery | Contact | Blog/News | FAQ | Other:',
  'Which features do you need? :: Contact form | Booking | Online store | Gallery | Blog | Maps | Messenger chat | Other:',
  'Who will provide the content? :: We provide text and photos | Please write the text | A mix of both',
  '## Design Direction',
  'Do you have a logo and brand colors? If yes, please attach.',
  'Can you share 2–3 websites you like, and what you like about them?',
  'What style/mood do you want? :: Professional & Corporate | Modern & Minimalist | Fun & Playful | Bold & Edgy | Elegant & Sophisticated | Other:',
  '## Launch',
  'What is your target launch date?',
  'Who will update the site after launch? :: We will | Please maintain it for us | Not sure yet',
  LAST,
];

const TRAINING_QUESTIONS = [
  '> Help us prepare the training for your group.',
  '## About the Participants',
  'How many participants will join?',
  'What is their skill level? :: Beginner | Intermediate | Advanced | Mixed',
  'Which software should we cover? :: Adobe Illustrator | Adobe InDesign | Adobe Photoshop | Canva | Other:',
  'What should they be able to make by the end? (topics or outputs)',
  '## Schedule & Venue',
  'What are your preferred training dates and times?',
  'Where will the training happen?',
  'Which software versions are installed on the venue computers? (Adobe 2021 or later)',
  'Will each participant have their own computer? :: Yes | No, they will share | They will bring laptops',
  '## Wrap-up',
  'Do you need certificates of completion? :: Yes | No',
  'Who is the contact person for the training?',
  LAST,
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

/** The Motion Graphics template as first shipped, and now that it also offers video editing. */
const MOTION_V1 = {
  tagline: 'Logo animation, motion branding & animated content',
  covers: 'Logo animation, motion branding, and animated content — from quick logo reveals to full motion branding suites.',
  categories: ['Motion graphics', 'Animated storybook', ...ADD],
};
const MOTION_NOW = {
  tagline: 'Logo animation, motion branding, animation & video',
  covers: 'Logo animation, motion branding, animated content and video editing — from quick logo reveals and reels to event highlights, AVPs and full motion branding suites.',
  categories: ['Motion graphics', 'Animated storybook', 'Video', ...ADD],
};


/*
 * November 2026: eight more templates. Each keeps the eleven standard terms in
 * the same order and ids; only the sections the work changes are reworded.
 */

/** The standard terms with some sections reworded (and retitled) for one kind of work. */
function termsWith(changes: Record<string, { title?: string; body: string[] }>): ContractSection[] {
  return STANDARD_TERMS.map((s) => {
    const c = changes[s.id];
    return c ? { ...s, title: c.title ?? s.title, body: lines(...c.body) } : { ...s };
  });
}

const AGREE_FIRST = 'I have read, understood, and agree to all terms and conditions in this contract.';
const AGREE_CONSENT = 'I consent to JoshWorks keeping my details for this project, and I accept electronic signatures on this agreement.';
const NO_REPLY = 'If the client does not reply for 30 days, the project is put on hold; after 60 days it is closed, payments made are kept, and a restart fee applies to resume it.';

// ----- Merch production -----
const MERCH_MAKE_QUESTIONS = [
  '> Tell us what to make. Tick what applies; blank lines can be filled in by hand.',
  '## About the Order',
  'What is your organization, business or event, and what is the merch for?',
  'When do you need the finished pieces, and how will you get them? :: Pickup in Iloilo City | Courier | Other:',
  '## Items',
  'Which items should we make? :: Button pins | Enamel pins | Stickers | Acrylic keychains | Acrylic standees | ID laces | Shirts | Tote bags | Mugs/Tumblers | Ref magnets | Bookmarks/Postcards | Patches | Other:',
  'How many of each, and in what sizes?',
  'Which finishes do you want? :: Matte | Glossy | Holographic | Glitter | Clear | Not sure yet',
  'How should they be packed? :: In bulk | One by one in sleeves | With backing cards | Gift-ready',
  '## Artwork',
  'Do you have print-ready artwork? :: Yes, we will send it | Please design it | Please fix ours for print',
  'Do you own, or have permission to use, every logo, character and artwork? :: Yes | Not sure, please advise',
  'Which colors must match exactly? (brand or Pantone colors, if any)',
  'Do you want a physical sample before the full run? :: Yes | No',
  APPROVER,
  LAST,
];
const MERCH_MAKE_PHASES = [
  p('Order & Quote', 'You tell us the items, quantities and sizes; we confirm the materials, minimum orders, prices and production time.'),
  p('Artwork & Proof', 'We prepare the artwork (or check yours for print) and send a digital proof of every item for your written approval.'),
  p('Production Run', 'Production starts once the proof is approved and the down payment is in. Partner-made items follow their factory’s schedule.'),
  p('Quality Check & Packing', 'We check, count and pack every piece, then tell you the order is ready.'),
  p('Pickup or Delivery', 'Once the balance is paid, pick up in Iloilo City or we ship by courier at your cost.'),
];
const MERCH_MAKE_TERMS = termsWith({
  payment: {
    body: [
      'A 50% down payment is REQUIRED before production; production starts only after the down payment and the client’s written approval of the final proof.',
      'The balance is paid before pickup or delivery of the finished pieces.',
      'A balance still unpaid 7 days after the order is ready keeps it on hold and adds a late fee of 5% of the balance per week (up to 20%).',
      'Finished pieces not picked up within 60 days of being ready may be disposed of, and payments made are kept.',
      'The prices in this contract hold for 14 days; supplier price changes after that may be re-quoted.',
    ],
  },
  cancellation: {
    title: 'Order Cancellation and Changes',
    body: [
      'An order can’t be cancelled once production starts (after proof approval and the down payment); from then on the down payment is non-refundable.',
      'Before production starts, an order can be cancelled; design work already done is billed.',
      'Changing quantities, sizes or materials after proof approval is a new order and may change the price and the delivery date.',
    ],
  },
  client: {
    body: [
      'The client sends the final artwork, text, quantities, sizes and colors in writing, or approves the artwork JoshWorks designs.',
      'The client confirms they own, or have permission to use, every logo, character, photo and artwork sent for production. JoshWorks may decline copyrighted or trademarked designs without that permission.',
      'All approvals and changes are made in writing through the agreed communication channel.',
      'If the client does not reply for 30 days, the order is put on hold; after 60 days it is closed and payments made are kept.',
    ],
  },
  ip: {
    body: [
      'Artwork the client supplies stays the client’s property; JoshWorks uses it only for this order.',
      'Designs created by JoshWorks may be used by the client on the ordered items; other products or resale need the commercial-use or ownership add-on.',
      'JoshWorks may photograph the finished pieces for its portfolio and social media unless an NDA is agreed.',
    ],
  },
  revisions: {
    title: 'Proofs and Revisions',
    body: [
      'Every order gets a digital proof (layout, size and colors) to approve in writing before production.',
      'Revision rounds on artwork JoshWorks designs follow the package; extra rounds are charged (see Add-ons).',
      'The approved proof is final: once approved, spelling, names, dates and quantities on it are the client’s responsibility.',
      'A physical sample before the full run is available as an add-on.',
    ],
  },
  timeline: {
    title: 'Production and Delivery',
    body: [
      'Production time starts after proof approval and the down payment, and follows the turnaround of each item.',
      'Items made by partner factories (such as enamel pins, ID laces and patches) depend on their schedules; JoshWorks tells the client right away about any delay.',
      'Pickup is in Iloilo City; courier delivery is at the client’s cost. Once handed to the courier, delays and damage in transit are the courier’s, and JoshWorks helps file the claim.',
      'Late approvals, missing artwork or unpaid balances move the delivery date.',
    ],
  },
  files: {
    title: 'Quality, Colors and Defects',
    body: [
      'Printed colors may differ slightly from screen colors; the approved proof is the reference.',
      'Small differences in cut, color and finish between pieces and batches are normal in production.',
      'Defective pieces must be reported within 3 days of pickup or delivery, with photos; JoshWorks remakes or refunds the defective pieces only.',
      'Every order is counted before release; a short count is completed or refunded.',
    ],
  },
});
const MERCH_MAKE_AGREEMENT = [
  AGREE_FIRST,
  'I agree to the selected items, quantities and prices, and any add-ons.',
  'I understand that production starts only after I approve the proof in writing and pay the down payment, and that the order can’t be cancelled after that.',
  'I confirm I own, or have permission to use, all artwork, logos and characters I send for production.',
  'I accept that printed colors may differ slightly from the screen, and that defects must be reported within 3 days of receiving the order.',
  'I understand the balance is paid before pickup or delivery, and that courier fees are mine.',
  'I acknowledge that unclaimed orders may be disposed of 60 days after they are ready.',
  AGREE_CONSENT,
];

// ----- Packaging & labels -----
const PACKAGING_QUESTIONS = [
  '> Tell us about your product so we can design packaging that sells.',
  '## About the Product',
  'What is the product, and what is its name?',
  'How many variants (flavors, scents, sizes) need packaging?',
  'Where will it be sold? :: Sari-sari stores | Supermarkets | Pasalubong centers | Online shops | Cafés/Restaurants | Markets & bazaars | Other:',
  'Who buys it? (age, lifestyle, price range)',
  '## Packaging',
  'What packaging do you need? :: Label/Sticker | Stand-up pouch | Box | Bottle/Jar wrap | Sachet | Paper bag | Hang tag | Sleeve | Other:',
  'Do you have the sizes or the printer’s dieline? :: We have a dieline | We know the sizes | Please help us',
  'How will it be printed? :: Sticker labels | Offset | Digital print | Not sure yet',
  '## Label Details',
  'Which details will you provide? :: Net weight/volume | Ingredients | Nutrition facts | Allergens | Manufacturer name & address | FDA LTO/CPR number | Barcode | Expiry/Lot code | Storage instructions | Other:',
  '## Design Direction',
  'Do you have a logo and brand colors? If yes, please attach.',
  'What style/mood do you want? :: Premium & Elegant | Fun & Playful | Natural & Organic | Modern & Minimalist | Homemade & Local | Bold & Vibrant | Other:',
  'Can you share 2–3 packaging designs you like? (links or photos)',
  'How many pieces will you print first, and when do you need them?',
  APPROVER,
  LAST,
];
const PACKAGING_PHASES = [
  p('Product Brief', 'We learn about your product, buyers and where it sells, and the packaging and printing you plan.'),
  p('Dieline & Label Layout', 'We set up the dieline and place your required label details so everything fits and reads clearly.'),
  p('Concept & Design', 'We design the front and every panel, shown on 3D mockups.'),
  p('Revisions & Print Check', 'You send written feedback; we refine within your rounds and check the files against your printer’s specifications.'),
  p('Print-Ready Handoff', 'Print-ready files with dielines and mockups are delivered once the balance is settled.'),
];
const PACKAGING_TERMS = termsWith({
  client: {
    body: [
      'The client must provide clear, detailed instructions, product details, brand guidelines, and references at the start of the project.',
      'The client supplies, and is responsible for the accuracy of, every product, legal and regulatory detail on the packaging (product name, net content, ingredients, nutrition facts, allergens, manufacturer details, FDA registration, barcodes, expiry and lot codes). JoshWorks lays them out as provided.',
      'The client provides the printer’s dieline or specifications, or asks JoshWorks to prepare one (see Add-ons).',
      'All feedback, approvals, and revision requests must be submitted in writing through the agreed communication channel.',
      'Project timelines begin only once the down payment and complete project materials are received.',
      NO_REPLY,
    ],
  },
  files: {
    body: [
      'Deliverables are print-ready PDF files with dielines, plus PNG and JPEG mockups for selling online.',
      'Editable source files (AI, PSD) are available as paid add-ons only.',
      'A printed test sample is recommended before a full run; colors on screen may differ from print.',
      'Printing and packaging production are not included unless stated and are quoted separately.',
    ],
  },
});
const PACKAGING_AGREEMENT = [...STANDARD_AGREEMENT.slice(0, 5), 'I am responsible for the accuracy of the product and regulatory details printed on my packaging.', ...STANDARD_AGREEMENT.slice(5)];

// ----- Illustration & mascots -----
const ILLUSTRATION_QUESTIONS = [
  '> Tell us about the illustration or character so we can sketch the right idea.',
  '## About the Artwork',
  'What do you need? :: Spot illustration | Full illustration | Portrait | Character design | Mascot | Comic | Other:',
  'What is it for? :: Personal/Gift | Social media | Merch for sale | Packaging | Book/Publication | Brand mascot | Other:',
  'Describe the subject or scene. (who or what, doing what, where)',
  '## Character Details',
  'For a character or mascot: its name, personality, age, and what it stands for.',
  'How many poses or expressions do you need?',
  '## Style',
  'What style do you prefer? :: Chibi/Cute | Cartoon | Anime/Manga | Semi-realistic | Flat vector | Watercolor/Painterly | Line art | Other:',
  'What colors should we use or avoid?',
  'What background do you want? :: None (transparent) | Simple color | Full scene',
  'Can you share 2–3 references or artworks you like? (links or photos)',
  '## Delivery',
  'What size and format do you need? (for print or screen)',
  'When do you need the final artwork?',
  LAST,
];
const ILLUSTRATION_PHASES = [
  p('Brief & References', 'You describe the subject, use and style; we confirm the sizes and the license you need.'),
  p('Sketch', 'We send rough sketches of the pose and composition for your approval.'),
  p('Line Art & Color', 'We draw the final line art and color the approved sketch.'),
  p('Revisions', 'Written feedback and refinement within your package’s revision rounds.'),
  p('Final Files', 'High-resolution files are delivered once the balance is settled, with the use rights in this agreement.'),
];
const ILLUSTRATION_TERMS = termsWith({
  ip: {
    title: 'Intellectual Property and Use',
    body: [
      'Upon full payment, the client may use the artwork for personal and non-commercial purposes (social media, gifts, personal prints).',
      'Commercial use (products for sale, merchandise, advertising, packaging, or a mascot used for a business) needs the commercial-use license or the full IP ownership transfer (see Add-ons and Ownership).',
      'The artist keeps the copyright and may show the work in the portfolio and on social media, unless an NDA or a buy-out is agreed.',
      'The client may not resell the artwork, trace or edit it into new artwork, or use it to train AI models without written permission.',
    ],
  },
  revisions: {
    body: [
      'Sketches are approved before line art and color; changing the pose, composition or character after the sketch is approved counts as a revision round or a change order.',
      'One revision round is one consolidated, written list of changes.',
      'Revisions are limited to the number specified in the selected package; additional rounds incur extra charges (see Add-ons).',
      'A draft counts as approved if no written feedback arrives within 7 days of sending it.',
    ],
  },
  files: {
    body: [
      'Standard deliverables are high-resolution PNG (transparent where possible) and JPEG, plus PDF for print.',
      'Layered source files (PSD, Procreate, AI) are available as paid add-ons only.',
      'Printing, merchandise and mascot costume production are not included unless stated and are quoted separately.',
    ],
  },
});
const ILLUSTRATION_AGREEMENT = [...STANDARD_AGREEMENT.slice(0, 7), 'I understand that personal use is included, and that commercial use needs the commercial-use license or the ownership add-on.', ...STANDARD_AGREEMENT.slice(7)];

// ----- Design retainer -----
const RETAINER_QUESTIONS = [
  '> Help us set up your monthly design support.',
  '## About You',
  'What is your business or organization, and what do you do?',
  'Do you have a brand kit (logo, colors, fonts, templates)? :: Yes, we will send it | Partly | No, please make one',
  '## Monthly Requests',
  'What designs do you usually need? :: Pubmats/Social posts | Stories | Flyers/Posters | Menus/Price lists | Tarpaulins | Presentations | Certificates | Other:',
  'About how many designs do you need each month?',
  'Which sizes or platforms? :: Facebook | Instagram | TikTok | Print (A4/A3) | Tarpaulin | Other:',
  'How fast do you usually need a design? :: Same day | 1–2 days | 3–5 days | Weekly batch',
  'Do you have busy seasons or big dates coming up?',
  '## Working Together',
  'How will you send requests? :: Messenger | Email | Google Form | Shared folder | Other:',
  'Who sends the requests, and who approves the designs?',
  LAST,
];
const RETAINER_PHASES = [
  p('Onboarding', 'We collect your brand kit, set up templates, and agree on the request channel and turnaround.'),
  p('Monthly Requests', 'You send requests through the agreed channel during the month, up to your monthly limit.'),
  p('Design & Delivery', 'Each request is designed and delivered within the agreed turnaround.'),
  p('Review', 'You approve or send written feedback; each request includes its revision rounds.'),
  p('Monthly Recap', 'At month end we share what was made and plan the next month with you.'),
];
const RETAINER_TERMS = termsWith({
  payment: {
    body: [
      'The monthly fee is paid in advance, on or before the agreed billing date each month; the first month starts once the first payment is received.',
      'Requests are worked on only while the current month is paid; an unpaid month puts requests on hold.',
      'A fee still unpaid 7 days after its billing date adds a late fee of 5% of the fee per week (up to 20%).',
      'The monthly fee holds for the minimum term; any change after that is agreed in writing at least 30 days ahead.',
    ],
  },
  cancellation: {
    title: 'Term and Ending the Retainer',
    body: [
      'The retainer has a minimum term of 3 months.',
      'After the minimum term, either party may end the retainer with 30 days’ written notice; requests in the last paid month are finished and delivered.',
      'Ending during the minimum term means the remaining months of the minimum term are still due.',
    ],
  },
  revisions: {
    title: 'Requests and Revisions',
    body: [
      'A request is one finished design in one size; other sizes of the same design count as included resizes (per package) or as extra requests.',
      'Requests beyond the monthly limit are billed at the extra-design rate on the price list.',
      'Unused requests don’t carry over to the next month.',
      'Each request includes the revision rounds in the package; a draft counts as approved if no written feedback arrives within 7 days.',
    ],
  },
  timeline: {
    title: 'Turnaround and Delivery',
    body: [
      'Each request is delivered within the package turnaround, counted in working days from a complete request (text, photos and size).',
      'Requests are worked in the order received, unless the client marks one as a priority; same-day requests are rush add-ons.',
      'Delays caused by late feedback, incomplete materials, or unpaid months are not the designer’s responsibility.',
      'Final files are delivered via email or cloud storage; the client is responsible for downloading and backing them up.',
    ],
  },
});
const RETAINER_AGREEMENT = [
  AGREE_FIRST,
  'I agree to the monthly fee, the number of requests each month, and any add-ons.',
  'I understand the fee is paid in advance each month, and that an unpaid month puts requests on hold.',
  'I accept the 3-month minimum term and the 30-day written notice to end the retainer.',
  'I understand that unused requests don’t carry over, and that extra requests are billed separately.',
  'I agree to send complete requests in writing through the agreed channel, and that a draft counts as approved if I send no feedback within 7 days.',
  'I understand that intellectual property rights remain with the designer for portfolio use unless otherwise agreed in writing.',
  AGREE_CONSENT,
];

// ----- Weddings & celebrations -----
const CELEBRATION_QUESTIONS = [
  '> Congratulations! Tell us about your celebration so we can design pieces that feel like you.',
  '## The Celebration',
  'What are we celebrating? :: Wedding | Debut | Christening/Baptism | Birthday | Anniversary | Gender reveal | Other:',
  'Names exactly as they should appear (celebrants, parents, sponsors).',
  'Date, time and venue of the ceremony and the reception.',
  'About how many guests?',
  '## Theme & Style',
  'What is your motif or color palette?',
  'What style do you like? :: Classic & Elegant | Rustic | Modern & Minimalist | Filipiniana | Floral | Whimsical & Playful | Other:',
  'Can you share 2–3 invitations or designs you like? (links or photos)',
  '## What You Need',
  'Which pieces do you need? :: E-vite | Printed invitation | Save-the-date | RSVP card | Entourage list | Monogram | Welcome sign | Seating chart | Program | Menu card | Souvenir tags | Thank-you cards | LED wall graphics | Other:',
  'Printed or digital, and how many pieces?',
  'Any paper or finish wishes? :: Textured cardstock | Vellum overlay | Envelope + wax seal | Ribbon | Not sure yet',
  'When do you need everything ready?',
  APPROVER,
  LAST,
];
const CELEBRATION_PHASES = [
  p('Consultation', 'We talk through your celebration, motif, guest count and the pieces you need.'),
  p('Concept & Monogram', 'We set the look: colors, type, and the monogram or main motif.'),
  p('Design Suite', 'We design the invitation and every piece in your package to match.'),
  p('Proof & Revisions', 'You check every name, date and venue on the proof; we refine within your rounds.'),
  p('Print & Release', 'Printed pieces are produced and packed, or digital files delivered, before your event.'),
];
const CELEBRATION_TERMS = termsWith({
  cancellation: {
    title: 'Postponement and Cancellation',
    body: [
      'If the celebration is postponed, the work continues on the new schedule.',
      'If it is cancelled, the design work done so far is billed and the down payment is non-refundable; printing already done is charged in full.',
    ],
  },
  client: {
    body: [
      'The client provides every name, date, time, venue and entourage detail in writing, spelled exactly as it should print.',
      'Invitations should be ordered at least 8 weeks before a wedding and 4 weeks before other celebrations; later orders may need the rush add-on.',
      'All feedback, approvals, and revision requests must be submitted in writing through the agreed communication channel.',
      'Project timelines begin only once the down payment and complete details are received.',
    ],
  },
  ip: {
    body: [
      'Upon full payment, the client may use the designs for their celebration, in print and online.',
      'JoshWorks may show the work in its portfolio with names, faces, dates and venues removed or blurred, unless the client agrees otherwise.',
      'Transfer of full ownership / IP is NOT included unless explicitly agreed in writing, and may carry an additional fee.',
    ],
  },
  revisions: {
    body: [
      'One revision round is one consolidated, written list of changes.',
      'Revisions are limited to the number specified in the selected package; additional rounds incur extra charges (see Add-ons).',
      'The client proofreads every name, date and venue on the final proof; once it is approved, reprints for errors in approved details are charged.',
      'Major concept changes after approval are treated as new projects or change orders.',
    ],
  },
  timeline: {
    body: [
      'The event date is the deadline: JoshWorks schedules the work so printed pieces are ready before it, provided details and approvals arrive on time.',
      'Late details or approvals may need the rush add-on, or printed pieces may become digital only.',
      'Digital files are delivered via email or cloud storage; printed pieces are picked up in Iloilo City or sent by courier at the client’s cost.',
    ],
  },
});
const CELEBRATION_AGREEMENT = [
  AGREE_FIRST,
  'I agree to the selected package pricing and any additional add-on services.',
  'I will send complete, correctly spelled details, and I will check every name, date and venue on the final proof.',
  'I understand that printed pieces depend on my details and approvals arriving on time before the event date.',
  'I understand and accept the payment terms requiring payment before final delivery, and that a cancelled celebration still pays for the work done.',
  'I understand the revision limits and the charges for extra revisions and reprints.',
  AGREE_CONSENT,
];

// ----- Academic & thesis visuals -----
/** The template as shipped in catalog version 2, when it covered research only. */
const RESEARCH_V2 = {
  name: 'Thesis & Research Visuals Agreement',
  tagline: 'Research posters, infographics & defense slides',
  covers: 'Visual design for research — posters, infographics, defense and conference slides, graphical abstracts and programs — designed from the client’s own final content.',
  briefTitle: 'Research Visuals Questionnaire',
  brief: [
    '> Tell us about your research so we can design it clearly. We design your content; the research stays yours.',
    '## About the Research',
    'What is the title, and which school, college and program is it for?',
    'What do you need? :: Research poster | Conference poster | Infographic | Defense slides | Graphical abstract | Title page/Cover | Program/Booklet | Other:',
    'When is your defense, colloquium or presentation?',
    '## Format',
    'What size or format? :: A1 | A0 | 3 × 4 ft tarpaulin | 36 × 48 in | A3 | 16:9 slides | Other:',
    'Does your school or adviser require a template, logos or sections?',
    'How many charts, tables or figures should we redraw?',
    'Which file do you need? :: PowerPoint | Google Slides | Canva | PDF | Other:',
    '## Content & Style',
    'Is your content final? :: Final | Almost final | Still changing',
    'Which colors or style? :: School colors | Clean & Academic | Modern & Minimalist | Colorful | Other:',
    'Do you need it printed? :: Yes, please arrange it | No, we print it ourselves',
    'Who approves the design (you, your group leader, your adviser), and how fast can they reply?',
    LAST,
  ],
};
/** Catalog version 3: every academic commission (brochures, class and lecture slides, reviewers, capstone logos). */
const RESEARCH_NOW = {
  name: 'Academic & Thesis Visuals Agreement',
  tagline: 'Slides, posters & brochures for thesis, research and class',
  covers: 'Visual design for academic work — thesis and research posters, brochures, infographics, defense, report and lecture slides, slide templates, reviewers, capstone logos and programs — designed from the client’s own final content.',
  briefTitle: 'Academic Visuals Questionnaire',
  brief: [
    '> Tell us about your thesis, research or class work so we can design it clearly. We design your content; the work stays yours.',
    '## About the Work',
    'What is the title, and which school, college and program is it for?',
    'What do you need? :: Defense slides | Report/Class slides | Lecture slides | Slide template | Research poster | Brochure | Infographic | Graphical abstract | Reviewer/Handout | Capstone logo | Title page/Cover | Program/Booklet | Other:',
    'When is your defense, report or class presentation?',
    '## Format',
    'What size or format? :: A1 | A0 | 3 × 4 ft tarpaulin | 36 × 48 in | A3 | Trifold A4 | 16:9 slides | Other:',
    'Does your school, teacher or adviser require a template, logos or sections?',
    'About how many slides or pages?',
    'How many charts, tables or figures should we redraw?',
    'Which file do you need? :: PowerPoint | Google Slides | Canva | PDF | Other:',
    '## Content & Style',
    'Is your content final? :: Final | Almost final | Still changing',
    'Which colors or style? :: School colors | Clean & Academic | Modern & Minimalist | Colorful | Other:',
    'Do you need it printed? :: Yes, please arrange it | No, we print it ourselves',
    'Who approves the design (you, your group leader, your teacher or adviser), and how fast can they reply?',
    LAST,
  ],
};
const RESEARCH_PHASES = [
  p('Content Review', 'We go through your final content and figures, and your school’s requirements.'),
  p('Layout Direction', 'We set the grid, colors and type, following any required template.'),
  p('Design', 'We lay out the poster, slides or infographic and redraw charts and figures for clarity.'),
  p('Revisions', 'You, your group or your adviser send written feedback within your rounds.'),
  p('Final Files', 'Print-ready and editable files are delivered in time for your defense or presentation.'),
];
const researchTerms = (deadline: string) =>
  termsWith({
  client: {
    body: [
      'The client provides the final content (text, data, figures, references and any required school template) and remains responsible for its accuracy, originality and citations.',
      'JoshWorks designs and lays out the content it is given. It does not write, analyze, paraphrase or check the research itself.',
      'The client follows their school’s and adviser’s rules on outside help with formatting and design.',
      'All feedback and approvals are given in writing; timelines begin once the down payment and the final content arrive.',
    ],
  },
  ip: {
    body: [
      'The research and its content remain the client’s.',
      'The client may use the design (layout, graphics and templates) for this research, its presentations and its publications.',
      'JoshWorks may show the design in its portfolio with the research content blurred, unless the client agrees otherwise or an NDA is signed.',
    ],
  },
  timeline: {
    body: [
      deadline,
      'Delays caused by late content or late feedback are not the designer’s responsibility.',
      'Final files are delivered via email or cloud storage; printing is quoted separately.',
    ],
  },
});
/** As shipped in catalog version 2. */
const RESEARCH_TERMS_V2 = researchTerms('The defense or presentation date is the deadline: the final content must arrive at least 5 working days before it (2 working days with the rush add-on).');
/** Class reports take 2–3 days, so the content deadline follows the package turnaround. */
const RESEARCH_TERMS = researchTerms('The defense, report or class date is the deadline: the final content must arrive at least the package turnaround before it; sooner needs the rush add-on.');
const RESEARCH_AGREEMENT = [
  AGREE_FIRST,
  'I agree to the selected package pricing and any additional add-on services.',
  'I confirm the content I provide is my own (or my group’s) and correctly cited, and that JoshWorks only designs and lays it out.',
  'I will follow my school’s rules on outside design help.',
  'I understand and accept the payment terms requiring payment before final delivery.',
  'I understand the revision limits and additional charges for extra revisions.',
  AGREE_CONSENT,
];

// ----- Company profile & pitch deck -----
const DECK_QUESTIONS = [
  '> Tell us about your business and the story your profile or deck should tell.',
  '## About the Business',
  'What is your company, what do you do, and who are your clients?',
  'What do you need? :: Company profile | Pitch deck (investors) | Sales deck | Capability statement | Presentation template | Product catalog | Annual report | Other:',
  'Who will read or watch it, and what should they do after? (invest, buy, partner, hire)',
  '## Content',
  'How many pages or slides do you expect?',
  'Is the content ready? :: Final text | Draft | Outline only | Please write it',
  'What will you provide? :: Logo & brand guide | Photos | Product shots | Data & charts | Client logos | Testimonials | Other:',
  '## Format & Style',
  'Which format do you need? :: PowerPoint | Google Slides | Keynote | Canva | Printed booklet | PDF | Other:',
  'What style/mood do you want? :: Professional & Corporate | Modern & Minimalist | Bold & Edgy | Elegant & Sophisticated | Friendly & Approachable | Other:',
  'Can you share 2–3 decks or profiles you like? (links)',
  'When do you need it? (meeting, pitch or launch date)',
  APPROVER,
  LAST,
];
const DECK_PHASES = [
  p('Discovery & Outline', 'We learn your goal and audience, then outline the story page by page or slide by slide.'),
  p('Content Structure', 'We organize your content (or write it, if added on) and plan the charts and visuals.'),
  p('Design', 'We design the master layouts and every page or slide on your brand.'),
  p('Revisions', 'Written feedback and refinement within your package’s revision rounds.'),
  p('Handoff', 'You receive the final PDF and the editable file in the agreed format.'),
];
const DECK_TERMS = termsWith({
  client: {
    body: [
      'The client must provide clear instructions, brand guidelines, and the content (text, figures, photos) at the start of the project.',
      'The client is responsible for the accuracy of the company information, figures and claims in the document; copywriting is available as an add-on.',
      'All feedback, approvals, and revision requests must be submitted in writing through the agreed communication channel.',
      'Project timelines begin only once the down payment and complete project materials are received.',
      NO_REPLY,
    ],
  },
  files: {
    body: [
      'Decks and templates are delivered as a PDF plus an editable file in the agreed format (PowerPoint, Google Slides, Keynote or Canva).',
      'Original design files (AI, INDD) for printed profiles are available as paid add-ons.',
      'Fonts, stock photos and icons used are licensed for the client’s use of this document; extra licenses the client needs are billed at cost.',
      'Printing is not included unless stated and is quoted separately.',
    ],
  },
});

// ----- Government & LGU -----
const GOVERNMENT_QUESTIONS = [
  '> For LGUs, government offices and public schools. Answer what applies; we will match your procurement documents.',
  '## The Office & Project',
  'Which office or LGU, and what is the project or program title?',
  'What is the purchase request, PO or JO number, if any?',
  'How is it being procured? :: Small Value Procurement | Shopping | Direct contracting | Negotiated procurement | Not sure yet | Other:',
  '## Deliverables',
  'What do you need? :: IEC materials | Tarpaulins/Streamers | Event branding | Tourism/Town map | Annual/Accomplishment report | Citizen’s Charter | Signage/Wayfinding | Social media cards | AVP/Video | Other:',
  'How many of each, and in what sizes?',
  'Which languages? :: English | Filipino | Hiligaynon | Kinaray-a | Other:',
  'Which official logos must appear? :: Office seal | Bagong Pilipinas logo | Program/Project logo | Partner agency logos | Other:',
  'Does your agency have branding or layout rules to follow?',
  '## Schedule & Approvals',
  'When is the event or the delivery date?',
  'Who is the contact person, and who approves the designs?',
  'Do you need printing, delivery or installation? :: Printing | Delivery | Installation | Design files only',
  LAST,
];
const GOVERNMENT_PHASES = [
  p('Purchase Order & Brief', 'We confirm the scope, quantities and schedule in your PR, PO or JO and receive the approved content.'),
  p('Design Direction', 'We propose the look, following your office’s branding rules and required logos.'),
  p('Production', 'We design every material in the order, in the languages required.'),
  p('Review & Approval', 'Your approving official reviews in writing; we refine within the revision rounds.'),
  p('Delivery, Inspection & Acceptance', 'We deliver the files or printed items for inspection and acceptance, then submit the documents for payment.'),
];
const GOVERNMENT_TERMS = termsWith({
  payment: {
    body: [
      'Work starts once JoshWorks receives the signed Purchase Order, Job Order, contract or Notice to Proceed.',
      'Payment follows the office’s process: delivery, inspection and acceptance, then payment by check or LDDAP-ADA, ideally within 30 days of acceptance.',
      'Payments are subject to the taxes the office withholds by law; the office issues BIR Form 2307 (and 2306 where it applies) for each payment.',
      'JoshWorks provides the documents the office needs for payment, such as its invoice and its PhilGEPS, DTI, business permit and BIR registration.',
      'The prices in this contract hold until the “Prices valid until” date above, or for the period stated in the office’s request for quotation.',
    ],
  },
  cancellation: {
    body: [
      'If the project is cancelled after work began, the office pays for the work done and accepted up to that point, as its rules allow.',
      'Changes to the scope after the PO or JO are agreed in writing and may change the price and the delivery date.',
    ],
  },
  client: {
    title: 'Office Responsibilities',
    body: [
      'The office provides the approved content, the official logos (including its seal and the Bagong Pilipinas logo where required), and its branding rules at the start.',
      'The office names one contact person and one approving official; all approvals are given in writing.',
      'Timelines begin once the PO or JO and complete materials are received; late approvals or inspections move the delivery date.',
    ],
  },
  ip: {
    body: [
      'Upon acceptance and payment, the office may use, print and reproduce the final designs for its public programs without limit.',
      'Full transfer of copyright and the editable source files are included only when the PO or contract requires them (see Ownership).',
      'JoshWorks may show the work in its portfolio after its public release, unless the office objects in writing.',
    ],
  },
  nda: {
    title: 'Confidentiality',
    body: [
      'JoshWorks keeps unreleased information, data and documents from the office confidential and uses them only for this project.',
      'Under an active NDA, the designer will not display, share, or include the work in any public portfolio or promotional material.',
    ],
  },
  timeline: {
    body: [
      'Delivery dates follow the PO or JO; delays caused by late materials, approvals or inspection are not the designer’s responsibility.',
      'Final delivery is made via email, cloud storage, or delivery of printed items to the office; the office keeps its own copies of all delivered files.',
    ],
  },
});
const GOVERNMENT_AGREEMENT = [
  'The office has read, understood, and agrees to the terms and conditions in this contract.',
  'The office agrees to the selected items, prices and add-ons, as covered by its PO or JO.',
  'The office understands that payment follows delivery, inspection and acceptance, within its processing time.',
  'The office will provide approved content, official logos and written approvals on time.',
  'The office understands the revision limits and the charges for extra revisions.',
  'The office agrees that JoshWorks may show the released work in its portfolio unless it objects in writing.',
  'The office accepts electronic signatures on this agreement.',
];

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
    briefTitle: 'Branding & Social Media Questionnaire',
    brief: SMM_QUESTIONS,
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
    briefTitle: 'Branding & Social Media Questionnaire',
    brief: SMM_QUESTIONS,
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
    briefTitle: 'Merch Questionnaire',
    brief: MERCH_QUESTIONS,
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
    briefTitle: 'Event & Publication Questionnaire',
    brief: EVENT_QUESTIONS,
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
    briefTitle: 'Event & Publication Questionnaire',
    brief: EVENT_QUESTIONS,
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
    briefTitle: 'Election Campaign Questionnaire',
    brief: ELECTION_QUESTIONS,
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
    briefTitle: 'Yearbook Questionnaire',
    brief: YEARBOOK_QUESTIONS,
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
    briefTitle: 'Publication Questionnaire',
    brief: WORKBOOK_QUESTIONS,
    sort: 9,
  },
  {
    ...STD,
    id: 'tpl-motion',
    name: 'Motion Graphics Agreement',
    tagline: MOTION_NOW.tagline,
    subtitle: 'Universal',
    frame: 'general',
    categories: MOTION_NOW.categories,
    audience: 'any',
    covers: MOTION_NOW.covers,
    phases: [
      p('Concept & Script', 'We define the idea, message, and timing of your animation.'),
      p('Storyboard', 'We map the scenes and key frames and send them for your approval before animating.'),
      p('Design & Illustration', 'We build the visual assets and style that the animation will use.'),
      p('Animation & Sound', 'We animate the piece and add sound design and effects.'),
      p('Review & Final Render', 'You review, we refine within your rounds, then export the final formats (MP4, MOV, and more).'),
    ],
    briefTitle: 'Motion Graphics Questionnaire',
    brief: MOTION_QUESTIONS,
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
    briefTitle: 'Website Questionnaire',
    brief: WEB_QUESTIONS,
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
    briefTitle: 'Training Questionnaire',
    brief: TRAINING_QUESTIONS,
    sort: 12,
  },
  // ----- November 2026 -----
  {
    ...STD,
    id: 'tpl-merch-production',
    name: 'Merch Production Agreement',
    tagline: 'Pins, stickers, keychains & merch, designed and made for you',
    subtitle: 'Universal (Business / Student)',
    frame: 'merch',
    categories: ['Merch production', ...ADD],
    audience: 'any',
    covers: 'Production of custom merchandise — button and enamel pins, stickers, acrylic keychains and standees, ID laces, shirts, totes, mugs and more — from an approved proof to finished, counted pieces, with artwork you send or we design.',
    phases: MERCH_MAKE_PHASES,
    phasesNote: 'Design fees for new artwork follow the Merch price list and are listed with the items.',
    briefTitle: 'Merch Order Questionnaire',
    brief: MERCH_MAKE_QUESTIONS,
    sections: MERCH_MAKE_TERMS,
    agreement: MERCH_MAKE_AGREEMENT,
    sort: 13,
  },
  {
    ...STD,
    id: 'tpl-packaging',
    name: 'Packaging & Label Design Agreement',
    tagline: 'Labels, pouches, boxes & hang tags for your products',
    subtitle: 'Business / MSME',
    frame: 'logo',
    categories: ['Packaging & labels', ...ADD],
    audience: 'business',
    covers: 'Label and packaging design for food, beauty and small-business products — from one product label to a full packaging line — print-ready with dielines, and printing on request.',
    phases: PACKAGING_PHASES,
    briefTitle: 'Packaging Questionnaire',
    brief: PACKAGING_QUESTIONS,
    sections: PACKAGING_TERMS,
    agreement: PACKAGING_AGREEMENT,
    sort: 14,
  },
  {
    ...STD,
    id: 'tpl-illustration',
    name: 'Illustration & Mascot Agreement',
    tagline: 'Commissioned illustrations, characters & mascots',
    subtitle: 'Universal',
    frame: 'general',
    categories: ['Illustration & mascots', ...ADD],
    audience: 'any',
    covers: 'Original illustrations, portraits, and character and mascot design for people, brands, organizations and books — with personal and commercial use spelled out.',
    phases: ILLUSTRATION_PHASES,
    briefTitle: 'Illustration Questionnaire',
    brief: ILLUSTRATION_QUESTIONS,
    sections: ILLUSTRATION_TERMS,
    agreement: ILLUSTRATION_AGREEMENT,
    sort: 15,
  },
  {
    ...STD,
    id: 'tpl-retainer',
    name: 'Monthly Design Retainer',
    tagline: 'A set number of designs every month, with priority',
    subtitle: 'Business / Organization',
    frame: 'general',
    categories: ['Design retainer', ...ADD],
    audience: 'any',
    covers: 'Ongoing monthly design support — pubmats, social graphics, flyers, menus and print layouts — up to a set number of requests a month, for clients who need steady design without social media management.',
    phases: RETAINER_PHASES,
    phasesNote: 'The cycle repeats every month of the retainer.',
    briefTitle: 'Retainer Questionnaire',
    brief: RETAINER_QUESTIONS,
    sections: RETAINER_TERMS,
    agreement: RETAINER_AGREEMENT,
    sort: 16,
  },
  {
    ...STD,
    id: 'tpl-celebration',
    name: 'Weddings & Celebrations Agreement',
    tagline: 'Invitations, signage & keepsakes for life’s big days',
    subtitle: 'Personal / Family events',
    frame: 'general',
    categories: ['Weddings & celebrations', ...ADD],
    audience: 'any',
    covers: 'Design and optional printing for weddings, debuts, christenings, birthdays and other celebrations — invitations, monograms, signage, programs, souvenir tags and e-vites.',
    phases: CELEBRATION_PHASES,
    briefTitle: 'Celebration Questionnaire',
    brief: CELEBRATION_QUESTIONS,
    sections: CELEBRATION_TERMS,
    agreement: CELEBRATION_AGREEMENT,
    sort: 17,
  },
  {
    ...STD,
    id: 'tpl-research',
    name: RESEARCH_NOW.name,
    tagline: RESEARCH_NOW.tagline,
    subtitle: 'Student / Academic',
    frame: 'general',
    categories: ['Research & academic visuals', ...ADD],
    audience: 'any',
    covers: RESEARCH_NOW.covers,
    phases: RESEARCH_PHASES,
    briefTitle: RESEARCH_NOW.briefTitle,
    brief: RESEARCH_NOW.brief,
    sections: RESEARCH_TERMS,
    agreement: RESEARCH_AGREEMENT,
    sort: 18,
  },
  {
    ...STD,
    id: 'tpl-company-profile',
    name: 'Company Profile & Pitch Deck Agreement',
    tagline: 'Company profiles, pitch decks & presentation templates',
    subtitle: 'Business / Commercial',
    frame: 'general',
    categories: ['Presentations & company profiles', ...ADD],
    audience: 'business',
    covers: 'Company profiles, pitch and sales decks, capability statements, catalogs and branded presentation templates that present the business clearly to clients, investors and partners.',
    phases: DECK_PHASES,
    briefTitle: 'Profile & Deck Questionnaire',
    brief: DECK_QUESTIONS,
    sections: DECK_TERMS,
    sort: 19,
  },
  {
    ...STD,
    id: 'tpl-government',
    name: 'Government & LGU Projects Agreement',
    tagline: 'IEC materials, maps & event branding for public offices',
    subtitle: 'Government / LGU',
    frame: 'general',
    categories: ['Government & LGU', ...ADD],
    audience: 'business',
    covers: 'Design for LGUs, government offices and public schools — IEC materials, tourism and town maps, event branding, reports, Citizen’s Charters and signage — following the office’s procurement and payment process.',
    phases: GOVERNMENT_PHASES,
    phasesNote: 'No down payment: the office pays after delivery, inspection and acceptance, as its rules require.',
    downPct: 0,
    briefTitle: 'Project Questionnaire',
    brief: GOVERNMENT_QUESTIONS,
    sections: GOVERNMENT_TERMS,
    agreement: GOVERNMENT_AGREEMENT,
    sort: 20,
  },
];

export interface TemplateField {
  key: string;
  label: string;
  kind?: 'date' | 'long' | 'payment';
  hint?: string;
  /** Only for business clients (student orgs don't withhold tax). */
  business?: boolean;
}

/** Contract fields every template fills from the client, the job and the studio, grouped as the editor shows them. */
export const CONTRACT_FIELD_GROUPS: { title: string; fields: TemplateField[] }[] = [
  {
    title: 'Client',
    fields: [
      { key: 'client.name', label: 'Client name / organization' },
      { key: 'client.contact', label: 'Contact person' },
      { key: 'client.email', label: 'Email' },
      { key: 'client.phone', label: 'Phone number' },
      { key: 'client.address', label: 'Address' },
      { key: 'client.web', label: 'Website / social media' },
      { key: 'client.tin', label: 'Client TIN', hint: 'For BIR Form 2307, when they withhold tax.', business: true },
    ],
  },
  {
    title: 'Project & dates',
    fields: [
      { key: 'scope', label: 'This project', kind: 'long', hint: 'One line about this client’s project, e.g. “Logo and brand guide for Kape Ilonggo’s coffee cart.”' },
      { key: 'date', label: 'Date made', kind: 'date' },
      { key: 'validUntil', label: 'Prices valid until', kind: 'date', hint: '14 days after the date made, unless you change it.' },
      { key: 'startDate', label: 'Project start date', kind: 'date' },
      { key: 'endDate', label: 'Expected completion date', kind: 'date', hint: 'Filled from the start date and the package turnaround.' },
    ],
  },
  {
    title: 'Payment & signing',
    fields: [
      { key: 'paymentMethod', label: 'Payment method', kind: 'payment' },
      { key: 'signer', label: 'Name of the person signing (client)' },
      { key: 'designer', label: 'Signing for JoshWorks' },
    ],
  },
  {
    title: 'Communication & delivery',
    fields: [
      { key: 'channel', label: 'Official channel' },
      { key: 'hours', label: 'Reply time & working hours' },
      { key: 'delivery', label: 'How files are delivered' },
    ],
  },
];

export const CLIENT_FIELDS: TemplateField[] = CONTRACT_FIELD_GROUPS.flatMap((g) => g.fields);

/** Days an unsigned contract's prices hold (the payment terms say 14). */
export const PRICES_HOLD_DAYS = 14;

export interface TemplateChange {
  version: number;
  id: string;
  field: 'name' | 'tagline' | 'covers' | 'categories' | 'briefTitle' | 'brief' | 'sections';
  from: unknown;
  to: unknown;
}

/** Template details a catalog version changes. A device takes the new value only where the old one is still in place, so edits stay. */
export const TEMPLATE_CHANGES: TemplateChange[] = [
  { version: 2, id: 'tpl-motion', field: 'tagline', from: MOTION_V1.tagline, to: MOTION_NOW.tagline },
  { version: 2, id: 'tpl-motion', field: 'covers', from: MOTION_V1.covers, to: MOTION_NOW.covers },
  { version: 2, id: 'tpl-motion', field: 'categories', from: MOTION_V1.categories, to: MOTION_NOW.categories },
  // Version 3: the research template takes every academic commission.
  ...(['name', 'tagline', 'covers', 'briefTitle', 'brief'] as const).map((field) => ({ version: 3, id: 'tpl-research', field, from: RESEARCH_V2[field], to: RESEARCH_NOW[field] })),
  { version: 3, id: 'tpl-research', field: 'sections', from: RESEARCH_TERMS_V2, to: RESEARCH_TERMS },
];

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

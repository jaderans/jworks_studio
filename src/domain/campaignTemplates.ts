import { addDays, mondayOf } from '../lib/time';
import { isBreak } from './calendar';
import { isHoliday } from './seasons';
import type { CadenceSettings, CampaignGoal, FunnelStage, Kpi, Persona, ServiceKey } from '../db/types';

/**
 * Ready-made campaigns for each JoshWorks service and for the seasons that
 * bring work in. Each one is a short sequence of posts across two to five weeks,
 * placed on the weekly themes, with an offer, a DM keyword and targets.
 */

export interface TemplatePost {
  /** Week from the start (0 = the first week). */
  week: number;
  /** 1 = Monday … 5 = Friday. */
  dow: number;
  title: string;
  format: string;
  stage: FunnelStage;
  brief: string;
  series?: string;
  /** Posting time, HH:MM (else the platform's default time). */
  time?: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  group: 'Services' | 'Seasons' | 'SMM' | 'For clients';
  service: ServiceKey | '';
  goal: CampaignGoal;
  seasonId?: string;
  description: string;
  offer: string;
  keyMessage: string;
  ctaKeyword: string;
  leadMagnet: string;
  kpis: Kpi[];
  audience: Persona;
  funnelTemplateId: string;
  posts: TemplatePost[];
  /** A fixed rhythm (e.g. every two weeks): a break week moves that post and every later one, so the gaps stay the same. */
  keepRhythm?: boolean;
  /** Suggested first day (YYYY-MM-DD), used while it's still ahead. */
  startOn?: string;
}

const persona = (name: string, who: string, pains: string, wants: string, objections: string, whereTheyAre: string, triggers: string): Persona => ({ name, who, pains, wants, objections, whereTheyAre, triggers });

const SMALL_BIZ = persona(
  'Iloilo small-business owner',
  'Runs a café, shop or service in Iloilo; 25–45; does their own posting',
  'Looks homemade next to competitors; no time; unsure what to post',
  'A brand people remember and trust; more messages and orders',
  '“Designers are expensive”, “I can do it in Canva”, “Will it actually bring sales?”',
  'Facebook groups, Instagram, TikTok, local business pages',
  'Opening a branch, new menu, rebrand, peak seasons, payday',
);

const ORG_OFFICER = persona(
  'Student org or class officer',
  'College or senior-high officer ordering shirts, lanyards or logos for the group',
  'Tight deadlines, many opinions, small budget, fear of a bad print',
  'A design everyone likes, delivered on time, at a group price',
  '“Can you do it by next week?”, “Is there a student rate?”',
  'Facebook, Messenger group chats, TikTok',
  'Intrams, foundation days, graduation, org week, new school year',
);

const DESIGN_LEARNERS = persona(
  'Filipino design students and young creatives',
  'Senior-high and college students and new designers, 16–28, learning Illustrator, Canva or CapCut; many are org officers too',
  'Tutorials are long and slow; their text and logos don’t look pro yet; they only know the CapCut or Canva way',
  'Quick tricks they can copy tonight, a stronger portfolio, pubmats their org will love',
  '“I only have Canva”, “Illustrator is too hard”, “AI can do this now”',
  'TikTok, Reels, YouTube Shorts, Facebook design groups',
  'Org events and school projects, trends on their For You page, new Illustrator features',
);

/** Multi-line post briefs: one point per line. */
const lines = (...l: string[]) => l.join('\n');

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'rebrand',
    name: 'Brand check month',
    group: 'Services',
    service: 'branding',
    goal: 'leads',
    description: 'Educate on what a brand is, show proof, then open a few free brand-check slots.',
    offer: 'Free 10-minute brand check (3 slots this month)',
    keyMessage: 'A logo is not a brand; we build systems people remember.',
    ctaKeyword: 'REBRAND',
    leadMagnet: 'Brand health checklist (PDF)',
    kpis: [{ metric: 'reach', target: 15000 }, { metric: 'saves', target: 120 }, { metric: 'leads', target: 10 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 1, title: '5 Signs Your Brand Needs a Rebrand', format: 'Carousel', stage: 'awareness', brief: 'Checklist format. Last slide: “Spotted 2 or more? DM REBRAND for a free brand check.”' },
      { week: 0, dow: 2, title: 'Before & After: a client rebrand', format: 'Carousel', stage: 'decision', brief: 'Old vs new, what changed and why. Ask the client’s permission.' },
      { week: 0, dow: 4, title: 'Building a brand system, not just a logo', format: 'Carousel', stage: 'interest', brief: 'Logo suite, colours, type, usage. Designer spotlight.' },
      { week: 0, dow: 5, title: 'Client Love: what changed after the rebrand', format: 'Single image', stage: 'decision', brief: 'Testimonial quote card plus one result.' },
      { week: 1, dow: 1, title: 'Logo vs Brand vs Branding', format: 'Carousel', stage: 'awareness', brief: 'Logo = your face, brand = your reputation, branding = how you show up.' },
      { week: 1, dow: 2, title: 'Free brand check: 3 slots this month', format: 'Single image', stage: 'action', brief: 'One offer, one keyword: DM REBRAND.' },
      { week: 1, dow: 5, title: 'Last call: brand check slots', format: 'Story', stage: 'action', brief: 'Countdown sticker; reshare the offer post.' },
    ],
  },
  {
    id: 'merch-drop',
    name: 'Concept Drop: vote, then pre-order',
    group: 'Services',
    service: 'merch',
    goal: 'sales',
    description: 'Show an original shirt concept, let followers vote, sell a limited pre-order run.',
    offer: 'Limited run, pre-order only, early-bird price for 48 hours',
    keyMessage: 'Designed in Iloilo, printed only if you want it.',
    ctaKeyword: 'MERCH',
    leadMagnet: '',
    kpis: [{ metric: 'shares', target: 100 }, { metric: 'comments', target: 80 }, { metric: 'sales', target: 30 }],
    audience: ORG_OFFICER,
    funnelTemplateId: 'merch-drop',
    posts: [
      { week: 0, dow: 2, title: 'CONCEPT DROP: would you wear this?', format: 'Carousel', stage: 'awareness', brief: 'Moodboard → sketch → mockup. Ask people to vote in the comments.', series: 'Concept Drop' },
      { week: 0, dow: 5, title: 'BTS: from sketch to mockup', format: 'Reel', stage: 'interest', brief: 'Timelapse; show faces and hands.' },
      { week: 1, dow: 1, title: 'How to design a shirt people actually wear', format: 'Carousel', stage: 'awareness', brief: 'Placement, print size, colours, fabric.' },
      { week: 1, dow: 2, title: 'It’s happening: limited run + sizes', format: 'Carousel', stage: 'decision', brief: 'Size chart, price, early-bird window.' },
      { week: 1, dow: 4, title: 'Designer spotlight: designing merch', format: 'Reel', stage: 'interest', brief: 'The designer explains one decision.' },
      { week: 2, dow: 2, title: 'Pre-orders open: DM MERCH', format: 'Single image', stage: 'action', brief: 'Deadline and payment options.' },
      { week: 2, dow: 5, title: 'Last 48 hours to pre-order', format: 'Story', stage: 'action', brief: 'Countdown sticker.' },
      { week: 4, dow: 5, title: 'Spotted: you wearing the drop', format: 'Carousel', stage: 'loyalty', brief: 'Repost buyers (with permission); tease the next drop.' },
    ],
  },
  {
    id: 'sticker-pack',
    name: 'Sticker pack launch',
    group: 'Services',
    service: 'stickers',
    goal: 'sales',
    description: 'Tease, reveal and sell a sticker pack online and at the next booth.',
    offer: 'Bundle deal (e.g. 4 for ₱75) online and at the booth',
    keyMessage: 'Stickers drawn in-house, cut to last.',
    ctaKeyword: 'STICKERS',
    leadMagnet: '',
    kpis: [{ metric: 'views', target: 20000 }, { metric: 'sales', target: 50 }],
    audience: persona('Sticker collector', 'Students and young professionals, 16–28, who decorate laptops, tumblers and planners', 'Generic designs, stickers that fade or peel', 'Cute, local, durable stickers', '“Is it waterproof?”, “Shipping fee?”', 'TikTok, Instagram, Facebook groups', 'Payday, new semester, gift giving, events'),
    funnelTemplateId: 'event-booth',
    posts: [
      { week: 0, dow: 5, title: 'Sneak peek: new sticker pack', format: 'Reel', stage: 'awareness', brief: 'Peel-and-stick ASMR; no prices yet.' },
      { week: 1, dow: 1, title: 'Vinyl vs paper vs holo: which sticker to order?', format: 'Carousel', stage: 'awareness', brief: 'Durability, finish, best use, price range.' },
      { week: 1, dow: 2, title: 'The full pack + bundle deal', format: 'Carousel', stage: 'decision', brief: 'Every design, the bundle price, where to buy.' },
      { week: 1, dow: 4, title: 'From doodle to die-cut', format: 'Reel', stage: 'interest', brief: 'Illustrator process video.' },
      { week: 2, dow: 2, title: 'Order now or find us at the booth', format: 'Single image', stage: 'action', brief: 'DM keyword + event booth number.' },
      { week: 3, dow: 5, title: 'Sticker spotted: your setups', format: 'Carousel', stage: 'loyalty', brief: 'Customer photos (with permission).' },
    ],
  },
  {
    id: 'packaging',
    name: 'Packaging glow-up',
    group: 'Services',
    service: 'packaging',
    goal: 'leads',
    description: 'Show what better packaging does for small food and product brands.',
    offer: 'Packaging slots this month; a free label review for the first 5 who message',
    keyMessage: 'Your packaging is your silent salesperson.',
    ctaKeyword: 'PACK',
    leadMagnet: 'Label checklist',
    kpis: [{ metric: 'saves', target: 100 }, { metric: 'leads', target: 8 }],
    audience: persona('Food or product maker', 'Pasalubong, bakery, coffee or skincare seller in Western Visayas', 'Plain labels; looks unprofessional on shelves and online', 'Packaging that sells in stores and on Facebook', '“Printing is expensive”, “I only need a sticker label”', 'Facebook, Instagram, local trade fairs', 'Trade fairs, new product, getting into stores'),
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 2, title: 'WHAT IF: we redesigned a local pasalubong pack', format: 'Carousel', stage: 'awareness', brief: 'Unofficial concept; add the disclaimer. Explain each decision.', series: 'WHAT IF' },
      { week: 0, dow: 4, title: 'Packaging that sells: 5 rules', format: 'Carousel', stage: 'interest', brief: 'Shelf impact, hierarchy, honest photos, colour, information.' },
      { week: 1, dow: 1, title: 'What your product label needs', format: 'Carousel', stage: 'awareness', brief: 'Product name, net content, ingredients, best-before, maker’s name and address. Remind them to check FDA rules for their product.' },
      { week: 1, dow: 2, title: 'Before & after: client packaging', format: 'Carousel', stage: 'decision', brief: 'Show the shelf or flat lay.' },
      { week: 2, dow: 2, title: 'Packaging slots open: DM PACK', format: 'Single image', stage: 'action', brief: 'Free label review for the first 5.' },
    ],
  },
  {
    id: 'mascot',
    name: 'WHAT IF mascot series',
    group: 'Services',
    service: 'illustration',
    goal: 'awareness',
    description: 'Shareable mascot concepts for things people already love, then open commissions.',
    offer: 'Mascot commission slots',
    keyMessage: 'Characters make brands lovable.',
    ctaKeyword: 'MASCOT',
    leadMagnet: '',
    kpis: [{ metric: 'shares', target: 150 }, { metric: 'follows', target: 100 }, { metric: 'leads', target: 5 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 1, title: 'Mascots vs logos: when does a brand need a character?', format: 'Carousel', stage: 'awareness', brief: 'When a mascot adds value; famous examples; pitfalls.' },
      { week: 0, dow: 2, title: 'WHAT IF: a local favourite had a mascot', format: 'Carousel', stage: 'awareness', brief: 'Unofficial concept with disclaimer; shape-language notes.', series: 'WHAT IF' },
      { week: 1, dow: 4, title: 'Shape language and expressions', format: 'Reel', stage: 'interest', brief: 'Illustrator spotlight.' },
      { week: 1, dow: 5, title: 'Vote: whose mascot should we design next?', format: 'Story', stage: 'interest', brief: 'Poll sticker; repost results.' },
      { week: 2, dow: 2, title: 'Commission slots: DM MASCOT', format: 'Single image', stage: 'action', brief: 'Turnaround, expressions, price range.' },
    ],
  },
  {
    id: 'motion',
    name: 'Bring your logo to life',
    group: 'Services',
    service: 'motion',
    goal: 'leads',
    description: 'Show what motion adds and sell logo animations as an easy upgrade.',
    offer: 'Logo animation for your reels and intros',
    keyMessage: 'Motion stops the scroll.',
    ctaKeyword: 'MOTION',
    leadMagnet: '',
    kpis: [{ metric: 'views', target: 25000 }, { metric: 'leads', target: 6 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 1, title: 'Static vs animated: why motion stops the scroll', format: 'Reel', stage: 'awareness', brief: 'Side by side; same design.' },
      { week: 0, dow: 4, title: 'Easing and timing: what makes motion feel good', format: 'Reel', stage: 'interest', brief: 'Robotic vs eased motion.' },
      { week: 1, dow: 2, title: 'Logo reveal for a client', format: 'Reel', stage: 'decision', brief: 'Keyframes to final.' },
      { week: 1, dow: 5, title: 'Add motion to your logo: DM MOTION', format: 'Single image', stage: 'action', brief: 'Price range and turnaround.' },
    ],
  },
  {
    id: 'video-series',
    name: 'Illustrator in seconds: 2 videos every 2 weeks',
    group: 'Services',
    service: 'illustration',
    goal: 'awareness',
    description:
      'Ten short design videos in five drops, Monday and Thursday at 7:00 PM, then two weeks before the next drop. Planned from the week of Nov 16, 2026: break weeks pause the series without breaking the rhythm, holidays move a video to the nearest free day, and each drop fits its season (Christmas, new year, Dinagyang). Each video opens on the finished result and ends on a loop or a question.',
    offer: 'Free logo fix: send your logo, we may fix it on video',
    keyMessage: 'Real design, made by a person, fast enough to watch twice.',
    ctaKeyword: 'FIX',
    leadMagnet: '',
    kpis: [
      { metric: 'views', target: 60000 },
      { metric: 'saves', target: 400 },
      { metric: 'shares', target: 250 },
      { metric: 'follows', target: 200 },
      { metric: 'leads', target: 5 },
    ],
    audience: DESIGN_LEARNERS,
    funnelTemplateId: 'studio-leads',
    keepRhythm: true,
    startOn: '2026-11-16',
    posts: [
      {
        week: 0,
        dow: 1,
        time: '19:00',
        title: 'Vector fisheye text in 10 seconds',
        format: 'Reel',
        stage: 'awareness',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): open on the finished bulging word, then cut to a blank artboard. On screen: “That fisheye text everyone makes in CapCut? Here it is as a real vector.”',
          'ALT HOOKS to test: “Stop making fisheye text in CapCut.” · “This takes 10 seconds in Illustrator.”',
          'BEATS: 2–6s type the word in a heavy font · 6–14s Effect > Warp > Fish Eye, drag Bend · 14–20s Object > Expand Appearance, outline, add a colour · 20–25s drop it on a poster.',
          'END: the last frame matches the first, so it loops.',
          'CAPTION: Fisheye text in Illustrator, fully vector, no CapCut needed. Save this for your next pubmat. #illustratortutorial #graphicdesign #typography #fisheyetext #JoshWorks',
          'SAY AND SHOW the keywords “Illustrator”, “fisheye text”, “vector” (TikTok search reads speech and on-screen text).',
          'TIMING: opens the series; a quick, satisfying tutorial people save.',
          'WHY: fisheye text is a trend people already search for; the vector version stands out from the CapCut ones.',
        ),
      },
      {
        week: 0,
        dow: 4,
        time: '19:00',
        title: 'Sketch to vector: trust the process',
        format: 'Reel',
        stage: 'awareness',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): a messy paper sketch, slow push-in. On screen: “trust the process.”',
          'ALT HOOKS to test: “From a 2-minute sketch to a client logo.” · “Wait for the drop.”',
          'BEATS: 0–8s slow push-in on the sketch (builds anticipation) · on the beat drop: hard cut to the finished vector logo (Image Trace, then cleaned with the Pen tool) · 10–15s quick cuts of the logo on a shirt, a sign and a phone.',
          'END: loop back to the sketch.',
          'SOUND: use a reveal sound that is trending that week (on a business account, only sounds marked “Approved for Business Use” in TikTok’s Creative Center).',
          'CAPTION: The sketch always looks like this first. Logo design, start to finish. #logodesign #processvideo #graphicdesigner #iloilo #JoshWorks',
          'TIMING: the second video of the first drop shows the real work behind a logo, while the first video is still being shown to new people.',
          'WHY: the before-and-after reveal is watched to the end and rewatched; it also shows clients the real work behind a logo.',
        ),
      },
      {
        week: 2,
        dow: 1,
        time: '19:00',
        title: 'One drawing, every angle (Turntable)',
        format: 'Reel',
        stage: 'awareness',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): the mascot spinning 360°. On screen: “I drew this character once. Illustrator drew the other angles.”',
          'ALT HOOKS to test: “Draw it once, get every angle.” · “The Illustrator feature nobody is using yet.”',
          'BEATS: 2–8s the flat mascot (give it a Santa hat for December) · 8–15s run Turntable, scrub the full rotation · 15–20s export the GIF and drop it into a chat.',
          'END: the spin loops.',
          'NOTE: Turntable uses generative credits; say so in the caption so nobody is surprised.',
          'CAPTION: One drawing, every angle, with Illustrator’s Turntable (uses generative credits). Mascots for your brand’s holiday posts: DM MASCOT. #illustrator #characterdesign #mascot #adobeillustrator #JoshWorks',
          'TIMING: early December, when businesses plan holiday merch and greetings: a mascot sells.',
          'WHY: a new feature few have covered yet, with a looping ending that gets rewatched.',
        ),
      },
      {
        week: 2,
        dow: 4,
        time: '19:00',
        title: 'Your logo, animated for Christmas (Illustrator to After Effects)',
        format: 'Reel',
        stage: 'decision',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): the finished logo animation playing, with a light snowfall. On screen: “This logo animation took 15 minutes, not 15 hours.”',
          'ALT HOOKS to test: “Your logo, but alive.” · “Static logo vs animated logo.”',
          'BEATS: build the logo in Illustrator · import into After Effects · three clean moves (scale in, mask reveal, settle with easing) · payoff: a notification-style pop-in, “Merry Christmas from …” or “Payment received”.',
          'END: the animation loops.',
          'CAPTION: Logo animation from Illustrator to After Effects. Want an animated Christmas greeting with your logo? DM MOTION. #logoanimation #aftereffects #motiondesign #illustrator #JoshWorks',
          'TIMING: two weeks before Christmas, when businesses still have time to order animated greetings.',
          'WHY: clean, minimal motion and app-style notifications are leading motion trends; it sells the animation service in its busiest month.',
        ),
      },
      {
        week: 4,
        dow: 1,
        time: '19:00',
        title: 'Puffy Christmas sticker text with Inflate',
        format: 'Reel',
        stage: 'awareness',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): squish the finished puffy “PASKO” with the cursor on screen. On screen: “Make your text look squishy.”',
          'ALT HOOKS to test: “3D bubble text without Blender.” · “Your text, but make it a Christmas sticker.”',
          'BEATS: 2–8s bold rounded type · 8–18s Effect > 3D and Materials > Inflate, soft plastic material · 18–26s Appearance panel: a thick white stroke behind it for the sticker outline · 26–30s on a sticker sheet or gift tag mockup.',
          'END: cut back to the squish so it loops.',
          'CAPTION: Puffy 3D sticker text in Illustrator. Which word should I make next? #illustrator #3Dtext #stickerdesign #pasko #JoshWorks',
          'TIMING: Christmas week, when people are making greetings and gift tags; light and fun.',
          'WHY: puffy, bubbly lettering is on every 2026 trend list; asking “which word next” brings comments, which become the next videos.',
        ),
      },
      {
        week: 4,
        dow: 4,
        time: '19:00',
        title: 'Designing like it’s 2016 vs 2026',
        format: 'Reel',
        stage: 'interest',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): both posters side by side. On screen: “Same poster: 2016 style vs 2026 style.”',
          'ALT HOOKS to test: “2026 is the new 2016.” · “Which year are you designing in?”',
          'BEATS: 2016 version: long shadows, flat icons, Instagram gradient · 2026 version: tactile textures, oversized type, bold maximalist colour · flip between them on the beat.',
          'END: “Which one would you post? 2016 or 2026?”',
          'CAPTION: Design eras, 2016 vs 2026. Be honest: which one is your style? #graphicdesign #designtrends #2016 #posterdesign #JoshWorks',
          'TIMING: the week before New Year, when everyone looks back at the year; if Thursday is Christmas Eve, the app moves it to Wednesday.',
          'WHY: rides the “2026 is the new 2016” nostalgia trend; easy to follow and easy to argue about in the comments.',
        ),
      },
      {
        week: 6,
        dow: 1,
        time: '19:00',
        title: 'New year, new logo: fixing your logo (episode 1)',
        format: 'Reel',
        stage: 'decision',
        series: 'Fix your logo',
        brief: lines(
          'HOOK (0–2s): the old logo and the redesign side by side, then the old one alone. On screen: “You sent me your logo. Here’s what I’d fix.”',
          'ALT HOOKS to test: “3 things wrong with this logo.” · “New year, new logo. Let’s fix yours.”',
          'BEATS: three quick notes with arrows (spacing, line weight, colour) · rebuild it sped up · reveal on a sign or a cup.',
          'END: “Want yours fixed next? Comment FIX or DM FIX.”',
          'CAPTION: Logo fixes, episode 1. New year, new brand: send yours, comment or DM FIX. #logoredesign #logodesign #smallbusiness #branding #JoshWorks',
          'ASK the owner’s permission first, and tag them if they’re happy to be featured.',
          'TIMING: the first working week of January, when owners plan a fresh start.',
          'WHY: logo-fix series have a strong record on TikTok; every episode brings new submissions (leads) and a reason to follow.',
        ),
      },
      {
        week: 6,
        dow: 4,
        time: '19:00',
        title: 'Me vs Illustrator’s AI',
        format: 'Reel',
        stage: 'interest',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): split screen of both finished icons. On screen: “Same icon. One made by AI, one made by me. Which one’s better?”',
          'ALT HOOKS to test: “I raced Illustrator’s AI.” · “Can you tell which one a human made?”',
          'BEATS: left: Text to Vector Graphic with the prompt on screen · right: built by hand with Shape Builder, sped up · 30–40s zoom into the details (clean curves vs extra anchor points).',
          'END: “Comment LEFT or RIGHT.” Reveal which is which in a reply video to the top comment.',
          'CAPTION: AI or human? Vote in the comments. #designer #illustrator #aiart #graphicdesign #JoshWorks',
          'TIMING: new-year talk is full of “AI will replace designers”; this answers it with work, not words.',
          'WHY: a fair, friendly debate drives comments and shares, and it shows why hand-made design is worth paying for (the contract’s “original human work” promise).',
        ),
      },
      {
        week: 8,
        dow: 1,
        time: '19:00',
        title: 'Jeepney sign lettering for Dinagyang',
        format: 'Reel',
        stage: 'awareness',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): the finished chrome jeepney lettering reading “DINAGYANG”, with a quick shine sweep. On screen: “How to get that jeepney sign lettering, fully vector.”',
          'ALT HOOKS to test: “Pinoy designers, this one’s for you.” · “The most Filipino text effect.”',
          'BEATS: 2–10s one line of text in a bold script · 10–35s Appearance panel: stack 3–4 strokes (thick dark, colour, thin white), add a drop shadow and a chrome gradient fill · 35–45s on a jeepney side panel mockup.',
          'END: the shine sweep loops.',
          'CAPTION: Jeepney sign lettering in Illustrator, just in time for Dinagyang. Proudly from Iloilo. Saan mo ito gagamitin? #pinoydesigner #dinagyang #jeepney #illustratortutorial #JoshWorks',
          'TIMING: the week before Dinagyang (Jan 24): Iloilo is proud and sharing local content.',
          'WHY: local, cultural design is a 2026 trend and few creators can make this; Filipino viewers share it with friends.',
        ),
      },
      {
        week: 8,
        dow: 4,
        time: '19:00',
        title: 'Tier list: every Illustrator tool',
        format: 'Reel',
        stage: 'loyalty',
        series: 'Illustrator in seconds',
        brief: lines(
          'HOOK (0–2s): the finished tier list with one surprising tool in S tier. On screen: “Ranking every Illustrator tool, from useless to can’t live without.”',
          'ALT HOOKS to test: “Hot take: this tool is overrated.” · “Rank these with me.”',
          'BEATS: about 3 seconds per tool into S, A, B and “never touched” · save the most controversial pick for the end.',
          'END: “Which tool did I get wrong?” Pin the best reply and answer it with a video.',
          'CAPTION: My Illustrator tool tier list. Fight me in the comments. Every trick from this series is on our page. #illustrator #tierlist #graphicdesigner #designtips #JoshWorks',
          'TIMING: closes the series and sends viewers back to the other nine videos.',
          'WHY: rankings are among the most-commented formats.',
        ),
      },
    ],
  },
  {
    id: 'website',
    name: 'Website that converts',
    group: 'Services',
    service: 'web',
    goal: 'leads',
    description: 'Teach what makes a page convert and offer a quick website check.',
    offer: 'Free 5-minute website check',
    keyMessage: 'A website should bring messages, not just look nice.',
    ctaKeyword: 'SITE',
    leadMagnet: 'Landing page checklist',
    kpis: [{ metric: 'saves', target: 80 }, { metric: 'leads', target: 6 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 1, title: 'Landing pages that convert: the 6 sections', format: 'Carousel', stage: 'awareness', brief: 'Hero, proof, offer, how it works, FAQ, CTA.' },
      { week: 0, dow: 4, title: 'Designing for thumbs: mobile first', format: 'Carousel', stage: 'interest', brief: 'Tap targets, readable type, fast pages.' },
      { week: 1, dow: 2, title: 'Website redesign: before & after', format: 'Carousel', stage: 'decision', brief: 'What changed and why.' },
      { week: 1, dow: 5, title: 'Free 5-minute website check: DM SITE', format: 'Single image', stage: 'action', brief: 'Limited to 5 a week.' },
    ],
  },
  {
    id: 'smm-launch',
    name: 'Launch: JoshWorks now manages social media',
    group: 'SMM',
    service: 'smm',
    goal: 'leads',
    description: 'Announce the SMM service and fill the first founding-client slots.',
    offer: 'Founding clients: 10% off the first 3 months (3 slots)',
    keyMessage: 'Your page, designed and run by a design studio.',
    ctaKeyword: 'SOCIAL',
    leadMagnet: 'Free page review',
    kpis: [{ metric: 'reach', target: 15000 }, { metric: 'leads', target: 10 }, { metric: 'sales', target: 3 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'local-business',
    posts: [
      { week: 0, dow: 2, title: 'We now manage social media for local brands', format: 'Carousel', stage: 'awareness', brief: 'What’s included, who it’s for, the three packages.' },
      { week: 0, dow: 4, title: 'What a month of SMM with us looks like', format: 'Carousel', stage: 'interest', brief: 'Discovery call → strategy → content → approval → posting → report.' },
      { week: 0, dow: 5, title: 'Founding clients: 3 slots at 10% off', format: 'Single image', stage: 'action', brief: 'In exchange for a testimonial and a case study.' },
      { week: 1, dow: 1, title: 'Why posting every day isn’t the answer', format: 'Carousel', stage: 'awareness', brief: 'Consistency, quality and the right content per funnel stage.' },
      { week: 1, dow: 2, title: 'Case study: how we run our own page', format: 'Carousel', stage: 'decision', brief: 'Our planner, themes and best results (saves and shares).' },
      { week: 1, dow: 5, title: 'Last founding slots: DM SOCIAL', format: 'Story', stage: 'action', brief: 'Countdown sticker; link to the packages post.' },
    ],
  },
  {
    id: 'paskua',
    name: 'Paskua holiday merch and giveaways',
    group: 'Seasons',
    service: 'merch',
    goal: 'sales',
    seasonId: 'christmas',
    description: 'Holiday merch and corporate giveaways; post early so orders can be made in time.',
    offer: 'Holiday merch and corporate giveaway packages (order by early December)',
    keyMessage: 'Gifts people actually keep, designed in Iloilo.',
    ctaKeyword: 'GIFTS',
    leadMagnet: 'Free Christmas social media templates',
    kpis: [{ metric: 'leads', target: 12 }, { metric: 'sales', target: 5 }],
    audience: persona('Office or org buying gifts', 'HR, admin or org officers buying giveaways for 20–200 people', 'Last-minute orders, boring generic gifts', 'Branded gifts that feel personal, on time and on budget', '“Minimum order?”, “Can it arrive before the party?”', 'Facebook, Messenger, LinkedIn', 'Christmas parties, year-end events, client gifts'),
    funnelTemplateId: 'merch-drop',
    posts: [
      { week: 0, dow: 2, title: 'CONCEPT DROP: Paskua sa Iloilo holiday tee', format: 'Carousel', stage: 'awareness', brief: 'Christmas concept; CTA for company and org orders.', series: 'Concept Drop' },
      { week: 0, dow: 5, title: 'Freebie Friday: Christmas social media templates', format: 'Single image', stage: 'interest', brief: 'Editable templates; grows saves and follows.' },
      { week: 1, dow: 1, title: 'Corporate giveaways people keep: 6 ideas', format: 'Carousel', stage: 'awareness', brief: 'Tees, tumblers, sticker sets, planners, tote bags, illustrated cards.' },
      { week: 1, dow: 2, title: 'Order deadline for holiday merch', format: 'Single image', stage: 'action', brief: 'State the last order date clearly.' },
      { week: 1, dow: 4, title: 'Animated greetings for your brand', format: 'Reel', stage: 'interest', brief: 'Static card → animated version; upsell motion.' },
      { week: 2, dow: 5, title: 'Client love: holiday orders delivered', format: 'Carousel', stage: 'loyalty', brief: 'Photos of delivered orders (with permission).' },
    ],
  },
  {
    id: 'dinagyang',
    name: 'Dinagyang pride drop',
    group: 'Seasons',
    service: 'illustration',
    goal: 'awareness',
    seasonId: 'dinagyang',
    description: 'Festival concepts and merch in the weeks before Dinagyang (4th Sunday of January).',
    offer: 'Festival sticker pack and tee, pre-order',
    keyMessage: 'Proud of Iloilo, made in Iloilo.',
    ctaKeyword: 'DINAGYANG',
    leadMagnet: '',
    kpis: [{ metric: 'shares', target: 200 }, { metric: 'sales', target: 40 }],
    audience: persona('Proud Ilonggo', 'Locals and balikbayans celebrating the festival', 'Generic festival merch', 'Something original and shareable', '“Will it arrive before the festival?”', 'Facebook, TikTok', 'Festival week, homecoming'),
    funnelTemplateId: 'merch-drop',
    posts: [
      { week: 0, dow: 2, title: 'WHAT IF: Dinagyang had an official mascot', format: 'Carousel', stage: 'awareness', brief: 'Unofficial fan concept (say so); shape-language explanation; respect the culture it comes from.', series: 'WHAT IF' },
      { week: 0, dow: 5, title: 'Festival sticker pack: sneak peek', format: 'Reel', stage: 'interest', brief: 'Peel-and-stick reel.' },
      { week: 1, dow: 2, title: 'Dinagyang tee + stickers: pre-order', format: 'Carousel', stage: 'action', brief: 'Deadline before the festival.' },
      { week: 1, dow: 4, title: 'Designing festival art with respect', format: 'Carousel', stage: 'interest', brief: 'How we research references and avoid stereotypes.' },
    ],
  },
  {
    id: 'graduation',
    name: 'Batch shirts and grad merch',
    group: 'Seasons',
    service: 'merch',
    goal: 'leads',
    seasonId: 'graduation',
    description: 'Reach class officers before they order batch shirts.',
    offer: 'Batch shirt design + group pricing',
    keyMessage: 'A batch shirt the whole class wants to wear again.',
    ctaKeyword: 'BATCH',
    leadMagnet: '',
    kpis: [{ metric: 'leads', target: 10 }, { metric: 'sales', target: 4 }],
    audience: ORG_OFFICER,
    funnelTemplateId: 'merch-drop',
    posts: [
      { week: 0, dow: 1, title: 'How to pick a batch shirt design everyone likes', format: 'Carousel', stage: 'awareness', brief: 'Poll the class, limit colours, think about print cost.' },
      { week: 0, dow: 2, title: 'Batch shirt concepts', format: 'Carousel', stage: 'decision', brief: 'Three concepts with mockups.' },
      { week: 1, dow: 2, title: 'Class officers: DM BATCH for a quote', format: 'Single image', stage: 'action', brief: 'Turnaround time and group pricing.' },
    ],
  },
  {
    id: 'intrams',
    name: 'Intramurals team shirts',
    group: 'Seasons',
    service: 'merch',
    goal: 'leads',
    seasonId: 'intrams',
    description: 'Team shirts and sports-fest identities for schools and orgs.',
    offer: 'Team shirt design + group pricing',
    keyMessage: 'Win the parade before the games start.',
    ctaKeyword: 'TEAM',
    leadMagnet: '',
    kpis: [{ metric: 'leads', target: 10 }, { metric: 'sales', target: 4 }],
    audience: ORG_OFFICER,
    funnelTemplateId: 'merch-drop',
    posts: [
      { week: 0, dow: 2, title: 'CONCEPT DROP: intrams team shirt', format: 'Carousel', stage: 'awareness', brief: 'Original concept; CTA for org and team quotes.', series: 'Concept Drop' },
      { week: 0, dow: 4, title: 'Designing team shirts that read from the bleachers', format: 'Carousel', stage: 'interest', brief: 'Big shapes, bold numbers, two colours.' },
      { week: 1, dow: 2, title: 'Org and team quotes: DM TEAM', format: 'Single image', stage: 'action', brief: 'Deadlines and minimums.' },
    ],
  },
  {
    id: 'year-end',
    name: 'Year-end recap and next year’s slots',
    group: 'Seasons',
    service: 'branding',
    goal: 'leads',
    seasonId: 'yearend',
    description: 'Celebrate the year, thank clients, and book January rebrands.',
    offer: 'Booking next year’s brand projects',
    keyMessage: 'New year, stronger brand.',
    ctaKeyword: 'NEWYEAR',
    leadMagnet: '',
    kpis: [{ metric: 'reach', target: 20000 }, { metric: 'leads', target: 8 }],
    audience: SMALL_BIZ,
    funnelTemplateId: 'studio-leads',
    posts: [
      { week: 0, dow: 5, title: 'JoshWorks year in review', format: 'Reel', stage: 'awareness', brief: 'Montage of the year’s projects; thank clients.' },
      { week: 1, dow: 1, title: 'Rebrand before the new year: signs it’s time', format: 'Carousel', stage: 'awareness', brief: 'Checklist; soft CTA.' },
      { week: 1, dow: 2, title: 'Booking next year’s brand projects', format: 'Single image', stage: 'action', brief: 'Limited January slots.' },
    ],
  },
  {
    id: 'client-launch',
    name: 'Client: product or menu launch',
    group: 'For clients',
    service: 'smm',
    goal: 'launch',
    description: 'Tease, reveal and sell a client’s new product, menu or branch.',
    offer: 'Launch-week promo',
    keyMessage: 'Something new is coming.',
    ctaKeyword: 'ORDER',
    leadMagnet: '',
    kpis: [{ metric: 'reach', target: 20000 }, { metric: 'leads', target: 50 }],
    audience: persona('The client’s customers', 'Locals within 5–10 km', 'Same old options', 'Something new worth trying', '“Is it worth the price?”', 'Facebook, TikTok, Instagram', 'Payday, weekends'),
    funnelTemplateId: 'local-business',
    posts: [
      { week: 0, dow: 2, title: 'Teaser: something new is coming', format: 'Reel', stage: 'awareness', brief: 'Close-ups, no reveal.' },
      { week: 0, dow: 5, title: 'Behind the scenes: making it', format: 'Reel', stage: 'interest', brief: 'The owner or staff on camera.' },
      { week: 1, dow: 1, title: 'Reveal: meet the new product', format: 'Carousel', stage: 'decision', brief: 'Price, where to get it, launch promo.' },
      { week: 1, dow: 4, title: 'Launch promo: comment ORDER', format: 'Single image', stage: 'action', brief: 'Deadline; Messenger keyword.' },
      { week: 2, dow: 2, title: 'First reviews are in', format: 'Carousel', stage: 'loyalty', brief: 'Customer quotes and photos (with permission).' },
    ],
  },
  {
    id: 'client-payday',
    name: 'Client: payday promo',
    group: 'For clients',
    service: 'smm',
    goal: 'sales',
    description: 'A short promo around the 15th or 30th, when people have money to spend.',
    offer: 'Payday bundle or discount',
    keyMessage: 'Treat yourself this payday.',
    ctaKeyword: 'PAYDAY',
    leadMagnet: '',
    kpis: [{ metric: 'leads', target: 30 }],
    audience: persona('Payday shopper', 'Employees and students with allowance', 'Tight budget mid-month', 'A treat that feels worth it', '“Is the promo real?”', 'Facebook, TikTok', 'The 15th and 30th'),
    funnelTemplateId: 'local-business',
    posts: [
      { week: 0, dow: 4, title: 'Payday is coming: sneak peek of the bundle', format: 'Story', stage: 'interest', brief: 'Post the evening before payday.' },
      { week: 0, dow: 5, title: 'Payday bundle: comment PAYDAY', format: 'Single image', stage: 'action', brief: 'Clear price and end time.' },
    ],
  },
];

export interface PlannedPost {
  date: string;
  /** HH:MM, or '' for the platform's default time. */
  time: string;
  title: string;
  format: string;
  stage: FunnelStage;
  brief: string;
  series: string;
}

/**
 * Dates for a template's posts from a start day. A post that lands in a break
 * week moves to the week after; one that lands on a public holiday moves to the
 * nearest free weekday that week (when the calendar skips holidays).
 */
export function planTemplatePosts(t: CampaignTemplate, start: string, cadence: CadenceSettings): PlannedPost[] {
  const monday = mondayOf(start);
  const out: PlannedPost[] = [];
  // With keepRhythm, every week a post had to move also moves the posts after it.
  let shift = 0;
  const ordered = t.keepRhythm ? [...t.posts].sort((a, b) => a.week - b.week || a.dow - b.dow) : t.posts;
  for (const p of ordered) {
    let date = addDays(monday, (p.week + shift) * 7 + (p.dow - 1));
    let guard = 0;
    while ((date < start || isBreak(cadence, date)) && guard++ < 10) {
      date = addDays(date, 7);
      if (t.keepRhythm) shift++;
    }
    if (cadence.skipHolidays !== false && isHoliday(date)) date = offHoliday(date, start, cadence, new Set(out.map((x) => x.date)));
    out.push({ date, time: p.time ?? '', title: p.title, format: p.format, stage: p.stage, brief: p.brief, series: p.series ?? '' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The nearest weekday to a holiday that is free: not a holiday, a break, before the start, or already taken. */
function offHoliday(date: string, start: string, cadence: CadenceSettings, taken: ReadonlySet<string>): string {
  for (const d of [-1, 1, -2, 2, -3, 3]) {
    const c = addDays(date, d);
    const dow = new Date(`${c}T00:00:00`).getDay();
    if (dow === 0 || dow === 6 || c < start || isHoliday(c) || isBreak(cadence, c) || taken.has(c)) continue;
    return c;
  }
  return date;
}

export const GOAL_LABEL: Record<CampaignGoal, string> = {
  awareness: 'Get seen',
  engagement: 'Get people talking',
  leads: 'Get inquiries',
  sales: 'Sell',
  launch: 'Launch something',
  community: 'Build community',
};

export const SERVICE_LABEL: Record<ServiceKey, string> = {
  branding: 'Branding',
  packaging: 'Packaging',
  merch: 'Merchandise',
  stickers: 'Stickers',
  illustration: 'Illustration',
  motion: 'Motion graphics',
  web: 'Website design',
  smm: 'Social media management',
  other: 'Other',
};

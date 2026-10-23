import type { Cents } from '../lib/money';

/**
 * Every record that syncs between devices carries these fields.
 * Records are never hard-deleted: `deleted: 1` is a tombstone so a delete
 * made on one device also reaches the others.
 */
export interface Syncable {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted?: 0 | 1;
  /** 1 = changed on this device and not uploaded yet. */
  _sync?: 0 | 1;
  /** Device that last wrote the record. */
  _dev?: string;
}

/** owner: everything. manager: everything except team, settings and money. designer: content work. */
export type AppRole = 'owner' | 'manager' | 'designer';

export type PlatformKey = 'facebook' | 'instagram' | 'tiktok' | 'threads' | 'x' | 'youtube' | 'linkedin' | 'reddit' | 'pinterest';

export type PostStatus = 'idea' | 'todo' | 'doing' | 'review' | 'ready' | 'scheduled' | 'posted' | 'skipped';

export type FunnelStage = 'awareness' | 'interest' | 'decision' | 'action' | 'loyalty';

export type ServiceKey = 'branding' | 'packaging' | 'merch' | 'stickers' | 'illustration' | 'motion' | 'web' | 'smm' | 'other';

export interface Member extends Syncable {
  name: string;
  email: string;
  appRole: AppRole;
  /** What they do, e.g. "Illustrator & Character Design". */
  roleLabel: string;
  /** Services they lead, used to suggest who takes a post. */
  skills: ServiceKey[];
  /** Fixed categorical colour slot (0–7). It follows the person, never their rank. */
  color: number;
  active: 0 | 1;
  notes: string;
}

export interface Approval {
  state: 'none' | 'requested' | 'approved' | 'changes';
  by: string | null;
  at: number | null;
  note: string;
}

/** One piece of content on the calendar (for JoshWorks or for a client). */
export interface Post extends Syncable {
  title: string;
  /** Planned day, YYYY-MM-DD. null = in the backlog, not on the calendar yet. */
  date: string | null;
  /** Planned time, HH:MM ('' = not set). */
  time: string;
  /** Weekly theme key (see cadence settings); '' = none. */
  themeKey: string;
  format: string;
  brief: string;
  status: PostStatus;
  assignees: string[];
  /** null = JoshWorks' own pages. */
  clientId: string | null;
  campaignId: string | null;
  funnelStage: FunnelStage | null;
  /** e.g. WHAT IF, Concept Drop, Freebie Friday. */
  series: string;
  platforms: PlatformKey[];
  /** First line / first three seconds. */
  hook: string;
  caption: string;
  /** Per-platform caption when it differs from the main one. */
  captions: Partial<Record<PlatformKey, string>>;
  hashtags: string;
  cta: string;
  assetLink: string;
  /** Where it was published, per platform. */
  links: Partial<Record<PlatformKey, string>>;
  postedAt: number | null;
  /** Premium design check: item id → done. */
  checklist: Record<string, boolean>;
  approval: Approval;
  ideaId: string | null;
  /** Order among posts on the same day. */
  sort: number;
  /** Free notes the importer or a reschedule leaves (e.g. "Season passed: Halloween"). */
  note: string;
}

export interface Comment extends Syncable {
  postId: string;
  authorId: string | null;
  text: string;
  at: number;
  kind: 'comment' | 'approval' | 'changes' | 'request';
}

export interface Persona {
  name: string;
  who: string;
  pains: string;
  wants: string;
  objections: string;
  whereTheyAre: string;
  triggers: string;
}

export type CampaignGoal = 'awareness' | 'engagement' | 'leads' | 'sales' | 'launch' | 'community';

export interface Kpi {
  metric: 'reach' | 'views' | 'saves' | 'shares' | 'comments' | 'follows' | 'leads' | 'sales';
  target: number;
}

export interface Campaign extends Syncable {
  name: string;
  clientId: string | null;
  status: 'draft' | 'active' | 'paused' | 'done';
  goal: CampaignGoal;
  service: ServiceKey | '';
  templateId: string;
  startDate: string;
  endDate: string;
  audience: Persona;
  offer: string;
  keyMessage: string;
  /** Word people DM or comment, e.g. LOGO, MERCH. */
  ctaKeyword: string;
  leadMagnet: string;
  channels: PlatformKey[];
  /** Ad spend, if any. */
  budget: Cents | null;
  kpis: Kpi[];
  funnelId: string | null;
  notes: string;
}

export interface FunnelStageDef {
  key: FunnelStage;
  goal: string;
  content: string;
  offer: string;
  cta: string;
  channel: string;
  kpi: string;
  target: number | null;
}

export interface Funnel extends Syncable {
  name: string;
  clientId: string | null;
  campaignId: string | null;
  templateId: string;
  stages: FunnelStageDef[];
  notes: string;
}

export interface Slide {
  label: string;
  text: string;
}

export type IdeaKind = 'idea' | 'whatif' | 'concept' | 'script';

export interface Idea extends Syncable {
  kind: IdeaKind;
  title: string;
  /** Educational (Mon), Video / Reel, Fun / Engagement (Fri)… */
  category: string;
  bestFor: string[];
  /** "Joshua/Harvey" as written in the planner, kept when a name isn't on the team. */
  bestForText: string;
  format: string;
  angle: string;
  timing: string;
  /** WHAT IF / Concept Drop subject. */
  subject: string;
  status: 'idea' | 'scheduled' | 'used' | 'archived';
  postId: string | null;
  slides: Slide[];
  tags: string[];
  notes: string;
  sort: number;
}

export interface Snippet extends Syncable {
  kind: 'hashtags' | 'cta' | 'disclaimer' | 'caption';
  label: string;
  text: string;
  useFor: string;
  notes: string;
  sort: number;
}

export type TrendStatus = 'watching' | 'trying' | 'used' | 'expired' | 'skipped';

export interface Trend extends Syncable {
  kind: 'trend' | 'outlier' | 'sound' | 'format';
  title: string;
  platform: PlatformKey | 'any';
  url: string;
  creator: string;
  whyItWorks: string;
  howWeUseIt: string;
  hook: string;
  views: number | null;
  /** The creator's usual views, so we can see how far above normal this one went. */
  creatorAvgViews: number | null;
  status: TrendStatus;
  expiresOn: string | null;
  savedBy: string | null;
  source: 'manual' | 'claude' | 'feed';
  tags: string[];
}

export interface Hook extends Syncable {
  text: string;
  pattern: string;
  sourceUrl: string;
  whyItWorks: string;
  /** Our version of it. */
  rewrite: string;
  memberId: string | null;
  /** Set when this was the day's "rewrite one hook" practice. */
  practiceDate: string | null;
  tags: string[];
}

/** Numbers for one post on one platform, logged 48–72 h after publishing. */
export interface Metric extends Syncable {
  postId: string | null;
  clientId: string | null;
  date: string;
  title: string;
  series: string;
  format: string;
  memberIds: string[];
  /** As written in an imported sheet, kept when the name isn't on the team. */
  designerText: string;
  platform: PlatformKey;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  follows: number | null;
  clicks: number | null;
  leads: number | null;
  notes: string;
}

/**
 * inquiry → quoted → booked → active → completed (or lost).
 * Older records may still hold the first app's SMM stages; `normalizeStage` maps them.
 */
export type ClientStage = 'inquiry' | 'quoted' | 'booked' | 'active' | 'completed' | 'lost';
export type LegacyClientStage = 'lead' | 'discovery' | 'proposal' | 'contract' | 'onboarding' | 'strategy' | 'paused' | 'ended';

export type ClientKind = 'business' | 'student-org' | 'school' | 'individual' | 'government';

export interface Client extends Syncable {
  name: string;
  /** Business, student org, school… Sets which price tier quotes start from. */
  kind?: ClientKind;
  industry: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  /** Tax ID of a business client (they withhold tax and issue BIR Form 2307). */
  tin?: string;
  stage: ClientStage | LegacyClientStage;
  /** Where they found us: Messenger, Facebook, referral, walk-in… */
  source: string;
  platforms: PlatformKey[];
  handles: Partial<Record<PlatformKey, string>>;
  brandKitLink: string;
  packageId: string | null;
  startDate: string;
  renewalDate: string;
  /** How long the client takes to approve content. */
  approvalHours: number;
  goals: string;
  persona: Persona;
  /** Onboarding and monthly checklist: item id → done. */
  checklist: Record<string, boolean>;
  notes: string;
}

export interface Deliverable {
  label: string;
  qty: number;
  /** Hours each, for the margin check. */
  hours: number;
  /** Role whose rate those hours cost. */
  role: string;
}

export type Audience = 'business' | 'student' | 'any';

/** One line of the price list: a package, a single item, or an add-on. */
export interface Package extends Syncable {
  kind: 'smm' | 'design' | 'addon';
  name: string;
  tagline: string;
  /** For unit 'percent', the percent × 100 (25% → 2500). */
  price: Cents;
  unit: 'month' | 'project' | 'piece' | 'hour' | 'percent' | 'participant';
  platforms: PlatformKey[];
  deliverables: Deliverable[];
  includes: string[];
  revisionsPerPost: number;
  minTermMonths: number;
  service: ServiceKey | '';
  active: 0 | 1;
  sort: number;
  notes: string;
  /** Price list section, e.g. "Branding", "Merch", "Yearbook". */
  category?: string;
  audience?: Audience;
  /** Student-org price, when it differs from the business price. */
  studentPrice?: Cents | null;
  /** e.g. "7–14 days". */
  turnaround?: string;
  /** Revision rounds included. */
  revisions?: number;
}

export interface ProposalItem {
  packageId: string | null;
  label: string;
  qty: number;
  unitPrice: Cents;
  unit: Package['unit'];
  /** Months for monthly items. */
  months: number;
  /** A package line: percentage add-ons (rush, revisions, source files…) are worked out on these lines. */
  base?: boolean;
}

/** A quote (called a proposal in the first version of the app). */
export interface Proposal extends Syncable {
  number: string;
  clientId: string | null;
  clientName: string;
  date: string;
  validUntil: string;
  items: ProposalItem[];
  /** Introductory discount, percent of monthly items for the first `discountMonths`. */
  discountPct: number;
  discountMonths: number;
  discountLabel: string;
  vat: boolean;
  ewt: boolean;
  status: 'draft' | 'sent' | 'won' | 'lost';
  intro: string;
  notes: string;
  /** Peso discount on the one-off work (a promo code, a bulk discount). */
  discountAmount?: Cents;
  /** The job this quote turned into. */
  jobId?: string | null;
}

export interface ContractSection {
  id: string;
  title: string;
  body: string;
  on: boolean;
}

/** Which brand-kit letterhead a document is printed on. */
export type FrameKey = 'general' | 'merch' | 'web' | 'logo';

export interface Contract extends Syncable {
  number: string;
  clientId: string | null;
  proposalId: string | null;
  packageId: string | null;
  status: 'draft' | 'sent' | 'signed' | 'ended';
  /** Values the template's {{placeholders}} are filled with. */
  fields: Record<string, string>;
  sections: ContractSection[];
  signedAt: number | null;
  notes: string;
  /** Set on contracts made from a contract template (the second version of the app). */
  templateId?: string | null;
  title?: string;
  subtitle?: string;
  frame?: FrameKey;
  /** The chosen package(s) and add-ons, priced like a quote. */
  items?: ProposalItem[];
  discountAmount?: Cents;
  /** Answers to the template's brief or questionnaire; `picks` are the ticked boxes of a tick-box question. */
  brief?: BriefAnswer[];
  rush?: boolean;
  /** Percent of the total due on signing (50 by default). */
  downPct?: number;
  jobId?: string | null;
  /** Deliverables & milestones: what the client gets and by when. */
  milestones?: Milestone[];
  /** Print the owner's saved signature on the designer line (on unless turned off). */
  useSignature?: boolean;
  /** The client's own signature (PNG data URL) when they signed online. */
  clientSignature?: string;
  /** When and how the client signed online. */
  signedOnline?: { name: string; at: number; device: string } | null;
}

export interface BriefAnswer {
  q: string;
  a: string;
  picks?: string[];
}

export interface Milestone {
  title: string;
  /** YYYY-MM-DD, or '' when not set yet. */
  date: string;
  /** What the client receives at this point. */
  what: string;
}

/** A contract type from the studio's v1.0 contract set, e.g. "Merch Design". */
export interface ContractTemplate extends Syncable {
  name: string;
  /** Line under the title, e.g. "Logo design, brand systems & visual identity". */
  tagline: string;
  /** Pricing tier line, e.g. "Business / Commercial". */
  subtitle: string;
  /** Extra line under the phases (e.g. which phases apply to which part). */
  phasesNote: string;
  frame: FrameKey;
  /** Price list sections whose packages and add-ons this contract offers. */
  categories: string[];
  audience: Audience;
  welcome: string;
  /** "This Agreement Covers: …" */
  covers: string;
  phases: { title: string; text: string }[];
  briefTitle: string;
  brief: string[];
  sections: ContractSection[];
  /** Client agreement statement points. */
  agreement: string[];
  active: 0 | 1;
  sort: number;
}

// ----- the studio's work and money -----

export type JobType =
  | 'Branding' | 'General' | 'Merch' | '3D Model' | 'Video Editing' | 'Campaign' | 'SMM / Retainer' | 'Pop-up / Stickers'
  | 'Publication' | 'Web' | 'Motion' | 'Training';

export type JobStatus = 'inquiry' | 'not-started' | 'in-progress' | 'review' | 'revisions' | 'completed' | 'blocked' | 'cancelled';

export type Priority = 'low' | 'med' | 'high';

/**
 * One commission (a row of the commission tracker): the plan, set by the owner
 * or a manager. The money is in JobMoney; day-to-day progress is in JobProgress,
 * which designers update.
 */
export interface Job extends Syncable {
  /** COM-001… */
  number: string;
  title: string;
  type: JobType;
  clientId: string | null;
  /** As written in the tracker, kept when the client isn't in Clients yet. */
  clientName: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  rush: boolean;
  /** Who works on it (members). */
  designers: string[];
  lead: string | null;
  revisionsIncluded: number;
  brief: string;
  /** Where the inquiry came from (Messenger, Facebook, referral…). */
  source: string;
  /** Inquiry details: the budget the client mentioned. */
  budgetNote: string;
}

/** A job's progress, kept apart so a designer's update never overwrites the plan. Its id is the job's id. */
export interface JobProgress extends Syncable {
  status: JobStatus;
  completedOn: string;
  revisionsUsed: number;
  /** Delivery checklist: item id → done. */
  checklist: Record<string, boolean>;
  /** Drive folder, final files… */
  links: { label: string; url: string }[];
  notes: string;
}

/** A job with its progress, as screens show it. */
export type JobView = Job & Omit<JobProgress, keyof Syncable> & { progressAt: number };

export interface SplitShare {
  memberId: string;
  /** 0–100. */
  pct: number;
}

/** The money side of a job: owner and managers only. Its id is the job's id. */
export interface JobMoney extends Syncable {
  total: Cents;
  /** Price lines from the quote or contract (package, add-ons). */
  items: ProposalItem[];
  discountAmount: Cents;
  /** Standard deduction / processing fee taken before the team split (5%). */
  deductionPct: number;
  split: SplitShare[];
  /** Tax withheld by the client (Form 2307). */
  taxWithheld: Cents;
  form2307: 'yes' | 'no' | 'na';
  /** Tracker invoice no., when it came from the commission tracker. */
  invoiceNo: string;
  notes: string;
}

export type PayMethod = 'GCash' | 'Mari Bank' | 'Union Bank' | 'On Hand' | 'Bank transfer' | 'PayPal' | 'Wise' | 'Other';

/** Money a client paid. */
export interface Payment extends Syncable {
  jobId: string | null;
  invoiceId: string | null;
  clientId: string | null;
  amount: Cents;
  date: string;
  method: PayMethod;
  reference: string;
  kind: 'down' | 'final' | 'partial' | 'full';
  /** Acknowledgment receipt number, AR-0001-2026. */
  receiptNo: string;
  note: string;
}

/** A designer's share of one client payment: payment × (1 − deduction) × their split. */
export interface Earning extends Syncable {
  memberId: string;
  jobId: string;
  paymentId: string;
  amount: Cents;
  date: string;
}

/** Money actually sent to a designer. */
export interface Payout extends Syncable {
  memberId: string;
  amount: Cents;
  date: string;
  method: string;
  reference: string;
  note: string;
}

/** Where a designer gets paid. Its id is the member's id. */
export interface PayoutAccount extends Syncable {
  method: string;
  accountName: string;
  accountNumber: string;
  /** Shrunk QR code image (data URL), or ''. */
  qrImage: string;
  notes: string;
}

export interface InvoiceItem {
  label: string;
  qty: number;
  /** Line amount (already × qty). */
  amount: Cents;
  addOn: boolean;
}

export interface Invoice extends Syncable {
  /** JW-0032-2026 */
  number: string;
  jobId: string | null;
  clientId: string | null;
  issueDate: string;
  dueDate: string;
  billTo: { name: string; contact: string; address: string; emailPhone: string };
  items: InvoiceItem[];
  discountLabel: string;
  discountAmount: Cents;
  /** Payments received before this invoice when it has no job (a job's payments are counted automatically). */
  paidManual: Cents;
  status: 'draft' | 'sent' | 'void';
  sentAt: number | null;
  notes: string;
}

export interface Expense extends Syncable {
  date: string;
  category: string;
  amount: Cents;
  vendor: string;
  jobId: string | null;
  note: string;
}

/** A weekly trend report: from the scheduled Claude routine (feed) or written in the app. */
export interface TrendReport extends Syncable {
  weekOf: string;
  source: 'feed' | 'assistant';
  generatedAt: number;
  summary: string;
  items: TrendItem[];
  dates: { date: string; name: string; idea: string }[];
  sources: { title: string; url: string }[];
}

export interface TrendItem {
  id: string;
  title: string;
  platform: PlatformKey | 'any';
  kind: string;
  what: string;
  why: string;
  howJoshWorks: string;
  postIdea: { title: string; format: string; themeKey: string } | null;
  expires: string | null;
  sources: { title: string; url: string }[];
}

export interface AuditEntry extends Syncable {
  at: number;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
}

export interface SettingRow extends Syncable {
  value: unknown;
}

// ----- settings values -----

export interface BusinessSettings {
  name: string;
  tagline: string;
  /** DTI business name registration no., shown on proposals and contracts. */
  registration: string;
  address: string;
  contact: string;
  email: string;
  website: string;
  handles: Partial<Record<PlatformKey, string>>;
  /** Where client payments go, printed on proposals: "GCash 09xx…, BPI …". */
  paymentDetails: string;
  /** Person who signs documents for the studio, e.g. "Joshua David G. Ranin, Head Designer". */
  signatory?: string;
  /** The signatory's signature, a transparent PNG data URL printed on contracts. */
  signature?: string;
  /** Contract defaults for "Communication & delivery". */
  channel?: string;
  hours?: string;
  delivery?: string;
}

export interface BrandVoice {
  tone: string;
  audience: string;
  doSay: string;
  dontSay: string;
  emoji: 'none' | 'light' | 'expressive';
  boldHeadline: boolean;
  language: string;
  defaultCta: string;
  baseHashtags: string;
}

export interface ThemeDef {
  key: string;
  /** 1 = Monday … 5 = Friday (0 Sunday, 6 Saturday allowed). */
  dow: number;
  name: string;
  short: string;
  description: string;
  /** A flex slot is only used when needed. */
  flex: boolean;
  active: boolean;
}

export interface CadenceSettings {
  themes: ThemeDef[];
  /** Friday rotation, week 1–4 of each month's cycle. */
  fridayRotation: string[];
  /** Break week: the week that starts on the last Monday of each month. */
  breakRule: boolean;
  /** Leave Philippine public holidays free when planning. */
  skipHolidays: boolean;
  /** Extra break ranges (YYYY-MM-DD to YYYY-MM-DD). */
  breaks: { start: string; end: string; label: string }[];
  /** Posting picks up again on this day (a pause before it shows on the dashboard). */
  resumeOn: string;
  defaultTimes: Partial<Record<PlatformKey, string>>;
  platforms: PlatformKey[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  on: boolean;
}

export interface RoleRate {
  name: string;
  rate: Cents;
  covers: string;
}

export interface RateSettings {
  roles: RoleRate[];
  overheadPct: number;
  targetMarginPct: number;
  minMarginPct: number;
  vatPct: number;
  ewtPct: number;
  rushPct: number;
  revisionPct: number;
}

export interface AiSettings {
  model: string;
  effort: 'low' | 'medium' | 'high';
  webSearch: boolean;
  /** Reminder only: the real limit is set in the Claude Console. */
  monthlyBudgetUsd: number;
}

export interface SecuritySettings {
  pinHash: string | null;
  pinSalt: string | null;
}

export interface MonthlyTarget {
  /** YYYY-MM */
  month: string;
  low: Cents;
  high: Cents;
}

export interface MoneySettings {
  /** Standard deduction / processing fee before the team split, in percent (5). */
  deductionPct: number;
  /** Invoice numbers: JW-0032-2026 → prefix "JW", next 32. */
  invoicePrefix: string;
  invoiceNext: number;
  receiptNext: number;
  /** Days an invoice stays valid / is due. */
  invoiceDays: number;
  /** Percent due on signing. */
  downPct: number;
  invoiceNotes: string[];
  /** A job at or above this total counts as a big project. */
  bigProject: Cents;
  targets: MonthlyTarget[];
  /** The default split for new jobs (empty = the lead designer gets 100%). */
  defaultSplit: SplitShare[];
  expenseCategories: string[];
  /** Set once the price list has been moved to the studio catalog. */
  catalogVersion: number;
  /** The contract templates' questionnaire and terms version on this studio (1 = first set). */
  templateVersion?: number;
}

export interface BirSettings {
  /** First day receipts count for BIR (registration date). */
  startDate: string;
  /** Uses the 8% income tax option. */
  eightPct: boolean;
  /** Tax-free amount each year under the 8% option. */
  exemption: Cents;
  /** Non-VAT ceiling over 12 months. */
  vatCeiling: Cents;
}

/** Where clients pay JoshWorks: printed on invoices and contracts. */
export interface StudioPayMethod {
  id: string;
  label: string;
  accountName: string;
  accountNumber: string;
  /** Shrunk QR image (data URL), or ''. */
  qrImage: string;
  on: boolean;
}

export interface EmailSettings {
  /** The studio Gmail's mailer: the Apps Script web app URL (apps-script/Mailer.gs). */
  mailerUrl: string;
  /** Shared secret the mailer checks (pasted into the script as KEY). */
  mailerKey: string;
  fromName: string;
  replyTo: string;
  /** Email the owner is copied on (Bcc). */
  copyTo: string;
}

export type SettingKey =
  | 'business' | 'voice' | 'cadence' | 'checklist' | 'rates' | 'ai' | 'contract' | 'security'
  | 'money' | 'bir' | 'payMethods' | 'email';

// ----- device-only -----

export interface LocalRow {
  key: string;
  value: unknown;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** Web pages the answer used. */
  sources?: { title: string; url: string }[];
  usage?: { input: number; output: number; cacheRead: number; searches: number; costUsd: number; model: string };
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  recipe: string;
  createdAt: number;
  updatedAt: number;
  /** What the chat is about: a post, campaign or client. */
  context: { kind: 'post' | 'campaign' | 'client' | 'none'; id: string | null; label: string };
  /** Background sent with the first message (today, the calendar, the post…). */
  contextText?: string;
  messages: ChatMessage[];
}

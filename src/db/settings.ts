import { db } from './db';
import { save } from './write';
import { DEFAULT_CADENCE } from '../domain/calendar';
import { DEFAULT_CHECKLIST } from '../domain/checklist';
import { DEFAULT_RATES } from '../domain/pricing';
import { DEFAULT_CONTRACT_SECTIONS } from '../domain/contract';
import { DEFAULT_BIR, DEFAULT_MONEY, DEFAULT_PAY_METHODS } from '../domain/money';
import type {
  AiSettings, BirSettings, BrandVoice, BusinessSettings, CadenceSettings, ChecklistItem, ContractSection, EmailSettings, MoneySettings, RateSettings,
  SecuritySettings, SettingKey, SettingRow, StudioPayMethod,
} from './types';

/** Settings shared by every device (they sync). */

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: 'JoshWorks',
  tagline: 'Creative studio · Iloilo City',
  registration: 'DTI-registered',
  address: 'Iloilo City',
  contact: '',
  email: 'jworks1505@gmail.com',
  website: 'facebook.com/artsbyjosh',
  handles: { tiktok: '@joshworks_onart', facebook: '@artsbyjosh' },
  paymentDetails: '',
  signatory: '',
  signature: '',
  channel: 'Facebook Messenger (JoshWorks page) and email',
  hours: 'Replies within 1 business day · Monday to Saturday, 9:00 AM–6:00 PM',
  delivery: 'Google Drive link sent by email or Messenger',
};

export const DEFAULT_EMAIL: EmailSettings = {
  serviceId: '',
  templateId: '',
  publicKey: '',
  fromName: 'JoshWorks Studio',
  replyTo: 'jworks1505@gmail.com',
  copyTo: '',
};

/** How JoshWorks already writes its captions. */
export const DEFAULT_VOICE: BrandVoice = {
  tone: 'Warm, confident and helpful. Teaches without preaching; proud of local work and the people behind it.',
  audience: 'Business owners, student organizations and creatives in Iloilo and across the Philippines.',
  doSay: 'Open with a hook. Explain the thinking behind the work. Tell the client’s story, not just the logo. End with one clear ask: save, share, comment, or DM a keyword.',
  dontSay: 'Unexplained jargon, putting other designers down, fake urgency, “cheap”.',
  emoji: 'light',
  boldHeadline: true,
  language: 'English, with natural Filipino or Hiligaynon touches when they fit.',
  defaultCta: 'Need this for your brand? DM us “START” and we’ll send the rate sheet.',
  baseHashtags: '#JoshWorks #GraphicDesign #DesignStudio #Branding',
};

export const DEFAULT_AI: AiSettings = {
  model: 'claude-opus-5-5',
  effort: 'medium',
  webSearch: true,
  monthlyBudgetUsd: 10,
};

export interface SettingValues {
  business: BusinessSettings;
  voice: BrandVoice;
  cadence: CadenceSettings;
  checklist: ChecklistItem[];
  rates: RateSettings;
  ai: AiSettings;
  contract: ContractSection[];
  security: SecuritySettings;
  money: MoneySettings;
  bir: BirSettings;
  payMethods: StudioPayMethod[];
  email: EmailSettings;
}

export const DEFAULTS: SettingValues = {
  business: DEFAULT_BUSINESS,
  voice: DEFAULT_VOICE,
  cadence: DEFAULT_CADENCE,
  checklist: DEFAULT_CHECKLIST,
  rates: DEFAULT_RATES,
  ai: DEFAULT_AI,
  contract: DEFAULT_CONTRACT_SECTIONS,
  security: { pinHash: null, pinSalt: null },
  money: DEFAULT_MONEY,
  bir: DEFAULT_BIR,
  payMethods: DEFAULT_PAY_METHODS,
  email: DEFAULT_EMAIL,
};

function merge<K extends SettingKey>(key: K, value: unknown): SettingValues[K] {
  const fallback = DEFAULTS[key];
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(fallback)) return (Array.isArray(value) ? value : fallback) as SettingValues[K];
  return { ...(fallback as object), ...(value as object) } as SettingValues[K];
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key);
  return merge(key, !row || row.deleted === 1 ? undefined : row.value);
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<void> {
  const existing = await db.settings.get(key);
  const row: SettingRow = existing ? { ...existing, value, deleted: 0 } : { id: key, value, createdAt: Date.now(), updatedAt: Date.now() };
  await save(db.settings, row);
}

/** Read a settings value synchronously from a live query result. */
export function settingValue<K extends SettingKey>(rows: readonly SettingRow[] | undefined, key: K): SettingValues[K] {
  const row = rows?.find((r) => r.id === key && r.deleted !== 1);
  return merge(key, row?.value);
}

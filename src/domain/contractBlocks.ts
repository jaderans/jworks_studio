import { uid } from '../lib/ids';
import type { ContractBlock, ContractBlockKind, ContractSection, ContractTemplate } from '../db/types';

/**
 * The contract builder: a contract is a list of blocks printed in order, under
 * the header (title, contract and job numbers, dates, prepared for). Most
 * blocks print the template's own text; "Your own text" and "Page break" can
 * be added as often as needed. Templates without blocks print the classic
 * layout, which is this same list in the house order.
 */

/** The house order: where the classic templates put each part. */
export const CLASSIC_ORDER: ContractBlockKind[] = [
  'welcome',
  'process',
  'client',
  'packages',
  'deliverables',
  'questionnaire',
  'terms',
  'agreement',
  'schedule',
  'communication',
  'signatures',
  'payment',
];

export const BLOCK_INFO: Record<ContractBlockKind, { label: string; hint: string; repeat?: boolean }> = {
  welcome: {
    label: 'Welcome',
    hint: 'Welcome to JoshWorks, what we do, our goal, what this agreement covers and the project scope.',
  },
  process: { label: 'Our process', hint: 'The project phases, numbered.' },
  client: {
    label: 'Client information',
    hint: 'Name, contact person, email, phone, address, socials and TIN.',
  },
  packages: {
    label: 'Packages & price',
    hint: 'The packages to choose from, add-ons, other items and the total project cost.',
  },
  deliverables: {
    label: 'Deliverables & milestones',
    hint: 'What the client receives and by when.',
  },
  questionnaire: {
    label: 'Questionnaire',
    hint: 'The brief the client fills in (online or on paper).',
  },
  terms: {
    label: 'Terms and conditions',
    hint: 'Numbered terms on their own page, fitted to one page.',
  },
  agreement: {
    label: 'Client agreement statement',
    hint: '“By signing below, I … agree to the following”.',
  },
  schedule: {
    label: 'Timeline & payment schedule',
    hint: 'Start and completion dates, rush, payment method, down and final payment.',
  },
  communication: {
    label: 'Communication & delivery',
    hint: 'Official channel, reply time and how files are delivered.',
  },
  signatures: {
    label: 'Signatures',
    hint: 'Client and designer sign here (your saved signature prints).',
  },
  payment: { label: 'Where to pay', hint: 'Your payment QR codes.' },
  text: {
    label: 'Your own text',
    hint: 'A heading and your own paragraphs or bullet points.',
    repeat: true,
  },
  pagebreak: {
    label: 'Page break',
    hint: 'What follows starts on a new page.',
    repeat: true,
  },
};

/** The kinds the builder offers, in the order its "Add a block" menu lists them. */
export const BLOCK_KINDS = [...CLASSIC_ORDER, 'text', 'pagebreak'] as ContractBlockKind[];

export const newBlock = (kind: ContractBlockKind, extra: Partial<ContractBlock> = {}): ContractBlock => ({
  id: uid(),
  kind,
  ...(kind === 'text' ? { title: '', body: '' } : {}),
  ...extra,
});

/** The blocks a template prints: its own, or the classic layout. */
export const blocksOf = (t: Pick<ContractTemplate, 'blocks'>): ContractBlock[] => t.blocks ?? CLASSIC_ORDER.map((kind) => ({ id: kind, kind }));

/** Add a block where the house order puts it (after the parts that come before it), unless it's already there. */
export function ensureBlock(blocks: ContractBlock[], kind: ContractBlockKind): ContractBlock[] {
  if (blocks.some((b) => b.kind === kind)) return blocks;
  const rank = CLASSIC_ORDER.indexOf(kind);
  const at = blocks.findIndex((b) => CLASSIC_ORDER.indexOf(b.kind) > rank);
  const next = [...blocks];
  next.splice(at < 0 ? next.length : at, 0, newBlock(kind));
  return next;
}

export type TemplateDraft = Omit<ContractTemplate, 'createdAt' | 'updatedAt' | 'deleted' | '_sync' | '_dev'> & Partial<Pick<ContractTemplate, 'createdAt' | 'updatedAt' | 'deleted'>>;

/** A full blank slate: a name, nothing else. */
export function blankTemplate(name = 'New contract'): TemplateDraft {
  return {
    id: `tpl-${uid()}`,
    name,
    tagline: '',
    subtitle: 'Custom',
    phasesNote: '',
    frame: 'general',
    categories: [],
    audience: 'any',
    welcome: '',
    covers: '',
    phases: [],
    briefTitle: 'Questionnaire',
    brief: [],
    sections: [],
    agreement: [],
    active: 1,
    sort: 900,
    blocks: [],
  };
}

/** Copy a template into the builder (its parts in the classic order), to change it without touching the original. */
export function builtCopy(t: ContractTemplate): TemplateDraft {
  return {
    ...structuredClone({ ...t, blocks: blocksOf(t) }),
    id: `tpl-${uid()}`,
    name: `${t.name} (custom)`,
    subtitle: 'Custom',
    sort: 900,
    createdAt: undefined,
    updatedAt: undefined,
    deleted: undefined,
  };
}

/** What can be borrowed from another template. */
export interface BorrowParts {
  welcome?: boolean;
  covers?: boolean;
  phases?: boolean;
  questionnaire?: boolean;
  agreement?: boolean;
  categories?: boolean;
  /** Terms sections, by id. */
  sections?: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Bring parts of another template into this one. Single texts (welcome, what
 * it covers) are replaced; lists (phases, questions, terms, agreement points,
 * price list sections) are added to, skipping ones already there. The block
 * that prints each part is added if it's missing.
 */
export function borrowFrom<T extends TemplateDraft>(target: T, from: ContractTemplate, parts: BorrowParts): T {
  const t = { ...target, blocks: [...(target.blocks ?? blocksOf(target))] };
  const need = (kind: ContractBlockKind) => (t.blocks = ensureBlock(t.blocks, kind));
  if (parts.welcome) {
    t.welcome = from.welcome;
    if (!t.tagline) t.tagline = from.tagline;
    need('welcome');
  }
  if (parts.covers) {
    t.covers = from.covers;
    need('welcome');
  }
  if (parts.phases && from.phases.length) {
    const have = new Set(t.phases.map((p) => norm(p.title)));
    t.phases = [...t.phases, ...from.phases.filter((p) => !have.has(norm(p.title))).map((p) => ({ ...p }))];
    if (!t.phasesNote) t.phasesNote = from.phasesNote;
    need('process');
  }
  if (parts.questionnaire && from.brief.length) {
    if (!t.brief.length) {
      t.brief = [...from.brief];
      t.briefTitle = from.briefTitle;
    } else {
      // Keep the two apart: the borrowed questions come under their own heading.
      const lines = from.brief[0]?.startsWith('## ') ? from.brief : [`## ${from.briefTitle || from.name}`, ...from.brief];
      t.brief = [...t.brief, ...lines];
    }
    need('questionnaire');
  }
  if (parts.agreement && from.agreement.length) {
    const have = new Set(t.agreement.map(norm));
    t.agreement = [...t.agreement, ...from.agreement.filter((a) => !have.has(norm(a)))];
    need('agreement');
  }
  if (parts.categories && from.categories.length) {
    t.categories = [...new Set([...t.categories, ...from.categories])];
    need('packages');
  }
  const picked = from.sections.filter((s) => parts.sections?.includes(s.id));
  if (picked.length) {
    const titles = new Set(t.sections.map((s) => norm(s.title)));
    const ids = new Set(t.sections.map((s) => s.id));
    const added: ContractSection[] = picked
      .filter((s) => !titles.has(norm(s.title)))
      .map((s) => ({
        ...s,
        on: true,
        id: ids.has(s.id) ? `${s.id}-${uid().slice(0, 4)}` : s.id,
      }));
    t.sections = [...t.sections, ...added];
    need('terms');
  }
  return t;
}

/** Move a block up (-1) or down (+1). */
export function moveBlock(blocks: ContractBlock[], id: string, by: -1 | 1): ContractBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

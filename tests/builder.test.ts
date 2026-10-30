import { describe, expect, it } from 'vitest';
import { blankTemplate, blocksOf, borrowFrom, builtCopy, CLASSIC_ORDER, ensureBlock, moveBlock, newBlock } from '../src/domain/contractBlocks';
import { DEFAULT_RATE_CARD, rateCardSections, rateText } from '../src/domain/rateCard';
import { isRushLine, projectDays, RUSH_ID } from '../src/domain/contractPlan';
import { rateCardEmail } from '../src/email/templates';
import { DEFAULT_BUSINESS } from '../src/db/settings';
import { SEED_TEMPLATES } from '../src/domain/contractTemplates';
import type { ContractTemplate, Package, ProposalItem } from '../src/db/types';

const branding = { ...SEED_TEMPLATES[0], createdAt: 1, updatedAt: 1, deleted: 0 } as ContractTemplate;

describe('the contract builder', () => {
  it('starts as a blank slate, and old templates print the classic order', () => {
    const t = blankTemplate();
    expect(t.blocks).toEqual([]);
    expect(t.sections).toEqual([]);
    expect(blocksOf(branding).map((b) => b.kind)).toEqual(CLASSIC_ORDER);
  });

  it('adds a missing block where the house order puts it, and moves blocks', () => {
    let blocks = [newBlock('welcome'), newBlock('signatures')];
    blocks = ensureBlock(blocks, 'terms');
    expect(blocks.map((b) => b.kind)).toEqual(['welcome', 'terms', 'signatures']);
    expect(ensureBlock(blocks, 'terms')).toBe(blocks);
    const moved = moveBlock(blocks, blocks[2].id, -1);
    expect(moved.map((b) => b.kind)).toEqual(['welcome', 'signatures', 'terms']);
    expect(moveBlock(moved, moved[0].id, -1)).toBe(moved);
  });

  it('borrows parts of a template: lists are added to, texts replaced, blocks added', () => {
    const own = { ...blankTemplate(), sections: [{ id: 'own-1', title: 'Usage rights', body: 'Yours to use.', on: true }], blocks: [newBlock('text', { title: 'Hello' })] };
    const twoTerms = branding.sections.slice(0, 2).map((s) => s.id);
    const t = borrowFrom(own, branding, { welcome: true, phases: true, questionnaire: true, sections: twoTerms });
    expect(t.welcome).toBe(branding.welcome);
    expect(t.phases).toHaveLength(branding.phases.length);
    expect(t.brief).toEqual(branding.brief);
    expect(t.sections.map((s) => s.id)).toEqual(['own-1', ...twoTerms]);
    // Your own blocks stay where you put them; borrowed parts follow in the house order.
    expect(t.blocks!.map((b) => b.kind)).toEqual(['text', 'welcome', 'process', 'questionnaire', 'terms']);
    // Borrowing again doesn't double anything up.
    const again = borrowFrom(t, branding, { phases: true, sections: twoTerms });
    expect(again.phases).toHaveLength(branding.phases.length);
    expect(again.sections).toHaveLength(3);
    // A second questionnaire comes under its own heading.
    const two = borrowFrom(t, { ...branding, id: 'x', briefTitle: 'Merch brief', brief: ['Shirt colours?'] }, { questionnaire: true });
    expect(two.brief.slice(-2)).toEqual(['## Merch brief', 'Shirt colours?']);
  });

  it('copies a template into the builder without touching it', () => {
    const copy = builtCopy(branding);
    expect(copy.id).not.toBe(branding.id);
    expect(copy.blocks!.map((b) => b.kind)).toEqual(CLASSIC_ORDER);
    copy.sections[0].title = 'Changed';
    expect(branding.sections[0].title).not.toBe('Changed');
  });
});

describe('an edited rush line', () => {
  const pkg = { id: 'p1', kind: 'design', turnaround: '14–21 days', active: 1 } as Package;
  const rush = (label: string): ProposalItem => ({ packageId: RUSH_ID, label, qty: 1, unitPrice: 2500, unit: 'percent', months: 1 });
  const line: ProposalItem = { packageId: 'p1', label: 'Logo', qty: 1, unitPrice: 350000, unit: 'project', months: 1 };

  it('stays the rush line after its name is changed, and its wording sets the speed', () => {
    expect(isRushLine(rush('Rush (1–2 week turnaround)'))).toBe(true);
    expect(isRushLine({ packageId: null, label: 'Rush (10 days)', unit: 'percent' })).toBe(true);
    expect(isRushLine({ packageId: null, label: 'Tarpaulin rush (within 24 hours)', unit: 'project' })).toBe(false);
    expect(projectDays([line, rush('Rush (3–5 day turnaround)')], [pkg], true)).toBe(5);
    expect(projectDays([line, rush('Rush (1–2 week turnaround)')], [pkg], true)).toBe(14);
    expect(projectDays([line], [pkg], false)).toBe(21);
  });
});

describe('the rate card', () => {
  const p = (o: Partial<Package>): Package =>
    ({ id: o.name, kind: 'design', unit: 'project', price: 100000, includes: [], active: 1, deleted: 0, sort: 0, notes: '', category: 'Branding', ...o }) as Package;
  const packages = [
    p({ name: 'Budget Logo', price: 245000, studentPrice: 180000, notes: 'Internal: raise next year' }),
    p({ name: 'Mascot', kind: 'addon', price: 300000 }),
    p({ name: 'Old logo', active: 0 }),
    p({ name: 'Shirt', category: 'Merch', unit: 'piece', price: 50000 }),
    p({ name: 'Rush', kind: 'addon', unit: 'percent', price: 2500, category: 'Add-ons' }),
  ];

  it('groups the active items by price list section, leaving out hidden ones and other sections', () => {
    const all = rateCardSections(packages, { sections: [], hidden: [] });
    expect(all.map((s) => s.name)).toEqual(['Branding', 'Merch', 'Add-ons']);
    expect(all[0].items.map((x) => x.name)).toEqual(['Budget Logo']);
    expect(all[0].addOns.map((x) => x.name)).toEqual(['Mascot']);
    const some = rateCardSections(packages, { sections: ['Branding'], hidden: ['Mascot'] });
    expect(some).toEqual([{ name: 'Branding', items: [packages[0]], addOns: [] }]);
  });

  it('prices for businesses or student orgs, and percent add-ons as a share', () => {
    expect(rateText(packages[0], 'business')).toBe('₱2,450 / project');
    expect(rateText(packages[0], 'student')).toBe('₱1,800 / project');
    expect(rateText(packages[3], 'student')).toBe('₱500 / piece');
    expect(rateText(packages[4], 'business')).toBe('+25% of the package price');
  });

  it('starts with every part on and never mentions internal notes', () => {
    expect(DEFAULT_RATE_CARD.parts).toEqual({ intro: true, portfolio: true, prices: true, notes: true });
    expect(JSON.stringify(DEFAULT_RATE_CARD)).not.toMatch(/raise|margin|overhead/i);
  });

  it('emails it with the portfolio button and the confidential note', () => {
    const mail = rateCardEmail(DEFAULT_BUSINESS, { name: 'Alex', company: 'Sample Agency Inc.', validUntil: '2026-11-29', portfolioUrl: 'behance.net/joshworks', confidential: true });
    expect(mail.subject).toContain('Sample Agency Inc.');
    expect(mail.html).toContain('https://behance.net/joshworks');
    expect(mail.html).toContain('internal reference only');
    expect(mail.text).toContain('Nov 29, 2026');
  });
});

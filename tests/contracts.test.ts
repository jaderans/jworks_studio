import { describe, expect, it } from 'vitest';
import { SEED_TEMPLATES, STANDARD_TERMS } from '../src/domain/contractTemplates';
import { V1, upgradeTemplate } from '../src/domain/contractTemplatesV1';
import { answeredCount, earlierAnswers, parseQuestionnaire, questionsOf, setAnswer } from '../src/domain/questionnaire';
import { completionDate, contractAudience, deliverablesOf, planMilestones, projectDays, turnaroundDays } from '../src/domain/contractPlan';
import { applyLinkResponse, linkExpiry, linkSnapshot } from '../src/domain/clientLink';
import type { Contract, ContractTemplate, Package, ProposalItem } from '../src/db/types';

const branding = SEED_TEMPLATES.find((t) => t.id === 'tpl-branding-business')!;

describe('questionnaires', () => {
  it('reads sections, open questions and tick-box grids', () => {
    const items = parseQuestionnaire(['> Intro', '## Part', 'Open?', 'Pick? :: Short | Also short | Other:', '', 'Long? :: A rather long option label | Another long option here']);
    expect(items.map((i) => i.kind)).toEqual(['intro', 'section', 'open', 'choice', 'choice']);
    const pick = items[3] as Extract<(typeof items)[number], { kind: 'choice' }>;
    expect(pick).toMatchObject({ n: 2, q: 'Pick?', cols: 2 });
    expect(pick.options.map((o) => o.fill)).toEqual([false, false, true]);
    expect((items[4] as { cols: number }).cols).toBe(2);
  });

  it('keeps the studio’s branding questionnaire word for word, numbered 1–22', () => {
    const qs = questionsOf(branding.brief);
    expect(qs).toHaveLength(22);
    expect(qs[0].q).toBe('What is your business/organization name?');
    expect(qs[11].q).toBe('Are there any specific elements you want included in your logo? (e.g., specific shapes, symbols, icons) Can you give me 3-5?');
    const files = qs.find((x) => x.q === 'What file formats do you require?');
    expect(files).toMatchObject({ kind: 'choice', cols: 4 });
    const style = qs.find((x) => x.q.startsWith('What style/mood'));
    expect(style).toMatchObject({ kind: 'choice', cols: 2 });
  });

  it('gives every template a questionnaire with sections and tick boxes', () => {
    for (const t of SEED_TEMPLATES) {
      const items = parseQuestionnaire(t.brief);
      expect(items.some((i) => i.kind === 'section'), t.id).toBe(true);
      expect(items.some((i) => i.kind === 'choice'), t.id).toBe(true);
      expect(questionsOf(t.brief).length, t.id).toBeGreaterThanOrEqual(10);
      expect(new Set(questionsOf(t.brief).map((x) => x.q)).size, `${t.id} repeats a question`).toBe(questionsOf(t.brief).length);
    }
  });

  it('records answers and ticks, and keeps answers to questions no longer asked', () => {
    let a = setAnswer([], 'What industry/field are you in?', { a: 'Coffee' });
    a = setAnswer(a, 'What file formats do you require?', { picks: ['PNG', 'PDF'] });
    a = setAnswer(a, 'An old question?', { a: 'Old answer' });
    expect(answeredCount(branding.brief, a)).toEqual({ done: 2, total: 22 });
    expect(earlierAnswers(branding.brief, a).map((x) => x.q)).toEqual(['An old question?']);
  });
});

describe('contract schedule', () => {
  it('reads package turnarounds', () => {
    expect(turnaroundDays('7–14 days')).toBe(14);
    expect(turnaroundDays('2–3 weeks')).toBe(21);
    expect(turnaroundDays('1 month')).toBe(30);
    expect(turnaroundDays('10 business days')).toBe(14);
    expect(turnaroundDays('')).toBeNull();
  });

  const pkgs = [
    { id: 'p', kind: 'design', turnaround: '7–14 days', includes: ['3 logo concepts', 'PNG files'], name: 'Essential' },
    { id: 'r', kind: 'addon', turnaround: '3–5 days', includes: [], name: 'Rush' },
  ] as unknown as Package[];
  const items: ProposalItem[] = [
    { packageId: 'p', label: 'Essential Branding', qty: 1, unitPrice: 350000, unit: 'project', months: 1, base: true },
    { packageId: 'r', label: 'Rush', qty: 1, unitPrice: 2500, unit: 'percent', months: 1 },
  ];

  it('finishes when the package turnaround says, or within 5 days on rush', () => {
    expect(projectDays(items, pkgs)).toBe(14);
    expect(completionDate('2026-10-26', items, pkgs)).toBe('2026-11-09');
    expect(completionDate('2026-10-26', items, pkgs, true)).toBe('2026-10-31');
    expect(completionDate('', items, pkgs)).toBe('');
  });

  it('spreads one milestone per phase and ends on the finish date', () => {
    const m = planMilestones(branding.phases, '2026-10-26', '2026-11-09');
    expect(m).toHaveLength(5);
    expect(m[4]).toMatchObject({ date: '2026-11-09', what: 'Final files, after full payment' });
    expect(m.map((x) => x.date)).toEqual([...m.map((x) => x.date)].sort());
    expect(planMilestones(branding.phases, '', '').every((x) => x.date === '')).toBe(true);
  });

  it('lists what the client receives from the chosen packages', () => {
    expect(deliverablesOf(items, pkgs)).toEqual(['3 logo concepts', 'PNG files']);
  });

  it('uses business prices on universal templates for business clients', () => {
    expect(contractAudience(undefined, 'any', 'business')).toBe('business');
    expect(contractAudience(undefined, 'any', 'student')).toBe('student');
    expect(contractAudience('', 'student', 'business')).toBe('student');
    expect(contractAudience('business', 'student', 'student')).toBe('business');
  });
});

describe('template upgrade', () => {
  const v1 = (id: string) => ({ id, brief: V1.briefs[id], briefTitle: id.startsWith('tpl-branding') ? 'Branding Questionnaire' : 'Project Brief', sections: V1.sections, agreement: V1.agreement });

  it('moves untouched templates to the new questionnaire, terms and agreement', () => {
    const latest = SEED_TEMPLATES.find((t) => t.id === 'tpl-event-business')!;
    const r = upgradeTemplate(v1('tpl-event-business'), latest);
    expect(r.edited).toEqual([]);
    expect(r.patch).toMatchObject({ brief: latest.brief, briefTitle: 'Event & Publication Questionnaire', sections: STANDARD_TERMS, agreement: latest.agreement });
  });

  it('keeps parts the studio edited', () => {
    const stored = { ...v1('tpl-branding-business'), brief: ['Our own question?'], sections: V1.sections.map((s, i) => (i ? s : { ...s, body: `${s.body}\nOur own rule.` })) };
    const r = upgradeTemplate(stored, branding);
    expect(r.edited).toEqual(['questionnaire', 'terms']);
    expect(r.patch.brief).toBeUndefined();
    expect(r.patch.sections).toBeUndefined();
    expect(r.patch.agreement).toEqual(branding.agreement);
  });

  it('leaves templates that are already current alone', () => {
    expect(upgradeTemplate(branding, branding)).toEqual({ patch: {}, edited: [] });
  });
});

describe('client links', () => {
  const base = {
    id: 'c1', number: 'C-2026-001', clientId: null, proposalId: null, packageId: null, status: 'sent', fields: { 'client.name': 'Kape Ilonggo', signer: '' }, sections: [], signedAt: null, notes: 'studio only',
    templateId: 'tpl-branding-business', brief: [{ q: 'What industry/field are you in?', a: '' }], createdAt: 1, updatedAt: 1, deleted: 0,
    link: { token: 't1', kind: 'sign', status: 'open', url: 'https://x/#/c?d=…', createdAt: 1, expiresAt: 2 },
  } as unknown as Contract;

  it('merges answers and ticks, and a signature signs the contract', () => {
    const r = { answers: [{ q: 'What industry/field are you in?', a: 'Coffee' }, { q: 'What file formats do you require?', a: '', picks: ['PNG', 'PDF'] }], name: 'Ana Reyes', signature: 'data:image/png;base64,AAA', agreed: true, device: 'phone' };
    const next = applyLinkResponse(base, 'sign', r, 1000);
    expect(next.brief).toEqual([{ q: 'What industry/field are you in?', a: 'Coffee' }, { q: 'What file formats do you require?', a: '', picks: ['PNG', 'PDF'] }]);
    expect(next).toMatchObject({ status: 'signed', signedAt: 1000, clientSignature: 'data:image/png;base64,AAA', signedOnline: { name: 'Ana Reyes', at: 1000, device: 'phone' } });
    expect(next.fields.signer).toBe('Ana Reyes');
    expect(next.link).toMatchObject({ status: 'applied', respondedAt: 1000 });
  });

  it('a questionnaire answer never signs', () => {
    const next = applyLinkResponse(base, 'questionnaire', { answers: [], name: 'X', signature: 'data:image/png;base64,AAA' }, 1000);
    expect(next.status).toBe('sent');
    expect(next.clientSignature).toBeUndefined();
  });

  it('shares only what the client should see', () => {
    const tpl = SEED_TEMPLATES[0] as unknown as ContractTemplate;
    const pkgs = [{ id: 'a', active: 1, category: 'Branding' }, { id: 'b', active: 1, category: 'Merch' }, { id: 'c', active: 0, category: 'Branding' }] as unknown as Package[];
    const methods = [
      { id: 'g', label: 'GCash', accountName: 'J. Ranin', accountNumber: '0917 000 0000', qrImage: 'data:image/png;base64,AAA', on: true },
      { id: 'u', label: 'UnionBank', accountName: 'J. Ranin', accountNumber: '1093 2701', qrImage: '', on: true },
    ];
    const s = linkSnapshot({ contract: { ...base, clientSignature: 'x', _sync: 1 } as Contract, template: tpl, business: {} as never, payMethods: methods, packages: pkgs, audience: 'business', payments: [{ kind: 'down', amount: 1 } as never] });
    // Payment methods travel as QR codes only.
    expect(s.payMethods).toEqual([{ id: 'g', label: 'GCash', accountName: '', accountNumber: '', qrImage: 'data:image/png;base64,AAA', on: true }]);
    expect(JSON.stringify(s)).not.toContain('0917');
    expect(s.packages.map((p) => p.id)).toEqual(['a']);
    expect(s.contract.notes).toBe('');
    expect(s.contract).not.toHaveProperty('link');
    expect(s.contract).not.toHaveProperty('clientSignature');
    expect(s.contract).not.toHaveProperty('_sync');
    expect(s.payments).toEqual([{ kind: 'down' }]);
  });

  it('stays open a week past the prices, at least three days', () => {
    const now = Date.parse('2026-10-21T10:00:00+08:00');
    expect(linkExpiry('2026-11-04', now)).toBeGreaterThan(Date.parse('2026-11-11T00:00:00+08:00'));
    expect(linkExpiry('', now)).toBe(now + 30 * 86_400_000);
    expect(linkExpiry('2026-01-01', now)).toBe(now + 3 * 86_400_000);
  });
});

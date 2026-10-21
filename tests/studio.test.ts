import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { workbook } from './workbook';
import { alive, db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { setActor, setWriterDevice } from '../src/db/write';
import { getSetting } from '../src/db/settings';
import { readXlsx } from '../src/domain/xlsx';
import { excelDate, money, parseTracker, percent, trackerPayments, type TrackerImport } from '../src/domain/tracker';
import {
  birReturns, duplicateNumbers, earningsForJob, invoiceTotals, jobBalance, nextBirReturn, nextDocNumber, parseDocNo, payoutSummary, sharesOfNet, unsplitJobs,
} from '../src/domain/money';
import { CATEGORIES, SEED_PACKAGES } from '../src/domain/packages';
import { SEED_TEMPLATES } from '../src/domain/contractTemplates';
import { normalizeStage } from '../src/domain/clients';
import { docTotals } from '../src/domain/pricing';
import { runSetup } from '../src/services/setup';
import { applyTracker, previewTracker, DEFAULT_TRACKER_OPTIONS } from '../src/services/importTracker';
import { newJob } from '../src/services/jobs';
import { savePayment, saveJobMoney } from '../src/services/money';
import { toCents } from '../src/lib/money';
import type { Earning, Payment, Payout } from '../src/db/types';

const pay = (id: string, amount: number, date: string, extra: Partial<Payment> = {}): Payment =>
  ({ id, jobId: 'j1', invoiceId: null, clientId: null, amount: toCents(amount), date, method: 'GCash', reference: '', kind: 'partial', receiptNo: '', note: '', createdAt: 1, updatedAt: 1, deleted: 0, ...extra }) as Payment;

describe('designer pay', () => {
  it('releases each share as the client pays, after the deduction', () => {
    const money = { deductionPct: 5, split: [{ memberId: 'josh', pct: 60 }, { memberId: 'kaye', pct: 40 }] };
    const rows = earningsForJob('j1', money, [pay('p1', 1750, '2026-10-21'), pay('p2', 1750, '2026-11-02')]);
    const by = (m: string) => rows.filter((r) => r.memberId === m).reduce((a, r) => a + r.amount, 0);
    // ₱3,500 less 5% = ₱3,325: 60/40.
    expect(by('josh')).toBe(toCents(1995));
    expect(by('kaye')).toBe(toCents(1330));
    expect(rows.map((r) => r.id)).toContain('p1:josh');
    // The first payment released half.
    expect(rows.filter((r) => r.paymentId === 'p1').reduce((a, r) => a + r.amount, 0)).toBe(toCents(1662.5));
  });

  it('never loses or adds a centavo, even with awkward splits', () => {
    const split = [
      { memberId: 'a', pct: 47.4 },
      { memberId: 'b', pct: 12.3 },
      { memberId: 'c', pct: 20 },
      { memberId: 'd', pct: 12.3 },
      { memberId: 'e', pct: 8 },
    ];
    for (const net of [toCents(50160), 1, 99, toCents(1234.57)]) {
      const shares = sharesOfNet(net, split);
      expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(net);
    }
    const rows = earningsForJob('j1', { deductionPct: 5, split }, [pay('p1', 30000, '2026-10-01'), pay('p2', 22800, '2026-11-01')]);
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(toCents(50160));
  });

  it('takes shares back on a refund and leaves an under-100% split with the studio', () => {
    const money = { deductionPct: 0, split: [{ memberId: 'a', pct: 50 }] };
    const rows = earningsForJob('j1', money, [pay('p1', 1000, '2026-10-01'), pay('p2', -400, '2026-10-02')]);
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(toCents(300));
  });

  it('works out what is owed', () => {
    const earnings = [{ memberId: 'a', amount: 1000 }, { memberId: 'a', amount: 500 }, { memberId: 'b', amount: 200 }] as Earning[];
    const payouts = [{ memberId: 'a', amount: 1200 }] as Payout[];
    const s = payoutSummary(earnings, payouts);
    expect(s.get('a')).toEqual({ earned: 1500, paid: 1200, owed: 300 });
    expect(s.get('b')?.owed).toBe(200);
  });

  it('flags paid jobs with no split', () => {
    const m = new Map([['j1', { split: [], deductionPct: 5 }], ['j2', { split: [{ memberId: 'a', pct: 100 }], deductionPct: 5 }]]);
    const out = unsplitJobs(m, [pay('p1', 1000, '2026-10-01'), pay('p2', 500, '2026-10-01', { jobId: 'j2' })]);
    expect(out).toEqual([{ jobId: 'j1', net: toCents(950) }]);
  });
});

describe('invoices and numbers', () => {
  const inv = { items: [{ label: 'Essential Branding', qty: 1, amount: toCents(3500), addOn: false }, { label: 'Rush', qty: 1, amount: toCents(875), addOn: true }], discountAmount: toCents(375), paidManual: 0, dueDate: '2026-11-05', jobId: 'j1', status: 'sent' as const };

  it('totals, part payments and overdue', () => {
    const t = invoiceTotals(inv, [pay('p1', 2000, '2026-10-21')], '2026-10-21');
    expect(t).toMatchObject({ subtotal: toCents(3500), addOns: toCents(875), discount: toCents(375), total: toCents(4000), paid: toCents(2000), balance: toCents(2000), state: 'partial', overdue: false });
    expect(invoiceTotals(inv, [pay('p1', 2000, '2026-10-21')], '2026-11-06').overdue).toBe(true);
    expect(invoiceTotals(inv, [pay('p1', 4000, '2026-10-21')], '2026-11-06')).toMatchObject({ state: 'paid', overdue: false, balance: 0 });
    expect(invoiceTotals({ ...inv, status: 'void' }, [], '2026-12-01').overdue).toBe(false);
  });

  it('continues JW numbering past the highest used, per year', () => {
    expect(parseDocNo('JW-0031-2026')).toEqual({ n: 31, year: 2026 });
    expect(parseDocNo('JW-000021_-2026')).toEqual({ n: 21, year: 2026 });
    expect(nextDocNumber('JW', 32, 2026, ['JW-0021-2026', 'JW-0031-2026'])).toBe('JW-0032-2026');
    expect(nextDocNumber('JW', 32, 2026, ['JW-0040-2026'])).toBe('JW-0041-2026');
    expect(nextDocNumber('JW', 1, 2027, ['JW-0040-2026'])).toBe('JW-0001-2027');
    expect(duplicateNumbers(['JW-0024-2026', 'JW-24-2026', 'JW-0025-2026'])).toHaveLength(1);
  });

  it('job balance states', () => {
    expect(jobBalance({ total: toCents(1000) }, []).state).toBe('unpaid');
    expect(jobBalance({ total: toCents(1000) }, [pay('p', 400, '2026-10-01')])).toMatchObject({ state: 'partial', balance: toCents(600) });
    expect(jobBalance({ total: 0 }, []).state).toBe('unpriced');
  });

  it('percent add-ons work on the package price', () => {
    const t = docTotals(
      [
        { packageId: 'p', label: 'Essential Branding', qty: 1, unitPrice: toCents(3500), unit: 'project', months: 1, base: true },
        { packageId: 'r', label: 'Rush', qty: 1, unitPrice: 2500, unit: 'percent', months: 1 },
        { packageId: 'x', label: 'Extra revision round', qty: 2, unitPrice: 1500, unit: 'percent', months: 1 },
      ],
      0,
    );
    // 3,500 + 25% (875) + 2 × 15% (1,050)
    expect(t.net).toBe(toCents(5425));
  });
});

describe('BIR (8% option)', () => {
  const bir = { startDate: '2026-11-16', eightPct: true, exemption: toCents(250000), vatCeiling: toCents(3000000) };
  it('taxes receipts above ₱250,000 a year, less earlier quarters and 2307s', () => {
    const payments = [pay('a', 200000, '2027-02-01'), pay('b', 150000, '2027-05-01'), pay('c', 50000, '2027-08-01'), pay('old', 99999, '2026-10-01')];
    const r = birReturns(2027, payments, [{ date: '2027-05-01', amount: toCents(1000) }], bir);
    expect(r.map((x) => x.label)).toEqual(['Q1 2027', 'Q2 2027', 'Q3 2027', 'Annual 2027']);
    expect(r[0].payable).toBe(0);
    // Q2: 8% of (350,000 − 250,000) = 8,000, less 1,000 withheld.
    expect(r[1].payable).toBe(toCents(7000));
    // Q3: 8% of 150,000 = 12,000 − 1,000 − 7,000 paid in Q2.
    expect(r[2].payable).toBe(toCents(4000));
    // Receipts before registration don't count.
    expect(birReturns(2026, payments, [], bir).map((x) => x.label)).toEqual(['Annual 2026']);
  });
  it('names the next return to file', () => {
    expect(nextBirReturn([], [], bir, '2027-01-10')?.label).toBe('Annual 2026');
    expect(nextBirReturn([], [], bir, '2027-04-20')?.label).toBe('Q1 2027');
    expect(nextBirReturn([], [], bir, '2026-10-21')).toBeNull();
  });
});

describe('price list and contract templates', () => {
  it('has unique ids, sections and sane prices', () => {
    const ids = SEED_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SEED_PACKAGES) {
      expect(p.price, p.id).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(p.category);
      if (p.studentPrice) expect(p.studentPrice, p.id).toBeLessThanOrEqual(p.price);
    }
  });
  it('every template points at real sections and has its terms', () => {
    expect(SEED_TEMPLATES.length).toBe(13);
    const tplIds = SEED_TEMPLATES.map((t) => t.id);
    expect(new Set(tplIds).size).toBe(tplIds.length);
    for (const t of SEED_TEMPLATES) {
      for (const c of t.categories) expect(CATEGORIES, `${t.id} → ${c}`).toContain(c);
      expect(t.sections.length, t.id).toBeGreaterThanOrEqual(10);
      expect(t.phases.length, t.id).toBeGreaterThan(0);
    }
  });
  it('moves old SMM pipeline stages to the general ones', () => {
    expect(normalizeStage('lead')).toBe('inquiry');
    expect(normalizeStage('proposal')).toBe('quoted');
    expect(normalizeStage('onboarding')).toBe('booked');
    expect(normalizeStage('paused')).toBe('active');
    expect(normalizeStage('ended')).toBe('completed');
    expect(normalizeStage('booked')).toBe('booked');
    expect(normalizeStage(undefined)).toBe('inquiry');
  });
});

// ----- the commission tracker -----

const MAIN_HEAD = ['Task', 'Commission Type', 'Total Amount', 'Initial Payment', 'Final Payment', 'Current Amount', 'Remaining Balance', 'Priority', 'Client Name', 'Client Email', 'Status', 'Start date', 'End date', 'Actual Completion', 'Rush Service', 'Payment Method', 'Notes', 'Date Created', 'Project ID', 'RankHelper', 'Initial Paid On', 'Final Paid On', 'Invoice No.', 'Tax Withheld (₱)', '2307 Received?', 'BIR Check (auto)'];
const DES_HEAD = ['Project ID', 'Client Name', 'Task / Project', 'Total Amount (₱)', 'Deduction %', 'Deduction (₱)', 'Net Payable (₱)', 'Ana %', 'Ben %', '% Check'];

function sampleTracker(): Uint8Array {
  return workbook([
    {
      name: 'Main Commission Tracker',
      rows: [
        MAIN_HEAD,
        // 46036 = Jan 14, 2026
        ['Cafe logo', 'Branding', 4750, 2100, 2650, 4750, 0, 'Med', 'Sample Client', 'Client@Example.com', 'Completed', 46036, 46042, 46040, 'No', 'GCash', '', 46034, 'COM-001'],
        ['School map', 'General', 18000, 12000, '', 12000, 6000, 'High', 'Org Rep', '', 'In progress', 46205, '', '', 'Yes', 'Mari Bank', 'Second half on delivery', 46203, 'COM-002', '', 46210],
        ['Signage', 'General', '', '', '', '', '', '', 'Sample Client', '', 'Blocked', 46095, '', '', '', '', '', '', 'COM-003'],
        ['', '', 0, '', '', 0, 0, '', '', '', '', '', '', '', '', '', '', '', 'COM-004'],
      ],
    },
    {
      name: 'Payment Designation',
      rows: [
        ['PAYMENT DESIGNATION'],
        ['Standard Deduction / Processing Fee %:', '', '', 0.05],
        [],
        [],
        DES_HEAD,
        ['COM-002', 'Org Rep', 'School map', 18000, 0.05, 900, 17100, 0.6, 0.4, 1],
        ['COM-002', 'Org Rep', 'School map', 18000, 0.05, 900, 17100, 0.8, 0.2, 1],
        ['COM-001', 'Sample Client', 'Cafe logo', 4750, '', 0, 4750, 1, 0, 1],
      ],
    },
    {
      name: 'Monthly Summary',
      rows: [
        ['MONTHLY SUMMARY'],
        ['All-Time Total Net Revenue:', '', '', 1, '', '', '', '', '', '', '', '', 'Big project from:', '', 15000],
        [],
        ['Month / Year', 'Total Revenue (Net ₱)', '', '', '', '', '', '', '', '', '', '', 'Target Low (₱)', 'Target High (₱)'],
        [46327, 0, '', '', '', '', '', '', '', '', '', '', 25000, 40000],
        [46357, 0, '', '', '', '', '', '', '', '', '', '', 30000, 50000],
      ],
    },
    {
      name: 'BIR',
      rows: [['BIR – 8% INCOME TAX TRACKING'], [], [], ['Settings (change once)'], ['BIR start date', 46342], ['Income tax rate (8% option)', 0.08], ['Tax-free receipts per year (₱)', 250000], ['Non-VAT ceiling per year (₱)', 3000000]],
    },
  ]);
}

describe('commission tracker', () => {
  it('reads dates, money and percents the way the sheet shows them', () => {
    expect(excelDate('46036')).toBe('2026-01-14');
    expect(excelDate('46342')).toBe('2026-11-16');
    expect(excelDate('')).toBe('');
    expect(money('₱4,750.50')).toBe(475050);
    expect(percent('0.55')).toBe(55);
    expect(percent('0.474')).toBe(47.4);
    expect(percent('1')).toBe(100);
    expect(percent('5%')).toBe(5);
  });

  it('parses jobs, splits, targets and BIR settings', () => {
    const t = parseTracker(readXlsx(sampleTracker()));
    expect(t.jobs.map((j) => j.number)).toEqual(['COM-001', 'COM-002', 'COM-003']);
    const [a, b] = t.jobs;
    expect(a).toMatchObject({ title: 'Cafe logo', type: 'Branding', total: toCents(4750), initial: toCents(2100), final: toCents(2650), clientEmail: 'client@example.com', status: 'completed', startDate: '2026-01-14', completedOn: '2026-01-18', method: 'GCash' });
    expect(b).toMatchObject({ status: 'in-progress', priority: 'high', rush: true, method: 'Mari Bank', initialOn: '2026-07-07' });
    expect(t.people).toEqual(['Ana', 'Ben']);
    // COM-002 is in Payment Designation twice: the later row wins, with a warning.
    expect(t.splits.get('COM-002')?.shares).toEqual([{ name: 'Ana', pct: 80 }, { name: 'Ben', pct: 20 }]);
    expect(t.splits.get('COM-002')?.deductionPct).toBe(5);
    expect(t.splits.get('COM-001')?.deductionPct).toBe(0);
    expect(t.warnings.some((w) => /COM-002 has two rows/.test(w))).toBe(true);
    expect(t.targets).toEqual([{ month: '2026-11', low: toCents(25000), high: toCents(40000) }, { month: '2026-12', low: toCents(30000), high: toCents(50000) }]);
    expect(t.bigProject).toBe(toCents(15000));
    expect(t.bir).toEqual({ startDate: '2026-11-16', eightPct: true, exemption: toCents(250000), vatCeiling: toCents(3000000) });
  });

  it('dates payments from the paid-on columns, or the job dates', () => {
    const t = parseTracker(readXlsx(sampleTracker()));
    expect(trackerPayments(t.jobs[0], '2026-10-21')).toEqual([
      { key: 'initial', amount: toCents(2100), date: '2026-01-14', guessed: true },
      { key: 'final', amount: toCents(2650), date: '2026-01-18', guessed: true },
    ]);
    expect(trackerPayments(t.jobs[1], '2026-10-21')).toEqual([{ key: 'initial', amount: toCents(12000), date: '2026-07-07', guessed: false }]);
  });

  it('refuses a workbook that is not the tracker', () => {
    expect(() => parseTracker(readXlsx(workbook([{ name: 'Sheet1', rows: [['a']] }])))).toThrow(/Main Commission Tracker/);
  });
});

describe('commission tracker import', () => {
  let t: TrackerImport;
  beforeEach(async () => {
    await db.delete();
    await db.open();
    const d = await ensureDevice();
    setWriterDevice(d.deviceId);
    const ownerId = await runSetup({ businessName: 'JoshWorks', ownerName: 'Ana Cruz', ownerRole: 'Head Designer', pin: '', deviceName: 'Laptop', seedPackages: false });
    setActor(ownerId);
    t = parseTracker(readXlsx(sampleTracker()));
  });

  it('previews, imports, and imports again without duplicates', async () => {
    const pv = await previewTracker(t, DEFAULT_TRACKER_OPTIONS);
    expect(pv.newJobs).toBe(3);
    expect(pv.payments).toBe(3);
    expect(pv.people).toEqual([
      { name: 'Ana', memberName: 'Ana Cruz', isNew: false },
      { name: 'Ben', memberName: 'Ben', isNew: true },
    ]);
    expect(pv.newClients).toEqual(['Sample Client', 'Org Rep']);
    expect(pv.nextJobNumber).toBe('COM-004');
    // Ana: COM-001 (100%, no deduction) 4,750 + COM-002 80% of 12,000 less 5% = 9,120.
    expect(pv.settle).toEqual([
      { name: 'Ana', amount: toCents(4750 + 9120) },
      { name: 'Ben', amount: toCents(2280) },
    ]);

    const s1 = await applyTracker(t, DEFAULT_TRACKER_OPTIONS);
    expect(s1).toMatchObject({ jobs: 3, payments: 3, members: 1, clients: 2 });
    const jobs = alive(await db.jobs.toArray());
    expect(jobs.map((j) => j.id).sort()).toEqual(['tracker-COM-001', 'tracker-COM-002', 'tracker-COM-003']);
    const ben = alive(await db.members.toArray()).find((m) => m.name === 'Ben')!;
    const earnings = alive(await db.earnings.toArray());
    expect(earnings.filter((e) => e.memberId === ben.id).reduce((a, e) => a + e.amount, 0)).toBe(toCents(2280));
    // Past work is marked as paid out, so nobody shows as owed for it.
    const owed = payoutSummary(earnings, alive(await db.payouts.toArray()));
    for (const v of owed.values()) expect(v.owed).toBe(0);
    expect((await getSetting('money')).targets.find((x) => x.month === '2026-11')?.low).toBe(toCents(25000));
    expect((await getSetting('bir')).startDate).toBe('2026-11-16');
    const clients = alive(await db.clients.toArray());
    expect(clients.find((c) => c.name === 'Sample Client')).toMatchObject({ email: 'client@example.com', stage: 'completed' });

    // A payment recorded in the app afterwards stays owed, and a re-import changes nothing.
    await savePayment({ jobId: 'tracker-COM-002', amount: toCents(6000), date: '2026-10-21', method: 'GCash', kind: 'final' });
    const s2 = await applyTracker(t, DEFAULT_TRACKER_OPTIONS);
    expect(s2.jobs).toBe(3);
    expect(alive(await db.jobs.toArray())).toHaveLength(3);
    expect(alive(await db.payments.toArray())).toHaveLength(4);
    const after = payoutSummary(alive(await db.earnings.toArray()), alive(await db.payouts.toArray()));
    expect(after.get(ben.id)?.owed).toBe(toCents(6000 * 0.95 * 0.2));
  });

  it('can leave unsplit jobs and past payouts alone', async () => {
    await applyTracker(t, { ...DEFAULT_TRACKER_OPTIONS, settlePast: false, ownerTakesUnsplit: false });
    expect(alive(await db.payouts.toArray())).toHaveLength(0);
    expect((await db.jobMoney.get('tracker-COM-003'))?.split).toEqual([]);
  });

  it('numbers new jobs after the imported ones', async () => {
    await applyTracker(t, DEFAULT_TRACKER_OPTIONS);
    const j = await newJob({ title: 'Next job' });
    expect(j.number).toBe('COM-004');
    await saveJobMoney(j.id, { total: toCents(1000) });
  });
});

// The owner's real workbooks go in private/ (git-ignored, never committed); CI skips these.
const REAL = 'private/JOSHWORK_COMMISSION_TRACKER_2.xlsx';
describe.skipIf(!existsSync(REAL))('the real commission tracker', () => {
  let t: TrackerImport;
  beforeAll(() => {
    t = parseTracker(readXlsx(new Uint8Array(readFileSync(REAL))));
  });
  it('reads every job, the splits and the BIR start', () => {
    expect(t.jobs.length).toBeGreaterThanOrEqual(40);
    const j5 = t.jobs.find((j) => j.number === 'COM-005')!;
    expect(j5.total - j5.initial - j5.final).toBe(toCents(18000));
    expect(t.people).toHaveLength(5);
    expect(t.warnings.some((w) => /COM-026 has two rows/.test(w))).toBe(true);
    expect(t.bir.startDate).toBe('2026-11-16');
    expect(t.targets.find((x) => x.month === '2026-11')).toEqual({ month: '2026-11', low: toCents(25000), high: toCents(40000) });
  });
});

// ----- the Nov 2026 – Jun 2027 content planner -----

function newPlanner(): Uint8Array {
  return workbook([
    {
      name: 'Content Calendar',
      rows: [
        ['Month', 'Week', 'Date', 'Day Theme', 'Assigned Designer', 'Content Title / Topic', 'Format', 'Notes / Brief', 'Status'],
        // 46335 = Mon, Nov 9 2026
        ['November', 'Week 2', 46335, 'MON - Educational', 'Renz', 'Vector vs Raster', 'Carousel', 'Zoom-in demo.', 'Not Started'],
        ['', '', 46336, 'TUE - Portfolio / Concept', 'Joshua', 'IYAS Branding', 'Carousel', '', 'Ready for Posting'],
        ['November', 'BREAK WEEK', 'Nov 30 - Dec 4', 'NO POSTING', 'All', 'Rest / batch-create', '-', 'Exam week + Bonifacio Day.'],
        ['January', 'Week 1', 46391, 'MON - Educational', 'Kaye', 'Rebrand signs', 'Carousel', '', 'Not Started'],
        ['BACKLOG - not scheduled yet'],
        ['', '', '', '', 'Joshua', 'LEAD - Branding', 'Carousel', 'Portfolio (COM-012).', 'Not Started'],
      ],
    },
  ]);
}

describe('the new content planner', () => {
  it('reads real date cells, break weeks and the backlog', async () => {
    const { parsePlanner } = await import('../src/domain/planner');
    const p = parsePlanner(readXlsx(newPlanner()));
    const posts = p.rows.filter((r) => r.kind === 'post');
    expect(posts.map((r) => [r.title, r.date])).toEqual([
      ['Vector vs Raster', '2026-11-09'],
      ['IYAS Branding', '2026-11-10'],
      ['Rebrand signs', '2027-01-04'],
      ['LEAD - Branding', null],
    ]);
    expect(p.rows.find((r) => r.kind === 'break')).toMatchObject({ date: '2026-11-30', end: '2026-12-04' });
    expect(p.start).toBe('2026-11-09');
  });

  it('replaces the older plan’s unposted posts and uses its break weeks', async () => {
    await db.delete();
    await db.open();
    setWriterDevice((await ensureDevice()).deviceId);
    setActor(await runSetup({ businessName: 'JoshWorks', ownerName: 'Joshua', ownerRole: 'Head Designer', pin: '', deviceName: 'Laptop', seedPackages: false }));
    const { parsePlanner } = await import('../src/domain/planner');
    const { applyPlanner, previewPlanner, planPrefix } = await import('../src/services/importPlanner');
    const { createPost } = await import('../src/services/content');
    // Two posts from the June plan (imported by an older version: ids planner-2026-r…), one already posted.
    await createPost({ id: 'planner-2026-r40', title: 'Old unposted', date: '2026-11-03', status: 'todo' } as never);
    await createPost({ id: 'planner-2026-r12', title: 'Old posted', date: '2026-07-01', status: 'posted' } as never);
    const p = parsePlanner(readXlsx(newPlanner()));
    expect(planPrefix(p)).toBe('planner-2026-11');
    const opts = { skipThroughRow: 0, restartOn: null, team: true, themes: true, scripts: true, ideas: true, concepts: true, metrics: true, snippets: true, breaks: true, replaceOld: true };
    const preview = await previewPlanner(p, opts);
    expect(preview.replaced).toBe(1);
    const sum = await applyPlanner(p, opts, preview);
    expect(sum).toMatchObject({ replaced: 1, posts: 3, backlog: 1 });
    const live = alive(await db.posts.toArray());
    expect(live.map((x) => x.title).sort()).toEqual(['IYAS Branding', 'LEAD - Branding', 'Old posted', 'Rebrand signs', 'Vector vs Raster']);
    expect(live.find((x) => x.title === 'IYAS Branding')?.status).toBe('ready');
    const cadence = await getSetting('cadence');
    expect(cadence.breakRule).toBe(false);
    expect(cadence.breaks).toContainEqual(expect.objectContaining({ start: '2026-11-30', end: '2026-12-04' }));
    // Importing again changes nothing.
    const again = await applyPlanner(p, opts, await previewPlanner(p, opts));
    expect(again).toMatchObject({ replaced: 0, posts: 0, alreadyThere: 4 });
  });
});

const NEW_PLANNER = 'private/JoshWorks_Content_Planner_Nov2026-Jun2027.xlsx';
describe.skipIf(!existsSync(NEW_PLANNER))('the real Nov 2026 – Jun 2027 planner', () => {
  it('has every dated post, the break weeks and the backlog', async () => {
    const { parsePlanner } = await import('../src/domain/planner');
    const p = parsePlanner(readXlsx(new Uint8Array(readFileSync(NEW_PLANNER))));
    const posts = p.rows.filter((r) => r.kind === 'post');
    expect(posts.filter((r) => r.date).length).toBeGreaterThanOrEqual(105);
    expect(posts.filter((r) => !r.date)).toHaveLength(8);
    expect(p.rows.filter((r) => r.kind === 'break')).toHaveLength(11);
    expect(p.start).toBe('2026-11-06');
    expect(posts.every((r) => !r.date || (r.date >= '2026-11-01' && r.date <= '2027-06-30'))).toBe(true);
  });
});

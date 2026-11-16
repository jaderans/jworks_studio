import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { alive, db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { setActor, setWriterDevice } from '../src/db/write';
import { getSetting, setSetting } from '../src/db/settings';
import { runSetup } from '../src/services/setup';
import { saveMember } from '../src/services/team';
import { savePayment } from '../src/services/money';
import { approvePrint, markProofSent, printBalance, savePrintOrder, setPrintStage, type PrintOrderInput } from '../src/services/print';
import {
  DEFAULT_PRINT_RATES as R, addWorkingDays, blankDelivery, illustrationLine, illustrationPrice, perSheet, printStage, printTotals, ratesFrom, sheetsLine, stickerFit,
} from '../src/domain/print';
import { payoutSummary } from '../src/domain/money';
import { toCents } from '../src/lib/money';
import { todayISO } from '../src/lib/time';

const P = toCents;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setWriterDevice((await ensureDevice()).deviceId);
});

describe('the sticker printing rate card in Studio', () => {
  it('is the POS rate card: Cricut’s A4 cut area, the corrected size guide, ₱130 and ₱250 illustration', () => {
    expect(R.cutArea).toEqual({ w: 7.2, h: 10.62, gapMm: 3 });
    expect(Object.fromEntries(R.stickerSizes.map((s) => [s.name, perSheet(R, s.w, s.h)]))).toEqual({
      '1 × 1 in': 54, '1.5 × 1.5 in': 24, '2 × 2 in': 15, '2.5 × 2.5 in': 8, '3 × 3 in': 6, '3.5 × 3.5 in': 4, '4 × 4 in': 2,
      '2 × 2.5 in': 12, '2 × 3 in': 10, '3 × 4 in': 4, '1 × 3 in strip': 18,
    });
    const [simple, detailed] = R.illustration.tiers;
    expect([1, 2, 5, 10].map((n) => illustrationPrice(simple, n).total)).toEqual([P(130), P(240), P(600), P(1150)]);
    expect([1, 2, 5, 10].map((n) => illustrationPrice(detailed, n).total)).toEqual([P(250), P(450), P(1100), P(2000)]);
  });

  it('counts a customer’s own size both ways round, and works out sheets from a sticker count', () => {
    expect(stickerFit(R.cutArea, 2.3, 1.7)).toEqual({ perA4: 16, across: 4, down: 4, rotated: true });
    expect(sheetsLine(R, 'prem-matte-glossy', 'die', 1, { w: 2.3, h: 1.7 }, 50)).toMatchObject({ qty: 4, unitPrice: P(90), stickers: 50, label: 'Premium Matte or Glossy, die cut · 2.3 × 1.7 in: 50 stickers, 64 fit on 4 sheets' });
  });

  it('takes a POS rate card saved before 1.15.0 and brings it up to date', () => {
    const r = ratesFrom({ ...R, ratesVersion: undefined, cutArea: undefined, stickerSizes: [{ name: '2 × 1.5 in', perA4: 12 }], illustration: { artistPct: 25, tiers: [{ ...R.illustration.tiers[0], price: P(100), sets: [] }] } });
    expect(r.cutArea).toEqual(R.cutArea);
    expect(r.stickerSizes).toEqual([{ name: '2 × 1.5 in', w: 2, h: 1.5 }]);
    expect(r.illustration).toMatchObject({ artistPct: 25, tiers: [{ price: P(130) }] });
  });

  it('works out the shares like the POS: the printer’s of the print work, the illustrator’s of the art, both after the coupon', () => {
    const t = printTotals(
      { lines: [sheetsLine(R, 'prem-matte-glossy', 'die', 5), illustrationLine(R, 'detailed', 2)], delivery: { ...blankDelivery(), method: 'courier', fee: P(120), address: 'Jaro' }, printerPct: 20, illustratorPct: 50, downPct: 50 },
      P(90),
    );
    // ₱450 print + ₱450 art = ₱900; the ₱90 coupon is ₱45 off each.
    expect(t).toMatchObject({ subtotal: P(900), discount: P(90), delivery: P(120), total: P(930), down: P(465), printerShare: P(81), illustratorShare: P(202.5), a4: 5 });
  });

  it('puts an order in its column from the job status and the hand-over', () => {
    expect(printStage('not-started', { doneAt: null })).toBe('quote');
    expect(printStage('in-progress', { doneAt: null })).toBe('making');
    expect(printStage('completed', { doneAt: null })).toBe('ready');
    expect(printStage('completed', { doneAt: 1 })).toBe('done');
    expect(printStage('cancelled', { doneAt: null })).toBe('cancelled');
  });
});

describe('sticker printing orders in Studio', () => {
  async function setup() {
    const ownerId = await runSetup({ businessName: 'JoshWorks', ownerName: 'Joshua', ownerRole: 'Brand, Logo & Shirt Design', pin: '', deviceName: 'Laptop', seedPackages: false });
    setActor(ownerId);
    const printer = await saveMember({ name: 'Ian Yap', email: 'ian@example.com', appRole: 'manager', roleLabel: 'Production' });
    const artist = await saveMember({ name: 'Kaye Dela Cruz', email: 'kaye@example.com', appRole: 'manager', roleLabel: 'Illustrator' });
    return { ownerId, printer, artist };
  }
  const order = (fields: Partial<PrintOrderInput> = {}): PrintOrderInput => ({
    clientId: null,
    clientName: 'Mira Bakeshop',
    contact: '0917 555 0101',
    lines: [sheetsLine(R, 'prem-matte-glossy', 'die', 5), illustrationLine(R, 'detailed', 2)],
    delivery: { ...blankDelivery(), method: 'courier', courier: 'J&T', fee: P(120), address: '12 Rizal St, Jaro' },
    printerId: null,
    printerPct: 20,
    illustratorId: null,
    illustratorPct: 50,
    designNo: 'cs07',
    files: 'https://drive.google.com/x',
    notes: '',
    ...fields,
  });

  it('books an order as a Sticker Printing job: the client, the price, exact shares, the courier as an expense', async () => {
    const { printer, artist } = await setup();
    const res = await savePrintOrder(null, order({ printerId: printer.id, illustratorId: artist.id }));
    expect(res.created).toBe(true);
    const job = (await db.jobs.get(res.jobId))!;
    expect(job).toMatchObject({ type: 'Sticker Printing', clientName: 'Mira Bakeshop', designers: [printer.id, artist.id], lead: printer.id, source: 'Sticker printing' });
    expect(job.title).toContain('Sticker printing: Premium Matte or Glossy, die cut');
    expect(job.brief).toContain('Design no. CS07');
    const client = (await db.clients.get(job.clientId!))!;
    expect(client).toMatchObject({ name: 'Mira Bakeshop', phone: '0917 555 0101', source: 'Sticker printing' });
    expect((await db.jobProgress.get(res.jobId))).toMatchObject({ status: 'not-started', links: [{ label: 'Design files', url: 'https://drive.google.com/x' }] });
    const money = (await db.jobMoney.get(res.jobId))!;
    // ₱450 print + ₱450 art + ₱120 courier
    expect(money).toMatchObject({ total: P(1020), deductionPct: 0, discountAmount: 0 });
    expect(money.items.map((i) => i.label)).toContain('Delivery (J&T)');
    expect(money.print).toMatchObject({ designNo: 'CS07', downPct: 50, printerPct: 20, illustratorPct: 50 });
    const expenses = alive(await db.expenses.toArray()).filter((x) => x.jobId === res.jobId);
    expect(expenses.map((x) => [x.category, x.amount])).toEqual([['Transport', P(120)]]);

    // Paid in two: the down payment, then the balance. Each earns exactly their share by the end.
    const b = await printBalance(res.jobId);
    expect(b).toMatchObject({ total: P(1020), paid: 0, down: P(510), downPaid: false });
    await savePayment({ jobId: res.jobId, amount: P(510), date: todayISO(), method: 'GCash', kind: 'down' });
    await savePayment({ jobId: res.jobId, amount: P(510), date: todayISO(), method: 'GCash', kind: 'final' });
    const owed = payoutSummary(alive(await db.earnings.toArray()), []);
    // Printer: 20% of ₱450 = ₱90. Illustrator: 50% of ₱450 = ₱225.
    expect(owed.get(printer.id)?.earned).toBe(P(90));
    expect(owed.get(artist.id)?.earned).toBe(P(225));
  });

  it('matches a saved client, follows the order through its columns, and won’t hand over with a balance', async () => {
    const { printer } = await setup();
    const first = await savePrintOrder(null, order({ printerId: printer.id }));
    const again = await savePrintOrder(null, order({ clientName: 'mira  bakeshop', contact: '' }));
    expect((await db.jobs.get(again.jobId))?.clientId).toBe((await db.jobs.get(first.jobId))?.clientId);
    expect(alive(await db.clients.toArray())).toHaveLength(1);

    await markProofSent(first.jobId);
    const due = await approvePrint(first.jobId);
    expect(due).toBe(addWorkingDays(todayISO(), R.leadDays.max));
    expect((await db.jobs.get(first.jobId))?.dueDate).toBe(due);
    expect((await db.jobMoney.get(first.jobId))?.print).toMatchObject({ proofAt: expect.any(Number), approvedAt: expect.any(Number) });
    await setPrintStage(first.jobId, 'making');
    expect((await db.jobProgress.get(first.jobId))?.status).toBe('in-progress');
    await setPrintStage(first.jobId, 'ready');
    expect((await db.jobProgress.get(first.jobId))).toMatchObject({ status: 'completed', completedOn: todayISO() });
    await expect(setPrintStage(first.jobId, 'done')).rejects.toThrow(/to pay/);
    await savePayment({ jobId: first.jobId, amount: P(1020), date: todayISO(), method: 'GCash', kind: 'full' });
    await setPrintStage(first.jobId, 'done');
    const money = (await db.jobMoney.get(first.jobId))!;
    expect(printStage((await db.jobProgress.get(first.jobId))!.status, money.print!)).toBe('done');
    // Reopening takes it back to Ready.
    await setPrintStage(first.jobId, 'ready');
    expect((await db.jobMoney.get(first.jobId))?.print?.doneAt).toBeNull();
  });

  it('updates the same job when the order changes; materials go on the job when the rate card has costs', async () => {
    await setup();
    const rates = await getSetting('printRates');
    await setSetting('printRates', { ...rates, materials: rates.materials.map((m) => (m.key === 'std-matte-glossy' ? { ...m, cost: P(30) } : m)) });
    const r2 = await getSetting('printRates');
    const res = await savePrintOrder(null, order({ lines: [sheetsLine(r2, 'std-matte-glossy', 'kiss', 3)] }));
    const id = res.jobId;
    expect(alive(await db.expenses.toArray()).filter((x) => x.jobId === id).map((x) => [x.category, x.amount]).sort()).toEqual([['Printing', P(90)], ['Transport', P(120)]]);
    // Pickup instead, and a sticker count: the courier expense goes, the materials follow the sheets.
    const again = await savePrintOrder(id, order({ lines: [sheetsLine(r2, 'std-matte-glossy', 'kiss', 1, '2 × 2 in', 50)], delivery: blankDelivery() }));
    expect(again).toMatchObject({ jobId: id, created: false });
    expect(alive(await db.jobs.toArray())).toHaveLength(1);
    // 50 stickers of 2 × 2 in: 15 a sheet, 4 sheets.
    expect((await db.jobMoney.get(id))).toMatchObject({ total: P(240) });
    expect(alive(await db.expenses.toArray()).filter((x) => x.jobId === id).map((x) => [x.category, x.amount])).toEqual([['Printing', P(120)]]);
  });

  it('needs who it’s for, what to make, and an address for the courier', async () => {
    await setup();
    await expect(savePrintOrder(null, order({ clientName: '' }))).rejects.toThrow(/who the order is for/);
    await expect(savePrintOrder(null, order({ lines: [] }))).rejects.toThrow(/what to make/);
    await expect(savePrintOrder(null, order({ delivery: { ...blankDelivery(), method: 'courier', address: '' } }))).rejects.toThrow(/delivery address/);
  });
});

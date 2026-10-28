import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { alive, db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { setActor, setWriterDevice } from '../src/db/write';
import { runSetup } from '../src/services/setup';
import { saveMember } from '../src/services/team';
import { payoutSummary, sharesOfNet } from '../src/domain/money';
import { defaultChoices, exactPct, parsePosFile, posImportState, type PosEventFeed, type PosOrderFeed } from '../src/domain/posFeed';
import { applyEventImport, applyOrderImport, readDevicePosFeeds } from '../src/services/importPos';

beforeEach(async () => {
  await db.delete();
  await db.open();
  if (await Dexie.exists('jworks-pos')) await Dexie.delete('jworks-pos');
  const d = await ensureDevice();
  setWriterDevice(d.deviceId);
});

async function setup() {
  const ownerId = await runSetup({ businessName: 'JoshWorks', ownerName: 'Joshua', ownerRole: 'Brand, Logo & Shirt Design', pin: '', deviceName: 'Laptop', seedPackages: false });
  setActor(ownerId);
  const ian = await saveMember({ name: 'Ian Harvey Yap', email: 'ian@example.com', appRole: 'designer', roleLabel: 'Illustrator' });
  return { ownerId, ian };
}

const event = (over: Partial<PosEventFeed> = {}): PosEventFeed => ({
  type: 'event', v: 1, eventId: 'ev1', name: 'Komiket Iloilo', venue: 'SM City', startDate: '2026-10-24', endDate: '2026-10-25', status: 'reported',
  business: 'JoshWorks', gross: 579_500, transactions: 50, itemsSold: 120, discounts: 0,
  methods: [
    { methodId: 'cash', name: 'Cash', kind: 'cash', amount: 349_500 },
    { methodId: 'gcash', name: 'GCash', kind: 'ewallet', amount: 230_000 },
  ],
  cogs: 120_000, cogsMissing: 0, boothFee: 200_000, supplies: 15_000,
  people: [
    { memberId: 'p-ian', name: 'Ian Yap', email: 'IAN@example.com', kind: 'staff', role: 'Production', amount: 45_033, paid: 45_033, paidAt: new Date('2026-10-26T10:00:00').getTime(), method: 'GCash' },
    { memberId: 'p-ian', name: 'Ian Yap', email: 'IAN@example.com', kind: 'royalty', role: 'Design royalty', amount: 667, paid: 0, paidAt: null, method: '' },
    { memberId: 'p-kaye', name: 'Kaye', email: '', kind: 'staff', role: 'Cashier', amount: 30_011, paid: 0, paidAt: null, method: '' },
    { memberId: 'p-nook', name: 'Nook Prints', email: '', kind: 'partner', role: 'Nook stickers 30%', amount: 20_000, paid: 0, paidAt: null, method: '' },
  ],
  tradingProfit: 0, joshworksNet: 0, depositsHeld: 0,
  ...over,
});

const order = (over: Partial<PosOrderFeed> = {}): PosOrderFeed => ({
  type: 'order', v: 1, orderId: 'o1', number: 'QA-07', eventId: 'ev1', eventName: 'Komiket Iloilo',
  customer: { name: 'Kaye Santos', email: 'kaye@example.com', phone: '0917', handle: '' },
  designer: { memberId: 'p-ian', name: 'Ian', email: 'ian@example.com' },
  lines: [{ name: 'Custom portrait', qty: 1, unitPrice: 50_000 }],
  total: 50_000, dueAt: '2026-10-31T15:00', status: 'new', createdAt: new Date('2026-10-24T13:00:00').getTime(),
  payments: [{ saleId: 's1', date: '2026-10-24', name: 'GCash', kind: 'ewallet', amount: 25_000, stage: 'deposit' }],
  notes: '',
  ...over,
});

describe('booth events from JoshWorks POS', () => {
  it('a split % that lands on the exact amount, every time', () => {
    for (let i = 0; i < 2000; i++) {
      const gross = 1 + Math.floor(Math.random() * 50_000_000);
      const amount = Math.floor(Math.random() * gross);
      const pct = exactPct(amount, gross);
      expect(Math.trunc((gross * pct) / 100)).toBe(amount);
    }
    // Several people at once, the way Studio splits a job
    const split = [{ memberId: 'a', pct: exactPct(45_700, 579_500) }, { memberId: 'b', pct: exactPct(30_011, 579_500) }];
    expect(sharesOfNet(579_500, split)).toEqual(new Map([['a', 45_700], ['b', 30_011]]));
  });

  it('reads what the POS on this device sent, without creating its database', async () => {
    expect(await readDevicePosFeeds()).toEqual({ found: false, feeds: [] });
    expect(await Dexie.exists('jworks-pos')).toBe(false);
    const pos = new Dexie('jworks-pos');
    pos.version(60).stores({ studioFeed: 'id, updatedAt', sales: 'id' });
    await pos.table('studioFeed').bulkPut([
      { id: 'event:ev1', feed: event(), sentBy: 'Joshua' },
      { id: 'event:old', feed: event({ eventId: 'old' }), deleted: 1 },
      { id: 'event:bad', feed: { type: 'event', v: 9 } },
    ]);
    pos.close();
    const read = await readDevicePosFeeds();
    expect(read.found).toBe(true);
    expect(read.feeds.map((f) => f.type === 'event' && f.eventId)).toEqual(['ev1']);
  });

  it('opens the POS file and refuses anything else', () => {
    const file = JSON.stringify({ app: 'jworks-pos', kind: 'studio-feed', v: 1, exportedAt: 1, feeds: [event(), order()] });
    expect(parsePosFile(file)).toHaveLength(2);
    expect(() => parsePosFile('{"hello":1}')).toThrow(/isn’t a JoshWorks POS file/);
    expect(() => parsePosFile('not json')).toThrow(/isn’t a JoshWorks POS file/);
  });

  it('an event becomes a job: payments add up to sales, shares match the POS to the centavo, costs are expenses', async () => {
    const { ian } = await setup();
    const feed = event();
    const choices = defaultChoices(feed, alive(await db.members.toArray()));
    expect(choices).toEqual({ 'staff:p-ian': ian.id, 'royalty:p-ian': ian.id, 'staff:p-kaye': 'expense', 'partner:p-nook': 'expense' });
    const { jobId, created } = await applyEventImport(feed, choices);
    expect(created).toBe(true);

    const job = (await db.jobs.get(jobId))!;
    expect(job).toMatchObject({ title: 'Booth: Komiket Iloilo', type: 'Pop-up / Stickers', source: 'JoshWorks POS', lead: ian.id });
    expect(posImportState(feed, job)).toBe('current');
    const payments = alive(await db.payments.where('jobId').equals(jobId).toArray());
    expect(payments.map((p) => [p.method, p.amount]).sort()).toEqual([['GCash', 230_000], ['On Hand', 349_500]]);
    // Ian earns his pay plus his royalty, exactly
    const earnings = alive(await db.earnings.where('jobId').equals(jobId).toArray());
    const summary = payoutSummary(earnings, alive(await db.payouts.toArray()));
    expect(summary.get(ian.id)).toEqual({ earned: 45_700, paid: 45_033, owed: 667 });
    const expenses = alive(await db.expenses.toArray()).filter((x) => x.jobId === jobId);
    expect(expenses.map((x) => [x.category, x.amount]).sort()).toEqual([
      ['Fees & permits', 200_000],
      ['Other', 15_000],
      ['Other', 20_000],
      ['Other', 30_011],
      ['Printing', 120_000],
    ]);
  });

  it('importing again updates in place; changes in the POS replace what changed', async () => {
    const { ian } = await setup();
    const members = alive(await db.members.toArray());
    await applyEventImport(event(), defaultChoices(event(), members));
    const count = async () => [await db.jobs.count(), alive(await db.payments.toArray()).length, alive(await db.expenses.toArray()).length, alive(await db.payouts.toArray()).length];
    const before = await count();
    await applyEventImport(event(), defaultChoices(event(), members));
    expect(await count()).toEqual(before);

    // Kaye leaves the roster and a late GCash sale comes in
    const next = event({ gross: 589_500, methods: [{ methodId: 'cash', name: 'Cash', kind: 'cash', amount: 349_500 }, { methodId: 'gcash', name: 'GCash', kind: 'ewallet', amount: 240_000 }], people: event().people.filter((p) => p.memberId !== 'p-kaye') });
    const job = (await db.jobs.get('pos-ev1'))!;
    expect(posImportState(next, job)).toBe('changed');
    await applyEventImport(next, defaultChoices(next, members));
    expect(alive(await db.expenses.toArray()).some((x) => x.vendor === 'Kaye')).toBe(false);
    expect(alive(await db.payments.toArray()).reduce((a, p) => a + p.amount, 0)).toBe(589_500);
    const earned = payoutSummary(alive(await db.earnings.toArray()), []).get(ian.id)?.earned;
    expect(earned).toBe(45_700);
  });

  it('a commission order becomes a client job with its deposit, then its final payment', async () => {
    const { ian } = await setup();
    const { jobId } = await applyOrderImport(order(), ian.id);
    const job = (await db.jobs.get(jobId))!;
    expect(job).toMatchObject({ title: 'Custom portrait', lead: ian.id, clientName: 'Kaye Santos', dueDate: '2026-10-31' });
    const client = (await db.clients.get(job.clientId!))!;
    expect(client).toMatchObject({ name: 'Kaye Santos', email: 'kaye@example.com', source: 'JoshWorks POS' });
    expect((await db.jobProgress.get(jobId))?.status).toBe('not-started');

    const done = order({ status: 'picked-up', payments: [...order().payments, { saleId: 's2', date: '2026-10-31', name: 'Cash', kind: 'cash', amount: 25_000, stage: 'pickup' }] });
    await applyOrderImport(done, ian.id);
    const pays = alive(await db.payments.where('jobId').equals(jobId).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    expect(pays.map((p) => [p.kind, p.method, p.amount])).toEqual([['down', 'GCash', 25_000], ['final', 'On Hand', 25_000]]);
    expect((await db.jobProgress.get(jobId))?.status).toBe('completed');
    expect(alive(await db.clients.toArray()).filter((c) => c.name === 'Kaye Santos')).toHaveLength(1);
  });
});

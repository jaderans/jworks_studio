import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { build, save, setWriterDevice } from '../src/db/write';
import { todayISO, addDays } from '../src/lib/time';
import { checkPosCoupon, posCouponOff, type PosCoupon, type PosCouponBatch } from '../src/domain/posCoupons';
import { checkCouponForJob } from '../src/services/posCoupons';
import type { Job, JobMoney } from '../src/db/types';

const today = todayISO();

beforeEach(async () => {
  await db.delete();
  await db.open();
  if (await Dexie.exists('jworks-pos')) await Dexie.delete('jworks-pos');
  setWriterDevice((await ensureDevice()).deviceId);
});

const batch = (b: Partial<PosCouponBatch> = {}): PosCouponBatch => ({
  id: 'b1', eventId: 'e1', name: 'Booth handout', kind: 'amount', value: 30_000, maxOff: 0, minSpend: 250_000, validFrom: addDays(today, -5), validTo: addDays(today, 55), mode: 'unique', maxUses: 1, active: 1, ...b,
});
const coupon = (c: Partial<PosCoupon> = {}): PosCoupon => ({ id: 'c1', code: 'KI26-7F3QX', batchId: 'b1', eventId: 'e1', void: 0, ...c });

/** A POS database on this device with one code, like JoshWorks POS keeps it. */
async function seedPos(claims: { id: string; couponId: string; service: string; customerName: string }[] = []) {
  const pos = new Dexie('jworks-pos');
  pos.version(8).stores({ coupons: 'id, code, batchId', couponBatches: 'id', couponClaims: 'id, couponId' });
  await pos.open();
  await pos.table('couponBatches').put(batch());
  await pos.table('coupons').put(coupon());
  if (claims.length) await pos.table('couponClaims').bulkPut(claims);
  pos.close();
}

async function job(id: string, couponCode?: string) {
  await save(db.jobs, build<Job>({ id, number: 'COM-012', title: 'Logo', type: 'Branding', clientId: null, clientName: 'Kape Uno', priority: 'med', startDate: today, dueDate: '', rush: false, designers: [], lead: null, revisionsIncluded: 2, brief: '', source: '', budgetNote: '' }));
  await save(db.jobMoney, build<JobMoney>({ id, total: 470_000, items: [], discountAmount: couponCode ? 30_000 : 0, deductionPct: 5, split: [], taxWithheld: 0, form2307: 'na', invoiceNo: '', notes: '', couponCode }));
}

describe('JoshWorks POS service coupons on Studio jobs', () => {
  it('follow the POS rules: dates, the ₱2,500 minimum and single use', () => {
    const data = { coupons: [coupon()], batches: [batch()], uses: [] };
    const ctx = { today, price: 500_000, jobId: 'j1' };
    expect(checkPosCoupon('ki26-7f3qx', data, ctx)).toMatchObject({ ok: true, discount: 30_000, code: 'KI26-7F3QX' });
    expect(checkPosCoupon('KI26-7F3QX', data, { ...ctx, price: 200_000 })).toMatchObject({ ok: false, reason: expect.stringMatching(/₱2,500 or more/) });
    expect(checkPosCoupon('KI26-7F3QX', { ...data, batches: [batch({ validTo: addDays(today, -1) })] }, ctx)).toMatchObject({ ok: false, reason: expect.stringMatching(/expired/) });
    const used = { ...data, uses: [{ key: 'print:p1', couponId: 'c1', service: 'Print order PA-001', customerName: 'Mira' }] };
    expect(checkPosCoupon('KI26-7F3QX', used, ctx)).toMatchObject({ ok: false, reason: 'KI26-7F3QX was already used by Mira (Print order PA-001).' });
    // The job that holds it keeps it.
    const held = { ...data, uses: [{ key: 'studio:j1', couponId: 'c1', service: 'Studio job COM-012', customerName: 'Kape Uno' }] };
    expect(checkPosCoupon('KI26-7F3QX', held, { ...ctx, today: addDays(today, 90) }).ok).toBe(true);
    expect(posCouponOff(batch({ kind: 'percent', value: 10, maxOff: 25_000 }), 500_000)).toBe(25_000);
  });

  it('are checked against the POS on this device and the other Studio jobs that hold the code', async () => {
    expect(await checkCouponForJob('KI26-7F3QX', 500_000, 'j1')).toMatchObject({ ok: false, offline: true });
    await seedPos();
    expect(await checkCouponForJob('KI26-7F3QX', 500_000, 'j1')).toMatchObject({ ok: true, couponId: 'c1', discount: 30_000 });
    // Another Studio job already took it.
    await job('j2', 'KI26-7F3QX');
    expect(await checkCouponForJob('KI26-7F3QX', 500_000, 'j1')).toMatchObject({ ok: false, reason: expect.stringMatching(/already used by Kape Uno/) });
    expect((await checkCouponForJob('KI26-7F3QX', 500_000, 'j2')).ok).toBe(true);
    // Jobs Studio imported from the POS don't count again.
    await db.jobMoney.update('j2', { couponCode: undefined });
    await job('pos-print-x', 'KI26-7F3QX');
    expect((await checkCouponForJob('KI26-7F3QX', 500_000, 'j1')).ok).toBe(true);
  });

  it('count the uses the POS recorded', async () => {
    await seedPos([{ id: 'print:p1', couponId: 'c1', service: 'Print order PA-001', customerName: 'Mira' }]);
    expect(await checkCouponForJob('KI26-7F3QX', 500_000, 'j1')).toMatchObject({ ok: false, reason: expect.stringMatching(/already used by Mira/) });
  });
});

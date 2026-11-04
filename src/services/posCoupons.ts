import Dexie from 'dexie';
import { alive, db } from '../db/db';
import { todayISO } from '../lib/time';
import { checkPosCoupon, normalizeCouponCode, type CouponUse, type PosCoupon, type PosCouponBatch, type PosCouponCheck } from '../domain/posCoupons';
import type { Cents } from '../lib/money';

/** The POS keeps its data in this database on the same site. */
const POS_DB = 'jworks-pos';

/**
 * Check a JoshWorks POS service coupon for a job: against the POS's codes and
 * uses on this device (opened read-only and closed straight away) and the
 * other Studio jobs that hold the same code. Jobs Studio imported from the POS
 * (pos-…) are skipped: their print order or order is already a POS use.
 */
export async function checkCouponForJob(code: string, price: Cents, jobId: string): Promise<PosCouponCheck> {
  const c = normalizeCouponCode(code);
  if (!c) return { ok: false, reason: 'Type the coupon code.' };
  if (!(await Dexie.exists(POS_DB))) return { ok: false, reason: 'JoshWorks POS isn’t on this device, so the code can’t be checked here. Record the use in the POS instead (Customers → Coupons → Record a use).', offline: true };
  const pos = new Dexie(POS_DB);
  let coupons: PosCoupon[] = [];
  let batches: PosCouponBatch[] = [];
  const uses: CouponUse[] = [];
  try {
    await pos.open();
    const names = new Set(pos.tables.map((t) => t.name));
    if (!names.has('coupons') || !names.has('couponBatches')) return { ok: false, reason: 'Update JoshWorks POS on this device first: open it once, and it gets service coupons.' };
    coupons = ((await pos.table('coupons').toArray()) as PosCoupon[]).filter((x) => x.code === c && x.deleted !== 1);
    const ids = new Set(coupons.map((x) => x.batchId));
    batches = ((await pos.table('couponBatches').toArray()) as PosCouponBatch[]).filter((b) => ids.has(b.id));
    const mine = new Set(coupons.map((x) => x.id));
    if (names.has('couponClaims')) {
      for (const u of (await pos.table('couponClaims').toArray()) as { id: string; couponId: string; service: string; customerName: string; deleted?: 0 | 1 }[]) {
        if (u.deleted !== 1 && mine.has(u.couponId)) uses.push({ key: u.id, couponId: u.couponId, service: u.service, customerName: u.customerName });
      }
    }
  } catch {
    return { ok: false, reason: 'Couldn’t read JoshWorks POS on this device. Try again.' };
  } finally {
    pos.close();
  }
  // Studio jobs holding the code that the POS hasn't seen yet.
  const coupon = coupons.find((x) => x.void !== 1) ?? coupons[0];
  if (coupon) {
    const [money, jobs] = await Promise.all([db.jobMoney.toArray().then(alive), db.jobs.toArray().then(alive)]);
    const jobOf = new Map(jobs.map((j) => [j.id, j]));
    for (const m of money) {
      const job = jobOf.get(m.id);
      if (!job || m.id.startsWith('pos-') || (m.couponCode ?? '') !== c) continue;
      uses.push({ key: `studio:${m.id}`, couponId: coupon.id, service: `Studio job ${job.number}${job.title ? `: ${job.title}` : ''}`, customerName: job.clientName });
    }
  }
  return checkPosCoupon(c, { coupons, batches, uses }, { today: todayISO(), price, jobId });
}

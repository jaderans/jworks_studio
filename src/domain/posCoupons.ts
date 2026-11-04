import { peso, percentOf, type Cents } from '../lib/money';
import { fmtIsoDate } from '../lib/time';

/**
 * Service coupons from JoshWorks POS. The POS makes them for each event
 * (Customers → Coupons, or the event's Coupons tab); a Studio job takes one by
 * its code. The code is checked against the POS's coupons on this device, the
 * discount goes on the job, and the POS counts the job as a use next time it
 * opens. These are the POS's rules (its src/domain/coupons.ts checkCoupon).
 */

// ----- what the POS keeps (version 1; JoshWorks POS src/db/types.ts) -----

export interface PosCoupon {
  id: string;
  code: string;
  batchId: string;
  eventId: string;
  void: 0 | 1;
  deleted?: 0 | 1;
}

export interface PosCouponBatch {
  id: string;
  eventId: string;
  name: string;
  kind: 'amount' | 'percent';
  value: number;
  maxOff: Cents;
  minSpend: Cents;
  validFrom: string;
  validTo: string;
  mode: 'unique' | 'shared';
  maxUses: number | null;
  active: 0 | 1;
  deleted?: 0 | 1;
}

/** One use of a code: a POS claim (its id) or a Studio job (`studio:<jobId>`). */
export interface CouponUse {
  key: string;
  couponId: string;
  service: string;
  customerName: string;
}

export const normalizeCouponCode = (code: string) => code.toUpperCase().replace(/\s+/g, '');

/** What a coupon takes off a job of this price. */
export function posCouponOff(b: Pick<PosCouponBatch, 'kind' | 'value' | 'maxOff'>, price: Cents): Cents {
  if (price <= 0) return 0;
  const raw = b.kind === 'percent' ? percentOf(price, b.value) : Math.round(b.value);
  const capped = b.kind === 'percent' && b.maxOff > 0 ? Math.min(raw, b.maxOff) : raw;
  return Math.max(0, Math.min(capped, price));
}

/** "₱300 off" or "10% off (up to ₱1,000)". */
export const posCouponOffText = (b: Pick<PosCouponBatch, 'kind' | 'value' | 'maxOff'>) =>
  b.kind === 'amount' ? `${peso(b.value)} off` : `${b.value}% off${b.maxOff > 0 ? ` (up to ${peso(b.maxOff)})` : ''}`;

/** offline: the POS isn't on this device, so the code couldn't be checked. */
export type PosCouponCheck = { ok: true; couponId: string; code: string; discount: Cents; batch: PosCouponBatch } | { ok: false; reason: string; offline?: boolean };

/**
 * Can this job use the code? A job that already holds it keeps it after the
 * code runs out or is turned off; only the price is checked again.
 */
export function checkPosCoupon(
  code: string,
  data: { coupons: readonly PosCoupon[]; batches: readonly PosCouponBatch[]; uses: readonly CouponUse[] },
  ctx: { today: string; price: Cents; jobId: string },
): PosCouponCheck {
  const c = normalizeCouponCode(code);
  if (!c) return { ok: false, reason: 'Type the coupon code.' };
  const live = data.coupons.filter((x) => x.code === c && x.deleted !== 1);
  const coupon = live.find((x) => x.void !== 1) ?? live[0];
  const batch = coupon ? data.batches.find((b) => b.id === coupon.batchId && b.deleted !== 1) : undefined;
  if (!coupon || !batch) return { ok: false, reason: `There’s no coupon with the code ${c} in JoshWorks POS on this device.` };
  const mine = `studio:${ctx.jobId}`;
  const seen = new Set<string>();
  const used = data.uses.filter((u) => u.couponId === coupon.id && !seen.has(u.key) && seen.add(u.key));
  const held = used.some((u) => u.key === mine);
  if (!held) {
    if (coupon.void === 1 || batch.active !== 1) return { ok: false, reason: `${c} is turned off.` };
    if (batch.validFrom && ctx.today < batch.validFrom) return { ok: false, reason: `${c} can be used from ${fmtIsoDate(batch.validFrom)}.` };
    if (batch.validTo && ctx.today > batch.validTo) return { ok: false, reason: `${c} expired on ${fmtIsoDate(batch.validTo)}.` };
    const cap = batch.mode === 'unique' ? 1 : batch.maxUses;
    if (cap !== null && used.length >= cap) {
      const first = used[0];
      return { ok: false, reason: batch.mode === 'unique' ? `${c} was already used${first ? ` by ${first.customerName || 'a customer'} (${first.service})` : ''}.` : `${c} is used up (${cap} of ${cap}).` };
    }
  }
  if (ctx.price < batch.minSpend) return { ok: false, reason: `${c} is for services of ${peso(batch.minSpend)} or more; this job is ${peso(ctx.price)}.` };
  return { ok: true, couponId: coupon.id, code: coupon.code, discount: posCouponOff(batch, ctx.price), batch };
}

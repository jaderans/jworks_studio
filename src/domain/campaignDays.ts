import type { Campaign } from '../db/types';

/**
 * Campaigns on the calendar: each runs from its start to its end date and
 * tints those days in its own color.
 */

/** Distinct, readable on light and dark: teal, gold, coral, violet, green, pink, blue. */
export const CAMPAIGN_COLORS = ['#2BB3C0', '#E8A317', '#E4572E', '#7B61FF', '#2E9E5B', '#D9488F', '#3D7DD8'];

/** Its chosen color, or a palette color that stays the same for the campaign. */
export function campaignColor(c: Pick<Campaign, 'id' | 'color'>): string {
  if (c.color && /^#[0-9a-f]{6}$/i.test(c.color)) return c.color;
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CAMPAIGN_COLORS[h % CAMPAIGN_COLORS.length];
}

/** The next palette color not used by these campaigns (the first again when all are taken). */
export function nextCampaignColor(existing: readonly Pick<Campaign, 'id' | 'color'>[]): string {
  const used = new Set(existing.map(campaignColor));
  return CAMPAIGN_COLORS.find((c) => !used.has(c)) ?? CAMPAIGN_COLORS[existing.length % CAMPAIGN_COLORS.length];
}

/** The last day of the run: its end date, or the start when there's no (valid) end. */
export const campaignEnd = (c: Pick<Campaign, 'startDate' | 'endDate'>) => (c.endDate && c.endDate >= c.startDate ? c.endDate : c.startDate);

/** The campaigns running on a day, earliest start first. */
export function campaignsOn<T extends Pick<Campaign, 'startDate' | 'endDate'>>(campaigns: readonly T[], date: string): T[] {
  return campaigns.filter((c) => c.startDate && c.startDate <= date && date <= campaignEnd(c)).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** The campaigns running at any time between two days. */
export function campaignsBetween<T extends Pick<Campaign, 'startDate' | 'endDate'>>(campaigns: readonly T[], from: string, to: string): T[] {
  return campaigns.filter((c) => c.startDate && c.startDate <= to && campaignEnd(c) >= from).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

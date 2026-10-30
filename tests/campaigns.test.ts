import { describe, expect, it } from 'vitest';
import { CAMPAIGN_TEMPLATES, planTemplatePosts } from '../src/domain/campaignTemplates';
import { DEFAULT_CADENCE } from '../src/domain/calendar';
import { CAMPAIGN_COLORS, campaignColor, campaignEnd, campaignsBetween, campaignsOn, nextCampaignColor } from '../src/domain/campaignDays';

describe('video series campaign', () => {
  const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'video-series')!;

  it('starts the week of Nov 16: two videos, two weeks apart, ten in all', () => {
    expect(t.startOn).toBe('2026-11-16');
    const plain = planTemplatePosts(t, '2026-11-16', { ...DEFAULT_CADENCE, breakRule: false, skipHolidays: false, breaks: [] });
    expect(plain.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-19', '2026-11-30', '2026-12-03', '2026-12-14', '2026-12-17', '2026-12-28', '2026-12-31', '2027-01-11', '2027-01-14']);
  });

  it('on the real calendar: pauses for break weeks, keeps the rhythm, steps off holidays', () => {
    const posts = planTemplatePosts(t, '2026-11-16', DEFAULT_CADENCE);
    // Nov 30 (Bonifacio Day, break week) pauses the series a week; Christmas Eve moves to Wed, Dec 23.
    expect(posts.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-19', '2026-12-07', '2026-12-10', '2026-12-21', '2026-12-23', '2027-01-04', '2027-01-07', '2027-01-18', '2027-01-21']);
    expect(posts.every((p) => p.time === '19:00')).toBe(true);
    // Each drop fits its season.
    const on = (title: RegExp) => posts.find((p) => title.test(p.title))?.date;
    expect(on(/Christmas \(Illustrator to After Effects\)/)).toBe('2026-12-10');
    expect(on(/Puffy Christmas/)).toBe('2026-12-21');
    expect(on(/New year, new logo/)).toBe('2027-01-04');
    expect(on(/Dinagyang/)).toBe('2027-01-18');
  });

  it('every video opens on its hook and carries alternative hooks, a caption, timing and a reason', () => {
    expect(t.posts).toHaveLength(10);
    for (const p of t.posts) {
      expect(p.brief, p.title).toMatch(/^HOOK \(0–2s\): /);
      expect(p.brief, p.title).toMatch(/\nALT HOOKS to test: /);
      expect(p.brief, p.title).toMatch(/\nCAPTION: .*#JoshWorks/);
      expect(p.brief, p.title).toMatch(/\nTIMING: /);
      expect(p.brief, p.title).toMatch(/\nWHY: /);
      expect(p.format).toBe('Reel');
    }
  });

  it('other campaigns keep moving one post at a time', () => {
    expect(CAMPAIGN_TEMPLATES.find((x) => x.id === 'motion')!.keepRhythm).toBeFalsy();
  });
});

describe('campaigns on the calendar', () => {
  const hilway = { id: 'c-hilway', startDate: '2026-10-31', endDate: '2026-11-08', color: '#E4572E' };
  const promo = { id: 'c-promo', startDate: '2026-11-05', endDate: '' };

  it('runs from the start to the end date (just the start when there is no end)', () => {
    expect(campaignEnd(hilway)).toBe('2026-11-08');
    expect(campaignEnd(promo)).toBe('2026-11-05');
    expect(campaignEnd({ startDate: '2026-11-05', endDate: '2026-11-01' })).toBe('2026-11-05');
    expect(campaignsOn([hilway, promo], '2026-10-30')).toEqual([]);
    expect(campaignsOn([hilway, promo], '2026-11-05').map((c) => c.id)).toEqual(['c-hilway', 'c-promo']);
    expect(campaignsOn([hilway, promo], '2026-11-08').map((c) => c.id)).toEqual(['c-hilway']);
    expect(campaignsBetween([hilway, promo], '2026-11-06', '2026-11-30').map((c) => c.id)).toEqual(['c-hilway']);
  });

  it('keeps a chosen color, gives others a steady palette color, and new ones the next free color', () => {
    expect(campaignColor(hilway)).toBe('#E4572E');
    expect(campaignColor(promo)).toBe(campaignColor({ id: 'c-promo' }));
    expect(CAMPAIGN_COLORS).toContain(campaignColor(promo));
    expect(campaignColor({ id: 'x', color: 'red' })).toBe(campaignColor({ id: 'x' }));
    const used = [{ id: 'a', color: CAMPAIGN_COLORS[0] }, { id: 'b', color: CAMPAIGN_COLORS[1] }];
    expect(nextCampaignColor(used)).toBe(CAMPAIGN_COLORS[2]);
  });
});

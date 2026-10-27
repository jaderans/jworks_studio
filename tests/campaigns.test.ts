import { describe, expect, it } from 'vitest';
import { CAMPAIGN_TEMPLATES, planTemplatePosts } from '../src/domain/campaignTemplates';
import { DEFAULT_CADENCE } from '../src/domain/calendar';

describe('video series campaign', () => {
  const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'video-series')!;

  it('posts two videos, rests two weeks, then two more: ten videos', () => {
    const posts = planTemplatePosts(t, '2026-11-02', { ...DEFAULT_CADENCE, breakRule: false, breaks: [] });
    expect(posts.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-05', '2026-11-16', '2026-11-19', '2026-11-30', '2026-12-03', '2026-12-14', '2026-12-17', '2026-12-28', '2026-12-31']);
  });

  it('a break week pauses the series without breaking the two-week rhythm', () => {
    // Nov 30 starts November's break week: that round and every later one move a week together.
    const posts = planTemplatePosts(t, '2026-11-02', { ...DEFAULT_CADENCE, breakRule: true, breaks: [] });
    expect(posts.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-05', '2026-11-16', '2026-11-19', '2026-12-07', '2026-12-10', '2026-12-21', '2026-12-24', '2027-01-04', '2027-01-07']);
  });

  it('every video opens on its hook and carries alternative hooks, a caption and a reason', () => {
    expect(t.posts).toHaveLength(10);
    for (const p of t.posts) {
      expect(p.brief, p.title).toMatch(/^HOOK \(0–2s\): /);
      expect(p.brief, p.title).toMatch(/\nALT HOOKS to test: /);
      expect(p.brief, p.title).toMatch(/\nCAPTION: .*#JoshWorks/);
      expect(p.brief, p.title).toMatch(/\nWHY: /);
      expect(p.format).toBe('Reel');
    }
  });

  it('other campaigns keep moving one post at a time', () => {
    const other = CAMPAIGN_TEMPLATES.find((x) => x.id === 'motion')!;
    expect(other.keepRhythm).toBeFalsy();
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkCaption, composeCaption, hashtagsOf, splitPlatformCaptions, stripStyles, styleFirstLine, styleText } from '../src/domain/captions';
import { checkLink, containsWalletAddress } from '../src/domain/links';
import { DEFAULT_RATES, costCheck, proposalTotals } from '../src/domain/pricing';
import { SEED_PACKAGES } from '../src/domain/packages';
import { DEFAULT_CONTRACT_SECTIONS, fieldsFor, fillTemplate, missingFields } from '../src/domain/contract';
import { groupBy, outliers, totals, weeklySeries } from '../src/domain/metrics';
import { streak } from '../src/domain/hooks';
import { holidayName, isHoliday, nextWindow, SEASONS, seasonOfText, upcomingDates } from '../src/domain/seasons';
import { DEFAULT_CADENCE, isBreak, planMonth, restartDay, spreadToFreeDays, themedSlots, weekInfo } from '../src/domain/calendar';
import { coverage } from '../src/domain/funnel';
import { parseTrendFeed } from '../src/domain/trendFeed';
import { planTemplatePosts, CAMPAIGN_TEMPLATES } from '../src/domain/campaignTemplates';
import { DEFAULT_BUSINESS } from '../src/db/settings';
import { toCents } from '../src/lib/money';
import type { Idea, Member, Metric, Package, Proposal } from '../src/db/types';

const metric = (over: Partial<Metric>): Metric => ({
  id: Math.random().toString(36).slice(2),
  createdAt: 0,
  updatedAt: 0,
  postId: null,
  clientId: null,
  date: '2026-06-15',
  title: 'Post',
  series: '',
  format: '',
  memberIds: [],
  designerText: '',
  platform: 'facebook',
  views: null,
  reach: null,
  likes: null,
  comments: null,
  saves: null,
  shares: null,
  follows: null,
  clicks: null,
  leads: null,
  notes: '',
  ...over,
});

describe('captions', () => {
  it('styles and un-styles text the way the team writes headlines', () => {
    expect(styleText('Your logo', 'boldSans')).toBe('𝗬𝗼𝘂𝗿 𝗹𝗼𝗴𝗼');
    expect(stripStyles('𝗬𝗼𝘂𝗿 𝗹𝗼𝗴𝗼 𝙋𝙊𝙍𝙏𝙁𝙊𝙇𝙄𝙊 𝐀 𝐍𝐄𝐖')).toBe('Your logo PORTFOLIO A NEW');
    expect(styleFirstLine('Hook here\nBody stays plain', 'boldSans')).toBe('𝗛𝗼𝗼𝗸 𝗵𝗲𝗿𝗲\nBody stays plain');
  });

  it('keeps Instagram to 5 hashtags and adds the CTA once', () => {
    const post = { caption: 'Hook.\n\nBody.', captions: {}, cta: 'DM us “LOGO”', hashtags: '#JoshWorks #LogoDesign #BrandingTips #GraphicDesign #LogoMistakes #Branding #BrandIdentity' };
    const ig = composeCaption(post, 'instagram');
    expect(hashtagsOf(ig)).toHaveLength(5);
    expect(ig).toContain('DM us “LOGO”');
    expect(composeCaption({ ...post, caption: 'Hook. DM us “LOGO”' }, 'facebook').match(/DM us/g)).toHaveLength(1);
    expect(hashtagsOf(composeCaption(post, 'threads'))).toHaveLength(1);
  });

  it('flags captions that would fail or underperform', () => {
    const many = Array.from({ length: 8 }, (_, i) => `#tag${i}`).join(' ');
    expect(checkCaption(`Hi\n${many}`, 'instagram').some((c) => c.level === 'bad')).toBe(true);
    expect(checkCaption('See https://joshworks.ph', 'instagram').some((c) => /clickable/.test(c.text))).toBe(true);
    expect(checkCaption('Fan concept of a famous brand', 'facebook', { series: 'WHAT IF' }).some((c) => /disclaimer/i.test(c.text))).toBe(true);
    expect(checkCaption('Unofficial concept only, not affiliated', 'facebook', { series: 'WHAT IF' }).every((c) => c.level === 'good')).toBe(true);
    expect(checkCaption('#𝗟𝗼𝗴𝗼', 'facebook').some((c) => /won’t link/.test(c.text))).toBe(true);
  });

  it('splits FACEBOOK:/INSTAGRAM: blocks from the planner', () => {
    const s = splitPlatformCaptions('FACEBOOK:\n\nLong story\n\nINSTAGRAM:\nShort one');
    expect(s.main).toBe('Long story');
    expect(s.perPlatform.instagram).toBe('Short one');
    expect(splitPlatformCaptions('Just one caption').main).toBe('Just one caption');
  });
});

describe('link checks', () => {
  // The address is the BIP-173 example, not a real wallet: what a clipboard hijacker swaps in.
  it('spots a wallet address pasted where a Drive folder ID should be', () => {
    const bad = 'https://drive.google.com/drive/folders/bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?usp=sharing';
    expect(containsWalletAddress(bad)).toBe(true);
    expect(checkLink(bad)?.level).toBe('bad');
  });

  it('leaves real Drive links alone', () => {
    // Made-up IDs shaped like real Drive folder IDs; the last uses only Base58 letters, like a Bitcoin address.
    for (const ok of [
      'https://drive.google.com/drive/folders/1Fk2hTq8wPz_RmV3nC7xLs9JdA4bGe5yU?usp=sharing',
      'https://drive.google.com/drive/folders/1x9QvRt3Wm08PzLk-Yb2NcHd7GsAfJu4E?usp=sharing',
      'https://drive.google.com/drive/folders/1Hq3fZt9wXkP2mN7vB4cR8yL5sD6gJ2aE?usp=drive_link',
    ]) {
      expect(containsWalletAddress(ok)).toBe(false);
      expect(checkLink(ok)).toBeNull();
    }
    expect(checkLink('july 25')?.level).toBe('warn');
  });
});

describe('pricing', () => {
  const pkg = (name: string) => SEED_PACKAGES.find((p) => p.name === name) as unknown as Package;

  it('prices the starter SMM tiers low but still above the 30% minimum margin', () => {
    expect(pkg('Starter').price).toBe(toCents(4500));
    expect(pkg('Growth').price).toBe(toCents(7500));
    expect(pkg('Plus').price).toBe(toCents(12000));
    for (const n of ['Starter', 'Growth', 'Plus']) {
      const c = costCheck(pkg(n), DEFAULT_RATES);
      expect(c.margin).not.toBeNull();
      expect(c.margin as number).toBeGreaterThanOrEqual(30);
      expect(c.verdict).toBe('ok');
    }
  });

  it('works out the Starter cost from the team’s hourly rates', () => {
    const c = costCheck(pkg('Starter'), DEFAULT_RATES);
    // 8 × 0.75 h × ₱280 + 8 × 0.25 h × ₱120 + 1 h × ₱120 + 1 h × ₱120 = ₱2,160, plus 25% overhead.
    expect(c.direct).toBe(toCents(2160));
    expect(c.cost).toBe(toCents(2700));
    expect(Math.round(c.margin as number)).toBe(40);
  });

  it('totals a proposal with the founding-client discount, VAT and withholding', () => {
    const p: Pick<Proposal, 'items' | 'discountPct' | 'discountMonths' | 'vat' | 'ewt'> = {
      items: [
        { packageId: null, label: 'Growth', qty: 1, unitPrice: toCents(7500), unit: 'month', months: 3 },
        { packageId: null, label: 'Logo design', qty: 1, unitPrice: toCents(6500), unit: 'project', months: 1 },
        { packageId: null, label: 'Rush', qty: 1, unitPrice: 2500, unit: 'percent', months: 1 },
      ],
      discountPct: 10,
      discountMonths: 3,
      vat: false,
      ewt: true,
    };
    const t = proposalTotals(p, DEFAULT_RATES);
    expect(t.perMonth).toBe(toCents(7500));
    expect(t.oneTime).toBe(toCents(6500 + 1625));
    expect(t.gross).toBe(toCents(22500 + 6500 + 1625));
    expect(t.discount).toBe(toCents(2250));
    expect(t.net).toBe(toCents(28375));
    expect(t.ewt).toBe(toCents(567.5));
    expect(t.payable).toBe(toCents(28375 - 567.5));
  });
});

describe('contracts', () => {
  it('fills the template from the business, client and package', () => {
    const pkg = { ...(SEED_PACKAGES.find((x) => x.kind === 'smm' && x.name === 'Starter') as unknown as Package), id: 'p1' };
    const fields = fieldsFor({ ...DEFAULT_BUSINESS, paymentDetails: 'GCash 0917' }, null, pkg, { start: '2026-11-02' });
    expect(fields.fee).toBe('₱4,500 a month');
    expect(fields.paymentSplit).toContain('₱2,250');
    expect(fields.lateFeePct).toBe('5');
    expect(fields.noticeDays).toBe('30');
    expect(fields.venue).toBe('Iloilo City');
    const pay = DEFAULT_CONTRACT_SECTIONS.find((s) => s.id === 'payment')!;
    expect(fillTemplate(pay.body, fields)).toContain('GCash 0917');
    const missing = missingFields(DEFAULT_CONTRACT_SECTIONS, fields);
    expect(missing).toContain('client.name');
    expect(missing).not.toContain('fee');
  });

  it('covers every section social media managers are told never to skip', () => {
    const ids = DEFAULT_CONTRACT_SECTIONS.map((s) => s.id);
    for (const id of ['parties', 'scope', 'client', 'payment', 'revisions', 'confidentiality', 'ip', 'results', 'termination', 'law']) expect(ids).toContain(id);
    expect(fillTemplate('{{missing}}', {})).toBe('________');
  });
});

describe('results', () => {
  it('finds outliers against the platform’s usual views', () => {
    const rows = [1000, 1200, 900, 1100, 5000].map((v, i) => metric({ id: `m${i}`, views: v }));
    const out = outliers(rows);
    expect([...out.keys()]).toEqual(['m4']);
    expect(out.get('m4')!.ratio).toBeCloseTo(5000 / 1100, 1);
  });

  it('rolls up totals, groups and weeks', () => {
    const rows = [metric({ views: 100, reach: 50, likes: 5, saves: 2, shares: 3, memberIds: ['a'] }), metric({ date: '2026-06-29', views: 300, reach: 100, memberIds: ['a', 'b'] })];
    expect(totals(rows)).toMatchObject({ posts: 2, views: 400, reach: 150, engagement: 10 });
    const g = groupBy(rows, (m) => m.memberIds);
    expect(g.find((x) => x.key === 'a')?.posts).toBe(2);
    const w = weeklySeries(rows, 'views');
    expect(w.map((x) => x.week)).toEqual(['2026-06-15', '2026-06-22', '2026-06-29']);
    expect(w[1].value).toBe(0);
  });
});

describe('hook practice streak', () => {
  it('counts today or yesterday as keeping the streak', () => {
    expect(streak(['2026-10-02', '2026-10-03', '2026-10-04'], '2026-10-04').current).toBe(3);
    expect(streak(['2026-10-02', '2026-10-03'], '2026-10-04').current).toBe(2);
    expect(streak(['2026-10-01'], '2026-10-04').current).toBe(0);
    const s = streak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-04'], '2026-10-04');
    expect(s.best).toBe(3);
    expect(s.last30).toHaveLength(30);
    expect(s.last30[29]).toEqual({ date: '2026-10-04', done: true });
  });
});

describe('Philippine dates and seasons', () => {
  it('knows Dinagyang 2027 and the 2027 holidays', () => {
    const dina = SEASONS.find((s) => s.id === 'dinagyang')!;
    expect(dina.window(2027).end).toBe('2027-01-24');
    expect(isHoliday('2026-12-25')).toBe(true);
    expect(isHoliday('2027-03-26')).toBe(true);
    expect(holidayName('2027-04-09')).toBe('Araw ng Kagitingan');
    expect(isHoliday('2026-11-03')).toBe(false);
  });

  it('matches seasons from words, without false alarms', () => {
    expect(seasonOfText('Paskua sa Iloilo holiday merch')?.id).toBe('christmas');
    expect(seasonOfText('Print-Ready 101: Bleed, Margins & Resolution')).toBeNull();
    expect(seasonOfText('Filipino Mythical Creatures as Brand Mascots')?.id).toBe('halloween');
    expect(nextWindow(SEASONS.find((s) => s.id === 'intrams')!, '2026-11-02').start).toBe('2027-08-01');
  });

  it('lists upcoming dates without paydays by default', () => {
    const d = upcomingDates('2026-10-04', 60);
    expect(d.some((x) => x.name === '11.11 sale')).toBe(true);
    expect(d.some((x) => x.kind === 'payday')).toBe(false);
    expect(upcomingDates('2026-10-04', 60, { paydays: true }).some((x) => x.kind === 'payday')).toBe(true);
  });
});

describe('the weekly rhythm', () => {
  it('makes the week of each month’s last Monday a break week', () => {
    expect(isBreak(DEFAULT_CADENCE, '2026-11-30')).toBe(true);
    expect(isBreak(DEFAULT_CADENCE, '2026-12-03')).toBe(true);
    expect(isBreak(DEFAULT_CADENCE, '2026-10-01')).toBe(true);
    expect(isBreak(DEFAULT_CADENCE, '2026-11-02')).toBe(false);
    expect(weekInfo(DEFAULT_CADENCE, '2026-11-05')).toMatchObject({ number: 1, label: 'Week 1', friday: 'BTS / Process' });
    expect(weekInfo(DEFAULT_CADENCE, '2026-11-20').friday).toBe('Client Love');
  });

  it('plans themed slots around holidays and fills a month from the idea bank', () => {
    const slots = themedSlots(DEFAULT_CADENCE, '2026-12-21', '2026-12-25');
    expect(slots.map((s) => s.date)).toEqual(['2026-12-21', '2026-12-22']);
    const members = [{ id: 'k', name: 'Kaye', active: 1 } as Member, { id: 'r', name: 'Renz', active: 1 } as Member];
    const ideas = [
      { id: 'i1', kind: 'idea', title: 'Kerning made simple', category: 'Educational (Mon)', bestFor: ['k'], format: 'Carousel', status: 'idea' },
      { id: 'i2', kind: 'idea', title: 'Rate this design', category: 'Fun / Engagement (Fri)', bestFor: [], format: 'Story', status: 'idea' },
    ] as Idea[];
    const plan = planMonth(DEFAULT_CADENCE, '2026-11', { busyDates: new Set(['2026-11-03']), ideas, members, load: new Map() });
    // Mon, Nov 2 is All Souls' Day (a holiday) and Nov 3 already has a post.
    expect(plan.some((r) => r.date === '2026-11-02' || r.date === '2026-11-03')).toBe(false);
    expect(plan.find((r) => r.ideaId === 'i1')).toMatchObject({ date: '2026-11-09', assignees: ['k'] });
    expect(plan.find((r) => r.ideaId === 'i2')?.date).toBe('2026-11-06');
    expect(plan.every((r) => r.date < '2026-11-30')).toBe(true);
  });

  it('places campaign templates on working days only', () => {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'paskua')!;
    const posts = planTemplatePosts(t, '2026-11-23', DEFAULT_CADENCE);
    expect(posts.every((p) => !isBreak(DEFAULT_CADENCE, p.date))).toBe(true);
    expect(posts[0].date >= '2026-11-23').toBe(true);
  });

  it('names the day posting really restarts', () => {
    // Mon, Nov 2 is All Souls' Day; Nov 30 is Bonifacio Day in a break week, then Dec 7.
    expect(restartDay({ ...DEFAULT_CADENCE, resumeOn: '2026-11-02' })).toBe('2026-11-03');
    expect(restartDay({ ...DEFAULT_CADENCE, resumeOn: '2026-11-30' })).toBe('2026-12-07');
    expect(restartDay({ ...DEFAULT_CADENCE, resumeOn: '' })).toBe('');
  });

  it('moves campaign posts off days the planner already filled, keeping their order', () => {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'smm-launch')!;
    const rows = planTemplatePosts(t, '2026-11-02', DEFAULT_CADENCE).map((p) => ({ ...p, include: true }));
    // A full planner: every themed day except the Wednesday flex day has a post.
    const taken = new Set(themedSlots(DEFAULT_CADENCE, '2026-11-02', '2027-01-31').map((s) => s.date));
    expect(rows.filter((r) => r.format !== 'Story').every((r) => taken.has(r.date))).toBe(true);

    const out = spreadToFreeDays(rows, taken, DEFAULT_CADENCE);
    const feed = out.filter((r) => r.format !== 'Story');
    expect(feed.every((r) => !taken.has(r.date))).toBe(true);
    expect(new Set(feed.map((r) => r.date)).size).toBe(feed.length);
    expect(out.map((r) => r.date)).toEqual([...out.map((r) => r.date)].sort());
    expect(out.every((r) => !isBreak(DEFAULT_CADENCE, r.date) && !isHoliday(r.date))).toBe(true);
    expect(feed[0].date).toBe('2026-11-04');

    // Nothing planned yet: nothing moves; unticked rows are left alone.
    expect(spreadToFreeDays(rows, new Set(), DEFAULT_CADENCE)).toEqual(rows);
    const off = rows.map((r, i) => (i === 0 ? { ...r, include: false } : r));
    expect(spreadToFreeDays(off, taken, DEFAULT_CADENCE)[0].date).toBe(rows[0].date);
  });
});

describe('funnels and the trend feed', () => {
  it('shows which funnel stages have no posts', () => {
    const c = coverage([{ funnelStage: 'awareness', status: 'todo' }, { funnelStage: 'action', status: 'posted' }, { funnelStage: 'action', status: 'skipped' }]);
    expect(c.counts).toMatchObject({ awareness: 1, action: 1 });
    expect(c.empty).toEqual(['interest', 'decision', 'loyalty']);
  });

  it('reads the published weekly report without dropping anything', () => {
    const raw = JSON.parse(readFileSync('public/trends/latest.json', 'utf8'));
    const r = parseTrendFeed(raw);
    expect(r).not.toBeNull();
    expect(new Date(`${r!.weekOf}T00:00:00`).getDay()).toBe(1);
    expect(r!.items.length).toBe(raw.items.length);
    expect(r!.dates.length).toBe(raw.dates.length);
    expect(r!.items.every((i) => i.sources.length > 0)).toBe(true);
  });

  it('accepts a good feed and drops anything unsafe', () => {
    const r = parseTrendFeed({
      weekOf: '2026-10-05',
      summary: 'x',
      items: [
        { title: 'Good', platform: 'tiktok', sources: [{ title: 'ok', url: 'https://example.com/a' }, { title: 'bad', url: 'javascript:alert(1)' }] },
        { title: '', platform: 'tiktok' },
        { title: 'Odd platform', platform: 'myspace' },
      ],
      dates: [{ date: 'soon', name: 'nope' }, { date: '2026-11-11', name: '11.11' }],
    });
    expect(r?.items.map((i) => i.title)).toEqual(['Good', 'Odd platform']);
    expect(r?.items[0].sources).toEqual([{ title: 'ok', url: 'https://example.com/a' }]);
    expect(r?.items[1].platform).toBe('any');
    expect(r?.dates).toEqual([{ date: '2026-11-11', name: '11.11', idea: '' }]);
    expect(parseTrendFeed({ items: [] })).toBeNull();
  });
});

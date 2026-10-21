import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { readXlsx, cellText } from '../src/domain/xlsx';
import { workbook } from './workbook';
import { defaultSkipRow, parseDayText, parsePlanner, parseShortDate, statusFromPlanner } from '../src/domain/planner';
import { reschedule } from '../src/domain/calendar';
import { mondayOf } from '../src/lib/time';
import { DEFAULT_CADENCE } from '../src/domain/calendar';
import { splitPlatformCaptions } from '../src/domain/captions';

describe('xlsx reader', () => {
  it('reads text, numbers, and hyperlinks', () => {
    const data = workbook([{ name: 'Sheet A', rows: [['Title', 'Views'], ['Hello & <bye>', 1234]], links: { A2: 'https://example.com/x?a=1&b=2' } }]);
    const [s] = readXlsx(data);
    expect(s.name).toBe('Sheet A');
    expect(cellText(s, 2, 1)).toBe('Hello & <bye>');
    expect(s.rows.get(2)?.get(2)?.v).toBe(1234);
    expect(s.rows.get(2)?.get(1)?.link).toBe('https://example.com/x?a=1&b=2');
  });

  it('rejects files that are not workbooks', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/xlsx|workbook/i);
  });
});

describe('planner parsing', () => {
  const data = workbook([
    { name: 'Overview & Strategy', rows: [['JoshWorks - Content Planner | June 15 - November 2026'], ['MONDAY - Educational', 'Teach.'], ['THE TEAM'], ['Renz', 'Web Design & Layout Artist'], ['Harvey'], ['POSTS PER DESIGNER (auto-counted)']] },
    {
      name: 'Content Calendar',
      rows: [
        ['Month', 'Week', 'Date', 'Day Theme', 'Assigned Designer', 'Content Title / Topic', 'Format', 'Notes / Brief', 'Status', 'Caption', 'Asset Link'],
        ['June', 'Week 1', 'Mon, Jun 15', 'MON - Educational', 'Joshua', 'Logo mistakes', 'Carousel', '', 'Posted', 'Facebook:\n\nHook line\n\nInstagram:\nIG version', ''],
        ['', '', '', '', 'Joshua', 'Teaser', 'Carousel', '', 'Posted', '', ''],
        ['', '', 'Tue, Jun 16', 'TUE - Portfolio / Concept', 'Joshua + Kaye', 'Brand reveal', 'Carousel', '', 'Not Started', '', 'https://drive.google.com/drive/folders/bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?usp=sharing'],
        ['June', 'BREAK WEEK', 'Jun 29 - Jul 3', 'NO POSTING', 'All', 'Rest', '-', '', '', '', ''],
        ['July', 'Week 1', 'Mon, Jul 6', 'MON - Educational', 'Renz', '-----', 'Carousel', '', 'Ready for Positing', '', ''],
      ],
    },
  ]);

  it('reads posts, shared days, breaks, team and the year', () => {
    const p = parsePlanner(readXlsx(data));
    expect(p.year).toBe(2026);
    expect(p.team.map((t) => t.name)).toEqual(['Renz', 'Harvey']);
    expect(p.themes[0]).toMatchObject({ key: 'mon-edu', name: 'Educational' });
    const posts = p.rows.filter((r) => r.kind === 'post');
    expect(posts.map((r) => r.date)).toEqual(['2026-06-15', '2026-06-15', '2026-06-16', '2026-07-06']);
    expect(posts[1].themeKey).toBe('mon-edu');
    expect(posts[2].designers).toEqual(['Joshua', 'Kaye']);
    expect(posts[3].title).toBe('');
    const brk = p.rows.find((r) => r.kind === 'break');
    expect(brk).toMatchObject({ date: '2026-06-29', end: '2026-07-03' });
  });

  it('drops a link that holds a wallet address instead of a folder', () => {
    const p = parsePlanner(readXlsx(data));
    expect(p.droppedLinks).toBe(1);
    expect(p.rows.find((r) => r.title === 'Brand reveal')?.assetLink).toBe('');
  });

  it('skips through the end of the last week with a posted row', () => {
    const p = parsePlanner(readXlsx(data));
    expect(defaultSkipRow(p.rows)).toBe(4);
  });

  it('parses dates and statuses as the planner writes them', () => {
    expect(parseDayText('Mon, Jun 15', 2026)).toBe('2026-06-15');
    expect(parseDayText('Fri, Nov 27', 2026)).toBe('2026-11-27');
    expect(parseShortDate('06/15/26')).toBe('2026-06-15');
    expect(statusFromPlanner('Ready for Positing')).toBe('ready');
    expect(statusFromPlanner('Posted')).toBe('posted');
    expect(statusFromPlanner('In Progress')).toBe('doing');
    expect(statusFromPlanner('Not Started')).toBe('todo');
  });

  it('splits Facebook/Instagram caption blocks', () => {
    const s = splitPlatformCaptions('Facebook:\n\nHook line\n\nBody\n\nInstagram:\nIG version');
    expect(s.main).toBe('Hook line\n\nBody');
    expect(s.perPlatform.instagram).toBe('IG version');
  });
});

// The real planner stays on this computer (it's git-ignored); these run only where it exists.
const REAL = 'Jworks Previous Campaigns/JoshWorks_Content_Planner_Jun15-Nov_2026 (1).xlsx';

describe.skipIf(!existsSync(REAL))('the JoshWorks Jun–Nov 2026 planner', () => {
  // Read it in beforeAll: a skipped describe still runs its body, and CI has no copy of the private file.
  let p: ReturnType<typeof parsePlanner>;
  beforeAll(() => {
    p = parsePlanner(readXlsx(new Uint8Array(readFileSync(REAL))));
  });

  it('finds every tab', () => {
    expect(p.sheetsFound.length).toBe(7);
    expect(p.year).toBe(2026);
    expect(p.team.map((t) => t.name)).toEqual(['Renz', 'Kaye', 'CJ', 'Joshua', 'Harvey']);
    expect(p.fridayRotation).toEqual(['BTS / Process', 'Freebie Friday', 'Client Love', 'Fun / Engagement']);
    expect(p.briefs.map((b) => b.slides.length)).toEqual([12, 7, 7]);
    expect(p.ideas.length).toBe(36);
    expect(p.concepts.length).toBe(12);
    expect(p.metrics.length).toBe(7);
    expect(p.snippets.length).toBe(10);
    expect(p.droppedLinks).toBe(1);
  });

  it('skips the 19 rows already posted and keeps 64 posts to reschedule', () => {
    const skip = defaultSkipRow(p.rows);
    expect(skip).toBe(19);
    const rest = p.rows.filter((r) => r.kind === 'post' && r.row > skip);
    expect(rest.length).toBe(64);
    expect(rest[0]).toMatchObject({ date: '2026-07-13', title: 'Typography 101: How to Pair Fonts' });
  });

  it('restarts the week of Nov 2 (after Undas) with themes kept and seasons respected', () => {
    const rest = p.rows.filter((r) => r.kind === 'post' && r.row > 19);
    const res = reschedule(
      rest.map((r, i) => ({ id: String(r.row), date: r.date, themeKey: r.themeKey, title: r.title, brief: r.brief, sort: i })),
      '2026-11-02',
      DEFAULT_CADENCE,
    );
    const byRow = new Map(res.placed.map((x) => [x.id, x]));
    const title = (id: string) => rest.find((r) => String(r.row) === id)?.title;
    // Nothing lands before the restart, on All Souls' Day (Mon, Nov 2) or in a break week (Nov 30 – Dec 4).
    expect(res.placed.every((x) => x.date > '2026-11-02')).toBe(true);
    expect(res.placed.some((x) => x.date >= '2026-11-30' && x.date <= '2026-12-04')).toBe(false);
    // The first week back opens Tue, Nov 3; the ready Typography post moves off the holiday to the flex day.
    expect(res.placed[0]).toMatchObject({ date: '2026-11-03' });
    const typography = res.placed.find((x) => title(x.id) === 'Typography 101: How to Pair Fonts');
    expect(typography).toMatchObject({ date: '2026-11-04' });
    expect(typography?.note).toMatch(/All Souls/);
    // Paskua merch stays on its planned November Tuesday.
    const paskua = rest.find((r) => /paskua/i.test(r.title));
    expect(byRow.get(String(paskua?.row))?.date).toBe('2026-11-10');
    // Dinagyang mascot moves into the weeks before the festival (Jan 24, 2027), on a Tuesday.
    const dina = rest.find((r) => /dinagyang/i.test(r.title));
    const d = byRow.get(String(dina?.row))?.date as string;
    expect(d >= '2027-01-02' && d <= '2027-01-24').toBe(true);
    expect(new Date(`${d}T00:00:00`).getDay()).toBe(2);
    // Halloween and intramurals posts wait for a decision instead of landing out of season.
    const left = res.unplaced.map((u) => title(u.id));
    expect(left.some((t) => /halloween/i.test(t ?? ''))).toBe(true);
    expect(left.some((t) => /intramurals/i.test(t ?? ''))).toBe(true);
    // Every post keeps its weekday, except ones a holiday moved to the flex day.
    for (const x of res.placed) {
      const r = rest.find((y) => String(y.row) === x.id)!;
      if (r.date && !/flex day/.test(x.note)) expect(new Date(`${x.date}T00:00:00`).getDay()).toBe(new Date(`${r.date}T00:00:00`).getDay());
    }
    // No posts on public holidays (Dec 8, Christmas Eve and Day, Holy Week).
    for (const h of ['2026-11-02', '2026-12-08', '2026-12-24', '2026-12-25', '2027-03-25', '2027-03-26']) expect(res.placed.some((x) => x.date === h)).toBe(false);
    // Never more than the usual four posts in a week.
    const perWeek = new Map<string, number>();
    for (const x of res.placed) perWeek.set(mondayOf(x.date), (perWeek.get(mondayOf(x.date)) ?? 0) + 1);
    expect(Math.max(...perWeek.values())).toBeLessThanOrEqual(4);
    // "Shirt Week" stays one week.
    const shirt = ['How to Design a Shirt People Actually Wear', 'Joshua - Designing Shirts People Actually Want to Wear', 'BTS - Shirt Mockup Process'].map(
      (t) => mondayOf(byRow.get(String(rest.find((r) => r.title === t)?.row))?.date as string),
    );
    expect(new Set(shirt).size).toBe(1);
    // "Resolution" in a print post is not a New Year post.
    expect(res.placed.find((x) => title(x.id)?.startsWith('Print-Ready'))?.note ?? '').not.toMatch(/new year/i);
    // eslint-disable-next-line no-console
    console.log(
      res.placed.map((x) => `${x.date}  ${title(x.id)}${x.note ? `  [${x.note}]` : ''}`).join('\n') +
        '\n--- needs a date:\n' +
        res.unplaced.map((u) => `${title(u.id)} — ${u.reason}`).join('\n'),
    );
  });
});

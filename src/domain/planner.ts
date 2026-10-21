import { addDays, isoOf, mondayOf } from '../lib/time';
import { bestMatch } from '../lib/text';
import { containsWalletAddress, isUrl } from './links';
import { cellLink, cellText, type Sheet } from './xlsx';
import type { PlatformKey, PostStatus, Slide } from '../db/types';

/**
 * Reads the JoshWorks content planner workbook (the Google Sheet with the
 * Content Calendar, Carousel Briefs, Idea Bank, WHAT IF & Concept Bank,
 * Performance Tracker and Hashtag & Caption Bank tabs). Columns are found by
 * their headings, so moved or extra columns still work.
 */

export interface PlannerRow {
  /** Spreadsheet row number, as people see it in the sheet. */
  row: number;
  kind: 'post' | 'flex' | 'break';
  date: string | null;
  dateText: string;
  /** Break weeks: the range. */
  end: string | null;
  dayTheme: string;
  themeKey: string;
  designers: string[];
  title: string;
  format: string;
  brief: string;
  status: string;
  caption: string;
  assetLink: string;
  links: Partial<Record<PlatformKey, string>>;
}

export interface PlannerBrief {
  heading: string;
  date: string | null;
  title: string;
  slides: Slide[];
}

export interface PlannerIdea {
  category: string;
  title: string;
  bestFor: string;
  format: string;
}

export interface PlannerConcept {
  n: number;
  series: string;
  subject: string;
  lead: string;
  angle: string;
  timing: string;
  status: string;
}

export interface PlannerMetric {
  row: number;
  date: string | null;
  title: string;
  series: string;
  designer: string;
  platform: PlatformKey;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
}

export interface PlannerSnippet {
  useFor: string;
  block: string;
  notes: string;
}

export interface PlannerImport {
  year: number;
  rows: PlannerRow[];
  team: { name: string; role: string }[];
  themes: { key: string; name: string; description: string }[];
  fridayRotation: string[];
  briefs: PlannerBrief[];
  ideas: PlannerIdea[];
  concepts: PlannerConcept[];
  conceptRules: string;
  metrics: PlannerMetric[];
  snippets: PlannerSnippet[];
  /** Links left out because they held a wallet address instead of a folder ID. */
  droppedLinks: number;
  /** The first dated post (YYYY-MM-DD): names this plan, so a newer plan never collides with an older one. */
  start: string | null;
  sheetsFound: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthNo = (name: string): number => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function findSheet(sheets: Sheet[], ...needles: string[]): Sheet | undefined {
  return sheets.find((s) => needles.some((n) => norm(s.name).includes(n)));
}

/** Find the heading row and map each wanted column to its number. */
function headerMap(sheet: Sheet, want: Record<string, (h: string) => boolean>, mustHave: string[], scanRows = 12): { row: number; cols: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(scanRows, sheet.maxRow); r++) {
    const cells = sheet.rows.get(r);
    if (!cells) continue;
    const cols: Record<string, number> = {};
    for (const [c, cell] of cells) {
      const h = norm(String(cell.v ?? ''));
      if (!h) continue;
      for (const [key, test] of Object.entries(want)) if (cols[key] === undefined && test(h)) cols[key] = c;
    }
    if (mustHave.every((k) => cols[k] !== undefined)) return { row: r, cols };
  }
  return null;
}

export function themeKeyOf(dayTheme: string): string {
  const t = dayTheme.trim().toLowerCase();
  if (t.startsWith('mon')) return 'mon-edu';
  if (t.startsWith('tue')) return 'tue-portfolio';
  if (t.startsWith('wed')) return 'wed-flex';
  if (t.startsWith('thu')) return 'thu-designer';
  if (t.startsWith('fri')) return 'fri-behind';
  return '';
}

export function statusFromPlanner(s: string): PostStatus {
  const t = s.toLowerCase();
  if (!t.trim()) return 'todo';
  if (t.includes('ready')) return 'ready';
  if (t.includes('posted') || t === 'done' || t.includes('published')) return 'posted';
  if (t.includes('progress') || t.includes('doing')) return 'doing';
  if (t.includes('review')) return 'review';
  if (t.includes('schedul')) return 'scheduled';
  if (t.includes('skip')) return 'skipped';
  return 'todo';
}

export const splitNames = (s: string): string[] =>
  s
    .split(/\s*(?:\+|,|&|\/|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);

/** "Mon, Jun 15" → 2026-06-15 (the year comes from the planner). */
export function parseDayText(text: string, year: number): string | null {
  const m = /([a-z]{3,9})\.?\s+(\d{1,2})\b/i.exec(text.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s*/i, ''));
  if (!m) return null;
  const mo = monthNo(m[1]);
  if (mo < 1) return null;
  return isoOf(year, mo, Number(m[2]));
}

function parseRange(text: string, year: number): { start: string; end: string } | null {
  const m = /([a-z]{3,9})\.?\s+(\d{1,2})\s*[-–]\s*(?:([a-z]{3,9})\.?\s+)?(\d{1,2})/i.exec(text);
  if (!m) return null;
  const m1 = monthNo(m[1]);
  const m2 = m[3] ? monthNo(m[3]) : m1;
  if (m1 < 1 || m2 < 1) return null;
  const y2 = m2 < m1 ? year + 1 : year;
  return { start: isoOf(year, m1, Number(m[2])), end: isoOf(y2, m2, Number(m[4])) };
}

/** "06/15/26", "6/15/2026" or an Excel date number → YYYY-MM-DD. */
export function parseShortDate(v: string | number): string | null {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(v).trim());
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return isoOf(y, Number(m[1]), Number(m[2]));
}

const toNum = (s: string): number | null => {
  const n = Number(s.replace(/[,\s]/g, ''));
  return s.trim() && Number.isFinite(n) ? n : null;
};

export function platformFromText(s: string): PlatformKey | null {
  const t = s.toLowerCase();
  if (t.includes('face') || t === 'fb') return 'facebook';
  if (t.includes('insta') || t === 'ig') return 'instagram';
  if (t.includes('tiktok')) return 'tiktok';
  if (t.includes('thread')) return 'threads';
  if (t.includes('reddit')) return 'reddit';
  if (t.includes('youtube')) return 'youtube';
  if (t.includes('linkedin')) return 'linkedin';
  if (t === 'x' || t.includes('twitter')) return 'x';
  return null;
}

export function parsePlanner(sheets: Sheet[], opts: { year?: number } = {}): PlannerImport {
  const out: PlannerImport = {
    year: opts.year ?? new Date().getFullYear(),
    rows: [],
    team: [],
    themes: [],
    fridayRotation: [],
    briefs: [],
    ideas: [],
    concepts: [],
    conceptRules: '',
    metrics: [],
    snippets: [],
    droppedLinks: 0,
    start: null,
    sheetsFound: [],
  };

  // ----- Overview & Strategy: year, team, weekly themes, Friday rotation -----
  const ov = findSheet(sheets, 'overview', 'strategy');
  if (ov) {
    out.sheetsFound.push(ov.name);
    if (!opts.year) {
      const y = /\b(20\d{2})\b/.exec(cellText(ov, 1, 1));
      if (y) out.year = Number(y[1]);
    }
    let section = '';
    for (let r = 1; r <= ov.maxRow; r++) {
      const a = cellText(ov, r, 1);
      const b = cellText(ov, r, 2);
      if (!a) continue;
      const day = /^(monday|tuesday|wednesday|thursday|friday)\s*[-–]\s*(.+)$/i.exec(a);
      if (day && b !== a) {
        const key = themeKeyOf(day[1]);
        if (key) out.themes.push({ key, name: day[2].replace(/\s*\((open|optional)\)\s*$/i, '').trim(), description: b });
        continue;
      }
      if (/^the team$/i.test(a)) {
        section = 'team';
        continue;
      }
      if (/friday rotation/i.test(a)) {
        section = 'rotation';
        continue;
      }
      if (/^(posts per designer|how to use|weekly theme)/i.test(a)) {
        section = '';
        continue;
      }
      if (section === 'team' && !/^designer$/i.test(a) && a.length < 40) out.team.push({ name: a, role: b === a ? '' : b });
      if (section === 'rotation') {
        const w = /^week\s*\d[^-–]*[-–]\s*(.+)$/i.exec(a);
        if (w) out.fridayRotation.push(w[1].trim());
      }
    }
  } else if (!opts.year) {
    const y = sheets.map((s) => /\b(20\d{2})\b/.exec(s.name)?.[1]).find(Boolean);
    if (y) out.year = Number(y);
  }

  // ----- Content Calendar -----
  const cal = findSheet(sheets, 'calendar');
  if (cal) {
    out.sheetsFound.push(cal.name);
    const hm = headerMap(
      cal,
      {
        month: (h) => h === 'month',
        week: (h) => h === 'week',
        date: (h) => h === 'date' || h.startsWith('date'),
        theme: (h) => h.includes('theme'),
        designer: (h) => h.includes('designer') || h.includes('assigned'),
        title: (h) => h.includes('title') || h.includes('topic'),
        format: (h) => h === 'format',
        brief: (h) => h.includes('brief') || h.includes('notes'),
        status: (h) => h === 'status',
        caption: (h) => h.includes('caption'),
        asset: (h) => h.includes('asset'),
        facebook: (h) => h.startsWith('facebook'),
        tiktok: (h) => h.startsWith('tiktok'),
        reddit: (h) => h.startsWith('reddit'),
        instagram: (h) => h.startsWith('instagram'),
        x: (h) => h === 'x' || h.startsWith('x link') || h.startsWith('twitter'),
        threads: (h) => h.startsWith('threads'),
        youtube: (h) => h.startsWith('youtube'),
      },
      ['date', 'title'],
    );
    if (hm) {
      const c = hm.cols;
      const get = (r: number, k: string) => (c[k] ? cellText(cal, r, c[k]) : '');
      let year = out.year;
      let lastDate: string | null = null;
      // Rows under a "BACKLOG" heading have no date yet.
      let backlog = false;
      for (let r = hm.row + 1; r <= cal.maxRow; r++) {
        const dateText = get(r, 'date');
        const dayTheme = get(r, 'theme');
        const week = get(r, 'week');
        const title = get(r, 'title');
        const designer = get(r, 'designer');
        if (/^backlog\b/i.test(get(r, 'month') || cellText(cal, r, 1))) {
          backlog = true;
          continue;
        }
        if (!dateText && !title && !designer && !dayTheme) continue;
        if (/no posting/i.test(dayTheme) || /break/i.test(week)) {
          const range = parseRange(dateText, year);
          out.rows.push({ row: r, kind: 'break', date: range?.start ?? null, end: range?.end ?? null, dateText, dayTheme, themeKey: '', designers: [], title, format: '', brief: get(r, 'brief'), status: '', caption: '', assetLink: '', links: {} });
          if (range) lastDate = range.end;
          continue;
        }
        let date: string | null = backlog ? null : lastDate;
        if (dateText && /^\d{5}(\.\d+)?$/.test(dateText.trim())) {
          // A real date cell (Excel stores it as a day number).
          date = parseShortDate(Math.floor(Number(dateText)));
          if (date) {
            lastDate = date;
            year = Number(date.slice(0, 4));
          }
        } else if (dateText) {
          let d = parseDayText(dateText, year);
          // A planner that runs into the new year: dates go backwards → next year.
          if (d && lastDate && d < addDays(lastDate, -150)) {
            year += 1;
            d = parseDayText(dateText, year);
          }
          date = d;
          lastDate = d ?? lastDate;
        }
        const cleanTitle = /^[-–—_\s]*$/.test(title) ? '' : title;
        const flex = /flex/i.test(dayTheme) && !cleanTitle && !designer;
        const links: Partial<Record<PlatformKey, string>> = {};
        for (const k of ['facebook', 'instagram', 'tiktok', 'reddit', 'x', 'threads', 'youtube'] as PlatformKey[]) {
          if (!c[k]) continue;
          const link = cellLink(cal, r, c[k]) || get(r, k);
          if (link && link !== '-' && isUrl(link)) links[k] = link;
        }
        let assetLink = c.asset ? cellLink(cal, r, c.asset) || get(r, 'asset') : '';
        if (assetLink && containsWalletAddress(assetLink)) {
          out.droppedLinks += 1;
          assetLink = '';
        }
        if (assetLink && !isUrl(assetLink)) assetLink = '';
        out.rows.push({
          row: r,
          kind: flex ? 'flex' : 'post',
          date,
          end: null,
          dateText,
          dayTheme: dayTheme || (date ? '' : ''),
          themeKey: themeKeyOf(dayTheme),
          designers: splitNames(designer).filter((n) => !/^all$/i.test(n)),
          title: cleanTitle,
          format: get(r, 'format').replace(/^-$/, ''),
          brief: get(r, 'brief'),
          status: get(r, 'status'),
          caption: get(r, 'caption'),
          assetLink,
          links,
        });
      }
      out.start = out.rows.filter((r) => r.kind === 'post' && r.date).map((r) => r.date as string).sort()[0] ?? null;
      // Rows that share a date with the row above inherit its theme.
      for (let i = 1; i < out.rows.length; i++) {
        const cur = out.rows[i];
        const prev = out.rows[i - 1];
        if (cur.kind === 'post' && !cur.themeKey && cur.date && cur.date === prev.date) {
          cur.themeKey = prev.themeKey;
          cur.dayTheme = prev.dayTheme;
        }
      }
    }
  }

  // ----- Carousel Briefs -----
  const briefs = findSheet(sheets, 'carousel', 'brief');
  if (briefs) {
    out.sheetsFound.push(briefs.name);
    let current: PlannerBrief | null = null;
    for (let r = 1; r <= briefs.maxRow; r++) {
      const a = cellText(briefs, r, 1);
      const b = cellText(briefs, r, 2);
      if (!a) continue;
      const slide = /^slide\s*(\d+)\s*(.*)$/is.exec(a);
      if (slide && current) {
        const extra = slide[2].replace(/\s+/g, ' ').trim();
        current.slides.push({ label: `Slide ${slide[1]}${extra ? ` · ${extra[0]}${extra.slice(1).toLowerCase()}` : ''}`, text: b });
        continue;
      }
      const head = /^(.*?)\(([^)]*)\)\s*[-–]\s*(.+)$/.exec(a);
      if (head) {
        current = { heading: a, date: parseDayText(head[2], out.year), title: head[3].trim(), slides: [] };
        out.briefs.push(current);
      }
    }
  }

  // ----- Idea Bank -----
  const ideaSheet = findSheet(sheets, 'idea bank', 'ideas');
  if (ideaSheet) {
    out.sheetsFound.push(ideaSheet.name);
    let category = 'Ideas';
    for (let r = 1; r <= ideaSheet.maxRow; r++) {
      const a = cellText(ideaSheet, r, 1);
      const b = cellText(ideaSheet, r, 2);
      const c = cellText(ideaSheet, r, 3);
      if (!a) continue;
      if (/^idea bank/i.test(a)) continue;
      // Section headings span the row (merged), so their other cells are empty or repeat the heading.
      if (/\bideas?\b/i.test(a) && (!b || b === a) && (!c || c === a)) {
        category = /educ/i.test(a) ? 'Educational (Mon)' : /video|reel/i.test(a) ? 'Video / Reel' : /fun|engag/i.test(a) ? 'Fun / Engagement (Fri)' : a;
        continue;
      }
      if (/^idea\s*\/\s*title$/i.test(a)) continue;
      out.ideas.push({ category, title: a, bestFor: b, format: c });
    }
  }

  // ----- WHAT IF & Concept Bank -----
  const conceptSheet = findSheet(sheets, 'what if', 'concept');
  if (conceptSheet) {
    out.sheetsFound.push(conceptSheet.name);
    for (let r = 1; r <= Math.min(6, conceptSheet.maxRow); r++) {
      const a = cellText(conceptSheet, r, 1);
      if (/^rules?\s*:/i.test(a)) out.conceptRules = a.replace(/^rules?\s*:\s*/i, '');
    }
    const hm = headerMap(
      conceptSheet,
      {
        n: (h) => h === '#' || h === 'no' || h === 'no.',
        series: (h) => h.startsWith('series'),
        subject: (h) => h.includes('subject') || h.includes('target'),
        lead: (h) => h.includes('designer') || h.includes('lead'),
        angle: (h) => h.includes('angle') || h.includes('hook'),
        timing: (h) => h.includes('timing'),
        status: (h) => h === 'status',
      },
      ['series', 'subject'],
    );
    if (hm) {
      const g = (r: number, k: string) => (hm.cols[k] ? cellText(conceptSheet, r, hm.cols[k]) : '');
      for (let r = hm.row + 1; r <= conceptSheet.maxRow; r++) {
        if (!g(r, 'subject') && !g(r, 'series')) continue;
        out.concepts.push({ n: Number(g(r, 'n')) || out.concepts.length + 1, series: g(r, 'series'), subject: g(r, 'subject'), lead: g(r, 'lead'), angle: g(r, 'angle'), timing: g(r, 'timing'), status: g(r, 'status') });
      }
    }
  }

  // ----- Performance Tracker -----
  const perf = findSheet(sheets, 'performance', 'tracker', 'results');
  if (perf) {
    out.sheetsFound.push(perf.name);
    const hm = headerMap(
      perf,
      {
        date: (h) => h.includes('date'),
        title: (h) => h.includes('title') || h === 'post',
        series: (h) => h.includes('series') || h.includes('theme'),
        designer: (h) => h.includes('designer'),
        platform: (h) => h.includes('platform'),
        views: (h) => h.startsWith('view'),
        reach: (h) => h.startsWith('reach'),
        likes: (h) => h.startsWith('like') || h.startsWith('reaction'),
        comments: (h) => h.startsWith('comment'),
        saves: (h) => h.startsWith('save'),
        shares: (h) => h.startsWith('share'),
      },
      ['title', 'views'],
    );
    if (hm) {
      const raw = (r: number, k: string) => (hm.cols[k] ? perf.rows.get(r)?.get(hm.cols[k])?.v ?? '' : '');
      const g = (r: number, k: string) => String(raw(r, k) ?? '').trim();
      let lastDate: string | null = null;
      const posts = out.rows.filter((x) => x.kind === 'post' && x.title);
      for (let r = hm.row + 1; r <= perf.maxRow; r++) {
        const rowText = [...(perf.rows.get(r)?.values() ?? [])].map((x) => String(x.v)).join(' ');
        if (/total/i.test(rowText)) break;
        const title = g(r, 'title');
        if (!title) continue;
        const rawDate = raw(r, 'date');
        let date = rawDate !== '' && rawDate !== null ? parseShortDate(rawDate as string | number) : null;
        if (!date) date = bestMatch(title, posts, (p) => p.title)?.date ?? lastDate;
        lastDate = date ?? lastDate;
        const platform = platformFromText(g(r, 'platform')) ?? 'facebook';
        out.metrics.push({
          row: r,
          date,
          title,
          series: g(r, 'series'),
          designer: g(r, 'designer'),
          platform,
          views: toNum(g(r, 'views')),
          reach: toNum(g(r, 'reach')),
          likes: toNum(g(r, 'likes')),
          comments: toNum(g(r, 'comments')),
          saves: toNum(g(r, 'saves')),
          shares: toNum(g(r, 'shares')),
        });
      }
    }
  }

  // ----- Hashtag & Caption Bank -----
  const bank = findSheet(sheets, 'hashtag', 'caption bank');
  if (bank) {
    out.sheetsFound.push(bank.name);
    const hm = headerMap(bank, { useFor: (h) => h.startsWith('use for') || h === 'use', block: (h) => h === 'block' || h.includes('text'), notes: (h) => h.startsWith('note') }, ['useFor', 'block']);
    if (hm) {
      for (let r = hm.row + 1; r <= bank.maxRow; r++) {
        const useFor = cellText(bank, r, hm.cols.useFor);
        const block = cellText(bank, r, hm.cols.block);
        if (!block) continue;
        out.snippets.push({ useFor, block: block.replace(/^"|"$/g, ''), notes: hm.cols.notes ? cellText(bank, r, hm.cols.notes) : '' });
      }
    }
  }

  return out;
}

/**
 * Where the already-done part of a planner ends: every row up to the end of the
 * last week that has a Posted row. (For the Jun–Nov 2026 planner: row 19, Jul 10.)
 */
export function defaultSkipRow(rows: PlannerRow[]): number {
  const posted = rows.filter((r) => r.kind === 'post' && r.date && statusFromPlanner(r.status) === 'posted');
  if (!posted.length) return 0;
  const lastPosted = posted.map((r) => r.date as string).sort().pop() as string;
  const weekEnd = addDays(mondayOf(lastPosted), 6);
  let skip = 0;
  for (const r of rows) {
    const d = r.kind === 'break' ? r.date : r.date;
    if (d && d <= weekEnd) skip = Math.max(skip, r.row);
  }
  return skip;
}

export const kindOfSnippet = (useFor: string, block: string): 'hashtags' | 'cta' | 'disclaimer' | 'caption' =>
  /disclaim/i.test(useFor) ? 'disclaimer' : /cta/i.test(useFor) ? 'cta' : block.trim().startsWith('#') ? 'hashtags' : 'caption';

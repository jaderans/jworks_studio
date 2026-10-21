import { alive, db } from '../db/db';
import { audit, build } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { reschedule, themeByKey } from '../domain/calendar';
import { splitPlatformCaptions } from '../domain/captions';
import { kindOfSnippet, splitNames, statusFromPlanner, type PlannerImport, type PlannerRow } from '../domain/planner';
import { bestMatch, similarity } from '../lib/text';
import { fmtIsoDate, mondayOnOrAfter, nextMonthStart, todayISO } from '../lib/time';
import { blankPost } from './content';
import { blankMetric } from './growth';
import { saveMember } from './team';
import type { Idea, Member, Metric, PlatformKey, Post, Snippet } from '../db/types';

export interface PlannerOptions {
  /** Rows up to and including this spreadsheet row are left out (already posted). */
  skipThroughRow: number;
  /** New start date for everything not posted yet; null keeps the planner's dates. */
  restartOn: string | null;
  team: boolean;
  themes: boolean;
  scripts: boolean;
  ideas: boolean;
  concepts: boolean;
  metrics: boolean;
  snippets: boolean;
  /** Use the planner's break weeks (instead of the last-Monday rule). */
  breaks: boolean;
  /** Remove the posts of earlier planner imports that weren't posted yet. */
  replaceOld: boolean;
}

/** Posts from one planner import share this id prefix. Older imports used the year alone. */
export const planPrefix = (p: Pick<PlannerImport, 'start' | 'year'>): string => (p.start ? `planner-${p.start.slice(0, 7)}` : `planner-${p.year}`);

/** Unposted posts that came from a different planner import. */
export async function oldPlanPosts(p: Pick<PlannerImport, 'start' | 'year'>): Promise<Post[]> {
  const prefix = planPrefix(p);
  return alive(await db.posts.toArray()).filter((x) => x.id.startsWith('planner-') && !x.id.startsWith(`${prefix}-`) && x.status !== 'posted');
}

export interface PreviewPost {
  row: PlannerRow;
  date: string | null;
  note: string;
}

export interface PlannerPreview {
  posts: PreviewPost[];
  /** Posts that need a decision (season over, no room). */
  unplaced: PreviewPost[];
  skipped: number;
  /** Unposted posts from an earlier planner that this import replaces. */
  replaced: number;
}

/** First Monday of next month — a calm restart that leaves time to batch content. */
export const defaultRestart = (today = todayISO()): string => mondayOnOrAfter(nextMonthStart(today));

export async function previewPlanner(p: PlannerImport, opts: PlannerOptions): Promise<PlannerPreview> {
  const cadence = await getSetting('cadence');
  const rows = p.rows.filter((r) => r.kind === 'post' && r.row > opts.skipThroughRow);
  const skipped = p.rows.filter((r) => r.kind === 'post' && r.row <= opts.skipThroughRow).length;
  const old = opts.replaceOld ? await oldPlanPosts(p) : [];
  const replaced = old.length;
  if (!opts.restartOn) return { posts: rows.filter((r) => r.date).map((row) => ({ row, date: row.date, note: '' })), unplaced: rows.filter((r) => !r.date).map((row) => ({ row, date: null, note: 'Backlog: no date yet' })), skipped, replaced };
  const oldIds = new Set(old.map((x) => x.id));
  const busy = new Set(alive(await db.posts.toArray()).filter((x) => x.date && x.status !== 'skipped' && !x.id.startsWith(`${planPrefix(p)}-`) && !oldIds.has(x.id)).map((x) => x.date as string));
  const posted = rows.filter((r) => statusFromPlanner(r.status) === 'posted');
  const open = rows.filter((r) => statusFromPlanner(r.status) !== 'posted');
  const res = reschedule(
    open.map((r) => ({ id: String(r.row), date: r.date, themeKey: r.themeKey, title: r.title, brief: r.brief, sort: r.row })),
    opts.restartOn,
    cadence,
    { busy },
  );
  const byId = new Map(open.map((r) => [String(r.row), r]));
  return {
    posts: [...posted.map((row) => ({ row, date: row.date, note: '' })), ...res.placed.map((x) => ({ row: byId.get(x.id) as PlannerRow, date: x.date, note: x.note }))],
    unplaced: res.unplaced.map((u) => ({ row: byId.get(u.id) as PlannerRow, date: null, note: u.reason })),
    skipped,
    replaced,
  };
}

const SERIES: [RegExp, string][] = [
  [/what ?if/i, 'WHAT IF'],
  [/concept drop/i, 'Concept Drop'],
  [/freebie/i, 'Freebie Friday'],
  [/client love/i, 'Client Love'],
  [/fun friday/i, 'Fun Friday'],
  [/^bts\b|behind the scenes/i, 'BTS'],
];
const seriesOf = (title: string) => SERIES.find(([re]) => re.test(title))?.[1] ?? '';

export interface ImportSummary {
  replaced: number;
  posts: number;
  backlog: number;
  members: number;
  ideas: number;
  scripts: number;
  metrics: number;
  snippets: number;
  alreadyThere: number;
  droppedLinks: number;
}

export async function applyPlanner(p: PlannerImport, opts: PlannerOptions, preview: PlannerPreview): Promise<ImportSummary> {
  const sum: ImportSummary = { replaced: 0, posts: 0, backlog: 0, members: 0, ideas: 0, scripts: 0, metrics: 0, snippets: 0, alreadyThere: 0, droppedLinks: p.droppedLinks };
  const cadence = await getSetting('cadence');
  const prefix = planPrefix(p);

  // ----- the older plan's unposted posts make way for this one -----
  if (opts.replaceOld) {
    const { deletePost } = await import('./content');
    for (const x of await oldPlanPosts(p)) {
      await deletePost(x.id);
      sum.replaced++;
    }
  }

  // ----- team -----
  const members: Member[] = alive(await db.members.toArray());
  const byName = (name: string) => members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
  const ensure = async (name: string, role = ''): Promise<Member | null> => {
    const n = name.trim();
    if (!n || /^(all|any|team)$/i.test(n)) return null;
    const found = byName(n);
    if (found) {
      if (role && !found.roleLabel) await db.members.put({ ...found, roleLabel: role, updatedAt: Date.now(), _sync: 1 });
      return found;
    }
    if (!opts.team) return null;
    const m = await saveMember({ name: n, roleLabel: role || 'Designer', appRole: 'designer' });
    members.push(m);
    sum.members++;
    return m;
  };
  for (const t of p.team) await ensure(t.name, t.role);
  const idsFor = async (names: string[] | string): Promise<string[]> => {
    const list = Array.isArray(names) ? names : splitNames(names);
    const out: string[] = [];
    for (const n of list) {
      const m = byName(n) ?? (opts.team ? await ensure(n) : null);
      if (m && !out.includes(m.id)) out.push(m.id);
    }
    return out;
  };

  // ----- weekly themes, rotation and the restart date -----
  const breakRows = p.rows.filter((r) => r.kind === 'break' && r.date && r.end);
  if (opts.themes || opts.restartOn || (opts.breaks && breakRows.length)) {
    const themes = cadence.themes.map((t) => {
      const from = opts.themes ? p.themes.find((x) => x.key === t.key) : undefined;
      if (!from) return t;
      const name = from.name === from.name.toUpperCase() ? from.name[0] + from.name.slice(1).toLowerCase() : from.name;
      return { ...t, name: name || t.name, description: from.description || t.description };
    });
    await setSetting('cadence', {
      ...cadence,
      themes,
      fridayRotation: opts.themes && p.fridayRotation.length ? p.fridayRotation : cadence.fridayRotation,
      // A paused calendar picks up on this plan's first post.
      resumeOn: opts.restartOn ?? (cadence.resumeOn && p.start && p.start > todayISO() ? p.start : cadence.resumeOn),
      ...(opts.breaks && breakRows.length
        ? {
            breakRule: false,
            breaks: [
              ...cadence.breaks.filter((b) => !breakRows.some((r) => r.date === b.start)),
              ...breakRows.map((r) => ({ start: r.date as string, end: r.end as string, label: (r.brief || r.title || 'Break week').split(/[.;]/)[0].slice(0, 80) })),
            ].sort((a, b) => a.start.localeCompare(b.start)),
          }
        : {}),
    });
  }

  // ----- posts -----
  const posts: Post[] = [];
  // The planner's own date for each imported post (for matching scripts to posts).
  const plannerDate = new Map<string, string | null>();
  const all = [...preview.posts, ...preview.unplaced];
  for (const x of all) {
    const r = x.row;
    const id = `${prefix}-r${r.row}`;
    if (await db.posts.get(id)) {
      sum.alreadyThere++;
      continue;
    }
    const caps = r.caption ? splitPlatformCaptions(r.caption) : { main: '', perPlatform: {} };
    const platforms = new Set<PlatformKey>(cadence.platforms);
    for (const k of Object.keys(caps.perPlatform) as PlatformKey[]) platforms.add(k);
    for (const k of Object.keys(r.links) as PlatformKey[]) platforms.add(k);
    const theme = themeByKey(cadence, r.themeKey);
    const status = statusFromPlanner(r.status);
    const rec = build<Post>({
      ...blankPost(),
      id,
      title: r.title || `${theme?.name ?? 'Post'} (topic to pick)`,
      date: x.date,
      time: cadence.defaultTimes.facebook ?? '',
      themeKey: r.themeKey,
      format: r.format,
      brief: r.brief,
      status: x.date === null && status === 'posted' ? 'posted' : status === 'skipped' ? 'todo' : status,
      assignees: await idsFor(r.designers),
      series: seriesOf(r.title),
      platforms: [...platforms],
      caption: caps.main,
      captions: caps.perPlatform,
      assetLink: r.assetLink,
      links: r.links,
      postedAt: status === 'posted' && r.date ? new Date(`${r.date}T19:00:00`).getTime() : null,
      note: [x.note, r.date && x.date !== r.date ? `Planned for ${fmtIsoDate(r.date)} in the planner (row ${r.row}).` : `From the planner, row ${r.row}.`].filter(Boolean).join(' '),
    });
    posts.push(rec);
    if (rec.date) sum.posts++;
    else sum.backlog++;
  }
  if (posts.length) await db.posts.bulkPut(posts);
  const importedPosts = alive(await db.posts.toArray()).filter((x) => x.id.startsWith(prefix));
  for (const x of all) plannerDate.set(`${prefix}-r${x.row.row}`, x.row.date);
  const plannedDate = (x: Post) => plannerDate.get(x.id) ?? x.date;

  // ----- carousel scripts -----
  if (opts.scripts) {
    for (let i = 0; i < p.briefs.length; i++) {
      const b = p.briefs[i];
      const id = `${prefix}-script${i + 1}`;
      if (await db.ideas.get(id)) {
        sum.alreadyThere++;
        continue;
      }
      const post = importedPosts.find((x) => plannedDate(x) === b.date && similarity(x.title, b.title) >= 0.3) ?? bestMatch(b.title, importedPosts, (x) => x.title, 0.5);
      const wasPosted = !post && p.rows.some((r) => r.date === b.date && statusFromPlanner(r.status) === 'posted');
      await db.ideas.put(
        build<Idea>({
          id,
          kind: 'script',
          title: b.title,
          category: 'Carousel script',
          bestFor: post?.assignees ?? [],
          bestForText: '',
          format: 'Carousel',
          angle: b.heading,
          timing: b.date ?? '',
          subject: '',
          status: post ? 'scheduled' : wasPosted ? 'used' : 'idea',
          postId: post?.id ?? null,
          slides: b.slides,
          tags: [],
          notes: '',
          sort: i,
        }),
      );
      if (post) await db.posts.update(post.id, { ideaId: id, updatedAt: Date.now(), _sync: 1 });
      sum.scripts++;
    }
  }

  // ----- idea bank -----
  if (opts.ideas) {
    for (let i = 0; i < p.ideas.length; i++) {
      const it = p.ideas[i];
      const id = `${prefix}-idea${i + 1}`;
      if (await db.ideas.get(id)) {
        sum.alreadyThere++;
        continue;
      }
      const post = bestMatch(it.title, importedPosts, (x) => x.title, 0.5);
      await db.ideas.put(
        build<Idea>({
          id,
          kind: 'idea',
          title: it.title,
          category: it.category,
          bestFor: await idsFor(it.bestFor),
          bestForText: it.bestFor,
          format: it.format,
          angle: '',
          timing: '',
          subject: '',
          status: post ? 'scheduled' : 'idea',
          postId: post?.id ?? null,
          slides: [],
          tags: [],
          notes: '',
          sort: i,
        }),
      );
      sum.ideas++;
    }
  }

  // ----- WHAT IF series and Concept Drops -----
  if (opts.concepts) {
    for (const c of p.concepts) {
      const id = `${prefix}-concept${c.n}`;
      if (await db.ideas.get(id)) {
        sum.alreadyThere++;
        continue;
      }
      const whatIf = /what ?if/i.test(c.series);
      const post = importedPosts.find((x) => (whatIf ? /what ?if/i.test(x.title) : /concept drop/i.test(x.title)) && similarity(x.title, c.subject) >= 0.2);
      await db.ideas.put(
        build<Idea>({
          id,
          kind: whatIf ? 'whatif' : 'concept',
          title: whatIf ? `WHAT IF: ${c.subject}` : `Concept Drop: ${c.subject}`,
          category: c.series,
          bestFor: await idsFor(c.lead),
          bestForText: c.lead,
          format: 'Carousel',
          angle: c.angle,
          timing: c.timing,
          subject: c.subject,
          status: post ? 'scheduled' : 'idea',
          postId: post?.id ?? null,
          slides: [],
          tags: [],
          notes: whatIf && p.conceptRules ? `Rules: ${p.conceptRules}` : '',
          sort: 100 + c.n,
        }),
      );
      sum.ideas++;
    }
  }

  // ----- past results -----
  if (opts.metrics) {
    for (const m of p.metrics) {
      const id = `${prefix}-m${m.row}`;
      if (await db.metrics.get(id)) {
        sum.alreadyThere++;
        continue;
      }
      const post = bestMatch(m.title, importedPosts, (x) => x.title, 0.6);
      await db.metrics.put(
        build<Metric>({
          ...blankMetric(),
          id,
          postId: post?.id ?? null,
          date: m.date ?? todayISO(),
          title: m.title,
          series: m.series,
          memberIds: await idsFor(m.designer),
          designerText: m.designer,
          platform: m.platform,
          views: m.views,
          reach: m.reach,
          likes: m.likes,
          comments: m.comments,
          saves: m.saves,
          shares: m.shares,
          notes: 'From the planner’s Performance Tracker.',
        }),
      );
      sum.metrics++;
    }
  }

  // ----- hashtag and caption bank -----
  if (opts.snippets) {
    for (let i = 0; i < p.snippets.length; i++) {
      const s = p.snippets[i];
      const id = `${prefix}-snip${i + 1}`;
      const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
      const same = alive(await db.snippets.toArray()).some((x) => squash(x.text) === squash(s.block));
      if (same || (await db.snippets.get(id))) {
        sum.alreadyThere++;
        continue;
      }
      await db.snippets.put(build<Snippet>({ id, kind: kindOfSnippet(s.useFor, s.block), label: s.useFor || `Block ${i + 1}`, text: s.block, useFor: s.useFor, notes: s.notes, sort: i }));
      sum.snippets++;
    }
  }

  await audit(
    'import',
    'app',
    null,
    `Imported the content planner: ${sum.replaced ? `replaced ${sum.replaced} unposted posts from the older plan, ` : ''}${sum.posts} posts on the calendar${sum.backlog ? `, ${sum.backlog} waiting for a date` : ''}${opts.restartOn ? ` (restarting ${opts.restartOn})` : ''}, ${sum.ideas} ideas, ${sum.scripts} scripts, ${sum.metrics} results`,
  );
  return sum;
}

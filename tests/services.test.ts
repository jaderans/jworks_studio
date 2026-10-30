import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { alive, db } from '../src/db/db';
import { ensureDevice } from '../src/db/local';
import { setActor, setWriterDevice } from '../src/db/write';
import { getSetting } from '../src/db/settings';
import { runSetup } from '../src/services/setup';
import { applyReschedule, createPost, decideApproval, deletePost, movePost, previewReschedule, requestApproval, saveIdea, scheduleIdea, setStatus } from '../src/services/content';
import { launchCampaign, blankCampaign, updateCampaign } from '../src/services/campaigns';
import { newContract, newProposal, saveClient, savePackage } from '../src/services/clients';
import { deleteTemplate, discardTemplatePrices, newTemplateContract } from '../src/services/documents';
import { exportAll, mergeBackup, parseBackup } from '../src/services/backup';
import { applyPlanner, previewPlanner, type PlannerOptions } from '../src/services/importPlanner';
import { CAMPAIGN_TEMPLATES, planTemplatePosts } from '../src/domain/campaignTemplates';
import { readXlsx } from '../src/domain/xlsx';
import { parsePlanner } from '../src/domain/planner';
import { DEFAULT_CADENCE } from '../src/domain/calendar';
import { addDays } from '../src/lib/time';

beforeEach(async () => {
  await db.delete();
  await db.open();
  const d = await ensureDevice();
  setWriterDevice(d.deviceId);
});

async function setup() {
  const ownerId = await runSetup({ businessName: 'JoshWorks', ownerName: 'Joshua', ownerRole: 'Brand, Logo & Shirt Design', pin: '', deviceName: 'Laptop', seedPackages: true });
  setActor(ownerId);
  return ownerId;
}

describe('setup', () => {
  it('creates the owner, starter packages and caption blocks', async () => {
    await setup();
    const members = alive(await db.members.toArray());
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ name: 'Joshua', appRole: 'owner' });
    expect(members[0].skills).toEqual(expect.arrayContaining(['branding', 'merch']));
    const pkgs = alive(await db.packages.toArray());
    expect(pkgs.filter((p) => p.kind === 'smm').sort((a, b) => a.sort - b.sort).map((p) => p.name)).toEqual(['Starter', 'Growth', 'Plus']);
    expect(alive(await db.contractTemplates.toArray()).length).toBeGreaterThanOrEqual(13);
    expect((await db.snippets.count()) > 0).toBe(true);
    expect((await getSetting('business')).name).toBe('JoshWorks');
  });
});

describe('posts', () => {
  it('runs a post from idea to approved to posted, with an audit trail', async () => {
    const owner = await setup();
    const p = await createPost({ title: 'Logo Types Explained', date: '2026-11-02', themeKey: 'mon-edu', assignees: [owner] });
    expect(p.time).toBe('19:00');
    expect(p.platforms).toEqual(DEFAULT_CADENCE.platforms);
    await requestApproval(p.id, 'Slides 1–8 done');
    expect((await db.posts.get(p.id))?.status).toBe('review');
    await decideApproval(p.id, true);
    const approved = await db.posts.get(p.id);
    expect(approved?.status).toBe('ready');
    expect(approved?.approval.state).toBe('approved');
    await setStatus(p.id, 'posted');
    expect((await db.posts.get(p.id))?.postedAt).toBeTypeOf('number');
    const comments = alive(await db.comments.where('postId').equals(p.id).toArray()).sort((a, b) => a.at - b.at);
    expect(comments.map((c) => c.kind)).toEqual(['request', 'approval']);
    const audit = (await db.audit.toArray()).map((a) => a.action);
    expect(audit).toEqual(expect.arrayContaining(['create', 'review', 'approve', 'status']));
  });

  it('moves a post and picks up the new day’s theme when it had none', async () => {
    await setup();
    const p = await createPost({ title: 'Untitled', date: null });
    await movePost(p.id, '2026-11-06');
    expect(await db.posts.get(p.id)).toMatchObject({ date: '2026-11-06', themeKey: 'fri-behind' });
  });

  it('schedules an idea and frees it again when the post is deleted', async () => {
    await setup();
    const idea = await saveIdea({ kind: 'idea', title: 'Vector vs Raster', category: 'Educational (Mon)' });
    const post = await scheduleIdea(idea.id, '2026-11-09');
    expect((await db.ideas.get(idea.id))?.status).toBe('scheduled');
    expect(post?.themeKey).toBe('mon-edu');
    await deletePost(post!.id);
    expect((await db.ideas.get(idea.id))?.status).toBe('idea');
  });

  it('reschedules around days that already have a post', async () => {
    await setup();
    await createPost({ title: 'Already there', date: '2026-11-09', themeKey: 'mon-edu' });
    const late = await createPost({ title: 'Late Monday post', date: '2026-07-13', themeKey: 'mon-edu' });
    const res = await previewReschedule([late.id], '2026-11-09');
    expect(res.placed[0].date).toBe('2026-11-16');
    await applyReschedule(res);
    expect((await db.posts.get(late.id))?.date).toBe('2026-11-16');
  });
});

describe('campaigns', () => {
  it('launches a template as a campaign, a funnel and posts on working days', async () => {
    await setup();
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'smm-launch')!;
    const rows = planTemplatePosts(t, '2026-11-02', DEFAULT_CADENCE).map((r) => ({ ...r, include: true, assignees: [] }));
    const c = await launchCampaign({ ...blankCampaign(), name: t.name, startDate: '2026-11-02', endDate: rows[rows.length - 1].date, ctaKeyword: 'SOCIAL', offer: t.offer }, rows, t.funnelTemplateId);
    const posts = alive(await db.posts.where('campaignId').equals(c.id).toArray());
    expect(posts).toHaveLength(t.posts.length);
    expect(posts.every((p) => p.funnelStage)).toBe(true);
    expect(posts.filter((p) => p.funnelStage === 'action').every((p) => p.cta === 'DM “SOCIAL”')).toBe(true);
    const funnel = await db.funnels.get(c.funnelId as string);
    expect(funnel?.stages).toHaveLength(5);
    expect(funnel?.stages.find((s) => s.key === 'action')?.offer).toBe(t.offer);
  });

  it('edits a campaign: new dates and color, and its unposted posts move with the start', async () => {
    await setup();
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'smm-launch')!;
    const rows = planTemplatePosts(t, '2026-11-02', DEFAULT_CADENCE).map((r) => ({ ...r, include: true, assignees: [] }));
    const c = await launchCampaign({ ...blankCampaign(), name: t.name, startDate: '2026-11-02', endDate: rows[rows.length - 1].date }, rows, t.funnelTemplateId);
    const before = alive(await db.posts.where('campaignId').equals(c.id).toArray());
    await db.posts.update(before[0].id, { status: 'posted' });
    const { moved } = await updateCampaign({ ...c, startDate: '2026-11-09', endDate: '2026-12-20', color: '#7B61FF' }, true);
    expect(moved).toBe(before.length - 1);
    const saved = await db.campaigns.get(c.id);
    expect(saved).toMatchObject({ startDate: '2026-11-09', endDate: '2026-12-20', color: '#7B61FF' });
    const after = new Map(alive(await db.posts.where('campaignId').equals(c.id).toArray()).map((p) => [p.id, p.date]));
    expect(after.get(before[0].id)).toBe(before[0].date);
    expect(after.get(before[1].id)).toBe(addDays(before[1].date as string, 7));
    // An end before the start is saved as the start.
    await updateCampaign({ ...(saved as typeof c), endDate: '2026-11-01' }, false);
    expect((await db.campaigns.get(c.id))?.endDate).toBe('2026-11-09');
  });
});

describe('video series campaign', () => {
  it('puts the ten videos on the calendar at 7:00 PM from the week of Nov 16', async () => {
    await setup();
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === 'video-series')!;
    const rows = planTemplatePosts(t, '2026-11-16', DEFAULT_CADENCE).map((r) => ({ ...r, include: true, assignees: [] }));
    const c = await launchCampaign({ ...blankCampaign(), name: t.name, startDate: '2026-11-16', endDate: rows[rows.length - 1].date, ctaKeyword: t.ctaKeyword, offer: t.offer }, rows, t.funnelTemplateId);
    const posts = alive(await db.posts.where('campaignId').equals(c.id).toArray()).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    expect(posts).toHaveLength(10);
    expect(posts.every((p) => p.time === '19:00' && p.format === 'Reel')).toBe(true);
    expect(posts[0]).toMatchObject({ date: '2026-11-16', title: 'Vector fisheye text in 10 seconds' });
  });
});

describe('clients, proposals and contracts', () => {
  it('numbers proposals and fills a contract from the client and package', async () => {
    await setup();
    const starter = alive(await db.packages.toArray()).find((p) => p.name === 'Starter')!;
    const client = await saveClient({ name: 'Kape Ilonggo', contactName: 'Ana', location: 'Jaro, Iloilo City', packageId: starter.id, startDate: '2026-11-02' });
    const p1 = await newProposal({ clientId: client.id, clientName: client.name });
    const p2 = await newProposal();
    expect(p1.number).toMatch(/^P-\d{4}-001$/);
    expect(p2.number).toMatch(/^P-\d{4}-002$/);
    const c = await newContract({ clientId: client.id, packageId: starter.id });
    expect(c.number).toMatch(/^C-\d{4}-001$/);
    expect(c.fields['client.name']).toBe('Kape Ilonggo');
    expect(c.fields.fee).toBe('₱4,500 a month');
    expect(c.fields['studio.signatory']).toContain('Joshua');
    expect(c.sections.length).toBeGreaterThanOrEqual(11);
  });
});

describe('contract templates: their own prices, and deleting one', () => {
  it('keeps contracts working after their template is deleted, and archives its own prices', async () => {
    await setup();
    const tpl = alive(await db.contractTemplates.toArray())[0];
    const own = await savePackage({ name: 'Cafe starter', kind: 'design', price: 500000, category: 'Cafe packages', templateId: tpl.id });
    expect(own.templateId).toBe(tpl.id);
    const c = await newTemplateContract({ templateId: tpl.id });
    const { contracts } = await deleteTemplate(tpl.id);
    expect(contracts).toBe(1);
    expect((await db.contractTemplates.get(tpl.id))?.deleted).toBe(1);
    expect((await db.packages.get(own.id))?.active).toBe(0);
    // The contract still finds its template: deleted records stay readable.
    expect((await db.contractTemplates.get(c.templateId!))?.name).toBe(tpl.name);
  });

  it('archives the prices made for a template that was never saved', async () => {
    await setup();
    const kept = alive(await db.contractTemplates.toArray())[0];
    const draft = await savePackage({ name: 'Menu board', kind: 'design', price: 150000, category: 'Cafe packages', templateId: 'tpl-never-saved' });
    const mine = await savePackage({ name: 'Logo', kind: 'design', price: 300000, category: 'Mine', templateId: kept.id });
    await discardTemplatePrices('tpl-never-saved');
    await discardTemplatePrices(kept.id);
    expect((await db.packages.get(draft.id))?.active).toBe(0);
    expect((await db.packages.get(mine.id))?.active).toBe(1);
  });
});

describe('backups', () => {
  it('exports and merges without duplicating anything', async () => {
    await setup();
    await createPost({ title: 'One', date: '2026-11-02' });
    const file = parseBackup(JSON.stringify(await exportAll()));
    const before = await db.posts.count();
    const s = await mergeBackup(file);
    expect(s.added).toBe(0);
    expect(await db.posts.count()).toBe(before);
  });
});

const REAL = 'Jworks Previous Campaigns/JoshWorks_Content_Planner_Jun15-Nov_2026 (1).xlsx';

describe.skipIf(!existsSync(REAL))('importing the real planner', () => {
  const opts: PlannerOptions = { skipThroughRow: 19, restartOn: '2026-11-02', team: true, themes: true, scripts: true, ideas: true, concepts: true, metrics: true, snippets: true, breaks: false, replaceOld: true };

  it('brings in the team, the rescheduled posts, scripts, ideas and results — once', async () => {
    await setup();
    const parsed = parsePlanner(readXlsx(new Uint8Array(readFileSync(REAL))));
    const preview = await previewPlanner(parsed, opts);
    const sum = await applyPlanner(parsed, opts, preview);
    expect(sum.posts).toBe(61);
    expect(sum.backlog).toBe(3);
    expect(sum.members).toBe(4);
    const members = alive(await db.members.toArray());
    expect(members.map((m) => m.name).sort()).toEqual(['CJ', 'Harvey', 'Joshua', 'Kaye', 'Renz']);
    expect(members.find((m) => m.name === 'Joshua')?.appRole).toBe('owner');
    const posts = alive(await db.posts.toArray());
    expect(posts.every((p) => !p.date || p.date >= '2026-11-02')).toBe(true);
    expect(posts.some((p) => /DTI/i.test(p.title))).toBe(false);
    const typography = posts.find((p) => p.title.startsWith('Typography 101'))!;
    // Mon, Nov 2 is All Souls' Day, so it opens the week on the Wednesday flex day.
    expect(typography).toMatchObject({ date: '2026-11-04', status: 'ready', themeKey: 'mon-edu' });
    expect(typography.assetLink).toContain('drive.google.com');
    const rebrand = posts.find((p) => p.title === '5 Signs Your Brand Needs a Rebrand')!;
    const script = await db.ideas.get(rebrand.ideaId as string);
    expect(script?.slides).toHaveLength(7);
    const kayeId = members.find((m) => m.name === 'Kaye')!.id;
    const joshId = members.find((m) => m.name === 'Joshua')!.id;
    expect(posts.find((p) => p.title.startsWith('WHAT IF #4'))?.assignees.sort()).toEqual([joshId, kayeId].sort());
    expect((await getSetting('cadence')).resumeOn).toBe('2026-11-02');
    expect(sum.metrics).toBe(7);
    expect(sum.scripts).toBe(3);

    const again = await applyPlanner(parsed, opts, await previewPlanner(parsed, opts));
    expect(again.posts + again.backlog).toBe(0);
    expect(again.alreadyThere).toBeGreaterThan(100);
    expect(alive(await db.posts.toArray())).toHaveLength(64);
  });
});

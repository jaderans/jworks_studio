import { alive, db } from '../db/db';
import { audit, create, patch, remove, save } from '../db/write';
import { getSetting } from '../db/settings';
import { FUNNEL_TEMPLATES, emptyStages } from '../domain/funnel';
import { themeForDate } from '../domain/calendar';
import { createPost } from './content';
import type { Campaign, Funnel, FunnelStage, Persona } from '../db/types';

export const EMPTY_PERSONA: Persona = { name: '', who: '', pains: '', wants: '', objections: '', whereTheyAre: '', triggers: '' };

export function blankCampaign(fields: Partial<Campaign> = {}): Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    clientId: null,
    status: 'draft',
    goal: 'leads',
    service: '',
    templateId: '',
    startDate: '',
    endDate: '',
    audience: EMPTY_PERSONA,
    offer: '',
    keyMessage: '',
    ctaKeyword: '',
    leadMagnet: '',
    channels: ['facebook', 'instagram'],
    budget: null,
    kpis: [],
    funnelId: null,
    notes: '',
    ...fields,
  };
}

export async function saveCampaign(c: Partial<Campaign> & { name: string }): Promise<Campaign> {
  if (c.id) {
    const prev = await db.campaigns.get(c.id);
    if (prev) return save(db.campaigns, { ...prev, ...c } as Campaign);
  }
  const rec = await create<Campaign>(db.campaigns, blankCampaign(c));
  await audit('create', 'campaign', rec.id, `Started the campaign “${rec.name}”`);
  return rec;
}

export interface PlannedRow {
  date: string;
  /** HH:MM, or '' for the platform's default time. */
  time?: string;
  title: string;
  format: string;
  stage: FunnelStage;
  brief: string;
  series: string;
  assignees: string[];
  include: boolean;
}

/** Create a campaign, its funnel and its posts in one go (from the campaign builder). */
export async function launchCampaign(c: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'funnelId'>, rows: PlannedRow[], funnelTemplateId: string): Promise<Campaign> {
  const cadence = await getSetting('cadence');
  const campaign = await saveCampaign({ ...c, funnelId: null });
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === funnelTemplateId);
  const funnel = await create<Funnel>(db.funnels, {
    name: `${campaign.name} funnel`,
    clientId: campaign.clientId,
    campaignId: campaign.id,
    templateId: tpl?.id ?? '',
    stages: tpl ? tpl.stages.map((s) => ({ ...s, cta: s.key === 'action' && c.ctaKeyword ? `DM “${c.ctaKeyword}”` : s.cta, offer: s.key === 'action' && c.offer ? c.offer : s.offer })) : emptyStages(),
    notes: '',
  });
  await patch(db.campaigns, campaign.id, { funnelId: funnel.id });
  for (const r of rows.filter((x) => x.include)) {
    await createPost({
      title: r.title,
      date: r.date,
      ...(r.time ? { time: r.time } : {}),
      themeKey: themeForDate(cadence, r.date)?.key ?? '',
      format: r.format,
      brief: r.brief,
      assignees: r.assignees,
      clientId: campaign.clientId,
      campaignId: campaign.id,
      funnelStage: r.stage,
      series: r.series,
      platforms: c.channels.length ? c.channels : cadence.platforms,
      cta: r.stage === 'action' && c.ctaKeyword ? `DM “${c.ctaKeyword}”` : '',
      status: 'todo',
    });
  }
  return { ...campaign, funnelId: funnel.id };
}

export async function deleteCampaign(id: string, withPosts: boolean): Promise<void> {
  const c = await db.campaigns.get(id);
  const posts = alive(await db.posts.where('campaignId').equals(id).toArray());
  for (const p of posts) {
    if (withPosts && p.status !== 'posted') await remove(db.posts, p.id);
    else await patch(db.posts, p.id, { campaignId: null });
  }
  if (c?.funnelId) await patch(db.funnels, c.funnelId, { campaignId: null });
  await remove(db.campaigns, id);
  await audit('delete', 'campaign', id, `Deleted the campaign “${c?.name ?? ''}”`);
}

// ----- funnels -----

export async function saveFunnel(f: Partial<Funnel> & { name: string }): Promise<Funnel> {
  if (f.id) {
    const prev = await db.funnels.get(f.id);
    if (prev) return save(db.funnels, { ...prev, ...f } as Funnel);
  }
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === f.templateId);
  return create<Funnel>(db.funnels, {
    name: f.name,
    clientId: f.clientId ?? null,
    campaignId: f.campaignId ?? null,
    templateId: f.templateId ?? '',
    stages: f.stages ?? (tpl ? tpl.stages.map((s) => ({ ...s })) : emptyStages()),
    notes: f.notes ?? '',
  });
}

export async function deleteFunnel(id: string): Promise<void> {
  const camps = alive(await db.campaigns.toArray()).filter((c) => c.funnelId === id);
  for (const c of camps) await patch(db.campaigns, c.id, { funnelId: null });
  await remove(db.funnels, id);
}

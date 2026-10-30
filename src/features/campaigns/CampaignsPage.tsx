import { useMemo, useState, type CSSProperties } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router';
import { Megaphone, Pencil, Plus, Rocket, Trash2, Wand2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, PageHeader, Segmented, Tabs, Toggle } from '../../components/ui';
import { Field, MoneyInput, Select, TextArea, TextInput } from '../../components/form';
import { FilterBar } from '../../components/FilterBar';
import { Dialog } from '../../components/Dialog';
import { FunnelChart, Meter } from '../../components/charts';
import { MemberDots, StatusBadge, useMemberMap } from '../../components/people';
import { useCampaigns, useClients, useFunnels, useMembers, useMetrics, usePosts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { CAMPAIGN_TEMPLATES, GOAL_LABEL, SERVICE_LABEL, planTemplatePosts, type CampaignTemplate } from '../../domain/campaignTemplates';
import { FUNNEL_TEMPLATES, STAGES, STAGE_META, coverage } from '../../domain/funnel';
import { SEASONS, nextWindow, upcomingDates } from '../../domain/seasons';
import { restartDay, spreadToFreeDays } from '../../domain/calendar';
import { PLATFORMS, PLATFORM_ORDER } from '../../domain/platforms';
import { compactNumber, totals } from '../../domain/metrics';
import { EMPTY_PERSONA, blankCampaign, deleteCampaign, deleteFunnel, launchCampaign, saveCampaign, saveFunnel, updateCampaign, type PlannedRow } from '../../services/campaigns';
import { CAMPAIGN_COLORS, campaignColor, campaignEnd, nextCampaignColor } from '../../domain/campaignDays';
import { addDays, daysFrom, fmtDateRange, fmtIsoDate, fmtIsoWeekday, mondayOnOrAfter, todayISO } from '../../lib/time';
import { PostDialog } from '../calendar/PostDialog';
import type { Campaign, CampaignGoal, Funnel, FunnelStage, Kpi, Persona, ServiceKey } from '../../db/types';

export default function CampaignsPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [building, setBuilding] = useState<CampaignTemplate | 'blank' | 'pick' | null>(() => (params.get('new') ? 'pick' : null));
  const closeBuilder = () => {
    setBuilding(null);
    if (params.get('new')) setParams({}, { replace: true });
  };
  return (
    <div className="page">
      <PageHeader
        title="Campaigns"
        subtitle="A goal, an audience, one offer and a short run of posts that move people from seeing you to messaging you."
        actions={
          app.can('editCampaigns') ? (
            <Button variant="primary" onClick={() => setBuilding('pick')}>
              <Megaphone size={18} /> New campaign
            </Button>
          ) : undefined
        }
      />
      <Tabs
        items={[
          { to: '/campaigns', label: 'Campaigns', end: true },
          { to: '/campaigns/funnels', label: 'Funnels' },
          { to: '/campaigns/seasons', label: 'Seasons & dates' },
        ]}
      />
      <Routes>
        <Route index element={<CampaignList onNew={() => setBuilding('pick')} />} />
        <Route path="funnels" element={<Funnels />} />
        <Route path="seasons" element={<Seasons onUse={(t) => setBuilding(t)} />} />
      </Routes>
      <CampaignBuilder start={building} onClose={closeBuilder} />
    </div>
  );
}

function CampaignList({ onNew }: { onNew: () => void }) {
  const app = useApp();
  const campaigns = useCampaigns();
  const posts = usePosts() ?? [];
  const metrics = useMetrics() ?? [];
  const clients = useClients() ?? [];
  const [params, setParams] = useSearchParams();
  // The calendar links here with ?open=<campaign>.
  const [open, setOpen] = useState<string | null>(() => params.get('open'));
  const closeOne = () => {
    setOpen(null);
    if (params.get('open')) setParams({}, { replace: true });
  };
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Campaign['status']>('');
  const [goal, setGoal] = useState<'' | CampaignGoal>('');
  const all = (campaigns ?? []).filter((c) => app.inScope(c.clientId));
  const needle = q.trim().toLowerCase();
  const list = all.filter(
    (c) =>
      (!status || c.status === status) &&
      (!goal || c.goal === goal) &&
      (!needle || `${c.name} ${c.offer} ${clients.find((x) => x.id === c.clientId)?.name ?? ''}`.toLowerCase().includes(needle)),
  );
  if (!campaigns) return null;
  if (!all.length)
    return (
      <EmptyState icon={<Megaphone size={40} />} title="No campaigns yet" action={app.can('editCampaigns') ? <Button variant="primary" onClick={onNew}>Plan one from a template</Button> : undefined}>
        Pick a template (rebrand month, merch drop, Paskua giveaways, your SMM launch…) and the posts land on the calendar.
      </EmptyState>
    );
  return (
    <div className="stack">
      <FilterBar
        id="campaigns"
        search={{ value: q, onChange: setQ, placeholder: 'Search campaigns, offers or clients' }}
        active={(status ? 1 : 0) + (goal ? 1 : 0)}
        onClear={() => {
          setQ('');
          setStatus('');
          setGoal('');
        }}
      >
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
        </Select>
        <Select aria-label="Goal" value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)}>
          <option value="">Every goal</option>
          {(Object.keys(GOAL_LABEL) as CampaignGoal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </Select>
      </FilterBar>
      {list.length === 0 ? <EmptyState title="Nothing matches" /> : null}
      <div className="trend-grid">
        {list.map((c) => {
          const mine = posts.filter((p) => p.campaignId === c.id);
          const done = mine.filter((p) => p.status === 'posted').length;
          const res = totals(metrics.filter((m) => m.postId && mine.some((p) => p.id === m.postId)));
          const client = clients.find((x) => x.id === c.clientId);
          return (
            <button key={c.id} type="button" className="card trend-card" style={{ textAlign: 'left', cursor: 'pointer', boxShadow: `inset 4px 0 0 ${campaignColor(c)}` }} onClick={() => setOpen(c.id)}>
              <div className="row between top">
                <h3>{c.name}</h3>
                <Badge tone={c.status === 'active' ? 'good' : c.status === 'draft' ? 'teal' : undefined}>{c.status}</Badge>
              </div>
              <span className="small muted">
                {client ? `${client.name} · ` : ''}
                {fmtDateRange(c.startDate, campaignEnd(c))} · {GOAL_LABEL[c.goal]}
              </span>
              {c.offer ? (
                <span className="small">
                  <b>Offer:</b> {c.offer}
                </span>
              ) : null}
              {c.ctaKeyword ? <Badge tone="yellow">DM “{c.ctaKeyword}”</Badge> : null}
              <div className="prog" aria-label={`${done} of ${mine.length} posts posted`}>
                <span style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }} />
              </div>
              <span className="tiny muted">
                {done}/{mine.length} posted · {compactNumber(res.views)} views · {compactNumber(res.shares)} shares · {res.leads} leads
              </span>
            </button>
          );
        })}
      </div>
      <CampaignDetail id={open} onClose={closeOne} />
    </div>
  );
}

function CampaignDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const campaigns = useCampaigns() ?? [];
  const posts = usePosts() ?? [];
  const metrics = useMetrics() ?? [];
  const funnels = useFunnels() ?? [];
  const memberMap = useMemberMap();
  const [postOpen, setPostOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const c = campaigns.find((x) => x.id === id);
  if (!c) return null;
  const mine = posts.filter((p) => p.campaignId === c.id).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const res = totals(metrics.filter((m) => m.postId && mine.some((p) => p.id === m.postId)));
  const funnel = funnels.find((f) => f.id === c.funnelId);
  const cov = coverage(mine);
  const actual = (k: Kpi['metric']): number => (k === 'sales' ? 0 : (res as unknown as Record<string, number>)[k] ?? 0);
  const edit = app.can('editCampaigns');
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      size="wide"
      title={c.name}
      footer={
        edit ? (
          <>
            <Button
              variant="danger"
              onClick={async () => {
                const withPosts = await app.confirm({ title: 'Delete this campaign?', message: 'Its unposted posts are deleted too. Posted ones stay on the calendar.', confirmLabel: 'Delete', tone: 'danger' });
                if (!withPosts) return;
                await deleteCampaign(c.id, true);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <span className="grow" />
            <Button onClick={() => setEditing(true)}>
              <Pencil size={16} /> Edit
            </Button>
            <Select aria-label="Status" value={c.status} onChange={(e) => saveCampaign({ ...c, status: e.target.value as Campaign['status'] })} style={{ width: 'auto' }}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
            </Select>
          </>
        ) : undefined
      }
    >
      <dl className="kv">
        <dt>Dates</dt>
        <dd>
          <span className="camp-dot" style={{ '--camp': campaignColor(c) } as CSSProperties} aria-hidden="true" /> {fmtDateRange(c.startDate, campaignEnd(c))}
        </dd>
        <dt>Goal</dt>
        <dd>{GOAL_LABEL[c.goal]}</dd>
        {c.offer ? (
          <>
            <dt>Offer</dt>
            <dd>{c.offer}</dd>
          </>
        ) : null}
        {c.keyMessage ? (
          <>
            <dt>Key message</dt>
            <dd>{c.keyMessage}</dd>
          </>
        ) : null}
        {c.ctaKeyword ? (
          <>
            <dt>DM keyword</dt>
            <dd>“{c.ctaKeyword}”</dd>
          </>
        ) : null}
        {c.audience.who ? (
          <>
            <dt>Audience</dt>
            <dd>
              {c.audience.who}
              {c.audience.pains ? <div className="muted small">Pains: {c.audience.pains}</div> : null}
            </dd>
          </>
        ) : null}
      </dl>
      {c.kpis.length ? (
        <div className="stack">
          <h3>Targets</h3>
          {c.kpis.map((k) => (
            <Meter key={k.metric} label={k.metric === 'leads' ? 'Leads (DMs, inquiries)' : k.metric[0].toUpperCase() + k.metric.slice(1)} value={actual(k.metric)} target={k.target} />
          ))}
          <p className="tiny muted">Numbers come from results logged on this campaign’s posts. Log sales on the client or in your notes.</p>
        </div>
      ) : null}
      <div className="stack">
        <h3>Funnel</h3>
        <FunnelChart counts={cov.counts} labels={Object.fromEntries((funnel?.stages ?? []).map((s) => [s.key, s.goal])) as Partial<Record<FunnelStage, string>>} />
        {cov.empty.length ? <Callout tone="warn">No posts for {cov.empty.map((s) => STAGE_META[s].label).join(', ')} yet. People drop out where a stage is empty.</Callout> : null}
      </div>
      <div className="stack">
        <h3>Posts</h3>
        <div className="card flush">
          <div className="list">
            {mine.map((p) => (
              <button key={p.id} type="button" className="list-item click" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', width: '100%' }} onClick={() => setPostOpen(p.id)}>
                <span className="main-text">
                  <b>{p.title}</b>
                  <span>
                    {p.date ? fmtIsoWeekday(p.date) : 'No date'} · {p.funnelStage ? STAGE_META[p.funnelStage].label : 'No stage'}
                  </span>
                </span>
                <MemberDots ids={p.assignees} members={memberMap} />
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <PostDialog open={!!postOpen} postId={postOpen} onClose={() => setPostOpen(null)} />
      <CampaignEditor campaign={editing ? c : null} onClose={() => setEditing(false)} />
    </Dialog>
  );
}

type CampaignFields = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'funnelId'>;

/** Change a campaign after it's made: its basics, dates and color, audience, targets and notes. */
function CampaignEditor({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const app = useApp();
  const posts = usePosts() ?? [];
  const [c, setC] = useState<Campaign | null>(null);
  const [part, setPart] = useState<'basics' | 'audience' | 'kpis' | 'notes'>('basics');
  const [movePosts, setMovePosts] = useState(true);
  const [busy, setBusy] = useState(false);
  if (campaign && (!c || c.id !== campaign.id)) {
    setC({ ...structuredClone(campaign), color: campaignColor(campaign), endDate: campaignEnd(campaign) });
    setPart('basics');
    setMovePosts(true);
  }
  if (!campaign && c) setC(null);
  if (!campaign || !c) return null;
  const shift = campaign.startDate && c.startDate ? daysFrom(campaign.startDate, c.startDate) : 0;
  const movable = posts.filter((p) => p.campaignId === c.id && p.date && p.status !== 'posted' && p.status !== 'skipped').length;
  const save = async () => {
    setBusy(true);
    try {
      const { moved } = await updateCampaign({ ...c, name: c.name.trim() }, movePosts && shift !== 0);
      app.toast(moved ? `Saved. ${moved} post${moved === 1 ? '' : 's'} moved ${Math.abs(shift)} day${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'later' : 'earlier'}.` : 'Campaign saved', { tone: 'good' });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      fullPhone
      title={`Edit ${campaign.name}`}
      footer={
        <>
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !c.name.trim() || !c.startDate} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <Segmented<typeof part>
        label="Part"
        value={part}
        onChange={setPart}
        options={[
          { value: 'basics', label: 'Basics & dates' },
          { value: 'audience', label: 'Audience' },
          { value: 'kpis', label: 'Targets' },
          { value: 'notes', label: 'Notes' },
        ]}
      />
      {part === 'basics' ? (
        <div className="stack">
          <BasicsFields c={c} setC={setC} endHint="The calendar highlights every day from the start to the end." />
          {shift && movable ? (
            <Toggle
              id="ce-move"
              checked={movePosts}
              onChange={setMovePosts}
              label={`Move its ${movable} unposted post${movable === 1 ? '' : 's'} ${Math.abs(shift)} day${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'later' : 'earlier'} too`}
            />
          ) : null}
        </div>
      ) : null}
      {part === 'audience' ? <AudienceFields c={c} setC={setC} /> : null}
      {part === 'kpis' ? <KpiFields c={c} setC={setC} /> : null}
      {part === 'notes' ? (
        <Field label="Notes" htmlFor="ce-notes">
          <TextArea id="ce-notes" rows={8} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} />
        </Field>
      ) : null}
    </Dialog>
  );
}

/** Name, who it's for, dates, color, goal, offer and message: the builder's first step and the editor's first part. */
function BasicsFields<T extends CampaignFields>({ c, setC, startHint, endHint, onStart }: { c: T; setC: (c: T) => void; startHint?: string; endHint?: string; onStart?: (v: string) => void }) {
  const clients = useClients() ?? [];
  return (
    <div className="form-grid">
      <Field label="Campaign name" htmlFor="cb-name" className="span-2">
        <TextInput id="cb-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </Field>
      <Field label="For" htmlFor="cb-client">
        <Select id="cb-client" value={c.clientId ?? ''} onChange={(e) => setC({ ...c, clientId: e.target.value || null })}>
          <option value="">JoshWorks (our pages)</option>
          {clients.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Color on the calendar" htmlFor="cb-color">
        <ColorField id="cb-color" value={c.color ?? CAMPAIGN_COLORS[0]} onChange={(color) => setC({ ...c, color })} />
      </Field>
      <Field label="Starts" htmlFor="cb-start" hint={startHint}>
        <input id="cb-start" type="date" className="input" value={c.startDate} onChange={(e) => (onStart ? onStart(e.target.value) : setC({ ...c, startDate: e.target.value }))} />
      </Field>
      <Field label="Ends" htmlFor="cb-end" hint={endHint} error={c.endDate && c.startDate && c.endDate < c.startDate ? 'The end is before the start.' : undefined}>
        <input id="cb-end" type="date" className="input" min={c.startDate || undefined} value={c.endDate} onChange={(e) => setC({ ...c, endDate: e.target.value })} />
      </Field>
      <Field label="Goal" htmlFor="cb-goal">
        <Select id="cb-goal" value={c.goal} onChange={(e) => setC({ ...c, goal: e.target.value as CampaignGoal })}>
          {(Object.keys(GOAL_LABEL) as CampaignGoal[]).map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Service" htmlFor="cb-svc">
        <Select id="cb-svc" value={c.service} onChange={(e) => setC({ ...c, service: e.target.value as ServiceKey })}>
          <option value="">None</option>
          {(Object.keys(SERVICE_LABEL) as ServiceKey[]).map((x) => (
            <option key={x} value={x}>
              {SERVICE_LABEL[x]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="The offer" htmlFor="cb-offer" className="span-2" hint="One clear offer per campaign.">
        <TextInput id="cb-offer" value={c.offer} onChange={(e) => setC({ ...c, offer: e.target.value })} />
      </Field>
      <Field label="Key message" htmlFor="cb-msg" className="span-2">
        <TextInput id="cb-msg" value={c.keyMessage} onChange={(e) => setC({ ...c, keyMessage: e.target.value })} />
      </Field>
      <Field label="DM / comment keyword" htmlFor="cb-kw" hint="People comment or DM this word; reply with the rate sheet or link.">
        <TextInput id="cb-kw" value={c.ctaKeyword} onChange={(e) => setC({ ...c, ctaKeyword: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
      </Field>
      <Field label="Lead magnet" htmlFor="cb-lm" hint="A freebie worth messaging for.">
        <TextInput id="cb-lm" value={c.leadMagnet} onChange={(e) => setC({ ...c, leadMagnet: e.target.value })} />
      </Field>
      <Field label="Ad budget (optional)" htmlFor="cb-budget">
        <MoneyInput id="cb-budget" value={c.budget} onChange={(v) => setC({ ...c, budget: v })} />
      </Field>
      <Field label="Channels" className="span-2">
        <div className="chip-row">
          {PLATFORM_ORDER.slice(0, 7).map((k) => {
            const on = c.channels.includes(k);
            return (
              <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => setC({ ...c, channels: on ? c.channels.filter((x) => x !== k) : [...c.channels, k] })}>
                {PLATFORMS[k].label}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

/** Swatches from the campaign palette, plus any color. */
function ColorField({ id, value, onChange }: { id: string; value: string; onChange: (color: string) => void }) {
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {CAMPAIGN_COLORS.map((col) => (
        <button key={col} type="button" className="swatch" aria-label={`Color ${col}`} aria-pressed={value.toLowerCase() === col.toLowerCase()} style={{ background: col }} onClick={() => onChange(col)} />
      ))}
      <input id={id} type="color" className="swatch-input" aria-label="Any color" title="Any color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const PERSONA_FIELDS = [
  ['name', 'Persona name', 'e.g. Iloilo café owner'],
  ['who', 'Who they are', 'Age, job, where they live'],
  ['pains', 'What frustrates them', ''],
  ['wants', 'What they want', ''],
  ['objections', 'What makes them hesitate', '“Too expensive”, “I can do it in Canva”'],
  ['whereTheyAre', 'Where they hang out online', ''],
  ['triggers', 'When they buy', 'Opening, payday, peak season'],
] as [keyof Persona, string, string][];

function AudienceFields<T extends CampaignFields>({ c, setC }: { c: T; setC: (c: T) => void }) {
  return (
    <div className="form-grid">
      <Callout tone="info">Write one real person. The clearer the persona, the better the hooks — and the assistant uses this too.</Callout>
      <span />
      {PERSONA_FIELDS.map(([k, label, ph]) => (
        <Field key={k} label={label} htmlFor={`pe-${k}`}>
          <TextArea id={`pe-${k}`} rows={2} value={c.audience[k]} placeholder={ph} onChange={(e) => setC({ ...c, audience: { ...c.audience, [k]: e.target.value } })} />
        </Field>
      ))}
    </div>
  );
}

function KpiFields<T extends CampaignFields>({ c, setC }: { c: T; setC: (c: T) => void }) {
  return (
    <div className="stack">
      <p className="muted">What would make this campaign a win? Results logged on its posts fill these in.</p>
      {c.kpis.map((k, i) => (
        <div key={i} className="row wrap">
          <select className="select" style={{ width: 'auto' }} value={k.metric} onChange={(e) => setC({ ...c, kpis: c.kpis.map((x, j) => (j === i ? { ...x, metric: e.target.value as Kpi['metric'] } : x)) })} aria-label="Measure">
            {(['reach', 'views', 'saves', 'shares', 'comments', 'follows', 'leads', 'sales'] as Kpi['metric'][]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input className="input num" style={{ width: 140 }} inputMode="numeric" value={k.target} onChange={(e) => setC({ ...c, kpis: c.kpis.map((x, j) => (j === i ? { ...x, target: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)) })} aria-label="Target" />
          <Button size="sm" variant="ghost" onClick={() => setC({ ...c, kpis: c.kpis.filter((_, j) => j !== i) })}>
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button size="sm" onClick={() => setC({ ...c, kpis: [...c.kpis, { metric: 'leads', target: 5 }] })}>
          <Plus size={16} /> Target
        </Button>
      </div>
    </div>
  );
}

type Step = 'pick' | 'basics' | 'audience' | 'plan' | 'kpis';

function CampaignBuilder({ start, onClose }: { start: CampaignTemplate | 'blank' | 'pick' | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const members = useMembers() ?? [];
  const posts = usePosts() ?? [];
  const campaigns = useCampaigns() ?? [];
  const today = todayISO();
  const [step, setStep] = useState<Step>('pick');
  const [tpl, setTpl] = useState<CampaignTemplate | null>(null);
  const [c, setC] = useState<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'funnelId'>>(() => ({ ...blankCampaign() }));
  const [rows, setRows] = useState<PlannedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [initFor, setInitFor] = useState<unknown>(null);
  /** Feed posts already planned that day for the same brand (a campaign post would double up). */
  const dayPosts = posts.filter((p) => p.date && p.clientId === c.clientId && p.status !== 'skipped' && p.format !== 'Story');
  const busyOn = (date: string): string =>
    dayPosts
      .filter((p) => p.date === date)
      .map((p) => p.title)
      .join(', ');
  const clashes = rows.filter((r) => r.include && r.format !== 'Story' && busyOn(r.date)).length;
  const spread = () => {
    const next = spreadToFreeDays(rows, new Set(dayPosts.map((p) => p.date as string)), cadence);
    const moved = next.filter((r, i) => r.date !== rows[i].date).length;
    setRows(next);
    const last = next.filter((r) => r.include).reduce((m, r) => (r.date > m ? r.date : m), '');
    if (last) setC((cur) => ({ ...cur, endDate: cur.endDate > last ? cur.endDate : last }));
    app.toast(moved ? `Moved ${moved} ${moved === 1 ? 'post' : 'posts'} to free days` : 'No free days in the next 3 months; keep them as extra posts or pick days yourself', { tone: moved ? 'good' : 'info' });
  };

  const defaultStart = cadence.resumeOn && cadence.resumeOn > today ? cadence.resumeOn : mondayOnOrAfter(addDays(today, 3));

  const choose = (t: CampaignTemplate | null) => {
    setTpl(t);
    const startDate = t?.seasonId ? (() => {
      const s = SEASONS.find((x) => x.id === t.seasonId);
      if (!s) return defaultStart;
      const w = nextWindow(s, today);
      return mondayOnOrAfter(w.start > defaultStart ? w.start : defaultStart);
    })() : t?.startOn && t.startOn >= defaultStart ? t.startOn : defaultStart;
    setC({
      ...blankCampaign(),
      name: t?.name ?? '',
      clientId: app.scope !== 'all' && app.scope !== 'own' ? app.scope : null,
      goal: t?.goal ?? 'leads',
      service: t?.service ?? '',
      templateId: t?.id ?? '',
      startDate,
      endDate: '',
      audience: t ? { ...t.audience } : { ...EMPTY_PERSONA },
      offer: t?.offer ?? '',
      keyMessage: t?.keyMessage ?? '',
      ctaKeyword: t?.ctaKeyword ?? '',
      leadMagnet: t?.leadMagnet ?? '',
      kpis: t ? t.kpis.map((k) => ({ ...k })) : [{ metric: 'reach', target: 10000 }],
      status: 'active',
      color: nextCampaignColor(campaigns),
    });
    setStep('basics');
  };

  if (start !== initFor) {
    setInitFor(start);
    if (start && start !== 'pick') choose(start === 'blank' ? null : start);
    else if (start === 'pick') setStep('pick');
  }

  const buildRows = () => {
    const skilled = (svc: ServiceKey | '') => members.filter((m) => m.active === 1 && svc && m.skills.includes(svc as ServiceKey));
    const pool = skilled(c.service);
    const planned = tpl ? planTemplatePosts(tpl, c.startDate, cadence) : [];
    setRows(
      planned.map((p, i) => ({ ...p, include: true, assignees: pool.length ? [pool[i % pool.length].id] : [] })),
    );
    const last = planned[planned.length - 1]?.date;
    if (last) setC((cur) => ({ ...cur, endDate: cur.endDate > last ? cur.endDate : last }));
  };

  const launch = async () => {
    if (!c.name.trim()) return;
    setBusy(true);
    try {
      const made = await launchCampaign({ ...c, name: c.name.trim(), endDate: c.endDate || c.startDate }, rows, tpl?.funnelTemplateId ?? 'studio-leads');
      app.toast(`“${made.name}” is on the calendar with ${rows.filter((r) => r.include).length} posts`, { tone: 'good', action: { label: 'Calendar', onClick: () => navigate(`/calendar?date=${c.startDate}`) } });
      onClose();
      setStep('pick');
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not create the campaign', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const steps: Step[] = ['pick', 'basics', 'audience', 'plan', 'kpis'];
  const idx = steps.indexOf(step);
  const next = () => {
    const n = steps[idx + 1];
    if (n === 'plan' && !rows.length) buildRows();
    setStep(n);
  };

  return (
    <Dialog
      open={!!start}
      onClose={onClose}
      size="xwide"
      title={step === 'pick' ? 'Plan a campaign' : `${tpl?.name ?? 'New campaign'} · ${['', 'Basics', 'Audience', 'Content plan', 'Targets'][idx]}`}
      footer={
        step === 'pick' ? (
          <Button onClick={() => choose(null)}>Start blank</Button>
        ) : (
          <>
            <Button onClick={() => setStep(steps[idx - 1])}>Back</Button>
            <span className="grow" />
            {step === 'kpis' ? (
              <Button variant="primary" disabled={busy || !c.name.trim()} onClick={launch}>
                <Rocket size={16} /> Create campaign
              </Button>
            ) : (
              <Button variant="primary" disabled={step === 'basics' && (!c.name.trim() || !c.startDate)} onClick={next}>
                Next
              </Button>
            )}
          </>
        )
      }
    >
      {step === 'pick' ? (
        <div className="stack loose">
          {(['Seasons', 'SMM', 'Services', 'For clients'] as const).map((g) => (
            <section key={g} className="stack">
              <span className="eyebrow">{g}</span>
              <div className="trend-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {CAMPAIGN_TEMPLATES.filter((t) => t.group === g).map((t) => {
                  const season = t.seasonId ? SEASONS.find((s) => s.id === t.seasonId) : undefined;
                  const w = season ? nextWindow(season, today) : null;
                  const soon = w ? daysFrom(today, w.start) <= 60 : false;
                  return (
                    <button key={t.id} type="button" className="card trend-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => choose(t)}>
                      <div className="row between top">
                        <b>{t.name}</b>
                        {soon ? <Badge tone="yellow">Soon</Badge> : null}
                      </div>
                      <span className="small muted">{t.description}</span>
                      <span className="tiny muted">
                        {t.service ? SERVICE_LABEL[t.service] : ''} · {t.posts.length} posts
                        {w ? ` · ${fmtDateRange(w.start, w.end)}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {step === 'basics' ? (
        <BasicsFields
          c={c}
          setC={setC}
          startHint={cadence.resumeOn && cadence.resumeOn > today ? `Posting restarts ${fmtIsoDate(restartDay(cadence))}.` : undefined}
          endHint="Filled from the last planned post; change it any time."
          onStart={(v) => {
            setC({ ...c, startDate: v });
            setRows([]);
          }}
        />
      ) : null}

      {step === 'audience' ? <AudienceFields c={c} setC={setC} /> : null}

      {step === 'plan' ? (
        <div className="stack">
          <p className="muted">Each post lands on its themed day; break weeks and holidays are skipped. Untick anything you don’t want, change titles and who makes them.</p>
          {clashes ? (
            <Callout tone="warn" title={`${clashes} of these ${clashes === 1 ? 'lands' : 'land'} on a day that already has a post`}>
              <div className="row wrap between">
                <span>Move them to the next open posting days (flex days count), or keep them as extra posts that day.</span>
                <Button size="sm" variant="teal" onClick={spread}>
                  Move to free days
                </Button>
              </div>
            </Callout>
          ) : null}
          {rows.length === 0 ? (
            <Callout tone="info">A blank campaign starts with no posts. Add them from the calendar later and pick this campaign.</Callout>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Day</th>
                    <th>Post</th>
                    <th>Stage</th>
                    <th>Who</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input type="checkbox" aria-label={`Include ${r.title}`} checked={r.include} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                      </td>
                      <td className="nowrap">
                        <input type="date" className="input" value={r.date} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label="Date" />
                        {r.format !== 'Story' && busyOn(r.date) ? (
                          <div className="tiny warn" title={busyOn(r.date)}>
                            Also that day: {busyOn(r.date).slice(0, 28)}
                            {busyOn(r.date).length > 28 ? '…' : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <input className="input" value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Title" />
                        <div className="tiny muted">
                          {r.format} · {r.brief}
                        </div>
                      </td>
                      <td>
                        <select className="select" value={r.stage} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, stage: e.target.value as FunnelStage } : x)))} aria-label="Stage">
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {STAGE_META[s].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="select" value={r.assignees[0] ?? ''} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, assignees: e.target.value ? [e.target.value] : [] } : x)))} aria-label="Who">
                          <option value="">Nobody yet</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {step === 'kpis' ? (
        <div className="stack">
          <KpiFields c={c} setC={setC} />
          <Callout tone="good" title="Ready">
            {rows.filter((r) => r.include).length} posts from {rows[0] ? fmtIsoDate(rows[0].date) : fmtIsoDate(c.startDate)}, with a funnel from the “{FUNNEL_TEMPLATES.find((f) => f.id === (tpl?.funnelTemplateId ?? 'studio-leads'))?.name}” template.
          </Callout>
        </div>
      ) : null}
    </Dialog>
  );
}

function Funnels() {
  const app = useApp();
  const funnels = useFunnels();
  const posts = usePosts() ?? [];
  const campaigns = useCampaigns() ?? [];
  const [edit, setEdit] = useState<Funnel | null>(null);
  const [making, setMaking] = useState(false);
  const list = (funnels ?? []).filter((f) => app.inScope(f.clientId));
  return (
    <div className="stack">
      <div className="row between wrap">
        <p className="muted" style={{ maxWidth: '70ch' }}>
          A funnel maps how a stranger becomes a client: what they see first, what makes them follow, what convinces them, the one thing to do, and what brings them back.
        </p>
        {app.can('editCampaigns') ? (
          <Button variant="primary" onClick={() => setMaking(true)}>
            <Wand2 size={16} /> New funnel
          </Button>
        ) : null}
      </div>
      {list.length === 0 ? <EmptyState title="No funnels yet">Every campaign gets one; you can also map one for a client.</EmptyState> : null}
      <div className="trend-grid">
        {list.map((f) => {
          const linked = posts.filter((p) => (f.campaignId ? p.campaignId === f.campaignId : f.clientId ? p.clientId === f.clientId : p.clientId === null && !!p.funnelStage));
          const cov = coverage(linked);
          return (
            <button key={f.id} type="button" className="card trend-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setEdit(f)}>
              <b>{f.name}</b>
              <span className="tiny muted">{f.campaignId ? `Campaign: ${campaigns.find((c) => c.id === f.campaignId)?.name ?? ''}` : 'Standalone'}</span>
              <FunnelChart counts={cov.counts} />
              {cov.empty.length ? <span className="tiny warn">Empty: {cov.empty.map((s) => STAGE_META[s].label).join(', ')}</span> : null}
            </button>
          );
        })}
      </div>
      <FunnelEditor funnel={edit} onClose={() => setEdit(null)} />
      <Dialog open={making} onClose={() => setMaking(false)} title="Start from a template">
        <div className="card flush">
          <div className="list">
            {FUNNEL_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="list-item click"
                style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', width: '100%' }}
                onClick={async () => {
                  const f = await saveFunnel({ name: t.name, templateId: t.id, clientId: app.scope !== 'all' && app.scope !== 'own' ? app.scope : null });
                  setMaking(false);
                  setEdit(f);
                }}
              >
                <span className="main-text">
                  <b>{t.name}</b>
                  <span>{t.description}</span>
                </span>
                {t.forClients ? <Badge tone="teal">Clients</Badge> : null}
              </button>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function FunnelEditor({ funnel, onClose }: { funnel: Funnel | null; onClose: () => void }) {
  const app = useApp();
  const [f, setF] = useState<Funnel | null>(null);
  if (funnel && (!f || f.id !== funnel.id)) setF(funnel);
  if (!funnel && f) setF(null);
  const edit = app.can('editCampaigns');
  if (!f) return null;
  const setStage = (i: number, k: keyof Funnel['stages'][number], v: string) => setF({ ...f, stages: f.stages.map((s, j) => (j === i ? { ...s, [k]: k === 'target' ? (Number(v) || null) : v } : s)) });
  return (
    <Dialog
      open={!!funnel}
      onClose={onClose}
      size="wide"
      title={f.name}
      footer={
        edit ? (
          <>
            <Button
              variant="danger"
              onClick={async () => {
                if (!(await app.confirm({ title: 'Delete this funnel?', confirmLabel: 'Delete', tone: 'danger' }))) return;
                await deleteFunnel(f.id);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <span className="grow" />
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await saveFunnel(f);
                app.toast('Funnel saved', { tone: 'good' });
                onClose();
              }}
            >
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      <Field label="Name" htmlFor="fn-name">
        <TextInput id="fn-name" value={f.name} disabled={!edit} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      {f.stages.map((s, i) => (
        <section key={s.key} className={`card stage-card s${i + 1}`}>
          <div className="row between">
            <h3>{STAGE_META[s.key].label}</h3>
            <span className="tiny muted">{STAGE_META[s.key].question}</span>
          </div>
          <div className="form-grid">
            {(
              [
                ['goal', 'Goal'],
                ['content', 'Content'],
                ['offer', 'Offer or freebie'],
                ['cta', 'Call to action'],
                ['channel', 'Where'],
                ['kpi', 'Measure'],
              ] as [keyof typeof s, string][]
            ).map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`fs-${i}-${k}`}>
                <TextInput id={`fs-${i}-${k}`} disabled={!edit} value={String(s[k] ?? '')} onChange={(e) => setStage(i, k, e.target.value)} placeholder={k === 'content' ? STAGE_META[s.key].content : undefined} />
              </Field>
            ))}
            <Field label="Target" htmlFor={`fs-${i}-t`}>
              <input id={`fs-${i}-t`} className="input num" inputMode="numeric" disabled={!edit} value={s.target ?? ''} onChange={(e) => setStage(i, 'target', e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        </section>
      ))}
      <Field label="Notes" htmlFor="fn-notes">
        <TextArea id="fn-notes" rows={2} disabled={!edit} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
    </Dialog>
  );
}

function Seasons({ onUse }: { onUse: (t: CampaignTemplate) => void }) {
  const app = useApp();
  const today = todayISO();
  const seasons = useMemo(
    () =>
      SEASONS.map((s) => ({ s, w: nextWindow(s, today) }))
        .filter((x) => daysFrom(today, x.w.start) <= 200)
        .sort((a, b) => a.w.start.localeCompare(b.w.start)),
    [today],
  );
  const dates = upcomingDates(today, 120);
  return (
    <div className="stack loose">
      <section className="stack">
        <h2>Seasons that bring work in</h2>
        <div className="trend-grid">
          {seasons.map(({ s, w }) => {
            const tpl = CAMPAIGN_TEMPLATES.find((t) => t.seasonId === s.id);
            const now = w.start <= today;
            return (
              <article key={s.id} className="card trend-card">
                <div className="row between top">
                  <h3>{s.name}</h3>
                  <Badge tone={now ? 'good' : daysFrom(today, w.start) <= 45 ? 'yellow' : undefined}>{now ? 'Now' : `In ${daysFrom(today, w.start)} days`}</Badge>
                </div>
                <span className="small muted">{fmtDateRange(w.start, w.end)}</span>
                <span className="small">{s.idea}</span>
                <span className="tiny muted">Good for: {s.services.map((x) => SERVICE_LABEL[x]).join(', ')}</span>
                {tpl && app.can('editCampaigns') ? (
                  <div>
                    <Button size="sm" onClick={() => onUse(tpl)}>
                      <Megaphone size={16} /> Plan “{tpl.name}”
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
      <section className="stack">
        <h2>Dates in the next four months</h2>
        <div className="card flush">
          <div className="list">
            {dates.map((d) => (
              <div key={`${d.date}${d.name}`} className="list-item">
                <span className="nowrap strong" style={{ width: 130 }}>
                  {fmtIsoWeekday(d.date)}
                </span>
                <span className="main-text">
                  <b>{d.name}</b>
                  <span>{d.idea || (d.kind === 'holiday' ? 'Public holiday: the planner leaves it free.' : '')}</span>
                </span>
                <Badge tone={d.kind === 'holiday' ? 'warn' : d.kind === 'shopping' ? 'yellow' : 'teal'}>{d.kind}</Badge>
              </div>
            ))}
          </div>
        </div>
        <p className="tiny muted">2027 holidays follow Proclamation No. 1427. Paydays (15th and 30th) aren’t listed but are good days for offers.</p>
      </section>
    </div>
  );
}

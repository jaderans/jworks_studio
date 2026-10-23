import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { ArrowDown, ArrowUp, Bot, CalendarPlus, Copy, Hash, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, IconButton, PageHeader, Tabs } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { FilterBar } from '../../components/FilterBar';
import { Dialog } from '../../components/Dialog';
import { MemberDots, MemberPicker, useMemberMap } from '../../components/people';
import { useIdeas, useMembers, usePosts, useSettingRows, useSnippets } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { themedSlots, themeForIdea } from '../../domain/calendar';
import { hashtagsOf } from '../../domain/captions';
import { FORMATS } from '../../domain/platforms';
import { deleteIdea, deleteSnippet, saveIdea, saveSnippet, scheduleIdea } from '../../services/content';
import { copyText } from '../../lib/text';
import { addDays, fmtIsoWeekday, todayISO } from '../../lib/time';
import type { Idea, IdeaKind, Slide, Snippet } from '../../db/types';

const KIND_LABEL: Record<IdeaKind, string> = { idea: 'Idea', whatif: 'WHAT IF', concept: 'Concept Drop', script: 'Script' };
const STATUS_TONE: Record<Idea['status'], 'teal' | 'good' | undefined> = { idea: undefined, scheduled: 'teal', used: 'good', archived: undefined };
const STATUS_TEXT: Record<Idea['status'], string> = { idea: 'Open', scheduled: 'On the calendar', used: 'Used', archived: 'Archived' };

export default function IdeasPage() {
  const [editing, setEditing] = useState<Partial<Idea> | null>(null);
  const [scheduling, setScheduling] = useState<Idea | null>(null);
  return (
    <div className="page">
      <PageHeader
        title="Ideas"
        subtitle="The backlog for when content runs low: pull an idea onto the calendar in two taps."
        actions={
          <Button variant="primary" onClick={() => setEditing({ kind: 'idea', category: 'Educational (Mon)' })}>
            <Plus size={18} /> New idea
          </Button>
        }
      />
      <Tabs
        items={[
          { to: '/ideas', label: 'Idea bank', end: true },
          { to: '/ideas/concepts', label: 'WHAT IF & Concept Drops' },
          { to: '/ideas/scripts', label: 'Scripts' },
          { to: '/ideas/captions', label: 'Captions & hashtags' },
        ]}
      />
      <Routes>
        <Route index element={<IdeaBank kinds={['idea']} onEdit={setEditing} onSchedule={setScheduling} />} />
        <Route path="concepts" element={<Concepts onEdit={setEditing} onSchedule={setScheduling} />} />
        <Route path="scripts" element={<Scripts onEdit={setEditing} onSchedule={setScheduling} />} />
        <Route path="captions" element={<CaptionBank />} />
      </Routes>
      <IdeaDialog value={editing} onClose={() => setEditing(null)} />
      <ScheduleDialog idea={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}

function IdeaBank({ kinds, onEdit, onSchedule }: { kinds: IdeaKind[]; onEdit: (i: Partial<Idea>) => void; onSchedule: (i: Idea) => void }) {
  const ideas = useIdeas();
  const memberMap = useMemberMap();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'open' | 'all' | Idea['status']>('open');
  const [cat, setCat] = useState('');
  const [who, setWho] = useState('');
  const mine = (ideas ?? []).filter((i) => kinds.includes(i.kind));
  const cats = [...new Set(mine.map((i) => i.category || 'Other'))].sort();
  const list = mine.filter(
    (i) =>
      (show === 'all' || (show === 'open' ? i.status === 'idea' : i.status === show)) &&
      (!cat || (i.category || 'Other') === cat) &&
      (!who || i.bestFor.includes(who)) &&
      (!q.trim() || `${i.title} ${i.category} ${i.angle}`.toLowerCase().includes(q.toLowerCase())),
  );
  const groups = useMemo(() => {
    const m = new Map<string, Idea[]>();
    for (const i of list) m.set(i.category || 'Other', [...(m.get(i.category || 'Other') ?? []), i]);
    return [...m.entries()];
  }, [list]);
  if (!ideas) return null;
  return (
    <div className="stack">
      <FilterBar
        id="ideas"
        search={{ value: q, onChange: setQ, placeholder: 'Search ideas' }}
        active={(show !== 'open' ? 1 : 0) + (cat ? 1 : 0) + (who ? 1 : 0)}
        onClear={() => {
          setQ('');
          setShow('open');
          setCat('');
          setWho('');
        }}
      >
        <Select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="open">Open ideas</option>
          <option value="scheduled">Scheduled</option>
          <option value="used">Used</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
        <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Every category</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select aria-label="Best for" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Anyone</option>
          {[...memberMap.values()]
            .filter((m) => m.active === 1)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
      </FilterBar>
      {groups.length === 0 ? (
        <EmptyState icon={<Lightbulb size={40} />} title="No ideas here yet">
          Import your content planner in Settings, or add ideas as they come.
        </EmptyState>
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="card flush">
            <div className="card-head" style={{ padding: '12px 16px 4px' }}>
              <h2 className="dot-title">{cat}</h2>
              <span className="muted small">{items.length}</span>
            </div>
            <div className="list">
              {items.map((i) => (
                <IdeaRow key={i.id} idea={i} memberMap={memberMap} onEdit={onEdit} onSchedule={onSchedule} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function IdeaRow({ idea, memberMap, onEdit, onSchedule }: { idea: Idea; memberMap: ReturnType<typeof useMemberMap>; onEdit: (i: Partial<Idea>) => void; onSchedule: (i: Idea) => void }) {
  const navigate = useNavigate();
  return (
    <div className="list-item">
      <span className="main-text">
        <b>{idea.title}</b>
        <span>
          {[idea.format, idea.angle, idea.timing].filter(Boolean).join(' · ') || idea.bestForText}
        </span>
      </span>
      <MemberDots ids={idea.bestFor} members={memberMap} />
      <Badge tone={STATUS_TONE[idea.status]}>{STATUS_TEXT[idea.status]}</Badge>
      {idea.status === 'idea' ? (
        <Button size="sm" onClick={() => onSchedule(idea)}>
          <CalendarPlus size={16} /> Schedule
        </Button>
      ) : idea.postId ? (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/calendar?post=${idea.postId}`)}>
          Open post
        </Button>
      ) : null}
      <IconButton label="Edit" plain size="sm" onClick={() => onEdit(idea)}>
        <Pencil size={16} />
      </IconButton>
    </div>
  );
}

function Concepts({ onEdit, onSchedule }: { onEdit: (i: Partial<Idea>) => void; onSchedule: (i: Idea) => void }) {
  const snippets = useSnippets() ?? [];
  const disclaimer = snippets.find((s) => s.kind === 'disclaimer');
  return (
    <div className="stack">
      <Callout tone="info" title="WHAT IF rules">
        Every WHAT IF post is clearly labelled an unofficial concept (no affiliation). Never use the brand’s real logo files: redraw concepts from scratch. Pick subjects your audience already knows.
        {disclaimer ? (
          <>
            <br />
            <b>Caption line:</b> {disclaimer.text}
          </>
        ) : null}
      </Callout>
      <div className="actions">
        <Button onClick={() => onEdit({ kind: 'whatif', category: 'WHAT IF (mascot)' })}>
          <Plus size={16} /> WHAT IF
        </Button>
        <Button onClick={() => onEdit({ kind: 'concept', category: 'CONCEPT DROP (shirt)' })}>
          <Plus size={16} /> Concept Drop
        </Button>
      </div>
      <IdeaBank kinds={['whatif', 'concept']} onEdit={onEdit} onSchedule={onSchedule} />
    </div>
  );
}

function Scripts({ onEdit, onSchedule }: { onEdit: (i: Partial<Idea>) => void; onSchedule: (i: Idea) => void }) {
  const app = useApp();
  const ideas = (useIdeas() ?? []).filter((i) => i.kind === 'script');
  const navigate = useNavigate();
  return (
    <div className="stack">
      <div className="actions">
        <Button onClick={() => onEdit({ kind: 'script', category: 'Carousel script', format: 'Carousel', slides: [{ label: 'Slide 1 · Cover', text: '' }] })}>
          <Plus size={16} /> New script
        </Button>
        <Button variant="ghost" onClick={() => navigate('/assistant?recipe=carousel')}>
          <Bot size={16} /> Draft one with Claude
        </Button>
      </div>
      {ideas.length === 0 ? <EmptyState title="No scripts yet">Carousel and reel scripts live here, slide by slide.</EmptyState> : null}
      <div className="trend-grid">
        {ideas.map((s) => (
          <article key={s.id} className="card trend-card">
            <div className="row between top">
              <h3>{s.title}</h3>
              <Badge tone={STATUS_TONE[s.status]}>{STATUS_TEXT[s.status]}</Badge>
            </div>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {s.slides.slice(0, 5).map((sl, i) => (
                <li key={i}>
                  <b>{sl.label}:</b> {sl.text}
                </li>
              ))}
              {s.slides.length > 5 ? <li className="muted">+{s.slides.length - 5} more slides</li> : null}
            </ol>
            <div className="actions">
              <Button
                size="sm"
                variant="teal"
                onClick={async () => app.toast((await copyText(s.slides.map((x) => `${x.label}\n${x.text}`).join('\n\n'))) ? 'Script copied' : 'Couldn’t copy', { tone: 'good' })}
              >
                <Copy size={16} /> Copy
              </Button>
              {s.status === 'idea' ? (
                <Button size="sm" onClick={() => onSchedule(s)}>
                  <CalendarPlus size={16} /> Schedule
                </Button>
              ) : s.postId ? (
                <Button size="sm" variant="ghost" onClick={() => navigate(`/calendar?post=${s.postId}`)}>
                  Open post
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                <Pencil size={16} /> Edit
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CaptionBank() {
  const app = useApp();
  const snippets = useSnippets();
  const [edit, setEdit] = useState<Partial<Snippet> | null>(null);
  if (!snippets) return null;
  const kinds: Snippet['kind'][] = ['hashtags', 'cta', 'disclaimer', 'caption'];
  const label: Record<Snippet['kind'], string> = { hashtags: 'Hashtag sets', cta: 'Calls to action', disclaimer: 'Disclaimers', caption: 'Caption templates' };
  return (
    <div className="stack">
      <p className="muted">Copy-paste blocks so captions take 2 minutes, not 20. Instagram takes 5 hashtags at most: a base set plus one or two niche tags.</p>
      <div>
        <Button onClick={() => setEdit({ kind: 'hashtags', label: '', text: '' })}>
          <Plus size={16} /> New block
        </Button>
      </div>
      {kinds.map((k) => {
        const list = snippets.filter((s) => s.kind === k);
        if (!list.length) return null;
        return (
          <section key={k} className="card flush">
            <div className="card-head" style={{ padding: '12px 16px 4px' }}>
              <h2 className="dot-title">{label[k]}</h2>
            </div>
            <div className="list">
              {list.map((s) => {
                const tags = k === 'hashtags' ? hashtagsOf(s.text).length : 0;
                return (
                  <div key={s.id} className="list-item">
                    <span className="main-text">
                      <b>{s.label}</b>
                      <span style={{ whiteSpace: 'normal' }}>{s.text}</span>
                      {s.notes ? <span className="tiny">{s.notes}</span> : null}
                    </span>
                    {tags > 5 ? <Badge tone="warn">{tags} tags: IG takes 5</Badge> : tags ? <Badge>{tags} tags</Badge> : null}
                    <IconButton label="Copy" size="sm" onClick={async () => app.toast((await copyText(s.text)) ? 'Copied' : 'Couldn’t copy', { tone: 'good' })}>
                      <Copy size={16} />
                    </IconButton>
                    <IconButton label="Edit" size="sm" plain onClick={() => setEdit(s)}>
                      <Pencil size={16} />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <SnippetDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function SnippetDialog({ value, onClose }: { value: Partial<Snippet> | null; onClose: () => void }) {
  const app = useApp();
  const [s, setS] = useState<Partial<Snippet>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? 'new')) {
    setS(value);
    setKey(value.id ?? 'new');
  }
  if (!value && key !== null) setKey(null);
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={value?.id ? 'Edit block' : 'New block'}
      footer={
        <>
          {value?.id ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteSnippet(value.id as string);
                onClose();
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!s.label?.trim() || !s.text?.trim()}
            onClick={async () => {
              await saveSnippet({ ...(s as Snippet), label: s.label!.trim(), text: s.text!.trim(), kind: s.kind ?? 'caption' });
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Kind" htmlFor="sn-kind">
        <Select id="sn-kind" value={s.kind ?? 'caption'} onChange={(e) => setS({ ...s, kind: e.target.value as Snippet['kind'] })}>
          <option value="hashtags">Hashtag set</option>
          <option value="cta">Call to action</option>
          <option value="disclaimer">Disclaimer</option>
          <option value="caption">Caption template</option>
        </Select>
      </Field>
      <Field label="Name" htmlFor="sn-label">
        <TextInput id="sn-label" value={s.label ?? ''} onChange={(e) => setS({ ...s, label: e.target.value })} placeholder="e.g. Logo / branding posts" />
      </Field>
      <Field label="Text" htmlFor="sn-text" hint={s.kind === 'hashtags' ? `${hashtagsOf(s.text ?? '').length} hashtags` : undefined}>
        <TextArea id="sn-text" rows={4} value={s.text ?? ''} onChange={(e) => setS({ ...s, text: e.target.value })} />
      </Field>
      <Field label="When to use it" htmlFor="sn-use">
        <TextInput id="sn-use" value={s.useFor ?? ''} onChange={(e) => setS({ ...s, useFor: e.target.value })} />
      </Field>
    </Dialog>
  );
}

function IdeaDialog({ value, onClose }: { value: Partial<Idea> | null; onClose: () => void }) {
  const app = useApp();
  const members = useMembers() ?? [];
  const [i, setI] = useState<Partial<Idea>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? `new-${value.kind}`)) {
    setI({ bestFor: [], slides: [], ...value });
    setKey(value.id ?? `new-${value.kind}`);
  }
  if (!value && key !== null) setKey(null);
  const kind = i.kind ?? 'idea';
  const slides = i.slides ?? [];
  const setSlides = (s: Slide[]) => setI({ ...i, slides: s });
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      size={kind === 'script' ? 'wide' : undefined}
      title={value?.id ? `Edit ${KIND_LABEL[kind]}` : `New ${KIND_LABEL[kind]}`}
      footer={
        <>
          {value?.id ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!(await app.confirm({ title: 'Delete this idea?', confirmLabel: 'Delete', tone: 'danger' }))) return;
                  await deleteIdea(value.id as string);
                  onClose();
                }}
              >
                <Trash2 size={16} /> Delete
              </Button>
              <Button variant="ghost" onClick={async () => { await saveIdea({ ...(i as Idea), status: i.status === 'archived' ? 'idea' : 'archived' }); onClose(); }}>
                {i.status === 'archived' ? 'Restore' : 'Archive'}
              </Button>
            </>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!i.title?.trim()}
            onClick={async () => {
              await saveIdea({ ...(i as Idea), title: i.title!.trim(), kind });
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Title" htmlFor="id-title">
        <TextInput id="id-title" value={i.title ?? ''} onChange={(e) => setI({ ...i, title: e.target.value })} />
      </Field>
      <div className="form-grid">
        <Field label={kind === 'idea' ? 'Category' : 'Series'} htmlFor="id-cat">
          <TextInput id="id-cat" list="id-cats" value={i.category ?? ''} onChange={(e) => setI({ ...i, category: e.target.value })} />
          <datalist id="id-cats">
            {['Educational (Mon)', 'Video / Reel', 'Fun / Engagement (Fri)', 'WHAT IF (mascot)', 'WHAT IF (rebrand)', 'CONCEPT DROP (shirt)', 'Carousel script', 'Reel script'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Format" htmlFor="id-format">
          <TextInput id="id-format" list="id-formats" value={i.format ?? ''} onChange={(e) => setI({ ...i, format: e.target.value })} />
          <datalist id="id-formats">
            {FORMATS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        {kind === 'whatif' || kind === 'concept' ? (
          <>
            <Field label="Subject" htmlFor="id-subj">
              <TextInput id="id-subj" value={i.subject ?? ''} onChange={(e) => setI({ ...i, subject: e.target.value })} placeholder="e.g. Iloilo City tourism" />
            </Field>
            <Field label="Best timing" htmlFor="id-time">
              <TextInput id="id-time" value={i.timing ?? ''} onChange={(e) => setI({ ...i, timing: e.target.value })} placeholder="e.g. before Dinagyang" />
            </Field>
          </>
        ) : null}
      </div>
      <Field label="Angle or hook" htmlFor="id-angle">
        <TextArea id="id-angle" rows={2} value={i.angle ?? ''} onChange={(e) => setI({ ...i, angle: e.target.value })} />
      </Field>
      <Field label="Best for">
        <MemberPicker value={i.bestFor ?? []} onChange={(v) => setI({ ...i, bestFor: v })} members={members} />
      </Field>
      {kind === 'script' ? (
        <div className="stack tight">
          <span className="label strong small">Slides</span>
          <div className="slides">
            {slides.map((s, idx) => (
              <div key={idx} className="slide-row">
                <TextInput aria-label={`Slide ${idx + 1} label`} value={s.label} onChange={(e) => setSlides(slides.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)))} />
                <TextArea aria-label={`Slide ${idx + 1} text`} rows={2} value={s.text} onChange={(e) => setSlides(slides.map((x, j) => (j === idx ? { ...x, text: e.target.value } : x)))} />
                <div className="row" style={{ gap: 2 }}>
                  <IconButton label="Move up" size="sm" plain disabled={idx === 0} onClick={() => setSlides(slides.map((x, j) => (j === idx - 1 ? slides[idx] : j === idx ? slides[idx - 1] : x)))}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Move down" size="sm" plain disabled={idx === slides.length - 1} onClick={() => setSlides(slides.map((x, j) => (j === idx + 1 ? slides[idx] : j === idx ? slides[idx + 1] : x)))}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label="Remove slide" size="sm" plain onClick={() => setSlides(slides.filter((_, j) => j !== idx))}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Button size="sm" onClick={() => setSlides([...slides, { label: `Slide ${slides.length + 1}`, text: '' }])}>
              <Plus size={16} /> Slide
            </Button>
          </div>
          <p className="tiny muted">8–12 slides works best for teaching. Slide 2 is a second hook: Instagram re-shows carousels from there.</p>
        </div>
      ) : null}
      <Field label="Notes" htmlFor="id-notes">
        <TextArea id="id-notes" rows={2} value={i.notes ?? ''} onChange={(e) => setI({ ...i, notes: e.target.value })} />
      </Field>
    </Dialog>
  );
}

function ScheduleDialog({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const cadence = settingValue(useSettingRows(), 'cadence');
  const posts = usePosts() ?? [];
  const today = todayISO();
  const themeKey = idea ? themeForIdea(idea) : '';
  const suggestions = useMemo(() => {
    if (!idea) return [];
    const busy = new Set(posts.filter((p) => p.date && app.inScope(p.clientId)).map((p) => p.date as string));
    const from = cadence.resumeOn && cadence.resumeOn > today ? cadence.resumeOn : addDays(today, 1);
    return themedSlots(cadence, from, addDays(from, 70))
      .filter((s) => s.themeKey === themeKey && !busy.has(s.date))
      .slice(0, 4);
  }, [idea, posts, cadence, themeKey, today, app]);
  const [date, setDate] = useState('');
  const pick = date || suggestions[0]?.date || '';
  return (
    <Dialog
      open={!!idea}
      onClose={onClose}
      title="Put it on the calendar"
      footer={
        <>
          <Button
            onClick={async () => {
              if (!idea) return;
              await scheduleIdea(idea.id, null);
              app.toast('Added to the backlog', { tone: 'good' });
              onClose();
            }}
          >
            Backlog
          </Button>
          <Button
            variant="primary"
            disabled={!pick}
            onClick={async () => {
              if (!idea) return;
              const post = await scheduleIdea(idea.id, pick, themeKey);
              app.toast(`Scheduled for ${fmtIsoWeekday(pick)}`, { tone: 'good', action: post ? { label: 'Open', onClick: () => navigate(`/calendar?post=${post.id}`) } : undefined });
              setDate('');
              onClose();
            }}
          >
            Schedule
          </Button>
        </>
      }
    >
      <p>
        <b>{idea?.title}</b>
      </p>
      <p className="muted small">It fits {cadence.themes.find((t) => t.key === themeKey)?.name ?? 'any day'}. Free days coming up:</p>
      <div className="chip-row">
        {suggestions.map((s) => (
          <button key={s.date} type="button" className="chip" aria-pressed={pick === s.date} onClick={() => setDate(s.date)}>
            {fmtIsoWeekday(s.date)}
          </button>
        ))}
      </div>
      <Field label="Or pick a day" htmlFor="sc-date">
        <input id="sc-date" type="date" className="input" value={pick} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="tiny muted">
        <Hash size={12} /> It keeps the idea’s format, angle and who it’s best for.
      </p>
    </Dialog>
  );
}

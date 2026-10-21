import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, ExternalLink, Globe, Lightbulb, MessageSquarePlus, PanelLeft, Send, Square, Trash2, Wand2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, IconButton, PageHeader } from '../../components/ui';
import { Select, TextArea } from '../../components/form';
import { Markdown } from '../../components/Markdown';
import { useCampaigns, useChats, useClients, usePosts, useSettingRows } from '../../hooks/data';
import { settingValue } from '../../db/settings';
import { db } from '../../db/db';
import { getApiKey, modelInfo, streamChat, type ChatTurn } from '../../ai/claude';
import { openInClaude, webPrompt } from '../../ai/claudeWeb';
import { RECIPES, buildContext, buildSystemPrompt, type Recipe } from '../../ai/prompts';
import { saveIdea, savePost } from '../../services/content';
import { uid } from '../../lib/ids';
import { copyText } from '../../lib/text';
import { relativeTime } from '../../lib/time';
import type { Chat, ChatMessage } from '../../db/types';

export default function AssistantPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const chats = useChats();
  const posts = usePosts() ?? [];
  const campaigns = useCampaigns() ?? [];
  const clients = useClients() ?? [];
  const ai = settingValue(useSettingRows(), 'ai');
  const hasKey = useLiveQuery(() => getApiKey().then((k) => !!k), []);
  const [chatId, setChatId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(() => RECIPES.find((r) => r.id === params.get('recipe')) ?? null);
  const [ctx, setCtx] = useState<{ kind: Chat['context']['kind']; id: string | null }>(() =>
    params.get('post') ? { kind: 'post', id: params.get('post') } : params.get('client') ? { kind: 'client', id: params.get('client') } : params.get('campaign') ? { kind: 'campaign', id: params.get('campaign') } : { kind: 'none', id: null },
  );
  const [web, setWeb] = useState<boolean>(() => RECIPES.find((r) => r.id === params.get('recipe'))?.webSearch ?? false);
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSide, setShowSide] = useState(false);
  // Claude.ai mode (no API key): the answer is pasted back here.
  const webMode = hasKey === false;
  const [pasted, setPasted] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const chat = (chats ?? []).find((c) => c.id === chatId) ?? null;
  const ctxLabel = useMemo(() => {
    if (ctx.kind === 'post') return posts.find((p) => p.id === ctx.id)?.title ?? 'A post';
    if (ctx.kind === 'campaign') return campaigns.find((c) => c.id === ctx.id)?.name ?? 'A campaign';
    if (ctx.kind === 'client') return clients.find((c) => c.id === ctx.id)?.name ?? 'A client';
    return 'Nothing specific';
  }, [ctx, posts, campaigns, clients]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat?.messages.length, streaming]);

  // Once the URL's post/recipe has been picked up, clear it so a refresh doesn't repeat it.
  useEffect(() => {
    if (params.get('post') || params.get('recipe') || params.get('client') || params.get('campaign')) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickRecipe = (r: Recipe) => {
    setRecipe(recipe?.id === r.id ? null : r);
    setWeb(r.webSearch);
    if (r.context === 'post' && ctx.kind !== 'post') {
      const next = posts.find((p) => p.date && p.date >= new Date().toISOString().slice(0, 10) && p.status !== 'posted');
      if (next) setCtx({ kind: 'post', id: next.id });
    }
  };

  const send = async () => {
    if (busy) return;
    const typed = text.trim();
    const ask = recipe ? recipe.prompt.replace('{topic}', recipe.topic === 'required' ? typed || 'something you think JoshWorks should post about now' : typed ? `\n\nAlso: ${typed}` : '') : typed;
    if (!ask) return;
    setBusy(true);
    setStreaming('');
    setStatus('Thinking…');
    const now = Date.now();
    let current: Chat;
    if (chat) current = chat;
    else {
      const contextText = await buildContext({ kind: ctx.kind, id: ctx.id }, { includeResults: !!recipe?.results });
      current = { id: uid(), title: (recipe?.label ?? text.trim().slice(0, 60)) || 'New chat', recipe: recipe?.id ?? '', createdAt: now, updatedAt: now, context: { kind: ctx.kind, id: ctx.id, label: ctxLabel }, contextText, messages: [] };
    }
    const userMsg: ChatMessage = { role: 'user', text: ask, at: now };
    current = { ...current, messages: [...current.messages, userMsg], updatedAt: now };
    await db.chats.put(current);
    setChatId(current.id);
    setText('');
    setRecipe(null);
    if (webMode) {
      // The first message carries the instructions and context; follow-ups go into the same Claude.ai chat.
      const first = current.messages.length === 1;
      const prompt = first ? webPrompt({ system: await buildSystemPrompt(), context: current.contextText, ask, webSearch: web }) : ask;
      const copied = await openInClaude(prompt);
      app.toast(copied ? (first ? 'Copied. In Claude.ai, paste (Ctrl+V) and send, then paste the answer back here.' : 'Copied. Paste it into the same Claude.ai chat.') : 'Couldn’t copy. Use the Copy button on your message.', { tone: copied ? 'good' : 'bad', ms: 8000 });
      setBusy(false);
      setStatus('');
      return;
    }
    const turns: ChatTurn[] = current.messages.filter((m) => !m.error).map((m, i) => ({ role: m.role, text: i === 0 && current.contextText ? `${current.contextText}\n\n---\n\n${m.text}` : m.text }));
    const controller = new AbortController();
    abort.current = controller;
    try {
      let acc = '';
      const res = await streamChat({
        system: await buildSystemPrompt(),
        turns,
        model: ai.model,
        effort: ai.effort,
        webSearch: web,
        signal: controller.signal,
        onText: (d) => {
          acc += d;
          setStreaming(acc);
        },
        onStatus: setStatus,
      });
      const reply: ChatMessage = { role: 'assistant', text: res.text || '(No answer.)', at: Date.now(), sources: res.sources, usage: { input: res.usage.input, output: res.usage.output, cacheRead: res.usage.cacheRead, searches: res.usage.searches, costUsd: res.usage.costUsd, model: res.usage.model } };
      await db.chats.put({ ...current, messages: [...current.messages, reply], updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      await db.chats.put({ ...current, messages: [...current.messages, { role: 'assistant', text: streaming, at: Date.now(), error: msg }], updatedAt: Date.now() });
    } finally {
      setBusy(false);
      setStreaming('');
      setStatus('');
      abort.current = null;
    }
  };

  const newChat = () => {
    setChatId(null);
    setRecipe(null);
    setShowSide(false);
  };

  const messages = chat?.messages ?? [];
  const waitingForPaste = webMode && !!chat && messages[messages.length - 1]?.role === 'user';
  const addPasted = async () => {
    if (!chat || !pasted.trim()) return;
    await db.chats.put({ ...chat, messages: [...chat.messages, { role: 'assistant', text: pasted.trim(), at: Date.now() }], updatedAt: Date.now() });
    setPasted('');
  };
  const costTotal = messages.reduce((a, m) => a + (m.usage?.costUsd ?? 0), 0);

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <PageHeader
        title="Assistant"
        subtitle={webMode ? 'Claude.ai mode: the app writes the prompt with JoshWorks’ voice and context, you paste it into Claude.ai, then paste the answer back. No API key or per-use cost.' : `Claude, trained on JoshWorks’ voice, team, rhythm and results · ${modelInfo(ai.model).label}`}
        actions={
          <>
            <Button className="show-phone" onClick={() => setShowSide((v) => !v)}>
              <PanelLeft size={18} /> Chats
            </Button>
            <Button onClick={newChat}>
              <MessageSquarePlus size={18} /> New chat
            </Button>
          </>
        }
      />
      <div className="chat-layout">
        <aside className={`chat-side ${showSide ? 'open' : ''}`} aria-label="Chats">
          {(chats ?? []).length === 0 ? <p className="muted small">Your chats stay on this device.</p> : null}
          {(chats ?? []).slice(0, 40).map((c) => (
            <div key={c.id} className="row" style={{ gap: 4 }}>
              <button
                type="button"
                className="menu-item grow"
                style={{ background: c.id === chatId ? 'var(--teal-soft)' : undefined, display: 'grid', gap: 0 }}
                onClick={() => {
                  setChatId(c.id);
                  setShowSide(false);
                }}
              >
                <span className="ellipsis">{c.title}</span>
                <span className="tiny muted">{relativeTime(c.updatedAt)}</span>
              </button>
              <IconButton label="Delete chat" size="sm" plain onClick={async () => { await db.chats.delete(c.id); if (c.id === chatId) setChatId(null); }}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </aside>
        <div className="chat-main">
          {!chat ? (
            <div className="stack">
              {webMode ? (
                <p className="tiny muted">
                  Using your Claude plan in the browser. Have a Claude API key? Add it in <Link to="/settings#s-ai">Settings → Assistant</Link> to get answers right here.
                </p>
              ) : null}
              <span className="eyebrow">Start with</span>
              <div className="recipes">
                {RECIPES.map((r) => (
                  <button key={r.id} type="button" className="chip" aria-pressed={recipe?.id === r.id} onClick={() => pickRecipe(r)}>
                    <Wand2 size={14} /> {r.label}
                  </button>
                ))}
              </div>
              <div className="row wrap">
                <span className="small strong">About:</span>
                <Select
                  aria-label="Context"
                  style={{ width: 'auto', maxWidth: 420 }}
                  value={ctx.kind === 'none' ? 'none' : `${ctx.kind}:${ctx.id}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'none') setCtx({ kind: 'none', id: null });
                    else {
                      const [kind, id] = v.split(':');
                      setCtx({ kind: kind as Chat['context']['kind'], id });
                    }
                  }}
                >
                  <option value="none">Nothing specific</option>
                  <optgroup label="Posts">
                    {posts
                      .filter((p) => p.status !== 'posted' && p.status !== 'skipped')
                      .slice(0, 60)
                      .map((p) => (
                        <option key={p.id} value={`post:${p.id}`}>
                          {p.date ?? 'Backlog'} · {p.title}
                        </option>
                      ))}
                  </optgroup>
                  {campaigns.length ? (
                    <optgroup label="Campaigns">
                      {campaigns.map((c) => (
                        <option key={c.id} value={`campaign:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {clients.length && app.can('clients') ? (
                    <optgroup label="Clients">
                      {clients.map((c) => (
                        <option key={c.id} value={`client:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </div>
            </div>
          ) : (
            <div className="row wrap">
              <Badge tone="teal">{chat.context.kind === 'none' ? 'General' : chat.context.label}</Badge>
              {costTotal ? <span className="tiny muted">This chat so far: about ${costTotal.toFixed(costTotal < 0.1 ? 3 : 2)}</span> : null}
            </div>
          )}

          <div className="chat-log" aria-live="polite">
            {messages.map((m, i) => (
              <Message key={i} m={m} chat={chat as Chat} />
            ))}
            {busy ? (
              <div className="msg assistant">
                {streaming ? (
                  <Markdown text={streaming} />
                ) : (
                  <span className="row small muted">
                    <span className="typing" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    {status}
                  </span>
                )}
              </div>
            ) : null}
            <div ref={end} />
          </div>

          {waitingForPaste ? (
            <div className="composer paste-box">
              <TextArea aria-label="Claude’s answer" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste Claude’s answer here (copy it with the copy button under the reply in Claude.ai)." />
              <div className="row wrap between">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const last = messages[messages.length - 1];
                    const first = messages.length === 1;
                    await openInClaude(first ? webPrompt({ system: await buildSystemPrompt(), context: chat?.contextText, ask: last.text, webSearch: web }) : last.text);
                  }}
                >
                  <Copy size={16} /> Copy the prompt again
                </Button>
                <Button variant="primary" disabled={!pasted.trim()} onClick={addPasted}>
                  Add Claude’s answer
                </Button>
              </div>
            </div>
          ) : null}
          <div className="composer" hidden={waitingForPaste}>
            {recipe ? (
              <div className="row wrap">
                <Badge tone="yellow">{recipe.label}</Badge>
                <span className="tiny muted">{recipe.context === 'post' && ctx.kind !== 'post' ? 'Pick a post above for this one.' : ''}</span>
              </div>
            ) : null}
            <TextArea
              aria-label="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={recipe?.placeholder ?? (chat ? 'Ask a follow-up…' : 'Ask anything about content, campaigns or clients…')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
              }}
            />
            <div className="row wrap between">
              <label className="toggle" htmlFor="as-web">
                <input id="as-web" type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
                <span className="track" aria-hidden="true" />
                <span className="small">
                  <Globe size={14} /> {webMode ? 'Ask Claude to search the web' : 'Search the web (current trends; about 1 US cent per search)'}
                </span>
              </label>
              {busy ? (
                <Button variant="danger" onClick={() => abort.current?.abort()}>
                  <Square size={16} /> Stop
                </Button>
              ) : (
                <Button variant="primary" onClick={send} disabled={!text.trim() && !recipe}>
                  {webMode ? <ExternalLink size={16} /> : <Send size={16} />} {webMode ? 'Copy & open Claude.ai' : 'Send'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ m, chat }: { m: ChatMessage; chat: Chat }) {
  const app = useApp();
  if (m.role === 'user') {
    return (
      <div className="msg user">
        <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
      </div>
    );
  }
  const firstLine = m.text.split('\n').find((l) => l.trim())?.replace(/^#+\s*|\*\*/g, '').slice(0, 90) ?? 'Idea from the assistant';
  return (
    <div className="msg assistant">
      {m.text ? <Markdown text={m.text} /> : null}
      {m.error ? <Callout tone="bad">{m.error}</Callout> : null}
      {m.sources?.length ? (
        <div className="src-list">
          <span className="tiny muted">Sources:</span>
          {m.sources.slice(0, 8).map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener">
              {s.title || s.url} <ExternalLink size={11} />
            </a>
          ))}
        </div>
      ) : null}
      {m.text && !m.error ? (
        <div className="msg-actions">
          <Button size="sm" variant="ghost" onClick={async () => app.toast((await copyText(m.text)) ? 'Copied' : 'Couldn’t copy', { tone: 'good' })}>
            <Copy size={14} /> Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await saveIdea({ kind: 'idea', title: firstLine, category: 'From the assistant', notes: m.text });
              app.toast('Saved to the idea bank', { tone: 'good' });
            }}
          >
            <Lightbulb size={14} /> Save as idea
          </Button>
          {chat.context.kind === 'post' && chat.context.id ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const p = await db.posts.get(chat.context.id as string);
                if (!p) return;
                const ok = await app.confirm({ title: 'Put this in the post’s notes?', message: 'It’s added to the post’s brief so the designer can pick the caption and hooks from it.', confirmLabel: 'Add to the post' });
                if (!ok) return;
                await savePost({ ...p, brief: `${p.brief ? `${p.brief}\n\n` : ''}From the assistant:\n${m.text}` });
                app.toast('Added to the post', { tone: 'good' });
              }}
            >
              <Wand2 size={14} /> Add to the post
            </Button>
          ) : null}
          {m.usage ? (
            <span className="tiny muted" style={{ alignSelf: 'center' }}>
              {m.usage.searches ? `${m.usage.searches} searches · ` : ''}about ${m.usage.costUsd.toFixed(m.usage.costUsd < 0.1 ? 3 : 2)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

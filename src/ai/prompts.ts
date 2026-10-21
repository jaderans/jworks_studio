import { alive, db } from '../db/db';
import { getSetting } from '../db/settings';
import { STATUS_LABEL, restartDay } from '../domain/calendar';
import { STAGE_META } from '../domain/funnel';
import { compactNumber, outliers, totals } from '../domain/metrics';
import { PLATFORMS } from '../domain/platforms';
import { upcomingDates } from '../domain/seasons';
import { addDays, fmtIsoDate, fmtIsoWeekday, todayISO } from '../lib/time';
import { peso } from '../lib/money';

/**
 * What Claude knows about JoshWorks. The system prompt holds the stable brand
 * context (so it can be cached); anything that changes per request — today's
 * date, the post being discussed, recent results — goes into the message.
 */
export async function buildSystemPrompt(): Promise<string> {
  const [business, voice, cadence] = await Promise.all([getSetting('business'), getSetting('voice'), getSetting('cadence')]);
  const members = alive(await db.members.toArray()).filter((m) => m.active === 1);
  const themes = cadence.themes.filter((t) => t.active).map((t) => `- ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.dow]}: ${t.name}${t.flex ? ' (flex, only when needed)' : ''} — ${t.description}`);
  return `You are the marketing assistant inside JoshWorks Studio, the planning app of ${business.name}, a ${business.registration || 'registered'} creative studio in ${business.address || 'Iloilo City, Philippines'}.

## The studio
${business.name} designs branding and logos, packaging, merchandise (shirts, ID laces, tote bags), stickers, illustrations and characters, motion graphics, and websites. It is also starting a social media management (SMM) service for local businesses, at introductory prices. Clients are small businesses, student organizations, schools and companies around Iloilo and the Philippines.
Team:
${members.length ? members.map((m) => `- ${m.name}: ${m.roleLabel || m.appRole}`).join('\n') : '- (team not set up yet)'}

## Weekly content rhythm
${themes.join('\n')}
Friday rotates: ${cadence.fridayRotation.join(' → ')}. The week starting on the last Monday of each month is a break week (no posting: batch content, reply to DMs, repost winners). Public holidays stay free.

## Voice
Tone: ${voice.tone}
Audience: ${voice.audience}
Do: ${voice.doSay}
Avoid: ${voice.dontSay}
Emoji: ${voice.emoji === 'none' ? 'none' : voice.emoji === 'light' ? 'a few, where they add meaning' : 'expressive but purposeful'}. Language: ${voice.language}
${voice.boldHeadline ? 'The team styles the first line of captions with Unicode bold (𝗹𝗶𝗸𝗲 𝘁𝗵𝗶𝘀). Write it in plain text; they convert it in the app. Never style hashtags.' : ''}
Default call to action: ${voice.defaultCta}
Base hashtags: ${voice.baseHashtags}

## What works in 2026 (use it)
- Instagram ranks on watch time, likes and sends (DM shares); sends matter most for reaching non-followers. Originality is rewarded; reposts and lightly edited clips are pushed down on Instagram and Facebook.
- Instagram allows at most ${PLATFORMS.instagram.maxHashtags} hashtags per post. Carousels: 8–12 slides; slide 2 is a second hook. Feed 4:5, Reels/TikTok 9:16.
- TikTok works like search: say the topic in the first seconds, on screen and in the caption. Completion rate drives reach.
- Philippine audiences trust real faces, reviews and clear prices. Best times (PHT): Facebook 6–8 PM, Instagram 8–10 PM, TikTok early evening.
- Saves predict value; shares predict reach. Optimise for those, not likes.
- WHAT IF posts (unofficial redesigns of known brands) must say they are unofficial fan concepts, not affiliated or commissioned, and never use the real logo files.

## How to answer
- Be concrete and ready to use: real captions, real hooks, real slide text, not advice about writing them.
- Label each platform's version when giving captions. Respect each platform's limits.
- Prices are in Philippine pesos (₱). Don't invent client facts, results, testimonials or statistics; ask, or mark a blank like [client result].
- When you used the web, say what's current and when it was published. Prefer sources from the last 30 days for trends.
- Keep answers short unless asked for a full plan. Use Markdown headings and lists for structure.`;
}

export interface RecipeContext {
  kind: 'post' | 'campaign' | 'client' | 'none';
  id: string | null;
}

/** Per-request context: today, the restart date, what's coming up, and the thing being discussed. */
export async function buildContext(ctx: RecipeContext, opts: { includeResults?: boolean } = {}): Promise<string> {
  const today = todayISO();
  const cadence = await getSetting('cadence');
  const lines: string[] = [`Today is ${fmtIsoWeekday(today)}, ${today.slice(0, 4)} (Philippine time).`];
  if (cadence.resumeOn && cadence.resumeOn > today) lines.push(`Posting is paused and restarts ${fmtIsoWeekday(restartDay(cadence))}.`);
  const dates = upcomingDates(today, 75).filter((d) => d.kind !== 'payday').slice(0, 8);
  if (dates.length) lines.push(`Coming up: ${dates.map((d) => `${d.name} (${fmtIsoDate(d.date)})`).join('; ')}.`);
  const posts = alive(await db.posts.toArray());
  const soon = posts.filter((p) => p.date && p.date >= today && p.date <= addDays(today, 21) && p.clientId === null).sort((a, b) => (a.date as string).localeCompare(b.date as string));
  if (soon.length) lines.push(`Next three weeks on JoshWorks' calendar:\n${soon.slice(0, 12).map((p) => `- ${fmtIsoWeekday(p.date as string)}: ${p.title} (${p.format || 'post'}, ${STATUS_LABEL[p.status]})`).join('\n')}`);

  if (ctx.kind === 'post' && ctx.id) {
    const p = await db.posts.get(ctx.id);
    if (p) {
      const members = alive(await db.members.toArray());
      const who = p.assignees.map((a) => members.find((m) => m.id === a)?.name).filter(Boolean).join(', ');
      const client = p.clientId ? await db.clients.get(p.clientId) : null;
      lines.push(
        `\nThe post we're working on:\n- Title: ${p.title}\n- Date: ${p.date ? fmtIsoWeekday(p.date) : 'not set'}\n- Theme: ${cadence.themes.find((t) => t.key === p.themeKey)?.name ?? 'none'}\n- Format: ${p.format || 'not set'}\n- Brand: ${client ? `${client.name} (client, ${client.industry})` : 'JoshWorks'}\n- Designer: ${who || 'not assigned'}\n- Series: ${p.series || 'none'}\n- Funnel stage: ${p.funnelStage ? STAGE_META[p.funnelStage].label : 'not set'}\n- Platforms: ${p.platforms.map((k) => PLATFORMS[k].label).join(', ')}\n- Hook: ${p.hook || '(none yet)'}\n- Brief: ${p.brief || '(none)'}\n- Current caption: ${p.caption ? `\n${p.caption}` : '(none yet)'}\n- CTA: ${p.cta || '(none)'}`,
      );
      if (p.ideaId) {
        const idea = await db.ideas.get(p.ideaId);
        if (idea?.slides.length) lines.push(`Script:\n${idea.slides.map((s) => `- ${s.label}: ${s.text}`).join('\n')}`);
      }
    }
  }
  if (ctx.kind === 'campaign' && ctx.id) {
    const c = await db.campaigns.get(ctx.id);
    if (c) lines.push(`\nThe campaign:\n- ${c.name} (${c.goal}), ${c.startDate} to ${c.endDate}\n- Offer: ${c.offer}\n- Key message: ${c.keyMessage}\n- DM keyword: ${c.ctaKeyword}\n- Audience: ${c.audience.who}; pains: ${c.audience.pains}; wants: ${c.audience.wants}; objections: ${c.audience.objections}`);
  }
  if (ctx.kind === 'client' && ctx.id) {
    const c = await db.clients.get(ctx.id);
    if (c) {
      const pkg = c.packageId ? await db.packages.get(c.packageId) : null;
      lines.push(
        `\nThe client:\n- ${c.name}, ${c.industry || 'business'} in ${c.location || 'Iloilo'}\n- Stage: ${c.stage}\n- Goals: ${c.goals || 'not written yet'}\n- Platforms: ${c.platforms.map((k) => PLATFORMS[k].label).join(', ')}\n- Audience: ${c.persona.who || 'not written yet'}; pains: ${c.persona.pains}\n${pkg ? `- Package: ${pkg.name}, ${peso(pkg.price)} a month: ${pkg.includes.join('; ')}` : ''}`,
      );
    }
  }
  if (opts.includeResults) {
    const metrics = alive(await db.metrics.toArray()).filter((m) => (ctx.kind === 'client' && ctx.id ? m.clientId === ctx.id : m.clientId === null));
    if (metrics.length) {
      const t = totals(metrics);
      const out = outliers(metrics);
      const top = [...metrics].sort((a, b) => (b.shares ?? 0) + (b.saves ?? 0) - ((a.shares ?? 0) + (a.saves ?? 0))).slice(0, 5);
      lines.push(
        `\nResults logged so far (${t.posts} posts): ${compactNumber(t.views)} views, ${compactNumber(t.reach)} reach, ${t.saves} saves, ${t.shares} shares.\nTop by saves + shares:\n${top.map((m) => `- ${m.title} (${m.platform}, ${m.date}): ${m.views ?? '?'} views, ${m.saves ?? 0} saves, ${m.shares ?? 0} shares${out.has(m.id) ? `, ${out.get(m.id)!.ratio.toFixed(1)}× usual views` : ''}`).join('\n')}`,
      );
    }
  }
  return lines.join('\n');
}

export interface Recipe {
  id: string;
  label: string;
  /** What the button sends; {topic} is replaced with what the person typed. */
  prompt: string;
  /** required: what they type is the subject. optional: it's added as an extra note. */
  topic: 'required' | 'optional';
  context: RecipeContext['kind'] | 'any';
  webSearch: boolean;
  results?: boolean;
  placeholder?: string;
}

export const RECIPES: Recipe[] = [
  {
    id: 'captions',
    label: 'Write captions',
    topic: 'optional',
    context: 'post',
    webSearch: false,
    prompt: 'Write the captions for this post: a Facebook version (story-led), an Instagram version (hook first, at most 5 hashtags) and a TikTok version (short, with the topic as search keywords). Give two hook options for the first line, then each caption ready to paste, ending with one clear call to action.{topic}',
    placeholder: 'Anything to add? (optional)',
  },
  {
    id: 'hooks',
    label: '10 hooks',
    topic: 'required',
    context: 'any',
    webSearch: false,
    prompt: 'Give me 10 scroll-stopping hooks about: {topic}. Mix patterns (mistakes, “stop doing”, POV, what if, before/after, rate this, the difference between). One line each. Mark your best 3 and say why in a few words.',
    placeholder: 'Topic, e.g. why cheap logos cost more',
  },
  {
    id: 'carousel',
    label: 'Carousel script',
    topic: 'required',
    context: 'any',
    webSearch: false,
    prompt: 'Write a carousel script about: {topic}. Cover slide, 8–10 content slides (25 words max each, slide 2 must work as a second hook), and a CTA slide. Then a short caption and 5 hashtags.',
    placeholder: 'Topic, e.g. 5 signs your packaging is costing you sales',
  },
  {
    id: 'reel',
    label: 'Reel script',
    topic: 'required',
    context: 'any',
    webSearch: false,
    prompt: 'Write a 30–45 second reel script about: {topic}. Include the hook (0–3 s) said out loud and as on-screen text, the beats with on-screen text, the b-roll shots to film (show faces, hands and process), the voice-over, and the call to action. It must make sense with the sound off.',
    placeholder: 'Topic, e.g. logo sketch to final in 30 seconds',
  },
  {
    id: 'trends',
    label: 'What’s trending now',
    topic: 'optional',
    context: 'none',
    webSearch: true,
    prompt: 'Search the web for what is trending this week that JoshWorks can use: formats, sounds, memes and conversations on TikTok, Instagram and Facebook in the Philippines, and anything new in design, branding or creator tools. For each, say what it is, why it works, and one concrete JoshWorks post idea using our weekly themes. Include dates to plan around. Cite sources.{topic}',
    placeholder: 'Focus on anything? (optional)',
  },
  {
    id: 'campaign',
    label: 'Campaign idea',
    topic: 'required',
    context: 'any',
    webSearch: false,
    prompt: 'Plan a campaign for: {topic}. Give the goal, the persona, one offer, the key message, a DM keyword, a 2-week post plan on our weekly themes (title, format, funnel stage), and 3 targets.',
    placeholder: 'e.g. holiday merch for offices, or a café client launching a new menu',
  },
  {
    id: 'repurpose',
    label: 'Repurpose a post',
    topic: 'optional',
    context: 'post',
    webSearch: false,
    prompt: 'Repurpose this post into: a reel (script with on-screen text), a 5-frame story sequence with one interactive sticker, and a Threads/X post. Keep the same message.{topic}',
  },
  {
    id: 'proposal',
    label: 'Client proposal',
    topic: 'optional',
    context: 'client',
    webSearch: false,
    prompt: 'Draft a short, warm proposal message for this client: what we noticed about their pages, what we recommend (one package, with one step up and one step down), what the first month looks like, and the next step. Plain language, under 250 words.{topic}',
  },
  {
    id: 'report',
    label: 'Results summary',
    topic: 'optional',
    context: 'any',
    webSearch: false,
    results: true,
    prompt: 'Summarise these results like a monthly report: what worked (by saves and shares), what didn’t, what to make more of, and three things to do next month.{topic}',
  },
  {
    id: 'replies',
    label: 'Reply to comments',
    topic: 'required',
    context: 'any',
    webSearch: false,
    prompt: 'Draft friendly replies in our voice to these comments or messages (keep each under 40 words; turn interest into a DM conversation):\n{topic}',
    placeholder: 'Paste the comments or DMs',
  },
];

/** The report recipe for the Trends page: same research, returned as JSON the app can store. */
export const TREND_REPORT_PROMPT = (weekOf: string) => `Research what is trending for the week of ${weekOf} that a Philippine design studio (branding, packaging, merch, stickers, illustration, motion, web) can use on Facebook, Instagram and TikTok. Use web search and prefer sources from the last 30 days. Include Philippine dates to plan around in the next 6 weeks.

Reply with only a JSON object in a \`\`\`json code block, in this exact shape:
{"weekOf": "${weekOf}", "summary": "2–3 sentences", "items": [{"id": "short-id", "title": "...", "platform": "instagram|tiktok|facebook|any", "kind": "format|sound|meme|design|algorithm|local", "what": "what it is", "why": "why it works now", "howJoshWorks": "one concrete JoshWorks post idea", "postIdea": {"title": "...", "format": "Reel|Carousel|Single image|Story", "themeKey": "mon-edu|tue-portfolio|thu-designer|fri-behind"}, "expires": "YYYY-MM-DD or null", "sources": [{"title": "...", "url": "https://..."}]}], "dates": [{"date": "YYYY-MM-DD", "name": "...", "idea": "..."}], "sources": [{"title": "...", "url": "https://..."}]}
Give 5 to 8 items. Never invent a URL: only use pages you actually found.`;

/** Pull the first JSON object out of a reply (```json fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

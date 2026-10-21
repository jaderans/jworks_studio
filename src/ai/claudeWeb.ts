import { copyText } from '../lib/text';

/**
 * Claude.ai mode: no API key and no per-use cost. The app writes the whole
 * prompt (JoshWorks' voice, team, rhythm and the post or client in question),
 * copies it, and opens Claude.ai; the answer is pasted back into the app.
 */

export const CLAUDE_WEB = 'https://claude.ai/new';

/** One message for a new Claude.ai chat: the standing instructions, the context, then the ask. */
export function webPrompt(o: { system: string; context?: string; ask: string; webSearch?: boolean }): string {
  return [
    'You are helping JoshWorks, a graphic design studio in Iloilo City, Philippines. Follow these instructions for this whole conversation:',
    '',
    '<instructions>',
    o.system.trim(),
    '</instructions>',
    ...(o.context?.trim() ? ['', '<context>', o.context.trim(), '</context>'] : []),
    '',
    ...(o.webSearch ? ['Use web search for anything current (trends, dates, platform changes) and name your sources.', ''] : []),
    o.ask.trim(),
  ].join('\n');
}

/** Copy the prompt, then open Claude.ai in a new tab. Returns whether the copy worked. */
export async function openInClaude(prompt: string): Promise<boolean> {
  const ok = await copyText(prompt);
  window.open(CLAUDE_WEB, '_blank', 'noopener,noreferrer');
  return ok;
}

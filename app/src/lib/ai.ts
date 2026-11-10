/**
 * Optional task breakdown with Claude. The API key is the user's own, kept in IndexedDB on this device,
 * and sent only to api.anthropic.com.
 */
export const AI_MODEL = 'claude-sonnet-5-5';

const SYSTEM = `You help a person with ADHD start tasks. Break the task into 3 to 7 concrete physical steps.
Rules: each step starts with a verb, takes under 10 minutes, and is specific enough to do without thinking.
The first step takes under 2 minutes. No numbering, no commentary.
Reply with only a JSON array of strings.`;

export async function breakDown(apiKey: string, title: string, notes = ''): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Task: ${title}${notes ? `\nNotes: ${notes}` : ''}` }]
    })
  });
  if (res.status === 401) throw new Error('Claude did not accept the API key. Check it in Settings.');
  if (!res.ok) throw new Error(`Claude could not answer (error ${res.status}). Add steps by hand for now.`);
  const json = await res.json();
  const text: string = (json.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
  return parseSteps(text);
}

export function parseSteps(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 7);
    } catch {
      /* fall through to line parsing */
    }
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 7);
}

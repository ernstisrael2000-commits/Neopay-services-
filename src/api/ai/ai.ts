// ─── Groq API caller ──────────────────────────────────────────────────────────
// Supports an optional per-call apiKey so each agent can use its own key,
// multiplying the effective TPM by the number of distinct keys.
// Auto-retries on 429 with the exact wait time from the error body.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_RETRIES = 4;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse "Please try again in 16.235s" → ms + 1 s buffer
function parseRetryDelay(errBody: string): number {
  const m = errBody.match(/try again in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 1000 : 20_000;
}

export async function callGroq(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,          // per-agent key (falls back to env var)
  model = DEFAULT_MODEL,
): Promise<string> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error('Aucune GROQ_API_KEY configurée.');

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.4,
    max_tokens: 800,  // reduced from 2048 to stay well under 6K TPM
  });

  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body,
    });

    if (response.ok) {
      const data = (await response.json()) as { choices: { message: { content: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Réponse Groq vide.');
      return text;
    }

    const errBody = await response.text();
    lastError = errBody;

    if (response.status === 429 && attempt < MAX_RETRIES - 1) {
      const delay = parseRetryDelay(errBody);
      console.log(`[AI] Agent 429 — attente ${(delay / 1000).toFixed(1)}s (tentative ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      continue;
    }

    throw new Error(`Groq ${response.status}: ${errBody}`);
  }

  throw new Error(`Limite Groq dépassée après ${MAX_RETRIES} tentatives. ${lastError}`);
}

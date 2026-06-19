// ─── Groq API caller ──────────────────────────────────────────────────────────
// max_tokens kept low (300) so each call stays under ~800 tokens total,
// which lets 4 sequential agents fit within a 6 000 TPM budget.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_RETRIES = 2;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseRetryDelay(body: string): number {
  const m = body.match(/try again in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 2000 : 65_000;
}

export async function callGroq(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  model = DEFAULT_MODEL,
): Promise<string> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error('Aucune clé GROQ_API_KEY configurée.');

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 600,   // ← 600 output + ~500 input = ~1 100 tokens/call → réponses complètes avec code
  });

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

    if (response.status === 429 && attempt < MAX_RETRIES - 1) {
      const delay = parseRetryDelay(errBody);
      console.log(`[AI] 429 — attente ${(delay / 1000).toFixed(0)}s avant retry ${attempt + 2}/${MAX_RETRIES}`);
      await sleep(delay);
      continue;
    }

    throw new Error(`Groq ${response.status}: ${errBody}`);
  }

  throw new Error('Limite Groq dépassée. Attendez 1 minute ou ajoutez une clé dédiée par agent dans Clés API.');
}

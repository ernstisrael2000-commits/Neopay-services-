// ─── Groq API caller ──────────────────────────────────────────────────────────
// Uses llama-3.1-8b-instant (131 072 TPM on free tier vs 12K for 70b).
// Auto-retries on 429 using the wait time extracted from the error message.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse "Please try again in 16.235s" → 16235 ms (+ 1s buffer)
function parseRetryDelay(errBody: string): number {
  const match = errBody.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 1000;
  return 20_000; // default 20s if pattern not found
}

export async function callGroq(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY non configurée.');

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model: MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 2048,
  });

  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Réponse Groq vide ou inattendue.');
      return text;
    }

    const errBody = await response.text();

    // Rate limited → wait the suggested time then retry
    if (response.status === 429) {
      const delay = parseRetryDelay(errBody);
      lastError = errBody;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(delay);
        continue;
      }
    }

    throw new Error(`Groq API error ${response.status}: ${errBody}`);
  }

  throw new Error(`Groq API — limite de débit dépassée après ${MAX_RETRIES} tentatives. ${lastError}`);
}

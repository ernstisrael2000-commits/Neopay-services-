// ─── Orchestrateur multi-agent ────────────────────────────────────────────────
// Exécute les 4 agents SÉQUENTIELLEMENT avec 1 s de pause entre chaque pour
// rester sous la limite TPM même sur les comptes gratuits (6K TPM).
// Chaque agent peut utiliser sa propre clé API Groq pour distribuer la charge.

import { securityAgent, uiAgent, performanceAgent, adminAgent } from './agents.ts';

export interface AgentKeys {
  security?: string;
  ui?: string;
  performance?: string;
  admin?: string;
}

export interface AnalysisReport {
  security: string;
  ui: string;
  performance: string;
  admin: string;
  analyzedAt: string;
  durationMs: number;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cap code at 4 000 chars per agent — at ~4 chars/token that's ~1 000 input tokens,
// leaving ~5 000 tokens of headroom per minute for the response.
const MAX_CODE_CHARS = 4_000;

export async function orchestrate(code: string, keys: AgentKeys = {}): Promise<AnalysisReport> {
  if (!code || code.trim().length < 50)
    throw new Error('Code trop court pour être analysé (minimum 50 caractères).');

  const excerpt = code.length > MAX_CODE_CHARS
    ? code.slice(0, MAX_CODE_CHARS) + `\n\n// [... tronqué — ${code.length.toLocaleString()} chars au total ...]`
    : code;

  const start = Date.now();

  // Sequential execution: one agent at a time, 1 s pause between each.
  // This guarantees we never exceed TPM even with a 6K limit.
  console.log('[AI] Agent sécurité…');
  const security = await securityAgent(excerpt, keys.security);
  await sleep(1000);

  console.log('[AI] Agent UI…');
  const ui = await uiAgent(excerpt, keys.ui);
  await sleep(1000);

  console.log('[AI] Agent performance…');
  const performance = await performanceAgent(excerpt, keys.performance);
  await sleep(1000);

  console.log('[AI] Agent architecture…');
  const admin = await adminAgent(excerpt, keys.admin);

  return {
    security,
    ui,
    performance,
    admin,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

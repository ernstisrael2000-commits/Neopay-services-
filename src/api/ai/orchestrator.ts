// ─── Orchestrateur multi-agent ────────────────────────────────────────────────
// Agents exécutés SÉQUENTIELLEMENT avec 15 s de pause entre chaque.
// Budget : ~750 tokens/appel × 4 agents = ~3 000 TPM → bien sous 6 000 TPM.
// Code limité à 1 200 chars par agent (~300 tokens d'input code).

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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// 1 200 chars ≈ 300 tokens of code input — keeps total call under ~750 tokens
const MAX_CODE_CHARS = 1_200;

// Gap between agents: 15 s ensures the rolling TPM window resets between calls
const AGENT_GAP_MS = 15_000;

export async function orchestrate(code: string, keys: AgentKeys = {}): Promise<AnalysisReport> {
  if (!code || code.trim().length < 30)
    throw new Error('Code trop court (minimum 30 caractères).');

  const excerpt = code.length > MAX_CODE_CHARS
    ? code.slice(0, MAX_CODE_CHARS) + `\n// [tronqué — ${code.length.toLocaleString()} chars total]`
    : code;

  const start = Date.now();

  console.log('[AI] ▶ Agent sécurité…');
  const security = await securityAgent(excerpt, keys.security);

  console.log(`[AI] ⏳ Pause ${AGENT_GAP_MS / 1000}s…`);
  await sleep(AGENT_GAP_MS);

  console.log('[AI] ▶ Agent UI…');
  const ui = await uiAgent(excerpt, keys.ui);

  console.log(`[AI] ⏳ Pause ${AGENT_GAP_MS / 1000}s…`);
  await sleep(AGENT_GAP_MS);

  console.log('[AI] ▶ Agent performance…');
  const performance = await performanceAgent(excerpt, keys.performance);

  console.log(`[AI] ⏳ Pause ${AGENT_GAP_MS / 1000}s…`);
  await sleep(AGENT_GAP_MS);

  console.log('[AI] ▶ Agent architecture…');
  const admin = await adminAgent(excerpt, keys.admin);

  console.log('[AI] ✓ Analyse terminée en', ((Date.now() - start) / 1000).toFixed(1), 's');

  return {
    security,
    ui,
    performance,
    admin,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

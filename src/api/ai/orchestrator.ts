// ─── Orchestrateur multi-agent ────────────────────────────────────────────────
// Lance les 4 agents avec un léger décalage entre chaque appel pour éviter
// de dépasser la limite TPM (tokens/minute) du plan gratuit Groq.

import { securityAgent, uiAgent, performanceAgent, adminAgent } from './agents.ts';

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

export async function orchestrate(code: string): Promise<AnalysisReport> {
  if (!code || code.trim().length < 50) {
    throw new Error('Code trop court pour être analysé (minimum 50 caractères).');
  }

  // Truncate to ~12 000 chars per agent to stay within context limits
  const truncated = code.length > 12_000
    ? code.slice(0, 12_000) + '\n\n[... code tronqué pour l\'analyse ...]'
    : code;

  const start = Date.now();

  // Stagger agent starts by 500ms each to spread token consumption over time
  // and avoid simultaneous 429s on the free tier (131K TPM for llama-3.1-8b-instant).
  const [security, ui, performance, admin] = await Promise.all([
    securityAgent(truncated),
    sleep(500).then(() => uiAgent(truncated)),
    sleep(1000).then(() => performanceAgent(truncated)),
    sleep(1500).then(() => adminAgent(truncated)),
  ]);

  return {
    security,
    ui,
    performance,
    admin,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

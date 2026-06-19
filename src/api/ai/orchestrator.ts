// ─── Orchestrateur multi-agent ────────────────────────────────────────────────
// Lance les 4 agents en parallèle et retourne un rapport structuré.

import { securityAgent, uiAgent, performanceAgent, adminAgent } from './agents.ts';

export interface AnalysisReport {
  security: string;
  ui: string;
  performance: string;
  admin: string;
  analyzedAt: string;
  durationMs: number;
}

export async function orchestrate(code: string): Promise<AnalysisReport> {
  if (!code || code.trim().length < 50) {
    throw new Error('Code trop court pour être analysé (minimum 50 caractères).');
  }

  // Truncate to ~12 000 chars to stay within Groq context limits per agent
  const truncated = code.length > 12_000
    ? code.slice(0, 12_000) + '\n\n[... code tronqué pour l\'analyse ...]'
    : code;

  const start = Date.now();

  const [security, ui, performance, admin] = await Promise.all([
    securityAgent(truncated),
    uiAgent(truncated),
    performanceAgent(truncated),
    adminAgent(truncated),
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

// ─── Orchestrateur multi-agent ────────────────────────────────────────────────
// Agents exécutés SÉQUENTIELLEMENT avec 15 s de pause entre chaque.
// Budget : ~750 tokens/appel × 4 agents = ~3 000 TPM → bien sous 6 000 TPM.
// L'agent UX ne reçoit QUE les fichiers frontend (JSX/TSX/hooks/lib).
// Les autres agents reçoivent tout le code.

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

// 8 000 chars ≈ 2 000 tokens of code input — keeps total call under Groq free-tier limits
const MAX_CODE_CHARS = 8_000;

// Gap between agents: 15 s ensures the rolling TPM window resets between calls
const AGENT_GAP_MS = 15_000;

// Backend-only file patterns — UX agent should skip these
const BACKEND_FILE_PATTERNS = [
  'router.ts', 'server.ts', 'firebase-admin', 'nodemailer',
  'firestore.rules', 'src/api/',
];

/**
 * From a combined code string (with `// ═══ FICHIER : path ═══` headers),
 * extract only the sections for frontend files (tsx, hooks, lib, components).
 * Returns the filtered string, or a fallback message if nothing frontend was found.
 */
function extractFrontendCode(code: string): string {
  // Split by file headers
  const sections = code.split(/(?=\/\/ ═══ FICHIER : )/);

  const frontendSections = sections.filter(section => {
    const headerMatch = section.match(/\/\/ ═══ FICHIER : (.+?) ═══/);
    if (!headerMatch) return false;
    const filePath = headerMatch[1].trim();
    const isBackend = BACKEND_FILE_PATTERNS.some(p => filePath.includes(p));
    return !isBackend;
  });

  if (frontendSections.length === 0) {
    return '// Aucun fichier frontend (TSX/hooks/lib) dans cet extrait — analyse UX/UI non applicable.';
  }

  const combined = frontendSections.join('\n\n');
  return combined.length > MAX_CODE_CHARS
    ? combined.slice(0, MAX_CODE_CHARS) + '\n// [tronqué]'
    : combined;
}

export async function orchestrate(code: string, keys: AgentKeys = {}): Promise<AnalysisReport> {
  if (!code || code.trim().length < 30)
    throw new Error('Code trop court (minimum 30 caractères).');

  const excerpt = code.length > MAX_CODE_CHARS
    ? code.slice(0, MAX_CODE_CHARS) + `\n// [tronqué — ${code.length.toLocaleString()} chars total]`
    : code;

  // Frontend-only excerpt for the UX agent
  const frontendExcerpt = extractFrontendCode(code);

  const start = Date.now();

  console.log('[AI] ▶ Agent sécurité…');
  const security = await securityAgent(excerpt, keys.security);

  console.log(`[AI] ⏳ Pause ${AGENT_GAP_MS / 1000}s…`);
  await sleep(AGENT_GAP_MS);

  console.log('[AI] ▶ Agent UI… (frontend uniquement)');
  const ui = await uiAgent(frontendExcerpt, keys.ui);

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

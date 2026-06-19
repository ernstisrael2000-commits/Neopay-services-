// ─── Agents IA spécialisés ────────────────────────────────────────────────────
// Prompts courts et ciblés pour rester sous 450 tokens d'input par appel.

import { callGroq } from './ai.ts';

// ~30 tokens — court mais suffisant pour orienter le modèle
const SYSTEM = `Expert React/Node.js/Firebase. Réponds en français. Structure : ## Problèmes (3 max) / ## Solutions (code court par problème) / ## Priorités.`;

export async function securityAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `AUDIT SÉCURITÉ :\n\`\`\`\n${code}\n\`\`\`\nFailles auth, routes non protégées, données sensibles, Firebase rules, injections. Solution courte par problème.`,
    SYSTEM, apiKey,
  );
}

export async function uiAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `AUDIT UX/UI :\n\`\`\`\n${code}\n\`\`\`\nNavigation, responsive, états de chargement, formulaires, cohérence Tailwind. Amélioration concrète par point.`,
    SYSTEM, apiKey,
  );
}

export async function performanceAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `AUDIT PERFORMANCE :\n\`\`\`\n${code}\n\`\`\`\nRequêtes inutiles, re-rendus React, cache absent, images base64, Promise.all manquant. Solution optimisée par point.`,
    SYSTEM, apiKey,
  );
}

export async function adminAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `AUDIT ARCHITECTURE :\n\`\`\`\n${code}\n\`\`\`\nStructure Express, gestion des rôles, séparation responsabilités, erreurs, duplication de code. Refactorisation par point.`,
    SYSTEM, apiKey,
  );
}

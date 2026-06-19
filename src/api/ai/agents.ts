// ─── Agents IA spécialisés ────────────────────────────────────────────────────
// Chaque agent accepte une clé API optionnelle (pour distribuer la charge
// TPM sur plusieurs comptes Groq).

import { callGroq } from './ai.ts';

const SYSTEM = `Tu es un expert senior en développement web (React, Node.js, Firebase, TypeScript, Tailwind CSS).
Tu audites du code source réel d'un site web en production (application fintech/logistique appelée Rena).
Réponds TOUJOURS en français. Sois concis et précis.
Structure ta réponse ainsi :
## Problèmes identifiés
- liste des problèmes (3-5 maximum, les plus importants)
## Solutions concrètes
Pour chaque problème, donne une solution avec un extrait de code ou des étapes précises.
## Priorité d'action
Classe les améliorations du plus critique au moins urgent.`;

export async function securityAgent(code: string, apiKey?: string): Promise<string> {
  const prompt = `AUDIT DE SÉCURITÉ sur ce code :\n\`\`\`\n${code}\n\`\`\`\nAnalyse : auth/autorisation, routes API exposées, données sensibles (paiements, tokens), règles Firestore, validation des entrées. Propose une correction concrète par problème.`;
  return callGroq(prompt, SYSTEM, apiKey);
}

export async function uiAgent(code: string, apiKey?: string): Promise<string> {
  const prompt = `AUDIT UX/UI sur ce code :\n\`\`\`\n${code}\n\`\`\`\nAnalyse : navigation, cohérence visuelle Tailwind/shadcn, responsive mobile, états de chargement, formulaires (dépôt/retrait). Propose des améliorations concrètes (JSX, classes Tailwind).`;
  return callGroq(prompt, SYSTEM, apiKey);
}

export async function performanceAgent(code: string, apiKey?: string): Promise<string> {
  const prompt = `AUDIT DE PERFORMANCE sur ce code :\n\`\`\`\n${code}\n\`\`\`\nAnalyse : requêtes Firestore/API inutiles, re-rendus React (memo manquant), images base64 en DB, appels en cascade vs Promise.all, paginations manquantes. Propose une solution optimisée par problème.`;
  return callGroq(prompt, SYSTEM, apiKey);
}

export async function adminAgent(code: string, apiKey?: string): Promise<string> {
  const prompt = `AUDIT D'ARCHITECTURE sur ce code :\n\`\`\`\n${code}\n\`\`\`\nAnalyse : structure Express/middleware, gestion des rôles SaaS, séparation des responsabilités, gestion des erreurs, maintenabilité (duplication, fonctions trop longues). Propose une refactorisation concrète par problème.`;
  return callGroq(prompt, SYSTEM, apiKey);
}

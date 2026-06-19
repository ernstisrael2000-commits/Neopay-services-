// ─── Agents IA spécialisés ────────────────────────────────────────────────────
// Chaque agent produit un prompt orienté "audit + solutions concrètes"
// pour une dimension précise du projet.

import { callGroq } from './ai.ts';

const SYSTEM = `Tu es un expert senior en développement web (React, Node.js, Firebase, TypeScript, Tailwind CSS).
Tu audites du code source réel d'un site web en production (application fintech/logistique appelée Rena).
Réponds TOUJOURS en français.
Structure ta réponse ainsi :
## Problèmes identifiés
- liste des problèmes avec une brève explication
## Solutions concrètes
Pour chaque problème, donne une solution avec des extraits de code ou des étapes précises.
## Priorité d'action
Classe les améliorations du plus critique au moins urgent.`;

// ── Agent sécurité ─────────────────────────────────────────────────────────────
export async function securityAgent(code: string): Promise<string> {
  const prompt = `Effectue un AUDIT DE SÉCURITÉ complet sur ce code :

\`\`\`
${code}
\`\`\`

Analyse spécifiquement :
- Failles d'authentification / autorisation (admin, affiliate, agent, client)
- Exposition des routes API (vérification de rôle manquante, injection, etc.)
- Gestion des données sensibles (mots de passe, tokens, paiements MonCash/NatCash)
- Sécurité Firebase (règles Firestore, clés exposées côté client)
- Validation des entrées utilisateur (dépôts, retraits, formulaires)
- CORS, rate limiting, CSRF, XSS

Pour CHAQUE problème trouvé, propose une correction concrète avec du code.`;
  return callGroq(prompt, SYSTEM);
}

// ── Agent UX/UI ────────────────────────────────────────────────────────────────
export async function uiAgent(code: string): Promise<string> {
  const prompt = `Effectue un AUDIT UX/UI complet sur ce code :

\`\`\`
${code}
\`\`\`

Analyse spécifiquement :
- Expérience utilisateur (flux de navigation, clarté des actions)
- Design et cohérence visuelle (Tailwind CSS, shadcn/ui)
- Responsive design et accessibilité (mobile-first, aria, contraste)
- Performance perçue (états de chargement, feedback utilisateur)
- Formulaires et dialogues (dépôt, retrait, tracking)
- Lisibilité des dashboards (client, admin, affilié, agent)

Pour CHAQUE point, propose des améliorations concrètes (JSX, classes Tailwind, structure).`;
  return callGroq(prompt, SYSTEM);
}

// ── Agent performance ──────────────────────────────────────────────────────────
export async function performanceAgent(code: string): Promise<string> {
  const prompt = `Effectue un AUDIT DE PERFORMANCE complet sur ce code :

\`\`\`
${code}
\`\`\`

Analyse spécifiquement :
- Requêtes Firestore/API inutiles ou non optimisées
- Absence de cache (données statiques rechargées trop souvent)
- Re-rendus React inutiles (memo, useCallback, useMemo manquants)
- Bundle size (imports lourds, code splitting absent)
- Gestion des images (base64 en Firestore, taille non optimisée)
- Appels API en cascade au lieu de Promise.all
- Paginations manquantes sur les listes longues

Pour CHAQUE problème, propose une solution concrète avec du code optimisé.`;
  return callGroq(prompt, SYSTEM);
}

// ── Agent architecture ─────────────────────────────────────────────────────────
export async function adminAgent(code: string): Promise<string> {
  const prompt = `Effectue un AUDIT D'ARCHITECTURE ET DE SCALABILITÉ sur ce code :

\`\`\`
${code}
\`\`\`

Analyse spécifiquement :
- Structure du code backend (Express, routes, middleware)
- Logique métier SaaS (gestion des rôles, permissions, multi-tenant)
- Gestion des erreurs (try/catch, retours API, logging)
- Séparation des responsabilités (services, controllers, modèles)
- Potentiel de scalabilité (Firestore transactions, batch writes)
- Gestion des états côté React (useState vs contexte vs store)
- Maintenabilité (duplication de code, fonctions trop longues)

Pour CHAQUE problème, propose une refactorisation concrète avec du code.`;
  return callGroq(prompt, SYSTEM);
}

// ─── Agents IA spécialisés ────────────────────────────────────────────────────

import { callGroq } from './ai.ts';

const SYSTEM = `Tu es un développeur senior React/Node.js/Firebase/TypeScript.
Tu fais une revue de code précise et actionnable, en français.
Pour chaque problème trouvé, tu DOIS indiquer :
- Le fichier exact (ex: src/api/router.ts) et la ligne ou la fonction concernée
- Le code problématique exact (extrait copié du code fourni)
- La correction complète et prête à coller

Format de réponse STRICT :
## 🔴 Problème 1 — [titre court]
**📁 Fichier :** \`nom-du-fichier.ts\`
**📍 Localisation :** fonction \`nomFonction\` / ligne ~XX
**❌ Code actuel :**
\`\`\`ts
// coller l'extrait exact du problème
\`\`\`
**✅ Correction :**
\`\`\`ts
// correction complète prête à coller
\`\`\`
**💡 Pourquoi :** explication courte (1 ligne)

Identifie 2 à 4 problèmes max. Sois précis, ne généralise pas.`;

export async function securityAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `REVUE SÉCURITÉ du code suivant. Cherche : routes Express sans auth, tokens exposés, injections, règles Firestore trop permissives, données sensibles dans les logs, headers manquants, CORS trop ouvert.\n\n\`\`\`\n${code}\n\`\`\`\n\nDonne les problèmes avec fichier exact, localisation précise, code actuel et correction prête à coller.`,
    SYSTEM, apiKey,
  );
}

export async function uiAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `REVUE UX/UI du code suivant. Cherche : états de chargement manquants, absence de feedback d'erreur utilisateur, formulaires sans validation visible, responsive cassé, accessibilité (aria, labels), incohérences Tailwind (couleurs/tailles/espacements).\n\n\`\`\`\n${code}\n\`\`\`\n\nDonne les problèmes avec fichier exact, localisation précise, code actuel et correction prête à coller.`,
    SYSTEM, apiKey,
  );
}

export async function performanceAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `REVUE PERFORMANCE du code suivant. Cherche : appels API dans des boucles, absence de useCallback/useMemo sur des fonctions lourdes, re-rendus inutiles, Firestore queries sans limite, Promise séquentielles remplaçables par Promise.all, images non optimisées, useEffect sans cleanup.\n\n\`\`\`\n${code}\n\`\`\`\n\nDonne les problèmes avec fichier exact, localisation précise, code actuel et correction prête à coller.`,
    SYSTEM, apiKey,
  );
}

export async function adminAgent(code: string, apiKey?: string): Promise<string> {
  return callGroq(
    `REVUE ARCHITECTURE du code suivant. Cherche : logique métier dans les composants React (doit être dans des hooks ou services), duplication de code, gestion d'erreurs absente ou trop générique (catch vide), routes Express mal structurées, typage TypeScript \`any\` évitable, constantes magiques non extraites.\n\n\`\`\`\n${code}\n\`\`\`\n\nDonne les problèmes avec fichier exact, localisation précise, code actuel et correction prête à coller.`,
    SYSTEM, apiKey,
  );
}

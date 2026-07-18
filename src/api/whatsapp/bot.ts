// ─── Bot WhatsApp Rena — propulsé par Groq AI ────────────────────────────────
// Webhook Twilio : reçoit les messages WhatsApp entrants et répond via Groq.

import { callGroq } from '../ai/ai.ts';

// ── Contexte de connaissance du site Rena ─────────────────────────────────────
const RENA_SYSTEM_PROMPT = `Tu es l'assistant virtuel officiel de Rena Intelligence, une plateforme logistique et fintech basée en Haïti.

## Ce que fait Rena
Rena est une application multi-rôles qui propose :
- **Gestion de colis & shipping** : suivi de colis, expéditions locales et internationales
- **Portefeuille numérique** : dépôts, retraits, transferts d'argent (via MonCash / NatCash)
- **Achat de produits & services** : marketplace de produits numériques (Netflix, Disney+, etc.)
- **Formations en ligne** : cours accessibles aux clients et affiliés
- **Programme d'affiliation** : les affiliés gagnent des commissions en recrutant des clients
- **Réseau d'agents** : des agents physiques permettent les dépôts/retraits en espèces

## Comptes disponibles
- **Client** : accès à l'app, achats, portefeuille, suivi de colis
- **Affilié** : comme client + système de parrainage et commissions
- **Agent** : gestion des transactions cash pour les clients
- **Admin** : gestion complète de la plateforme

## Contact & support
- Pour créer un compte ou s'inscrire, le client passe par l'application web Rena
- Pour les problèmes urgents, escalader vers un agent humain

## Règles de comportement
- Réponds TOUJOURS en français (ou dans la langue du client si différente)
- Sois concis, chaleureux et professionnel (messages WhatsApp courts, max 3 paragraphes)
- Si tu ne connais pas la réponse exacte (prix spécifiques, disponibilité d'un produit, solde d'un compte), dis-le honnêtement et propose de rediriger vers le support humain
- Ne donne JAMAIS d'informations sur les comptes, soldes ou transactions — redirige vers l'app
- Si le client veut parler à un humain, réponds : "Je transmets votre demande. Un agent Rena va vous contacter bientôt."
- Pour les nouvelles inscriptions, dis : "Pour créer votre compte Rena, rendez-vous sur notre application. Je peux vous guider !"
- Commence chaque première interaction par une courte présentation de Rena`;

// ── Mémoire de conversation par numéro ───────────────────────────────────────
// Stockage en mémoire (redémarre avec le serveur — suffisant pour un bot simple)
const conversationHistory = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
const MAX_HISTORY = 10; // Garder les 10 derniers échanges par contact

// ── Réponse rapide pour les messages de déclenchement Twilio ─────────────────
const GREETING_TRIGGERS = ['hello', 'bonjour', 'salut', 'hi', 'bonsoir', 'allo', 'allô'];

export async function handleWhatsAppMessage(
  from: string,
  body: string,
): Promise<string> {
  const userMessage = body.trim();
  const fromKey = from.replace(/\D/g, ''); // normalise le numéro comme clé

  // Initialiser l'historique si nouveau contact
  if (!conversationHistory.has(fromKey)) {
    conversationHistory.set(fromKey, []);
  }
  const history = conversationHistory.get(fromKey)!;

  // Ajouter le message de l'utilisateur à l'historique
  history.push({ role: 'user', content: userMessage });

  // Limiter l'historique
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  // Construire le prompt avec l'historique
  let conversationContext = '';
  if (history.length > 1) {
    const prev = history.slice(0, -1);
    conversationContext = '\n\nHistorique de la conversation :\n' +
      prev.map(m => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`).join('\n');
  }

  const prompt = `${conversationContext}\n\nClient: ${userMessage}\n\nRéponds en tant qu'assistant Rena (message WhatsApp court et naturel) :`;

  try {
    const reply = await callGroq(prompt, RENA_SYSTEM_PROMPT);

    // Sauvegarder la réponse dans l'historique
    history.push({ role: 'assistant', content: reply });

    console.log(`[WhatsApp] ✓ Réponse envoyée → ${from}: ${reply.slice(0, 80)}...`);
    return reply;
  } catch (err: any) {
    console.error('[WhatsApp] Erreur Groq:', err.message);
    return 'Désolé, notre assistant est temporairement indisponible. Un agent Rena va vous contacter bientôt. 🙏';
  }
}

// ── Génère la réponse TwiML ───────────────────────────────────────────────────
export function twimlResponse(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escaped}</Message></Response>`;
}

// ── Validation signature Twilio ───────────────────────────────────────────────
import { createHmac } from 'node:crypto';

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  // Trier les paramètres et concaténer
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map(k => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  return expected === signature;
}

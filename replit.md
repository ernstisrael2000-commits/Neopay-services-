# Solutionpam — Logistics & Fintech Platform

Application web multi-rôles (clients, affiliés, agents, admins) pour la gestion de colis, paiements, portefeuilles et formations en ligne.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, Node 20 (tsx) |
| Base de données | Cloud Firestore (named DB) |
| Auth | Firebase Auth (clients) + credentials Firestore (admin/affilié/agent) |
| Email | Resend |
| Push | Web Push (VAPID) |
| Paiements | NowPayments (crypto), FazerCards |
| IA | Groq |

## Démarrage sur Replit

```bash
npm install
npm run dev        # Développement → http://localhost:5000
npm run build      # Build production
npm run start      # Production
```

Le serveur expose le port **5000** (Express + Vite SSR proxy).

Le workflow Replit **Start application** utilise `npm run dev` et sert l’aperçu sur le port 5000. Le secret `FIREBASE_SERVICE_ACCOUNT` doit être configuré pour activer les routes Firebase Admin et les données Firestore côté serveur.

## Variables d'environnement (Secrets Replit)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | JSON compte de service Firebase Admin |
| `ADMIN_SECRET` | ✅ | Mot de passe admin (accès routes /admin) |
| `RESEND_API_KEY` | ✅ | Clé API Resend (emails) |
| `NOWPAYMENTS_API_KEY` | ✅ | Clé API NowPayments (crypto) |
| `NOWPAYMENTS_IPN_SECRET` | ✅ | Secret IPN NowPayments (webhooks) |
| `FAZERCARDS_API_KEY` | ✅ | Clé API FazerCards |
| `GROQ_API_KEY` | ✅ | Clé API Groq (IA) |
| `PLOPPLOP_CLIENT_ID` | ✅ | Identifiant marchand Paym Plop Plop |
| `HEYQO_CLIENT_ID` | Pour Cartes | Identifiant partenaire HeyQO |
| `HEYQO_SECRET_ID` | Pour Cartes | Secret d’authentification HeyQO |
| `HEYQO_WEBHOOK_SECRET` | Pour Cartes | Secret HMAC des webhooks HeyQO |
| `VAPID_PUBLIC_KEY` | ✅ | Clé publique VAPID (push) |
| `VAPID_PRIVATE_KEY` | ✅ | Clé privée VAPID (push) |

## Variables d'environnement (non-secrets)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `FIRESTORE_DB_ID` | `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2` | ID de la base Firestore nommée |
| `FROM_EMAIL` | `noreply@solutionpam.com` | Adresse expéditeur emails |
| `PORT` | `5000` | Port du serveur Express |
| `HEYQO_BASE_URL` | Sandbox en développement | URL de base HeyQO, à surcharger uniquement pour un environnement validé |

## Déploiement Vercel

Le dépôt est préparé pour un déploiement Vercel avec :

- **Build command** : `npm run build`
- **Output directory** : `dist`
- **Install command** : `npm install --ignore-scripts`
- **Fonction API** : `api/index.ts`
- **Routes API** : toutes les routes `/api/*` sont réécrites vers cette fonction
- **SPA** : les routes non-API sont réécrites vers `dist/index.html`

Dans le projet Vercel, ajouter les secrets backend suivants dans les environnements
utilisés (Preview et Production séparément si les identifiants diffèrent) :

`FIREBASE_SERVICE_ACCOUNT`, `ADMIN_SECRET`, `RESEND_API_KEY`,
`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `FAZERCARDS_API_KEY`,
`GROQ_API_KEY`, `PLOPPLOP_CLIENT_ID`, `SESSION_SECRET`,
`HEYQO_CLIENT_ID`, `HEYQO_SECRET_ID`, `HEYQO_WEBHOOK_SECRET`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

Ajouter aussi les variables non-secrètes `FIRESTORE_DB_ID`, `FROM_EMAIL`,
`APP_URL` et, si nécessaire, `HEYQO_BASE_URL`. En développement, HeyQO utilise
automatiquement le Sandbox ; ne configurez l’URL de production qu’après validation.
Vercel injecte automatiquement `VERCEL_URL`,
`VERCEL_BRANCH_URL` et `VERCEL_PROJECT_PRODUCTION_URL` pour le CORS.

L’URL à déclarer dans HeyQO pour le webhook est :
`https://<domaine-vercel>/api/webhooks/heyqo`

L’API conserve les octets bruts des requêtes signées et le serveur Vercel ne doit
pas pré-parser le body. Le secret `HEYQO_WEBHOOK_SECRET` doit donc être présent
dans l’environnement Vercel correspondant à l’URL de webhook. Le webhook
NowPayments est `https://<domaine-vercel>/api/crypto/ipn`.

## Firestore

- **Base de données nommée** : `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`
- **Projet Firebase** : `gen-lang-client-0739219145`
- **Règles** : `database/firestore.rules`

## Structure du projet

```
src/pages/        — Vues et dashboards (HomeView, AdminDashboard, etc.)
src/layouts/      — Navbar, BottomNav
src/components/   — Composants UI réutilisables
src/hooks/        — Hooks React personnalisés
src/services/     — Services Firestore client
src/lib/          — Firebase, email, utilitaires
src/types/        — Types TypeScript
src/api/router.ts — Routes Express (API backend)
database/         — Règles Firestore & Storage
docs/             — Documentation complète
```

## User preferences

- Langue : Français

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
| `VAPID_PUBLIC_KEY` | ✅ | Clé publique VAPID (push) |
| `VAPID_PRIVATE_KEY` | ✅ | Clé privée VAPID (push) |

## Variables d'environnement (non-secrets)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `FIRESTORE_DB_ID` | `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2` | ID de la base Firestore nommée |
| `FROM_EMAIL` | `noreply@solutionpam.com` | Adresse expéditeur emails |
| `PORT` | `5000` | Port du serveur Express |

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

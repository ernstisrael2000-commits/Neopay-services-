# Rena — Logistics & Fintech Platform

Application web multi-rôles (clients, affiliés, agents, admins) pour la gestion de colis, paiements, portefeuilles et formations en ligne.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, Node 20 (tsx) |
| Base de données | Cloud Firestore (named DB) |
| Auth | Firebase Auth (clients) + credentials Firestore (admin/affiliate/agent) |
| Email | Resend (RESEND_API_KEY) |
| IA | Groq (GROQ_API_KEY) |
| Paiements | NowPayments (NOWPAYMENTS_API_KEY) + MonCash/NatCash (Haïti) |
| Push | Web Push / FCM — VAPID keys configurées |

## Démarrer

```bash
npm install
npm run dev        # → http://localhost:5000
npm run build      # Build production
npm run start      # Production
```

## Variables d'environnement

Toutes gérées via Replit Secrets / Env Vars.

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | JSON du compte de service Firebase Admin |
| `RESEND_API_KEY` | ✅ | Clé API Resend pour les emails |
| `GROQ_API_KEY` | ✅ | Clé API Groq pour l'IA |
| `NOWPAYMENTS_API_KEY` | ✅ | Clé API NowPayments |
| `FIRESTORE_DB_ID` | ✅ (env var) | `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2` |
| `VAPID_PUBLIC_KEY` | ✅ (env var) | Clé publique VAPID pour Push |
| `APP_URL` | ✅ (env var) | URL publique de l'app |
| `RECAPTCHA_SECRET_KEY` | ❌ | Clé secrète reCAPTCHA v2 |
| `MONCASH_SECRET_KEY` | ❌ | Clé secrète MonCash |
| `SMTP_USER` / `SMTP_PASS` | ❌ | Gmail SMTP (remplacé par Resend) |

## Firebase

- **Projet** : `gen-lang-client-0739219145`
- **Base de données nommée** : `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`
- **Console** : https://console.firebase.google.com/project/gen-lang-client-0739219145

## Structure

```
src/pages/      — Vues et dashboards
src/layouts/    — Navbar, BottomNav
src/components/ — Composants réutilisables
src/hooks/      — Hooks React
src/services/   — Services Firestore client
src/lib/        — Firebase, email, utilitaires
src/types/      — Types TypeScript
database/       — Règles Firestore & Storage
docs/           — Documentation complète
```

## User Preferences

- Langue de communication : Français

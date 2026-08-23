# Solutionpam — Documentation

Solutionpam est une plateforme logistique et fintech multi-rôles (clients, affiliés, agents, admins).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, Node 20 (tsx) |
| Base de données | Cloud Firestore (named DB) |
| Auth | Firebase Auth (clients) + credentials Firestore (admin/affiliate/agent) |
| Email | Nodemailer (Gmail SMTP) — optionnel |
| Push | Web Push / FCM — optionnel |
| Paiements | MonCash / NatCash (Haïti) |

## Structure du projet

```
src/
├── pages/        # Vues complètes et dashboards (HomeView, AdminDashboard, etc.)
├── layouts/      # Composants de mise en page (Navbar, BottomNav, FormationsNavbar)
├── components/   # Composants UI réutilisables (ui/, modals, forms)
├── hooks/        # Hooks React personnalisés
├── services/     # Logique client Firestore
├── lib/          # Firebase, email, certificats, utilitaires
├── utils/        # Fonctions utilitaires pures (cn, formatters)
├── styles/       # CSS global (index.css)
└── types/        # Types et interfaces TypeScript
api/              # Adaptateur serverless (Vercel / Railway)
database/         # Règles Firestore et Storage
public/           # Assets statiques, PWA manifest, sw.js
docs/             # Documentation
```

## Variables d'environnement requises

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | JSON du compte de service Firebase Admin |
| `SMTP_USER` | ❌ | Gmail pour notifications email |
| `SMTP_PASS` | ❌ | Mot de passe d'application Gmail |
| `RECAPTCHA_SECRET_KEY` | ❌ | Clé secrète reCAPTCHA v2 |
| `RECAPTCHA_SITE_KEY` | ❌ | Clé publique reCAPTCHA v2 |
| `VAPID_PUBLIC_KEY` | ❌ | Clé publique VAPID pour Push |
| `VAPID_PRIVATE_KEY` | ❌ | Clé privée VAPID pour Push |
| `APP_URL` | ❌ | URL publique de l'app |
| `MONCASH_SECRET_KEY` | ❌ | Clé secrète MonCash |

## Démarrer en développement

```bash
npm install
# Configurer FIREBASE_SERVICE_ACCOUNT dans les variables d'environnement
npm run dev
# → http://localhost:5000
```

## Déploiement

Le projet est compatible avec :
- **Replit** (autoscale deployment, port 5000)
- **Railway** (`railway.json` fourni)
- **Render** (`render.yaml` fourni)
- **Vercel** (`vercel.json` + `api/` serverless functions)
- **Docker** (`Dockerfile` fourni)

## Firestore

- **Base de données nommée** : `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`
- **Règles** : `database/firestore.rules`
- **Console** : https://console.firebase.google.com/project/gen-lang-client-0739219145

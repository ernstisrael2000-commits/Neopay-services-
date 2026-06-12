# Rena — Logistics & Fintech Platform

Application web multi-rôles (clients, affiliés, agents, admins) pour la gestion de colis, paiements, portefeuilles et formations en ligne.

## Démarrage rapide

```bash
npm install
npm run dev        # Développement → http://localhost:5000
npm run build      # Build production
npm run start      # Production
npm run lint       # Vérification TypeScript
```

## Variables d'environnement

Voir [docs/README.md](docs/README.md) pour la liste complète.

| Variable | Obligatoire |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ |
| `SMTP_USER` / `SMTP_PASS` | ❌ optionnel |
| `RECAPTCHA_SECRET_KEY` | ❌ optionnel |

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

Voir [docs/README.md](docs/README.md) pour la documentation complète.

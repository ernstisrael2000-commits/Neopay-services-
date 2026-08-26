# Déploiement sur Vercel — checklist

Ce document liste tout ce qui doit être configuré pour déployer ce projet sur
Vercel, ainsi que les différences de comportement à connaître par rapport à un
hébergement "toujours actif" (Replit, Railway, Render).

## 1. Configuration du projet Vercel

- **Framework preset** : `Other` (aucun framework détecté, `vercel.json` gère tout)
- **Build command** : `npm run build` (déjà dans `vercel.json`)
- **Output directory** : `dist` (déjà dans `vercel.json`)
- **Install command** : `npm install --ignore-scripts` (déjà dans `vercel.json`)
- La fonction API (`api/index.ts`) est configurée avec `maxDuration: 300` (le
  maximum du plan Hobby). Sur un plan Pro/Enterprise, cette limite peut être
  augmentée si nécessaire, mais 300 s convient à toutes les routes actuelles.

## 2. Variables d'environnement à définir sur Vercel

### Obligatoires

| Variable | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON du compte de service Firebase (brut ou en base64 — les deux formats sont supportés) |
| `SESSION_SECRET` | Secret ≥ 32 caractères pour signer les cookies de session (admin/client/professeur) |
| `APP_URL` | URL **exacte** du domaine de production, avec `https://`, sans slash final. Sert à la politique CORS. Sans elle, `server.ts` refuse de démarrer en production — sur Vercel c'est `api/index.ts` qui tourne, qui elle autorise aussi automatiquement `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL`, mais `APP_URL` reste nécessaire si un domaine personnalisé est utilisé et pour les autres hébergements |
| `FIRESTORE_DB_ID` | Déjà fixé dans le code par défaut (`ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`) mais peut être surchargé ici si la base change |
| `ADMIN_SECRET` | Legacy, encore requis par certaines vérifications internes (`requireAdminSecret`) |

### Recommandé pour la fiabilité multi-instance (SSE)

| Variable | Description |
|---|---|
| `REDIS_URL` | URL Redis (ex: Upstash `rediss://default:xxx@xxx.upstash.io:6379`). **Sans elle, les notifications temps réel (SSE) ne sont fiables que si la publication et la connexion tombent sur la même instance serverless** — sur Vercel, ce n'est pas garanti. Voir section 4. |

### Optionnelles (fonctionnalités spécifiques)

`RESEND_FROM_EMAIL`, `FROM_EMAIL`, `ADMIN_EMAIL`, `RECAPTCHA_SECRET_KEY`,
`VITE_RECAPTCHA_SITE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`FAZERCARDS_API_KEY`, `COINGECKO_API_KEY`, `NOWPAYMENTS_API_KEY`,
`NOWPAYMENTS_IPN_SECRET`, `GROQ_API_KEY`. Ne définir que celles des
fonctionnalités réellement utilisées.

## 3. Étapes manuelles côté Firebase (non automatisables depuis le repo)

- **Authorized domains** (Firebase Console → Authentication → Settings →
  Authorized domains) : ajouter le domaine de production Vercel (et tout
  domaine personnalisé) — sinon la connexion Google (popup/redirect) échoue
  avec `auth/unauthorized-domain`.
- **Règles Firestore** (`firestore.rules` à la racine et `database/firestore.rules`
  doivent rester identiques) : aucune automatisation ne les déploie — un
  `firebase deploy --only firestore:rules` manuel reste nécessaire après tout
  changement de ces fichiers, indépendamment de la plateforme d'hébergement.
- **Firebase Storage** : le SDK client (`getStorage`) passe par l'API JSON de
  Google qui autorise déjà toutes origines par défaut — aucune configuration
  CORS de bucket (`cors.json` / `gsutil cors set`) n'est nécessaire pour les
  usages actuels (upload/download via le SDK).

## 4. Notifications temps réel (SSE) sur Vercel — ce qui change

L'app utilise des flux Server-Sent Events (`/api/{role}/events/:id`) pour les
notifications en direct. Sur un serveur toujours actif, un simple `Map` en
mémoire suffit à relier "un événement se produit" à "toutes les connexions
ouvertes". Sur Vercel, chaque requête peut atterrir sur une instance
serverless différente : un événement publié par la requête qui déclenche une
notification (ex: un admin qui valide un retrait) n'atteindrait jamais une
connexion SSE ouverte sur une autre instance sans un canal partagé.

Ce projet résout ça via `src/api/realtime.ts` :
- Si `REDIS_URL` est défini, tous les événements passent par Redis pub/sub
  (une connexion "publisher" et une connexion "subscriber" partagées) — les
  notifications sont fiables quel que soit le nombre d'instances actives.
- Si `REDIS_URL` n'est pas défini, un bus en mémoire (comportement historique)
  est utilisé — parfaitement fonctionnel sur un hébergement à processus unique
  (Replit, Railway, Render), mais pas garanti sur Vercel.

**Recommandation : configurer `REDIS_URL` (ex: Upstash, compatible serverless)
avant de considérer le déploiement Vercel comme prêt pour la production.**

Par ailleurs, `maxDuration: 300` sur la fonction API signifie qu'une connexion
SSE sera coupée après 5 minutes au maximum. `EventSource` se reconnecte
automatiquement côté navigateur (déjà en place dans `useRealtimeNotifs.ts` et
`ClientDashboard.tsx`), donc l'utilisateur ne perd pas de notifications au-delà
d'un court délai de reconnexion — mais ce comportement diffère d'un
hébergement toujours actif où la connexion peut rester ouverte indéfiniment.

## 5. Sécurité des flux SSE

Les routes `/api/client/events/:clientId`, `/api/teacher/events/:teacherId` et
`/api/admin/events/:adminId` exigent désormais une session valide **et**
vérifient que l'id demandé dans l'URL correspond à celui de la session (403
sinon) — un utilisateur connecté ne peut plus ouvrir le flux d'un autre
utilisateur en devinant son id.

`/api/affiliate/events/:affiliateId` et `/api/agent/events/:agentId` restent
non authentifiées intentionnellement : **aucune route affiliate/agent n'a de
mécanisme de session dans toute l'API actuelle** (elles s'identifient par id
transmis dans l'URL/le corps, sans cookie de session). C'est un écart plus
large que ce flux SSE et concerne l'ensemble de la surface API
affiliate/agent — à traiter comme un chantier de sécurité séparé plutôt que
comme un correctif ponctuel des routes d'événements (voir la tâche de suivi
proposée).

## 6. Écarts de comportement connus entre `server.ts` et `api/index.ts`

- **SEO par page** : `server.ts` injecte des balises `<title>`/`<meta
  description>`/JSON-LD spécifiques à chaque route (voir `src/lib/seo.ts`)
  lors du rendu du HTML. Sur Vercel, `vercel.json` sert `dist/index.html`
  statiquement via son CDN pour toute route non-API (`"/(.*)" → "/"`) sans
  jamais passer par une fonction serverless : chaque page reçoit donc le même
  `<title>`/`<meta>` génériques plutôt que le contenu par page. Cela ne casse
  rien fonctionnellement mais dégrade le SEO multi-page sur un déploiement
  Vercel par rapport aux autres hébergements. Reproduire ce comportement sur
  Vercel demanderait de faire transiter les pages HTML par une fonction (ou un
  Edge Middleware) au lieu du CDN statique — hors du périmètre de cette tâche.
- Les en-têtes de sécurité (CSP, HSTS, X-Frame-Options, etc.) sont désormais
  alignés entre les deux : `vercel.json` applique sa propre Content-Security-
  Policy à toutes les pages statiques (equivalente à celle de `server.ts`,
  avec les origines Google/Firebase/Vimeo/YouTube nécessaires aux
  fonctionnalités de connexion et de lecture vidéo), tandis que la CSP posée
  par `api/index.ts` ne s'applique qu'aux réponses JSON de l'API.

## 7. Vérification après déploiement

1. Ouvrir le site, se connecter (client puis admin) : vérifier l'absence
   d'erreurs CORS/CSP dans la console.
2. Déclencher une action qui notifie (ex: dépôt/retrait) et confirmer la
   réception en direct de la notification côté destinataire (SSE).
3. Tester un upload de fichier (justificatif de paiement, photo de profil).
4. Vérifier que la connexion Google fonctionne (domaine autorisé Firebase).

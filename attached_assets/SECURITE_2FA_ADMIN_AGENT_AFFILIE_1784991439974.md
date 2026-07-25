# 🔐 RÈGLES DE SÉCURITÉ OBLIGATOIRES — Authentification à deux étapes (2FA)
### Administrateurs, Agents, Affiliés — Rena (renaservices.shop) / NeoPay

> **À LIRE ET RESPECTER AVANT DE MODIFIER UNE SEULE LIGNE DE CODE liée à l'authentification, aux rôles admin/agent/affilié, ou à la connexion.**
> Ce fichier doit être considéré comme une instruction système par toute IA (Replit AI, Claude, ChatGPT, etc.) ou tout développeur qui touche à ce projet.
> Si une modification demandée par Ernst semble contredire une règle ci-dessous, l'IA doit **s'arrêter et demander confirmation** avant d'agir.

---

## 1. Pourquoi ce fichier existe

Les comptes **administrateurs**, **agents** (qui font des dépôts) et **affiliés** ont accès à des fonctions sensibles : gestion des wallets, validation de transactions, création de codes promo, accès à des données financières. Un simple mot de passe volé, deviné ou réutilisé ailleurs (fuite de données d'un autre site) suffit à compromettre tout le système si rien d'autre n'est exigé.

**Principe : mot de passe seul = jamais suffisant pour ces rôles.** Une deuxième preuve d'identité est obligatoire à la connexion.

---

## 2. Qui est concerné

- ✅ Tous les comptes **administrateur** (accès total)
- ✅ Tous les comptes **agent** (dépôts, gestion de clients)
- ✅ Tous les comptes **affilié** (accès à des commissions, liens de parrainage, wallet)
- ❌ Les utilisateurs finaux normaux ne sont **pas obligés** d'avoir la 2FA (sauf si Ernst décide plus tard de l'étendre), mais rien n'empêche de leur proposer en option.

---

## 3. Exigences fonctionnelles de la 2FA

### 3.1 Méthode acceptée
Choisir une (ou plusieurs) méthode selon ce qui est réaliste à intégrer sur Firebase/Supabase :
- **Code à usage unique (OTP) par SMS ou email** — solution la plus simple à démarrer avec Firebase Auth ou un service comme Twilio.
- **Application d'authentification (Google Authenticator, Authy)** via TOTP — plus sécurisé, pas besoin de dépendre d'un opérateur SMS.
- Ne jamais se limiter à une "question secrète" (nom de jeune fille, ville de naissance, etc.) — ce n'est pas une vraie 2FA.

### 3.2 Étape obligatoire à la connexion
1. L'utilisateur entre email/mot de passe (facteur 1).
2. Le serveur vérifie que le compte est bien de type admin/agent/affilié.
3. Si oui → **la session n'est PAS créée immédiatement**. Le serveur envoie/demande le code du 2ème facteur.
4. L'utilisateur entre le code (SMS, email ou app TOTP).
5. Le serveur vérifie ce code **côté serveur** avant de créer la session/le token final.

### 3.3 Le contournement du 2FA doit être impossible depuis le client
- ❌ Interdit : une variable côté front-end du type `if (skip2FA) { login() }` — n'importe qui peut la modifier dans le navigateur.
- ✅ Obligatoire : le serveur ne délivre un token de session valide **qu'après** validation du 2ème facteur ; la première étape (mot de passe correct) ne doit jamais suffire à obtenir un accès, même temporaire, aux routes admin/agent/affilié.

### 3.4 Protection du code OTP
- Code à durée de vie courte (ex : 5 minutes max).
- Nombre de tentatives limité (ex : 5 essais max, puis blocage temporaire ou renvoi obligatoire d'un nouveau code).
- Le code ne doit jamais être renvoyé ou visible dans la réponse API — uniquement transmis par le canal choisi (SMS/email/app).

### 3.5 Obligatoire, pas optionnel, pour ces rôles
- Un compte admin/agent/affilié ne doit **pas pouvoir désactiver lui-même la 2FA** sans validation supplémentaire (ex : confirmation par un autre admin, ou blocage total de cette option dans les paramètres du compte).
- Si la 2FA n'est pas encore configurée pour un compte existant de ce type, le forcer à la configurer **avant** de lui donner accès au tableau de bord (flux d'inscription/premier login obligatoire).

---

## 4. Contrôles supplémentaires recommandés

- **Journal des connexions** : enregistrer chaque tentative de connexion réussie/échouée pour les comptes admin/agent/affilié (date, IP si disponible, résultat).
- **Alerte de connexion inhabituelle** : notifier l'admin/agent/affilié par email si une connexion réussit depuis un nouvel appareil ou une localisation inhabituelle.
- **Déconnexion automatique** après une période d'inactivité pour les sessions admin/agent.
- **Séparation des rôles** : vérifier côté serveur, à chaque action sensible (pas seulement à la connexion), que le rôle de l'utilisateur autorise bien cette action (ex : un agent ne doit pas pouvoir accéder aux fonctions réservées à l'admin même s'il devine l'URL).

---

## 5. CHECKLIST — avant toute modification du système de connexion

- [ ] Est-ce que je crée une session/un token AVANT d'avoir vérifié le 2ème facteur pour un rôle admin/agent/affilié ?
- [ ] Est-ce que la vérification du code OTP se fait bien côté serveur (pas seulement en JavaScript côté client) ?
- [ ] Est-ce qu'un utilisateur peut désactiver sa propre 2FA sans contrôle supplémentaire ?
- [ ] Est-ce que je limite le nombre de tentatives et la durée de vie du code ?
- [ ] Est-ce que je vérifie le rôle réel de l'utilisateur (pas une valeur envoyée par le client) avant d'afficher ou d'autoriser une action admin/agent/affilié ?

Si la réponse à une seule de ces questions inquiète — **s'arrêter et demander confirmation à Ernst avant de continuer.**

---

## 6. Signaux d'alerte à chercher dans le code existant (audit)

- Des routes/pages admin, agent ou affilié accessibles simplement en connaissant l'URL, sans vérification de session/rôle côté serveur.
- Une logique de connexion où la vérification du 2ème facteur se fait uniquement dans le code front-end (visible et modifiable dans les outils développeur du navigateur).
- Des comptes admin/agent/affilié existants créés avant l'ajout de la 2FA qui n'ont jamais été forcés à la configurer.
- L'absence de limite de tentatives sur la saisie du code OTP (permettrait une attaque par force brute).

---

*Document à conserver à la racine du projet, aux côtés de SECURITE_WALLET_PROMO.md, et à relire par toute IA avant toute intervention sur l'authentification ou les rôles admin/agent/affilié de renaservices.shop.*

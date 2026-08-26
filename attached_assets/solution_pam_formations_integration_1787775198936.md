# INTÉGRATION DU SYSTÈME DE FORMATIONS — SOLUTION PAM

## 1. OBJECTIF GÉNÉRAL

Tu dois intégrer dans le site existant de **Solution PAM** un système complet de création, publication, vente et suivi de formations en ligne.

**IMPORTANT :**

- Le projet existe déjà.
- **NE PAS** reconstruire inutilement le site.
- **NE PAS** supprimer ou casser les fonctionnalités existantes.
- **NE PAS** modifier l'identité visuelle actuelle sans nécessité.
- Avant toute modification, analyse complètement l'architecture existante, les pages, les composants, la base de données, l'authentification, les systèmes de paiement, les rôles utilisateurs et les règles de sécurité.
- Réutilise au maximum les composants, services, fonctions d'authentification, systèmes de notification et systèmes de paiement déjà présents.
- Toute nouvelle fonctionnalité doit être compatible avec l'architecture actuelle.
- Le résultat doit être propre, responsive, moderne et prêt pour la production.

---

## 2. CONCEPT DU SYSTÈME

Solution PAM doit devenir une plateforme permettant à des créateurs de :

1. créer une formation ;
2. ajouter une présentation ;
3. ajouter une vidéo d'introduction ;
4. créer des modules ;
5. créer des leçons ;
6. définir un prix ;
7. publier la formation ;
8. obtenir automatiquement un lien public ;
9. partager ce lien sur WhatsApp, Facebook, TikTok, etc. ;
10. vendre la formation directement sur Solution PAM.

Les personnes qui achètent une formation doivent obligatoirement posséder un compte Solution PAM.

Solution PAM doit donc être à la fois :

- la plateforme d'hébergement ;
- la plateforme d'authentification ;
- la plateforme de paiement ;
- la plateforme d'accès aux formations ;
- la plateforme de suivi de progressi

## 3. PARCOURS UTILISATEUR

### VISITEUR NON CONNECTÉ

Lorsqu'un utilisateur clique sur un lien tel que :

`/formation/[slug]`

il doit voir une page publique contenant :

- image de couverture ;
- titre ;
- description ;
- nom du formateur ;
- vidéo de présentation ;
- nombre de modules ;
- nombre de leçons ;
- niveau ;
- durée approximative ;
- prix ;
- informations importantes ;
- bouton **"Acheter la formation"**.

Le visiteur peut consulter les informations publiques sans avoir de compte.

Cependant, il ne doit jamais pouvoir accéder aux véritables contenus protégés de la formation avant d'avoir acheté celle-ci.

---

## 4. CRÉATION DE COMPTE

Lorsqu'un visiteur clique sur :

**Acheter la formation**

si l'utilisateur n'est pas connecté :

1. afficher la connexion ;
2. proposer la création d'un compte Solution PAM ;
3. après inscription/connexion, revenir automatiquement à la formation initialement demandée ;
4. conserver l'intention d'achat pendant le processus ;
5. ne jamais perdre le contexte de la formation.

Exemple :

**Visiteur → formation XYZ → Acheter → inscription → connexion → retour formation XYZ → paiement.**

---

## 5. SYSTÈME DE PAIEMENT

Réutiliser le système de paiement déjà intégré à Solution PAM lorsque cela est possible.

Le paiement doit être associé à :

- l'utilisateur ;
- la formation ;
- le montant ;
- la devise ;
- une référence unique ;
- la date ;
- le statut ;
- le moyen de paiement ;
- la transaction correspondante.

### STATUTS recommandés

- `pending`
- `paid`
- `failed`
- `cancelled`
- `refunded`

**IMPORTANT :**

Le simple fait qu'un utilisateur arrive sur une URL de succès **NE DOIT JAMAIS** débloquer une formation.

L'accès doit être accordé uniquement après confirmation fiable du paiement côté serveur.

---

## 6. DÉBLOCAGE DE LA FORMATION

Après confirmation du paiement :

1. enregistrer l'achat ;
2. associer l'utilisateur à la formation ;
3. débloquer l'accès ;
4. afficher la formation dans **"Mes formations"** ;
5. envoyer une notification/email si le système de notification existe ;
6. enregistrer la transaction ;
7. calculer la commission éventuelle de Solution PAM ;
8. créditer le solde du créateur selon les règles prévues.

L'opération doit être **idempotente**.

Si le même événement de paiement est reçu plusieurs fois, il ne doit jamais créer plusieurs achats ou créditer plusieurs fois le créateur.

---

## 7. ESPACE "MES FORMATIONS"

Ajouter dans le compte utilisateur une section :

**Mes formations**

Elle doit afficher :

- formations achetées ;
- progression ;
- dernière leçon consultée ;
- pourcentage terminé ;
- bouton **"Continuer"**.

Exemple :

**Formation : JavaScript pour débutants**

**Progression : 45 %**

**[Continuer la formation]**

---

## 8. LECTEUR DE FORMATION

Une formation doit être organisée comme ceci :

```text
Formation
├── Module 1
│   ├── Leçon 1
│   ├── Leçon 2
│   └── Leçon 3
│
└── Module 2
    ├── Leçon 1
    └── Leçon 2
```

Chaque leçon peut contenir :

- titre ;
- description ;
- vidéo ;
- texte ;
- fichiers éventuellement ;
- ressources ;
- ordre de présentation.

Ajouter un système permettant à l'utilisateur de :

- regarder la vidéo ;
- passer à la leçon suivante ;
- revenir à une leçon précédente ;
- marquer une leçon comme terminée ;
- reprendre automatiquement là où il s'était arrêté.

---

## 9. PROTECTION DES CONTENUS

C'est une fonctionnalité **CRITIQUE**.

Un utilisateur qui n'a pas acheté une formation ne doit jamais pouvoir accéder aux contenus privés simplement en connaissant :

- l'URL ;
- le slug ;
- l'identifiant de la formation ;
- l'identifiant d'une leçon ;
- l'URL d'une vidéo ;
- une API ;
- une requête HTTP ;
- les outils développeur du navigateur.

La vérification d'accès doit être effectuée **côté serveur/backend**.

**NE JAMAIS** faire confiance uniquement à une variable JavaScript du navigateur telle que :

```js
hasAccess = true
```

ou à un élément caché dans l'interface.

Le frontend ne doit jamais être la seule couche de protection.

---

## 10. CRÉATION DE FORMATIONS PAR LES CRÉATEURS

Créer un espace :

**Mes formations**

avec :

**Créer une formation**

Le créateur doit pouvoir renseigner :

### Informations générales

- titre ;
- description ;
- image ;
- catégorie ;
- niveau ;
- prix ;
- devise ;
- vidéo de présentation ;
- statut.

### Statuts

- `draft`
- `published`
- `archived`

---

## 11. CONSTRUCTEUR DE FORMATION

Créer une interface permettant au créateur de construire sa formation.

Exemple :

```text
FORMATION

├── Module 1 : Introduction
│   ├── Leçon 1
│   ├── Leçon 2
│   └── Leçon 3
│
├── Module 2 : Fondamentaux
│   ├── Leçon 1
│   └── Leçon 2
│
└── Module 3 : Projet final
    └── Leçon 1
```

Le créateur doit pouvoir :

- ajouter un module ;
- supprimer un module ;
- modifier un module ;
- réorganiser les modules ;
- ajouter une leçon ;
- supprimer une leçon ;
- modifier une leçon ;
- réorganiser les leçons.

Prévoir sauvegarde automatique ou sauvegarde explicite.

---

## 12. VIDÉOS

Ne jamais stocker inutilement de gros fichiers vidéo directement dans la base de données.

Utiliser l'infrastructure de stockage déjà présente dans le projet si elle est adaptée.

Les vidéos privées doivent être protégées.

Éviter de rendre directement publiques les URLs permanentes des vidéos payantes.

Si l'infrastructure le permet, utiliser des URLs temporaires/signées pour les contenus privés.

---

## 13. PAGE PUBLIQUE DE FORMATION

Chaque formation publiée doit avoir un slug unique.

Exemple :

`/formation/javascript-debutant`

La page doit être partageable sur les réseaux sociaux.

Prévoir les métadonnées :

- title ;
- description ;
- image Open Graph ;
- URL canonique ;
- informations SEO.

Le lien doit rester fonctionnel même si le visiteur n'est pas connecté.

---

## 14. TABLEAU DE BORD DU CRÉATEUR

Ajouter :

### Vue d'ensemble

- nombre de formations ;
- nombre d'étudiants ;
- nombre de ventes ;
- revenus bruts ;
- commissions ;
- revenus disponibles ;
- revenus en attente.

### Formations

Afficher :

- titre ;
- statut ;
- prix ;
- ventes ;
- revenus ;
- date de création ;
- date de publication.

### Revenus

Afficher :

- montant brut ;
- commission Solution PAM ;
- montant net ;
- solde disponible ;
- retraits ;
- historique des transactions.

---

## 15. COMMISSION SOLUTION PAM

Préparer le système afin que Solution PAM puisse prendre une commission configurable sur chaque vente.

Exemple :

**Prix formation : 1 000 HTG**

**Commission Solution PAM : 10 %**

**Commission : 100 HTG**

**Revenu créateur : 900 HTG**

**IMPORTANT :**

La commission doit être calculée côté serveur.

Ne jamais accepter un montant de commission envoyé par le navigateur.

Les montants financiers doivent être recalculés et validés côté serveur.

Prévoir une configuration permettant de modifier le pourcentage sans devoir modifier le code partout.

---

## 16. SYSTÈME D'ACHATS

Créer une structure logique permettant de savoir :

- qui a acheté ;
- quelle formation ;
- combien ;
- quand ;
- avec quelle transaction ;
- statut du paiement ;
- statut de l'accès.

Créer une contrainte empêchant les doublons d'achat lorsque cela est approprié.

---

## 17. ADMINISTRATION

Dans l'administration Solution PAM, prévoir la possibilité de :

- voir toutes les formations ;
- rechercher une formation ;
- voir les créateurs ;
- voir les étudiants ;
- voir les ventes ;
- voir les transactions ;
- suspendre une formation ;
- archiver une formation ;
- suspendre un créateur ;
- consulter les revenus ;
- consulter les commissions ;
- gérer les remboursements si le système de paiement le permet.

---

# 18. SÉCURITÉ — OBLIGATOIRE

Cette section doit être appliquée strictement.

## AUTHENTIFICATION

- Ne jamais stocker les mots de passe en clair.
- Utiliser exclusivement le système d'authentification sécurisé déjà présent.
- Vérifier côté serveur l'identité de l'utilisateur.
- Vérifier les permissions à chaque opération sensible.
- Ne jamais faire confiance à l'ID utilisateur envoyé par le frontend.

---

## AUTORISATION

Toujours vérifier côté serveur :

- que l'utilisateur est authentifié ;
- qu'il possède la formation ;
- qu'il est propriétaire de la formation lorsqu'il tente de la modifier ;
- qu'il possède les permissions administrateur lorsqu'il effectue une action administrative.

Un créateur A ne doit jamais pouvoir modifier la formation du créateur B en changeant simplement un ID dans une requête.

---

## IDOR / BROKEN ACCESS CONTROL

Tester explicitement les scénarios suivants :

Utilisateur A tente d'accéder à :

`/api/courses/B`

alors que B appartient à un autre utilisateur.

Résultat attendu :

**403 ou 404**, selon l'architecture.

Même protection pour :

- formations ;
- leçons ;
- achats ;
- transactions ;
- retraits ;
- soldes ;
- données personnelles.

---

## PAIEMENTS

Ne jamais considérer le frontend comme source de vérité.

Ne jamais débloquer une formation uniquement parce que :

```text
paymentStatus=success
```

a été envoyé par le navigateur.

La confirmation doit provenir du système de paiement/backend approprié.

Vérifier :

- montant ;
- devise ;
- référence ;
- utilisateur ;
- formation ;
- statut réel ;
- intégrité de la transaction.

---

## WEBHOOKS

Si les paiements utilisent des webhooks :

- vérifier la signature du webhook ;
- rejeter les requêtes non authentifiées ;
- rendre le traitement idempotent ;
- empêcher les doubles crédits ;
- journaliser les événements importants ;
- ne jamais faire confiance à un webhook non vérifié.

---

## INJECTION

Toutes les données utilisateur doivent être validées.

Protéger contre :

- SQL injection ;
- NoSQL injection ;
- XSS ;
- HTML injection ;
- command injection ;
- path traversal.

Ne jamais construire des requêtes sensibles directement à partir d'entrées utilisateur non validées.

---

## XSS

Les descriptions de formations et le contenu fourni par les créateurs doivent être traités comme des données non fiables.

Ne pas permettre l'exécution de JavaScript arbitraire dans :

- descriptions ;
- titres ;
- commentaires ;
- leçons ;
- profils.

Si du HTML riche est autorisé, utiliser une sanitation robuste avec une liste blanche stricte.

---

## UPLOADS

Pour les images, vidéos et fichiers :

- vérifier le type MIME ;
- vérifier l'extension ;
- limiter la taille ;
- générer des noms de fichiers sûrs ;
- empêcher les chemins arbitraires ;
- ne jamais utiliser directement le nom de fichier fourni par l'utilisateur ;
- empêcher l'exécution de fichiers uploadés ;
- appliquer les règles de stockage appropriées.

---

## VIDÉOS PRIVÉES

Les vidéos payantes ne doivent pas être publiquement accessibles simplement en connaissant leur URL.

Lorsque possible :

- utiliser un stockage privé ;
- utiliser des URLs signées/temporaires ;
- vérifier les permissions avant délivrance de l'accès.

---

## RATE LIMITING

Ajouter un rate limiting approprié sur les endpoints sensibles :

- connexion ;
- inscription ;
- récupération de mot de passe ;
- paiement ;
- création de formations ;
- upload ;
- génération de liens ;
- retraits ;
- endpoints administratifs.

---

## VALIDATION

Toutes les données reçues par l'API doivent être validées côté serveur.

Exemples :

- prix positif ;
- devise autorisée ;
- titre avec longueur maximale ;
- description avec taille maximale ;
- IDs au bon format ;
- slug valide ;
- fichiers respectant les limites.

Ne jamais utiliser uniquement la validation frontend.

---

## CSRF

Si l'architecture utilise des cookies/session pour l'authentification, appliquer une protection CSRF adaptée aux opérations sensibles.

---

## SECRETS

**NE JAMAIS** exposer :

- clés API secrètes ;
- clés privées ;
- secrets de paiement ;
- clés admin ;
- tokens privés ;
- credentials de base de données

dans le frontend ou le code public.

Utiliser les variables d'environnement existantes.

Ne jamais les afficher dans les logs.

---

## LOGS

Ne jamais enregistrer dans les logs :

- mots de passe ;
- tokens ;
- clés API ;
- données bancaires sensibles ;
- informations de paiement sensibles.

Les logs doivent permettre de diagnostiquer les problèmes sans exposer de secrets.

---

## 19. SÉCURITÉ FINANCIÈRE

Les soldes des créateurs sont des données financières.

Toutes les opérations financières doivent être réalisées côté serveur.

Ne jamais accepter :

```text
balance = 5000
```

depuis le frontend.

Le serveur doit calculer le solde à partir des transactions fiables.

Prévoir un historique immuable ou suffisamment contrôlé des mouvements financiers.

Exemple :

```text
VENTE
→ montant brut
→ commission
→ montant créateur
→ transaction enregistrée
→ solde calculé
```

---

## 20. INTÉGRITÉ DES DONNÉES

Créer les relations nécessaires entre :

**Utilisateur → Formation → Achat → Transaction → Accès**

Une suppression ou modification ne doit pas créer d'accès gratuit ou de crédit financier incorrect.

Utiliser les contraintes de base de données appropriées.

---

## 21. TESTS DE SÉCURITÉ

Avant de considérer la fonctionnalité terminée, effectuer des tests pour vérifier notamment :

### Test 1

Utilisateur non connecté tente d'ouvrir une leçon privée.

**Résultat attendu : refus.**

### Test 2

Utilisateur connecté mais n'ayant pas acheté la formation tente d'ouvrir une leçon privée.

**Résultat attendu : refus.**

### Test 3

Utilisateur ayant acheté la formation ouvre la leçon.

**Résultat attendu : accès autorisé.**

### Test 4

Utilisateur A tente d'utiliser l'ID de la formation de B.

**Résultat attendu : refus.**

### Test 5

Utilisateur tente de modifier le prix d'une formation avec une requête manipulée.

**Résultat attendu : serveur ignore/rejette la modification non autorisée.**

### Test 6

Un utilisateur tente de débloquer une formation en envoyant artificiellement un statut `paid`.

**Résultat attendu : aucun accès.**

### Test 7

Un webhook identique est envoyé deux fois.

**Résultat attendu : une seule transaction et un seul déblocage.**

### Test 8

Un utilisateur tente de modifier son solde.

**Résultat attendu : impossible.**

### Test 9

Un créateur tente de modifier une formation appartenant à un autre créateur.

**Résultat attendu : refus.**

### Test 10

Un utilisateur tente d'accéder directement à une URL de vidéo privée sans autorisation.

**Résultat attendu : refus.**

---

## 22. RESPONSIVE DESIGN

Toutes les interfaces doivent fonctionner correctement sur :

- téléphone ;
- tablette ;
- ordinateur.

La priorité doit être donnée à l'expérience mobile.

Les pages publiques de formation doivent être particulièrement optimisées pour le partage depuis WhatsApp, Facebook et les réseaux sociaux.

---

## 23. PERFORMANCE

Éviter :

- requêtes inutiles ;
- téléchargement de vidéos avant lecture ;
- chargement de toutes les leçons d'une formation en même temps ;
- appels API répétitifs ;
- données sensibles envoyées inutilement au frontend.

Utiliser pagination, lazy loading et cache lorsque pertinent.

---

## 24. SEO ET PARTAGE SOCIAL

Les pages publiques de formations doivent être indexables lorsque la formation est publique.

Ajouter automatiquement :

- titre SEO ;
- description SEO ;
- image ;
- Open Graph ;
- Twitter/X card si pertinent ;
- URL canonique.

Une formation en brouillon ne doit pas être publiquement accessible comme une formation publiée.

---

## 25. COMPATIBILITÉ AVEC LE SYSTÈME EXISTANT

Avant de coder :

1. inspecter le projet ;
2. identifier le framework ;
3. identifier la base de données ;
4. identifier l'authentification ;
5. identifier les systèmes de stockage ;
6. identifier le système de paiement ;
7. identifier les rôles ;
8. identifier les routes existantes ;
9. identifier les composants réutilisables ;
10. identifier les règles de sécurité déjà présentes.

Ne pas remplacer une technologie existante simplement pour implémenter cette fonctionnalité.

Adapter l'implémentation au système actuel.

---

## 26. MIGRATIONS

Si la base de données doit être modifiée :

- créer des migrations propres ;
- ne pas supprimer les données existantes ;
- ne pas modifier dangereusement les tables existantes ;
- conserver la compatibilité avec les utilisateurs existants ;
- ajouter des index appropriés ;
- ajouter les contraintes nécessaires.

---

## 27. INTERFACE UTILISATEUR

L'interface doit rester cohérente avec le design actuel de Solution PAM.

Créer notamment :

### Pour le visiteur

- page publique de formation ;
- page de connexion ;
- page d'inscription ;
- paiement.

### Pour l'étudiant

- Mes formations ;
- lecteur de cours ;
- progression.

### Pour le créateur

- Mes formations ;
- Créer une formation ;
- Modifier une formation ;
- Constructeur de cours ;
- Statistiques ;
- Revenus.

### Pour l'administrateur

- gestion des formations ;
- gestion des créateurs ;
- gestion des ventes ;
- gestion des transactions ;
- gestion des accès.

---

## 28. IMPORTANT — NE PAS CASSER L'EXISTANT

Avant chaque modification importante :

- comprendre le code existant ;
- identifier les dépendances ;
- conserver les fonctionnalités actuelles ;
- éviter les modifications globales inutiles.

Ne pas supprimer une fonctionnalité existante simplement parce qu'elle semble inutilisée.

Si une partie existante doit absolument être modifiée, conserver sa compatibilité avec les fonctionnalités actuelles.

---

## 29. MÉTHODE D'IMPLÉMENTATION

Travaille dans cet ordre :

### PHASE 1 — AUDIT

Analyser entièrement le projet existant.

Présenter brièvement :

- architecture ;
- stack ;
- base de données ;
- authentification ;
- paiement ;
- stockage ;
- routes ;
- composants réutilisables ;
- risques éventuels.

**NE PAS commencer par réécrire le projet.**

### PHASE 2 — MODÈLE DE DONNÉES

Créer les structures nécessaires pour :

- formations ;
- modules ;
- leçons ;
- achats ;
- accès ;
- progression ;
- transactions ;
- revenus créateurs.

### PHASE 3 — BACKEND

Créer les APIs sécurisées nécessaires.

Toutes les autorisations doivent être contrôlées côté serveur.

### PHASE 4 — CRÉATEUR

Construire :

- création ;
- édition ;
- modules ;
- leçons ;
- publication ;
- lien partageable ;
- statistiques.

### PHASE 5 — VISITEUR

Construire la page publique.

### PHASE 6 — ACHAT

Construire :

- authentification ;
- paiement ;
- confirmation ;
- création de l'achat ;
- déblocage.

### PHASE 7 — ÉTUDIANT

Construire :

- Mes formations ;
- lecteur ;
- progression ;
- reprise de la dernière leçon.

### PHASE 8 — ADMIN

Construire les outils de supervision.

### PHASE 9 — SÉCURITÉ

Effectuer tous les tests de sécurité décrits dans ce document.

### PHASE 10 — TEST FINAL

Tester :

- mobile ;
- desktop ;
- inscription ;
- connexion ;
- création ;
- publication ;
- partage ;
- achat ;
- accès ;
- progression ;
- paiement échoué ;
- paiement réussi ;
- doublons ;
- permissions ;
- sécurité.

---

## 30. RÈGLE ABSOLUE

La priorité est :

**SÉCURITÉ > INTÉGRITÉ DES DONNÉES > PAIEMENTS > FONCTIONNALITÉS > DESIGN**

Ne jamais sacrifier une mesure de sécurité pour rendre une fonctionnalité plus rapide à développer.

Ne jamais considérer qu'une donnée est fiable simplement parce qu'elle provient du frontend.

Toute opération sensible doit être vérifiée côté serveur.

À la fin, fournir un résumé des fichiers créés/modifiés, des migrations effectuées, des nouvelles routes/API, des règles de sécurité ajoutées et des tests effectués.

**NE PAS déclarer la fonctionnalité terminée si les contrôles d'accès et de paiement ne sont pas correctement protégés côté serveur.**

# 🔒 RÈGLES DE SÉCURITÉ OBLIGATOIRES — Rena

> **À LIRE ET RESPECTER AVANT DE MODIFIER UNE SEULE LIGNE DE CODE.**
> Ce fichier doit être considéré comme une instruction système par toute IA (Replit AI, Claude, ChatGPT, etc.) ou tout développeur qui touche à ce projet.
> Si une modification demandée par Ernst semble contredire une règle ci-dessous, l'IA doit **s'arrêter et demander confirmation** avant d'agir.

---

## 1. Pourquoi ce fichier existe

Ce site gère de l'argent réel : rechargement, retrait, transfert de solde entre utilisateurs, et des codes promo qui réduisent les prix. Une seule faille peut permettre à quelqu'un de :
- Créer de l'argent qui n'existe pas (crédit son propre wallet)
- Voler le solde d'un autre utilisateur
- Utiliser un code promo invalide, expiré, ou réservé à quelqu'un d'autre
- Modifier un prix côté navigateur pour payer moins cher

**Principe n°1, au-dessus de tout : ne jamais faire confiance à ce qui vient du navigateur/client.** Tout ce qui touche à l'argent doit être vérifié et recalculé côté serveur (Firebase Functions, backend Node/Express, règles Firestore, RLS Supabase — selon ce qui est utilisé sur Rena).

---

## 2. RÈGLES POUR LE WALLET (recharge, retrait, transfert)

### 2.1 Le solde ne se modifie JAMAIS depuis le client
- ❌ Interdit : le front-end envoie `{ nouveauSolde: 5000 }` et le serveur l'accepte tel quel.
- ✅ Obligatoire : le front-end envoie seulement l'intention (`{ montant: 500, type: "recharge" }`), et **le serveur calcule** le nouveau solde à partir de la valeur actuelle en base de données.

### 2.2 Chaque transaction doit être atomique
- Utiliser une transaction de base de données (Firestore `runTransaction`, ou transaction SQL Supabase/Postgres) pour lire le solde ET écrire le nouveau solde dans la même opération indivisible.
- Sans ça : deux requêtes simultanées (double-clic, script automatisé) peuvent créer un **double crédit** ou un **double retrait**.

### 2.3 Vérification d'autorisation systématique
- Avant toute opération, vérifier que l'utilisateur connecté (`auth.uid` / session serveur) est bien le **propriétaire du wallet** qu'il essaie de modifier.
- Pour un **transfert** : vérifier séparément l'autorisation sur le compte source (débit) — le compte destinataire ne fait que recevoir, il ne doit jamais pouvoir être "débité" par erreur d'un paramètre inversé.

### 2.4 Le retrait/transfert ne doit jamais rendre un solde négatif
- Vérifier `solde_actuel >= montant_demandé` **côté serveur**, juste avant l'écriture, dans la même transaction (pas avant, à cause des accès concurrents).

### 2.5 Journal d'audit immuable
- Chaque mouvement (recharge, retrait, transfert) doit créer une ligne dans une collection/table `transactions` : `userId, type, montant, soldeAvant, soldeApres, date, source(IP/appareil si possible)`.
- Cette table ne doit **jamais être modifiable ou supprimable** par un utilisateur normal (règles Firestore/RLS en lecture seule pour l'utilisateur, écriture uniquement via le backend).

### 2.6 Limites et alertes
- Prévoir des limites raisonnables (montant max par transaction, par jour) et une alerte/blocage automatique en cas de dépassement ou de comportement anormal (ex : 20 recharges en 1 minute).

---

## 3. RÈGLES POUR LES CODES PROMO

### 3.1 Le prix final se calcule TOUJOURS côté serveur
- ❌ Interdit : le client envoie `{ code: "PROMO10", prixFinal: 900 }`.
- ✅ Obligatoire : le client envoie seulement `{ code: "PROMO10" }`, le serveur regarde le prix réel du produit en base, applique la réduction lui-même, et renvoie le total calculé.

### 3.2 Validation complète du code avant application
Vérifier, côté serveur, dans cet ordre :
1. Le code existe-t-il en base de données ?
2. Est-il encore actif (`actif: true`) et dans sa période de validité (`dateDebut <= maintenant <= dateFin`) ?
3. N'a-t-il pas dépassé son nombre d'utilisations max (`utilisationsActuelles < utilisationsMax`) ?
4. Cet utilisateur précis l'a-t-il déjà utilisé, si le code est à usage unique par personne ?
5. Le code est-il réservé à certains utilisateurs/produits ? Vérifier la correspondance.

### 3.3 Aucune génération de code prévisible
- Ne pas utiliser de codes du type `PROMO1`, `PROMO2`, `PROMO3` faciles à deviner par incrémentation.
- Préférer des codes générés aléatoirement (lettres/chiffres) si le but est de limiter la distribution.

### 3.4 Incrémenter l'utilisation dans la même transaction
- L'incrémentation de `utilisationsActuelles` doit se faire dans la **même transaction atomique** que l'application de la réduction, sinon deux personnes peuvent utiliser le dernier code disponible en même temps.

---

## 4. CHECKLIST — à valider avant TOUTE modification de code touchant argent/promo

- [ ] Est-ce que je fais confiance à une valeur envoyée par le client (montant, solde, prix, code promo) sans la revérifier côté serveur ?
- [ ] Est-ce que l'opération est bien dans une transaction atomique (pas de lecture puis écriture séparées) ?
- [ ] Est-ce que je vérifie que l'utilisateur est bien le propriétaire du wallet concerné ?
- [ ] Est-ce que je crée une ligne dans le journal des transactions ?
- [ ] Est-ce qu'un utilisateur peut, via les règles Firestore/Supabase, lire ou modifier directement un champ `solde` sans passer par une fonction serveur contrôlée ?
- [ ] Est-ce que le code promo est revalidé côté serveur à chaque utilisation (pas seulement à l'affichage) ?

Si la réponse à une seule de ces questions inquiète — **s'arrêter et demander confirmation à Ernst avant de continuer.**

---

## 5. Signaux d'alerte à chercher dans le code existant (audit)

Quand une IA ou un développeur explore le code de Rena pour la première fois, elle doit chercher activement ces problèmes :
- Des règles Firestore/Supabase trop permissives (`allow write: if true;` ou équivalent) sur les collections `users`, `wallets`, `transactions`, `promoCodes`.
- Des endpoints API qui acceptent un `montant` ou un `solde` final envoyé tel quel par le client.
- L'absence de vérification `auth.uid == userId` avant une écriture sur un wallet.
- Des clés API secrètes (Firebase Admin, Supabase service_role, clés de paiement) présentes en dur dans le code front-end au lieu de variables d'environnement côté serveur.
- Des fonctions de retrait/transfert qui ne vérifient pas le solde disponible juste avant l'écriture.

---

## 6. Bonnes pratiques générales

- Toutes les clés secrètes (Firebase Admin SDK, Supabase `service_role`, clés de paiement) doivent rester **côté serveur uniquement**, jamais exposées dans le code accessible au navigateur.
- Toute nouvelle fonctionnalité touchant au wallet ou aux promos doit être testée avec un compte de test avant mise en production.
- Documenter dans ce fichier (ou un fichier compagnon) chaque changement fait sur la logique wallet/promo, avec la date, pour garder une trace entre les sessions d'IA différentes.

---

*Document à conserver à la racine du projet et à relire par toute IA avant toute intervention sur le code de renaservices.shop.*

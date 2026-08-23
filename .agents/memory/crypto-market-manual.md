---
name: Marché crypto manuel
description: Garde-fous produits et sécurité pour les demandes de crypto à traitement manuel.
---

Le marché crypto doit rester un flux de demandes manuelles distinct des dépôts crypto et de toute comptabilité wallet. Le client ne fournit que le réseau, l’adresse de réception et le montant ; le serveur fixe le catalogue, les frais, l’estimation et les transitions de statut.

**Why:** Un prix, un statut, une identité client ou une adresse de destination pilotés par le navigateur créeraient un risque financier et d’envoi irréversible. Le lancement ne gère ni clés privées, ni phrases de récupération, ni exécution on-chain automatisée.

**How to apply:** Toute extension doit conserver une autorisation serveur liée à une session client, un audit non modifiable par le navigateur, et des validateurs d’adresse/hash fail-closed par réseau. Les nouveaux réseaux exigent leur validateur explicite avant d’être exposés dans le catalogue.
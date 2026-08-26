---
name: Connexion Google et CSP
description: Contraintes CSP nécessaires au démarrage de Firebase Google Auth dans l’application.
---

Firebase Google Auth charge un script Google et ouvre une iframe ou fenêtre d’authentification. Une CSP ne permettant que les scripts internes provoque une erreur Firebase interne avant l’ouverture du sélecteur de compte.

**Why:** Le problème se manifeste comme un échec générique de connexion, alors que la cause est le blocage CSP de `apis.google.com`.

**How to apply:** Lors de tout changement CSP, conserver les autorisations explicitement limitées aux scripts Google nécessaires et aux frames `accounts.google.com` / Firebase Auth. Revalider l’ouverture de la fenêtre Google dans un navigateur avant de publier.

**Note connexe (vidéos intégrées) :** le lecteur de cours embarque des aperçus vidéo Vimeo/YouTube en iframe. La directive `frame-src` de la CSP (dans `server.ts`) doit aussi lister `https://player.vimeo.com`, `https://www.youtube.com` et `https://www.youtube-nocookie.com`, sinon ces aperçus sont bloqués silencieusement (erreur CSP en console, cadre noir/vide à l'écran).
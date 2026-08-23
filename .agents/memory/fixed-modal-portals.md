---
name: Fixed modal portals
description: Prevent fixed product overlays from inheriting page-animation transforms.
---

Les fenêtres produit qui doivent couvrir l’écran doivent être rendues via un portail dans `document.body`, hors des conteneurs de page animés.

**Why:** Une transformation CSS appliquée par une animation de page crée un nouveau contexte de positionnement : un enfant `position: fixed` se comporte alors comme un élément de la page et peut défiler, dévoilant le footer sous le panneau.

**How to apply:** Pour les nouveaux overlays plein écran dans les vues animées, monter l’overlay avec `createPortal` au niveau du body. Garder le contenu défilant et le footer d’action dans ce panneau racine.
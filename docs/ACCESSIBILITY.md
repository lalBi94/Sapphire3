# Accessibilité — Sapphire 3

> Audit daté du **6 novembre 2026**, version `0.1.0-beta.3`. Ce document décrit ce qui a été vérifié, corrigé et ce qui reste hors de portée. Il ne constitue pas une certification WCAG.

## 1. Périmètre

Écrans et états audités dans Chromium (moteur WebView2) sur `pnpm dev:web` :

| État | Résultat axe-core |
| --- | --- |
| Canvas vide, barre supérieure fermée | 0 violation |
| Volet **Settings** ouvert | 0 violation |
| Projet **Thermostat** chargé, panneau de propriétés | 0 violation |
| Menu d'actions d'un nœud ouvert | 0 violation |
| Panneau de simulation après **Run** | 0 violation |
| Panneau d'exercice : élève, édition, verrouillé | 0 violation |
| Fenêtre de paramètres de l'application | 0 violation |

Outil : `axe-core` 4.10.2, règles par défaut, `resultTypes: ['violations']`. Les résultats « incomplete » ont été examinés séparément (fond en dégradé du panneau de statut) et vérifiés manuellement.

## 2. Corrections appliquées

1. **Contraste** de la version affichée dans la barre : `#ffffff73` (4,42:1) remplacé par `#ffffff80` (≥ 4,5:1 sur noir).
2. **Titre de page** : ajout d'un `h1` masqué visuellement mais présent dans l'arbre, dans le repère `main`.
3. **Libellé du zoom** : l'`aria-label` posé sur un `span` sans rôle est remplacé par un texte masqué lu par les technologies d'assistance.
4. **Zones défilables** : le contenu des cartes est désormais atteignable au clavier (`tabIndex`), y compris les aperçus de widgets.
5. **Repères dupliqués** : les annotations reçoivent un nom accessible distinct (`Titre · Note`, `Titre · Image`) et les cartes utilisent `role="group"` au lieu d'une région implicite.
6. **Hiérarchie des titres** du panneau d'exercice : les sous-sections utilisent `h3` après le titre du panneau, sans saut de niveau.

## 3. Vérifications manuelles

- Ordre de tabulation cohérent : barre, canvas, cartes, panneaux, menus.
- Anneau de focus visible sur les boutons, liens, champs, menus et cartes.
- `Échap` ferme les menus et rend le focus au déclencheur.
- Les dialogues de confirmation utilisent `<dialog>` modal et piègent le focus.
- `prefers-reduced-motion: reduce` supprime les transitions et animations non essentielles.
- `prefers-reduced-transparency: reduce` remplace le verre par une surface opaque.
- La couleur n'est jamais le seul indicateur : le point d'entrée porte un badge texte, la sélection ajoute un anneau et un soulignement, les groupes de nœuds gardent un libellé.
- Les huit langues changent `lang` ; l'arabe passe `dir="rtl"`.

## 4. Limites connues

- **Le canvas n'est pas entièrement perceptible au lecteur d'écran.** Un graphe spatial reste difficile à restituer. Palliatif actuel : la hiérarchie du projet en bas du panneau de propriétés et la recherche de blocs (`Ctrl+F`) permettent d'atteindre les nœuds au clavier. Une vue arborescente complète dédiée reste à concevoir.
- **Aucun test avec NVDA, JAWS ou VoiceOver** n'a été réalisé pour cette version. Les vérifications portent sur le DOM, les rôles, les noms accessibles et axe-core.
- Pas de test automatisé d'accessibilité dans la CI (pas de navigateur headless configuré).
- Les couleurs des douze groupes de nœuds n'ont pas été validées par un simulateur de daltonisme.
- Le redimensionnement du texte au-delà du zoom système n'a pas été audité.
- L'installateur Windows et la fenêtre native n'ont pas été audités avec un lecteur d'écran.

## 5. Objectif et suite

Objectif raisonnable : **WCAG 2.2 niveau AA sur les composants HTML**, avec la limite assumée du canvas. Prochaines étapes utiles :

1. Vue arborescente accessible de tout le projet, indépendante du rendu spatial.
2. Audit NVDA sur les parcours création → Run → Debug.
3. Tests axe automatisés sur les états principaux.
4. Simulation de daltonisme sur les couleurs de groupes.

## 6. Rejouer l'audit

`axe-core` est une dépendance de développement. Avec le serveur Vite lancé :

1. Ouvrir `http://127.0.0.1:5173`.
2. Dans la console, injecter `axe-core` depuis `/node_modules/axe-core/axe.min.js`.
3. Exécuter `axe.run(document)` et examiner `violations`.
4. Répéter sur les états du tableau ci-dessus.

L'audit ne remplace pas une évaluation par des utilisateurs concernés.

# Sapphire 3

Socle d'une application desktop de programmation visuelle. Direction à terme : une représentation fidèle aux concepts de programmation, adossée à un AST indépendant des langages cibles. Aucun AST ni éditeur n'est encore implémenté.

## Installation et démarrage

Prérequis : Node.js compatible avec Vite 8 (22.12+ ou 24+), pnpm 11.5 et Windows avec WebView2 installé.

```sh
pnpm install
pnpm desktop:setup
pnpm dev
```

`desktop:setup` télécharge le runtime Neutralinojs 6.10.0 dans `bin/` (ignoré par Git). `pnpm dev` démarre Vite et ouvre la fenêtre native avec rechargement à chaud.

## Commandes

- `pnpm dev:web` : frontend seul, sur http://127.0.0.1:5173.
- `pnpm build` : compile le frontend dans `dist/`.
- `pnpm preview` : prévisualise le frontend compilé dans un navigateur.
- `pnpm desktop:start` : compile puis ouvre le frontend compilé dans Neutralinojs, sans Vite.

L'application contient une page unique avec un canvas plein écran : quadrillage discret, déformé aux bords. Glissez avec le bouton gauche ou central pour vous déplacer sans limite applicative, ou utilisez les flèches après avoir donné le focus au canvas.

La molette zoome autour du milieu de la vue, jusqu'à 400 %. Le dézoom n'a pas de minimum applicatif (hors limites numériques JavaScript), et la grille adapte sa densité. Une croix marque l'origine absolue (0, 0). En bas à droite : coordonnées du milieu de la vue, zoom et bouton pour revenir à l'origine en conservant le zoom. Aucune limite liée à un projet pour l'instant.

Clic droit pour ouvrir le menu anglais « Create module » / « Create Main ». Chaque action crée une zone rectangulaire vide à l'endroit visé. La poignée inférieure droite permet de la redimensionner ; les flèches ajustent aussi la taille lorsque la poignée a le focus. Main se distingue visuellement, sans logique d'exécution. Ces zones restent en mémoire et disparaissent au rechargement. Aucun déplacement individuel, contenu logique ou stockage n'est implémenté.

Les textes de l'application sont en anglais ; les commentaires et la documentation du projet sont en français.

Aucune API native exposée, stockage métier, backend ni service distant. Les scripts d'installation de trois dépendances transitives de la CLI sont explicitement désactivés dans `pnpm-workspace.yaml` ; les accélérations WebSocket natives ne sont pas nécessaires ici.

## Repères

- `AGENTS.md` : règles de développement et périmètre.
- `docs/PROJECT_STATE.md` : état actuel et cartographie.
- `docs/PROJECT_ARCHIVE.md` : vérifications détaillées.
- `PROMPT_INITIALISATION.md` et `docs/DISTRIBUTION.md` : kit d'origine conservé ; la distribution n'est pas configurée et aucune publication n'est autorisée implicitement.

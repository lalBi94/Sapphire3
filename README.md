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

L'application contient une page unique avec un canvas plein écran : quadrillage discret, déformé aux bords. Glissez avec le bouton gauche ou central pour vous déplacer sans limite applicative, ou utilisez les flèches après avoir donné le focus au canvas. Aucun zoom ni limite dynamique pour l'instant.

Aucune API native exposée, stockage métier, backend ni service distant. Les scripts d'installation de trois dépendances transitives de la CLI sont explicitement désactivés dans `pnpm-workspace.yaml` ; les accélérations WebSocket natives ne sont pas nécessaires ici.

## Repères

- `AGENTS.md` : règles de développement et périmètre.
- `docs/PROJECT_STATE.md` : état actuel et cartographie.
- `docs/PROJECT_ARCHIVE.md` : vérifications détaillées.
- `PROMPT_INITIALISATION.md` et `docs/DISTRIBUTION.md` : kit d'origine conservé ; la distribution n'est pas configurée et aucune publication n'est autorisée implicitement.

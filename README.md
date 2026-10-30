# Sapphire 3

Application desktop de programmation visuelle en construction. Le canvas visuel et les fondations d'un moteur AST indépendant des langages sont présents ; l'éditeur de logique et l'intégration du moteur au canvas restent à développer.

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

Clic droit sur le canvas vide pour ouvrir le menu anglais « Create module » / « Create Main » / « Create comment ». Chaque action crée une zone rectangulaire à l'endroit visé. Glissez l'en-tête pour déplacer Module ou Main ; les flèches le déplacent aussi lorsque l'en-tête a le focus. La poignée inférieure droite permet de redimensionner la zone, également au clavier. Zéro ou un seul Main est autorisé : sa création est désactivée dès qu'il existe, et le moteur logique diagnostique les projets contenant plusieurs Main. Aucun comportement d'exécution ajouté. Ces zones restent en mémoire et disparaissent au rechargement ; pas de stockage sur disque.

### Édition contextuelle

Clic droit sur un conteneur ou un nœud : le menu propose d'abord le slot libre, puis les constructions compatibles avec le contexte lexical (fonctions et types seulement aux racines du module, paramètres uniquement dans une liste de fonction, break/continue seulement dans une boucle…). Un formulaire latéral permet de renseigner nom, types et expression avant confirmation. Clic gauche : sélection et panneau de propriétés avec enfants et diagnostics.

Chaque insertion est atomique : slot unique occupé jamais remplacé, ordre des listes conservé, identifiants stables, projet réanalysé et insertion rejetée si elle introduit une erreur dure (type incompatible, dépassement de bornes…). Un nœud incomplet reste représentable et éditable, avec ses diagnostics. Les possibilités du menu sont déduites du moteur (`getAvailableActions`), jamais codées en dur dans l'interface. Pas encore de suppression, déplacement individuel ni copier/coller de nœuds logiques.

Les textes de l'application sont en anglais ; les commentaires et la documentation du projet sont en français.

Double-cliquez sur le titre d'un Module pour le renommer (ou Entrée/F2 sur son en-tête). Entrée ou sortie du champ valide, Échap annule. Main garde son nom.

« Create comment » ajoute une carte d'annotation : titre renommable, texte multiligne dans le corps, déplacement par l'en-tête et redimensionnement par le coin. Ces notes sont uniquement visuelles : elles ne sont ni des modules logiques, ni des commentaires de code, et ne sont pas envoyées à l'AST. Noms et textes restent temporaires, sans sauvegarde sur disque.

Aucune API native exposée, stockage métier, backend ni service distant. Les scripts d'installation de trois dépendances transitives de la CLI sont explicitement désactivés dans `pnpm-workspace.yaml` ; les accélérations WebSocket natives ne sont pas nécessaires ici.

## Repères

### Moteur logique

`src/utils/logic/index.js` expose une API JavaScript pure : modèle source JSON v1, construction AST tolérante, portées et références intermodules, diagnostics structurés et typage strict entièrement statique. Les dix primitifs autorisés sont `short int`, `short uint`, `int`, `uint`, `float`, `double`, `string`, `char`, `boolean`, `void` (retour uniquement). Déclarations et littéraux explicitement typés ; aucune conversion implicite ni type de secours. Les conversions explicites, bornes et dépassements constants sont vérifiés ; pas de preuve globale des bornes d'exécution. Aucun simulateur, moteur de suggestions ou générateur de code n'est implémenté. Aucune dépendance ajoutée.

- `pnpm test` : tests automatisés avec le runner natif Node.
- `docs/LOGIC_API.md` : conventions, API et exemple à deux modules.
- `ARCHITECTURE_AST.tex` et `ARCHITECTURE_AST.pdf` : rapport technique français de quatre pages.
- `pnpm docs:ast` : recompile le PDF depuis le LaTeX (MiKTeX/pdfLaTeX, Latin Modern et PowerShell requis). Auxiliaires dans `build/latex/`, ignorés par Git.

Les conteneurs graphiques et le modèle logique sont raccordés : chaque Module/Main visuel possède son module source de même identifiant, et les nœuds sont créés/édités via l'API contextuelle. Les positions/dimensions et les annotations Comment restent hors du moteur. Les données peuvent être sérialisées en mémoire, sans sauvegarde sur disque.

### Documentation du projet

- `AGENTS.md` : règles de développement et périmètre.
- `docs/PROJECT_STATE.md` : état actuel et cartographie.
- `docs/PROJECT_ARCHIVE.md` : vérifications détaillées.
- `PROMPT_INITIALISATION.md` et `docs/DISTRIBUTION.md` : kit d'origine conservé ; la distribution n'est pas configurée et aucune publication n'est autorisée implicitement.

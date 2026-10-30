# PROJECT_STATE.md — Sapphire 3

## Présentation et périmètre

- Application desktop Windows : React 19, Vite 8, JavaScript/JSX, CSS, pnpm et Neutralinojs 6.10.0.
- Nom de travail repris du dossier : Sapphire 3.
- Direction produit : programmation visuelle fidèle aux concepts du code, futur AST indépendant des langages et traductions vers des langages cibles. Modèle objet évoqué, non défini.
- Étapes livrées : socle frontend et fenêtre native, page unique avec canvas plein écran et déplacement sans borne applicative. Quadrillage discret, courbé sur les bords et assombri en périphérie.
- Navigation : glisser avec le bouton gauche ou central (également gestes tactiles), ou utiliser les flèches quand le canvas a le focus. Molette : zoom centré sur le milieu de la vue, plafonné à 400 %, sans minimum applicatif de dézoom.
- Croix à l'origine absolue (0, 0), projetée avec la grille. En bas à droite : X/Y du milieu de la vue, pourcentage de zoom et bouton de retour à l'origine conservant le zoom.
- Aucun éditeur, graphe, AST, génération de code, stockage, import ou backend implémenté. Les prochains incréments nécessitent une demande.
- Style provisoire minimal, police système locale. Aucun service distant à l'exécution.

## Cartographie

| Chemin | Responsabilité |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Dépendances et commandes du socle |
| `pnpm-workspace.yaml` | Désactivation explicite de trois scripts transitifs de la CLI |
| `index.html`, `src/main.jsx` | Point d'entrée HTML et montage React |
| `src/pages/App.jsx` | Assemblage de l'unique page |
| `src/components/Canvas/Canvas.jsx`, `Canvas.css` | Surface plein écran, événements de navigation, curseur et vignette périphérique |
| `src/components/CanvasGrid/CanvasGrid.jsx`, `CanvasGrid.css` | Grille SVG à densité adaptative, croix d'origine et distorsion attachée au viewport ; dimensions suivies avec ResizeObserver |
| `src/components/CanvasStatus/CanvasStatus.jsx`, `CanvasStatus.css` | Coordonnées, zoom et bouton de recentrage, sans connaissance du hook |
| `src/hooks/useCanvasPan.jsx` | Caméra locale, capture du pointeur, annulation, clavier, zoom logarithmique à la molette et recentrage |
| `src/styles/tokens.css`, `src/styles/global.css` | Variables partagées et styles globaux minimaux |
| `vite.config.js` | Intégration React et serveur local strict sur le port 5173 |
| `neutralino.config.json` | Fenêtre native, ressources compilées, démarrage Vite ; API natives désactivées |
| `README.md` | Prérequis et démarrage |

## Commandes configurées

Scripts dans `package.json` :

- `pnpm dev` : fenêtre Neutralinojs + Vite avec HMR.
- `pnpm dev:web` : Vite seul sur `127.0.0.1:5173`.
- `pnpm build` : compilation frontend dans `dist/`.
- `pnpm preview` : prévisualisation Vite du frontend compilé.
- `pnpm desktop:setup` : téléchargement du runtime épinglé dans `bin/`.
- `pnpm desktop:start` : compilation et lancement natif sans serveur Vite.

## Contrats et décisions

- Aucun contrat métier ou format d'AST arrêté. Ne pas confondre direction future et fonctionnalité disponible.
- Caméra en mémoire React, sans persistance : `x` et `y` désignent le point du monde au milieu de la vue, axe Y positif vers le bas ; `zoomLevel` est un exposant en base 2 (0 = 100 %, 2 = 400 %). Le déplacement en pixels est converti selon le zoom.
- Seules les lignes visibles sont tracées via un décalage périodique ; leur espacement monde double progressivement au dézoom pour maintenir une densité raisonnable. Pas de surface géante ni d'accumulation. Les bornes dynamiques attendent une future demande.
- Aucune bibliothèque de nœuds, UI ou gestion d'état ajoutée.
- Pas de client Neutralinojs embarqué : aucune API native nécessaire pour cet écran. Fermeture du processus gérée par la fenêtre native.
- Emplacements internes Neutralinojs configurés sur `system`, sans stockage métier. État de fenêtre non sauvegardé.
- `bin/`, `dist/`, `build/` et fichiers temporaires ignorés par Git.

## Distribution et limites

- Dépôt Git principal présent. Distribution, dépôt distant et publication : non configurés. Aucun updater.
- WebView2 requis sous Windows. Autres OS non vérifiés.
- Pas de suite de tests ou lint configurée à ce stade ; pas de test métier pertinent pour l'écran statique.
- `pnpm preview` n'a pas été exécuté séparément.
- Le « dézoom infini » reste soumis aux nombres JavaScript : les changements créant une échelle nulle ou une position non finie sont ignorés. Aucun seuil minimal de confort n'est imposé. Pas de zoom tactile par pincement.

## Vérifications

- Dernier incrément : build réussi ; rendu navigateur contrôlé et événements synthétiques vérifiant plafond 400 %, dézoom profond, stabilité du centre pendant le zoom, translation selon l'échelle et recentrage conservant le zoom. Gestes réels et fenêtre native non revérifiés pour cet incrément.
- Installation des dépendances et du runtime réussie ; build frontend réussi.
- Fenêtre native de développement contrôlée avec l'accessibilité Windows : titre « Sapphire 3 » et contenu React « Tout commence ici. » présents ; fermeture native demandée avec succès.
- `pnpm desktop:start` également contrôlé dans la fenêtre native : même contenu React servi depuis le build local. Cette commande cible Windows x64.
- Détails dans `docs/PROJECT_ARCHIVE.md`.

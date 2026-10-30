# PROJECT_STATE.md — Sapphire 3

## Présentation et périmètre

- Application desktop Windows : React 19, Vite 8, JavaScript/JSX, CSS, pnpm et Neutralinojs 6.10.0.
- Nom de travail repris du dossier : Sapphire 3.
- Direction produit : programmation visuelle fidèle aux concepts du code, futur AST indépendant des langages et traductions vers des langages cibles. Modèle objet évoqué, non défini.
- Étapes livrées : socle frontend et fenêtre native, puis page unique occupée par un canvas visuel plein écran. Quadrillage discret, courbé sur les bords et assombri en périphérie ; aucune interaction.
- Aucun éditeur, graphe, AST, génération de code, stockage, import ou backend implémenté. Les prochains incréments nécessitent une demande.
- Style provisoire minimal, police système locale. Aucun service distant à l'exécution.

## Cartographie

| Chemin | Responsabilité |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Dépendances et commandes du socle |
| `pnpm-workspace.yaml` | Désactivation explicite de trois scripts transitifs de la CLI |
| `index.html`, `src/main.jsx` | Point d'entrée HTML et montage React |
| `src/pages/App.jsx` | Assemblage de l'unique page |
| `src/components/Canvas/Canvas.jsx`, `Canvas.css` | Surface plein écran et vignette périphérique |
| `src/components/CanvasGrid/CanvasGrid.jsx`, `CanvasGrid.css` | Quadrillage SVG décoratif avec distorsion progressive, calculé une fois au chargement du module |
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
- Aucune bibliothèque de nœuds, UI ou gestion d'état ajoutée.
- Pas de client Neutralinojs embarqué : aucune API native nécessaire pour cet écran. Fermeture du processus gérée par la fenêtre native.
- Emplacements internes Neutralinojs configurés sur `system`, sans stockage métier. État de fenêtre non sauvegardé.
- `bin/`, `dist/`, `build/` et fichiers temporaires ignorés par Git.

## Distribution et limites

- Dépôt Git principal présent. Distribution, dépôt distant et publication : non configurés. Aucun updater.
- WebView2 requis sous Windows. Autres OS non vérifiés.
- Pas de suite de tests ou lint configurée à ce stade ; pas de test métier pertinent pour l'écran statique.
- `pnpm preview` n'a pas été exécuté séparément.

## Vérifications

- Dernier incrément : build réussi, rendu navigateur contrôlé visuellement, canvas aux dimensions du viewport sans défilement et aucune erreur console. Pas de nouvelle vérification native pour ce changement uniquement visuel.
- Installation des dépendances et du runtime réussie ; build frontend réussi.
- Fenêtre native de développement contrôlée avec l'accessibilité Windows : titre « Sapphire 3 » et contenu React « Tout commence ici. » présents ; fermeture native demandée avec succès.
- `pnpm desktop:start` également contrôlé dans la fenêtre native : même contenu React servi depuis le build local. Cette commande cible Windows x64.
- Détails dans `docs/PROJECT_ARCHIVE.md`.

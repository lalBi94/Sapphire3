# PROJECT_STATE.md — Sapphire 3

## Présentation et périmètre

- Application desktop Windows : React 19, Vite 8, JavaScript/JSX, CSS, pnpm et Neutralinojs 6.10.0.
- Nom de travail repris du dossier : Sapphire 3.
- Direction produit : programmation visuelle fidèle aux concepts du code, AST indépendant des langages et futures traductions vers des langages cibles. Modèle objet évoqué, non défini.
- Étapes livrées : socle frontend et fenêtre native, page unique avec canvas plein écran et déplacement sans borne applicative. Quadrillage discret, courbé sur les bords et assombri en périphérie.
- Navigation : glisser avec le bouton gauche ou central (également gestes tactiles), ou utiliser les flèches quand le canvas a le focus. Molette : zoom centré sur le milieu de la vue, plafonné à 400 %, sans minimum applicatif de dézoom.
- Croix à l'origine absolue (0, 0), projetée avec la grille. En bas à droite : X/Y du milieu de la vue, pourcentage de zoom et bouton de retour à l'origine conservant le zoom.
- Clic droit sur le canvas vide : menu « Create module » / « Create Main » / « Create comment », création d'un conteneur au point visé. Poignée inférieure droite redimensionnable au pointeur et aux flèches du clavier, avec dimensions minimales de 180 × 120 unités monde.
- Clic droit sur un conteneur ou un nœud logique : menu piloté par le moteur. Sélection du slot libre puis de la construction compatible avec le contexte lexical, formulaire latéral de configuration, insertion atomique validée par réanalyse. Clic gauche : sélection et panneau de propriétés (enfants, diagnostics, édition des propriétés).
- Module et Main se déplacent par glisser sur l'en-tête, ou avec les flèches quand celui-ci a le focus. Le déplacement est converti en unités monde selon le zoom ; redimensionnement indépendant.
- Les Modules visuels sont renommables par double-clic sur le titre, Entrée ou F2 sur l'en-tête ; Entrée ou perte de focus valide, Échap annule, un titre vide conserve l'ancien. Main reste fixe en nom.
- Action « Create comment » : annotation visuelle avec titre renommable et texte multiligne, déplaçable et redimensionnable comme les autres cartes. Saisie et défilement du texte sans pan/zoom involontaire ; hors AST et hors commentaires de code.
- Les cartes Module/Main partagent l'identifiant de leur module source ; Comment reste hors du moteur. Les nœuds logiques s'affichent dans leurs conteneurs avec slots, types résolus et compteurs de diagnostics.
- Zéro ou un Main au maximum par projet : action de création désactivée après le premier et garde-fou dans la mise à jour d'état. Le moteur signale chaque Main supplémentaire avec `MAIN_DUPLICATE`, sans supprimer la source ni les modules AST. Aucun comportement d'exécution ajouté.
- Moteur logique opérationnel et raccordé au canvas : modèle source JSON v1 Modules/Nodes, AST hiérarchique tolérant, portées, références locales/intermodules, alias de types simples, diagnostics structurels/sémantiques et API d'insertion contextuelle (`getAvailableActions`). Import/export logique en mémoire uniquement, sans accès aux fichiers.
- Aucun simulateur, moteur de suggestions, génération de code, stockage sur disque ou backend implémenté ; pas encore de suppression, déplacement individuel ni copier/coller de nœuds logiques. Les prochains incréments nécessitent une demande.
- Interface en anglais (y compris textes accessibles), commentaires et documentation en français.
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
| `src/components/CanvasContextMenu/CanvasContextMenu.jsx`, `CanvasContextMenu.css` | Menu de création, fermeture extérieure, focus et navigation clavier |
| `src/components/CanvasModule/CanvasModule.jsx`, `CanvasModule.css` | Conteneur visuel redimensionnable, positionné dans le monde et mis à l'échelle avec la caméra ; accepte l'arbre logique en enfant |
| `src/components/LogicContextMenu/LogicContextMenu.jsx`, `LogicContextMenu.css` | Menu d'insertion piloté par le moteur : choix du slot, puis construction, puis formulaire latéral |
| `src/components/LogicTree/LogicTree.jsx`, `LogicNode.jsx`, `logicLabels.js`, `LogicTree.css` | Rendu des nœuds source dans les conteneurs, avec slots, types résolus et diagnostics |
| `src/components/NodeProperties/NodeProperties.jsx`, `ModuleNameForm.jsx`, `NodeProperties.css` | Panneau de propriétés : édition, enfants, diagnostics |
| `src/components/NodeForm/NodeForm.jsx`, `NodeTypeInput.jsx`, `NodeValueInput.jsx`, `ExpressionInput.jsx`, `nodeConfiguration.js`, `NodeForm.css` | Formulaires de configuration typée, sans valeur par défaut masquant les diagnostics |
| `src/hooks/useCanvasDocument.jsx` | Document React : cartes, source logique, mutations atomiques et cache d'analyse |
| `src/utils/logic/contextResolver.js` | Cible, parenté, slots et contexte lexical sans reconstruire l'AST |
| `src/utils/logic/actionResolver.js` | Actions disponibles par slot et contexte (`getAvailableActions`) |
| `src/utils/logic/nodeFactory.js` | Construction de bundles source depuis un brouillon |
| `src/utils/logic/sourceMutation.js` | Insertions/éditions atomiques avec réanalyse et rejet des régressions |
| `src/utils/logic/placement.js` | Restrictions lexicales partagées entre validateur et suggestions |
| `src/utils/moduleTypes.js` | Cartes visuelles Module/Main/Comment, libellés anglais, capacités d'édition et dimensions ; Comment n'est pas une catégorie logique |
| `src/utils/logic/model.js`, `nodeSchema.js` | Contrats source JSDoc, catégories stables Module/Main partagées avec l'UI, fabriques et schémas de slots/opérateurs |
| `src/utils/logic/ast.js` | Reconstruction hiérarchique, diagnostics structurels, trous/fragments invalides et parcours |
| `src/utils/logic/semantics.js`, `typeAnalysis.js` | Portées, déclarations, visibilité intermodule et typage statique strict sans secours |
| `src/utils/logic/primitives.js`, `numericConstants.js` | Dix primitifs, tailles/bornes, arrondis et contrôles statiques des littéraux/opérations/conversions constantes |
| `src/utils/logic/diagnostics.js`, `serialization.js`, `index.js` | Diagnostics structurés, JSON versionné et API publique `analyzeProgram` |
| `tests/logic/*.test.js`, `fixtures.js` | Tests Node automatisés et exemple de deux modules |
| `docs/LOGIC_API.md` | Référence des contrats, slots, règles de portée et points d'extension |
| `ARCHITECTURE_AST.tex`, `ARCHITECTURE_AST.pdf` | Rapport technique français de quatre pages ; source LaTeX et PDF réellement compilé |
| `scripts/build-ast-doc.ps1` | Compilation pdfLaTeX locale vers `build/latex/`, puis copie du PDF à la racine |
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
- `pnpm test` : tests du moteur logique avec le runner natif Node, sans dépendance ajoutée.
- `pnpm docs:ast` : export du LaTeX en PDF via MiKTeX/pdfLaTeX installé ; pas d'installation automatique de paquets.

## Contrats et décisions

- Source logique v1 : projet avec modules et tableau global de Nodes ; relations distinctes pour propriété `moduleId`, imbrication `children` et cibles symboliques `references`. Contrats détaillés dans `docs/LOGIC_API.md`.
- AST et données sémantiques dérivés, indépendants des langages, de React, du rendu et des API natives. Identifiants injectés par l'appelant et conservés. Source non mutée ; erreurs bloquantes n'empêchant pas sa représentation ni l'inspection de l'AST.
- Portées module/fonction/bloc/for ; déclarations précollectées, sans analyse générale de l'ordre d'initialisation. Typage explicite obligatoire (y compris littéraux), dix primitifs autorisés seulement, aucune conversion implicite ou valeur de type de secours. Alias transparents vers ces primitifs, signatures de fonctions complètes. Une expression non typable est absente de `semantic.nodeTypes` et présente dans `untypedNodeIds` ; symbole sans type résolu : propriété `type` absente.
- `CastExpression` encode les conversions numériques explicites et identités non void ; entiers signés/non signés 16/32 bits exacts, flottants IEEE 754 32/64 bits. Contrôles statiques des dépassements, sous-flux vers zéro et divisions par zéro prouvables ; pas de wrap. Aucune analyse globale d'intervalles ni moteur d'exécution ; les vérifications de valeurs non constantes restent un contrat pour les futurs backends.
- Fonction non void : retour exigé via contrôle conservateur des blocs et des deux branches d'un if, sans preuve via les boucles. `char` : scalaire Unicode unique. Format JSON v1 conservé, anciennes annotations désormais invalides mais jamais migrées silencieusement. Préférer les littéraux numériques textuels pour préserver leur écriture exacte, dont `'-0'`.
- Les conteneurs visuels en mémoire dans `Canvas` ont un identifiant UUID, un type stable `module` ou `main`, une position `x/y` de l'angle supérieur gauche et des dimensions `width/height` en unités monde. Valeurs initiales : 320 × 220. Aucun format de fichier ni contrat d'exécution n'en découle.
- Les cartes suivent la translation et le zoom, avec des rectangles non déformés ; la courbure reste un effet décoratif du quadrillage. Déplacement individuel et noms visuels personnalisables pour Module/Comment. Pas de suppression de carte.
- Les cartes Module/Main partagent l'identifiant de leur module source ; le nom d'un Module est synchronisé avec le module logique, Main reste fixe. Comment réutilise le cadre visuel sans entrer dans `moduleKinds` ni dans la source logique ; son titre et son texte restent purement UI.
- Les positions et dimensions des cartes restent hors de la source logique. Les nœuds logiques sont rendus dans leur conteneur avec slots, types résolus et compteurs de diagnostics.
- Insertions : jamais de remplacement d'un slot unique occupé, jamais de réutilisation d'un enfant existant dans un bundle neuf, ordre conservé dans les listes, identifiants stables, réanalyse systématique avec comparaison des diagnostics pour rejeter atomiquement une insertion qui introduirait une erreur dure. Les états incomplets (littéral sans valeur, appel partiel, retour sans argument) restent éditables sans bloquer l'édition.
- Contraintes de résultat connues (littéral typé, cast, opérateur déterminé) contrôlées même avant complétion des enfants ; opérateurs filtrés selon le type attendu du slot.
- Caméra en mémoire React, sans persistance : `x` et `y` désignent le point du monde au milieu de la vue, axe Y positif vers le bas ; `zoomLevel` est un exposant en base 2 (0 = 100 %, 2 = 400 %). Le déplacement en pixels est converti selon le zoom.
- Seules les lignes visibles sont tracées via un décalage périodique ; leur espacement monde double progressivement au dézoom pour maintenir une densité raisonnable. Pas de surface géante ni d'accumulation. Les bornes dynamiques attendent une future demande.
- Aucune bibliothèque de nœuds, UI ou gestion d'état ajoutée.
- Pas de client Neutralinojs embarqué : aucune API native nécessaire pour cet écran. Fermeture du processus gérée par la fenêtre native.
- Emplacements internes Neutralinojs configurés sur `system`, sans stockage métier. État de fenêtre non sauvegardé.
- `bin/`, `dist/`, `build/` et fichiers temporaires ignorés par Git.

## Distribution et limites

- Dépôt Git principal présent. Distribution, dépôt distant et publication : non configurés. Aucun updater.
- WebView2 requis sous Windows. Autres OS non vérifiés.
- Tests du moteur configurés avec Node ; pas de lint ni suite d'interactions UI automatisée configurés.
- `pnpm preview` n'a pas été exécuté séparément.
- Le « dézoom infini » reste soumis aux nombres JavaScript : les changements créant une échelle nulle ou une position non finie sont ignorés. Aucun seuil minimal de confort n'est imposé. Pas de zoom tactile par pincement.
- Les modules disparaissent au rechargement : aucune sauvegarde demandée ni implémentée.
- Pas de suppression, déplacement individuel ni copier/coller de nœuds logiques ; pas d'édition directe des enfants dans le panneau (navigation seulement) ni de glisser-déposer entre slots. Aucune migration implicite des données UI.
- Source JSON sérialisable en mémoire uniquement. Version inconnue conservée et signalée ; aucune migration automatique. Profondeurs de sécurité de 200 niveaux environ pour les arbres, dépendances de types et données JSON ; diagnostics en cas de dépassement.

## Vérifications

- Dernier incrément : 75 tests Node réussis, dont 15 pour l'API contextuelle (actions racine, slots simples/multiples, fonction/boucle/condition, contraintes de résultat, arité d'appel, identifiants ambigus, préservation UI). Build frontend réussi.
- Interactions vérifiées dans le navigateur : création de cartes, formulaires typés, insertion variable/fonction/while/if/binaire, opérateurs filtrés par type attendu, nom vide refusé, slots occupés, références lexicales, renommages conservant les identifiants, littéral hors bornes rejeté avec code visible. Console sans erreur. Fenêtre native non revérifiée pour cet incrément.
- Installation des dépendances et du runtime réussie ; build frontend réussi.
- Fenêtre native de développement contrôlée avec l'accessibilité Windows : titre « Sapphire 3 » et contenu React « Tout commence ici. » présents ; fermeture native demandée avec succès.
- `pnpm desktop:start` également contrôlé dans la fenêtre native : même contenu React servi depuis le build local. Cette commande cible Windows x64.
- Détails dans `docs/PROJECT_ARCHIVE.md`.

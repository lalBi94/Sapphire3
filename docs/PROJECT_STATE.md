# PROJECT_STATE.md — Sapphire 3

## Présentation et périmètre

- Application desktop Windows : React 19, Vite 8, JavaScript/JSX, CSS, pnpm et Neutralinojs 6.10.0.
- Nom de travail repris du dossier : Sapphire 3.
- Direction produit : programmation visuelle fidèle aux concepts du code, AST indépendant des langages et futures traductions vers des langages cibles. Modèle objet évoqué, non défini.
- Étapes livrées : socle frontend et fenêtre native, page unique avec canvas plein écran et déplacement sans borne applicative. Quadrillage discret, courbé sur les bords et assombri en périphérie.
- Navigation : glisser avec le bouton gauche ou central (également gestes tactiles), ou utiliser les flèches quand le canvas a le focus. Molette : zoom centré sur le milieu de la vue, plafonné à 400 %, sans minimum applicatif de dézoom.
- Croix à l'origine absolue (0, 0), projetée avec la grille. En bas à droite : X/Y du milieu de la vue, pourcentage de zoom et bouton de retour à l'origine conservant le zoom.
- Clic droit sur le canvas vide : menu « Create module » / « Create comment », création d'un conteneur au point visé. Poignée inférieure droite redimensionnable au pointeur et aux flèches du clavier, avec dimensions minimales de 180 × 120 unités monde.
- Un seul bouton « + » en haut à droite de chaque carte/nœud ouvre le même menu que le clic droit, juste sous le bouton (avec hauteur limitée à l'espace disponible). Retour du focus au bouton à Échap. Les actions logiques restent pilotées par le moteur : slot libre, construction compatible, formulaire et insertion atomique validée par réanalyse. « Delete node » retire immédiatement le nœud et ses descendants. Clic gauche : sélection et panneau de propriétés.
- Création de conditions et d'initialiseurs composés dans un seul formulaire : comparaisons/opérations binaires, opérations unaires, appels de fonctions avec arguments et conversions numériques explicites, imbriquables. Opérateurs et types d'opérandes filtrés selon les règles existantes, références par identifiants stables. Aucune conversion implicite, valeur de secours ou nouvelle sémantique ; l'insertion du sous-arbre est atomique.
- Les modules se déplacent par glisser sur l'en-tête, ou avec les flèches quand celui-ci a le focus. Le déplacement est converti en unités monde selon le zoom ; redimensionnement indépendant.
- Les Modules visuels sont renommables par double-clic sur le titre, Entrée ou F2 sur l'en-tête ; Entrée ou perte de focus valide, Échap annule, un titre vide conserve l'ancien.
- Action « Create comment » : annotation visuelle avec titre renommable et texte multiligne, déplaçable, redimensionnable et supprimable avec confirmation depuis son menu (+ ou clic droit sur le cadre/en-tête). Saisie et défilement du texte sans pan/zoom involontaire ; hors AST et hors commentaires de code.
- Les cartes Module partagent l'identifiant de leur module source ; Comment reste hors du moteur. Les nœuds logiques s'affichent dans leurs conteneurs avec slots, types résolus et compteurs de diagnostics.
- Chaque nœud logique peut être plié ou déplié par son bouton `▸`/`▾`. Les nœuds existants sont pliés par défaut, sauf restauration d'un fichier ; un nœud nouvellement créé est déplié avec ses parents pour rester visible. Plié, un nœud montre un résumé d'une ligne et masque ses slots ; déplié, il reprend le rendu complet. Le pliage reste une présentation par carte, désormais conservée par l'export workspace, hors source logique/AST.
- Chaque nœud reçoit une bordure colorée selon son groupe logique stable : variable, type, fonction, paramètre, condition, boucle, retour, bloc, instruction, opérateur, valeur ou incomplet. Le groupe est défini dans `nodeSchema.js` et les couleurs sont centralisées dans `tokens.css`. La sélection ajoute un anneau sans masquer la couleur de catégorie.
- Aucun type de module Main. Zéro ou une fonction explicitement marquée par `properties.entryPoint: true` par projet, indépendamment de son nom. Case « Entry point » à la création/édition des fonctions et badge textuel dans l'arbre. L'UI bloque une seconde désignation ; les mutations revérifient l'unicité, le moteur diagnostique les sources invalides (`ENTRY_POINT_DUPLICATE`, `ENTRY_POINT_INVALID`) sans les effacer. Pas de signature cible ni d'exécution ajoutée.
- Moteur logique opérationnel et raccordé au canvas : modèle source JSON v1 Modules/Nodes, AST hiérarchique tolérant, portées, références locales/intermodules, alias de types simples, diagnostics structurels/sémantiques et API d'insertion contextuelle (`getAvailableActions`). Moteur pur, sans accès aux fichiers ; enveloppe workspace et services natifs séparés.
- Suppression d'un Module depuis son menu ou son panneau de propriétés, avec confirmation locale : carte, module source et tous ses nœuds retirés ensemble ; références/imports externes conservés et réanalysés. Retirer le marqueur ou supprimer la fonction point d'entrée ou son module libère le rôle. La suppression d'un Comment ne touche qu'à la présentation, sans réanalyse logique.
- Après insertion, le module s'agrandit pour montrer le contenu déplié : largeur portée à au moins 520 unités monde et hauteur mesurée sur le contenu. Jamais de réduction automatique ; le redimensionnement manuel suspend l'ajustement jusqu'à la prochaine insertion dans ce module. Les dispositions importées restent inchangées tant qu'aucune insertion n'est faite.
- Barre supérieure compacte, plaquée au bord haut : volets **Edit**, **View** (réservés, sans actions) et **Settings** avec import `.sp3`/`.json`, export `.sp3` et export JSON. Dialogues Windows pour choisir le chemin ; instantané complet du contenu, de la disposition, du pliage, de la vue et de la sélection. Validation puis confirmation avant remplacement ; erreurs visibles et annulation sans modification. Contrat dans `docs/WORKSPACE_FILES.md`.
- Aucun simulateur, moteur de suggestions, génération de code, autosave ou backend implémenté ; pas encore de déplacement individuel, copier/coller ou annulation de suppression de nœuds logiques. Les prochains incréments nécessitent une demande.
- Interface en anglais (y compris textes accessibles), commentaires et documentation en français.
- Direction artistique Squircle + Glass UI : fonds noir/anthracite, actions principales et badge du point d'entrée jaunes, sélections violettes avec repères supplémentaires (anneau/soulignement ou barre latérale). Coins continus CSS `corner-shape: squircle` avec arrondis de repli ; surfaces flottantes translucides et floutées, reflets et ombres discrets. Cartes et nœuds sans flou imbriqué ; couleurs des catégories logiques conservées. Police système locale, aucun service distant à l'exécution.
- Tokens communs pour palette, courbures, espacements partagés, verre, ombres et transitions de 180 ms. Repli opaque sans `backdrop-filter`, préférences de réduction du mouvement et de la transparence respectées.
- Les actions de menus, de statut, de propriétés et de formulaires utilisent des icônes Lucide React ciblées, avec tailles, épaisseur et attributs d'accessibilité cohérents.

## Cartographie

| Chemin | Responsabilité |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Dépendances et commandes du socle |
| `pnpm-workspace.yaml` | Désactivation explicite de trois scripts transitifs de la CLI |
| `index.html`, `src/main.jsx` | Point d'entrée HTML et montage React |
| `src/pages/App.jsx` | Assemblage de l'unique page |
| `src/components/Canvas/Canvas.jsx`, `Canvas.css` | Surface plein écran, événements de navigation, curseur et vignette périphérique |
| `src/components/ProjectNavigation/ProjectNavigation.jsx`, `ProjectNavigation.css` | Barre haute, volets dépliables, actions de fichiers, statuts et confirmation modale de remplacement |
| `src/hooks/useWorkspaceFiles.jsx` | Opérations asynchrones de fichiers, validation, erreurs, annulation et import en attente de confirmation |
| `src/utils/workspaceFile.js`, `docs/WORKSPACE_FILES.md` | Enveloppe workspace JSON v1, validation et sérialisation pures, reconstruction visuelle des sources logiques seules |
| `src/services/workspaceFiles.js` | Client Neutralinojs local initialisé à la demande, dialogues, taille/extension, lecture et écriture confirmée |
| `src/components/CanvasGrid/CanvasGrid.jsx`, `CanvasGrid.css` | Grille SVG à densité adaptative, croix d'origine et distorsion attachée au viewport ; dimensions suivies avec ResizeObserver |
| `src/components/CanvasStatus/CanvasStatus.jsx`, `CanvasStatus.css` | Coordonnées, zoom et bouton de recentrage, sans connaissance du hook |
| `src/components/CanvasContextMenu/CanvasContextMenu.jsx`, `CanvasContextMenu.css` | Menu de création ou de suppression d'une annotation, fermeture extérieure, focus et navigation clavier |
| `src/components/CanvasModule/CanvasModule.jsx`, `CanvasModule.css` | Carte navigable/redimensionnable, menu en haut à droite, croissance mesurée après insertion et contenu logique en enfant |
| `src/components/NodeMenuButton/NodeMenuButton.jsx`, `NodeMenuButton.css` | Unique « + » de menu en haut à droite, partagé entre cartes et nœuds |
| `src/components/DeleteAction/DeleteAction.jsx`, `DeleteAction.css` | Confirmation locale partagée des suppressions (propriétés et menus), erreurs et focus clavier |
| `src/components/LogicContextMenu/LogicContextMenu.jsx`, `LogicContextMenu.css` | Menu d'insertion piloté par le moteur : choix du slot, puis construction, puis formulaire latéral |
| `src/components/LogicTree/LogicTree.jsx`, `LogicNode.jsx`, `logicLabels.js`, `LogicTree.css` | Rendu des nœuds source dans les conteneurs, avec slots, types résolus, diagnostics, pliage local, résumé d'une ligne et bordure colorée par groupe |
| `src/components/NodeProperties/NodeProperties.jsx`, `ModuleNameForm.jsx`, `NodeProperties.css` | Panneau de propriétés : édition, enfants, diagnostics, suppression via le composant partagé DeleteAction |
| `src/components/NodeForm/NodeForm.jsx`, `NodeTypeInput.jsx`, `NodeValueInput.jsx`, `ExpressionInput.jsx`, `nodeConfiguration.js`, `NodeForm.css` | Formulaires de configuration typée, sans valeur par défaut masquant les diagnostics |
| `src/hooks/useCanvasDocument.jsx` | Document React : cartes, source logique, mutations atomiques et cache d'analyse |
| `src/utils/logic/contextResolver.js` | Cible, parenté, slots et contexte lexical sans reconstruire l'AST |
| `src/utils/logic/actionResolver.js` | Actions disponibles par slot et contexte (`getAvailableActions`) |
| `src/utils/logic/nodeFactory.js` | Construction de bundles source depuis un brouillon |
| `src/utils/logic/sourceMutation.js` | Insertions, éditions et suppressions atomiques avec réanalyse et rejet des régressions |
| `src/utils/logic/placement.js` | Restrictions lexicales partagées entre validateur et suggestions |
| `src/utils/moduleTypes.js` | Cartes visuelles Module/Comment, libellés anglais, capacités d'édition et dimensions ; Comment n'est pas une catégorie logique |
| `src/utils/logic/model.js`, `nodeSchema.js` | Contrats source JSDoc, catégorie stable Module partagée avec l'UI, fabriques et schémas de slots/opérateurs |
| `src/utils/logic/ast.js` | Reconstruction hiérarchique, diagnostics structurels, trous/fragments invalides et parcours |
| `src/utils/logic/semantics.js`, `typeAnalysis.js` | Portées, déclarations, visibilité intermodule et typage statique strict sans secours |
| `src/utils/logic/primitives.js`, `numericConstants.js` | Dix primitifs, tailles/bornes, arrondis et contrôles statiques des littéraux/opérations/conversions constantes |
| `src/utils/logic/diagnostics.js`, `serialization.js`, `index.js` | Diagnostics structurés, JSON versionné et API publique `analyzeProgram` |
| `tests/logic/*.test.js`, `fixtures.js` | Tests Node automatisés et exemple de deux modules |
| `tests/workspace/*.test.js` | Tests purs du format complet, validation et restauration sans perte |
| `docs/LOGIC_API.md` | Référence des contrats, slots, règles de portée et points d'extension |
| `ARCHITECTURE_AST.tex`, `ARCHITECTURE_AST.pdf` | Rapport technique français de quatre pages ; source LaTeX et PDF réellement compilé |
| `scripts/build-ast-doc.ps1` | Compilation pdfLaTeX locale vers `build/latex/`, puis copie du PDF à la racine |
| `src/hooks/useCanvasPan.jsx` | Caméra locale, capture du pointeur, annulation, clavier, zoom logarithmique à la molette et recentrage |
| `src/styles/tokens.css`, `src/styles/global.css` | Thème Squircle + Glass, tokens partagés, géométrie et transitions communes, verre des surfaces flottantes et replis d'accessibilité/compatibilité |
| `vite.config.js` | Intégration React et serveur local strict sur le port 5173 |
| `neutralino.config.json` | Fenêtre native, ressources compilées, démarrage Vite ; globals injectés, auth one-time et permissions natives limitées aux opérations de fichiers autorisées |
| `README.md` | Prérequis et démarrage |

## Commandes configurées

Scripts dans `package.json` :

- `pnpm dev` : fenêtre Neutralinojs + Vite avec HMR.
- `pnpm dev:web` : Vite seul sur `127.0.0.1:5173`.
- `pnpm build` : compilation frontend dans `dist/`.
- `pnpm preview` : prévisualisation Vite du frontend compilé.
- `pnpm desktop:setup` : téléchargement du runtime épinglé dans `bin/`.
- `pnpm desktop:start` : compilation et lancement natif sans serveur Vite.
- `pnpm test` : tests du moteur logique et du format workspace avec le runner natif Node, sans bibliothèque de test ajoutée.
- `pnpm docs:ast` : export du LaTeX en PDF via MiKTeX/pdfLaTeX installé ; pas d'installation automatique de paquets.

## Contrats et décisions

- Source logique v1 : projet avec modules et tableau global de Nodes ; relations distinctes pour propriété `moduleId`, imbrication `children` et cibles symboliques `references`. Contrats détaillés dans `docs/LOGIC_API.md`.
- AST et données sémantiques dérivés, indépendants des langages, de React, du rendu et des API natives. Identifiants injectés par l'appelant et conservés. Source non mutée ; erreurs bloquantes n'empêchant pas sa représentation ni l'inspection de l'AST.
- Portées module/fonction/bloc/for ; déclarations précollectées, sans analyse générale de l'ordre d'initialisation. Typage explicite obligatoire (y compris littéraux), dix primitifs autorisés seulement, aucune conversion implicite ou valeur de type de secours. Alias transparents vers ces primitifs, signatures de fonctions complètes. Une expression non typable est absente de `semantic.nodeTypes` et présente dans `untypedNodeIds` ; symbole sans type résolu : propriété `type` absente.
- `CastExpression` encode les conversions numériques explicites et identités non void ; entiers signés/non signés 16/32 bits exacts, flottants IEEE 754 32/64 bits. Contrôles statiques des dépassements, sous-flux vers zéro et divisions par zéro prouvables ; pas de wrap. Aucune analyse globale d'intervalles ni moteur d'exécution ; les vérifications de valeurs non constantes restent un contrat pour les futurs backends.
- Fonction non void : retour exigé via contrôle conservateur des blocs et des deux branches d'un if, sans preuve via les boucles. `char` : scalaire Unicode unique. Format JSON v1 conservé, anciennes annotations désormais invalides mais jamais migrées silencieusement. Préférer les littéraux numériques textuels pour préserver leur écriture exacte, dont `'-0'`.
- Les conteneurs visuels ont un identifiant UUID, un type stable `module` ou `comment`, une position `x/y` de l'angle supérieur gauche et des dimensions `width/height` en unités monde. Valeurs initiales : 320 × 220. Présentation exportée séparément de la source dans l'enveloppe workspace, sans contrat d'exécution.
- Les cartes suivent la translation et le zoom, avec des rectangles non déformés ; la courbure reste un effet décoratif du quadrillage. Déplacement individuel et noms visuels personnalisables pour Module/Comment. Suppression confirmée des deux types de cartes.
- Les cartes Module partagent l'identifiant de leur module source ; leur nom est synchronisé avec le module logique. Comment réutilise le cadre visuel sans entrer dans `moduleKinds` ni dans la source logique ; son titre et son texte restent purement UI.
- Les positions et dimensions des cartes restent hors de la source logique. Les nœuds logiques sont rendus dans leur conteneur avec slots, types résolus et compteurs de diagnostics. Le pliage des nœuds reste un état UI local, sans effet sur la source ni l'AST.
- Insertions : jamais de remplacement d'un slot unique occupé, jamais de réutilisation d'un enfant existant dans un bundle neuf, ordre conservé dans les listes, identifiants stables, réanalyse systématique avec comparaison des diagnostics pour rejeter atomiquement une insertion qui introduirait une erreur dure. Les états incomplets (littéral sans valeur, appel partiel, retour sans argument) restent éditables sans bloquer l'édition.
- Contraintes de résultat connues (littéral typé, cast, opérateur déterminé) contrôlées même avant complétion des enfants ; opérateurs filtrés selon le type attendu du slot.
- Suppression : `deleteSourceNodes` retire le nœud visé et toute son arborescence syntaxique, puis délie son entrée du parent (slot unique remis à `null`, entrée filtrée dans une liste). Les autres nœuds et identifiants restent inchangés ; les références vers le nœud supprimé sont conservées et deviennent `REFERENCE_UNRESOLVED`. Les cartes Module ne sont pas supprimables par cette action. Aucune annulation.
- Caméra en mémoire React, restaurable par import/export manuel : `x` et `y` désignent le point du monde au milieu de la vue, axe Y positif vers le bas ; `zoomLevel` est un exposant en base 2 (0 = 100 %, 2 = 400 %). Le déplacement en pixels est converti selon le zoom.
- Seules les lignes visibles sont tracées via un décalage périodique ; leur espacement monde double progressivement au dézoom pour maintenir une densité raisonnable. Pas de surface géante ni d'accumulation. Les bornes dynamiques attendent une future demande.
- Aucune bibliothèque de nœuds, UI ou gestion d'état ajoutée.
- Client Neutralinojs 6.10.0 embarqué pour les dialogues et fichiers uniquement ; API natives regroupées dans le service, sans réseau distant. Fermeture du processus toujours gérée par la fenêtre native.
- Emplacements internes Neutralinojs configurés sur `system`, sans stockage métier. État de fenêtre non sauvegardé.
- `bin/`, `dist/`, `build/` et fichiers temporaires ignorés par Git.

## Distribution et limites

- Dépôt Git principal présent. Distribution, dépôt distant et publication : non configurés. Aucun updater.
- WebView2 requis sous Windows. Autres OS non vérifiés.
- Tests du moteur configurés avec Node ; pas de lint ni suite d'interactions UI automatisée configurés.
- `pnpm preview` n'a pas été exécuté séparément.
- Le « dézoom infini » reste soumis aux nombres JavaScript : les changements créant une échelle nulle ou une position non finie sont ignorés. Aucun seuil minimal de confort n'est imposé. Pas de zoom tactile par pincement.
- Aucun autosave : un rechargement vide le document en mémoire. Exporter manuellement pour le conserver, puis importer le fichier dans l'application desktop.
- Pas de déplacement individuel, de copier/coller ni d'annulation de suppression de nœuds logiques ; pas d'édition directe des enfants dans le panneau (navigation seulement) ni de glisser-déposer entre slots. Aucune migration implicite des données UI.
- Moteur : source JSON v1, ancienne catégorie `main` conservée et diagnostiquée `MODULE_INVALID`, version inconnue conservée et signalée. Import UI : structure affichable et versions connues exigées, fichiers de 20 Mio maximum ; anciennes catégories Main et versions inconnues refusées sans remplacer le document. Aucune migration automatique. Profondeurs de sécurité autour de 200 niveaux.

## Vérifications

- Ergonomie de création : 103 tests Node et build réussis. Navigateur : condition complète `2 < 10` en un formulaire, cinq nœuds créés, un seul + par nœud, menu identique au clic droit et ancré 4 px sous le bouton, restitution du focus à Échap ; module agrandi à 520 × 610 sans scroll interne et réduction manuelle conservée. Suppression d'un commentaire annulée puis confirmée sans toucher aux nœuds ; action de suppression du module visible dans son menu. Console sans erreur lors de ces contrôles ; fenêtre native non revérifiée.
- Import/export workspace : 97 tests Node et build réussis. Fenêtre native compilée : import `.sp3`, restauration du pliage/vue/sélection et d'une annotation Unicode, exports `.sp3` et `.json` comparés à l'instantané d'origine, lecture JSON préparée puis remplacement annulé, échec de lecture sans perte de contenu. Navigateur : barre au bord haut, canvas sous la barre, menus et message explicite pour les opérations natives indisponibles. Aucun autosave. Détails/limites dans l'archive.
- Fonction point d'entrée : 90 tests Node et build frontend réussis. Navigateur : menu sans Main, création de `start` marquée, création de `main` ordinaire avec case désactivée, retrait puis réattribution du rôle et badge conservé au pliage ; console sans erreur. Fenêtre native non revérifiée.
- Incrément visuel Squircle + Glass : build frontend réussi ; création/édition d'une variable et rendu des composants communs contrôlés dans le navigateur. Préférences système réduites constatées ; verre également contrôlé via surcharge temporaire des tokens dans le navigateur. Fenêtre Neutralinojs et anciens moteurs CSS non revérifiés pour cet incrément.
- Interactions vérifiées dans le navigateur : tous les nœuds pliés par défaut, nœuds créés dépliés avec leurs parents, pliage/dépliage avec résumé d'une ligne et restitution complète des slots, suppression immédiate par le menu contextuel, suppression confirmée dans le panneau de propriétés, suppression d'une fonction avec tout son sous-arbre et sélection déplacée vers le parent. Bordures colorées vérifiées pour les douze groupes, y compris sous sélection. Console sans erreur. Fenêtre native non revérifiée pour cet incrément.
- Installation des dépendances et du runtime réussie ; build frontend réussi.
- Fenêtre native de développement contrôlée avec l'accessibilité Windows : titre « Sapphire 3 » et contenu React « Tout commence ici. » présents ; fermeture native demandée avec succès.
- `pnpm desktop:start` également contrôlé dans la fenêtre native : même contenu React servi depuis le build local. Cette commande cible Windows x64.
- Détails dans `docs/PROJECT_ARCHIVE.md`.

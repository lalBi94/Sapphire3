# PROJECT_ARCHIVE.md — Sapphire 3

## Initialisation du socle — 30 octobre 2026

- Environnement : Windows, Node.js 24.16.0, pnpm 11.5.0.
- `pnpm install` : première tentative bloquée par les scripts transitifs non approuvés sous pnpm 11. Configuration corrigée avec `allowBuilds: false` pour `bufferutil`, `es5-ext` et `utf-8-validate` ; nouvelle installation réussie.
- `pnpm build` : réussi avec Vite 8.3.5, React/React DOM 19.3.1 et plugin React 6.1.2.
- `pnpm desktop:setup` : téléchargement et extraction du runtime Neutralinojs 6.10.0 réussis avec neu 11.8.0.
- `pnpm dev` : Vite prêt sur `127.0.0.1:5173`, processus `neutralino-win_x64.exe` lancé. Accessibilité Windows : fenêtre titrée « Sapphire 3 », contenu Web contenant le titre et « Tout commence ici. ». Fermeture demandée via `CloseMainWindow`, résultat vrai.
- Aucune fonctionnalité métier, persistance ou API native à tester. Pas de publication, packaging de distribution, test sur autre OS ni vérification séparée de `pnpm preview`.
- `pnpm desktop:start` : tentative initiale rejetée car neu 11 ne propose plus `--frontend-lib-dev`. Script corrigé pour lancer directement le runtime Windows x64 après compilation. Fenêtre compilée contrôlée par l'accessibilité Windows : titre et contenu React présents, sans dépendre de Vite. Fenêtre laissée ouverte.
- `git diff --check` : aucune erreur d'espacement ; avertissement Windows de conversion LF/CRLF uniquement.

## Premier jet du canvas visuel — 30 octobre 2026

- Page unique décomposée en modules `Canvas` et `CanvasGrid`, sans fonctionnalité interactive ni dépendance supplémentaire.
- Quadrillage SVG à distorsion progressive, vignette CSS, surface plein viewport.
- Navigateur sur Vite : capture contrôlée visuellement ; viewport 752 × 670, surface 752 × 670,4 (arrondi des unités CSS), aucune dimension de défilement supplémentaire. Aucun message console de niveau erreur.
- `pnpm build` réussi. Pas de nouvelle vérification de la fenêtre native pour cet incrément visuel.

## Déplacement libre du canvas — 30 octobre 2026

- Hook de navigation locale : pointeur capturé, glisser gauche/central, gestion annulation/perte de capture, flèches clavier et focus visible. CSS `touch-action: none` pour laisser le geste au canvas.
- Grille recalculée avec une translation modulo l'espacement ; échelle SVG suivie par ResizeObserver. La distorsion reste attachée à la fenêtre.
- Contrôles navigateur avec événements DOM synthétiques : une flèche modifie le tracé ; le glisser active le curseur et modifie la grille ; le relâchement termine le geste.
- Déplacement simulé de -10 000 003 px / +10 000 007 px : coordonnées valides, 69 lignes avant et après. Annulation du geste confirmée, aucun déplacement sur les mouvements suivants. Aucun message console de niveau erreur.
- `pnpm build` réussi. Limites : pas de test de glisser physique, de tactile réel ou de nouvelle vérification native ; pas de limites dynamiques ni de zoom implémentés.

## Zoom et repères de navigation — 30 octobre 2026

- Caméra avec position monde du milieu de la vue et zoom logarithmique ; molette non passive pour éviter le défilement du WebView. Zoom maximum 400 %, dézoom sans minimum applicatif (garde-fous de précision JavaScript seulement).
- Grille à pas adaptatif et croix sur l'origine (0, 0), déformée avec le reste de la grille. Module de statut inférieur droit et bouton recentrant sans réinitialiser le zoom.
- Événements synthétiques navigateur : plafond à 400 % confirmé ; 100 crans descendants depuis ce plafond donnent 3,47e-16 %, coordonnées du centre inchangées, tracé valide avec 24 lignes ; le recentrage restaure (0, 0) et la croix.
- Dans un onglet neuf : translation simulée de 80 × 40 px à 400 % donne X = -20 et Y = -10 ; bouton de recentrage donne X = 0, Y = 0 et conserve 400 %. Quatre événements de molette de 200 unités reviennent ensuite à 100 %.
- Contrôle visuel par capture navigateur du quadrillage, de la croix et du statut. `pnpm build` réussi.
- Une tentative d'évaluation dans un onglet inactif a expiré en attendant requestAnimationFrame ; l'onglet a été inspecté puis activé, et le contrôle a été réalisé dans l'onglet visible. Aucun succès n'est déduit de cette expiration.
- Limites : pas de nouvelle vérification native, de molette physique ni de pincement tactile. Pas de limites liées à un projet implémentées.

## Conteneurs Module et Main — 30 octobre 2026

- Menu de création au clic droit avec deux actions anglaises, définitions centralisées dans `src/utils/moduleTypes.js`. Zones vides créées au point monde visé, dimensions initiales 320 × 220, minimum 180 × 120.
- Main est une variante visuelle uniquement. Liste locale dans Canvas, sans sauvegarde, déplacement individuel, suppression, AST ou exécution.
- Modules UI séparés pour le menu et le conteneur ; poignée de redimensionnement avec capture du pointeur et flèches clavier. Menu utilisable avec flèches, Enter et Escape, refermé par clic extérieur ; position bornée au viewport.
- Interface passée en anglais, y compris `lang="en"`, formats numériques et textes accessibles ; commentaires et documentation conservés en français.
- Tests navigateur par événements synthétiques dans un onglet distinct : création des deux types ; premier rectangle à (120, 130), dimensions 320 × 220 ; geste de 80 × 50 px à 100 % donnant 400 × 270, sans activer le pan du canvas ; flèche droite donnant largeur 410.
- À 400 %, geste horizontal de 80 px donnant +20 unités monde (410 vers 430). Menu au coin inférieur droit contenu dans le viewport, fermeture via Escape avec focus rendu au canvas, fermeture par appui extérieur sur un module également confirmée.
- Capture visuelle contrôlée pour les deux variantes. Build frontend réussi et absence d'erreur console contrôlée.
- Limites : tests DOM synthétiques, pas de nouvelle vérification native ou tactile réelle. Les conteneurs restent temporaires et sans contenu logique.

## Fondations AST logique modulaire — 30 octobre 2026

- Moteur JavaScript pur dans `src/utils/logic/` : modèle source JSON v1, schémas discriminés de Nodes, AST hiérarchique, diagnostics structurés, portées lexicales, visibilité par imports/exports explicites, résolution et typage élémentaire. Aucun framework ni dépendance ajouté.
- Séparation explicite entre appartenance module, parenté syntaxique et référence symbolique. Préservation de la source, trous, fragments invalides/détachés, identifiants stables, versions futures conservées sans migration implicite.
- API publique et limites documentées dans `docs/LOGIC_API.md`. Aucune simulation, suggestion ou génération de code ; pas de stockage sur disque ni de raccordement des conteneurs UI aux données logiques. Seules les catégories Module/Main sont partagées.
- `pnpm test` : 27 tests réussis, zéro échec. Scénarios requis couverts (module vide, déclarations, fonctions/paramètres/retours, if/else/while/for imbriqués, références locales et intermodules, références absentes, conflits, programme incomplet, typage et reconstruction JSON).
- Vérifications complémentaires : diagnostics localisés, AST attendu, identifiants conservés, source gelée non mutée, visibilité lexicale, tentative de contournement des imports, cycles syntaxiques et de types, parents multiples, enregistrements invalides, clés hostiles, collections malformées, profondeurs excessives et absence de dépendances React/DOM/natives dans le moteur.
- Le premier contrôle automatique des imports a produit un faux positif sur le discriminant textuel `import` dans un JSDoc ; l'expression a été corrigée pour lire les déclarations de modules, puis la suite est passée.
- `pnpm build` : frontend compilé avec succès ; aucune fonction native modifiée, pas de nouvelle vérification Neutralinojs nécessaire pour cette API pure.
- Documentation : `ARCHITECTURE_AST.tex` réellement compilé par `pnpm docs:ast` avec MiKTeX/pdfLaTeX. PDF A4 de quatre pages à la racine, texte français extrait et page d'architecture rendue en PNG puis contrôlée. Polices Latin Modern et correspondance Unicode ; compilation finale sans débordement de texte.
- Auxiliaires PDF dans `build/latex/`, ignorés par Git ; commande de compilation désactivant l'installation automatique de paquets. Une recherche préalable de paquet LaTeX par `kpsewhich` a expiré ; la compilation explicite du document a ensuite réussi.
- Limites : pas d'analyse de flot, d'objets/génériques/sous-modules, de réexports ou de résolution de fichiers. Les déclarations sont précollectées, les types inconnus restent permissifs. `canGenerate` ne constitue pas une preuve d'exécutabilité ; limites de profondeur de sécurité autour de 200 niveaux.

## Déplacement des conteneurs et Main unique — 30 octobre 2026

- Déplacement de Module et Main via l'en-tête : capture du pointeur, conversion écran/monde selon le zoom, annulation/perte de capture et flèches clavier. Pas de déplacement du canvas ni de modification des dimensions lors du glisser.
- Menu : « Create Main » désactivé si un Main existe, navigation clavier ignorant l'action désactivée. Garde-fou supplémentaire dans la mise à jour fonctionnelle de la liste.
- Moteur : `MAIN_DUPLICATE` sur chaque module Main excédentaire ; zéro et un Main acceptés. La source et tous les modules AST sont conservés, génération bloquée.
- `pnpm test` : 28 tests réussis, zéro échec. Nouveau scénario pour zéro/un/trois Main, localisations des diagnostics et conservation de l'AST. `pnpm build` réussi.
- Navigateur, onglets de test distincts : Main initialement disponible puis action désactivée, un seul Main après tentative de création supplémentaire. À 100 %, glisser Module de 80 × 50 px conserve dimensions et caméra ; flèche droite : +10 unités monde.
- À 400 %, contrôle isolé par événements synthétiques (capture DOM substituée temporairement pour ne pas mêler le pointeur physique) : glisser Main de 80 × 40 px, soit 20 × 10 unités monde ; annulation arrêtant les mouvements suivants ; redimensionnement de 40 px donnant +10 unités monde sans changer la position.
- Gestes physiques, capture réelle hors fenêtre et nouvelle vérification native non effectués. Documentation et LaTeX/PDF actualisés pour Main unique.

## Noms personnalisés et annotations visuelles — 30 octobre 2026

- Renommage Module et Comment par double-clic ou Entrée/F2 sur l'en-tête. Brouillon local, validation par Entrée/perte de focus, annulation par Échap, conservation du nom précédent si vide. Main non renommable.
- Nouvelle action « Create comment », carte sobre à bordure pointillée : texte multiligne libre, même déplacement et redimensionnement que les autres cartes. Données `name`/`text` dans l'état de présentation uniquement ; catégorie Comment volontairement absente du moteur logique.
- La saisie empêche le pan clavier/pointeur et laisse la molette au champ texte au lieu de zoomer. Menu contextuel natif conservé sur les champs pour copier/coller. Menu de création adapté à trois actions et borné au viewport.
- `pnpm test` : 28 tests réussis ; contrôle de la séparation des catégories visuelles/logiques adapté à Comment. `pnpm build` réussi.
- Navigateur par événements synthétiques : Module renommé « Processing », Échap conserve ce nom après un autre brouillon ; menu avec trois actions ; Comment renommé « Architecture notes » à la perte de focus ; texte multiligne conservé, aucun pan/zoom pendant l'édition, menu dans le viewport.
- À 400 %, glisser Comment de 80 × 40 px et resize de 40 px (+10 unités monde) vérifiés ; texte « Visual only » et caméra (0, 0) conservés. Capture pointeur temporairement substituée pour ce test synthétique isolé.
- Limites : pas de sauvegarde des annotations, pas de liaison des noms UI aux symboles AST, pas de nouvelle vérification native ni de gestes physiques automatisés.

## Typage strict entièrement statique — 30 octobre 2026

- Suppression du type logique générique et du type de secours. Catalogue unique des dix primitifs demandés, métadonnées de tailles/signes/bornes dans `primitives.js`. Aucun type ajouté au catalogue ; les signatures de fonctions restent des informations dérivées.
- Annotations explicites obligatoires sur variables, constantes, fonctions, paramètres, alias et littéraux. Ni récupération du type d'un initialiseur, ni conversion implicite. Les opérateurs/références ne peuvent pas imposer leur type par une annotation étrangère à leur schéma.
- Types déterminés dans `semantic.nodeTypes` seulement ; expressions non typables dans `untypedNodeIds`, symbole sans type publié si annotation invalide. Source permissive, trous et identifiants conservés ; validation/génération refusée en présence d'erreurs.
- Opérateurs de mêmes types uniquement, division entière vers zéro sans promotion des petits entiers, reste entier, domaines booléens et numériques séparés. Conditions, affectations, arguments/arité et retours strictement vérifiés ; contrôle conservateur des retours non void par blocs/branches.
- `CastExpression` pour conversion numérique explicite ou identité non void. Troncature avant contrôle vers entier, arrondi IEEE 754 vers flottant ; aucun wrap implicite. `void` réservé aux retours, appels void seulement utilisés sans valeur ; `char` vérifié comme scalaire Unicode unique.
- Littéraux/constants entiers vérifiés en BigInt interne, sans nouveau type source ni sérialisation de BigInt. Constantes flottantes IEEE 754 32/64 bits, subnormaux autorisés, infinis/NaN et sous-flux non nuls vers zéro refusés. Décimaux textuels float arrondis directement par rapport rationnel exact pour éviter le double arrondi via double.
- Dépassements prouvables, divisions par zéro et cycles constants diagnostiqués sans exécuter de fonctions, conditions ou boucles. Les variables ne sont pas propagées comme constantes. Format JSON v1 conservé sans migration silencieuse des anciennes annotations ; `-0` numérique refusé à la sérialisation pour éviter de perdre son signe, forme textuelle `'-0'` conservée.
- `pnpm test` : **60 tests réussis, zéro échec**. Scénarios antérieurs adaptés au typage explicite ; nouveaux tests de toutes les bornes 16/32 bits, signes, incompatibilités, ancien vocabulaire rejeté, types manquants, void, Unicode, conversions, signatures récursives/intermodules, retours, programmes incomplets, arrondis intermédiaires float, seuils à mi-distance, dépassements et sous-flux, JSON et absence de types de secours.
- `pnpm build` : frontend existant compilé avec succès ; aucun fichier React modifié pour cette demande. Tests d'indépendance du moteur conservés, sans dépendance npm supplémentaire ni API native. Aucune simulation ni analyse globale d'intervalles.
- `pnpm docs:ast` : LaTeX actualisé puis PDF de quatre pages réellement recompilé, sans avertissement de débordement. Documentation API et mémoire mises à jour.
- Limites explicites : les types sont entièrement statiques, mais les bornes de toutes les valeurs reçues à l'exécution ne sont pas prouvées globalement. Les futurs backends devront préserver les bornes/arrondis et contrôler les opérations non constantes sans wrap ; aucun générateur ou simulateur n'est implémenté ici. Le contrôle de retour ne prouve pas les cas reposant sur des boucles infinies ou conditions évaluées.

## Menu contextuel piloté par l'AST — 30 octobre 2026

- Quatre modules purs ajoutés au moteur : `contextResolver.js` (cible, parenté unique, slots, contexte lexical, types attendus via le cache d'analyse), `actionResolver.js` (`getAvailableActions`), `nodeFactory.js` (bundles depuis brouillons), `sourceMutation.js` (insertion/édition atomiques avec réanalyse et rejet des régressions dures). `placement.js` centralise les restrictions lexicales désormais partagées entre `semantics.js` et le calcul d'actions ; les déclarations de fonctions/types imbriquées sont ainsi interdites par le validateur lui-même, pas seulement par le menu.
- L'AST existant n'a pas été refait : `ast.js` réutilise un slot racine partagé et `acceptsNodeKind`, `analysis.js` assemble les passes existantes, `analyzeProgram` reste le point d'entrée. Un cache d'index évite de reconstruire l'AST pour les interactions purement visuelles ; la réanalyse complète reste obligatoire après chaque mutation.
- Interface : `useCanvasDocument` gère cartes et source dans un reducer (identifiants Module/Main partagés, Comment hors moteur, positions hors source). `LogicTree`/`LogicNode` rendent les nœuds avec slots et diagnostics ; `LogicContextMenu` propose slot puis construction puis formulaire `NodeForm` (types du catalogue strict, opérateurs filtrés par type attendu, aucune valeur par défaut masquant les diagnostics, option « Allow incomplete » explicite) ; `NodeProperties` édite les propriétés, liste enfants et diagnostics. Textes UI en anglais.
- Garde-fous vérifiés : slot unique occupé non remplaçable, bundle neuf sans enfant existant, identifiants uniques et non réutilisés, cibles ambiguës ou périmées refusées, contexte détaché/à parents multiples refusé, arité d'appel bloquée à saturation, contraintes de résultat contrôlées avant complétion, états incomplets (littéral sans valeur, appel partiel, retour sans argument) acceptés sans bloquer l'édition mais `canGenerate` faux.
- `pnpm test` : **75 tests réussis, zéro échec**, dont 15 nouveaux couvrant actions racines déterministes, ordre des insertions successives, sérialisation/désérialisation après mutations, slot simple occupé, fonction (paramètres/corps/retour), boucles et conditions, opérandes binaires, déclarations imbriquées refusées par le validateur, factory invalide, contexte lexical distinct de l'appartenance, mise à jour de propriétés, configuration UI (paramètres typés, littéral inchangé préservé y compris -0, référence non résolue conservée), appel incomplet arité par arité, contraintes de résultat, identifiant ambigu.
- `pnpm build` réussi. Navigateur : création d'un Module, variable `int` avec initialiseur littéral, renommage conservant l'identifiant source, sélection d'un littéral (aucune insertion possible), fonction `compute(int p) → int` avec retour référençant le paramètre renommé, `while` acceptant break et refusant return, `if` avec slots occupés et création de l'alternate, opérateurs booléens (`== != and or`) vs numériques (`+ - * / %`) filtrés selon le type du slot, nom vide refusé, littéral `short int` 32768 rejeté avec `INSERTION_INVALID — NUMERIC_OVERFLOW`. Console sans erreur. Deux scripts de contrôle initiaux ont échoué sur des hypothèses de script (champ Name inexistant sur BinaryExpression, fermeture d'un menu déjà fermé) ; l'état de la page a été inspecté avant chaque nouvelle tentative, aucune action n'a été déduite de ces échecs.
- Limites : pas de suppression, déplacement individuel ou copier/coller de nœuds logiques ; pas d'édition directe des enfants dans le panneau (navigation seulement) ; pas de drag-and-drop entre slots ; fenêtre native et gestes physiques non revérifiés ; les suggestions ne proposent pas encore les constructions imbriquées en une seule étape (création puis remplissage des slots).

## Pliage et suppression des nœuds — 30 octobre 2026

- `deleteSourceNodes(project, targetId, {index})` dans `sourceMutation.js` : cible `{kind:'node', id}` reliée à un parent unique, refus des modules (`MODULE_NOT_DELETABLE`), identifiants absents/ambigus, nœuds détachés et parents ambigus avec source d'origine renvoyée. En cas de succès, parcours itératif du sous-arbre (résistant aux cycles), retrait des enregistrements, déliaison du parent (slot unique à `null`, liste filtrée), réanalyse complète, `removedNodeIds` et `selection` du parent.
- Aucune réécriture des références : une référence vers un nœud supprimé reste dans la source et produit `REFERENCE_UNRESOLVED`. Aucun autre identifiant ni ordre de liste n'est modifié. `createContextIndex` met aussi en cache `symbols` et `references` pour les résumés.
- `useCanvasDocument` accepte une cible objet ou un identifiant simple et applique l'action `delete` via le même reducer atomique que l'insertion/l'édition. `Canvas.handleDeleteNode` sélectionne le parent logique et ferme le menu.
- Menu contextuel : action « Delete node » réservée aux cibles nœud, avec indication que les enfants partent aussi. Panneau de propriétés : section de danger et confirmation locale en deux temps (`Delete node` → `Confirm deletion` / `Cancel`) via `DeleteNodeButton.jsx`. Aucune entrée de suppression pour Module/Main.
- Pliage : état local `Set` par `LogicTree`, bouton `▸`/`▾` avec `aria-expanded`, classe `logic-node--collapsed`, slots masqués, résumé d'une ligne via `nodeSummary` (littéral, opérateur, cible de référence/appel/affectation, nombre d'instructions, type ou signature) et ellipse CSS. Aucun effet sur la source, l'AST ou la sélection.
- `pnpm test` : **80 tests réussis, zéro échec**, dont 5 nouveaux pour la suppression (slot unique, ordre de liste, sous-arbre de fonction, référence conservée et signalée, cibles invalides). `pnpm build` réussi.
- Navigateur : pliage/dépliage d'une variable et d'une fonction (`(int) → void`), slots masqués puis restitués, suppression du littéral par le menu (slot `initializer` vide, sélection du parent), suppression confirmée dans les propriétés, suppression d'une fonction avec paramètre/corps/retour et retour à la sélection du module. Console sans erreur.
- Incident de vérification : le serveur Vite a servi des modules obsolètes après des éditions structurelles, puis s'est arrêté ; il a été relancé et la page rechargée avant de conclure. Un premier script a aussi cliqué un bouton absent (menu déjà fermé) ; l'état a été inspecté avant de reprendre. Un accès non optionnel à `index.references`/`index.symbols` a été corrigé en accès optionnel.
- Limites : pas d'annulation, pas de suppression de Module/Main, pas de persistance du pliage. Fenêtre native non revérifiée pour cet incrément.

## Couleurs par catégorie logique — 30 octobre 2026

- `nodeSchema.js` ajoute un champ `group` stable à chaque construction, distinct de `category` qui continue de piloter la compatibilité syntaxique : `variable`, `type`, `function`, `parameter`, `condition`, `loop`, `return`, `block`, `statement`, `operator`, `value`, `incomplete`. Variables et constantes partagent `variable` ; appels et fonctions `function` ; `while`/`for`/`break`/`continue` `loop` ; littéraux et références `value`.
- `LogicNode` expose ce groupe via `data-group`; `LogicTree.css` applique la couleur de bordure correspondante. Les douze couleurs sont des variables `--color-node-*` dans `tokens.css`, sans couleur codée en dur dans le composant.
- La sélection conserve la couleur de catégorie et ajoute un anneau `box-shadow` avec l'accent existant, au lieu de remplacer la bordure.
- `pnpm test` : **81 tests réussis, zéro échec**, avec un contrôle que chaque construction déclare un groupe non vide. `pnpm build` réussi.
- Navigateur : variable, littéral, fonction, paramètre, bloc et type contrôlés avec leurs couleurs respectives ; les douze groupes mesurés sur des éléments `.logic-node` correspondent aux variables CSS, y compris pour la sélection. Console sans erreur.
- Limites : couleurs statiques, sans légende ni personnalisation ; la catégorie reste une information de présentation et n'entre ni dans l'AST ni dans les diagnostics.

## Nœuds pliés par défaut — 30 octobre 2026

- `LogicTree` mémorise désormais les identifiants explicitement dépliés (`expandedIds`) au lieu des identifiants pliés : un nœud sans entrée est rendu plié. Un nœud nouvellement inséré apparaît donc plié, avec son résumé d'une ligne.
- `LogicNode` dérive `expanded` de cet ensemble ; l'état `aria-expanded`, le chevron, la classe `logic-node--collapsed` et l'affichage des slots suivent cette valeur. Déplier un parent rend ses enfants, eux-mêmes pliés par défaut.
- `pnpm test` : 81 tests réussis, zéro échec. `pnpm build` réussi. Navigateur : variable insérée directement pliée, dépliage affichant le slot `initializer` et le littéral enfant encore plié, repliage revenant au résumé. Console sans erreur.
- Limite : l'état reste local à chaque carte et n'est pas sauvegardé ; fenêtre native non revérifiée.

## Nœuds créés dépliés — 30 octobre 2026

- `LogicTree` conserve la référence des identifiants déjà connus lors du montage, puis compare cet ensemble à chaque changement de source. Les nœuds réellement ajoutés sont dépliés, ainsi que leur chaîne de parents, sans rouvrir les nœuds existants ni modifier les nœuds présents au premier rendu.
- L'état reste local à la carte et fondé sur les identifiants stables ; aucune information de pliage n'entre dans la source, l'AST ou le document.
- `pnpm test` : 81 tests réussis, zéro échec. `pnpm build` réussi.
- Navigateur : variable avec initialiseur créée dépliée, nouveau nœud racine déplié alors que les autres restent pliés, insertion d'un littéral dans une variable préalablement pliée dépliant la variable et le littéral. Console sans erreur.
- Limite : fenêtre native non revérifiée ; le pliage n'est toujours pas sauvegardé.

## Socle Squircle + Glass UI — 30 octobre 2026

- Palette, courbures, espacements partagés, opacité des surfaces, flou, reflets, ombres et durée de transition centralisés dans les tokens existants. Adaptation CSS des menus, statut, cartes, nœuds, formulaires et panneau de propriétés ; aucun JavaScript, contrat logique ou mécanisme de navigation modifié, aucune dépendance ajoutée.
- Coins `squircle` pris en charge par le Chromium utilisé ; `border-radius` sert de repli. Verre réservé aux surfaces flottantes, cartes quasi opaques avec reflets et nœuds sans flou. Anneau et soulignement pour les sélections ; barre latérale et graisse pour l'action active du menu.
- Navigateur sur le serveur Vite déjà actif sur 5173 : création d'un Main, ouverture du menu logique, sélection d'une construction, création d'une variable `int`, édition du nom, pliage du nœud, fermeture du panneau et focus clavier contrôlés. Captures visuelles du menu/formulaire et du panneau. Console sans erreur.
- Préférences système `prefers-reduced-motion` et `prefers-reduced-transparency` actives : transitions calculées à 0 s, surfaces opaques et flou à 0 px. Branche verre contrôlée en surchargeant temporairement les tokens dans le navigateur : panneau à 16 px de flou, cartes et nœuds sans flou ; surcharges retirées ensuite.
- Calcul conservateur des contrastes sur le verre posé sur du blanc, reflet compris : texte principal 9,44:1, texte secondaire 5,11:1 ; violet sélectionné sur son fond teinté 4,65:1. Texte sombre du bouton jaune 13,29:1.
- `pnpm build` et `git diff --check` réussis. Tests du moteur non relancés pour ce changement uniquement CSS ; 81 tests avaient réussi juste avant cet incrément.
- Limites : fenêtre Neutralinojs, petits viewports et anciens moteurs CSS non revérifiés ; replis prévus dans les styles. La tentative de second serveur Vite a échoué car le port était déjà occupé ; serveur existant conservé.

## Suppression des modules — 30 octobre 2026

- Action « Delete module » confirmée dans le panneau de propriétés, disponible pour Module et Main. Retrait atomique de la carte et de la source propriétaire ; références et imports externes conservés, réanalyse des diagnostics. Aucun retrait d'annotation Comment ajouté.
- `deleteSourceModule` testé pour le contenu détaché, la conservation de la source et des autres modules, les références pendantes, le Main et les cibles absentes/ambiguës.
- 83 tests Node et build réussis. Navigateur : annulation conservant le Main et sa variable, puis confirmation supprimant carte et nœud, fermant le panneau et restaurant le focus au canvas. Fenêtre native non revérifiée.

## Fonction point d'entrée à la place du module Main — 30 octobre 2026

- Retrait de la catégorie `main`, de sa création et de ses particularités d'édition/style. Les modules sont ordinaires et renommables. Règle permanente et documentation actualisées ; les anciens passages de cette archive décrivent les incréments antérieurs.
- Désignation explicite d'une `FunctionDeclaration` par `properties.entryPoint: true`, booléen facultatif indépendant du nom et de la signature cible. Zéro ou une fonction marquée par projet ; pas d'exécution, de génération ni de migration automatique. Anciennes sources v1 avec module `main` conservées et diagnostiquées `MODULE_INVALID`.
- L'analyse détecte marqueurs invalides et doublons sans supprimer les données ; insertions et nouvelles désignations concurrentes en doublon refusées atomiquement. Retrait du marqueur ou suppression de la fonction/du module libère le rôle.
- Case « Entry point » dans les formulaires de création et d'édition, désactivée si une autre fonction porte le rôle, avec explication. Badge textuel jaune dans l'arbre, également plié.
- `pnpm test` : 90 tests réussis. `pnpm build` réussi. Navigateur : menu de création sans Main, création de `start` marquée, seconde fonction `main` non marquée et case désactivée, retrait du rôle puis désignation de `main`, badge visible au pliage. Console sans erreur, captures contrôlées. Fenêtre native non revérifiée.

## Barre de navigation et fichiers workspace — 30 octobre 2026

- Barre compacte de 34 px au bord supérieur, canvas dans l'espace restant. Volets dépliables **Edit**, **View** réservés, **Settings** avec import `.sp3`/`.json`, export `.sp3`, export JSON. Un seul volet ouvert, fermeture extérieure/Échap, focus visible. Confirmation de remplacement dans un dialogue modal avec focus initial sur Cancel.
- Enveloppe JSON UTF-8 `application: "Sapphire 3"`, `workspaceVersion: 1`, source logique v1 et présentation séparées. Sauvegarde de toutes les cartes, annotations Unicode, géométrie, ordre, nœuds dépliés, caméra et sélection. Les brouillons non validés, menus et scrolls locaux restent temporaires. Source logique JSON seule acceptée avec disposition déterministe ; pas de migration ni fusion.
- Validation avant remplacement, versions inconnues/ancienne catégorie Main et structures non affichables refusées ; programmes sémantiquement incomplets toujours autorisés. Taille maximale 20 Mio, extension garantie, contrôle du chemin final et confirmation d'écrasement. Une annulation/erreur ne remplace pas le document.
- Client natif officiel `@neutralinojs/lib` 6.10.0, chargé à la demande dans le service. Configuration : API natives activées, `injectGlobals: true`, `tokenSecurity: "one-time"`, six méthodes autorisées (dialogues ouverture/enregistrement/confirmation, statistiques/lecture/écriture). Aucun accès distant ni autosave ; les anciennes fenêtres doivent être redémarrées pour recevoir ces réglages.
- `pnpm test` : **97 tests réussis**, dont 7 du format workspace (aller-retour complet, Unicode, source seule, vide/incomplet, nettoyage du pliage, invalides et absence de mutation). `pnpm build` réussi ; `git diff --check` sans erreur de contenu.
- Fenêtre Neutralinojs compilée indépendante : import d'un `.sp3` de test avec fonction point d'entrée, commentaire Unicode, cartes dimensionnées, pliage et caméra à 84,1 % ; restauration vérifiée dans le DOM natif. Exports natifs `.sp3` et `.json` relus sur disque et comparés exactement à l'instantané initial. Lecture d'un JSON complet jusqu'à la confirmation, puis annulation conservant les cartes, le commentaire et la vue. Une lecture de chemin absent a affiché l'erreur sans toucher au document. Fenêtre automatisée ensuite fermée ; aucune donnée de test ajoutée au dépôt.
- Navigateur Vite : navigation à y=0, canvas à y=34 jusqu'au bas de la vue, menu Settings et actions présentes ; l'export sans environnement natif affiche une erreur claire, console sans erreur. Pas de repli navigateur qui enregistrerait silencieusement à un emplacement non choisi.
- Incidents de contrôle : première fenêtre de test sans globals natifs, corrigée par `injectGlobals`; une tentative avec chemin relatif/profil WebView partagé n'a pas démarré. Contrôles suivants avec chemin absolu et profil temporaire distinct. Plusieurs recherches UIAutomation/Win32 ont trouvé des dialogues déjà fermés ou des patterns indisponibles ; aucun succès déduit de ces tentatives. Une comparaison initiale ciblait un autre fichier existant et a échoué ; la comparaison correcte a utilisé le chemin d'export de la fenêtre de test et a réussi. Les erreurs d'instrumentation CDP n'ont pas modifié le code applicatif.
- Limites non revérifiées : permission Windows explicitement refusée, disque plein, fichier de plus de 20 Mio et petits viewports natifs. Aucun test de publication/distribution.

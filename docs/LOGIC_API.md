# API du moteur logique — format source v1

Point d'entrée : `src/utils/logic/index.js`. JavaScript pur, sans React, DOM, API native, dépendance npm ou accès aux fichiers. Le modèle source est la référence persistable ; AST, portées et types sont des résultats dérivés, jamais la sauvegarde principale.

## API publique

| Fonction | Résultat |
| --- | --- |
| `createProject(id)` | `{formatVersion: 1, id, modules: [], nodes: []}` |
| `createModule(id, name, kind = 'module')` | Module vide ; seule catégorie valide : `module` |
| `createNode(id, moduleId, kind, {properties, children, references})` | Nœud permissif, sans génération d'identifiant |
| `buildLogicalAst(source)` | `{ast, diagnostics}` ; structure hiérarchique avec trous et fragments invalides |
| `buildSemanticModel(ast)` | `{model, diagnostics, index}` ; entrée attendue : AST issu du constructeur ; `index` contient les Map temporaires des passes suivantes |
| `analyzeProgram(source)` | `{source, ast, semantic, diagnostics, canGenerate}` ; point d'entrée recommandé |
| `walkAst(ast, visitor)` | Parcours syntaxique des nœuds et fragments détachés, sans suivre les références |
| `findAstNode(ast, sourceId)` | Nœud construit correspondant, ou `null` |
| `serializeSource(source)` | `{json, diagnostics}` ; `json: null` si une valeur n'est pas représentable sans perte en JSON |
| `deserializeSource(json)` | `{source, diagnostics}` ; `source: null` si JSON illisible ; version future conservée et signalée |
| `hasBlockingDiagnostics(diagnostics)` | Vrai si au moins une gravité `error` est présente |
| `createContextIndex(project, analysis?)` | Cache lecture seule : modules, nœuds, parentés, doublons, types, portées, symboles et références déjà analysés |
| `resolveContext(project, targetId, slot?, index?)` | Cible résolue, slots, contexte lexical, portée et type attendu, sans reconstruire l'AST |
| `getAvailableActions(project, targetId, slot?, {index})` | `{ok, actions, slots, slot, …}` ; constructions insérables dans le slot demandé |
| `getVisibleSymbols(context)` | Symboles lexicaux visibles depuis la portée d'insertion |
| `createNodeBundle(moduleId, draft, idFactory)` | `{ok, rootId, nodes}` ; arborescence source neuve, sans toucher aux nœuds existants |
| `insertSourceNodes(project, {targetId, slot}, bundle, {index})` | `{ok, project, analysis, index, nodeId}` ou code d'échec ; insertion atomique |
| `updateSourceNode(project, nodeId, {properties?, references?})` | Édition des propriétés seules, enfants et identifiants conservés |
| `deleteSourceNodes(project, targetId, {index})` | `{ok, project, analysis, index, removedNodeIds, selection}` ou code d'échec ; retrait du nœud et de son sous-arbre |
| `deleteSourceModule(project, moduleId)` | Retrait atomique du module et de tous les nœuds dont il est propriétaire, y compris détachés ; réanalyse et `selection: null`. Références/imports externes conservés et diagnostiqués ; cible absente ou ambiguë refusée. |
| `getModuleRootSymbols(project, moduleId, analysis?)` | Symboles déclarés à la racine du module, hors imports |
| `getModuleFunctions(project, moduleId, analysis?)` | Fonctions de premier niveau exportables de ce module |
| `getImportCandidates(project, moduleId, analysis?)` | Fonctions des autres modules qui ne sont pas encore importées ici |
| `setModuleExport(project, moduleId, nodeId, exported)` | Ajoute ou retire un export de fonction racine ; refus `EXPORT_IN_USE` si un autre module l'importe encore |
| `addModuleImport(project, moduleId, {id, targetModuleId, nodeId, localName})` | Ajoute un import stable ; crée l'export manquant dans le module source. Refuse cible non fonction, doublon et nom local déjà pris |
| `removeModuleImport(project, moduleId, importId)` | Retire uniquement la liaison d'import ; déclaration et références restantes conservées |

`diagnosticCodes`, `sourceFormatVersion`, `moduleKinds`, `nodeSchema`, `getNodeSchema`, `binaryOperators`, `unaryOperators`, `primitiveDefinitions`, `primitiveType(name)`, `sameType` et `acceptsOperand` sont également exportés. `primitiveType` renvoie uniquement un primitif autorisé, ou `null` comme absence de résultat. Aucun type de secours n'existe. La catégorie Module est définie dans `model.js` et réutilisée par les libellés visuels ; les cartes Module partagent l'identifiant de leur module source, tandis que les annotations Comment restent hors du moteur. Les contrats JSDoc sont dans `model.js`, `ast.js`, `semantics.js`, `diagnostics.js`, `contextResolver.js` et `sourceMutation.js` ; aucun TypeScript ajouté.

Les fonctions ne modifient pas les entrées. Les identifiants sont fournis par l'appelant, stables et jamais régénérés pendant les transformations. Les consommateurs doivent traiter les résultats comme des instantanés en lecture seule ; certains champs JSON sont partagés avec la source, sans copie profonde inutile.

## Trois relations indépendantes

- `node.moduleId` : propriétaire logique obligatoire ; identifiants de nœuds uniques dans le projet.
- `node.children` : imbrication syntaxique par noms de slots ; un nœud a au plus un parent syntaxique (ou une entrée racine). Un enfant ne traverse pas la frontière d'un module.
- `node.references.target` : lien symbolique, jamais un enfant syntaxique. Une référence ne déplace ni ne réplique la déclaration dans l'AST.

Un module possède `rootNodeIds`, `imports` et `exports`. L'ordre de `rootNodeIds` et des slots de listes est l'ordre syntaxique, pas celui du tableau global `nodes`. Pas de sous-modules dans cette version ; l'absence de hiérarchie de modules évite de la confondre avec les portées lexicales.

Un projet valide contient zéro ou une seule fonction portant `properties.entryPoint: true`. Le marqueur est un booléen optionnel réservé à `FunctionDeclaration` ; absent ou `false`, la fonction est ordinaire, même si elle s'appelle `main`. Toute fonction marquée supplémentaire produit `ENTRY_POINT_DUPLICATE`, sur son `nodeId` et `properties.entryPoint`, y compris dans les fragments détachés. Un marqueur non booléen ou placé sur une autre construction produit `ENTRY_POINT_INVALID`. Les données invalides restent inspectables et sérialisables sans suppression automatique ; `canGenerate` est faux. Aucun nom, signature cible, appel implicite ou comportement d'exécution n'est imposé ; les règles de types et de retour ordinaires s'appliquent.

La catégorie de module `main` est retirée : une ancienne source v1 l'utilisant reste conservée et diagnostiquée `MODULE_INVALID`, jamais convertie silencieusement en module ou en fonction. Le format JSON logique reste v1 ; aucune migration automatique. L'import/export de fichiers est une responsabilité séparée du moteur : voir `docs/WORKSPACE_FILES.md` pour l'enveloppe workspace, la validation UI et les services natifs.

## Constructions et slots

`properties` et `references` sont toujours des objets ; les slots optionnels acceptent `null` ou l'absence de clé. Une liste vide est valide, une liste absente requise est diagnostiquée.

| `kind` | Propriétés et slots |
| --- | --- |
| `VariableDeclaration` | `name`, `type` obligatoire ; `initializer?` expression |
| `ConstantDeclaration` | `name`, `type` obligatoire ; `initializer` expression requis |
| `FunctionDeclaration` | `name`, `type` obligatoire (retour), `entryPoint?` booléen ; `parameters[]`, `body` Block |
| `Parameter` | `name`, `type` obligatoire ; uniquement dans `parameters[]` |
| `TypeDeclaration` | `name`, `type` obligatoire ; alias transparent d'un primitif, pas de classes/structures |
| `Block` | `statements[]` : déclarations ou instructions |
| `ReturnStatement` | `argument?` expression ; uniquement dans une fonction |
| `PrintStatement` | `value` expression non `void` ; ajoute la représentation textuelle de la valeur à la sortie de simulation |
| `IfStatement` | `test` expression booléenne, `consequent` Block, `alternate?` Block |
| `WhileStatement` | `test` booléen, `body` Block |
| `ForStatement` | `initializer?` variable/constante/affectation/instruction-expression ; `test?`, `update?` expression ou affectation ; `body` Block |
| `BreakStatement`, `ContinueStatement` | Aucun slot ; boucle obligatoire, sans traverser une frontière de fonction |
| `ExpressionStatement` | `expression` |
| `AssignmentStatement` | `target` Reference, `value` expression ; variable ou paramètre modifiable |
| `BinaryExpression` | `operator`, `left`, `right` |
| `UnaryExpression` | `operator`, `operand` |
| `Literal` | `type` obligatoire et `value` strictement compatible ; aucune inférence depuis la valeur |
| `Reference` | `references.target` |
| `CallExpression` | `callee` expression, `arguments[]` |
| `CastExpression` | `type` cible obligatoire, `argument` expression ; conversion explicitement demandée |
| `Hole` | Incomplétude explicite, diagnostic bloquant mais représentation conservée |

`nodeSchema.js` centralise catégories, slots et opérateurs. Le champ `declaresType` identifie les constructions portant une annotation ; une annotation sur un opérateur ou une référence est une erreur structurelle et ne peut pas forcer son type. Chaque schéma porte aussi un `group` stable (`variable`, `type`, `function`, `parameter`, `condition`, `loop`, `return`, `block`, `statement`, `operator`, `value`, `incomplete`) utilisé uniquement par l'interface pour la couleur de bordure ; il ne participe ni à la validation ni au typage. Les règles détaillées des opérateurs et conversions sont ci-dessous.

## Portées, imports et types

- Une portée par module ; une par fonction, partagée par ses paramètres et son bloc principal ; une par bloc imbriqué et par `for`.
- Un espace de noms commun aux valeurs et aux types. Les déclarations d'une portée sont collectées avant résolution ; pas de temporal dead zone ni d'analyse d'initialisation/ordre d'exécution à ce stade.
- Un nom peut masquer une déclaration d'une portée externe. Un doublon dans la même portée est une erreur ; la première déclaration reste choisie pour permettre l'inspection.
- Cibles : `{kind:'name', name}`, `{kind:'node', nodeId}`, `{kind:'import', importId}`. Une cible par identifiant reste soumise à l'accessibilité lexicale ; un import explicite peut être visé par son identifiant indépendamment de son alias local.
- Export : `{nodeId, name}`, uniquement pour une déclaration racine. Import : `{id, moduleId, nodeId, localName}`, uniquement vers un nœud explicitement exporté d'un autre module. Les imports peuvent être cycliques ; aucune exécution ou analyse de cycle d'initialisation n'est engagée. Pas de réexport, import étoilé ou résolution de chemin physique.
- Toutes les variables, constantes, fonctions, paramètres, déclarations de types et tous les littéraux portent un type explicite. Une fonction porte le type de retour, chaque paramètre son propre type. Les alias existants restent transparents et doivent aboutir à un primitif autorisé ; aucun nouveau type avancé introduit.
- Une annotation absente ou invalide est diagnostiquée et ne produit aucun type de remplacement. Les déclarations ne récupèrent jamais le type de leur initialiseur. Les expressions valides sont déterminées uniquement par les types déclarés et les règles des constructions.
- `semantic.nodeTypes` ne contient que les résultats de typage résolus. `semantic.untypedNodeIds` liste les expressions qui ne peuvent pas être typées ; un symbole non typable n'a pas de propriété `type`. `null` dans les calculs internes représente une absence, pas un type logique.
- Le type fonction dérivé est une signature complète `{kind:'function', parameters:[...], returnType:...}`, pas un primitif supplémentaire ni un type de variable autorisé. Les signatures récursives sont résolues sans exécuter les fonctions.

## Typage statique strict : catalogue et bornes

Le catalogue unique est `primitives.js`. Les seuls primitifs sont :

| Nom exact | Représentation et domaine |
| --- | --- |
| `short int` | Entier signé 16 bits : -32 768 à 32 767 |
| `short uint` | Entier non signé 16 bits : 0 à 65 535 |
| `int` | Entier signé 32 bits : -2 147 483 648 à 2 147 483 647 |
| `uint` | Entier non signé 32 bits : 0 à 4 294 967 295 |
| `float` | IEEE 754 binaire32 ; maximum fini ≈ 3,4028234663852886 × 10^38 ; minimum subnormal positif 2^-149 |
| `double` | IEEE 754 binaire64 ; maximum fini ≈ 1,7976931348623157 × 10^308 ; minimum subnormal positif 2^-1074 |
| `string` | Chaîne, vide autorisé ; aucune conversion en nombre implicite |
| `char` | Un scalaire Unicode unique, y compris hors BMP ; ni paire de scalaires ni surrogate isolé |
| `boolean` | Booléen strict, jamais 0/1 ou chaîne |
| `void` | Absence de valeur : annotation de retour de fonction uniquement |

`number`, `any` et `unknown` sont rejetés comme types logiques ; aucun export, marqueur interne ou compatibilité implicite ne les remplace. Le mot `number` dans `typeof` JavaScript désigne uniquement le stockage de l'hôte, jamais un type logique du programme.

### Littéraux et précision

Forme : `{kind:'Literal', properties:{type:{kind:'primitive',name:'short int'},value:'32767'}, ...}`. Un entier accepte un entier JSON exact dans son domaine, ou un texte décimal signé sans point ni exposant. Le calcul interne utilise BigInt, jamais persisté dans la source ou exposé comme nouveau type. Les fractions, hexadécimaux textuels et chaînes avec espaces sont refusés.

Un flottant accepte un nombre JSON fini ou un texte décimal avec point/exposant. Un nombre JSON déjà chargé représente sa valeur binaire64 reçue ; utiliser un texte décimal pour conserver le lexème exact. Les textes `float` sont arrondis directement en binaire32 par rapport rationnel exact, sans double arrondi via binaire64 ; les `double` utilisent l'arrondi IEEE 754 binaire64 du moteur JS. Arrondi au plus proche, égalités vers le significande pair. Les subnormaux sont autorisés ; infinis, NaN, dépassements et valeurs non nulles arrondies à zéro sont refusés. Chaque résultat arithmétique `float` est de nouveau arrondi en binaire32.

Le texte `'-0'` préserve un zéro flottant signé à travers JSON. La sérialisation refuse une valeur JS numérique `-0`, que `JSON.stringify` transformerait silencieusement en `0` ; l'analyse peut la représenter mais sa sauvegarde exige cette forme textuelle.

### Opérateurs, appels, affectations et retours

- Aucun élargissement, promotion des petits entiers, changement de signe ou conversion implicite, même sans perte de précision. Affectation, initialisation, arguments et retours exigent des types strictement identiques après résolution des alias.
- Binaires `+ - * /` : deux opérandes numériques du **même** type, résultat de ce type. Division entière tronquée vers zéro, sans promotion ; par exemple `short int / short int` reste `short int`.
- `%` : entiers du même type ; reste associé à la division tronquée vers zéro, avec le signe du dividende. Division et reste par zéro interdits. Pas de rebouclage en cas de dépassement.
- `< <= > >=` : mêmes types numériques, résultat `boolean`. `== !=` : même primitif non `void`, résultat `boolean`. Pas de comparaison de signatures de fonctions.
- `and/or`, `not` : booléens uniquement. Signe unaire `+` : numérique ; `-` : numérique signé uniquement, donc interdit pour `short uint` et `uint`. Le résultat conserve le type, y compris les bornes.
- Pas d'arithmétique sur booléens/caractères, concaténation de chaînes ou comparaison ordonnée de textes.
- Conditions `if/while/for` : `boolean` uniquement. Le nombre et les types des arguments de `CallExpression` doivent correspondre exactement à la signature ; un appel invalide n'obtient pas le type de retour comme secours.
- `void` est interdit pour variables, constantes, paramètres, alias, littéraux et conversions. Un appel `void` peut former une `ExpressionStatement`, mais ne peut fournir une valeur. Une fonction `void` accepte `return` sans argument, jamais un retour avec expression.
- Une fonction non `void` doit retourner la bonne valeur sur tous les chemins démontrés par le vérificateur simple : retour direct, séquence de blocs, ou deux branches d'un `if`. Les boucles ne prouvent pas à elles seules le retour ; les cas non prouvés sont refusés conservativement. Aucune exécution de condition ni simulation.

### Conversions explicites

`CastExpression` porte `properties.type` (cible) et `children.argument`. Les conversions entre les six primitifs numériques sont permises, ainsi que l'identité d'un primitif non vide. Pas de conversion chaîne/nombre, booléen/nombre ou char/string.

Vers un entier : troncature de la partie fractionnaire vers zéro, puis contrôle exact du domaine cible. Une valeur négative entière ne passe pas en non signé et une réduction de largeur ne reboucle pas. Vers un flottant : arrondi IEEE 754 à sa précision ; la perte de précision est acceptée parce que demandée explicitement, mais dépassement ou sous-flux vers zéro restent des erreurs. Les conversions implicites équivalentes restent interdites.

### Portée de la vérification numérique

`numericConstants.js` vérifie uniquement les expressions constantes (littéraux, opérations, conversions et références de constantes dont l'initialiseur est prouvé constant), sans appeler de fonction ni exécuter de boucle. Les cycles constants et les profondeurs excessives sont diagnostiqués. Les initialiseurs de variables ne sont pas propagés comme constantes, pour ne pas ignorer des mutations.

Les types des expressions non constantes sont entièrement statiques, mais leurs bornes à l'exécution ne sont pas prouvées globalement. Les futurs interprètes/générateurs devront respecter les mêmes domaines, arrondis et opérations contrôlées, refuser division par zéro, sous-flux vers zéro et débordement, **sans wrap ni comportement dépendant de la cible**. Aucun moteur d'exécution, analyse d'intervalles ou générateur n'est introduit ici ; `canGenerate` n'est pas une preuve de sûreté de toutes les valeurs futures.

### Simulation locale

`simulateProgram(project, {maxSteps?})` est une exécution locale déterministe, séparée de React, du DOM, de Neutralinojs et de tout accès réseau. Elle exige une analyse sans diagnostic bloquant et une fonction marquée `properties.entryPoint: true` sans paramètre d'entrée. La première tranche prend en charge les littéraux, références, opérations, conversions transparentes, appels, déclarations, affectations, `if`, `while`, `for`, `return`, `break`, `continue`, expressions et `PrintStatement`.

La simulation écrit uniquement dans un résultat mémoire `{ok, output, trace, result?, steps, error?}` ; elle ne modifie pas la source et n'enregistre rien. `trace` est une liste ordonnée d'identifiants de nœuds effectivement visités, y compris les expressions évaluées et les répétitions de boucle ou d'appel. Elle permet à l'interface de présenter une exécution progressive sans déplacer ni modifier les données de présentation persistées. `maxSteps` protège l'interface contre les boucles non terminantes. Les bornes runtime avancées, les entrées interactives, les effets de fichier, l'ordonnancement et la génération de code restent hors de ce premier incrément.

## Diagnostics et tolérance

Forme : `{code, severity, message, location:{projectId, moduleId, nodeId, field}}`. Les identifiants inapplicables valent `null`. Les messages techniques sont en français ; une future UI anglaise pourra localiser les codes sans parser ces messages.

Un lien syntaxique manquant devient un `Hole` ; un cycle, parent multiple, lien étranger ou identifiant absent produit un `Invalid`. La source complète est toujours conservée dans le résultat, y compris les enregistrements dupliqués ou malformés qui ne peuvent pas devenir des nœuds AST. Les fragments non rattachés sont présents dans `detachedNodes`, les propriétaires absents dans `unassignedNodes`. Tous ces défauts bloquent `canGenerate`, mais pas l'inspection. Ce booléen n'est pas une garantie d'exécutabilité.

Limites de sécurité : profondeur syntaxique et de dépendances de types autour de 200 niveaux, avec diagnostic plutôt qu'un débordement de pile ; sérialisation JSON également bornée à 200 niveaux. Proxies hostiles, accesseurs arbitraires pendant l'analyse et quotas globaux mémoire/temps ne font pas partie du contrat de données JSON. La sérialisation refuse les accesseurs sans les appeler.

## Exemple exécutable et extensions

`tests/logic/fixtures.js` expose `twoModules()` : `math` exporte la constante `answer = 42`, `app` l'importe sous `answerImport` et initialise `result` par une référence à cet import.

```js
import { analyzeProgram, serializeSource } from './src/utils/logic/index.js'
import { twoModules } from './tests/logic/fixtures.js'

const result = analyzeProgram(twoModules())
// result.ast.modules[1].body[0].children.initializer.kind === 'Reference'
// result.semantic.references[0].symbolId désigne le symbole importé.
const saved = serializeSource(result.source)
```

Une intégration est désormais en place : les cartes Module partagent l'identifiant de leur module source, les coordonnées/tailles restent dans un état de présentation séparé, et les annotations Comment restent hors du moteur. Les identifiants de nœuds sont des UUID stables fournis par l'interface. La case « Entry point » est proposée à la création et à l'édition d'une fonction ; lorsqu'une autre fonction est marquée, il faut d'abord retirer son rôle. Un badge textuel identifie le point d'entrée dans l'arbre.

### Insertion contextuelle

`getAvailableActions` déduit les constructions insérables du schéma (`nodeSchema`) et du contexte lexical, jamais d'une liste codée en dur. Les modules utilisent `rootNodeIds` ; les autres nœuds utilisent `children`. Les slots sont proposés avant les constructions ; un slot unique occupé ou malformé n'est pas remplaçable. `placement.js` partage les restrictions lexicales avec le validateur : fonctions et types aux racines du module, paramètres dans une liste de fonction, `return` dans une fonction, `break`/`continue` dans une boucle.

Le bouton unique « + » en haut à droite ouvre exactement ce menu, ancré sous son déclencheur ; le clic droit demeure disponible. Le menu du module expose aussi la suppression confirmée du module entier. Les annotations Comment ont un menu de suppression de présentation distinct, sans appel au moteur logique.

Les formulaires de création de conditions et d'initialiseurs peuvent construire un brouillon récursif complet (comparaison/binaire, unaire, appel avec arguments, conversion explicite, littéral, référence). `nodeConfiguration.js` réutilise les catalogues d'opérateurs et les règles de types pour produire un bundle unique ; aucune annotation de secours ni conversion implicite. Les paramètres d'appel sont explicitement typés par la signature résolue, et les arguments incomplets deviennent des `Hole`, jamais des valeurs inventées. L'imbrication du formulaire est limitée à six niveaux ; les slots restent éditables ensuite. Aucune édition implicite des enfants existants : ce raccourci concerne la création, et la validation atomique du moteur demeure l'autorité.

`createNodeBundle` construit uniquement de nouveaux enregistrements ; `insertSourceNodes` vérifie le slot, l'appartenance au module, l'unicité des identifiants, l'absence d'enfant existant, le type attendu et les nouvelles erreurs dures après réanalyse, dont les marqueurs de point d'entrée invalides ou dupliqués. Un échec renvoie la source inchangée. `updateSourceNode` ne modifie que `properties`/`references` et conserve les enfants ; une nouvelle désignation en doublon est refusée avec `ENTRY_POINT_DUPLICATE` et la source inchangée. Les doublons déjà présents restent éditables pour correction. Retirer le marqueur, supprimer la fonction ou son module libère le rôle. Les états incomplets (littéral sans valeur, appel partiel, retour sans argument) restent acceptés mais laissent `canGenerate` faux.

### Suppression

`deleteSourceNodes(project, targetId, {index})` exige une cible `{kind:'node', id}` reliée à un parent unique et refuse les modules (`MODULE_NOT_DELETABLE`), les identifiants absents ou ambigus, les nœuds détachés et les parents ambigus, en renvoyant la source d'origine. En cas de succès, le nœud et tous ses descendants syntaxiques sont retirés du tableau `nodes` ; son entrée est déliée du parent (slot unique remis à `null`, entrée filtrée dans une liste). Aucun autre identifiant, ordre ou référence n'est réécrit. Les références pointant vers un nœud supprimé restent dans la source et produisent `REFERENCE_UNRESOLVED` à la réanalyse. `selection` indique le parent logique (nœud ou module) à sélectionner dans l'interface. Aucune annulation ; le retrait d'un module entier relève de `deleteSourceModule`.

```js
import { deleteSourceNodes } from './src/utils/logic/index.js'

const removed = deleteSourceNodes(project, { kind: 'node', id: 'literal-id' }, { index })
// removed.ok === true ; removed.removedNodeIds, removed.selection et removed.analysis sont à jour.
```

```js
import { createContextIndex, resolveContext, getAvailableActions, createNodeBundle, insertSourceNodes, primitiveType } from './src/utils/logic/index.js'

const index = createContextIndex(project, analysis)
const actions = getAvailableActions(project, 'module-id', 'rootNodeIds', { index })
const context = resolveContext(project, 'module-id', 'rootNodeIds', index)
const bundle = createNodeBundle(context.moduleId, { kind: 'VariableDeclaration', properties: { name: 'count', type: primitiveType('int') } }, () => crypto.randomUUID())
const inserted = insertSourceNodes(project, { targetId: 'module-id', slot: 'rootNodeIds' }, bundle, { index })
// inserted.ok === true ; inserted.analysis contient les diagnostics à jour.
```

La simulation locale consomme l'analyse validée et les identifiants source. Suggestions et codegen restent absents ; aucune interface de plugin spéculative ajoutée.

### Simulation locale

`simulateProgram(project, {maxSteps = 10000})` retourne `ok`, `output` (lignes de texte) et `trace` (identifiants source dans l'ordre d'exécution), puis `result`/`steps` en cas de succès ou `error` et `errorCode` en cas d'échec. `error` reste un message technique compatible avec les consommateurs existants ; l'UI traduit `errorCode`, sans analyser ce texte ni introduire de langue dans le moteur. Les diagnostics bloquants, l'absence de point d'entrée ou un point d'entrée paramétré empêchent le lancement. Le résultat scalaire entier public est un nombre JavaScript exact dans les bornes des types autorisés ; les calculs entiers internes utilisent BigInt.

Les littéraux, calculs et conversions réutilisent les contrôles de `numericConstants.js` : division entière tronquée, division flottante préservée, arrondi binaire32 à chaque opération, dépassement/sous-flux et division par zéro refusés. `and`/`or` court-circuitent. Une variable sans initialiseur ne reçoit aucune valeur implicite et sa lecture échoue. Les alias de types ne sont pas exécutés. Les appels ont leur environnement propre relié aux variables globales, jamais à celui de l'appelant ; blocs et boucles recréent leurs variables locales.

Le budget accepte un entier de 1 à 100 000 ; même un `for` sans condition ni corps consomme ce budget. La profondeur d'appel est bornée à 200 avant débordement de pile. L'initialisation globale suit l'ordre source des modules et racines ; pas de tri automatique des dépendances. Sorties et trace restent en mémoire ; aucun input, fichier, réseau, génération de code ou effet natif depuis le moteur. L'animation UI est une relecture de cette trace calculée, pas une exécution asynchrone ni un débogueur.

## Transpilation

`transpileProgram(project, {target: 'javascript'})` réutilise `analyzeProgram()` puis délègue la génération à un backend enregistré. La première cible est JavaScript, produite dans un fichier unique sans `import` ni `export`. Les déclarations de modules et de fonctions sont écrites avant `main()`, l'initialisation globale est exécutée dans `main()`, puis le point d'entrée Sapphire marqué `properties.entryPoint: true` est appelé. Le backend exige exactement un point d'entrée et renvoie des diagnostics stables sans modifier la source.

Le backend JavaScript couvre le sous-ensemble des constructions du schéma logique déjà prises en charge par la simulation : déclarations, fonctions, paramètres, blocs, retours, affichage via `console.log`, conditions, boucles, affectations, appels, opérateurs, littéraux, références et conversions numériques explicites. Les noms générés, paramètres compris, sont déterministes et désambiguïsés dans le fichier unique. Les tableaux ne font pas partie de cette première version et produisent un diagnostic lorsqu'ils seront ajoutés au modèle.

Les diagnostics bloquants empêchent toute génération ; un point d'entrée paramétré est refusé plutôt qu'appelé sans arguments. Les opérations numériques autonomes embarquées proviennent de `createNumericOperations` dans `numericConstants.js`, sans seconde implémentation : BigInt pour les entiers, arrondi binaire32, conversions, dépassements, sous-flux et division par zéro identiques au simulateur. Les littéraux sont validés et normalisés avant émission (zéros initiaux, signes, arrondi décimal direct et zéro flottant signé). Les sorties utilisent `String` pour ne pas afficher le suffixe BigInt. Une sentinelle interdit la lecture d'une variable non initialisée. Les constantes globales utilisent une liaison JavaScript différée, leur immutabilité restant contrôlée par l'analyse Sapphire. Le fichier produit n'embarque pas les budgets de pas ou d'appels du simulateur et n'est jamais exécuté automatiquement par l'application.

### Inspection ciblée et graphes

`transpilationLanguages` centralise les identifiants et libellés des cibles présentées dans l'interface : JavaScript actif ; Python, C, C++ et Java indisponibles. `getTranspilationTargets()` reste limité aux backends réellement installés. `transpileSelection(project, {kind: 'node' | 'module', id}, {target = 'javascript', analysis?})` retourne `{ok, code, diagnostics}` pour un extrait de consultation, via le même émetteur que le programme complet. Aucun point d'entrée exigé. Les erreurs du sous-arbre empêchent l'aperçu ; les erreurs d'un autre sous-arbre ne le bloquent pas. Un paramètre est représenté par son identifiant généré et un alias de type n'émet pas de code runtime. L'extrait n'est pas un fichier autonome : les helpers numériques et les déclarations englobantes ne sont pas inclus. Aucune exécution ni mutation de la source.

`buildDependencyGraph(project, target, index?)` décrit les descendants syntaxiques de la cible et leurs relations directes. Les sommets portent leurs identifiants source ; les arêtes distinguent `contains`, `reads`, `writes`, `calls` et `type`. Les références sont celles de l'analyse sémantique, imports et alias compris, jamais une seconde résolution des noms. Les références/appels entrants vers le sous-arbre sont également conservés ; les sommets extérieurs sont marqués `external`. Les références non résolues restent signalées par `unresolvedNodeIds`. Pas de fermeture transitive des fonctions appelées.

`buildControlFlowGraph(project, target, index?)` décrit le CFG de la fonction englobante, ou les initialiseurs/instructions racines du module lorsque la cible n'est pas dans une fonction. Sommets d'entrée/sortie synthétiques sans collision avec la source, séquences, conditions, boucles `while`/`for` (initialiseur et update séparés), retours, `break` et `continue` vers la boucle la plus proche. Les expressions et appels sont atomiques ; aucune arête interprocédurale ni décomposition du court-circuit. Les deux branches d'une condition sont conservées sans interprétation des valeurs ; `reachable` indique seulement l'existence d'un chemin depuis l'entrée dans ce graphe conservateur. Les instructions après retour restent représentées, mais déconnectées. Les fragments incomplets donnent `incomplete`, les contextes ambigus un échec contrôlé. Les deux fonctions renvoient `{ok, rootId, rootKind, nodes, edges, ...}` et sont pures, indépendantes de React et du rendu SVG.

## Debug SP3 et accessibilité

`analyzeReachability(project, analysis?)` retourne `{ok, reachableNodeIds, unreachableNodeIds, functions}`. Chaque entrée de `functions` contient `{nodeId, reachable}`. L'analyse part de l'initialisation globale et du point d'entrée explicite, suit les cibles d'appels résolues (imports et récursion compris) et n'exécute aucune fonction. Elle exclut les fonctions non appelées, les branches et corps de boucles impossibles selon des booléens littéraux/combinaisons `not`/`and`/`or`, les opérandes court-circuités et les instructions après un transfert certain. `break` et `continue` sont consommés par leur propre boucle ; une boucle certainement infinie sans sortie rend sa suite inaccessible.

L'analyse est conservatrice : pas de preuve générale sur les valeurs des variables, les comparaisons numériques, les dépendances globales ou la terminaison des appels. Une condition inconnue garde tous les chemins possibles. **Non parcouru lors d'une simulation n'est pas synonyme d'inatteignable.** Les résultats sont informatifs, sans nouveaux diagnostics bloquants ni suppression de source. Si l'analyse source est bloquante, `ok` vaut `false` et les listes sont vides.

`createDebugSession(project, {maxSteps?})` prépare une trace déterministe et bornée avec le même interpréteur que `simulateProgram`. Il ne s'agit pas d'un deuxième moteur ni d'une exécution native suspendue : les états sont calculés avant la navigation, puis l'interface ne montre que l'arrêt courant. Le résultat contient `project`, `frames`, `cursor`, `history`, `reachability`, un éventuel `errorCode` empêchant le démarrage et le résultat technique `result` de la simulation. Un échec runtime reste dans le dernier état enregistré et n'est affiché qu'une fois cet arrêt atteint.

`moveDebugSession(session, action)` retourne une nouvelle session de navigation sans modifier la source, les états ni la session précédente :

- `next` : exécute l'instruction logique courante et s'arrête à la suivante ; entre dans les appels. Les conditions de boucle sont de nouveaux arrêts à chaque évaluation. Les sous-expressions scalaires ne sont pas des « lignes » séparées.
- `scope` : exécute normalement jusqu'à la sortie de l'activation du scope courant, appels et boucles imbriqués compris. Pendant l'initialisation globale sans scope local, s'arrête à la première entrée de fonction. N'ignore aucune instruction. Si une erreur interrompt le scope, s'arrête sur cette erreur.
- `back` : restaure exactement le précédent arrêt choisi par l'utilisateur, y compris avant une sortie de scope groupée, avec ses valeurs et sorties. Ce n'est pas l'undo du document.
- `restart` : revient au premier arrêt de la session et vide l'historique de navigation. Sans effet si la session est déjà à ce premier arrêt sans historique.

Chaque frame contient `nodeId`, `status` (`paused`, `completed`, `error`), `errorCode`, `scopeIds`, `callStack`, `globals`, `localScopes` et `output`. Un arrêt `paused` précède l'instruction indiquée. Chaque variable expose `nodeId`, `moduleId`, `name`, `type`, `initialized` et, si initialisée, sa valeur scalaire ; les entiers internes BigInt sont convertis exactement dans les bornes des types source. Le zéro signé flottant est conservé. Une variable sans initialiseur n'a pas de valeur inventée.

Les scopes portent un identifiant d'activation distinct du nœud source : récursions et itérations ne partagent pas leur mémoire locale. Les paramètres et le corps d'une fonction partagent sa portée statique ; le corps d'une boucle a une nouvelle activation à chaque itération. `localScopes` ne comprend que la chaîne lexicale active de la fonction courante, jamais les locaux de l'appelant. Les locaux disparaissent après leur scope et à la terminaison normale ; ils restent inspectables au point d'une erreur runtime.

`simulateProgram(project, {captureDebug:true})` fournit ces captures dans `debugFrames` ; l'option est utilisée par `createDebugSession`. Sans cette option, son contrat de résultat et sa trace habituelle restent inchangés. Le budget d'exécution et la profondeur d'appel restent ceux de la simulation. La rétention est en outre bornée à 200 000 entrées d'instantanés (variables, scopes, références de sorties et arrêts cumulés), puis produit `DEBUG_HISTORY_LIMIT` et un unique état terminal. Les états déjà enregistrés restent réversibles. Les chaînes sont immuables, les Map runtime ne sont jamais exposées dans les snapshots.

L'UI ferme le debug dès une modification de source, un undo/redo source ou un import ; les changements purement visuels ne l'invalident pas. Mémoire, trace, historique de debug, position et dimensions du panneau ne sont pas enregistrés dans le workspace. Le dépliage d'exécution reste temporaire. Le panneau de propriétés suit le bloc exécuté pendant la simulation et le debug, sans changer sa position. La future vue graphique compacte reste seulement annoncée par deux actions désactivées.

## Vérification et documentation compilée

`pnpm test` : runner natif Node, sans dépendance de test. Les tests couvrent les scénarios valides, invalides et incomplets, les localisations, les identifiants, la conservation JSON, la non-mutation, l'indépendance des imports du moteur et l'API contextuelle (actions, factory, mutations atomiques, suppression, cache). `pnpm build` vérifie que le frontend compile avec l'intégration ; les passes du moteur sont vérifiées par les tests Node, pas par le build.

Rapport court : `ARCHITECTURE_AST.tex` et `ARCHITECTURE_AST.pdf` à la racine. Compilation reproductible avec le script `pnpm docs:ast` (MiKTeX/pdfLaTeX installé requis). Les fichiers auxiliaires restent dans `build/latex/`, ignoré par Git.

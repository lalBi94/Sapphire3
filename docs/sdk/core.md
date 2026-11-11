# SDK Core Sapphire 3

`@sapphire3/core` est le SDK JavaScript ESM du moteur logique de Sapphire 3. Il permet de créer, lire, modifier, inspecter et analyser un programme sans React, DOM, Neutralinojs ni accès natif.

Le package réutilise directement `src/utils/logic/` : aucune règle d'analyse, de portée, de typage ou de sérialisation n'est réimplémentée dans le SDK.

## Statut et versionnement

- Package : `@sapphire3/core`, version `0.1.0`.
- Contrat public : `SDK_API_VERSION = 1`.
- Versionnement SemVer : correctif pour une correction compatible, mineure pour un ajout compatible, majeure pour une rupture. Toute rupture incrémente aussi `SDK_API_VERSION`.
- Le package est `private: true` dans le dépôt : il n'est pas publié sur npm. Il reste installable depuis une archive locale `npm pack`.

## Installation

### Depuis le monorepo

```sh
pnpm install
pnpm --filter @sapphire3/core build
```

Le package est lié dans le workspace sous le nom `@sapphire3/core`.

### Depuis une archive locale

```sh
pnpm --filter @sapphire3/core build
pnpm --filter @sapphire3/core run pack
```

L'archive est écrite dans `build/sdk/sapphire3-core-0.1.0.tgz`.

Puis, dans un projet Node.js distinct :

```sh
npm install /chemin/vers/sapphire3-core-0.1.0.tgz
```

Le projet consommateur n'a besoin d'aucune dépendance runtime supplémentaire.

## Démarrage rapide

```js
import {
  addFunction,
  addModule,
  analyze,
  createProject,
  drafts,
  types,
} from '@sapphire3/core'

let project = createProject('demo')
project = addModule(project, { id: 'app', name: 'App' }).project

const result = addFunction(project, 'app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [
    drafts.variable('answer', types.int, drafts.literal(types.int, 42)),
    drafts.print(drafts.reference('answer')),
  ],
})

if (!result.ok) throw new Error(result.code)
console.log(result.analysis.canGenerate) // true
console.log(result.analysis.symbols.map((symbol) => symbol.name))
```

## Création

### Projets, modules et classes

```js
import { addClass, addModule, createClass, createModule, createProject } from '@sapphire3/core'

const project = createProject('demo')
const module = createModule('app', 'App')
const klass = createClass('counter', 'Counter')

const withModule = addModule(project, { id: 'app', name: 'App' })
const withClass = addClass(withModule.project, { id: 'counter', name: 'Counter' })
```

`addModule` et `addClass` retournent `{ ok, project, module, analysis, diagnostics }` sans muter le projet d'origine.

### Nœuds déclaratifs

`createNodeBundle(moduleId, draft, idFactory)` transforme un brouillon en nœuds source avec des identifiants neufs. `createIdFactory(project, prefix)` évite les collisions.

```js
import { createIdFactory, createNodeBundle, drafts, types } from '@sapphire3/core'

const bundle = createNodeBundle('app', drafts.functionDeclaration({
  name: 'doubleIt',
  returnType: types.int,
  parameters: [{ name: 'value', type: types.int }],
  body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
}), createIdFactory(project, 'app-fn'))

if (!bundle.ok) throw new Error(bundle.code)
```

Les brouillons couvrent notamment :

- `literal`, `reference`, `importReference`, `nodeReference` ;
- `parameter`, `variable`, `constant`, `typeAlias` ;
- `block`, `functionDeclaration`, `constructorDeclaration`, `methodDeclaration` ;
- `print`, `returnStatement`, `call`, `binary`, `unary`, `assignment`, `expressionStatement` ;
- `ifStatement`, `whileStatement`, `forStatement` ;
- `lambda`, `thisExpression`, `member`, `newExpression` ;
- `arrayLiteral`, `arrayCreation`, `arrayAccess`.

### Ajout direct

```js
import { addConstructor, addFunction, addMethod, addVariable } from '@sapphire3/core'

const withFunction = addFunction(project, 'app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [],
})

const withField = addVariable(project, 'counter', {
  name: 'value',
  type: types.int,
  initializer: drafts.literal(types.int, 0),
}, { visibility: 'public' })

const withMethod = addMethod(project, 'counter', {
  name: 'increment',
  returnType: types.void,
  body: [],
})

const withConstructor = addConstructor(project, 'counter', {
  parameters: [{ name: 'start', type: types.int }],
  body: [],
})
```

`addFunction`, `addVariable` et `addConstant` détectent une classe et ajoutent le membre avec sa visibilité. `addClassMember` accepte n'importe quel brouillon de membre.

## Types

Les types canoniques sont disponibles via `types` et les constructeurs exportés.

```js
import { arrayType, classType, functionType, pointerType, types } from '@sapphire3/core'

types.int
types.string
types.void
pointerType(types.int)
arrayType(types.int)
functionType([types.int], types.int)
classType('counter', 'Counter')
```

`primitiveType`, `sameType` et `typeFromRecord` sont également exportés.

## Analyse

```js
import { analyze, assertValid, buildAst, validate } from '@sapphire3/core'

const analysis = analyze(project)
analysis.canGenerate
analysis.diagnostics
analysis.ast
analysis.scopes
analysis.symbols
analysis.references
analysis.nodeTypes
analysis.genericCalls
analysis.untypedNodeIds
analysis.classes
analysis.classMembers
```

`analyze` retourne un objet public sérialisable, sans exposer les `Map` internes. `validate` ne retourne que `{ ok, canGenerate, diagnostics }`. `buildAst` construit uniquement l'AST syntaxique. `assertValid` lève une `SapphireError` si un diagnostic est bloquant.

## Manipulation

Les opérations sont atomiques : un refus retourne le projet d'origine et un code stable.

```js
import {
  deleteNode,
  duplicateNode,
  insertNodes,
  moveNode,
  renameSymbol,
  reorderNode,
  updateNode,
} from '@sapphire3/core'

const inserted = insertNodes(project, { targetId: { kind: 'node', id: blockId }, slot: 'statements' }, bundle)
const renamed = renameSymbol(project, parameterId, 'x')
const moved = moveNode(project, nodeId, { kind: 'module', id: 'app' })
const duplicated = duplicateNode(project, nodeId)
const deleted = deleteNode(project, nodeId)
```

Opérations disponibles :

- `insertNodes` / `insertNode` ;
- `updateNode` ;
- `deleteNodes` / `deleteNode`, `deleteModule`, `deleteTargets` ;
- `reorderNode` ;
- `renameSymbol` ;
- `moveNode`, `moveNodes` ;
- `duplicateNode`, `duplicateTargets` ;
- `setNodeContracts` ;
- `setExport`, `addImport`, `removeImport`, `ensureImports`.

Chaque résultat contient au minimum `{ ok, project, diagnostics }`, et `analysis` en cas de succès.

## Inspection

```js
import { getModuleInfo, getNodeType, inspectNode, listSymbols, summarize } from '@sapphire3/core'

const inspection = inspectNode(project, nodeId)
inspection.node
inspection.astNode
inspection.parent
inspection.type
inspection.symbol
inspection.references
inspection.referencesTo

const moduleInfo = getModuleInfo(project, 'counter')
moduleInfo.imports
moduleInfo.exports
moduleInfo.symbols
moduleInfo.members
moduleInfo.constructor

summarize(project)
```

`inspectNode` expose le nœud, son parent syntaxique, son type résolu, son symbole, ses références sortantes et entrantes. `getModuleInfo` expose les imports, exports, symboles, fonctions et membres de classe. `summarize` produit un résumé sérialisable pour les outils.

## Sérialisation logique

```js
import { deserializeProject, serializeProject } from '@sapphire3/core'

const written = serializeProject(project)
if (!written.ok) throw new Error(written.code)

const read = deserializeProject(written.json)
if (!read.ok) throw new Error(read.code)
read.project
read.analysis
read.diagnostics
```

Le SDK sérialise le modèle source versionné (`formatVersion: 1`), distinct de l'enveloppe workspace de l'interface. `deserializeProject` lit le document même si le programme contient des erreurs sémantiques ; `analysis.canGenerate` indique alors s'il est exploitable.

## Erreurs

Les mutations retournent un résultat avec un code stable. Les helpers `assertResult` et `assertValid` permettent un style par exception.

```js
import { SapphireError, assertResult, isSapphireError } from '@sapphire3/core'

const result = addFunction(project, 'missing', { name: 'nope', returnType: types.void, body: [] })
if (!result.ok) {
  console.log(result.code) // TARGET_MISSING
}

try {
  assertResult(result)
} catch (error) {
  if (isSapphireError(error)) console.log(error.code, error.diagnostics)
}
```

`SapphireError` porte `code`, `diagnostics`, `details` et `toJSON()`. Les codes du moteur restent ceux de `diagnosticCodes` ; le SDK ajoute `SDK_INVALID_ARGUMENT`, `SDK_INVALID_PROJECT`, `SDK_OPERATION_FAILED`, `SDK_PROGRAM_INVALID` et `SERIALIZATION_INVALID`.

## Classes

Les classes existantes du moteur sont prises en charge :

- module `kind: 'class'` ;
- champs et constantes avec `visibility` `public`/`private` ;
- constructeur unique `constructor` ;
- méthodes et `this` ;
- `new`, `MemberExpression`, `ThisExpression` ;
- inspection via `analysis.classMembers`, `getModuleInfo(...).members` et `listClassMembers`.

```js
import { addClass, addConstructor, addMethod, addVariable, drafts, types } from '@sapphire3/core'

const withClass = addClass(project, { id: 'counter', name: 'Counter' })
const withField = addVariable(withClass.project, 'counter', {
  name: 'value',
  type: types.int,
  initializer: drafts.literal(types.int, 0),
}, { visibility: 'private' })
```

## Limites

- Le SDK ne dépend ni de React, ni du DOM, ni de Neutralinojs.
- Aucun état global mutable n'est partagé entre projets : chaque opération retourne un nouveau projet.
- Les structures internes instables (`Map` d'index, caches d'analyse) ne sont pas exposées.
- Le SDK ne remplace pas les backends de transpilation ; il fournit le modèle, l'analyse, la validation, l'inspection et la sérialisation logique.
- Le contrat de classes reste celui du moteur : pas d'héritage ni de polymorphisme.

## Vérifications

```sh
pnpm --filter @sapphire3/core build
node --test tests/sdk/core.test.js
node --test tests/sdk/packaging.test.js
```

Les tests SDK couvrent la création, l'analyse, les symboles, le renommage, la suppression, la duplication, les classes, la transpilation d'un projet construit par le SDK, la sérialisation et l'installation réelle de l'archive `npm pack` dans un projet externe.

## Exemples

- `examples/sdk/create-and-analyze.mjs`
- `examples/sdk/modify-program.mjs`

Ils s'exécutent après `pnpm --filter @sapphire3/core build` :

```sh
node examples/sdk/create-and-analyze.mjs
node examples/sdk/modify-program.mjs
```

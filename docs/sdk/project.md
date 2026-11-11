# Project SDK Sapphire 3

`@sapphire3/project` permet à une application, un agent IA ou un outil externe
de créer, charger, valider, modifier et exporter un workspace Sapphire 3
complet sans lancer l'IDE.

Le SDK réutilise directement :

- `@sapphire3/core` pour l'analyse, les mutations et la sérialisation logique ;
- `src/utils/workspaceFile.js` pour le format workspace versionné, les
  migrations et la validation structurelle ;
- `src/utils/workspaceArchive.js` pour les archives ZIP à store ;
- `src/utils/embeddedImage.js` pour les Data URL et les références `images/` ;
- `src/utils/moduleTypes.js` pour les cartes et leurs dimensions.

Aucun second format `.sp3`, aucun second analyseur et aucune dépendance à
React, au DOM ou à Neutralinojs ne sont introduits.

## Statut et versionnement

- Package : `@sapphire3/project`, version `0.1.0`.
- Contrat public : `PROJECT_API_VERSION = 1`.
- Workspace courant : `WORKSPACE_VERSION = 3`.
- Format logique : `PROJECT_FORMAT_VERSION = 1`.
- Package `private: true` dans le dépôt : aucune publication npm. L'archive
  locale reste installable via `npm pack`.
- Les projets créés par `@sapphire3/core` sont acceptés directement.

## Construction et installation

```sh
pnpm install
pnpm --filter @sapphire3/project build
pnpm --filter @sapphire3/project run pack
```

L'archive est écrite dans `build/sdk/sapphire3-project-0.1.0.tgz`. Dans un
projet externe :

```sh
npm install /chemin/vers/build/sdk/sapphire3-project-0.1.0.tgz
```

Le package n'a aucune dépendance runtime : le Core SDK est embarqué dans le
build Vite.

## Projet logique et workspace

Le **projet logique** est le JSON `formatVersion: 1` avec `modules` et `nodes`.
Il ne contient ni cartes, ni caméra, ni sélection.

Le **workspace** est le document `workspace.sp3` version 3 :

```json
{
  "application": "Sapphire 3",
  "workspaceVersion": 3,
  "project": { "formatVersion": 1, "id": "demo", "modules": [], "nodes": [] },
  "presentation": {
    "cards": [],
    "camera": { "x": 0, "y": 0, "zoomLevel": 0 },
    "selected": null
  }
}
```

Le SDK distingue les deux :

```js
import { loadWorkspace, loadProject } from '@sapphire3/project'

const workspace = loadWorkspace(text) // document complet
const project = loadProject(text)     // source logique seule
```

Alias disponibles : `createEmptyWorkspace` pour `createWorkspace`,
`parseWorkspace` pour `loadWorkspace` et `exportWorkspace` pour
`serializeWorkspace`. `WORKSPACE_DOCUMENT_NAME` vaut `workspace.sp3`.

Le format détaillé, les cartes, les images, les versions 1 et 2 et les règles de
validation restent décrits dans `docs/WORKSPACE_FILES.md`.

## Création

```js
import { createWorkspace } from '@sapphire3/project'

const workspace = createWorkspace({
  id: 'mon-projet',
  camera: { x: 0, y: 0, zoomLevel: 0 },
})
```

`createWorkspace` crée un workspace vide, sans dashboard ni exercice. Les
options `exercise`, `dashboard`, `metadata`, `presentationMetadata`,
`resources` et `extraFiles` sont disponibles.

### Modules et classes

```js
let result = workspace.addModule({
  id: 'app',
  name: 'App',
  x: 80,
  y: 80,
  width: 360,
  height: 240,
  emoji: '🚀',
})

const appWorkspace = result.workspace

result = appWorkspace.addClass({
  id: 'counter',
  name: 'Counter',
  x: 520,
  y: 80,
})
```

Une carte Module ou Class est créée avec la même identité que le module source.
Les positions, dimensions, emoji, `hidden` et `locked` sont des propriétés de
présentation. La largeur et la hauteur minimales du format sont appliquées par
la validation existante.

### Fonctions et nœuds

```js
import { drafts, types } from '@sapphire3/project'

let result = workspace.addFunction('app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [drafts.print(drafts.literal(types.int, 42))],
})

const functionId = result.nodeId
const next = result.workspace
```

Les définitions acceptent les brouillons déclaratifs du Core SDK. Le SDK
réexporte `drafts`, `types`, `moduleKinds`, `sourceFormatVersion`,
`createIdFactory`, `binaryOperators`, `diagnosticCodes` et `nodeSchema` pour
éviter un second vocabulaire.

Méthodes de nœuds : `addFunction`, `addMethod`, `addConstructor`,
`addVariable`, `addConstant`, `addClassMember`, `addNode`, `updateNode`,
`deleteNode`, `moveNode`, `reorderNode`, `renameSymbol`, `setNodeContracts`.

### Imports et exports

```js
let result = workspace.setExport('math', doubleId, true)
result = result.workspace.addImport('app', {
  id: 'doubleImport',
  moduleId: 'math',
  nodeId: doubleId,
  localName: 'double',
})
```

Les imports et exports utilisent les structures du format existant.

### Annotations

```js
result = workspace.addComment({ id: 'note', text: 'À revoir', x: 40, y: 420 })
result = result.workspace.addImage({
  id: 'diagramme',
  caption: 'Architecture',
  image: 'data:image/png;base64,...',
  x: 420,
  y: 420,
})
```

Les Comment et Image restent hors du modèle logique. Une Image accepte soit une
Data URL, soit une référence `images/<nom>.<extension>`, jamais les deux.

## Inspection

```js
workspace.getModule('app')
workspace.getNode(functionId)
workspace.getCard('app')
workspace.getNodeId('app', 'main')
workspace.listImageResources()
workspace.getImageResource('images/pic.png')
workspace.getMissingImageReferences()
workspace.listExtraFiles()
workspace.getExtraFile('docs/note.txt')
workspace.metadata
workspace.presentationMetadata
```

Les getters `project`, `presentation`, `cards`, `camera`, `selected`,
`exercise`, `dashboard`, `metadata` et `presentationMetadata` retournent des
copies gelées. Les ressources binaires sont copiées à la lecture.

## Manipulation atomique

Chaque méthode retourne :

```js
{
  ok: true,
  workspace,       // nouvel instantané
  code: null,
  message: null,
  diagnostics: [],
  object: { kind: 'node', id: '...' },
  nodeId,          // selon l'opération
}
```

En cas d'échec, `ok` vaut `false`, `workspace` reste l'instantané d'origine et
`object` identifie l'objet concerné. Les modifications qui touchent plusieurs
objets liés sont préparées puis validées ensemble :

- ajout d'un module et de sa carte ;
- suppression d'un module, de ses nœuds, de sa carte et des références de
  pliage ;
- renommage d'un module et de sa carte ;
- suppression d'un nœud et nettoyage des `expandedNodeIds` et de la sélection ;
- création ou promotion d'images avec leurs ressources.

```js
import { assertWorkspaceResult } from '@sapphire3/project'

const result = workspace.addModule({ id: 'lib', name: 'Library' })
const next = assertWorkspaceResult(result).workspace
```

## Constructeur déclaratif

`createWorkspaceBuilder` est l'interface recommandée aux agents IA. Les méthodes
retournent le builder pour le chaînage ; les échecs sont conservés dans
`builder.diagnostics` avec leur objet.

```js
import { createWorkspaceBuilder, drafts, types } from '@sapphire3/project'

const builder = createWorkspaceBuilder({ id: 'agent-demo' })
builder.addModule('app', { name: 'App', x: 0, y: 0 })
builder.addFunction('app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [drafts.print(drafts.literal(types.int, 42))],
})

const result = builder.build()
if (!result.ok) console.error(result.diagnostics)
const workspace = result.workspace
```

`build()` valide la structure et, par défaut, la sémantique du programme. Passer
`{ requireValidProgram: false }` conserve la structure et retourne les
diagnostics sémantiques sans bloquer. `buildOrThrow()` et `toJSON()` lèvent une
`ProjectError` si le workspace n'est pas valide.

Le builder résout aussi les imports et exports par nom :

```js
builder.addFunction('math', { name: 'double', ... })
builder.setExport('math', 'double')
builder.addImport('app', { id: 'doubleImport', moduleId: 'math', nodeName: 'double', localName: 'double' })
```

## Validation

```js
const validation = workspace.validate()
validation.structural // structure, cartes, images, JSON
validation.semantic   // nœuds, types et références via Core
validation.diagnostics
```

La validation structurelle et la validation sémantique restent séparées. Un
workspace peut être structurellement ouvrable mais sémantiquement incomplet,
comme le permet déjà l'application. Le builder exige les deux par défaut.

`validateProject(project)` retourne uniquement l'analyse sémantique du Core.

## Lecture et sérialisation

```js
import {
  loadWorkspace,
  loadProject,
  serializeWorkspace,
  serializeProject,
} from '@sapphire3/project'

const workspace = loadWorkspace(text)
const text2 = serializeWorkspace(workspace)
const projectText = serializeProject(workspace)
```

`loadWorkspace` accepte une chaîne JSON, des octets UTF-8, un objet workspace ou
un `ProjectWorkspace`. Les versions 1 et 2 sont migrées par le lecteur existant.
Les versions futures, le JSON illisible et les structures incohérentes sont
refusés avec les codes `WORKSPACE_*` existants.

`serializeWorkspace` produit le même document JSON canonique que
`serializeWorkspaceDocument`, avec deux espaces et sans perte des métadonnées
inconnues acceptées. `serializeProject` ne produit que la source logique.

### Conservation des données inconnues

Le SDK conserve :

- les clefs racine inconnues ;
- les clefs inconnues de `presentation` ;
- les champs inconnus des cartes, modules et nœuds ;
- `exercise` et `dashboard` lorsqu'ils sont présents ;
- les ressources d'images et les fichiers annexes d'archive.

Les champs historiques normalisés par les migrations existantes
(`generic`, `screenScale`) restent soumis aux règles du format.

## Images et archives

```js
import { buildWorkspaceArchive, readWorkspaceArchive } from '@sapphire3/project'

const bytes = buildWorkspaceArchive(workspace)
const { workspace: reopened, missingImages } = readWorkspaceArchive(bytes)
```

- `buildWorkspaceArchive` convertit les images intégrées en `images/`, inclut
  les ressources et les fichiers annexes, puis produit une archive ZIP à store.
- `readWorkspaceArchive` relit `workspace.sp3`, les images et les fichiers
  annexes. Les chemins absolus, les remontées `..`, les doublons et les
  extensions inconnues sont refusés.
- `loadWorkspaceArchive` retourne directement le workspace d'une archive.
- Par défaut, une image référencée mais absente lève `PROJECT_IMAGE_MISSING`.
  `{ strictImages: false }` permet de lire ou d'exporter partiellement en
  retournant `missingImages`.
- `promoteEmbeddedImages()` transforme les Data URL en références `images/` et
  conserve les octets dans l'instantané.

Les archives produites par l'application sont au format ZIP à store. Les
archives compressées ne sont pas prises en charge par le lecteur minimal
existant.

## Adaptateurs de stockage

Le SDK n'impose pas le système de fichiers Node.js. Un adaptateur fournit des
méthodes asynchrones ou synchrones :

```js
const adapter = {
  async readText(path) {},
  async writeText(path, text) {},
  async readBinary(path) {},
  async writeBinary(path, bytes) {},
}
```

Fonctions disponibles :

```js
loadWorkspaceFromStorage(adapter, { path: 'workspace.sp3' })
saveWorkspaceToStorage(adapter, workspace)
loadWorkspaceBundle(adapter, { strictImages: false })
saveWorkspaceBundle(adapter, workspace)
exportWorkspaceArchiveToStorage(adapter, workspace, { path: 'workspace.zip' })
loadWorkspaceArchiveFromStorage(adapter, { path: 'workspace.zip' })
```

`createMemoryStorage()` fournit un adaptateur en mémoire pour les tests, les
exemples et les agents. `saveWorkspaceBundle` préflighte les images, écrit les
ressources avant le document puis retourne `writtenImages` et `writtenFiles`.

## Erreurs

```js
import { ProjectError, PROJECT_ERROR_CODES, isProjectError } from '@sapphire3/project'
```

Codes propres au SDK :

- `PROJECT_INVALID_ARGUMENT` ;
- `PROJECT_WORKSPACE_INVALID`, `PROJECT_INVALID_PROJECT` ;
- `PROJECT_MODULE_NOT_FOUND`, `PROJECT_NODE_NOT_FOUND`, `PROJECT_CARD_NOT_FOUND` ;
- `PROJECT_DUPLICATE_ID`, `PROJECT_MUTATION_FAILED` ;
- `PROJECT_PROGRAM_INVALID`, `PROJECT_SERIALIZATION_INVALID` ;
- `PROJECT_IMAGE_MISSING`, `PROJECT_IMAGE_INVALID` ;
- `PROJECT_ARCHIVE_INVALID`, `PROJECT_ARCHIVE_UNSAFE_ENTRY` ;
- `PROJECT_STORAGE_MISSING`, `PROJECT_STORAGE_UNAVAILABLE` ;
- `PROJECT_UNSUPPORTED_INPUT`.

Les codes existants du format (`WORKSPACE_*`), de l'exercice
(`EXERCISE_INVALID`), du dashboard (`DASHBOARD_CONFIG_INVALID`) et du Core SDK
sont conservés. `toProjectError` normalise une erreur en `ProjectError` et
`projectDiagnostic` construit un diagnostic associé à un objet.

## Exemples

- `examples/project/generate-workspace.mjs` : deux modules, une classe, un
  import/export, une annotation, validation et sauvegarde mémoire.
- `examples/project/modify-workspace.mjs` : chargement d'un projet existant,
  ajout d'un module et d'une fonction, import/export, renommage, déplacement,
  annotation et round-trip.

```sh
pnpm --filter @sapphire3/project build
node examples/project/generate-workspace.mjs
node examples/project/modify-workspace.mjs
```

## Vérifications

```sh
pnpm project:test
pnpm project:pack
```

Les tests couvrent :

- création vide, modules, classes, cartes et annotations ;
- fonctions, nœuds, imports, exports, suppressions et nettoyage de présentation ;
- builder déclaratif, classe, import par nom et diagnostics associés ;
- round-trip, conservation des métadonnées inconnues, exercice et dashboard ;
- migrations versions 1 et 2, versions futures et structures corrompues ;
- images intégrées, promotion `images/`, archives ZIP et fichiers annexes ;
- adaptateurs de stockage, bundles et archives ;
- ouverture par `deserializeWorkspace` et `reduceDocument` de l'application ;
- erreurs typées et atomicité ;
- build Vite, `npm pack`, installation externe et génération depuis un projet
  Node.js autonome.

## Limites

- Le SDK ne remplace pas le moteur logique : la validation sémantique et les
  mutations restent celles du Core SDK.
- Les widgets spécialisés (Screen, Gauge, LED, etc.) restent préservés lors d'un
  round-trip, mais leur création n'est pas exposée par une fabrique dédiée.
- Les archives compressées ne sont pas lues ; le format d'archive de
  l'application est à store.
- Aucun accès réseau, aucun backend et aucune publication npm.

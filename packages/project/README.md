# @sapphire3/project

SDK JavaScript ESM pour créer, charger, valider, modifier et exporter des
workspaces Sapphire 3 complets, sans lancer l'IDE.

- Réutilise le Core SDK et le format workspace versionné existant.
- Distingue projet logique et workspace complet.
- Cartes, caméra, commentaires, images, exercice et dashboard préservés.
- Mutations atomiques et diagnostics associés aux objets.
- Builder déclaratif adapté aux agents IA.
- Archives ZIP à store et adaptateurs de stockage sans système de fichiers imposé.
- Aucune dépendance à React, au DOM ou à Neutralinojs.

## Construction

```sh
pnpm install
pnpm --filter @sapphire3/project build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/project run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-project-0.1.0.tgz
```

Le package n'a aucune dépendance runtime : le Core SDK est embarqué.

## Création déclarative

```js
import { createWorkspaceBuilder, drafts, types } from '@sapphire3/project'

const builder = createWorkspaceBuilder({ id: 'demo' })
builder.addModule('app', { name: 'App', x: 80, y: 80 })
builder.addFunction('app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [drafts.print(drafts.literal(types.int, 42))],
})

const result = builder.build()
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
const workspace = result.workspace
console.log(workspace.toJSON())
```

## Chargement et modification

```js
import { assertWorkspaceResult, loadWorkspace } from '@sapphire3/project'

let workspace = loadWorkspace(text)
workspace = assertWorkspaceResult(workspace.renameModule('app', 'Application')).workspace
workspace = assertWorkspaceResult(workspace.moveModule('app', { x: 400, y: 120 })).workspace
workspace = assertWorkspaceResult(workspace.addComment({ id: 'note', text: 'À revoir' })).workspace
```

Chaque méthode retourne `{ ok, workspace, code, diagnostics, object, ... }`.
En cas d'échec, le workspace d'origine est conservé.

## Validation

```js
const validation = workspace.validate()
console.log(validation.structural.ok, validation.semantic.ok, validation.diagnostics)
```

## Archives et stockage

```js
import {
  buildWorkspaceArchive,
  createMemoryStorage,
  loadWorkspaceBundle,
  readWorkspaceArchive,
  saveWorkspaceBundle,
} from '@sapphire3/project'

const bytes = buildWorkspaceArchive(workspace)
const { workspace: reopened, missingImages } = readWorkspaceArchive(bytes)

const storage = createMemoryStorage()
await saveWorkspaceBundle(storage, workspace)
const loaded = await loadWorkspaceBundle(storage, { strictImages: true })
```

Un adaptateur de stockage fournit `readText`, `writeText`, et éventuellement
`readBinary`/`writeBinary`. Aucun chemin Node.js n'est imposé.

## Documentation

La référence complète est dans `docs/sdk/project.md` du dépôt Sapphire 3.
Les définitions TypeScript publiques sont dans `types/index.d.ts`.

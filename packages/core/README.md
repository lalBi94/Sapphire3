# @sapphire3/core

SDK JavaScript ESM pour créer, lire, modifier, inspecter et analyser des
programmes Sapphire 3 sans ouvrir l'application.

- Aucun React, DOM, Neutralinojs ou accès natif.
- Aucun état global mutable partagé entre projets.
- Compatible Node.js 20.19+ et navigateurs modernes (ES2022).
- Moteur logique existant réutilisé, sans duplication des algorithmes.

## Construction locale

```sh
pnpm install
pnpm --filter @sapphire3/core build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/core build
pnpm --filter @sapphire3/core run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-core-0.1.0.tgz
```

## Démarrage

```js
import { createProject, addModule, addFunction, analyze, drafts, types } from '@sapphire3/core'

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
console.log(analyze(result.project).symbols.map((symbol) => symbol.name))
```

## Documentation

La référence complète est dans `docs/sdk/core.md` du dépôt Sapphire 3.
Les définitions TypeScript publiques sont dans `types/index.d.ts`.

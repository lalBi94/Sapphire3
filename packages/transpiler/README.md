# @sapphire3/Transpiler

SDK JavaScript ESM pour transpiler un projet Sapphire 3 vers JavaScript,
Python ou la cible C expérimentale, sans lancer l'IDE.

- Réutilise l'analyse sémantique et les backends existants.
- Aucun second AST, aucun second analyseur.
- Aucune exécution du code généré par le SDK.
- Diagnostics avec code stable et nœud source.
- Métadonnées de traçabilité lorsque les noms générés sont connus.

## Construction

```sh
pnpm install
pnpm --filter @sapphire3/Transpiler build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/Transpiler run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-Transpiler-0.1.0.tgz
```

## Compilation complète

```js
import { compile, getTargets } from '@sapphire3/Transpiler'

const result = compile(project, { target: 'javascript' })
if (!result.ok) throw new Error(result.diagnostics.map((entry) => entry.code).join(', '))
console.log(result.code)
console.log(result.metadata.entryPoint)
```

## Compilation partielle

```js
import { compileModule, compileSelection } from '@sapphire3/Transpiler'

const moduleResult = compileModule(project, 'app', { target: 'python' })
const functionResult = compileSelection(project, { kind: 'node', id: functionId }, { target: 'javascript' })
```

Les extraits sont des prévisualisations (`standalone: false`) et ne contiennent pas les helpers du fichier complet.

## Cibles

```js
getTargets()
```

JavaScript et Python sont stables. C est **expérimental**, avec un sous-ensemble
restreint, et n'est pas annoncé comme opérationnel. C++ et Java restent
indisponibles.

## Documentation

La référence complète est dans `docs/sdk/transpiler.md` du dépôt Sapphire 3.
Les définitions TypeScript publiques sont dans `types/index.d.ts`.

# @sapphire3/debug

SDK JavaScript ESM pour déboguer un programme Sapphire 3 à partir d'une trace
enregistrée, sans lancer l'IDE.

- Sessions indépendantes, positions, pile d'appels, portées, variables, widgets.
- Step Into, Step Next, Step Out, Step Out Scope, Continue, Restart et Step Back.
- Points d'arrêt par identifiant de nœud source.
- Événements structurés avec abonnement et désabonnement.
- Accessibilité, diagnostics et export de trace borné.
- Aucune dépendance à React, au DOM ou à Neutralinojs.

Le SDK est **fondé sur une trace**. Il ne suspend pas un interpréteur en cours
d'exécution et ne prétend pas fournir un débogage live. Chaque session calcule
la trace avec `simulateProgram(..., { captureDebug: true })` puis navigue dans
les frames enregistrées.

## Construction

```sh
pnpm install
pnpm --filter @sapphire3/debug build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/debug run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-debug-0.1.0.tgz
```

Le package n'a aucune dépendance runtime.

## Démarrage

```js
import { createDebugSession } from '@sapphire3/debug'

const session = createDebugSession(project, {
  breakpoints: ['nodeId'],
  maxSteps: 10000,
})

console.log(session.state().nodeId)
session.stepInto()
session.stepNext()
session.stepOut()
session.continue()
```

`createDebugSession()` accepte les options de simulation existantes
(`maxSteps`, `functionId`, `args`, `inputs`, `onProgress`) et deux options SDK :
`breakpoints` et `onEvent`.

## Commandes

| Méthode | Effet |
| --- | --- |
| `stepInto()` | Avance d'une frame, y compris dans un appel. |
| `stepNext()` | Avance d'une instruction en sautant les appels, sauf point d'arrêt. |
| `stepOut()` | Quitte la fonction ou la lambda courante, sauf point d'arrêt. |
| `stepOutScope()` | Quitte le scope lexical courant, comme « Finish scope ». |
| `continue()` | Reprend jusqu'au prochain point d'arrêt ou à la fin. |
| `stepBack()` | Restaure la position précédente de l'historique de navigation. |
| `restart()` | Revient à la première frame et vide l'historique. |

`stepNext()` et `stepOut()` s'appuient sur la pile réelle des activations de
fonctions et de lambdas. Un point d'arrêt rencontré dans une plage sautée
interrompt le saut. `stepBack()` ne rembobine pas arbitrairement la trace : il
utilise l'historique des positions visitées.

Toutes les commandes retournent un instantané `state()` gelé.

## Points d'arrêt

```js
session.addBreakpoint('nodeId')
session.setBreakpoints(['first', 'second'])
session.removeBreakpoint('nodeId')
session.clearBreakpoints()
session.getBreakpoints()
```

Les identifiants inconnus sont refusés avec `DEBUG_UNKNOWN_NODE`.

## Inspection

`state()` retourne notamment :

- `nodeId`, `currentNode`, `currentModule`, `currentClass`, `currentFunction` ;
- `callStack`, `scopes`, `globals`, `locals`, `parameters` ;
- `output`, `widgets`, `hasScreens` ;
- `instructionCount`, `navigationHistory`, `breakpoints` ;
- `lastStopReason`, `errorCode`, `error`, `terminal` ;
- les capacités `canStepInto`, `canStepNext`, `canStepOut`, `canStepBack`,
  `canContinue`, `canRestart`.

Les écrans complets ne sont pas recopiés dans chaque état. Utiliser
`getScreens()` ou `getWidgets({ screens: true })`.

```js
const state = session.state()
console.log(state.currentFunction?.name)
console.log(state.locals.map((entry) => [entry.name, entry.value]))
console.log(session.getScreens())
console.log(session.getInstructionHistory({ from: 0, limit: 20 }))
```

`getFrame(index)` expose une frame brute gelée. `getProject()`,
`getReachability()` et `getDiagnostics()` retournent les données de session
gelées.

## Événements

```js
const unsubscribe = session.on('stop', (event) => {
  console.log(event.reason, event.nodeId)
})
session.on('*', (event) => console.log(event.type, event.sequence))
unsubscribe()
```

Types : `created`, `position`, `stop`, `breakpoint`, `resume`, `error`,
`finished`, `restart`, `breakpoints`, `disposed`. Les événements sont
JSON-sérialisables, numérotés et horodatés. `on()` retourne une fonction de
désabonnement ; `off()` et `listenerCount()` sont également disponibles.
`dispose()` libère les références et désabonne tous les écouteurs.

L'événement `created` est émis avant que l'appelant puisse s'abonner. Utiliser
l'option `onEvent` pour l'observer.

## Export de trace

```js
const trace = session.exportTrace({
  maxFrames: 1000,
  includeWidgets: true,
  includeScreens: false,
})
console.log(JSON.stringify(trace))
```

Options : `from`, `to`, `maxFrames` (1 à 10000, défaut 1000),
`maxOutputEntries` (1 à 10000, défaut 1000), `includeVariables` (défaut vrai),
`includeOutput` (défaut vrai), `includeWidgets` (défaut faux), `includeScreens`
(défaut faux), `includeReachability`, `includeDiagnostics` (défaut vrai) et
`includeProject` (défaut faux).

Le résultat contient `format: 'sapphire3-debug-trace'`, `version: 1`, un résumé
avec `truncated`, les frames demandées, et éventuellement la source,
l'accessibilité et les diagnostics.

## Erreurs

```js
import { DebugError, DEBUG_ERROR_CODES } from '@sapphire3/debug'
```

Codes : `DEBUG_DISPOSED`, `DEBUG_INVALID_ARGUMENT`, `DEBUG_INVALID_PROJECT`,
`DEBUG_UNKNOWN_NODE`, `DEBUG_INVALID_INDEX`, `DEBUG_INTERNAL`. Les codes du
moteur (`SIMULATION_*`, `DEBUG_HISTORY_LIMIT`) restent visibles dans l'état et
les exports.

## Documentation

La référence complète est dans `docs/sdk/debug.md` du dépôt Sapphire 3.
Les définitions TypeScript publiques sont dans `types/index.d.ts`.

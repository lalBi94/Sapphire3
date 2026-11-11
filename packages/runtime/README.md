# @sapphire3/runtime

SDK JavaScript ESM pour exécuter un programme Sapphire 3 sans lancer l'IDE.

- Node.js 20.19+ et navigateurs modernes.
- Aucun DOM ou `requestAnimationFrame` obligatoire.
- Réutilise le simulateur borné et l'interpréteur live existants.
- Widgets retournés sous forme de données, sans rendu React.
- Sessions indépendantes, arrêt et annulation selon l'isolation choisie.

## Construction

```sh
pnpm install
pnpm --filter @sapphire3/runtime build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/runtime run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-runtime-0.1.0.tgz
```

## Exécution bornée

```js
import { createRuntime } from '@sapphire3/runtime'

const runtime = createRuntime(project, { maxSteps: 10000 })
runtime.on('output', ({ lines }) => console.log(lines.join('\n')))
const result = await runtime.run()
console.log(result.ok, result.output, result.steps)
```

## Exécuter une fonction

```js
const result = await runtime.runFunction('add', [2, 3])
console.log(result.result, result.returnValue)
```

## Live

```js
const runtime = createRuntime(project, { sliceSteps: 400 })
runtime.on('frame', (state) => {
  console.log(state.steps, state.gauges, state.leds)
})
const live = runtime.startLive()
runtime.pause()
runtime.resume()
runtime.stop()
const result = await live
console.log(result.stopped, result.output)
```

## Isolation par Worker

```js
const runtime = createRuntime(project, { isolation: 'worker' })
```

L'isolation par Worker est disponible lorsque `Worker` existe (navigateur) ou
lorsqu'une `workerFactory` compatible est fournie. En Node.js sans Worker, le
mode `inline` reste le mode par défaut.

## Documentation

La référence complète est dans `docs/sdk/runtime.md` du dépôt Sapphire 3.

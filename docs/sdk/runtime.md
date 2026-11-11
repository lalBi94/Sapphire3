# Runtime SDK Sapphire 3

`@sapphire3/runtime` exécute un programme Sapphire 3 hors de l'IDE, depuis Node.js, un navigateur ou une application tierce. Il réutilise le simulateur borné et l'interpréteur live existants ; aucun second interpréteur n'est créé.

## Statut et versionnement

- Package : `@sapphire3/runtime`, version `0.1.0`.
- Contrat public : `RUNTIME_API_VERSION = 1`.
- SemVer : correctif pour une correction compatible, mineure pour un ajout, majeure pour une rupture. Toute rupture incrémente aussi `RUNTIME_API_VERSION`.
- Package `private: true` dans le dépôt : aucune publication npm. L'archive locale reste installable via `npm pack`.
- Les projets créés par `@sapphire3/core` sont acceptés directement : le modèle source est le même. Le runtime ne dépend pas de `@sapphire3/core` à l'exécution.

## Construction et installation

```sh
pnpm install
pnpm --filter @sapphire3/runtime build
pnpm --filter @sapphire3/runtime run pack
```

L'archive est écrite dans `build/sdk/sapphire3-runtime-0.1.0.tgz`. Dans un projet externe :

```sh
npm install /chemin/vers/build/sdk/sapphire3-runtime-0.1.0.tgz
```

Le package n'a aucune dépendance runtime. Le Worker isolé est inclus dans `dist/assets/`.

## Charger un projet

`createRuntime` accepte :

- un projet logique JSON v1 ;
- une enveloppe workspace `.sp3` versionnée (versions 1 à 3, migrations incluses) ;
- une chaîne JSON ;
- des octets UTF-8 (`Uint8Array`, `ArrayBuffer`).

```js
import { createRuntime, loadProject } from '@sapphire3/runtime'

const loaded = await loadProject(workspaceText)
console.log(loaded.canGenerate, loaded.diagnostics)

const runtime = createRuntime(workspaceText, { maxSteps: 10000 })
```

`loadProject` accepte aussi un `Blob` ou une `Response` via `.text()`. Un workspace est validé par le même lecteur que l'application avant extraction du projet. Les diagnostics bloquants empêchent `createRuntime` de démarrer et sont retournés dans `RuntimeError.diagnostics`.

## Exécution bornée

```js
const runtime = createRuntime(project, { maxSteps: 10000 })
runtime.on('output', ({ lines }) => console.log(lines.join('\n')))
const result = await runtime.run()
```

`result` contient :

- `ok`, `output`, `outputSteps`, `steps` ;
- `diagnostics`, `error`, `errorCode` ;
- `result` (valeur publique simple), `returnValue` (texte) ;
- `trace`, `variables`, `contracts` ;
- `widgets` et les mêmes champs à la racine (`screens`, `gauges`, etc.) ;
- `frames` avec les séquences par pas (`screenFrames`, `gaugeFrames`, etc.).

Le budget est un entier de 1 à 100000. Un budget invalide lève `RUNTIME_BUDGET_INVALID` ; un dépassement retourne `SIMULATION_STEP_LIMIT`.

## Exécuter une fonction choisie

```js
const result = await runtime.runFunction('add', [2, 3])
console.log(result.result) // 5
```

`runFunction` accepte un identifiant de nœud, un nom de fonction ou `{ name, moduleId }`. Les noms ambigus lèvent `RUNTIME_FUNCTION_AMBIGUOUS`. Les arguments sont validés par le moteur selon les types déclarés ; une valeur invalide retourne `SIMULATION_ARGUMENTS_INVALID`.

Les fonctions de premier niveau sont exécutables. L'exécution directe d'une méthode de classe n'est pas exposée : exécutez une fonction de premier niveau ou le point d'entrée qui utilise la classe. Les classes, constructeurs, méthodes, `this`, `new` et la visibilité existants restent exécutés par l'interpréteur.

## Mode live

```js
const runtime = createRuntime(project, { sliceSteps: 400 })
runtime.on('frame', (state) => {
  console.log(state.steps, state.gauges, state.leds)
})
runtime.on('status', ({ status }) => console.log(status))

const live = runtime.startLive({ captureFrames: true })
runtime.pause()
runtime.resume()
runtime.stop()
const result = await live
```

`startLive` exécute le point d'entrée. Le moteur rend la main à chaque `screenPresent` ou après `sliceSteps` pas. Pause, reprise et arrêt prennent effet à la prochaine frame ; ils ne coupent pas une tranche déjà en cours.

- `pause()` suspend la reprise.
- `resume()` reprend et applique les entrées ou événements en attente.
- `stop()` demande l'arrêt ; le résultat contient `stopped: true`.
- `dispose()` arrête la session et libère le runtime.
- `sendInputs({ nodeId: value })` remplace des globales entre deux frames.
- `sendEvents([{ nodeId, value }])` déclenche les callbacks de widgets (boutons, entrées typées, sélecteurs).

Les frames contiennent `steps`, `currentNodeId`, `output`, `contracts`, `screens`, `gauges`, `leds`, `rgbLeds`, `progresses`, `barCharts`, `xyPlots`, `oscilloscopes` et `heatmaps`. Aucun rendu React n'est imposé.

## Événements

```js
const unsubscribe = runtime.on('frame', (frame) => {})
runtime.on('output', ({ lines, output }) => {})
runtime.on('progress', ({ phase, current, total }) => {})
runtime.on('status', ({ status, mode, result, error }) => {})
runtime.on('error', (error) => {})
runtime.on('done', (result) => {})
unsubscribe()
```

`status` vaut `idle`, `running`, `paused`, `stopping`, `stopped`, `done`, `error` ou `disposed`. Un écouteur défaillant ne corrompt pas la session.

## Erreurs

`RuntimeError` porte `code`, `message`, `diagnostics`, `details` et `toJSON()`. Les codes moteur (`SIMULATION_*`) sont conservés. Codes du runtime :

- `RUNTIME_DISPOSED`, `RUNTIME_BUSY` ;
- `RUNTIME_INVALID_ARGUMENT`, `RUNTIME_INVALID_PROJECT`, `RUNTIME_BUDGET_INVALID` ;
- `RUNTIME_FUNCTION_NOT_FOUND`, `RUNTIME_FUNCTION_AMBIGUOUS`, `RUNTIME_FUNCTION_UNSUPPORTED` ;
- `RUNTIME_NOT_LIVE`, `RUNTIME_LIVE_ACTIVE`, `RUNTIME_CANCELLED` ;
- `RUNTIME_WORKER_UNAVAILABLE`, `RUNTIME_WORKER_FAILED` ;
- `RUNTIME_WORKSPACE_INVALID`, `RUNTIME_EXECUTION_FAILED`.

Les erreurs d'API ou de worker rejettent la promesse. Les erreurs du programme sont retournées dans `result.error` avec `ok: false`. Les codes de validation de workspace (`WORKSPACE_*`) sont conservés.

## Isolation et annulation

- `isolation: 'inline'` (défaut) exécute dans le fil courant. Node.js ne nécessite ni DOM ni `requestAnimationFrame`.
- `isolation: 'worker'` crée un Worker par opération lorsque `Worker` existe. Le Worker est inclus dans le package. En Node.js sans `Worker`, `createRuntime` lève `RUNTIME_WORKER_UNAVAILABLE` ; fournir `workerFactory` permet d'utiliser un Worker compatible.
- En inline, une simulation bornée ne peut pas être interrompue au milieu d'un pas : `AbortSignal` est vérifié avant et après, et l'arrêt live a lieu à la frame suivante.
- En Worker, une simulation bornée annulée ou un `dispose` termine le Worker ; `stop()` live demande l'arrêt à la prochaine frame.
- Plusieurs runtimes sont indépendants : projet, analyse, écouteurs et session live ne sont pas partagés.

```js
const runtime = createRuntime(project, { isolation: 'worker' })
const controller = new AbortController()
const result = await runtime.run({ signal: controller.signal })
```

## Widgets

Les états sont des données sérialisables : écrans (dimensions et pixels RGBA), jauges, LED, LED RVB, barres de progression, graphiques à barres, XY plots, oscilloscopes et heatmaps. Ils proviennent des lecteurs du moteur, pas d'un rendu React.

## Sécurité et limites

- Le langage exécuté ne propose aucun accès implicite au système de fichiers, au réseau ou au processus hôte.
- Le runtime n'est pas un bac à sable de sécurité pour du code hostile. L'isolation par Worker réduit l'impact sur le fil principal mais ne constitue pas une frontière de sécurité démontrée.
- Aucun rendu, DOM, Neutralinojs ou API native n'est requis.
- Le mode live ne fournit ni trace complète ni retour arrière ; le mode borné fournit la trace.
- Les arguments directs de `runFunction` suivent la validation du moteur (primitifs) ; les classes et méthodes s'exécutent via le programme.
- Une session live par runtime ; plusieurs sessions indépendantes se font avec plusieurs runtimes.

## Exemples et vérifications

- `examples/runtime/node-run.mjs`
- `examples/runtime/browser.html`

```sh
pnpm --filter @sapphire3/runtime build
node examples/runtime/node-run.mjs
pnpm runtime:test
pnpm runtime:pack
```

Les tests couvrent le chargement projet/workspace, l'exécution du point d'entrée, les fonctions et arguments, les classes, les boucles et budgets, les widgets, le live avec pause/reprise/arrêt, les événements d'entrée, les erreurs, l'annulation, les sessions indépendantes et l'installation réelle de l'archive `npm pack` dans un projet externe. Les suites existantes `simulation.test.js`, `liveSimulation.test.js`, `engine.test.js` et `engineRunner.test.js` restent vertes : Run, Run live et Stop de l'application ne sont pas modifiés.

# Debug SDK Sapphire 3

`@sapphire3/debug` permet à une application Node.js ou à un navigateur de
construire un débogueur pour un programme Sapphire 3 sans lancer l'IDE. Le SDK
réutilise `createDebugSession()`, `moveDebugSession()`, `debugTrace.js`,
`simulation.js` et `reachability.js` ; il ne crée ni second interpréteur ni
second AST.

## Distinction essentielle : trace enregistrée, pas débogage live

Le débogueur de Sapphire 3 calcule d'abord une trace avec
`simulateProgram(project, { captureDebug: true })`. Les frames contiennent les
positions, les portées, les variables, les sorties et les états de widgets
observés avant chaque instruction.

`@sapphire3/debug` navigue dans cette trace :

- `stepInto()` avance d'une frame ;
- `stepNext()` saute les appels de fonction et de lambda ;
- `stepOut()` quitte la fonction ou la lambda courante ;
- `stepBack()` restaure une position visitée ;
- `continue()` reprend jusqu'au prochain point d'arrêt ou à la fin.

Le SDK **ne suspend pas** un interpréteur en cours d'exécution. Il ne fournit
pas de pause arbitraire, de breakpoint dynamique pendant un Run live, ni de
modification de variables. Un adaptateur live séparé serait nécessaire si le
Runtime SDK exposait un jour un vrai mécanisme de pause coopérative avec
breakpoints ; ce n'est pas le cas dans ce contrat.

## Statut et versionnement

- Package : `@sapphire3/debug`, version `0.1.0`.
- Contrat public : `DEBUG_API_VERSION = 1`.
- Package `private: true` dans le dépôt : aucune publication npm. L'archive
  locale reste installable via `npm pack`.
- Les projets créés par `@sapphire3/core` sont acceptés directement. Le SDK ne
  dépend pas de `@sapphire3/core` à l'exécution ; il réutilise le même moteur.

## Construction et installation

```sh
pnpm install
pnpm --filter @sapphire3/debug build
pnpm --filter @sapphire3/debug run pack
```

L'archive est écrite dans `build/sdk/sapphire3-debug-0.1.0.tgz`. Dans un projet
externe :

```sh
npm install /chemin/vers/build/sdk/sapphire3-debug-0.1.0.tgz
```

Le package n'a aucune dépendance runtime.

## Création d'une session

```js
import { createDebugSession } from '@sapphire3/debug'

const session = createDebugSession(project, {
  maxSteps: 10000,
  breakpoints: ['nodeId'],
  onProgress: ({ phase, current, total }) => console.log(phase, current, total),
  onEvent: (event) => console.log(event.type, event.nodeId),
})
```

Options transmises au moteur : `maxSteps`, `functionId`, `args`, `inputs`,
`onProgress`. Options SDK : `breakpoints` et `onEvent`.

Chaque session possède sa propre trace, son curseur, son historique et ses
points d'arrêt. Plusieurs sessions peuvent coexister sur le même projet sans
partager d'état mutable.

Le projet est copié et gelé à la création. La source de l'appelant n'est jamais
modifiée. Les frames, les variables, les sorties et les états de widgets sont
également gelés : les valeurs exposées sont en lecture seule.

## Commandes

Toutes les commandes retournent un instantané `state()` gelé. Une commande sans
effet retourne l'état courant sans émettre d'événement.

| Méthode | Sémantique |
| --- | --- |
| `stepInto()` | Avance d'une frame enregistrée, y compris dans un appel. |
| `stepNext()` | Avance en sautant les appels dont la profondeur augmente. |
| `stepOut()` | Avance jusqu'à sortir de la fonction ou lambda courante. |
| `stepOutScope()` | Quitte le scope lexical courant, comme « Finish scope ». |
| `continue()` | Reprend jusqu'au prochain point d'arrêt ou à la fin. |
| `stepBack()` | Restaure la dernière position de l'historique de navigation. |
| `restart()` | Revient à la première frame et vide l'historique. |

### Step Next

`stepNext()` utilise la pile réelle des activations de fonctions et de lambdas,
reconstruite depuis `scopeIds`, `callStack` et `localScopes`. Si la frame
suivante entre dans un appel plus profond, le SDK avance jusqu'à revenir à la
profondeur courante. Les blocs, les boucles et les instructions d'une même
fonction ne sont pas sautés.

Un point d'arrêt rencontré dans une plage sautée interrompt le saut : la
session s'arrête sur ce nœud avec la raison `breakpoint`.

### Step Out

`stepOut()` quitte la fonction ou la lambda courante. À la racine globale, la
commande est sans effet. Comme `stepNext()`, elle s'arrête sur un point
d'arrêt rencontré avant la sortie.

### Step Back

`stepBack()` ne rembobine pas arbitrairement la trace. Il dépile l'historique
des positions visitées par les commandes précédentes. Après un `continue()`,
l'historique contient la position de départ du continue, pas chaque frame
sautée. Pour revenir instruction par instruction, utiliser `stepInto()` ou
`stepNext()`.

### Restart

`restart()` revient au premier arrêt, vide l'historique et conserve les points
d'arrêt. Si la session est déjà au départ, la commande est sans effet.

## Points d'arrêt

```js
session.addBreakpoint('nodeId')
session.setBreakpoints(['first', 'second'])
session.removeBreakpoint('nodeId')
session.clearBreakpoints()
session.getBreakpoints()
```

Les points d'arrêt sont des identifiants de nœuds source. Un identifiant inconnu
est refusé avec `DEBUG_UNKNOWN_NODE`. Un point d'arrêt sur un nœud jamais exécuté
est accepté et ne se déclenche simplement jamais.

Les changements de points d'arrêt émettent l'événement `breakpoints`.

## Inspection

`state()` retourne un objet JSON-sérialisable et gelé :

```js
{
  sessionId,
  disposed,
  status,                 // paused | completed | error | invalid | disposed
  cursor,
  frameCount,
  nodeId,
  currentNode,            // { id, kind, moduleId, name, type, ... }
  currentModule,          // { id, name, kind }
  currentClass,           // { id, name } ou null
  currentFunction,        // dernière entrée de callStack
  callStack,              // fonctions et lambdas actifs
  scopes,                 // portées locales accessibles
  globals,                // variables globales
  locals,                 // variables locales aplaties
  parameters,             // paramètres de la fonction ou lambda courante
  output,                 // sorties déjà produites
  widgets,                // jauges, LED, progression, graphiques, etc.
  screens,                // toujours null ; voir getScreens()
  hasScreens,
  instructionCount,
  navigationHistory,
  breakpoints,
  diagnostics,
  reachability,           // résumé : ok, compteurs
  lastStopReason,
  errorCode,
  error,
  terminal,
  canStepBack,
  canStepInto,
  canStepNext,
  canStepOut,
  canStepOutScope,
  canContinue,
  canRestart,
  createdAt,
}
```

### Pile d'appels

`callStack` est construit depuis les activations réellement actives. Chaque
entrée contient `depth`, `instanceId`, `scopeId`, `nodeId`, `kind`, `name`,
`moduleId`, `moduleName`, `classId`, `className`, `isLambda` et `entryPoint`.

Les méthodes de classe apparaissent avec `className` et `kind:
'FunctionDeclaration'`. Les lambdas apparaissent avec `isLambda: true` et
`kind: 'LambdaExpression'`.

### Portées et variables

`scopes` décrit les portées locales accessibles, de la plus interne à la plus
externe : `block`, `for`, `function`, `lambda`. `locals` aplatit leurs variables
avec `kind` (`VariableDeclaration`, `ConstantDeclaration`, `Parameter`),
`scopeId`, `instanceId`, `scopeKind` et `callableNodeId`.

Les liaisons exposent `nodeId`, `moduleId`, `name`, `type`, `initialized`, puis
`value`, `array` et/ou `pointer` selon le cas. Les tableaux sont limités aux
premières cases par le moteur. Les pointeurs sont décrits par leur cible stable,
sans conserver l'environnement JavaScript mutable.

### Widgets et écrans

`widgets` contient `gauges`, `leds`, `rgbLeds`, `progresses`, `barCharts`,
`xyPlots`, `oscilloscopes` et `heatmaps`. Les écrans complets sont reconstruits
à la demande :

```js
const screens = session.getScreens()
const widgets = session.getWidgets({ screens: true })
```

`state().screens` vaut toujours `null` pour éviter de recopier des pixels à
chaque pas. `hasScreens` indique si la trace contient des écrans.

### Historique d'instructions

```js
const history = session.getInstructionHistory({ from: 0, limit: 50 })
```

`total` compte les instructions exécutées jusqu'au curseur, hors frame
terminale. `from` et `limit` portent sur les instructions, pas sur les frames
brutes. `limit` est borné à 1000. Chaque entrée contient `ordinal`,
`frameIndex`, `nodeId`, `status`, `errorCode`, `moduleId`, `moduleName`,
`functionNodeId` et `functionName`.

### Autres accesseurs

- `getFrame(index)` : frame brute gelée, ou `null` si la session est vide.
- `getProject()` : source copiée et gelée.
- `getReachability()` : nœuds accessibles/inaccessibles et fonctions.
- `getDiagnostics()` : diagnostics d'analyse.
- `getBreakpoints()` : liste triée.

## Événements

```js
const unsubscribe = session.on('stop', (event) => {
  console.log(event.reason, event.nodeId, event.cursor)
})
session.on('*', (event) => console.log(event.type, event.sequence))
unsubscribe()
```

Types : `created`, `position`, `stop`, `breakpoint`, `resume`, `error`,
`finished`, `restart`, `breakpoints`, `disposed`.

Chaque événement contient `type`, `sessionId`, `sequence`, `timestamp` et des
champs propres au type. Les événements sont JSON-sérialisables.

Ordre typique d'un pas en avant : `resume`, `position`, `stop`. Si un point
d'arrêt est atteint, un événement `breakpoint` suit. Si la frame terminale est
atteinte, un événement `finished` suit ; une erreur runtime émet aussi `error`.

`on(type, listener)` retourne une fonction de désabonnement. `off(type,
listener)` et `listenerCount(type?)` sont disponibles. `dispose()` désabonne
tous les écouteurs et libère les références. Un écouteur qui lève une exception
n'interrompt pas la session.

L'événement `created` est émis dans le constructeur, avant que l'appelant puisse
appeler `on()`. Utiliser l'option `onEvent` pour l'observer.

## Export de trace

```js
const trace = session.exportTrace({
  maxFrames: 1000,
  includeWidgets: true,
  includeScreens: false,
})
console.log(JSON.stringify(trace))
```

Options :

| Option | Défaut | Effet |
| --- | --- | --- |
| `from` | `0` | Première frame incluse. |
| `to` | nombre de frames | Fin exclusive, bornée à la trace. |
| `maxFrames` | `1000` | Nombre maximal de frames, 1 à 10000. |
| `maxOutputEntries` | `1000` | Sorties maximales par frame, 1 à 10000. |
| `includeVariables` | `true` | Inclut `globals` et `localScopes`. |
| `includeOutput` | `true` | Inclut `output`. |
| `includeWidgets` | `false` | Inclut les widgets non-écran. |
| `includeScreens` | `false` | Reconstruit et inclut les écrans. |
| `includeReachability` | `true` | Inclut l'accessibilité complète. |
| `includeDiagnostics` | `true` | Inclut les diagnostics. |
| `includeProject` | `false` | Inclut la source gelée. |

Le résultat contient `format: 'sapphire3-debug-trace'`, `version: 1`,
`sessionId`, `createdAt`, `exportedAt`, `source`, `summary`, `frames`,
`project`, `reachability` et `diagnostics`.

`summary` précise `frameCount`, `from`, `to`, `exportedFrames`, `cursor`,
`status`, `lastStopReason`, `errorCode`, `traceErrorCode`, `breakpoints`,
`outputLength`, `truncated`, `maxFrames`, `maxOutputEntries` et les inclusions.

Les frames exportées contiennent `index`, `nodeId`, `status`, `errorCode`,
`moduleId`, `moduleName`, `callStack`, `scopeIds`, puis selon les options
`globals`, `localScopes`, `output`, `widgets` et `screens`. Une sortie tronquée
porte `outputTruncated: true`.

## Erreurs

```js
import { DebugError, DEBUG_ERROR_CODES, isDebugError } from '@sapphire3/debug'
```

Codes stables :

- `DEBUG_DISPOSED` : session libérée ;
- `DEBUG_INVALID_ARGUMENT` : option ou argument invalide ;
- `DEBUG_INVALID_PROJECT` : source sans `formatVersion: 1`, modules ou nœuds ;
- `DEBUG_UNKNOWN_NODE` : point d'arrêt sur un nœud absent ;
- `DEBUG_INVALID_INDEX` : frame hors bornes ;
- `DEBUG_INTERNAL` : échec interne de création.

Les codes du moteur (`SIMULATION_*`, `DEBUG_HISTORY_LIMIT`) restent visibles
dans `state().errorCode`, `state().error`, les événements et les exports. Un
programme invalide crée une session `invalid` sans frame, avec ses diagnostics,
plutôt que de masquer l'échec.

## Limites

- Débogage fondé sur une trace précalculée, pas sur un interpréteur suspendu.
- Aucune modification de variable, d'expression ou de point d'arrêt conditionnel.
- Aucun breakpoint dynamique pendant un Run live.
- `stepBack()` dépend de l'historique de navigation, pas d'un rejeu arbitraire.
- Les écrans complets et les widgets sont opt-in à l'export ; les gros états ne
  sont pas recopiés à chaque `state()`.
- La trace reste bornée par `maxSteps` et par la limite mémoire du moteur
  (`DEBUG_HISTORY_LIMIT`).

## Exemples

- `examples/debug/console-debugger.mjs` : session, breakpoint, step out,
  inspection de la pile et des paramètres.
- `examples/debug/breakpoints-and-variables.mjs` : breakpoint sur un nœud,
  lecture des globales, locales, paramètres et historique.

```sh
pnpm --filter @sapphire3/core build
pnpm --filter @sapphire3/debug build
node examples/debug/console-debugger.mjs
node examples/debug/breakpoints-and-variables.mjs
```

## Vérifications

```sh
pnpm debug:test
pnpm debug:pack
```

Les tests couvrent les appels imbriqués, la récursion, les classes et méthodes,
les boucles, Step Next/Into/Out, Step Back, la fin de trace, les erreurs runtime,
les points d'arrêt, les événements, les sessions multiples, la disposition,
l'inspection, les widgets, les écrans, l'export borné et le packaging `npm pack`
dans un projet externe. Les tests existants de `tests/logic/debugging.test.js`
restent verts : le panneau Debug de l'IDE n'est pas modifié.

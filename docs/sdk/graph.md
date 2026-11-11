# Graph SDK Sapphire 3

`@sapphire3/graph` permet à une application, une CLI ou un agent externe de
charger un projet Sapphire 3, d'en extraire les graphes structurels et logiques,
de les analyser et de les exporter sans utiliser le canvas de l'IDE.

Le SDK réutilise :

- `src/utils/logic/nodeGraphs.js` pour les dépendances ciblées et le CFG ;
- `src/utils/logic/moduleLinks.js` pour les liens réellement utilisés entre
  modules ;
- `src/utils/logic/reachability.js` pour l'accessibilité ;
- `src/utils/logic/semantics.js` via l'analyse du Core pour les symboles, les
  références et les types ;
- `src/utils/flowGraph.js` pour le graphe de flux historique de l'IDE.

Il ne reconstruit ni AST, ni portées, ni résolution de références. Aucun moteur
graphique, SVG, DOM, React ou Neutralinojs n'est requis.

## Statut et versionnement

- Package : `@sapphire3/graph`, version `0.1.0`.
- Contrat public : `GRAPH_API_VERSION = 1`.
- Formats : `json`, `dot`, `mermaid`.
- Package `private: true` dans le dépôt : aucune publication npm. L'archive
  locale reste installable via `npm pack`.

## Structure commune

```js
{
  ok: true,
  kind: 'dependency' | 'control-flow' | 'call' | 'ast' | 'flow',
  directed: true,
  nodes: [
    {
      id: 'identifiant graphique stable',
      sourceId: 'identifiant source Sapphire ou null',
      kind: 'FunctionDeclaration',
      entity: 'symbol',
      label: 'main',
      moduleId: 'app',
      // champs propres au type de graphe
    },
  ],
  edges: [
    {
      id: 'from->to:kind',
      from: 'source',
      to: 'cible',
      kind: 'calls',
      // champs propres à la relation
    },
  ],
  metadata: {
    kind: 'call',
    projectId: 'demo',
    rootId: 'main',
    rootKind: 'node',
    scope: 'project',
    incomplete: false,
    nodeCount: 3,
    edgeCount: 2,
    diagnostics: [],
    unresolvedNodeIds: [],
    // champs propres au graphe
  },
}
```

Les arêtes sont dirigées. `from` et `to` désignent toujours des `nodes[].id`.
Les identifiants source sont conservés dans `sourceId`. Les sommets synthétiques
utilisent des préfixes stables (`module:`, `project:`, `unresolved:`).

Un graphe en échec conserve la forme commune avec `ok: false`, `code`,
`message` et `nodes`/`edges` vides.

## Dependency Graph

```js
const graph = getDependencyGraph(project)
```

Le graphe projet contient :

- les modules et classes (`entity: 'module'`) ;
- les déclarations et paramètres (`entity: 'symbol'`) ;
- les lambdas (`entity: 'symbol'`, `kind: 'LambdaExpression'`) ;
- des sommets d'incertitude (`entity: 'unresolved'`) lorsque nécessaire.

Arêtes principales :

| Kind | Sens | Signification |
| --- | --- | --- |
| `contains` | parent → enfant | module → racine, fonction → paramètre |
| `exports` | module → symbole | export déclaré |
| `imports` | consommateur → fournisseur | import déclaré entre modules |
| `imports-symbol` | consommateur → symbole | import déclaré vers une déclaration |
| `uses-export` | consommateur → fournisseur | export réellement utilisé, issu de `getModuleLinks` |
| `calls` | appelant → fonction/méthode/lambda | appel direct résolu |
| `calls-indirect` | appelant → variable/paramètre | cible fonction non déterminable statiquement |
| `calls-unresolved` | appelant → incertitude | cible d'appel inconnue |
| `reads` | propriétaire → symbole | lecture résolue |
| `writes` | propriétaire → symbole | écriture résolue |
| `type` | déclaration → type | annotation de type résolue |
| `unresolved` | propriétaire → incertitude | référence non résolue |

Le propriétaire d'une référence est la fonction, la lambda ou le module qui la
contient. Les liens `moduleLinks` d'origine restent disponibles dans
`metadata.moduleLinks` ; l'arête `uses-export` est orientée du consommateur vers
le fournisseur pour permettre les dépendances transitives. Les appels indirects
sont listés dans `metadata.indirectCallNodeIds` et rendent `incomplete` vrai.

### Dépendances ciblées

Pour conserver le graphe historique de l'IDE :

```js
const graph = getDependencyGraph(project, {
  target: 'twice',
  scope: 'node', // ou 'module'
})
```

Cette forme délègue à `buildDependencyGraph` et expose les arêtes `contains`,
`calls`, `reads`, `writes`, `type`, les nœuds externes et
`metadata.unresolvedNodeIds`.

Options du graphe projet : `includeParameters`, `includeLambdas`,
`includeImports`, `includeExports`, `includeModuleLinks`, `includeCalls`,
`includeReferences`, `includeUnresolved`.

## Control Flow Graph

```js
const cfg = getControlFlowGraph(project, functionNodeId)
const moduleCfg = getControlFlowGraph(project, { kind: 'module', id: 'app' })
```

Le CFG est intraprocédural. Il contient `cfg:entry`, `cfg:exit` et les
instructions enregistrées par le moteur.

Arêtes : `next`, `true`, `false`, `return`, `break`, `continue`.

Chaque nœud expose `reachable`. Le CFG signale `metadata.incomplete` lorsque la
source contient des erreurs ou qu'un transfert de contrôle ne peut pas être
reconstruit. Les instructions après un `return` restent présentes mais
inaccessibles, comme dans le panneau Debug de l'IDE.

Le CFG accepte une cible de type nœud ou module. Une cible introuvable retourne
`GRAPH_TARGET_NOT_FOUND` ; une cible non fournie retourne `GRAPH_TARGET_REQUIRED`.

## Call Graph

```js
const calls = getCallGraph(project)
```

Sommets :

- fonctions (`kind: 'function'`) ;
- méthodes de classe (`kind: 'method'`, `className`) ;
- lambdas (`kind: 'lambda'`) ;
- entrées de module pour les appels hors fonction (`kind: 'module-entry'`) ;
- incertitudes d'appel (`kind: 'unresolved-call'`).

Les appels directs sont résolus depuis les références sémantiques, les méthodes
depuis le type de classe et `classMembers`, les constructeurs depuis
`NewExpression`, et les lambdas depuis leur expression. Les appels via une
variable ou un paramètre de type fonction produisent `calls-indirect` avec un
sommet `unresolved-call` et `reason: 'function-reference'`. Les récepteurs
inconnus, méthodes absentes et callees dynamiques sont également signalés, sans
inventer de cible.

Les arêtes directes agrègent `count`, `callNodeIds` et `callKinds`. Les
propriétés `metadata.unresolvedCallNodeIds`, `indirectCallNodeIds`,
`omittedCallNodeIds`, `reachableFunctionIds` et `unreachableFunctionIds`
explicitent les incertitudes et l'accessibilité.

## AST Graph

```js
const ast = getAstGraph(project)
```

Le graphe contient le projet, les modules, les nœuds AST et leurs enfants. Les
arêtes `contains` portent le `slot` et l'index de liste. Les arêtes `references`
relient une référence symbolique à sa déclaration cible et restent distinctes
des relations syntaxiques. Les annotations de type utilisent `kind: 'type'`.
Chaque nœud expose `type` (type sémantique) et `declaredType` lorsque présent.

Options : `includeProject`, `includeModules`, `includeReferences`,
`includeImportsExports`, `includeInvalid`, `includeUnresolved`, `maxNodes`
(défaut 20000). Un dépassement produit `metadata.truncated`.

## Flow Graph IDE

```js
const flow = getFlowGraph(project)
```

`getFlowGraph` expose `buildFlowGraph` sous la structure commune : fonctions
atteignables, appels directs agrégés, drapeaux `entry`/`recursive`, positions et
dimensions. Il sert aux outils qui veulent le même graphe simplifié que le
panneau Flow de l'IDE.

## Analyses

```js
const analysis = analyzeGraph(graph, {
  from: 'main',
  to: 'helper',
  algorithm: 'dfs', // ou bfs
  direction: 'out', // out, in, both
  edgeKinds: ['calls', 'imports'],
  maxDepth: 10000,
  maxPaths: 20,
  allTransitive: false,
})
```

Résultats :

- `traversal` : ordre DFS/BFS, profondeur, direction ;
- `reachableFrom` ;
- `directDependencies`, `reverseDependencies` ;
- `transitiveDependencies` (depuis `from`, ou pour tous avec `allTransitive`) ;
- `paths` et `pathsTruncated` ;
- `acyclic`, `hasCycles`, `cycles` (composantes cycliques et self-loops) ;
- `stronglyConnectedComponents` ;
- `topologicalOrder` (`null` si cycle) ;
- `summary` et `incomplete`.

Les parcours et composantes utilisent un ordre trié par identifiant pour rester
déterministes. `direction` ne concerne que les parcours, chemins et dépendances
transitives ; cycles, composantes fortement connexes et tri topologique suivent
toujours les arêtes dirigées d'origine. `analyzeGraph` ne modifie jamais le
graphe.

## Exports

```js
exportGraph(graph, 'json')
exportGraph(graph, 'dot', { direction: 'LR', graphName: 'Sapphire' })
exportGraph(graph, 'mermaid', { direction: 'LR' })
```

- JSON : structure complète sérialisée avec deux espaces par défaut.
- DOT : `digraph`, labels et identifiants échappés, styles des entrées/sorties
  et des incertitudes.
- Mermaid : `flowchart`, identifiants internes sûrs (`n0`, `n1`, …), labels
  échappés en entités HTML.

Aucun rendu n'est effectué. Les exports sont déterministes pour un même graphe.
Un format inconnu lève `GraphError` avec `GRAPH_UNSUPPORTED_FORMAT`.

## Erreurs

```js
import { GraphError, GRAPH_ERROR_CODES, isGraphError } from '@sapphire3/graph'
```

Codes : `GRAPH_INVALID_ARGUMENT`, `GRAPH_INVALID_PROJECT`, `GRAPH_INVALID_GRAPH`,
`GRAPH_TARGET_REQUIRED`, `GRAPH_TARGET_NOT_FOUND`, `GRAPH_TARGET_AMBIGUOUS`,
`GRAPH_NODE_NOT_FOUND`, `GRAPH_UNSUPPORTED_FORMAT`, `GRAPH_INTERNAL`.

Les diagnostics sémantiques du moteur restent dans `metadata.diagnostics`. Un
programme incomplet produit un graphe partiel avec `metadata.incomplete: true`
et des sommets d'incertitude explicites.

## Exemples

- `examples/graph/analyze-project.mjs` : dépendances, appels, CFG, AST,
  analyses et extraits DOT/Mermaid.
- `examples/graph/export-formats.mjs` : exports JSON, DOT et Mermaid.

```sh
pnpm --filter @sapphire3/graph build
node examples/graph/analyze-project.mjs
node examples/graph/export-formats.mjs
```

## Vérifications

```sh
pnpm graph:test
pnpm graph:pack
```

Les tests couvrent les imports/exports, les cycles de modules, les conditions,
les boucles imbriquées, `break`/`continue`/`return`, le code inaccessible, la
récursion, les classes et méthodes, les appels indirects et lambdas, l'AST et
les types, DFS/BFS, la topologie, les composantes fortement connexes, les
chemins, les dépendances transitives, les exports échappés, le déterminisme, les
programmes incomplets, la compatibilité avec les graphes IDE et le packaging npm
local.

## Limites

- Le CFG est intraprocédural ; les appels ne sont pas développés dans le CFG.
- Le call graph est statique : une cible dynamique n'est jamais inventée.
- Les appels via des variables de fonction sont marqués indirects même si leur
  initialiseur est visible ; aucune propagation de valeur n'est faite.
- L'AST graph est borné par `maxNodes` pour éviter un graphe pathologique.
- Aucun rendu graphique, layout avancé ou serveur n'est fourni.

# Graph SDK Sapphire 3

`@sapphire3/graph` extrait, analyse et exporte les graphes structurels et
logiques d'un projet Sapphire 3 sans lancer l'IDE ni le canvas.

- Graphe de dépendances modules/symboles.
- Graphe de contrôle (CFG) par fonction, lambda ou module.
- Graphe d'appels direct, indirect et non résolu.
- Graphe AST avec types et références symboliques distinctes.
- Graphe de flux historique de l'IDE.
- Analyses DFS/BFS, cycles, tri topologique, composantes fortement connexes,
  chemins et dépendances transitives.
- Exports JSON, Graphviz DOT et Mermaid, sans bibliothèque de rendu.
- Aucune dépendance à React, au DOM ou à Neutralinojs.

## Construction

```sh
pnpm install
pnpm --filter @sapphire3/graph build
```

## Installation depuis une archive locale

```sh
pnpm --filter @sapphire3/graph run pack
# puis, dans un projet externe :
npm install /chemin/vers/build/sdk/sapphire3-graph-0.1.0.tgz
```

## API

```js
import {
  getDependencyGraph,
  getControlFlowGraph,
  getCallGraph,
  getAstGraph,
  getFlowGraph,
  analyzeGraph,
  exportGraph,
} from '@sapphire3/graph'

const dependency = getDependencyGraph(project)
const calls = getCallGraph(project)
const cfg = getControlFlowGraph(project, 'functionNodeId')
const ast = getAstGraph(project)
const flow = getFlowGraph(project)

const analysis = analyzeGraph(calls, { from: 'main' })
console.log(analysis.hasCycles, analysis.topologicalOrder)
console.log(exportGraph(calls, 'dot'))
console.log(exportGraph(calls, 'mermaid'))
console.log(exportGraph(calls, 'json'))
```

Chaque graphe partage la structure :

```js
{
  ok: true,
  kind: 'dependency' | 'control-flow' | 'call' | 'ast' | 'flow',
  directed: true,
  nodes: [{ id, sourceId, kind, label, ... }],
  edges: [{ id, from, to, kind, ... }],
  metadata: {
    projectId, rootId, rootKind, scope, incomplete,
    nodeCount, edgeCount, diagnostics, unresolvedNodeIds, ...
  },
}
```

Les identifiants source Sapphire sont conservés dans `sourceId`. Les sommets
synthétiques (modules, projet, appels non résolus) utilisent des identifiants
préfixés stables.

## Documentation

La référence complète est dans `docs/sdk/graph.md` du dépôt Sapphire 3.
Les définitions TypeScript publiques sont dans `types/index.d.ts`.

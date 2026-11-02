const cardWidth = 210
const cardHeight = 88
const columnGap = 72
const rowGap = 20

// Remonte la chaîne des parents jusqu'à la fonction qui contient un nœud.
function containingFunction(index, startId) {
  let parent = index.parents.get(startId)?.[0]
  while (parent?.kind === 'node') {
    const node = index.nodes.get(parent.id)
    if (node?.kind === 'FunctionDeclaration') return node.id
    parent = index.parents.get(parent.id)?.[0]
  }
  return null
}

// Trace le flux d'un appel à l'autre ; les liens récursifs sont signalés sur la carte.
function edgePath(from, to) {
  const startX = from.x + cardWidth
  const startY = from.y + cardHeight / 2
  const endX = to.x
  const endY = to.y + cardHeight / 2
  if (to.x > from.x) return `M ${startX} ${startY} C ${startX + 48} ${startY} ${endX - 48} ${endY} ${endX} ${endY}`
  const channel = Math.max(from.y, to.y) + cardHeight + 40
  return `M ${startX} ${startY} C ${startX + 40} ${channel} ${endX - 40} ${channel} ${endX} ${endY}`
}

// Construit le graphe simplifié des fonctions réellement atteignables et de leurs appels.
export function buildFlowGraph(project, index, reachability) {
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]))
  const reachableFunctions = new Set((reachability?.functions ?? []).filter((entry) => entry.reachable).map((entry) => entry.nodeId))
  const orderedIds = project.nodes.filter((node) => node.kind === 'FunctionDeclaration' && reachableFunctions.has(node.id)).map((node) => node.id)
  if (orderedIds.length === 0) return { nodes: [], edges: [], width: 0, height: 0 }

  const functions = new Map(orderedIds.map((id) => {
    const node = nodesById.get(id)
    return [id, {
      id,
      name: node.properties?.name ?? id,
      moduleId: node.moduleId,
      moduleName: index.modules.get(node.moduleId)?.name ?? '',
      signature: index.nodeTypes.get(id) ?? null,
      parameters: (node.children.parameters ?? []).map((parameterId) => nodesById.get(parameterId)?.properties?.name ?? '?'),
      entry: node.properties?.entryPoint === true,
      recursive: false,
      x: 0,
      y: 0,
    }]
  }))
  const entry = [...functions.values()].find((fn) => fn.entry)?.id ?? null

  // Regroupe les appels résolus entre fonctions atteignables, en ignorant le code mort.
  const calls = new Map()
  for (const nodeId of reachability.reachableNodeIds) {
    const node = nodesById.get(nodeId)
    if (node?.kind !== 'CallExpression') continue
    const reference = index.references.get(node.children?.callee)
    const target = reference ? index.symbols.get(reference.symbolId)?.nodeId : null
    if (!reachableFunctions.has(target)) continue
    const caller = containingFunction(index, node.id) ?? entry
    if (!caller || !functions.has(caller) || !functions.has(target)) continue
    if (caller === target) { functions.get(caller).recursive = true; continue }
    const key = `${caller}->${target}`
    const edge = calls.get(key)
    if (edge) edge.count += 1
    else calls.set(key, { fromId: caller, toId: target, count: 1 })
  }

  // Place les fonctions en colonnes selon leur profondeur d'appel depuis l'entrée.
  const depths = new Map()
  const adjacency = new Map(orderedIds.map((id) => [id, []]))
  for (const edge of calls.values()) adjacency.get(edge.fromId)?.push(edge.toId)
  const queue = entry ? [entry] : [orderedIds[0]]
  depths.set(queue[0], 0)
  while (queue.length > 0) {
    const id = queue.shift()
    for (const target of adjacency.get(id) ?? []) {
      if (depths.has(target)) continue
      depths.set(target, depths.get(id) + 1)
      queue.push(target)
    }
  }
  for (const id of orderedIds) if (!depths.has(id)) depths.set(id, 0)

  const columns = new Map()
  for (const id of orderedIds) {
    const depth = depths.get(id)
    if (!columns.has(depth)) columns.set(depth, [])
    columns.get(depth).push(functions.get(id))
  }
  let width = 0
  let height = 0
  for (const [depth, column] of [...columns.entries()].sort((left, right) => left[0] - right[0])) {
    column.forEach((fn, row) => {
      fn.x = depth * (cardWidth + columnGap)
      fn.y = row * (cardHeight + rowGap)
      width = Math.max(width, fn.x + cardWidth)
      height = Math.max(height, fn.y + cardHeight)
    })
  }

  const edges = [...calls.values()].map((edge) => {
    const from = functions.get(edge.fromId)
    const to = functions.get(edge.toId)
    return { ...edge, path: edgePath(from, to), midX: (from.x + cardWidth + to.x) / 2, midY: (from.y + to.y + cardHeight) / 2 }
  })
  return { nodes: [...functions.values()], edges, width, height }
}

export const flowCardSize = Object.freeze({ width: cardWidth, height: cardHeight })

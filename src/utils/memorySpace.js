// Rend une valeur mémorisée lisible sans confondre une chaîne avec un nombre.
export function memoryValue(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  return Object.is(value, -0) ? '-0' : String(value)
}

// Formate une adresse abstraite : les segments sont illustratifs, pas des adresses réelles.
function address(base, offset = 0) {
  return `0x${(base + offset * 8).toString(16).toUpperCase().padStart(4, '0')}`
}

// Décale une adresse illustrative : les cases occupent un segment distinct des variables.
function cellAddress(sequence) {
  return address(0x3000, sequence)
}

// Construit une vue abstraite de la mémoire : code, données globales et pile d'appels.
export function buildMemorySpace(index, frame, reachability = null) {
  const reachable = new Map((reachability?.functions ?? []).map((entry) => [entry.nodeId, entry.reachable]))
  const functions = [...index.nodes.values()].filter((node) => node.kind === 'FunctionDeclaration').map((node, position) => ({
    id: node.id,
    address: address(0x0100, position),
    name: node.properties?.name ?? node.id,
    moduleId: node.moduleId,
    moduleName: index.modules.get(node.moduleId)?.name ?? '',
    signature: index.nodeTypes.get(node.id) ?? null,
    entry: node.properties?.entryPoint === true,
    reachable: reachable.get(node.id) !== false,
  }))
  const globals = (frame?.globals ?? []).map((variable, position) => ({ ...variable, address: address(0x1000, position) }))
  // La pile est présentée du plus ancien scope au plus récent, comme une pile qui monte.
  const stack = [...(frame?.localScopes ?? [])].reverse().map((scope, depth) => ({
    instanceId: scope.instanceId,
    nodeId: scope.nodeId,
    address: address(0x2000, depth * 8),
    variables: scope.variables.map((variable, position) => ({ ...variable, address: address(0x2000, depth * 8 + position + 1) })),
  }))
  return { functions, globals, stack }
}

// Associe chaque déclaration et chaque référence visible à sa valeur au point d'arrêt courant.
export function buildDebugValues(index, frame) {
  const values = new Map()
  const bindings = [...(frame?.globals ?? []), ...(frame?.localScopes ?? []).flatMap((scope) => scope.variables)]
  for (const binding of bindings) values.set(binding.nodeId, binding)
  for (const reference of index.references?.values() ?? []) {
    const symbol = index.symbols?.get(reference.symbolId)
    if (symbol && values.has(symbol.nodeId) && !values.has(reference.nodeId)) values.set(reference.nodeId, values.get(symbol.nodeId))
  }
  return values
}

// Prépare le graphe des pointeurs et des cases visibles au point d'arrêt courant.
export function buildPointerGraph(index, frame) {
  const space = buildMemorySpace(index, frame)
  const groups = []
  const variables = []
  const nodes = new Map()
  let cellSequence = 0

  // Ajoute une variable et ses cases de tableau au groupe courant.
  function addVariable(group, variable, scopeKey) {
    const id = `${scopeKey}:${variable.nodeId}`
    const item = {
      ...variable,
      id,
      scopeKey,
      cells: (variable.array?.cells ?? []).map((value, position) => ({
        id: `${id}:cell:${position}`,
        variableId: id,
        index: position,
        address: cellAddress(cellSequence++),
        value,
      })),
    }
    group.variables.push(item)
    variables.push(item)
    nodes.set(item.id, item)
    for (const cell of item.cells) nodes.set(cell.id, cell)
  }

  const globalGroup = { id: 'global', kind: 'global', address: null, nodeId: null, variables: [] }
  for (const variable of space.globals) addVariable(globalGroup, variable, 'global')
  groups.push(globalGroup)
  for (const scope of space.stack) {
    const group = { id: `scope:${scope.instanceId}`, kind: 'scope', address: scope.address, nodeId: scope.nodeId, instanceId: scope.instanceId, variables: [] }
    for (const variable of scope.variables) addVariable(group, variable, String(scope.instanceId))
    groups.push(group)
  }

  const edges = []
  for (const variable of variables) {
    const pointer = variable.pointer
    if (!pointer) continue
    let targetId = null
    if (pointer.kind === 'reference' && pointer.nodeId) {
      const scopeKey = pointer.instanceId == null ? 'global' : String(pointer.instanceId)
      targetId = `${scopeKey}:${pointer.nodeId}`
    } else if (pointer.kind === 'element' && pointer.arrayNodeId && Number.isInteger(pointer.index)) {
      const scopeKey = pointer.arrayInstanceId == null ? 'global' : String(pointer.arrayInstanceId)
      targetId = `${scopeKey}:${pointer.arrayNodeId}:cell:${pointer.index}`
    }
    edges.push({
      id: `edge:${variable.id}:${targetId ?? 'unknown'}`,
      from: variable.id,
      to: targetId,
      resolved: Boolean(targetId && nodes.has(targetId)),
      label: pointer.label,
      kind: pointer.kind,
      index: pointer.index ?? null,
    })
  }

  return { groups, variables, edges, hasPointers: variables.some((variable) => Boolean(variable.pointer)) }
}


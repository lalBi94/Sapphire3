// Rend une valeur mémorisée lisible sans confondre une chaîne avec un nombre.
export function memoryValue(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  return Object.is(value, -0) ? '-0' : String(value)
}

// Formate une adresse abstraite : les segments sont illustratifs, pas des adresses réelles.
function address(base, offset = 0) {
  return `0x${(base + offset * 8).toString(16).toUpperCase().padStart(4, '0')}`
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

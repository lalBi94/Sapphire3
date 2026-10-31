// Capture les états scalaires sans conserver de Map mutable dans les instantanés publics.
export function createDebugRecorder(analysis, global, output, uninitialized) {
  const frames = []
  const scopes = new Map(analysis.semantic.scopes.map((scope) => [scope.id, scope]))
  const variables = analysis.semantic.symbols.filter((symbol) => !symbol.importedFrom && ['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(symbol.kind))
  let entries = 0

  // Distingue une valeur non initialisée d'une vraie chaîne ou d'un booléen.
  function binding(symbol, environment) {
    const initialized = environment.values.has(symbol.nodeId) && environment.values.get(symbol.nodeId) !== uninitialized
    const value = initialized ? environment.values.get(symbol.nodeId) : undefined
    return { nodeId: symbol.nodeId, moduleId: symbol.moduleId, name: symbol.name, type: symbol.type, initialized, ...(initialized ? { value: typeof value === 'bigint' ? Number(value) : value } : {}) }
  }

  // Borne la rétention de l'historique ; l'unique état terminal reste toujours disponible.
  function record(nodeId, environment, activeScopes, status = 'paused', errorCode = null) {
    const globals = variables.filter((symbol) => scopes.get(symbol.scopeId)?.parentId === null).map((symbol) => binding(symbol, global))
    const localScopes = []
    let current = environment
    while (current && current !== global) {
      localScopes.push({ instanceId: current.instanceId, nodeId: current.nodeId, scopeId: current.scopeId, variables: variables.filter((symbol) => symbol.scopeId === current.scopeId).map((symbol) => binding(symbol, current)) })
      current = current.parent
    }
    const count = 1 + globals.length + localScopes.reduce((total, scope) => total + 1 + scope.variables.length, 0) + output.length + activeScopes.length
    if (status === 'paused' && entries + count > 200000) throw Object.assign(new Error('Debug history memory limit reached.'), { code: 'DEBUG_HISTORY_LIMIT' })
    entries += count
    frames.push({ nodeId, status, errorCode, scopeIds: activeScopes.map((scope) => scope.instanceId), callStack: activeScopes.filter((scope) => scope.scopeId.startsWith('function:')).map((scope) => ({ instanceId: scope.instanceId, nodeId: scope.nodeId })), globals, localScopes, output: [...output] })
  }

  return { frames, record }
}

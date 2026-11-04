// Capture les états scalaires sans conserver de Map mutable dans les instantanés publics.
import { readScreenStates } from './screenState.js'

export function createDebugRecorder(analysis, global, output, uninitialized) {
  const frames = []
  const scopes = new Map(analysis.semantic.scopes.map((scope) => [scope.id, scope]))
  const variables = analysis.semantic.symbols.filter((symbol) => !symbol.importedFrom && ['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(symbol.kind))
  const maximumArrayCells = 24
  let entries = 0

  // Distingue une valeur non initialisée d'une vraie chaîne ou d'un booléen.
  function displayValue(value) {
    if (value && typeof value === 'object' && value.pointer === true) return value.label
    if (value && typeof value === 'object' && value.functionValue === true) return value.label
    if (typeof value === 'symbol') return 'uninitialized'
    if (Array.isArray(value)) {
      const shown = value.slice(0, 8).map((element) => displayValue(element)).join(', ')
      return value.length > 8 ? `[${shown}, …] · ${value.length}` : `[${shown}]`
    }
    return typeof value === 'bigint' ? Number(value) : value
  }

  // Décrit la cible stable d'un pointeur sans conserver l'environnement JavaScript mutable.
  function pointerPreview(value, environment) {
    if (!value || typeof value !== 'object' || value.pointer !== true) return null
    if (value.kind === 'reference') {
      let targetEnvironment = value.environment
      while (targetEnvironment && !targetEnvironment.values.has(value.nodeId)) targetEnvironment = targetEnvironment.parent
      return { kind: 'reference', nodeId: value.nodeId, instanceId: targetEnvironment?.instanceId ?? null, label: value.label, constant: value.constant === true }
    }
    if (value.kind === 'element') {
      let owner = null
      let current = environment
      while (current && !owner) {
        for (const [nodeId, candidate] of current.values) {
          if (candidate === value.array) { owner = { nodeId, instanceId: current.instanceId ?? null }; break }
        }
        current = current.parent
      }
      return {
        kind: 'element', arrayNodeId: owner?.nodeId ?? null, arrayInstanceId: owner?.instanceId ?? null,
        index: value.index, length: Array.isArray(value.array) ? value.array.length : null,
        label: value.label, constant: value.constant === true,
      }
    }
    return { kind: 'unknown', label: value.label ?? '' }
  }

  // Présente un élément de tableau comme une case lisible, sans perdre les chaînes.
  function cellValue(value) {
    if (typeof value === 'string') return JSON.stringify(value)
    return displayValue(value)
  }

  // Décrit un tableau par sa longueur et ses premières cases, dans une limite bornée.
  function arrayPreview(value) {
    if (!Array.isArray(value)) return null
    return { length: value.length, cells: value.slice(0, maximumArrayCells).map(cellValue) }
  }

  function binding(symbol, environment) {
    const initialized = environment.values.has(symbol.nodeId) && environment.values.get(symbol.nodeId) !== uninitialized
    const value = initialized ? environment.values.get(symbol.nodeId) : undefined
    const array = initialized ? arrayPreview(value) : null
    const pointer = initialized ? pointerPreview(value, environment) : null
    return { nodeId: symbol.nodeId, moduleId: symbol.moduleId, name: symbol.name, type: symbol.type, initialized, ...(initialized ? { value: displayValue(value) } : {}), ...(array ? { array } : {}), ...(pointer ? { pointer } : {}) }
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
      + [...globals, ...localScopes.flatMap((scope) => scope.variables)].reduce((total, variable) => total + (variable.array?.cells.length ?? 0), 0)
    const screens = readScreenStates(analysis.source, global.values)
    const screenCount = Object.values(screens).reduce((total, screen) => total + screen.pixels.length, 0)
    if (status === 'paused' && entries + count + screenCount > 200000) throw Object.assign(new Error('Debug history memory limit reached.'), { code: 'DEBUG_HISTORY_LIMIT' })
    entries += count + screenCount
    frames.push({ nodeId, status, errorCode, scopeIds: activeScopes.map((scope) => scope.instanceId), callStack: activeScopes.filter((scope) => scope.scopeId.startsWith('function:')).map((scope) => ({ instanceId: scope.instanceId, nodeId: scope.nodeId })), globals, localScopes, output: [...output], screens })
  }

  return { frames, record }
}

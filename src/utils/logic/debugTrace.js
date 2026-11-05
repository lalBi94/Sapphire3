// Capture les états scalaires sans conserver de Map mutable dans les instantanés publics.
import { readScreenStates } from './screenState.js'
import { readGaugeStates } from './gaugeState.js'
import { readLedStates } from './ledState.js'

export function createDebugRecorder(analysis, global, output, uninitialized) {
  const frames = []
  const scopes = new Map(analysis.semantic.scopes.map((scope) => [scope.id, scope]))
  const variables = analysis.semantic.symbols.filter((symbol) => !symbol.importedFrom && ['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(symbol.kind))
  const maximumArrayCells = 24
  const bindingCache = new WeakMap()
  let entries = 0
  let previousScreens = null
  let previousGauges = null
  let previousLeds = null

  // Distingue une valeur non initialisée d'une vraie chaîne ou d'un booléen.
  function displayValue(value) {
    if (value && typeof value === 'object' && value.pointer === true) return value.label
    if (value && typeof value === 'object' && value.functionValue === true) return value.label
    if (value && typeof value === 'object' && value.lambdaValue === true) return value.label
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

  // Compare deux présentations de liaison sans dépendre de leur identité.
  function sameBinding(previous, next) {
    if (previous.initialized !== next.initialized || previous.value !== next.value) return false
    if (Boolean(previous.array) !== Boolean(next.array)) return false
    if (previous.array) {
      if (previous.array.length !== next.array.length || previous.array.cells.length !== next.array.cells.length) return false
      for (let index = 0; index < previous.array.cells.length; index += 1) if (previous.array.cells[index] !== next.array.cells[index]) return false
    }
    if (Boolean(previous.pointer) !== Boolean(next.pointer)) return false
    if (previous.pointer) {
      for (const key of ['kind', 'nodeId', 'instanceId', 'arrayNodeId', 'arrayInstanceId', 'index', 'length', 'label', 'constant']) {
        if (previous.pointer[key] !== next.pointer[key]) return false
      }
    }
    return true
  }

  function binding(symbol, environment, retained) {
    const initialized = environment.values.has(symbol.nodeId) && environment.values.get(symbol.nodeId) !== uninitialized
    const value = initialized ? environment.values.get(symbol.nodeId) : undefined
    const array = initialized ? arrayPreview(value) : null
    const pointer = initialized ? pointerPreview(value, environment) : null
    const next = { nodeId: symbol.nodeId, moduleId: symbol.moduleId, name: symbol.name, type: symbol.type, initialized, ...(initialized ? { value: displayValue(value) } : {}), ...(array ? { array } : {}), ...(pointer ? { pointer } : {}) }
    const cache = bindingCache.get(environment) ?? new Map()
    bindingCache.set(environment, cache)
    const previous = cache.get(symbol.nodeId)
    if (previous && sameBinding(previous, next)) return previous
    cache.set(symbol.nodeId, next)
    retained.units += 1 + (array?.cells.length ?? 0)
    return next
  }

  // Produit un état complet à la première image, puis uniquement les pixels modifiés.
  function compactScreens(screens) {
    if (!previousScreens) {
      previousScreens = screens
      return { base: screens, patch: null, units: Object.values(screens).reduce((total, screen) => total + screen.pixels.length, 0) }
    }
    const previousIds = Object.keys(previousScreens)
    const nextIds = Object.keys(screens)
    const patches = []
    if (previousIds.length !== nextIds.length) {
      previousScreens = screens
      return { base: screens, patch: null, units: Object.values(screens).reduce((total, screen) => total + screen.pixels.length, 0) }
    }
    for (const id of nextIds) {
      const before = previousScreens[id]
      const next = screens[id]
      if (!before || before.width !== next.width || before.height !== next.height || before.pixels.length !== next.pixels.length) {
        previousScreens = screens
        return { base: screens, patch: null, units: Object.values(screens).reduce((total, screen) => total + screen.pixels.length, 0) }
      }
      const indices = []
      const values = []
      for (let index = 0; index < next.pixels.length; index += 1) {
        if (next.pixels[index] !== before.pixels[index]) {
          indices.push(index)
          values.push(next.pixels[index])
        }
      }
      if (indices.length) patches.push({ id, indices, values })
    }
    previousScreens = screens
    return { base: null, patch: patches.length ? patches : null, units: patches.reduce((total, patch) => total + patch.indices.length * 2, 0) }
  }

  // Borne la rétention de l'historique ; l'unique état terminal reste toujours disponible.
  function record(nodeId, environment, activeScopes, status = 'paused', errorCode = null) {
    const retained = { units: 0 }
    const globals = variables.filter((symbol) => scopes.get(symbol.scopeId)?.parentId === null).map((symbol) => binding(symbol, global, retained))
    const localScopes = []
    let current = environment
    while (current && current !== global) {
      localScopes.push({ instanceId: current.instanceId, nodeId: current.nodeId, scopeId: current.scopeId, variables: variables.filter((symbol) => symbol.scopeId === current.scopeId).map((symbol) => binding(symbol, current, retained)) })
      current = current.parent
    }
    const previousFrame = frames.at(-1)
    const outputChanged = !previousFrame || previousFrame.output.length !== output.length
    const frameOutput = outputChanged ? [...output] : previousFrame.output
    if (outputChanged) retained.units += output.length
    const compacted = compactScreens(readScreenStates(analysis.source, global.values))
    const gauges = readGaugeStates(analysis.source, global.values)
    const leds = readLedStates(analysis.source, global.values)
    const gaugesChanged = !previousGauges || JSON.stringify(previousGauges) !== JSON.stringify(gauges)
    const ledsChanged = !previousLeds || JSON.stringify(previousLeds) !== JSON.stringify(leds)
    const frameGauges = gaugesChanged ? gauges : previousGauges
    const frameLeds = ledsChanged ? leds : previousLeds
    previousGauges = gauges
    previousLeds = leds
    if (gaugesChanged) retained.units += Object.keys(gauges).length * 3
    if (ledsChanged) retained.units += Object.keys(leds).length
    const count = 1 + retained.units + localScopes.length + activeScopes.length + compacted.units
    if (status === 'paused' && entries + count > 200000) throw Object.assign(new Error('Debug history memory limit reached.'), { code: 'DEBUG_HISTORY_LIMIT' })
    entries += count
    frames.push({
      nodeId, status, errorCode,
      scopeIds: activeScopes.map((scope) => scope.instanceId),
      callStack: activeScopes.filter((scope) => scope.scopeId.startsWith('function:')).map((scope) => ({ instanceId: scope.instanceId, nodeId: scope.nodeId })),
      globals, localScopes, output: frameOutput, gauges: frameGauges, leds: frameLeds,
      ...(compacted.base ? { screenBase: compacted.base } : {}),
      ...(compacted.patch ? { screenPatch: compacted.patch } : {}),
    })
  }

  return { frames, record }
}

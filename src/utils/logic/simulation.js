import { analyzeProgram } from './analysis.js'
import { validateLiteral, convertConstant, evaluateBinary, evaluateUnary } from './numericConstants.js'
import { createDebugRecorder } from './debugTrace.js'
import { satisfiesContract, normalizeContracts } from './contracts.js'

// Ajoute un code stable sans introduire de traduction ni de dépendance UI dans le moteur.
function simulationError(code, message) {
  return Object.assign(new Error(message), { code })
}

// Exécute le sous-ensemble déterministe du langage sans accéder au DOM ni au système.
export function simulateProgram(project, { maxSteps = 10000, captureDebug = false, functionId = null, args = [] } = {}) {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_BUDGET_INVALID', error: 'The step budget must be an integer between 1 and 100000.' }
  const analysis = analyzeProgram(project)
  if (!analysis.canGenerate) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_DIAGNOSTICS', error: 'The program has blocking diagnostics.', diagnostics: analysis.diagnostics }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const types = new Map(analysis.semantic.nodeTypes.map((entry) => [entry.nodeId, entry.type]))
  const functions = new Map(analysis.semantic.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration').map((symbol) => [symbol.nodeId, nodes.get(symbol.nodeId)]))
  // Contraintes vérifiables attachées aux nœuds, lues sur la valeur du symbole déclaré.
  const contracts = []
  for (const node of project.nodes) {
    const kinds = normalizeContracts(node?.contracts).map((contract) => contract.kind)
    if (kinds.length) contracts.push({ nodeId: node.id, name: node.properties?.name || node.id, kinds })
  }
  const contractViolations = []
  const contractStates = new Map()
  let contractObservations = 0
  const maximumContractViolations = 100
  const entry = [...functions.values()].find((node) => node?.properties?.entryPoint === true)
  // Cible explicite (exécuter une fonction choisie) ou, par défaut, le point d'entrée du projet.
  const target = functionId ? nodes.get(functionId) : entry
  const output = []
  const trace = []
  let steps = 0
  const breakSignal = Symbol('break')
  const continueSignal = Symbol('continue')
  const uninitialized = Symbol('uninitialized')
  let callDepth = 0
  let environmentSequence = 0
  let functionScope = null
  const activeScopes = []

  if (functionId && (!target || target.kind !== 'FunctionDeclaration')) return { ok: false, output, trace, errorCode: 'SIMULATION_FUNCTION_MISSING', error: 'The function to run cannot be resolved.' }
  if (!functionId) {
    if (!entry) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_MISSING', error: 'No entry point is marked.' }
    if ((entry.children.parameters ?? []).length > 0) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_INPUTS', error: 'The entry point must not require inputs.' }
  }

  // Valeurs d'entrée fournies par l'appelant, validées selon le type déclaré de chaque paramètre.
  const callArguments = []
  if (functionId) {
    const parameterIds = target.children.parameters ?? []
    if (!Array.isArray(args) || args.length !== parameterIds.length) return { ok: false, output, trace, errorCode: 'SIMULATION_ARGUMENTS_INVALID', error: 'The provided inputs do not match the function parameters.' }
    for (const [index, parameterId] of parameterIds.entries()) {
      const validated = validateLiteral(types.get(parameterId)?.name, args[index])
      if (validated.code) return { ok: false, output, trace, errorCode: 'SIMULATION_ARGUMENTS_INVALID', error: 'An input value is not valid for its parameter type.' }
      callArguments.push(validated.value)
    }
  }

  // Associe chaque activation à son scope source, y compris les itérations et appels récursifs.
  function environment(parent, scopeId, nodeId) {
    environmentSequence += 1
    return { values: new Map(), parent, scopeId, nodeId, instanceId: environmentSequence }
  }

  // Place un arrêt avant l'instruction, sans dévoiler les futurs états ni les futures sorties.
  function observe(node, current) {
    if (!debug) return
    lastEnvironment = current
    lastScopes = [...activeScopes]
    lastInstructionId = node.id
    debug.record(node.id, current, activeScopes)
  }

  // Compte aussi les itérations sans condition ni instruction pour garantir l'arrêt.
  function step(node) {
    steps += 1
    if (steps > maxSteps) throw simulationError('SIMULATION_STEP_LIMIT', 'Simulation step limit reached.')
    trace.push(node.id)
    return node
  }

  // Cherche une déclaration dans les environnements lexicaux actifs, sans valeur implicite.
  function readBinding(nodeId, environment) {
    if (environment.values.has(nodeId)) {
      const value = environment.values.get(nodeId)
      if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
      return value
    }
    if (environment.parent) return readBinding(nodeId, environment.parent)
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
  }

  // Modifie uniquement une déclaration existante dans la chaîne lexicale.
  function writeBinding(nodeId, value, environment) {
    if (environment.values.has(nodeId)) {
      environment.values.set(nodeId, value)
      return
    }
    if (environment.parent) {
      writeBinding(nodeId, value, environment.parent)
      return
    }
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was changed before it was initialized.')
  }

  // Réutilise les contrôles numériques statiques sur les valeurs calculées à l'exécution.
  function checked(result) {
    if (result.code) throw simulationError(result.code, `${result.code}: ${result.message}`)
    return result.value
  }

  // Convertit une valeur entière source en index JavaScript et contrôle les bornes du tableau.
  function arrayIndex(value, array) {
    const index = typeof value === 'bigint' ? Number(value) : value
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= array.length) {
      throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array index is outside its bounds.')
    }
    return index
  }

  // Lit un élément en refusant les cases jamais remplies, comme une variable sans initialiseur.
  function readElement(array, index) {
    const value = array[index]
    if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'An array element was read before it was initialized.')
    return value
  }

  // Évalue une expression typée, avec court-circuit pour les opérateurs booléens.
  function valueOf(node, environment) {
    step(node)
    if (node.kind === 'Literal') return checked(validateLiteral(types.get(node.id)?.name, node.properties.value))
    if (node.kind === 'Reference') {
      const symbol = symbols.get(references.get(node.id)?.symbolId)
      if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The reference cannot be resolved.')
      return readBinding(symbol.nodeId, environment)
    }
    if (node.kind === 'BinaryExpression') {
      const operator = node.properties.operator
      const left = valueOf(nodes.get(node.children.left), environment)
      if (operator === 'and' && !left) return false
      if (operator === 'or' && left) return true
      const right = valueOf(nodes.get(node.children.right), environment)
      return checked(evaluateBinary(operator, left, right, types.get(node.children.left)?.name))
    }
    if (node.kind === 'UnaryExpression') return checked(evaluateUnary(node.properties.operator, valueOf(nodes.get(node.children.operand), environment), types.get(node.id)?.name))
    if (node.kind === 'CastExpression') {
      const value = valueOf(nodes.get(node.children.argument), environment)
      const target = types.get(node.id)?.name
      return target === types.get(node.children.argument)?.name ? value : checked(convertConstant(value, target))
    }
    if (node.kind === 'CallExpression') {
      const callee = nodes.get(node.children.callee)
      const symbol = symbols.get(references.get(callee?.id)?.symbolId)
      const target = symbol ? functions.get(symbol.nodeId) : null
      if (!target) throw simulationError('SIMULATION_REFERENCE', 'The called function cannot be resolved.')
      return executeFunction(target, (node.children.arguments ?? []).map((id) => valueOf(nodes.get(id), environment)))
    }
    if (node.kind === 'ArrayLiteral') {
      return (node.children.elements ?? []).map((id) => valueOf(nodes.get(id), environment))
    }
    if (node.kind === 'ArrayCreation') {
      const sizeValue = valueOf(nodes.get(node.children.size), environment)
      const size = typeof sizeValue === 'bigint' ? Number(sizeValue) : sizeValue
      if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
        throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array size must be a non-negative integer.')
      }
      const fill = node.children.initializer ? valueOf(nodes.get(node.children.initializer), environment) : uninitialized
      const values = []
      for (let position = 0; position < size; position += 1) {
        step(node)
        values.push(fill)
      }
      return values
    }
    if (node.kind === 'ArrayAccess') {
      const array = valueOf(nodes.get(node.children.array), environment)
      if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
      return readElement(array, arrayIndex(valueOf(nodes.get(node.children.index), environment), array))
    }
    throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported expression: ${node.kind}.`)
  }

  // Lit une liaison sans lever d'erreur : une valeur absente rend le contrat non évaluable.
  function peekBinding(nodeId, environment) {
    let current = environment
    while (current) {
      if (current.values.has(nodeId)) {
        const value = current.values.get(nodeId)
        return value === uninitialized ? undefined : value
      }
      current = current.parent
    }
    return undefined
  }

  // Liste les variables observées (globales puis scope de la fonction visée) avec type et valeur.
  function collectVariables() {
    const list = []
    const add = (scope, kind) => {
      if (!scope) return
      for (const [id, value] of scope.values) {
        const node = nodes.get(id)
        list.push({ id, name: node?.properties?.name ?? id, kind, type: typeText(types.get(id)), value: value === uninitialized ? null : formatValue(value) })
      }
    }
    add(global, 'global')
    if (functionScope && functionScope !== global) add(functionScope, 'local')
    return list
  }

  // Vérifie chaque contrat sur l'état courant ; une violation n'est signalée qu'une fois par valeur observée.
  function checkContracts(environment) {
    if (contracts.length === 0) return
    for (const entry of contracts) {
      const value = peekBinding(entry.nodeId, environment)
      if (value === undefined) continue
      for (const kind of entry.kinds) {
        const satisfied = satisfiesContract(kind, value)
        if (satisfied === null) continue
        contractObservations += 1
        const key = `${entry.nodeId}:${kind}`
        if (satisfied) { contractStates.delete(key); continue }
        const observed = formatValue(value)
        const previous = contractStates.get(key)
        if (!previous || previous !== observed) {
          contractStates.set(key, observed)
          if (contractViolations.length < maximumContractViolations) contractViolations.push({ nodeId: entry.nodeId, name: entry.name, kind, step: steps, value: observed })
        }
      }
    }
  }

  // Vérifie les contrats après chaque instruction, même si un retour interrompt la suite.
  function executeStatement(node, environment) {
    try {
      runStatement(node, environment)
    } finally {
      checkContracts(environment)
    }
  }

  // Exécute une instruction et propage les contrôles de flux jusqu'à leur propriétaire.
  function runStatement(node, environment) {
    if (debug) {
      lastEnvironment = environment
      lastScopes = [...activeScopes]
      lastInstructionId = node.id
    }
    step(node)
    if (!['WhileStatement', 'ForStatement', 'FunctionDeclaration', 'TypeDeclaration', 'Block'].includes(node.kind)) observe(node, environment)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
      environment.values.set(node.id, node.children.initializer ? valueOf(nodes.get(node.children.initializer), environment) : uninitialized)
      return
    }
    if (node.kind === 'PrintStatement') {
      output.push(formatValue(valueOf(nodes.get(node.children.value), environment)))
      return
    }
    if (node.kind === 'AssignmentStatement') {
      const target = nodes.get(node.children.target)
      if (target?.kind === 'ArrayAccess') {
        const array = valueOf(nodes.get(target.children.array), environment)
        if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
        const index = arrayIndex(valueOf(nodes.get(target.children.index), environment), array)
        array[index] = valueOf(nodes.get(node.children.value), environment)
        return
      }
      const symbol = symbols.get(references.get(target?.id)?.symbolId)
      if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The assignment target cannot be resolved.')
      writeBinding(symbol.nodeId, valueOf(nodes.get(node.children.value), environment), environment)
      return
    }
    if (node.kind === 'ExpressionStatement') {
      valueOf(nodes.get(node.children.expression), environment)
      return
    }
    if (node.kind === 'IfStatement') {
      const branch = valueOf(nodes.get(node.children.test), environment) ? node.children.consequent : node.children.alternate
      if (branch) executeBlock(nodes.get(branch), environment)
      return
    }
    if (node.kind === 'WhileStatement') {
      while (true) {
        observe(node, environment)
        if (!valueOf(nodes.get(node.children.test), environment)) break
        try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
      }
      return
    }
    if (node.kind === 'ForStatement') {
      executeFor(node, environment)
      return
    }
    if (node.kind === 'ReturnStatement') throw { type: 'return', value: node.children.argument ? valueOf(nodes.get(node.children.argument), environment) : undefined }
    if (node.kind === 'BreakStatement') throw breakSignal
    if (node.kind === 'ContinueStatement') throw continueSignal
    if (node.kind === 'Block') executeBlock(node, environment)
    else if (!['FunctionDeclaration', 'TypeDeclaration', 'Parameter'].includes(node.kind)) throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported statement: ${node.kind}.`)
  }

  // Garde l'initialiseur et l'update dans la même activation de boucle, séparée du bloc de corps.
  function executeFor(node, parent) {
    const current = environment(parent, `for:${node.id}`, node.id)
    activeScopes.push(current)
    try {
      if (node.children.initializer) executeStatement(nodes.get(node.children.initializer), current)
      while (true) {
        observe(node, current)
        if (node.children.test && !valueOf(nodes.get(node.children.test), current)) break
        step(node)
        try { executeBlock(nodes.get(node.children.body), current) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
        if (node.children.update) {
          const update = nodes.get(node.children.update)
          if (update.kind === 'AssignmentStatement') executeStatement(update, current)
          else {
            observe(update, current)
            valueOf(update, current)
          }
        }
      }
    } finally {
      activeScopes.pop()
    }
  }

  // Recrée les variables d'un bloc à chaque entrée, notamment dans les boucles.
  function executeBlock(block, parent, reuse = false) {
    const current = reuse ? parent : environment(parent, `block:${block.id}`, block.id)
    if (!reuse) activeScopes.push(current)
    try {
      for (const id of block.children.statements ?? []) executeStatement(nodes.get(id), current)
    } finally {
      if (!reuse) activeScopes.pop()
    }
  }

  // Isole chaque appel du contexte de l'appelant et borne la récursion avant la pile JavaScript.
  function executeFunction(node, args) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const current = environment(global, `function:${node.id}`, node.id)
    if (callDepth === 1) functionScope = current
    activeScopes.push(current)
    for (const [index, parameterId] of (node.children.parameters ?? []).entries()) current.values.set(parameterId, args[index])
    try {
      observe(node, current)
      executeBlock(nodes.get(node.children.body), current, true)
    } catch (signal) {
      if (signal?.type === 'return') return signal.value
      throw signal
    } finally {
      activeScopes.pop()
      callDepth -= 1
    }
    return undefined
  }

  const global = { values: new Map(), parent: null }
  const debug = captureDebug ? createDebugRecorder(analysis, global, output, uninitialized) : null
  let lastEnvironment = global
  let lastScopes = []
  let lastInstructionId = null
  try {
    for (const module of project.modules) {
      for (const id of module.rootNodeIds) {
        const node = nodes.get(id)
        if (node && node.kind !== 'FunctionDeclaration') executeStatement(node, global)
      }
    }
    const returned = executeFunction(target, callArguments)
    debug?.record(null, global, [], 'completed')
    return {
      ok: true,
      output,
      trace,
      result: typeof returned === 'bigint' ? Number(returned) : returned,
      returnValue: returned === undefined ? null : formatValue(returned),
      steps,
      variables: collectVariables(),
      contracts: { total: contracts.reduce((count, entry) => count + entry.kinds.length, 0), observations: contractObservations, violations: contractViolations },
      ...(debug ? { debugFrames: debug.frames } : {}),
    }
  } catch (error) {
    const errorCode = error?.code ?? 'SIMULATION_FAILED'
    debug?.record(lastInstructionId, lastEnvironment, lastScopes, 'error', errorCode)
    return { ok: false, output, trace, errorCode, error: error instanceof Error ? error.message : 'Simulation stopped.', steps, ...(debug ? { debugFrames: debug.frames } : {}) }
  }
}

// Rend une référence de type lisible brièvement.
function typeText(type) {
  if (!type) return null
  if (type.kind === 'primitive') return type.name
  if (type.kind === 'array') return `${typeText(type.elementType) ?? '?'}[]`
  if (type.kind === 'function') return 'function'
  return type.kind
}

// Rend une valeur de simulation lisible sans perdre la distinction booléenne.
function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'symbol') return 'uninitialized'
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  return String(value)
}

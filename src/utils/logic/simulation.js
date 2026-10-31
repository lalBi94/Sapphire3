import { analyzeProgram } from './analysis.js'
import { validateLiteral, convertConstant, evaluateBinary, evaluateUnary } from './numericConstants.js'

// Ajoute un code stable sans introduire de traduction ni de dépendance UI dans le moteur.
function simulationError(code, message) {
  return Object.assign(new Error(message), { code })
}

// Exécute le sous-ensemble déterministe du langage sans accéder au DOM ni au système.
export function simulateProgram(project, { maxSteps = 10000 } = {}) {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_BUDGET_INVALID', error: 'The step budget must be an integer between 1 and 100000.' }
  const analysis = analyzeProgram(project)
  if (!analysis.canGenerate) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_DIAGNOSTICS', error: 'The program has blocking diagnostics.', diagnostics: analysis.diagnostics }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const types = new Map(analysis.semantic.nodeTypes.map((entry) => [entry.nodeId, entry.type]))
  const functions = new Map(analysis.semantic.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration').map((symbol) => [symbol.nodeId, nodes.get(symbol.nodeId)]))
  const entry = [...functions.values()].find((node) => node?.properties?.entryPoint === true)
  const output = []
  const trace = []
  let steps = 0
  const breakSignal = Symbol('break')
  const continueSignal = Symbol('continue')
  const uninitialized = Symbol('uninitialized')
  let callDepth = 0

  if (!entry) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_MISSING', error: 'No entry point is marked.' }
  if ((entry.children.parameters ?? []).length > 0) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_INPUTS', error: 'The entry point must not require inputs.' }

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
    throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported expression: ${node.kind}.`)
  }

  // Exécute une instruction et propage les contrôles de flux jusqu'à leur propriétaire.
  function executeStatement(node, environment) {
    step(node)
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
      while (valueOf(nodes.get(node.children.test), environment)) {
        try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
      }
      return
    }
    if (node.kind === 'ForStatement') {
      environment = { values: new Map(), parent: environment }
      if (node.children.initializer) executeStatement(nodes.get(node.children.initializer), environment)
      while (!node.children.test || valueOf(nodes.get(node.children.test), environment)) {
        step(node)
        try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
        if (node.children.update) {
          const update = nodes.get(node.children.update)
          if (update.kind === 'AssignmentStatement') executeStatement(update, environment)
          else valueOf(update, environment)
        }
      }
      return
    }
    if (node.kind === 'ReturnStatement') throw { type: 'return', value: node.children.argument ? valueOf(nodes.get(node.children.argument), environment) : undefined }
    if (node.kind === 'BreakStatement') throw breakSignal
    if (node.kind === 'ContinueStatement') throw continueSignal
    if (node.kind === 'Block') executeBlock(node, environment)
    else if (!['FunctionDeclaration', 'TypeDeclaration', 'Parameter'].includes(node.kind)) throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported statement: ${node.kind}.`)
  }

  // Recrée les variables d'un bloc à chaque entrée, notamment dans les boucles.
  function executeBlock(block, parent) {
    const environment = { values: new Map(), parent }
    for (const id of block.children.statements ?? []) executeStatement(nodes.get(id), environment)
  }

  // Isole chaque appel du contexte de l'appelant et borne la récursion avant la pile JavaScript.
  function executeFunction(node, args) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const environment = { values: new Map(), parent: global }
    for (const [index, parameterId] of (node.children.parameters ?? []).entries()) environment.values.set(parameterId, args[index])
    try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
      if (signal?.type === 'return') return signal.value
      throw signal
    } finally {
      callDepth -= 1
    }
    return undefined
  }

  const global = { values: new Map(), parent: null }
  try {
    for (const module of project.modules) {
      for (const id of module.rootNodeIds) {
        const node = nodes.get(id)
        if (node && node.kind !== 'FunctionDeclaration') executeStatement(node, global)
      }
    }
    const result = executeFunction(entry, [])
    return { ok: true, output, trace, result: typeof result === 'bigint' ? Number(result) : result, steps }
  } catch (error) {
    return { ok: false, output, trace, errorCode: error?.code ?? 'SIMULATION_FAILED', error: error instanceof Error ? error.message : 'Simulation stopped.', steps }
  }
}

// Rend une valeur de simulation lisible sans perdre la distinction booléenne.
function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

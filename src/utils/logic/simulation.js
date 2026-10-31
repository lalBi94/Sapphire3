import { analyzeProgram } from './analysis.js'

// Exécute le sous-ensemble déterministe du langage sans accéder au DOM ni au système.
export function simulateProgram(project, { maxSteps = 10000 } = {}) {
  const analysis = analyzeProgram(project)
  if (!analysis.canGenerate) return { ok: false, output: [], trace: [], error: 'The program has blocking diagnostics.', diagnostics: analysis.diagnostics }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const functions = new Map(analysis.semantic.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration').map((symbol) => [symbol.nodeId, nodes.get(symbol.nodeId)]))
  const entry = [...functions.values()].find((node) => node?.properties?.entryPoint === true)
  const output = []
  const trace = []
  let steps = 0
  const breakSignal = Symbol('break')
  const continueSignal = Symbol('continue')

  if (!entry) return { ok: false, output, trace, error: 'No entry point is marked.' }
  if ((entry.children.parameters ?? []).length > 0) return { ok: false, output, trace, error: 'The entry point must not require inputs.' }

  function step(node) {
    steps += 1
    if (steps > maxSteps) throw new Error('Simulation step limit reached.')
    trace.push(node.id)
    return node
  }

  function readBinding(nodeId, environment) {
    if (environment.values.has(nodeId)) return environment.values.get(nodeId)
    if (environment.parent) return readBinding(nodeId, environment.parent)
    throw new Error('A value was read before it was initialized.')
  }

  function writeBinding(nodeId, value, environment) {
    if (environment.values.has(nodeId)) {
      environment.values.set(nodeId, value)
      return
    }
    if (environment.parent) {
      writeBinding(nodeId, value, environment.parent)
      return
    }
    throw new Error('A value was changed before it was initialized.')
  }

  function valueOf(node, environment) {
    step(node)
    if (node.kind === 'Literal') return parseLiteral(node.properties.type?.name, node.properties.value)
    if (node.kind === 'Reference') {
      const symbol = symbols.get(references.get(node.id)?.symbolId)
      return symbol ? readBinding(symbol.nodeId, environment) : undefined
    }
    if (node.kind === 'BinaryExpression') return binary(node.properties.operator, valueOf(nodes.get(node.children.left), environment), valueOf(nodes.get(node.children.right), environment))
    if (node.kind === 'UnaryExpression') return unary(node.properties.operator, valueOf(nodes.get(node.children.operand), environment))
    if (node.kind === 'CastExpression') return valueOf(nodes.get(node.children.argument), environment)
    if (node.kind === 'CallExpression') {
      const callee = nodes.get(node.children.callee)
      const symbol = symbols.get(references.get(callee?.id)?.symbolId)
      const target = symbol ? functions.get(symbol.nodeId) : null
      if (!target) throw new Error('The called function cannot be resolved.')
      return executeFunction(target, (node.children.arguments ?? []).map((id) => valueOf(nodes.get(id), environment)), environment)
    }
    throw new Error(`Unsupported expression: ${node.kind}.`)
  }

  function executeStatement(node, environment) {
    step(node)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
      environment.values.set(node.id, node.children.initializer ? valueOf(nodes.get(node.children.initializer), environment) : undefined)
      return
    }
    if (node.kind === 'PrintStatement') {
      output.push(formatValue(valueOf(nodes.get(node.children.value), environment)))
      return
    }
    if (node.kind === 'AssignmentStatement') {
      const target = nodes.get(node.children.target)
      const symbol = symbols.get(references.get(target?.id)?.symbolId)
      if (!symbol) throw new Error('The assignment target cannot be resolved.')
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
      if (node.children.initializer) executeStatement(nodes.get(node.children.initializer), environment)
      while (!node.children.test || valueOf(nodes.get(node.children.test), environment)) {
        try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
        if (node.children.update) executeStatement(nodes.get(node.children.update), environment)
      }
      return
    }
    if (node.kind === 'ReturnStatement') throw { type: 'return', value: node.children.argument ? valueOf(nodes.get(node.children.argument), environment) : undefined }
    if (node.kind === 'BreakStatement') throw breakSignal
    if (node.kind === 'ContinueStatement') throw continueSignal
    if (node.kind === 'Block') executeBlock(node, environment)
    else if (node.kind !== 'FunctionDeclaration' && node.kind !== 'Parameter') throw new Error(`Unsupported statement: ${node.kind}.`)
  }

  function executeBlock(block, environment) {
    for (const id of block.children.statements ?? []) executeStatement(nodes.get(id), environment)
  }

  function executeFunction(node, args, parent = null) {
    const environment = { values: new Map(), parent }
    for (const [index, parameterId] of (node.children.parameters ?? []).entries()) environment.values.set(parameterId, args[index])
    try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
      if (signal?.type === 'return') return signal.value
      throw signal
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
    const result = executeFunction(entry, [], global)
    return { ok: true, output, trace, result, steps }
  } catch (error) {
    return { ok: false, output, trace, error: error instanceof Error ? error.message : 'Simulation stopped.', steps }
  }
}

// Convertit un littéral persistant vers une valeur utilisable par la simulation.
function parseLiteral(type, value) {
  if (type === 'boolean') return value === true || value === 'true'
  if (['short int', 'short uint', 'int', 'uint', 'float', 'double'].includes(type)) return Number(value)
  return value
}

// Applique les opérations déjà validées statiquement par le moteur.
function binary(operator, left, right) {
  if (operator === 'and') return left && right
  if (operator === 'or') return left || right
  if (operator === '==') return left === right
  if (operator === '!=') return left !== right
  if (operator === '/') return Math.trunc(left / right)
  if (operator === '%') return left % right
  const operations = { '+': () => left + right, '-': () => left - right, '*': () => left * right, '<': () => left < right, '<=': () => left <= right, '>': () => left > right, '>=': () => left >= right }
  if (!operations[operator]) throw new Error(`Unsupported operator: ${operator}.`)
  return operations[operator]()
}

// Applique les opérations unaires déjà validées statiquement par le moteur.
function unary(operator, value) {
  if (operator === 'not') return !value
  if (operator === '-') return -value
  if (operator === '+') return +value
  throw new Error(`Unsupported operator: ${operator}.`)
}

// Rend une valeur de simulation lisible sans perdre la distinction booléenne.
function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

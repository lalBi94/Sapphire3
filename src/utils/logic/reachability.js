import { analyzeProgram } from './analysis.js'

// Prouve seulement les exclusions structurelles ; une condition inconnue garde ses deux chemins possibles.
export function analyzeReachability(project, analysis = analyzeProgram(project)) {
  if (!analysis.canGenerate) return { ok: false, reachableNodeIds: [], unreachableNodeIds: [], functions: [] }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const reachable = new Set()
  const pendingFunctions = []
  const scheduledFunctions = new Set()
  const declarations = project.nodes.filter((node) => node.kind === 'FunctionDeclaration')

  // Enregistre une fonction appelée sans dérouler récursivement son graphe d'appels.
  function schedule(id) {
    if (!id || scheduledFunctions.has(id)) return
    scheduledFunctions.add(id)
    pendingFunctions.push(id)
  }

  // Suit les expressions effectivement possibles et les cibles d'appel résolues par le moteur.
  function expression(id) {
    const node = nodes.get(id)
    if (!node || reachable.has(id)) return
    reachable.add(id)
    if (node.kind === 'CallExpression') {
      const reference = references.get(node.children.callee)
      schedule(symbols.get(reference?.symbolId)?.nodeId)
    }
    for (const [slot, value] of Object.entries(node.children)) {
      if (node.kind === 'BinaryExpression' && slot === 'right') {
        const left = knownBoolean(node.children.left)
        if (node.properties.operator === 'and' && left === false || node.properties.operator === 'or' && left === true) continue
      }
      for (const child of Array.isArray(value) ? value : [value]) if (child) expression(child)
    }
  }

  // Reconnaît les seuls littéraux et combinaisons booléennes certaines, sans lire de variable ni appeler de fonction.
  function knownBoolean(id) {
    const node = nodes.get(id)
    if (node?.kind === 'Literal' && typeof node.properties.value === 'boolean') return node.properties.value
    if (node?.kind === 'UnaryExpression' && node.properties.operator === 'not') {
      const operand = knownBoolean(node.children.operand)
      return operand === null ? null : !operand
    }
    if (node?.kind === 'BinaryExpression' && ['and', 'or'].includes(node.properties.operator)) {
      const left = knownBoolean(node.children.left)
      const right = knownBoolean(node.children.right)
      if (node.properties.operator === 'and') return left === false || right === false ? false : left === true && right === true ? true : null
      return left === true || right === true ? true : left === false && right === false ? false : null
    }
    return null
  }

  // Combine les sorties de contrôle et ignore les instructions après un transfert certain.
  function sequence(ids) {
    const exits = new Set(['normal'])
    for (const id of ids) {
      if (!exits.delete('normal')) break
      for (const exit of statement(id)) exits.add(exit)
    }
    return exits
  }

  // Analyse un bloc, une branche ou une boucle sans confondre break et retour de fonction.
  function statement(id) {
    const node = nodes.get(id)
    if (!node) return new Set(['normal'])
    if (node.kind === 'FunctionDeclaration') return new Set(['normal'])
    reachable.add(id)
    if (node.kind === 'Block') return sequence(node.children.statements)
    if (node.kind === 'IfStatement') {
      expression(node.children.test)
      const known = knownBoolean(node.children.test)
      const exits = new Set()
      if (known !== false) for (const exit of statement(node.children.consequent)) exits.add(exit)
      if (known !== true) for (const exit of statement(node.children.alternate)) exits.add(exit)
      return exits
    }
    if (node.kind === 'WhileStatement' || node.kind === 'ForStatement') {
      if (node.children.initializer) statement(node.children.initializer)
      expression(node.children.test)
      const known = node.kind === 'ForStatement' && !node.children.test ? true : knownBoolean(node.children.test)
      if (known === false) return new Set(['normal'])
      const body = statement(node.children.body)
      if (body.has('normal') || body.has('continue')) {
        const update = nodes.get(node.children.update)
        if (update?.kind === 'AssignmentStatement') statement(update.id)
        else expression(update?.id)
      }
      const exits = new Set()
      if (known !== true || body.has('break')) exits.add('normal')
      if (body.has('return')) exits.add('return')
      return exits
    }
    for (const value of Object.values(node.children)) {
      for (const child of Array.isArray(value) ? value : [value]) if (child) expression(child)
    }
    if (node.kind === 'ReturnStatement') return new Set(['return'])
    if (node.kind === 'BreakStatement') return new Set(['break'])
    if (node.kind === 'ContinueStatement') return new Set(['continue'])
    return new Set(['normal'])
  }

  const globalExits = sequence(project.modules.flatMap((module) => module.rootNodeIds))
  const entry = declarations.find((node) => node.properties.entryPoint === true)
  if (globalExits.has('normal')) schedule(entry?.id)
  for (let position = 0; position < pendingFunctions.length; position += 1) {
    const node = nodes.get(pendingFunctions[position])
    if (node?.kind !== 'FunctionDeclaration') continue
    reachable.add(node.id)
    for (const id of node.children.parameters) reachable.add(id)
    statement(node.children.body)
  }
  return {
    ok: true,
    reachableNodeIds: project.nodes.filter((node) => reachable.has(node.id)).map((node) => node.id),
    unreachableNodeIds: project.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id),
    functions: declarations.map((node) => ({ nodeId: node.id, reachable: scheduledFunctions.has(node.id) })),
  }
}

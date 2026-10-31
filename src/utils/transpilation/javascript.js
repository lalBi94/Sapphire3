import { createDiagnostic } from '../logic/diagnostics.js'
import { getNodeSchema } from '../logic/nodeSchema.js'
import { createNumericOperations, validateLiteral } from '../logic/numericConstants.js'
import { primitiveDefinitions } from '../logic/primitives.js'
import { diagnosticCodes } from '../logic/diagnostics.js'

const operators = Object.freeze({
  and: '&&',
  or: '||',
  not: '!',
})

const reservedWords = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'let', 'new', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
])

// Transforme un nom Sapphire en identifiant JavaScript sûr et déterministe.
function identifier(name, fallback = 'value') {
  const source = typeof name === 'string' ? name : fallback
  const normalized = source.replace(/[^\w$]/g, '_')
  const result = /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`
  return reservedWords.has(result) ? `_${result}` : result
}

// Retourne l'enfant AST présent dans un emplacement simple.
function child(node, name) {
  const value = node?.children?.[name]
  return value && !Array.isArray(value) && !['Invalid', 'Hole'].includes(value.kind) ? value : null
}

// Produit le code JavaScript d'un programme Sapphire déjà analysé.
export function generateJavaScript(analysis, { selection = null } = {}) {
  const diagnostics = []
  const { ast, semantic } = analysis
  const nodes = semantic.index.nodes
  const symbolByNode = semantic.index.symbolByNode
  const referenceSymbols = semantic.index.referenceSymbols
  const typeByNode = new Map((semantic.nodeTypes ?? []).map(({ nodeId, type }) => [nodeId, type]))
  const entryPoints = [...nodes.values()].filter((node) => node.kind === 'FunctionDeclaration' && node.properties.entryPoint === true)

  if (!selection) {
    if (entryPoints.length === 0) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_REQUIRED', 'Une fonction point d’entrée est nécessaire pour générer du JavaScript.', { projectId: ast.sourceId }))
    if (entryPoints.length > 1) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_DUPLICATE', 'Une seule fonction point d’entrée est autorisée pour générer du JavaScript.', { projectId: ast.sourceId }))
    if (entryPoints.length === 1 && entryPoints[0].children.parameters.length > 0) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_INPUTS', 'Le point d’entrée ne doit pas demander de paramètres.', entryPoints[0].location))
  }

  const generatedNames = new Map()
  const usedNames = new Set(['main', 'sapphireNumeric', 'sapphireChecked', 'sapphireRead', 'sapphireUninitialized', 'console', 'Math', 'Number', 'BigInt', 'Object', 'Error'])
  const declarations = [...nodes.values()].filter((node) => getNodeSchema(node.kind)?.named)
  const modules = new Map(ast.modules.map((module) => [module.sourceId, module]))

  // Réserve un nom global unique pour chaque déclaration visible dans le fichier produit.
  function reserveDeclaration(node) {
    if (generatedNames.has(node.sourceId)) return generatedNames.get(node.sourceId)
    const symbol = symbolByNode.get(node.sourceId)
    const module = modules.get(node.moduleId)
    const base = node.kind === 'FunctionDeclaration'
      ? identifier(`${module?.name ?? node.moduleId}_${node.properties.name}`, 'function')
      : identifier(`${module?.name ?? node.moduleId}_${node.properties.name}`, 'value')
    let name = base
    let suffix = 2
    while (usedNames.has(name)) name = `${base}_${suffix++}`
    usedNames.add(name)
    generatedNames.set(node.sourceId, name)
    if (symbol) generatedNames.set(symbol.id, name)
    return name
  }

  declarations.forEach(reserveDeclaration)
  const entryName = entryPoints.length === 1 ? reserveDeclaration(entryPoints[0]) : null

  // Retourne le nom produit pour une référence sémantiquement résolue.
  function referenceName(node) {
    const symbol = referenceSymbols.get(node.sourceId)
    if (!symbol) {
      diagnostics.push(createDiagnostic('TRANSPILE_REFERENCE_UNRESOLVED', 'Une référence ne peut pas être générée.', node.location))
      return 'undefined'
    }
    if (generatedNames.has(symbol.id)) return generatedNames.get(symbol.id)
    const target = nodes.get(symbol.nodeId)
    return target ? reserveDeclaration(target) : identifier(symbol.name)
  }

  // Génère une expression en conservant la structure et les opérateurs de l'AST.
  function expression(node) {
    if (!node) return 'undefined'
    if (node.kind === 'Literal') {
      const literal = validateLiteral(typeByNode.get(node.sourceId)?.name, node.properties.value)
      if (!literal.code) {
        if (typeof literal.value === 'bigint') return `(${literal.value}n)`
        if (Object.is(literal.value, -0)) return '(-0)'
        return JSON.stringify(literal.value)
      }
      diagnostics.push(createDiagnostic('TRANSPILE_LITERAL_UNSUPPORTED', 'Littéral non pris en charge par le backend JavaScript.', node.location))
      return 'undefined'
    }
    if (node.kind === 'Reference') return `sapphireRead(${referenceName(node)})`
    if (node.kind === 'BinaryExpression') {
      const operator = operators[node.properties.operator] ?? node.properties.operator
      const left = expression(child(node, 'left'))
      const right = expression(child(node, 'right'))
      if (['and', 'or'].includes(node.properties.operator)) return `(${left} ${operator} ${right})`
      const operandType = typeByNode.get(child(node, 'left')?.sourceId)?.name
      return `sapphireChecked(sapphireNumeric.evaluateBinary(${JSON.stringify(node.properties.operator)}, ${left}, ${right}, ${JSON.stringify(operandType)}))`
    }
    if (node.kind === 'UnaryExpression') {
      return `sapphireChecked(sapphireNumeric.evaluateUnary(${JSON.stringify(node.properties.operator)}, ${expression(child(node, 'operand'))}, ${JSON.stringify(typeByNode.get(node.sourceId)?.name)}))`
    }
    if (node.kind === 'CallExpression') {
      return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    }
    if (node.kind === 'CastExpression') {
      const target = typeByNode.get(node.sourceId)?.name
      const argument = expression(child(node, 'argument'))
      return target === typeByNode.get(child(node, 'argument')?.sourceId)?.name ? argument : `sapphireChecked(sapphireNumeric.convertConstant(${argument}, ${JSON.stringify(target)}))`
    }
    diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', `Expression ${node.kind} non prise en charge.`, node.location))
    return 'undefined'
  }

  // Diffère les initialiseurs globaux et marque explicitement les variables sans valeur.
  function declaration(node, indent, initialize = true) {
    const keyword = initialize && node.kind === 'ConstantDeclaration' ? 'const' : 'let'
    const name = generatedNames.get(node.sourceId) ?? reserveDeclaration(node)
    const initializer = child(node, 'initializer')
    return `${indent}${keyword} ${name} = ${initialize && initializer ? expression(initializer) : 'sapphireUninitialized'};`
  }

  // Génère un bloc avec indentation stable et sans introduire de syntaxe implicite.
  function block(node, level) {
    const indent = '  '.repeat(level)
    const lines = []
    for (const statement of node?.children?.statements ?? []) {
      const result = statementCode(statement, level)
      if (result) lines.push(result)
    }
    return [`${indent}{`, ...lines, `${'  '.repeat(Math.max(0, level - 1))}}`].join('\n')
  }

  // Génère une instruction Sapphire prise en charge par le backend JavaScript.
  function statementCode(node, level) {
    if (!node) return ''
    const indent = '  '.repeat(level)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') return declaration(node, indent)
    if (node.kind === 'ExpressionStatement') return `${indent}${expression(child(node, 'expression'))};`
    if (node.kind === 'AssignmentStatement') return `${indent}${referenceName(child(node, 'target'))} = ${expression(child(node, 'value'))};`
    if (node.kind === 'PrintStatement') return `${indent}console.log(String(${expression(child(node, 'value'))}));`
    if (node.kind === 'ReturnStatement') {
      const argument = child(node, 'argument')
      return `${indent}return${argument ? ` ${expression(argument)}` : ''};`
    }
    if (node.kind === 'BreakStatement' || node.kind === 'ContinueStatement') return `${indent}${node.kind === 'BreakStatement' ? 'break' : 'continue'};`
    if (node.kind === 'IfStatement') {
      const alternate = child(node, 'alternate')
      return `${indent}if (${expression(child(node, 'test'))}) ${block(child(node, 'consequent'), level + 1)}${alternate ? ` else ${block(alternate, level + 1)}` : ''}`
    }
    if (node.kind === 'WhileStatement') return `${indent}while (${expression(child(node, 'test'))}) ${block(child(node, 'body'), level + 1)}`
    if (node.kind === 'ForStatement') {
      const initializer = child(node, 'initializer')
      const update = child(node, 'update')
      const initCode = initializer
        ? statementCode(initializer, 0).trim().replace(/;$/, '')
        : ''
      const updateCode = update ? (update.kind === 'AssignmentStatement' ? statementCode(update, 0).trim().replace(/;$/, '') : expression(update)) : ''
      const test = child(node, 'test')
      return `${indent}for (${initCode}; ${test ? expression(test) : ''}; ${updateCode}) ${block(child(node, 'body'), level + 1)}`
    }
    if (node.kind === 'Block') return `${indent}${block(node, level + 1)}`
    if (node.kind === 'TypeDeclaration') return ''
    diagnostics.push(createDiagnostic('TRANSPILE_STATEMENT_UNSUPPORTED', `Instruction ${node.kind} non prise en charge.`, node.location))
    return ''
  }

  // Génère une fonction avec ses paramètres et son corps lexical.
  function functionCode(node) {
    const name = generatedNames.get(node.sourceId) ?? reserveDeclaration(node)
    const parameters = (node.children.parameters ?? []).map((parameter) => reserveDeclaration(parameter))
    const body = block(child(node, 'body'), 1)
    return `function ${name}(${parameters.join(', ')}) ${body}`
  }

  if (selection) {
    const selected = selection.kind === 'module' ? modules.get(selection.id) : nodes.get(selection.id)
    if (!selected) return { ok: false, code: '', diagnostics: [{ code: 'TARGET_MISSING' }] }
    const subtree = new Set()
    const pending = selection.kind === 'module' ? [...selected.body] : [selected]
    while (pending.length > 0) {
      const node = pending.pop()
      if (!node || subtree.has(node.sourceId)) continue
      subtree.add(node.sourceId)
      pending.push(...Object.values(node.children ?? {}).flat().filter((value) => value && typeof value === 'object'))
    }
    const blocking = analysis.diagnostics.filter((entry) => entry.severity === 'error' && (subtree.has(entry.location.nodeId) || (selection.kind === 'module' && entry.location.moduleId === selection.id)))
    if (blocking.length > 0) return { ok: false, code: '', diagnostics: blocking }

    // Adapte seulement le contexte syntaxique de l'extrait, sans réimplémenter son émission.
    function snippet(node) {
      if (node.kind === 'FunctionDeclaration') return functionCode(node)
      if (node.kind === 'Parameter') return reserveDeclaration(node)
      if (node.kind === 'TypeDeclaration') return ''
      if (getNodeSchema(node.kind)?.category === 'expression') return expression(node)
      return statementCode(node, 0)
    }

    const code = selection.kind === 'module' ? selected.body.map(snippet).filter(Boolean).join('\n\n') : snippet(selected)
    return { ok: diagnostics.length === 0, code: diagnostics.length ? '' : code, diagnostics }
  }

  const functions = []
  const globalDeclarations = []
  const globalInitializers = []
  for (const module of ast.modules) {
    for (const node of module.body) {
      if (node.kind === 'FunctionDeclaration') functions.push(functionCode(node))
      else if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
        globalDeclarations.push(declaration(node, '', false))
        if (child(node, 'initializer')) globalInitializers.push(`  ${generatedNames.get(node.sourceId)} = ${expression(child(node, 'initializer'))};`)
      } else {
        const code = statementCode(node, 1)
        if (code) globalInitializers.push(code)
      }
    }
  }

  const lines = [
    '// Generated by Sapphire 3. Do not edit this file.',
    `const sapphireNumeric = (${createNumericOperations.toString()})(name => (${JSON.stringify(primitiveDefinitions)})[name], ${JSON.stringify(diagnosticCodes)});`,
    'const sapphireUninitialized = Symbol("uninitialized");',
    'function sapphireRead(value) { if (value === sapphireUninitialized) throw new Error("SIMULATION_UNINITIALIZED"); return value; }',
    'function sapphireChecked(result) { if (result.code) throw new Error(result.code); return result.value; }',
    ...globalDeclarations,
    ...functions,
    '',
    'function main() {',
    ...globalInitializers,
    ...(entryName ? [`  ${entryName}();`] : []),
    '}',
    '',
    'main();',
  ]
  return { code: lines.join('\n'), diagnostics }
}

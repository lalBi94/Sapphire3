import { createDiagnostic } from '../logic/diagnostics.js'
import { getNodeSchema } from '../logic/nodeSchema.js'

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
export function generateJavaScript(analysis) {
  const diagnostics = []
  const { ast, semantic } = analysis
  const nodes = semantic.index.nodes
  const symbolByNode = semantic.index.symbolByNode
  const referenceSymbols = semantic.index.referenceSymbols
  const typeByNode = new Map((semantic.nodeTypes ?? []).map(({ nodeId, type }) => [nodeId, type]))
  const entryPoints = [...nodes.values()].filter((node) => node.kind === 'FunctionDeclaration' && node.properties.entryPoint === true)

  if (entryPoints.length === 0) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_REQUIRED', 'Une fonction point d’entrée est nécessaire pour générer du JavaScript.', { projectId: ast.sourceId }))
  if (entryPoints.length > 1) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_DUPLICATE', 'Une seule fonction point d’entrée est autorisée pour générer du JavaScript.', { projectId: ast.sourceId }))

  const generatedNames = new Map()
  const usedNames = new Set(['main'])
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
      const type = node.properties.type?.name
      if (type === 'string' || type === 'char') return JSON.stringify(String(node.properties.value ?? ''))
      if (type === 'boolean') return node.properties.value ? 'true' : 'false'
      if (['short int', 'short uint', 'int', 'uint', 'float', 'double'].includes(type)) {
        const numericValue = typeof node.properties.value === 'number' || typeof node.properties.value === 'bigint'
          ? Number(node.properties.value)
          : typeof node.properties.value === 'string' && node.properties.value.trim() !== ''
            ? Number(node.properties.value)
            : Number.NaN
        if (Number.isFinite(numericValue)) return Object.is(numericValue, -0) ? '-0' : String(numericValue)
      }
      diagnostics.push(createDiagnostic('TRANSPILE_LITERAL_UNSUPPORTED', 'Littéral non pris en charge par le backend JavaScript.', node.location))
      return 'undefined'
    }
    if (node.kind === 'Reference') return referenceName(node)
    if (node.kind === 'BinaryExpression') {
      const operator = operators[node.properties.operator] ?? node.properties.operator
      const left = expression(child(node, 'left'))
      const right = expression(child(node, 'right'))
      const resultType = typeByNode.get(node.sourceId)
      if (node.properties.operator === '/' && resultType?.kind === 'primitive' && ['short int', 'short uint', 'int', 'uint'].includes(resultType.name)) {
        return `sapphireIntegerDivide(${left}, ${right})`
      }
      return `(${left} ${operator} ${right})`
    }
    if (node.kind === 'UnaryExpression') {
      const operator = operators[node.properties.operator] ?? node.properties.operator
      return `(${operator}${expression(child(node, 'operand'))})`
    }
    if (node.kind === 'CallExpression') {
      return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    }
    if (node.kind === 'CastExpression') {
      const target = node.properties.type?.name
      const argument = expression(child(node, 'argument'))
      return ['short int', 'short uint', 'int', 'uint'].includes(target) ? `Math.trunc(Number(${argument}))` : argument
    }
    diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', `Expression ${node.kind} non prise en charge.`, node.location))
    return 'undefined'
  }

  // Génère une déclaration locale ou globale sans exécuter son initialiseur à la déclaration.
  function declaration(node, indent, initialize = true) {
    const keyword = node.kind === 'ConstantDeclaration' ? 'const' : 'let'
    const name = generatedNames.get(node.sourceId) ?? reserveDeclaration(node)
    const initializer = child(node, 'initializer')
    return `${indent}${keyword} ${name}${initialize && initializer ? ` = ${expression(initializer)}` : ''};`
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
    if (node.kind === 'AssignmentStatement') return `${indent}${expression(child(node, 'target'))} = ${expression(child(node, 'value'))};`
    if (node.kind === 'PrintStatement') return `${indent}console.log(${expression(child(node, 'value'))});`
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
      const updateCode = update ? statementCode(update, 0).trim().replace(/;$/, '') : ''
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
    const parameters = (node.children.parameters ?? []).map((parameter) => {
      const parameterName = identifier(parameter.properties.name, 'parameter')
      generatedNames.set(parameter.sourceId, parameterName)
      const symbol = symbolByNode.get(parameter.sourceId)
      if (symbol) generatedNames.set(symbol.id, parameterName)
      return parameterName
    })
    const body = block(child(node, 'body'), 1)
    return `function ${name}(${parameters.join(', ')}) ${body}`
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
    'function sapphireIntegerDivide(left, right) { return Math.trunc(left / right); }',
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

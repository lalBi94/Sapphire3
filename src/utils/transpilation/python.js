import { createDiagnostic } from '../logic/diagnostics.js'
import { validateLiteral } from '../logic/numericConstants.js'
import { child, createGenerationContext, generateSelection } from './context.js'
import { pythonRuntime, pythonRuntimeNames } from './pythonRuntime.js'
import { getMathNative } from '../logic/mathNatives.js'

const reservedWords = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield', '__debug__',
])

// Traduit chaque opération native vers l'équivalent Python le plus direct.
// Les helpers ne servent qu'aux sémantiques que les natifs Python ne préservent pas seuls.
const nativePython = Object.freeze({
  abs: ([value]) => `abs(${value})`,
  min: ([left, right]) => `min(${left}, ${right})`,
  max: ([left, right]) => `max(${left}, ${right})`,
  clamp: ([value, lower, upper]) => `sapphireClamp(${value}, ${lower}, ${upper})`,
  sign: ([value]) => `sapphireSign(${value})`,
  gcd: ([left, right]) => `_sapphireMath.gcd(${left}, ${right})`,
  pow: ([base, exponent]) => `sapphirePow(${base}, ${exponent})`,
  lerp: ([start, end, ratio]) => `sapphireLerp(${start}, ${end}, ${ratio})`,
  log: ([value]) => `sapphireLog(${value})`,
  sqrt: ([value]) => `sapphireSqrt(${value})`,
  sin: ([value]) => `sapphireFinite(_sapphireMath.sin(${value}))`,
  cos: ([value]) => `sapphireFinite(_sapphireMath.cos(${value}))`,
  tan: ([value]) => `sapphireFinite(_sapphireMath.tan(${value}))`,
  floor: ([value]) => `sapphireFloor(${value})`,
  ceil: ([value]) => `sapphireCeil(${value})`,
  round: ([value]) => `sapphireRound(${value})`,
  randomDouble: () => '_sapphireRandom.random()',
  randomInt: ([min, max]) => `_sapphireRandom.randint(${min}, ${max})`,
  length: ([value]) => `len(${value})`,
  charAt: ([value, index]) => `sapphireCharAt(${value}, ${index})`,
  substring: ([value, start, end]) => `sapphireSubstring(${value}, ${start}, ${end})`,
  contains: ([value, search]) => `(${search} in ${value})`,
  arrayLength: ([value]) => `len(${value})`,
  arraySlice: ([value, start, end]) => `sapphireArraySlice(${value}, ${start}, ${end})`,
  arrayConcat: ([left, right]) => `(${left}) + (${right})`,
  arrayContains: ([value, search]) => `(${search} in ${value})`,
  arrayIndexOf: ([value, search]) => `sapphireArrayIndexOf(${value}, ${search})`,
  arrayReverse: ([value]) => `(${value})[::-1]`,
  stringSplit: ([value, separator]) => `(${value}).split(${separator})`,
  stringJoin: ([values, separator]) => `(${separator}).join(${values})`,
  stringIndexOf: ([value, search]) => `(${value}).find(${search})`,
})

// Émet Python 3 depuis l'AST typé commun, sans réexécuter ni réinterpréter la source.
export function generatePython(analysis, { selection = null } = {}) {
  const context = createGenerationContext(analysis, { selection, reservedWords, runtimeNames: pythonRuntimeNames })
  const { ast, nodes, parents, typeByNode, diagnostics, reserveDeclaration, referenceName, entryName } = context
  const referenceSymbols = analysis.semantic.index.referenceSymbols
  const symbolByNode = analysis.semantic.index.symbolByNode
  // Les variables dont l'adresse est prise vivent dans une cellule mutable.
  const cellSymbols = new Set()
  for (const node of nodes.values()) {
    if (node.kind !== 'UnaryExpression' || node.properties?.operator !== '&') continue
    const operand = child(node, 'operand')
    if (operand?.kind !== 'Reference') continue
    const symbol = referenceSymbols.get(operand.sourceId)
    if (symbol) cellSymbols.add(symbol.id)
  }
  const globals = ast.modules.flatMap((module) => module.body).filter((node) => ['VariableDeclaration', 'ConstantDeclaration'].includes(node.kind))
  const globalIds = new Set(globals.map((node) => node.sourceId))
  const globalEntries = globals.map((node) => ({ node, name: reserveDeclaration(node), cell: cellSymbols.has(symbolByNode.get(node.sourceId)?.id) }))
  const isCell = (node) => cellSymbols.has(symbolByNode.get(node.sourceId)?.id)
  // Accède à la cellule d'une variable adressée, ou directement au nom sinon.
  function referenceCode(node) {
    const symbol = referenceSymbols.get(node?.sourceId)
    const name = referenceName(node)
    return symbol && cellSymbols.has(symbol.id) ? `${name}[0]` : name
  }

  // Convertit les seules valeurs déjà validées par le moteur, notamment l'arrondi direct des float.
  function literalCode(node) {
    const type = typeByNode.get(node.sourceId)?.name
    const literal = validateLiteral(type, node.properties.value)
    if (literal.code) {
      diagnostics.push(createDiagnostic('TRANSPILE_LITERAL_UNSUPPORTED', 'Littéral non pris en charge.', node.location))
      return 'None'
    }
    const value = literal.value
    if (typeof value === 'string') {
      if ([...value].some((character) => { const point = character.codePointAt(0); return point >= 0xd800 && point <= 0xdfff })) {
        diagnostics.push(createDiagnostic('TRANSPILE_PYTHON_STRING_UNSUPPORTED', 'Python ne peut pas exporter ce texte Unicode contenant un surrogate isolé.', node.location))
        return 'None'
      }
      return JSON.stringify(value)
    }
    if (typeof value === 'boolean') return value ? 'True' : 'False'
    if (typeof value === 'bigint') return `(${value})`
    if (Object.is(value, -0)) return '(-0.0)'
    const text = String(value)
    return `(${/[.eE]/.test(text) ? text : `${text}.0`})`
  }

  // Réutilise les types résolus et conserve le court-circuit sans conversions Python implicites.
  function expression(node) {
    if (!node) return 'None'
    if (node.kind === 'Literal') return literalCode(node)
    if (node.kind === 'Reference') return `sapphireRead(${referenceCode(node)})`
    if (node.kind === 'BinaryExpression') {
      const left = expression(child(node, 'left'))
      const right = expression(child(node, 'right'))
      const operator = node.properties.operator
      if (['and', 'or'].includes(operator)) return `(${left} ${operator} ${right})`
      const leftType = typeByNode.get(child(node, 'left')?.sourceId)
      if (['==', '!='].includes(operator) && leftType?.kind === 'pointer') {
        const equality = `sapphirePointerEqual(${left}, ${right})`
        return operator === '!=' ? `(not ${equality})` : equality
      }
      return `sapphireBinary(${JSON.stringify(operator)}, ${left}, ${right}, ${JSON.stringify(leftType?.name)})`
    }
    if (node.kind === 'UnaryExpression') {
      const operator = node.properties.operator
      if (operator === '*') return `sapphireDeref(${expression(child(node, 'operand'))})`
      if (operator === '&') {
        const operand = child(node, 'operand')
        if (operand?.kind === 'Reference') {
          const symbol = referenceSymbols.get(operand.sourceId)
          const label = symbol?.name ?? referenceName(operand)
          return `sapphirePointer(${referenceName(operand)}, None, ${symbol?.kind === 'ConstantDeclaration' ? 'True' : 'False'}, ${JSON.stringify(`&${label}`)})`
        }
        if (operand?.kind === 'ArrayAccess') {
          const arraySymbol = child(operand, 'array')?.kind === 'Reference' ? referenceSymbols.get(child(operand, 'array').sourceId) : null
          return `sapphireElementPointer(${expression(child(operand, 'array'))}, ${expression(child(operand, 'index'))}, ${arraySymbol?.kind === 'ConstantDeclaration' ? 'True' : 'False'})`
        }
        if (operand?.kind === 'UnaryExpression' && operand.properties.operator === '*') return expression(child(operand, 'operand'))
        diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', 'Adresse d’une expression non prise en charge.', node.location))
        return 'None'
      }
      return `sapphireUnary(${JSON.stringify(operator)}, ${expression(child(node, 'operand'))}, ${JSON.stringify(typeByNode.get(node.sourceId)?.name)})`
    }
    if (node.kind === 'CallExpression') return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    if (node.kind === 'CastExpression') {
      const argument = expression(child(node, 'argument'))
      const target = typeByNode.get(node.sourceId)?.name
      return target === typeByNode.get(child(node, 'argument')?.sourceId)?.name ? argument : `sapphireCast(${argument}, ${JSON.stringify(target)})`
    }
    if (node.kind === 'ArrayLiteral') return `[${(node.children.elements ?? []).map((element) => expression(element)).join(', ')}]`
    if (node.kind === 'ArrayCreation') {
      const size = `sapphireArray(${expression(child(node, 'size'))})`
      const initializer = child(node, 'initializer')
      return `([${initializer ? expression(initializer) : 'sapphireUninitialized'}] * ${size})`
    }
    if (node.kind === 'ArrayAccess') return `sapphireElement(${expression(child(node, 'array'))}, ${expression(child(node, 'index'))})`
    if (node.kind === 'MathCall') {
      const definition = getMathNative(node.properties?.name)
      const emitter = definition ? nativePython[definition.id] : null
      if (emitter) return emitter((node.children.arguments ?? []).map(expression))
      diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', `Opération native ${node.properties?.name ?? '?'} non prise en charge.`, node.location))
      return 'None'
    }
    diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', 'Expression non prise en charge.', node.location))
    return 'None'
  }

  // Invalide une ancienne activation avant d'évaluer l'initialiseur, y compris dans une boucle.
  function declaration(node, level) {
    const indent = '    '.repeat(level)
    const name = reserveDeclaration(node)
    const initializer = child(node, 'initializer')
    if (isCell(node)) return `${indent}${name} = [sapphireUninitialized]${initializer ? `\n${indent}${name}[0] = ${expression(initializer)}` : ''}`
    return `${indent}${name} = sapphireUninitialized${initializer ? `\n${indent}${name} = ${expression(initializer)}` : ''}`
  }

  // Rend une update expression comme instruction, sans inventer un nœud ExpressionStatement.
  function updateCode(node, level) {
    return node.kind === 'AssignmentStatement' ? statementCode(node, level) : `${'    '.repeat(level)}${expression(node)}`
  }

  // Réinitialise les déclarations propres au bloc et garde un pass pour les suites vides.
  function block(node, level, loop = null, trailing = '') {
    const statements = node?.children?.statements ?? []
    const indent = '    '.repeat(level)
    const reset = statements.filter((statement) => ['VariableDeclaration', 'ConstantDeclaration'].includes(statement.kind)).map((statement) => `${indent}${reserveDeclaration(statement)} = sapphireUninitialized`)
    const lines = [...reset, ...statements.map((statement) => statementCode(statement, level, loop)).filter(Boolean), trailing].filter(Boolean)
    return lines.length ? lines.join('\n') : `${indent}pass`
  }

  // Abaisse les structures Python en préservant update/continue, break et les scopes Sapphire.
  function statementCode(node, level, loop = null) {
    if (!node) return ''
    const indent = '    '.repeat(level)
    if (['VariableDeclaration', 'ConstantDeclaration'].includes(node.kind)) return declaration(node, level)
    if (node.kind === 'ExpressionStatement') return `${indent}${expression(child(node, 'expression'))}`
    if (node.kind === 'AssignmentStatement') {
      const target = child(node, 'target')
      const value = expression(child(node, 'value'))
      if (target?.kind === 'UnaryExpression' && target.properties.operator === '*') return `${indent}sapphireDerefWrite(${expression(child(target, 'operand'))}, ${value})`
      if (target?.kind === 'ArrayAccess') return `${indent}sapphireWrite(${expression(child(target, 'array'))}, ${expression(child(target, 'index'))}, ${value})`
      return `${indent}${referenceCode(target)} = ${value}`
    }
    if (node.kind === 'PrintStatement') return `${indent}print(sapphireFormat(${expression(child(node, 'value'))}))`
    if (node.kind === 'ForEachStatement') return `${indent}sapphireForEach(${expression(child(node, 'array'))}, ${expression(child(node, 'callback'))})`
    if (node.kind === 'ReturnStatement') return `${indent}return${child(node, 'argument') ? ` ${expression(child(node, 'argument'))}` : ''}`
    if (node.kind === 'BreakStatement') return `${indent}break`
    if (node.kind === 'ContinueStatement') return `${loop?.update ? `${updateCode(loop.update, level)}\n` : ''}${indent}continue`
    if (node.kind === 'IfStatement') {
      const alternate = child(node, 'alternate')
      return `${indent}if ${expression(child(node, 'test'))}:\n${block(child(node, 'consequent'), level + 1, loop)}${alternate ? `\n${indent}else:\n${block(alternate, level + 1, loop)}` : ''}`
    }
    if (node.kind === 'WhileStatement') return `${indent}while ${expression(child(node, 'test'))}:\n${block(child(node, 'body'), level + 1)}`
    if (node.kind === 'ForStatement') {
      const initializer = child(node, 'initializer')
      const test = child(node, 'test')
      const update = child(node, 'update')
      return `${initializer ? `${statementCode(initializer, level)}\n` : ''}${indent}while ${test ? expression(test) : 'True'}:\n${block(child(node, 'body'), level + 1, { update }, update ? updateCode(update, level + 1) : '')}`
    }
    if (node.kind === 'Block') return `${indent}if True:\n${block(node, level + 1, loop)}`
    if (node.kind === 'TypeDeclaration') return ''
    diagnostics.push(createDiagnostic('TRANSPILE_STATEMENT_UNSUPPORTED', 'Instruction non prise en charge.', node.location))
    return ''
  }

  // Déclare global uniquement pour les affectations qui ciblent les variables racines des modules.
  function writtenGlobals(root) {
    const names = new Set()
    const pending = [root]
    while (pending.length) {
      const node = pending.pop()
      if (!node) continue
      if (node.kind === 'AssignmentStatement') {
        const symbol = analysis.semantic.index.referenceSymbols.get(child(node, 'target')?.sourceId)
        if (globalIds.has(symbol?.nodeId)) names.add(reserveDeclaration(nodes.get(symbol.nodeId)))
      }
      pending.push(...Object.values(node.children ?? {}).flat().filter((value) => value && typeof value === 'object'))
    }
    return [...names]
  }

  // Émet une fonction avec paramètres uniques, globals modifiés et corps lexical réinitialisé.
  function functionCode(node) {
    const names = writtenGlobals(node)
    const parameterNodes = node.children.parameters
    const parameterNames = parameterNodes.map(reserveDeclaration)
    const wrapped = parameterNodes.map((parameter, index) => isCell(parameter) ? `    ${parameterNames[index]} = [${parameterNames[index]}]` : null).filter(Boolean)
    return `def ${reserveDeclaration(node)}(${parameterNames.join(', ')}):\n${names.length ? `    global ${names.join(', ')}\n` : ''}${wrapped.length ? `${wrapped.join('\n')}\n` : ''}${block(child(node, 'body'), 1)}`
  }

  // Retrouve l'update de la boucle englobante pour un aperçu de continue ou de sous-bloc.
  function enclosingLoop(node) {
    let parent = parents.get(node.sourceId)
    while (parent && parent.kind !== 'FunctionDeclaration') {
      if (parent.kind === 'WhileStatement') return null
      if (parent.kind === 'ForStatement') return { update: child(parent, 'update') }
      parent = parents.get(parent.sourceId)
    }
    return null
  }
  const preview = generateSelection(context, { functionCode, expression, statementCode: (node, level) => statementCode(node, level, enclosingLoop(node)) })
  if (preview) return preview

  const functions = []
  const initializers = []
  for (const module of ast.modules) for (const node of module.body) {
    if (node.kind === 'FunctionDeclaration') functions.push(functionCode(node))
    else {
      const code = statementCode(node, 1)
      if (code) initializers.push(code)
    }
  }
  const globalNames = globalEntries.map((entry) => entry.name)
  const code = [
    '# Généré par Sapphire 3. Ne pas modifier ce fichier.', pythonRuntime(),
    ...globalEntries.map(({ name, cell }) => `${name} = ${cell ? '[sapphireUninitialized]' : 'sapphireUninitialized'}`), '', ...functions, '',
    'def main():', ...(globalNames.length ? [`    global ${globalNames.join(', ')}`] : []),
    ...globalEntries.map(({ name, cell }) => `    ${name} = ${cell ? '[sapphireUninitialized]' : 'sapphireUninitialized'}`), ...initializers,
    ...(entryName ? [`    ${entryName}()`] : ['    pass']), '',
    'if __name__ == "__main__":', '    main()', '',
  ].join('\n')
  return { code: diagnostics.length ? '' : code, diagnostics }
}

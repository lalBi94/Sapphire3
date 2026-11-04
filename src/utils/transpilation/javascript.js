import { createDiagnostic } from '../logic/diagnostics.js'
import { child, createGenerationContext, generateSelection } from './context.js'
import { createNumericOperations, validateLiteral } from '../logic/numericConstants.js'
import { primitiveDefinitions } from '../logic/primitives.js'
import { diagnosticCodes } from '../logic/diagnostics.js'
import { getMathNative } from '../logic/mathNatives.js'

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

// Traduit chaque opération native vers l'équivalent JavaScript le plus direct.
// Les helpers ne servent qu'aux sémantiques que les natifs JS ne préservent pas seuls.
const nativeJavaScript = Object.freeze({
  abs: ([value]) => `sapphireIntegerAbs(${value})`,
  min: ([left, right]) => `sapphireIntegerMin(${left}, ${right})`,
  max: ([left, right]) => `sapphireIntegerMax(${left}, ${right})`,
  clamp: ([value, lower, upper]) => `sapphireClamp(${value}, ${lower}, ${upper})`,
  sign: ([value]) => `sapphireSign(${value})`,
  gcd: ([left, right]) => `sapphireGcd(${left}, ${right})`,
  pow: ([base, exponent]) => `sapphireFinite(Math.pow(${base}, ${exponent}))`,
  lerp: ([start, end, ratio]) => `sapphireLerp(${start}, ${end}, ${ratio})`,
  log: ([value]) => `sapphireFinite(Math.log(${value}))`,
  sqrt: ([value]) => `sapphireFinite(Math.sqrt(${value}))`,
  sin: ([value]) => `sapphireFinite(Math.sin(${value}))`,
  cos: ([value]) => `sapphireFinite(Math.cos(${value}))`,
  tan: ([value]) => `sapphireFinite(Math.tan(${value}))`,
  floor: ([value]) => `sapphireFinite(Math.floor(${value}))`,
  ceil: ([value]) => `sapphireFinite(Math.ceil(${value}))`,
  round: ([value]) => `sapphireFinite(Math.round(${value}))`,
  randomDouble: () => 'Math.random()',
  randomInt: ([min, max]) => `sapphireRandomInt(${min}, ${max})`,
  length: ([value]) => `BigInt(Array.from(${value}).length)`,
  charAt: ([value, index]) => `sapphireCharAt(${value}, ${index})`,
  substring: ([value, start, end]) => `sapphireSubstring(${value}, ${start}, ${end})`,
  contains: ([value, search]) => `(${value}).includes(${search})`,
  arrayLength: ([value]) => `BigInt((${value}).length)`,
  arraySlice: ([value, start, end]) => `sapphireArraySlice(${value}, ${start}, ${end})`,
  arrayConcat: ([left, right]) => `[...(${left}), ...(${right})]`,
  arrayContains: ([value, search]) => `(${value}).includes(${search})`,
  arrayIndexOf: ([value, search]) => `sapphireArrayIndexOf(${value}, ${search})`,
  arrayReverse: ([value]) => `[...(${value})].reverse()`,
  stringSplit: ([value, separator]) => `(${value}).split(${separator})`,
  stringJoin: ([values, separator]) => `(${values}).join(${separator})`,
  stringIndexOf: ([value, search]) => `sapphireStringIndexOf(${value}, ${search})`,
})

// Produit le code JavaScript d'un programme Sapphire déjà analysé.
export function generateJavaScript(analysis, { selection = null } = {}) {
  const context = createGenerationContext(analysis, { selection, reservedWords, allowDollar: true, runtimeNames: ['sapphireNumeric', 'sapphireChecked', 'sapphireRead', 'sapphireUninitialized', 'sapphireArray', 'sapphireElement', 'sapphireWrite', 'sapphireForEach', 'sapphireFinite', 'sapphireIntegerAbs', 'sapphireIntegerMin', 'sapphireIntegerMax', 'sapphireClamp', 'sapphireSign', 'sapphireGcd', 'sapphireRandomInt', 'sapphireLerp', 'sapphireCharAt', 'sapphireSubstring', 'sapphireArraySlice', 'sapphireArrayIndexOf', 'sapphireStringIndexOf', 'console', 'Math', 'Number', 'BigInt', 'Object', 'Error', 'Array'] })
  const { ast, diagnostics, typeByNode, generatedNames, reserveDeclaration, referenceName, entryName } = context

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
      const operator = node.properties.operator
      if (operator === '&' || operator === '*') {
        diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', `Opérateur ${operator} (pointeur) non pris en charge par le backend JavaScript.`, node.location))
        return 'undefined'
      }
      return `sapphireChecked(sapphireNumeric.evaluateUnary(${JSON.stringify(operator)}, ${expression(child(node, 'operand'))}, ${JSON.stringify(typeByNode.get(node.sourceId)?.name)}))`
    }
    if (node.kind === 'CallExpression') {
      return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    }
    if (node.kind === 'CastExpression') {
      const target = typeByNode.get(node.sourceId)?.name
      const argument = expression(child(node, 'argument'))
      return target === typeByNode.get(child(node, 'argument')?.sourceId)?.name ? argument : `sapphireChecked(sapphireNumeric.convertConstant(${argument}, ${JSON.stringify(target)}))`
    }
    if (node.kind === 'ArrayLiteral') return `[${(node.children.elements ?? []).map((element) => expression(element)).join(', ')}]`
    if (node.kind === 'ArrayCreation') {
      const size = expression(child(node, 'size'))
      const initializer = child(node, 'initializer')
      if (initializer) return `((sapphireValue) => Array.from({ length: sapphireArray(${size}) }, () => sapphireValue))(${expression(initializer)})`
      return `Array.from({ length: sapphireArray(${size}) }, () => sapphireUninitialized)`
    }
    if (node.kind === 'ArrayAccess') {
      return `sapphireElement(${expression(child(node, 'array'))}, ${expression(child(node, 'index'))})`
    }
    if (node.kind === 'MathCall') {
      const definition = getMathNative(node.properties?.name)
      const emitter = definition ? nativeJavaScript[definition.id] : null
      if (emitter) return emitter((node.children.arguments ?? []).map(expression))
      diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', `Opération native ${node.properties?.name ?? '?'} non prise en charge.`, node.location))
      return 'undefined'
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
    if (node.kind === 'AssignmentStatement') {
      const target = child(node, 'target')
      const value = expression(child(node, 'value'))
      if (target?.kind === 'ArrayAccess') return `${indent}sapphireWrite(${expression(child(target, 'array'))}, ${expression(child(target, 'index'))}, ${value});`
      return `${indent}${referenceName(target)} = ${value};`
    }
    if (node.kind === 'PrintStatement') return `${indent}console.log(String(${expression(child(node, 'value'))}));`
    // ForEach parcourt une copie du tableau pour figer les éléments visités.
    if (node.kind === 'ForEachStatement') return `${indent}sapphireForEach(${expression(child(node, 'array'))}, ${expression(child(node, 'callback'))});`
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

  const preview = generateSelection(context, { functionCode, statementCode, expression })
  if (preview) return preview

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
    'function sapphireArray(length) { if (typeof length !== "number" && typeof length !== "bigint" || !Number.isInteger(Number(length)) || Number(length) < 0) throw new Error("SIMULATION_ARRAY_BOUNDS"); return Number(length); }',
    'function sapphireElement(array, index) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); if (index < 0 || index >= array.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); const value = array[index]; if (value === sapphireUninitialized) throw new Error("SIMULATION_UNINITIALIZED"); return value; }',
    'function sapphireWrite(array, index, value) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); if (index < 0 || index >= array.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); array[index] = value; }',
    'function sapphireForEach(array, callback) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); if (typeof callback !== "function") throw new Error("SIMULATION_REFERENCE"); for (const element of [...array]) callback(element); }',
    'function sapphireFinite(value) { if (!Number.isFinite(value)) throw new Error("SIMULATION_MATH_DOMAIN"); return value; }',
    'function sapphireIntegerAbs(value) { return value < 0n ? -value : value; }',
    'function sapphireIntegerMin(left, right) { return left < right ? left : right; }',
    'function sapphireIntegerMax(left, right) { return left > right ? left : right; }',
    'function sapphireClamp(value, lower, upper) { return value < lower ? lower : value > upper ? upper : value; }',
    'function sapphireSign(value) { return value < 0n ? -1n : value > 0n ? 1n : 0n; }',
    'function sapphireGcd(left, right) { let a = left < 0n ? -left : left; let b = right < 0n ? -right : right; while (b !== 0n) { const remainder = a % b; a = b; b = remainder; } return a; }',
    'function sapphireRandomInt(min, max) { const lower = Number(min); const upper = Number(max); if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower > upper) throw new Error("SIMULATION_RANDOM_RANGE"); return BigInt(lower + Math.floor(Math.random() * (upper - lower + 1))); }',
    'function sapphireLerp(start, end, ratio) { return sapphireFinite(start + (end - start) * ratio); }',
    'function sapphireCharAt(value, index) { const characters = Array.from(value); const position = Number(index); if (!Number.isInteger(position) || position < 0 || position >= characters.length) throw new Error("SIMULATION_STRING_BOUNDS"); return characters[position]; }',
    'function sapphireSubstring(value, start, end) { const characters = Array.from(value); const from = Number(start); const to = Number(end); if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > to || to > characters.length) throw new Error("SIMULATION_STRING_BOUNDS"); return characters.slice(from, to).join(""); }',
    'function sapphireArraySlice(value, start, end) { if (!Array.isArray(value)) throw new Error("SIMULATION_REFERENCE"); const from = Number(start); const to = Number(end); if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > to || to > value.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); return value.slice(from, to); }',
    'function sapphireArrayIndexOf(value, search) { if (!Array.isArray(value)) throw new Error("SIMULATION_REFERENCE"); return BigInt(value.indexOf(search)); }',
    'function sapphireStringIndexOf(value, search) { const index = value.indexOf(search); return index < 0 ? -1n : BigInt(Array.from(value.slice(0, index)).length); }',
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

import { createDiagnostic } from '../logic/diagnostics.js'
import { child, createGenerationContext, generateSelection, generationMetadata } from './context.js'
import { createNumericOperations, validateLiteral } from '../logic/numericConstants.js'
import { primitiveDefinitions } from '../logic/primitives.js'
import { diagnosticCodes } from '../logic/diagnostics.js'
import { getMathNative } from '../logic/mathNatives.js'
import { moduleInitializationOrder } from '../logic/moduleInitialization.js'

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
  const context = createGenerationContext(analysis, { selection, reservedWords, allowDollar: true, reservedMemberNames: ['constructor', '__proto__'], runtimeNames: ['sapphireNumeric', 'sapphireChecked', 'sapphireRead', 'sapphireUninitialized', 'sapphireArray', 'sapphireElement', 'sapphireWrite', 'sapphirePointer', 'sapphireElementPointer', 'sapphireDeref', 'sapphireDerefWrite', 'sapphirePointerEqual', 'sapphireForEach', 'sapphireFinite', 'sapphireIntegerAbs', 'sapphireIntegerMin', 'sapphireIntegerMax', 'sapphireClamp', 'sapphireSign', 'sapphireGcd', 'sapphireRandomInt', 'sapphireLerp', 'sapphireCharAt', 'sapphireSubstring', 'sapphireArraySlice', 'sapphireArrayIndexOf', 'sapphireStringIndexOf', 'sapphireClassTag', 'sapphireFieldNames', 'sapphireMember', 'sapphireFormat', 'console', 'Math', 'Number', 'BigInt', 'Object', 'Error', 'Array', 'Symbol', 'Set', 'String'] })
  const { ast, nodes, diagnostics, typeByNode, generatedNames, reserveDeclaration, reserveSyntheticName, referenceName, memberName, classNames, classMembers, classMemberNames, entryName } = context
  const referenceSymbols = analysis.semantic.index.referenceSymbols
  const symbolByNode = analysis.semantic.index.symbolByNode
  // Repère les variables et paramètres dont l'adresse est prise, pour leur donner une identité stable.
  const addressedSymbols = new Set()
  for (const node of nodes.values()) {
    if (node.kind !== 'UnaryExpression' || node.properties?.operator !== '&') continue
    const operand = child(node, 'operand')
    if (operand?.kind !== 'Reference') continue
    const symbol = referenceSymbols.get(operand.sourceId)
    if (symbol) addressedSymbols.add(symbol.id)
  }
  const addressTokens = new Map()
  for (const node of nodes.values()) {
    if (!['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(node.kind)) continue
    const symbol = symbolByNode.get(node.sourceId)
    if (!symbol || !addressedSymbols.has(symbol.id)) continue
    addressTokens.set(symbol.id, reserveSyntheticName(`sapphireAddress_${reserveDeclaration(node)}`))
  }

  // Liste les champs et méthodes d'une classe dans l'ordre d'initialisation du simulateur.
  function classFields(members) {
    const fields = []
    for (const scope of ['public', 'private']) {
      for (const [name, id] of members?.[scope] ?? []) {
        const node = nodes.get(id)
        if (node?.kind === 'VariableDeclaration' || node?.kind === 'ConstantDeclaration') fields.push({ name, node })
      }
    }
    return fields
  }

  function classMethods(members) {
    const methods = []
    for (const scope of ['public', 'private']) {
      for (const [name, id] of members?.[scope] ?? []) {
        const node = nodes.get(id)
        if (node?.kind === 'FunctionDeclaration' && node.properties.constructor !== true) methods.push({ name, node })
      }
    }
    return methods
  }

  // Retrouve le nom généré d'un membre dans sa classe, ou un nom sûr hors classe.
  function memberNameFor(classId, name) {
    return classMemberNames.get(classId)?.get(name) ?? memberName(name)
  }

  function memberNameOf(node, name) {
    const objectType = typeByNode.get(child(node, 'object')?.sourceId)
    return memberNameFor(objectType?.kind === 'class' ? objectType.classId : null, name)
  }

  // Émet une instanciation avec les initialiseurs de champs évalués dans la portée appelante.
  function newExpressionCode(node) {
    const classId = node.properties?.classId
    const className = classNames.get(classId)
    if (!className) {
      diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', 'Classe inconnue pour cette instanciation.', node.location))
      return 'undefined'
    }
    const fields = classFields(classMembers.get(classId))
    const initializers = fields.map((field) => child(field.node, 'initializer') ? expression(child(field.node, 'initializer')) : 'sapphireUninitialized')
    const args = (node.children.arguments ?? []).map(expression)
    return `new ${className}(${[...initializers, ...args].join(', ')})`
  }

  // Émet une classe JavaScript avec ses champs, son constructeur et ses méthodes.
  function classCode(module) {
    const className = classNames.get(module.sourceId)
    const members = classMembers.get(module.sourceId)
    const fields = classFields(members)
    const methods = classMethods(members)
    const constructor = members?.constructor ? nodes.get(members.constructor) : null
    const fieldParameters = fields.map((field, index) => `__sp3_field_${index}`)
    const constructorParameters = constructor ? (constructor.children.parameters ?? []).map(reserveDeclaration) : []
    const lines = [`class ${className} {`, `  constructor(${[...fieldParameters, ...constructorParameters].join(', ')}) {`]
    lines.push(`    Object.defineProperty(this, sapphireClassTag, { value: ${JSON.stringify(module.name || 'class')} });`)
    lines.push(`    Object.defineProperty(this, sapphireFieldNames, { value: { ${fields.map((field) => `${JSON.stringify(memberNameFor(module.sourceId, field.name))}: ${JSON.stringify(field.name)}`).join(', ')} } });`)
    fields.forEach((field, index) => lines.push(`    this.${memberNameFor(module.sourceId, field.name)} = ${fieldParameters[index]};`))
    if (constructor) {
      lines.push(...parameterTokens(constructor.children.parameters ?? []))
      for (const statement of child(constructor, 'body')?.children?.statements ?? []) {
        const code = statementCode(statement, 2)
        if (code) lines.push(code)
      }
    }
    lines.push('  }')
    for (const method of methods) {
      const parameters = (method.node.children.parameters ?? []).map(reserveDeclaration)
      lines.push(`  ${memberNameFor(module.sourceId, method.name)}(${parameters.join(', ')}) {`)
      lines.push(...parameterTokens(method.node.children.parameters ?? []))
      for (const statement of child(method.node, 'body')?.children?.statements ?? []) {
        const code = statementCode(statement, 2)
        if (code) lines.push(code)
      }
      lines.push('  }')
    }
    lines.push('}')
    for (const method of methods) lines.push(`${className}.prototype.${memberNameFor(module.sourceId, method.name)}.__sapphireMethod = true;`)
    return lines.join('\n')
  }

  // Déclare les jetons d'adresse des paramètres d'une méthode ou d'un constructeur.
  function parameterTokens(parameters) {
    return parameters.map((parameter) => {
      const symbol = symbolByNode.get(parameter.sourceId)
      const token = symbol ? addressTokens.get(symbol.id) : null
      return token ? `    const ${token} = {};` : null
    }).filter(Boolean)
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
      const leftType = typeByNode.get(child(node, 'left')?.sourceId)
      if (['==', '!='].includes(node.properties.operator) && leftType?.kind === 'pointer') {
        const equality = `sapphirePointerEqual(${left}, ${right})`
        return node.properties.operator === '!=' ? `(!${equality})` : equality
      }
      const operandType = leftType?.name
      return `sapphireChecked(sapphireNumeric.evaluateBinary(${JSON.stringify(node.properties.operator)}, ${left}, ${right}, ${JSON.stringify(operandType)}))`
    }
    if (node.kind === 'UnaryExpression') {
      const operator = node.properties.operator
      if (operator === '*') return `sapphireDeref(${expression(child(node, 'operand'))})`
      if (operator === '&') {
        const operand = child(node, 'operand')
        if (operand?.kind === 'Reference') {
          const symbol = referenceSymbols.get(operand.sourceId)
          const name = referenceName(operand)
          const token = symbol ? addressTokens.get(symbol.id) : null
          if (!token) {
            diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', 'Adresse d’une variable non résolue.', node.location))
            return 'undefined'
          }
          const constant = symbol?.kind === 'ConstantDeclaration'
          const label = symbol?.name ?? name
          return `sapphirePointer(${token}, undefined, () => sapphireRead(${name}), (sapphireValue) => { ${name} = sapphireValue; }, ${constant ? 'true' : 'false'}, ${JSON.stringify(`&${label}`)})`
        }
        if (operand?.kind === 'ArrayAccess') {
          const arraySymbol = child(operand, 'array')?.kind === 'Reference' ? referenceSymbols.get(child(operand, 'array').sourceId) : null
          return `sapphireElementPointer(${expression(child(operand, 'array'))}, ${expression(child(operand, 'index'))}, ${arraySymbol?.kind === 'ConstantDeclaration' ? 'true' : 'false'})`
        }
        if (operand?.kind === 'UnaryExpression' && operand.properties.operator === '*') return expression(child(operand, 'operand'))
        diagnostics.push(createDiagnostic('TRANSPILE_EXPRESSION_UNSUPPORTED', 'Adresse d’une expression non prise en charge.', node.location))
        return 'undefined'
      }
      return `sapphireChecked(sapphireNumeric.evaluateUnary(${JSON.stringify(operator)}, ${expression(child(node, 'operand'))}, ${JSON.stringify(typeByNode.get(node.sourceId)?.name)}))`
    }
    if (node.kind === 'CallExpression') {
      return `${expression(child(node, 'callee'))}(${(node.children.arguments ?? []).map(expression).join(', ')})`
    }
    if (node.kind === 'LambdaExpression') {
      const parameters = (node.children.parameters ?? []).map((parameter) => reserveDeclaration(parameter))
      return `((${parameters.join(', ')}) => ${expression(child(node, 'body'))})`
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
    if (node.kind === 'NewExpression') return newExpressionCode(node)
    if (node.kind === 'ThisExpression') return 'this'
    if (node.kind === 'MemberExpression') return `sapphireMember(${expression(child(node, 'object'))}, ${JSON.stringify(memberNameOf(node, node.properties?.name))})`
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
  function declaration(node, indent, initialize = true, inline = false) {
    const keyword = initialize && node.kind === 'ConstantDeclaration' ? 'const' : 'let'
    const name = generatedNames.get(node.sourceId) ?? reserveDeclaration(node)
    const initializer = child(node, 'initializer')
    const value = initialize && initializer ? expression(initializer) : 'sapphireUninitialized'
    const symbol = symbolByNode.get(node.sourceId)
    const token = symbol ? addressTokens.get(symbol.id) : null
    const line = `${keyword} ${name} = ${value}`
    if (!token) return `${indent}${line};`
    // Une déclaration de boucle for doit rester sur une seule ligne.
    if (inline) return `${indent}${line}, ${token} = {};`
    return `${indent}${line};\n${indent}const ${token} = {};`
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
      if (target?.kind === 'MemberExpression') return `${indent}(${expression(child(target, 'object'))}).${memberNameOf(target, target.properties?.name)} = ${value};`
      if (target?.kind === 'UnaryExpression' && target.properties.operator === '*') return `${indent}sapphireDerefWrite(${expression(child(target, 'operand'))}, ${value});`
      if (target?.kind === 'ArrayAccess') return `${indent}sapphireWrite(${expression(child(target, 'array'))}, ${expression(child(target, 'index'))}, ${value});`
      return `${indent}${referenceName(target)} = ${value};`
    }
    if (node.kind === 'PrintStatement') return `${indent}console.log(sapphireFormat(${expression(child(node, 'value'))}));`
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
        ? ['VariableDeclaration', 'ConstantDeclaration'].includes(initializer.kind)
          ? declaration(initializer, '', true, true).trim().replace(/;$/, '')
          : statementCode(initializer, 0).trim().replace(/;$/, '')
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
    const parameterNodes = node.children.parameters ?? []
    const parameters = parameterNodes.map((parameter) => reserveDeclaration(parameter))
    const tokens = parameterNodes.map((parameter) => {
      const symbol = symbolByNode.get(parameter.sourceId)
      const token = symbol ? addressTokens.get(symbol.id) : null
      return token ? `  const ${token} = {};` : null
    }).filter(Boolean)
    const body = block(child(node, 'body'), 1)
    const prepared = tokens.length ? body.replace('{\n', `{\n${tokens.join('\n')}\n`) : body
    return `function ${name}(${parameters.join(', ')}) ${prepared}`
  }

  const preview = generateSelection(context, { functionCode, statementCode, expression, classCode, constructorName: 'constructor' })
  if (preview) return preview

  const functions = []
  const classes = []
  const globalDeclarations = []
  const globalInitializers = []
  const modulesById = new Map(ast.modules.map((module) => [module.sourceId, module]))
  const orderedModules = moduleInitializationOrder(analysis.source, analysis).map((module) => modulesById.get(module.id)).filter((module) => module && module.moduleKind !== 'class')
  for (const module of ast.modules) if (module.moduleKind !== 'class' && !orderedModules.includes(module)) orderedModules.push(module)
  for (const module of ast.modules) if (module.moduleKind === 'class') classes.push(classCode(module))
  for (const module of orderedModules) {
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
    'const sapphireClassTag = Symbol("class");',
    'const sapphireFieldNames = Symbol("fields");',
    'function sapphireRead(value) { if (value === sapphireUninitialized) throw new Error("SIMULATION_UNINITIALIZED"); return value; }',
    'function sapphireMember(object, name) { if (!object || typeof object !== "object" || !(name in object)) throw new Error("SIMULATION_MEMBER"); const value = object[name]; if (value === sapphireUninitialized) throw new Error("SIMULATION_UNINITIALIZED"); return value && value.__sapphireMethod === true ? value.bind(object) : value; }',
    'function sapphireFormat(value, seen = new Set()) { if (value && typeof value === "object" && value[sapphireClassTag] !== undefined) { const className = value[sapphireClassTag]; if (seen.has(value)) return `${className} { . }`; const next = new Set(seen).add(value); const names = value[sapphireFieldNames] ?? {}; const fields = Object.entries(value).map(([name, fieldValue]) => `${names[name] ?? name}: ${sapphireFormat(fieldValue, next)}`).join(", "); return `${className} { ${fields} }`; } if (Array.isArray(value)) return `[${value.map((entry) => sapphireFormat(entry, seen)).join(", ")}]`; if (value === undefined) return "undefined"; if (typeof value === "boolean") return value ? "true" : "false"; if (value === sapphireUninitialized) return "uninitialized"; if (value && value.__sapphirePointer === true) return value.label; return String(value); }',
    'function sapphireChecked(result) { if (result.code) throw new Error(result.code); return result.value; }',
    'function sapphireArray(length) { if (typeof length !== "number" && typeof length !== "bigint" || !Number.isInteger(Number(length)) || Number(length) < 0) throw new Error("SIMULATION_ARRAY_BOUNDS"); return Number(length); }',
    'function sapphireElement(array, index) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); if (index < 0 || index >= array.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); const value = array[index]; if (value === sapphireUninitialized) throw new Error("SIMULATION_UNINITIALIZED"); return value; }',
    'function sapphireWrite(array, index, value) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); if (index < 0 || index >= array.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); array[index] = value; }',
    'function sapphirePointer(target, index, read, write, constant, label) { return { __sapphirePointer: true, target, index, read, write, constant, label, toString() { return label; } }; }',
    'function sapphireElementPointer(array, index, constant) { if (!Array.isArray(array)) throw new Error("SIMULATION_REFERENCE"); const position = Number(index); if (!Number.isInteger(position) || position < 0 || position >= array.length) throw new Error("SIMULATION_ARRAY_BOUNDS"); return sapphirePointer(array, position, () => sapphireElement(array, position), value => sapphireWrite(array, position, value), constant, "&[" + position + "]"); }',
    'function sapphireDeref(pointer) { if (!pointer || pointer.__sapphirePointer !== true) throw new Error("SIMULATION_REFERENCE"); return sapphireRead(pointer.read()); }',
    'function sapphireDerefWrite(pointer, value) { if (!pointer || pointer.__sapphirePointer !== true) throw new Error("SIMULATION_REFERENCE"); if (pointer.constant) throw new Error("SIMULATION_CONST_IMMUTABLE"); pointer.write(value); }',
    'function sapphirePointerEqual(left, right) { return Boolean(left && right && left.__sapphirePointer === true && right.__sapphirePointer === true && left.target === right.target && left.index === right.index); }',
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
    ...classes,
    ...functions,
    '',
    'function main() {',
    ...globalInitializers,
    ...(entryName ? [`  ${entryName}();`] : []),
    '}',
    '',
    'main();',
  ]
  return { code: lines.join('\n'), diagnostics, metadata: generationMetadata(context, { selection, constructorName: 'constructor' }) }
}

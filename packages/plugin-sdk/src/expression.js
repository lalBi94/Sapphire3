import { PLUGIN_LIMITS } from './constants.js'
import { createPluginDiagnostic, PLUGIN_DIAGNOSTIC_CODES } from './diagnostics.js'

const binaryOperators = new Set(['+', '-', '*', '/', '%', '<', '<=', '>', '>=', '==', '!=', 'and', 'or'])
const unaryOperators = new Set(['-', '+', 'not'])
const primitiveNames = new Set(['short int', 'short uint', 'int', 'uint', 'float', 'double', 'string', 'char', 'boolean'])
const integerNames = new Set(['short int', 'short uint', 'int', 'uint', 'char'])
const floatingNames = new Set(['float', 'double'])

// Reconnaît un objet simple, sans prototype exotique.
export function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// Vérifie la forme d'un type primitif ou tableau de primitifs.
export function isPluginType(value, { allowVoid = false } = {}) {
  if (!isPlainRecord(value)) return false
  if (value.kind === 'primitive') return primitiveNames.has(value.name) || (allowVoid && value.name === 'void')
  if (value.kind === 'array') return isPluginType(value.elementType) && value.elementType.kind === 'primitive' && value.elementType.name !== 'void'
  return false
}

// Retourne le type d'une valeur d'exécution, sans conversion implicite.
export function runtimeTypeOf(value) {
  if (typeof value === 'bigint') return { kind: 'primitive', name: 'int' }
  if (typeof value === 'number') return Number.isInteger(value) ? { kind: 'primitive', name: 'int' } : { kind: 'primitive', name: 'double' }
  if (typeof value === 'string') return { kind: 'primitive', name: 'string' }
  if (typeof value === 'boolean') return { kind: 'primitive', name: 'boolean' }
  return null
}

// Vérifie qu'une valeur respecte le type déclaré, sans conversion implicite.
export function runtimeValueMatchesType(value, type) {
  if (!type) return true
  if (type.kind === 'primitive') {
    if (type.name === 'string' || type.name === 'char') return typeof value === 'string'
    if (type.name === 'boolean') return typeof value === 'boolean'
    if (type.name === 'float' || type.name === 'double') return typeof value === 'number' && Number.isFinite(value)
    if (integerNames.has(type.name)) return typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value))
    return false
  }
  if (type.kind === 'array') return Array.isArray(value) && value.every((entry) => runtimeValueMatchesType(entry, type.elementType))
  return false
}

// Vérifie récursivement une expression d'implémentation ou d'émission.
export function validatePluginExpression(expression, parameters = [], depth = 0, path = 'expression') {
  const diagnostics = []
  if (depth > PLUGIN_LIMITS.maximumExpressionDepth) {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, 'Expression depth limit reached.', path))
    return { ok: false, diagnostics, parameters: [] }
  }
  if (!isPlainRecord(expression) || typeof expression.kind !== 'string') {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, 'An expression object is required.', path))
    return { ok: false, diagnostics, parameters: [] }
  }
  const names = new Set()
  const add = (child, childPath) => {
    const result = validatePluginExpression(child, parameters, depth + 1, childPath)
    diagnostics.push(...result.diagnostics)
    for (const name of result.parameters) names.add(name)
  }
  if (expression.kind === 'param') {
    if (typeof expression.name !== 'string' || !parameters.includes(expression.name)) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, `Unknown expression parameter: ${expression.name}.`, path))
    } else names.add(expression.name)
  } else if (expression.kind === 'literal') {
    if (!isPluginType(expression.type) || !Object.hasOwn(expression, 'value')) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, 'A typed literal is required.', path))
    } else if (!runtimeValueMatchesType(normalizeLiteralValue(expression.value, expression.type), expression.type)) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, 'The literal value does not match its type.', path))
    }
    if (typeof expression.value === 'string' && expression.value.length > PLUGIN_LIMITS.maximumStringLength) {
      diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, 'The literal string is too long.', path))
    }
  } else if (expression.kind === 'binary') {
    if (!binaryOperators.has(expression.operator)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, `Unsupported operator: ${expression.operator}.`, path))
    add(expression.left, `${path}.left`)
    add(expression.right, `${path}.right`)
  } else if (expression.kind === 'unary') {
    if (!unaryOperators.has(expression.operator)) diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, `Unsupported unary operator: ${expression.operator}.`, path))
    add(expression.operand, `${path}.operand`)
  } else if (expression.kind === 'conditional') {
    add(expression.test, `${path}.test`)
    add(expression.consequent, `${path}.consequent`)
    add(expression.alternate, `${path}.alternate`)
  } else {
    diagnostics.push(createPluginDiagnostic(PLUGIN_DIAGNOSTIC_CODES.expressionInvalid, `Unsupported expression kind: ${expression.kind}.`, path))
  }
  return { ok: diagnostics.length === 0, diagnostics, parameters: [...names] }
}

// Normalise un littéral vers la valeur d'exécution correspondant à son type.
export function normalizeLiteralValue(value, type) {
  if (type?.kind !== 'primitive') return value
  if (integerNames.has(type.name)) return typeof value === 'bigint' ? value : BigInt(Number(value))
  if (type.name === 'float' || type.name === 'double') return Number(value)
  if (type.name === 'boolean') return value === true
  if (type.name === 'string' || type.name === 'char') return String(value)
  return value
}

// Refuse une division par zéro avec un code stable.
function finite(value) {
  if (Number.isFinite(value)) return value
  const error = new Error('PLUGIN_EXPRESSION_DOMAIN')
  error.code = 'PLUGIN_EXPRESSION_DOMAIN'
  throw error
}

// Évalue une expression validée avec des arguments typés, sans accès dynamique au JavaScript.
export function evaluatePluginExpression(expression, argumentValues, parameterNames, depth = 0) {
  if (depth > PLUGIN_LIMITS.maximumExpressionDepth) {
    const error = new Error('PLUGIN_EXPRESSION_DEPTH')
    error.code = 'PLUGIN_EXPRESSION_DEPTH'
    throw error
  }
  if (!isPlainRecord(expression)) {
    const error = new Error('PLUGIN_EXPRESSION_INVALID')
    error.code = 'PLUGIN_EXPRESSION_INVALID'
    throw error
  }
  if (expression.kind === 'param') {
    const index = parameterNames.indexOf(expression.name)
    if (index < 0) throw Object.assign(new Error('PLUGIN_EXPRESSION_PARAMETER'), { code: 'PLUGIN_EXPRESSION_PARAMETER' })
    return argumentValues[index]
  }
  if (expression.kind === 'literal') return normalizeLiteralValue(expression.value, expression.type)
  if (expression.kind === 'conditional') {
    return evaluatePluginExpression(expression.test, argumentValues, parameterNames, depth + 1)
      ? evaluatePluginExpression(expression.consequent, argumentValues, parameterNames, depth + 1)
      : evaluatePluginExpression(expression.alternate, argumentValues, parameterNames, depth + 1)
  }
  if (expression.kind === 'unary') {
    const value = evaluatePluginExpression(expression.operand, argumentValues, parameterNames, depth + 1)
    if (expression.operator === 'not') return !value
    if (expression.operator === '-') return typeof value === 'bigint' ? -value : -Number(value)
    return value
  }
  if (expression.kind === 'binary') {
    const left = evaluatePluginExpression(expression.left, argumentValues, parameterNames, depth + 1)
    const operator = expression.operator
    if (operator === 'and') return Boolean(left) && Boolean(evaluatePluginExpression(expression.right, argumentValues, parameterNames, depth + 1))
    if (operator === 'or') return Boolean(left) || Boolean(evaluatePluginExpression(expression.right, argumentValues, parameterNames, depth + 1))
    const right = evaluatePluginExpression(expression.right, argumentValues, parameterNames, depth + 1)
    if (operator === '==') return left === right
    if (operator === '!=') return left !== right
    if (operator === '<') return left < right
    if (operator === '<=') return left <= right
    if (operator === '>') return left > right
    if (operator === '>=') return left >= right
    if (operator === '+') return typeof left === 'bigint' ? left + right : finite(Number(left) + Number(right))
    if (operator === '-') return typeof left === 'bigint' ? left - right : finite(Number(left) - Number(right))
    if (operator === '*') return typeof left === 'bigint' ? left * right : finite(Number(left) * Number(right))
    if (operator === '/') {
      if (right === 0n || right === 0) throw Object.assign(new Error('PLUGIN_EXPRESSION_DIVISION'), { code: 'PLUGIN_EXPRESSION_DIVISION' })
      return typeof left === 'bigint' ? left / right : finite(Number(left) / Number(right))
    }
    if (operator === '%') {
      if (right === 0n) throw Object.assign(new Error('PLUGIN_EXPRESSION_DIVISION'), { code: 'PLUGIN_EXPRESSION_DIVISION' })
      return typeof left === 'bigint' ? left % right : finite(Number(left) % Number(right))
    }
  }
  throw Object.assign(new Error('PLUGIN_EXPRESSION_INVALID'), { code: 'PLUGIN_EXPRESSION_INVALID' })
}

// Échappe un littéral de chaîne pour la cible d'émission.
function literalCode(value, type, target) {
  if (type?.kind === 'primitive' && integerNames.has(type.name)) {
    const integer = String(normalizeLiteralValue(value, type))
    return target === 'javascript' ? `${integer}n` : integer
  }
  if (type?.name === 'boolean') return value === true ? (target === 'javascript' ? 'true' : 'True') : (target === 'javascript' ? 'false' : 'False')
  if (type?.name === 'string' || type?.name === 'char') return JSON.stringify(String(value))
  const number = Number(value)
  if (!Number.isFinite(number)) throw Object.assign(new Error('PLUGIN_EXPRESSION_INVALID'), { code: 'PLUGIN_EXPRESSION_INVALID' })
  return String(number)
}

// Émet une expression sûre pour JavaScript ou Python. Aucun nom arbitraire n'est introduit.
export function emitPluginExpression(expression, target, argumentCodes, parameterNames, depth = 0) {
  if (depth > PLUGIN_LIMITS.maximumExpressionDepth) throw Object.assign(new Error('PLUGIN_EXPRESSION_DEPTH'), { code: 'PLUGIN_EXPRESSION_DEPTH' })
  if (target !== 'javascript' && target !== 'python') throw Object.assign(new Error('PLUGIN_TARGET_UNSUPPORTED'), { code: 'PLUGIN_TARGET_UNSUPPORTED' })
  if (expression.kind === 'param') {
    const index = parameterNames.indexOf(expression.name)
    if (index < 0 || typeof argumentCodes[index] !== 'string') throw Object.assign(new Error('PLUGIN_EXPRESSION_PARAMETER'), { code: 'PLUGIN_EXPRESSION_PARAMETER' })
    return `(${argumentCodes[index]})`
  }
  if (expression.kind === 'literal') return `(${literalCode(expression.value, expression.type, target)})`
  if (expression.kind === 'conditional') {
    const test = emitPluginExpression(expression.test, target, argumentCodes, parameterNames, depth + 1)
    const consequent = emitPluginExpression(expression.consequent, target, argumentCodes, parameterNames, depth + 1)
    const alternate = emitPluginExpression(expression.alternate, target, argumentCodes, parameterNames, depth + 1)
    return target === 'javascript' ? `(${test} ? ${consequent} : ${alternate})` : `(${consequent} if ${test} else ${alternate})`
  }
  if (expression.kind === 'unary') {
    const operand = emitPluginExpression(expression.operand, target, argumentCodes, parameterNames, depth + 1)
    if (expression.operator === 'not') return `(${target === 'javascript' ? '!' : 'not '}${operand})`
    return `(${expression.operator}${operand})`
  }
  if (expression.kind === 'binary') {
    const left = emitPluginExpression(expression.left, target, argumentCodes, parameterNames, depth + 1)
    const right = emitPluginExpression(expression.right, target, argumentCodes, parameterNames, depth + 1)
    const operator = expression.operator === 'and' ? (target === 'javascript' ? '&&' : 'and')
      : expression.operator === 'or' ? (target === 'javascript' ? '||' : 'or')
        : expression.operator
    return `(${left} ${operator} ${right})`
  }
  throw Object.assign(new Error('PLUGIN_EXPRESSION_INVALID'), { code: 'PLUGIN_EXPRESSION_INVALID' })
}

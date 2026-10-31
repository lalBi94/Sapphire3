import { diagnosticCodes as codes } from './diagnostics.js'
import { getPrimitive } from './primitives.js'

// Regroupe les opérations pures pour partager exactement leurs contrôles avec le JavaScript généré.
export function createNumericOperations(getPrimitive, codes) {
  // Renvoie une erreur statique sans lancer d'exception ni fabriquer de valeur de secours.
  function failure(code, message) {
    return { code, message }
  }

  // Refuse les dépassements entiers au lieu d'appliquer un rebouclage machine.
  function checkedInteger(value, definition) {
    if (value < BigInt(definition.min) || value > BigInt(definition.max)) {
      return failure(codes.overflow, 'Valeur hors des bornes du type entier déclaré.')
    }
    return { value }
  }

  // Arrondit vers IEEE 754 binaire32/binaire64, en refusant infinis et sous-flux vers zéro.
  function checkedFloating(value, definition, mathematicallyNonzero = false) {
    const rounded = definition.bits === 32 ? Math.fround(value) : value
    if (!Number.isFinite(rounded)) return failure(codes.overflow, 'Dépassement du type flottant ; NaN et infinis interdits.')
    if (rounded === 0 && (value !== 0 || mathematicallyNonzero)) return failure(codes.underflow, 'Sous-flux : une valeur non nulle serait arrondie à zéro.')
    return { value: rounded }
  }

  // Arrondit directement le décimal vers binaire32 pour éviter un double arrondi via binaire64.
  function floatFromDecimal(text, definition) {
    const approximate = Number(text)
    const nonzero = /[1-9]/.test(text.split(/[eE]/)[0])
    if (!nonzero) return { value: approximate }
    if (!Number.isFinite(approximate) || Math.abs(approximate) > 2 ** 128) return failure(codes.overflow, 'Littéral flottant hors des bornes binaire32.')
    if (Math.abs(approximate) < 2 ** -151) return failure(codes.underflow, 'Sous-flux du littéral binaire32 vers zéro.')

    const [mantissa, exponentText = '0'] = text.replace(/^[+-]/, '').split(/[eE]/)
    const [whole, fraction = ''] = mantissa.split('.')
    const digits = (whole + fraction).replace(/^0+/, '')
    const significant = digits.replace(/0+$/, '')
    const decimalExponent = Number(exponentText) - fraction.length + digits.length - significant.length
    let numerator = BigInt(significant)
    let denominator = 1n
    if (decimalExponent >= 0) numerator *= 10n ** BigInt(decimalExponent)
    else denominator = 10n ** BigInt(-decimalExponent)

    let exponent = numerator.toString(2).length - denominator.toString(2).length
    const belowPower = exponent >= 0 ? numerator < (denominator << BigInt(exponent)) : (numerator << BigInt(-exponent)) < denominator
    if (belowPower) exponent -= 1
    const step = Math.max(exponent - 23, -149)
    const scaledNumerator = step < 0 ? numerator << BigInt(-step) : numerator
    const scaledDenominator = step > 0 ? denominator << BigInt(step) : denominator
    let significand = scaledNumerator / scaledDenominator
    const doubledRemainder = 2n * (scaledNumerator % scaledDenominator)
    if (doubledRemainder > scaledDenominator || (doubledRemainder === scaledDenominator && significand % 2n !== 0n)) significand += 1n
    const value = (text.startsWith('-') ? -1 : 1) * Number(significand) * 2 ** step
    return checkedFloating(value, definition, true)
  }

  // Vérifie un littéral explicitement typé ; les entiers sont calculés exactement en BigInt interne.
  function validateLiteral(typeName, value) {
    const definition = getPrimitive(typeName)
    if (!definition || definition.category === 'void') return failure(codes.invalidLiteral, 'Type de littéral interdit.')
    if (definition.category === 'integer') {
      if (typeof value === 'number' && Number.isInteger(value)) {
        if (value < definition.min || value > definition.max) return failure(codes.overflow, 'Littéral entier hors des bornes autorisées.')
        return checkedInteger(BigInt(value), definition)
      }
      if (typeof value === 'string' && /^[+-]?\d+$/.test(value)) {
        const digits = value.replace(/^[+-]?0*/, '')
        if (digits.length > 10) return failure(codes.overflow, 'Littéral entier hors des bornes autorisées.')
        return checkedInteger(BigInt(value), definition)
      }
      return failure(codes.invalidLiteral, 'Un entier exige un entier JSON exact ou un texte décimal entier.')
    }
    if (definition.category === 'floating') {
      if (typeof value === 'number') return checkedFloating(value, definition)
      if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
        if (definition.bits === 32) return floatFromDecimal(value, definition)
        return checkedFloating(Number(value), definition, /[1-9]/.test(value.split(/[eE]/)[0]))
      }
      return failure(codes.invalidLiteral, 'Un flottant exige un nombre fini ou un texte décimal valide.')
    }
    if (definition.category === 'text' && typeof value === 'string') return { value }
    if (definition.category === 'boolean' && typeof value === 'boolean') return { value }
    if (definition.category === 'character' && typeof value === 'string') {
      const characters = [...value]
      const point = value.codePointAt(0)
      if (characters.length === 1 && !(point >= 0xd800 && point <= 0xdfff)) return { value }
    }
    return failure(codes.invalidLiteral, 'Valeur incompatible avec le littéral déclaré ; char exige un unique scalaire Unicode.')
  }

  // Convertit seulement les constantes numériques, avec troncature explicite vers les entiers.
  function convertConstant(value, targetName) {
    const target = getPrimitive(targetName)
    if (target.category === 'integer') {
      return checkedInteger(typeof value === 'bigint' ? value : BigInt(Math.trunc(value)), target)
    }
    return checkedFloating(Number(value), target)
  }

  // Contrôle les opérations unaires constantes après validation des types de leurs opérandes.
  function evaluateUnary(operator, value, typeName) {
    if (operator === 'not') return { value: !value }
    const result = operator === '-' ? -value : value
    const definition = getPrimitive(typeName)
    return definition.category === 'integer' ? checkedInteger(result, definition) : checkedFloating(result, definition)
  }

  // Vérifie les expressions constantes uniquement : aucune instruction ni fonction n'est exécutée.
  function evaluateBinary(operator, left, right, typeName) {
    if (['/', '%'].includes(operator) && (right === 0 || right === 0n)) return failure(codes.divisionByZero, 'Division ou reste par zéro.')
    let value
    switch (operator) {
      case '+': value = left + right; break
      case '-': value = left - right; break
      case '*': value = left * right; break
      case '/': value = left / right; break
      case '%': value = left % right; break
      case '<': return { value: left < right }
      case '<=': return { value: left <= right }
      case '>': return { value: left > right }
      case '>=': return { value: left >= right }
      case '==': return { value: left === right }
      case '!=': return { value: left !== right }
      case 'and': return { value: left && right }
      case 'or': return { value: left || right }
      default: return failure(codes.typeMismatch, 'Opération constante non autorisée.')
    }
    const definition = getPrimitive(typeName)
    if (definition.category === 'integer') return checkedInteger(value, definition)
    const nonzero = ['*', '/'].includes(operator) && left !== 0 && right !== 0
    return checkedFloating(value, definition, nonzero)
  }

  return { validateLiteral, convertConstant, evaluateUnary, evaluateBinary }
}

export const { validateLiteral, convertConstant, evaluateUnary, evaluateBinary } = createNumericOperations(getPrimitive, codes)

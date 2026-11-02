import { primitiveType } from './primitives.js'

const intType = primitiveType('int')
const doubleType = primitiveType('double')
const stringType = primitiveType('string')
const charType = primitiveType('char')
const booleanType = primitiveType('boolean')
// Paramètre générique `T[]` : n'importe quel tableau, sans imposer le type des éléments.
const arrayParameterType = Object.freeze({ kind: 'array', elementType: null })

// Refuse un résultat non fini : le modèle numérique strict n'admet ni NaN ni infini.
function finite(value) {
  if (Number.isFinite(value)) return value
  const error = new Error('Math result is not a finite number.')
  error.code = 'SIMULATION_MATH_DOMAIN'
  throw error
}

// Refuse un indice de texte hors bornes avec un code stable.
function textBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_STRING_BOUNDS'
  throw error
}

// Calcule le plus grand commun diviseur positif de deux entiers, zéro compris.
function greatestCommonDivisor(left, right) {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n) {
    const remainder = a % b
    a = b
    b = remainder
  }
  return a
}

// Registre pur des opérations natives SP3, seul point d'extension de cette famille.
// Chaque entrée fixe son groupe de menu, les types de ses paramètres et son type de retour.
export const mathNatives = Object.freeze({
  clamp: Object.freeze({ id: 'clamp', group: 'native.math', parameters: Object.freeze([intType, intType, intType]), returnType: intType, run: ([value, lower, upper]) => (value < lower ? lower : value > upper ? upper : value) }),
  sign: Object.freeze({ id: 'sign', group: 'native.math', parameters: Object.freeze([intType]), returnType: intType, run: ([value]) => (value < 0n ? -1n : value > 0n ? 1n : 0n) }),
  gcd: Object.freeze({ id: 'gcd', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => greatestCommonDivisor(left, right) }),
  lerp: Object.freeze({ id: 'lerp', group: 'native.math', parameters: Object.freeze([doubleType, doubleType, doubleType]), returnType: doubleType, run: ([start, end, ratio]) => finite(start + (end - start) * ratio) }),
  log: Object.freeze({ id: 'log', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.log(value)) }),
  length: Object.freeze({ id: 'length', group: 'native.text', parameters: Object.freeze([stringType]), returnType: intType, run: ([value]) => BigInt([...value].length) }),
  charAt: Object.freeze({
    id: 'charAt',
    group: 'native.text',
    parameters: Object.freeze([stringType, intType]),
    returnType: charType,
    run: ([value, index]) => {
      const characters = [...value]
      const position = Number(index)
      if (!Number.isInteger(position) || position < 0 || position >= characters.length) textBounds('The text index is outside its bounds.')
      return characters[position]
    },
  }),
  substring: Object.freeze({
    id: 'substring',
    group: 'native.text',
    parameters: Object.freeze([stringType, intType, intType]),
    returnType: stringType,
    run: ([value, start, end]) => {
      const characters = [...value]
      const from = Number(start)
      const to = Number(end)
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > to || to > characters.length) textBounds('The text slice is outside its bounds.')
      return characters.slice(from, to).join('')
    },
  }),
  contains: Object.freeze({ id: 'contains', group: 'native.text', parameters: Object.freeze([stringType, stringType]), returnType: booleanType, run: ([value, search]) => value.includes(search) }),
  arrayLength: Object.freeze({
    id: 'arrayLength',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType]),
    returnType: intType,
    run: ([value]) => {
      if (!Array.isArray(value)) {
        const error = new Error('The native operation expects an array.')
        error.code = 'SIMULATION_REFERENCE'
        throw error
      }
      return BigInt(value.length)
    },
  }),
  abs: Object.freeze({ id: 'abs', group: 'native.math', parameters: Object.freeze([intType]), returnType: intType, run: ([value]) => (value < 0n ? -value : value) }),
  min: Object.freeze({ id: 'min', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left < right ? left : right) }),
  max: Object.freeze({ id: 'max', group: 'native.math', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left > right ? left : right) }),
  pow: Object.freeze({ id: 'pow', group: 'native.math', parameters: Object.freeze([doubleType, doubleType]), returnType: doubleType, run: ([base, exponent]) => finite(Math.pow(base, exponent)) }),
  sqrt: Object.freeze({ id: 'sqrt', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sqrt(value)) }),
  sin: Object.freeze({ id: 'sin', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sin(value)) }),
  cos: Object.freeze({ id: 'cos', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.cos(value)) }),
  tan: Object.freeze({ id: 'tan', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.tan(value)) }),
  floor: Object.freeze({ id: 'floor', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.floor(value)) }),
  ceil: Object.freeze({ id: 'ceil', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.ceil(value)) }),
  round: Object.freeze({ id: 'round', group: 'native.math', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.round(value)) }),
})

// Retourne une opération native par son identifiant, ou null si elle est inconnue.
export function getMathNative(id) {
  return typeof id === 'string' && Object.hasOwn(mathNatives, id) ? mathNatives[id] : null
}

// Liste les identifiants proposés dans les opérations natives, dans l'ordre du registre.
export const mathNativeIds = Object.freeze(Object.keys(mathNatives))

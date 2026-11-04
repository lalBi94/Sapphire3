import { primitiveType, arrayType, sameType, isArrayType } from './primitives.js'

const intType = primitiveType('int')
const doubleType = primitiveType('double')
const stringType = primitiveType('string')
const charType = primitiveType('char')
const booleanType = primitiveType('boolean')
// Paramètre générique `T[]` : n'importe quel tableau, sans imposer le type des éléments.
const arrayParameterType = Object.freeze({ kind: 'array', elementType: null })
// Paramètre d'élément lié au premier tableau : `T` doit être le type d'élément de `T[]`.
const arrayElementParameterType = Object.freeze({ kind: 'arrayElement', arrayIndex: 0 })
const stringArrayType = Object.freeze({ kind: 'array', elementType: stringType })

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

// Refuse une opération native qui attend un tableau avec un code stable.
function referenceError(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_REFERENCE'
  throw error
}

// Refuse une adresse ou une portion de tableau hors bornes avec un code stable.
function arrayBounds(message) {
  const error = new Error(message)
  error.code = 'SIMULATION_ARRAY_BOUNDS'
  throw error
}

// Convertit un entier source en index sûr après contrôle du domaine.
function arrayIndexValue(value, maximum) {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0 || index > maximum) arrayBounds('The array slice is outside its bounds.')
  return index
}

// Retourne une copie du segment [start, end), sans modifier la source.
function sliceArray(array, start, end) {
  if (!Array.isArray(array)) referenceError('The native operation expects an array.')
  const from = arrayIndexValue(start, array.length)
  const to = arrayIndexValue(end, array.length)
  if (from > to) arrayBounds('The array slice is outside its bounds.')
  return array.slice(from, to)
}

// Retourne l'index du premier élément égal, ou -1 sans lever d'erreur.
function indexOfElement(array, value) {
  if (!Array.isArray(array)) referenceError('The native operation expects an array.')
  return BigInt(array.indexOf(value))
}

// Compte les scalaires Unicode avant une position UTF-16.
function unicodeIndexOf(value, search) {
  const index = value.indexOf(search)
  return index < 0 ? -1n : BigInt([...value.slice(0, index)].length)
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
  arraySlice: Object.freeze({
    id: 'arraySlice',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, intType, intType]),
    returnType: ([array]) => array,
    run: ([value, start, end]) => sliceArray(value, start, end),
  }),
  arrayConcat: Object.freeze({
    id: 'arrayConcat',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayParameterType]),
    returnType: ([array]) => array,
    check: ([left, right]) => isArrayType(left) && isArrayType(right) && !sameType(left, right) ? 1 : null,
    run: ([left, right]) => {
      if (!Array.isArray(left) || !Array.isArray(right)) referenceError('The native operation expects two arrays.')
      return [...left, ...right]
    },
  }),
  arrayContains: Object.freeze({
    id: 'arrayContains',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayElementParameterType]),
    returnType: booleanType,
    run: ([value, search]) => {
      if (!Array.isArray(value)) referenceError('The native operation expects an array.')
      return value.includes(search)
    },
  }),
  arrayIndexOf: Object.freeze({
    id: 'arrayIndexOf',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType, arrayElementParameterType]),
    returnType: intType,
    run: ([value, search]) => indexOfElement(value, search),
  }),
  arrayReverse: Object.freeze({
    id: 'arrayReverse',
    group: 'native.arrays',
    parameters: Object.freeze([arrayParameterType]),
    returnType: ([array]) => array,
    run: ([value]) => {
      if (!Array.isArray(value)) referenceError('The native operation expects an array.')
      return [...value].reverse()
    },
  }),
  stringSplit: Object.freeze({
    id: 'stringSplit',
    group: 'native.text',
    parameters: Object.freeze([stringType, charType]),
    returnType: arrayType(stringType),
    run: ([value, separator]) => {
      if (typeof separator !== 'string') textBounds('The native operation expects a character separator.')
      return value.split(separator)
    },
  }),
  stringJoin: Object.freeze({
    id: 'stringJoin',
    group: 'native.text',
    parameters: Object.freeze([stringArrayType, stringType]),
    returnType: stringType,
    run: ([values, separator]) => {
      if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) referenceError('The native operation expects an array of strings.')
      return values.join(separator)
    },
  }),
  stringIndexOf: Object.freeze({
    id: 'stringIndexOf',
    group: 'native.text',
    parameters: Object.freeze([stringType, stringType]),
    returnType: intType,
    run: ([value, search]) => unicodeIndexOf(value, search),
  }),
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

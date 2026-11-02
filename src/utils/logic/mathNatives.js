import { primitiveType } from './primitives.js'

const intType = primitiveType('int')
const doubleType = primitiveType('double')

// Refuse un résultat non fini : le modèle numérique strict n'admet ni NaN ni infini.
function finite(value) {
  if (Number.isFinite(value)) return value
  const error = new Error('Math result is not a finite number.')
  error.code = 'SIMULATION_MATH_DOMAIN'
  throw error
}

// Registre pur des opérations mathématiques natives, seul point d'extension de cette famille.
export const mathNatives = Object.freeze({
  abs: Object.freeze({ id: 'abs', parameters: Object.freeze([intType]), returnType: intType, run: ([value]) => (value < 0n ? -value : value) }),
  min: Object.freeze({ id: 'min', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left < right ? left : right) }),
  max: Object.freeze({ id: 'max', parameters: Object.freeze([intType, intType]), returnType: intType, run: ([left, right]) => (left > right ? left : right) }),
  pow: Object.freeze({ id: 'pow', parameters: Object.freeze([doubleType, doubleType]), returnType: doubleType, run: ([base, exponent]) => finite(Math.pow(base, exponent)) }),
  sqrt: Object.freeze({ id: 'sqrt', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sqrt(value)) }),
  sin: Object.freeze({ id: 'sin', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.sin(value)) }),
  cos: Object.freeze({ id: 'cos', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.cos(value)) }),
  tan: Object.freeze({ id: 'tan', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.tan(value)) }),
  floor: Object.freeze({ id: 'floor', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.floor(value)) }),
  ceil: Object.freeze({ id: 'ceil', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.ceil(value)) }),
  round: Object.freeze({ id: 'round', parameters: Object.freeze([doubleType]), returnType: doubleType, run: ([value]) => finite(Math.round(value)) }),
})

// Retourne une opération mathématique par son identifiant, ou null si elle est inconnue.
export function getMathNative(id) {
  return typeof id === 'string' && Object.hasOwn(mathNatives, id) ? mathNatives[id] : null
}

// Liste les identifiants proposés dans la sous-catégorie Maths, dans l'ordre du registre.
export const mathNativeIds = Object.freeze(Object.keys(mathNatives))

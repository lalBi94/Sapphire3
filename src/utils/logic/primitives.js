// Seul catalogue des types logiques : les bornes ne dépendent pas d'un langage cible.
// Les tableaux et les pointeurs sont des types construits dont l'élément ou la cible est un primitif.
const definitions = {
  'short int': { category: 'integer', bits: 16, signed: true, min: -32768, max: 32767 },
  'short uint': { category: 'integer', bits: 16, signed: false, min: 0, max: 65535 },
  int: { category: 'integer', bits: 32, signed: true, min: -2147483648, max: 2147483647 },
  uint: { category: 'integer', bits: 32, signed: false, min: 0, max: 4294967295 },
  float: { category: 'floating', bits: 32, signed: true, max: 3.4028234663852886e38, minPositive: 2 ** -149 },
  double: { category: 'floating', bits: 64, signed: true, max: Number.MAX_VALUE, minPositive: Number.MIN_VALUE },
  string: { category: 'text' },
  char: { category: 'character' },
  boolean: { category: 'boolean' },
  void: { category: 'void' },
}

export const primitiveDefinitions = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([name, definition]) => [name, Object.freeze({ ...definition, type: Object.freeze({ kind: 'primitive', name }) })]),
))

// Retourne la définition nominale ou une absence, jamais un type de remplacement.
export function getPrimitive(name) {
  return typeof name === 'string' && Object.hasOwn(primitiveDefinitions, name) ? primitiveDefinitions[name] : null
}

// Expose les types canoniques, figés, sans accepter de nom implicite ou de synonyme.
export function primitiveType(name) {
  return getPrimitive(name)?.type ?? null
}

// Distingue les six types arithmétiques des booléens et des caractères.
export function isNumeric(name) {
  return ['integer', 'floating'].includes(getPrimitive(name)?.category)
}

// Partage le domaine d'un opérateur entre son vérificateur et ses formulaires de configuration.
export function acceptsOperand(rule, type) {
  if (!type) return false
  if (rule === 'pointer') return isPointerType(type)
  if (rule === 'addressable') return isValidPointee(type)
  if (rule === 'matching') return (type.kind === 'primitive' && type.name !== 'void') || isPointerType(type)
  if (type.kind !== 'primitive' || type.name === 'void') return false
  const definition = getPrimitive(type.name)
  if (!definition) return false
  if (rule === 'numeric') return isNumeric(type.name)
  if (rule === 'integer') return definition.category === 'integer'
  if (rule === 'signedNumeric') return isNumeric(type.name) && definition.signed
  return type.name === rule
}

// Compare exactement des primitifs, des signatures ou des pointeurs déjà entièrement résolus.
export function sameType(left, right) {
  if (!left || !right || left.kind !== right.kind) return false
  if (left.kind === 'primitive') return left.name === right.name
  if (left.kind === 'function') {
    return left.parameters.length === right.parameters.length &&
      left.parameters.every((type, index) => sameType(type, right.parameters[index])) &&
      sameType(left.returnType, right.returnType)
  }
  if (left.kind === 'array') {
    return sameType(left.elementType, right.elementType)
  }
  if (left.kind === 'pointer') {
    return sameType(left.pointee, right.pointee)
  }
  return false
}

// Crée un type tableau avec le type d'élément donné.
export function arrayType(elementType) {
  if (!elementType) return null
  return Object.freeze({ kind: 'array', elementType })
}

// Vérifie si un type est un type tableau.
export function isArrayType(type) {
  return type?.kind === 'array'
}

// Extrait le type d'élément d'un type tableau, ou null si ce n'est pas un tableau.
export function arrayElementType(type) {
  return isArrayType(type) ? type.elementType : null
}

// Vérifie si un type peut servir de type d'élément (primitif uniquement pour cette version).
export function isValidElementType(type) {
  return type?.kind === 'primitive' && type.name !== 'void'
}

// Crée un type pointeur vers un primitif non void, ou null si la cible n'est pas valide.
export function pointerType(pointee) {
  if (!isValidPointee(pointee)) return null
  return Object.freeze({ kind: 'pointer', pointee })
}

// Vérifie si un type est un type pointeur.
export function isPointerType(type) {
  return type?.kind === 'pointer'
}

// Extrait le type visé par un pointeur, ou null si ce n'est pas un pointeur.
export function pointerPointee(type) {
  return isPointerType(type) ? type.pointee : null
}

// Vérifie si un type peut être la cible d'un pointeur (primitif non void uniquement).
export function isValidPointee(type) {
  return type?.kind === 'primitive' && type.name !== 'void'
}

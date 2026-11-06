const numericTypes = new Set(['short int', 'short uint', 'int', 'uint', 'float', 'double'])
const textTypes = new Set(['string', 'char'])

// Nom primitif d'un type, ou null quand l'entrée n'est pas un primitif simple.
export function primitiveName(type) {
  return type?.kind === 'primitive' ? type.name : null
}

// Valeur par défaut d'un champ selon son type déclaré.
export function defaultValue(type) {
  const name = primitiveName(type)
  if (name === 'boolean') return 'false'
  if (textTypes.has(name)) return ''
  return numericTypes.has(name) ? '0' : ''
}

// Convertit la saisie en valeur brute attendue par le moteur.
export function parseValue(type, raw) {
  const name = primitiveName(type)
  if (name === 'boolean') return raw === 'true'
  if (numericTypes.has(name)) return raw.trim() === '' ? Number.NaN : Number(raw)
  return raw
}

// Indique si un type primitif peut être saisi dans un formulaire simple.
export function isEditableType(type) {
  return ['boolean', ...textTypes, ...numericTypes].includes(primitiveName(type))
}

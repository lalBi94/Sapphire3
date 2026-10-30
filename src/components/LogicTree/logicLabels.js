// Présente les discriminants du langage sans dupliquer son catalogue de constructions.
export function kindLabel(kind) {
  return kind.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Affiche seulement une information de type déjà résolue, jamais un type de remplacement.
export function typeLabel(type) {
  if (type?.kind === 'primitive') return type.name
  if (type?.kind === 'function') return `(${type.parameters.map(typeLabel).join(', ')}) → ${typeLabel(type.returnType)}`
  return 'Not typed'
}

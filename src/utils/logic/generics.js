import { isRecord } from './model.js'
import { arrayType, functionType, isGenericType, pointerType, typeFromRecord } from './primitives.js'

// Borne simple des paramètres de type d'une fonction, indépendante d'un langage cible.
export const maximumTypeParameters = 8

// Reconnaît un nom de paramètre de type sans le confondre avec un primitif minuscule.
export function isTypeParameterName(name) {
  return typeof name === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(name)
}

// Lit les paramètres de type déclarés ; `generic: true` reste le repli des fichiers antérieurs.
export function declaredTypeParameters(node) {
  if (node?.kind !== 'FunctionDeclaration') return []
  const declared = node.properties?.typeParameters
  if (Array.isArray(declared)) {
    const names = new Set()
    const parameters = []
    for (const entry of declared) {
      if (!isRecord(entry) || !isTypeParameterName(entry.name) || names.has(entry.name)) continue
      names.add(entry.name)
      parameters.push(entry.constraint === undefined || entry.constraint === null ? { name: entry.name } : { name: entry.name, constraint: entry.constraint })
    }
    if (parameters.length > 0) return parameters
  }
  return node.properties?.generic === true ? [{ name: 'T' }] : []
}

// Convertit une contrainte exacte en type canonique ; une contrainte malformée ne devient jamais un type de secours.
export function typeParameterConstraint(parameter) {
  return parameter?.constraint ? typeFromRecord(parameter.constraint) : null
}

// Remplace les paramètres de type par leur type inféré, sans modifier le type d'origine.
export function substituteType(type, bindings, depth = 0) {
  if (!type || depth > 20) return type
  if (isGenericType(type)) return bindings.get(type.name) ?? type
  if (type.kind === 'array') {
    const elementType = substituteType(type.elementType, bindings, depth + 1)
    return elementType === type.elementType ? type : arrayType(elementType)
  }
  if (type.kind === 'pointer') {
    const pointee = substituteType(type.pointee, bindings, depth + 1)
    return pointee === type.pointee ? type : pointerType(pointee) ?? type
  }
  if (type.kind === 'function') {
    const parameters = type.parameters.map((parameter) => substituteType(parameter, bindings, depth + 1))
    const returnType = substituteType(type.returnType, bindings, depth + 1)
    return functionType(parameters, returnType) ?? type
  }
  return type
}

import { failureLabel, translations } from '../../utils/translations.js'

// Présente les discriminants du langage sans dupliquer son catalogue de constructions.
export function kindLabel(kind, t) {
  return Object.hasOwn(translations.en, `kind.${kind}`) ? t(`kind.${kind}`) : t('labels.unknownKind', { kind })
}

// Remplace les noms internes des emplacements par des mots utiles dans l'interface.
export function slotLabel(slot, t) {
  const field = slot.replace(/^children\./, '').replace(/\[\d+\].*$/, '')
  if (Object.hasOwn(translations.en, `slot.${field}`)) return t(`slot.${field}`)
  const property = field.replace(/^(properties|references)\./, '').split('.')[0]
  return Object.hasOwn(translations.en, `field.${property}`) ? t(`field.${property}`) : t('labels.field', { field: slot })
}

// Traduit les codes du moteur en messages courts adaptés à l'interface.
export function diagnosticLabel(code, t) {
  return failureLabel({ code }, t)
}

// Affiche seulement une information de type déjà résolue, jamais un type de remplacement.
export function typeLabel(type, t) {
  if (type?.kind === 'primitive') return type.name
  if (type?.kind === 'function') return `(${type.parameters.map((parameter) => typeLabel(parameter, t)).join(', ')}) → ${typeLabel(type.returnType, t)}`
  if (type?.kind === 'array') return `${typeLabel(type.elementType, t)}[]`
  return t('labels.typeUnset')
}

// Distingue une fonction exportée d'une fonction locale sans modifier son nom de référence.
export function symbolLabel(symbol) {
  return symbol?.external && symbol.moduleName ? `${symbol.name} · ${symbol.moduleName}` : symbol?.name ?? ''
}

// Résume une seule ligne de données utiles, sans reconstruire l'AST ni inventer de valeur.
export function nodeSummary(node, index, schema, t) {
  const type = index.nodeTypes.get(node.id)
  const parts = []
  const targetName = (referenceNodeId) => {
    const reference = index.references?.get(referenceNodeId)
    const symbol = reference?.symbolId ? index.symbols?.get(reference.symbolId) : null
    return symbol?.name ?? t('labels.notFound')
  }
  const valueText = (value) => String(value).replace(/\s+/g, ' ')

  if (node.kind === 'Literal') parts.push(Object.hasOwn(node.properties ?? {}, 'value') ? valueText(node.properties.value) : t('labels.valueMissing'))
  if (['BinaryExpression', 'UnaryExpression'].includes(node.kind)) parts.push(node.properties?.operator || t('labels.operationMissing'))
  if (node.kind === 'Reference') parts.push(targetName(node.id))
  if (node.kind === 'CallExpression') parts.push(node.children?.callee ? targetName(node.children.callee) : t('labels.functionMissing'))
  if (node.kind === 'AssignmentStatement') parts.push(node.children?.target ? targetName(node.children.target) : t('labels.targetMissing'))
  if (node.kind === 'Block') {
    const count = Array.isArray(node.children?.statements) ? node.children.statements.length : 0
    parts.push(t(count === 1 ? 'labels.step' : 'labels.steps', { count }))
  }
  if (node.kind === 'ReturnStatement') parts.push(t(node.children?.argument ? 'labels.withValue' : 'labels.noValue'))
  if (node.kind === 'PrintStatement') parts.push(t(node.children?.value ? 'labels.value' : 'labels.valueMissing'))
  if (node.kind === 'FunctionDeclaration' && !type) {
    const count = Array.isArray(node.children?.parameters) ? node.children.parameters.length : 0
    parts.push(t(count === 1 ? 'labels.input' : 'labels.inputs', { count }))
  }
  if (node.kind === 'ArrayLiteral') {
    const count = Array.isArray(node.children?.elements) ? node.children.elements.length : 0
    parts.push(t(count === 1 ? 'labels.element' : 'labels.elements', { count }))
  }

  // Les nœuds nommés et les expressions affichent leur type, même absent, pour révéler un problème.
  if (type || schema?.category === 'expression' || schema?.named) parts.push(typeLabel(type, t))
  return parts.join(' · ')
}

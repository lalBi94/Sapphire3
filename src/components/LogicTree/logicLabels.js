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

// Résume une seule ligne de données utiles, sans reconstruire l'AST ni inventer de valeur.
export function nodeSummary(node, index, schema) {
  const type = index.nodeTypes.get(node.id)
  const parts = []
  const targetName = (referenceNodeId) => {
    const reference = index.references?.get(referenceNodeId)
    const symbol = reference?.symbolId ? index.symbols?.get(reference.symbolId) : null
    return symbol?.name ?? 'Unresolved'
  }
  const valueText = (value) => String(value).replace(/\s+/g, ' ')

  if (node.kind === 'Literal') parts.push(Object.hasOwn(node.properties ?? {}, 'value') ? valueText(node.properties.value) : 'No value')
  if (['BinaryExpression', 'UnaryExpression'].includes(node.kind)) parts.push(node.properties?.operator || 'No operator')
  if (node.kind === 'Reference') parts.push(targetName(node.id))
  if (node.kind === 'CallExpression') parts.push(node.children?.callee ? targetName(node.children.callee) : 'No callee')
  if (node.kind === 'AssignmentStatement') parts.push(node.children?.target ? targetName(node.children.target) : 'No target')
  if (node.kind === 'Block') parts.push(`${Array.isArray(node.children?.statements) ? node.children.statements.length : 0} statements`)
  if (node.kind === 'ReturnStatement') parts.push(node.children?.argument ? 'with value' : 'no value')
  if (node.kind === 'FunctionDeclaration' && !type) parts.push(`${Array.isArray(node.children?.parameters) ? node.children.parameters.length : 0} parameters`)

  // Les nœuds nommés et les expressions affichent leur type, même absent, pour révéler un diagnostic.
  if (type || schema?.category === 'expression' || schema?.named) parts.push(typeLabel(type))
  return parts.join(' · ')
}

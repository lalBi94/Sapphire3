// Présente les discriminants du langage sans dupliquer son catalogue de constructions.
export function kindLabel(kind) {
  const labels = {
    FunctionDeclaration: 'Function',
    VariableDeclaration: 'Variable',
    ConstantDeclaration: 'Constant',
    Parameter: 'Input',
    BinaryExpression: 'Operation',
    UnaryExpression: 'Operation',
    Literal: 'Value',
    Reference: 'Use a value',
    CallExpression: 'Function call',
    IfStatement: 'If',
    WhileStatement: 'While loop',
    ForStatement: 'For loop',
    ReturnStatement: 'Return',
    AssignmentStatement: 'Change a value',
    Block: 'Steps',
    CastExpression: 'Convert a value',
    TypeDeclaration: 'Type',
  }
  return labels[kind] ?? kind.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Remplace les noms internes des emplacements par des mots utiles dans l'interface.
export function slotLabel(slot) {
  const labels = {
    rootNodeIds: 'Blocks',
    parameters: 'Inputs',
    initializer: 'Starting value',
    condition: 'Condition',
    test: 'Condition',
    consequent: 'Then',
    alternate: 'Otherwise',
    body: 'Inside',
    statements: 'Steps',
    argument: 'Value',
    arguments: 'Inputs',
    operand: 'Value',
    left: 'Left value',
    right: 'Right value',
    target: 'Value to change',
    callee: 'Function',
  }
  return labels[slot] ?? slot.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Traduit les codes du moteur en messages courts adaptés à l'interface.
export function diagnosticLabel(code) {
  const labels = {
    SOURCE_INVALID: 'This program cannot be saved yet.',
    DRAFT_INVALID: 'This change would make the program invalid.',
    NODE_NOT_FOUND: 'This block no longer exists.',
    MODULE_INVALID: 'This module is not valid.',
    ENTRY_POINT_DUPLICATE: 'Only one function can start the program.',
    ENTRY_POINT_INVALID: 'Only a function can start the program.',
    REFERENCE_UNRESOLVED: 'This name cannot be found.',
    DECLARATION_CONFLICT: 'This name is already used.',
    TYPE_MISMATCH: 'This type does not fit here.',
    TYPE_REQUIRED: 'Choose a type.',
    TYPE_INVALID: 'This type is not valid here.',
    EXPRESSION_UNTYPED: 'This value needs a type.',
    NODE_INCOMPLETE: 'Something is missing.',
    LITERAL_INVALID: 'This value is not valid.',
    NUMERIC_OVERFLOW: 'This number is too large.',
    NUMERIC_UNDERFLOW: 'This number is too small.',
    DIVISION_BY_ZERO: 'A value cannot be divided by zero.',
    RETURN_MISSING: 'This function needs a return value.',
    PLACEMENT_ILLEGAL: 'This block cannot go here.',
  }
  return labels[code] ?? code.replaceAll('_', ' ').toLowerCase()
}

// Affiche seulement une information de type déjà résolue, jamais un type de remplacement.
export function typeLabel(type) {
  if (type?.kind === 'primitive') return type.name
  if (type?.kind === 'function') return `(${type.parameters.map(typeLabel).join(', ')}) → ${typeLabel(type.returnType)}`
  return 'Type not set'
}

// Résume une seule ligne de données utiles, sans reconstruire l'AST ni inventer de valeur.
export function nodeSummary(node, index, schema) {
  const type = index.nodeTypes.get(node.id)
  const parts = []
  const targetName = (referenceNodeId) => {
    const reference = index.references?.get(referenceNodeId)
    const symbol = reference?.symbolId ? index.symbols?.get(reference.symbolId) : null
    return symbol?.name ?? 'Not found'
  }
  const valueText = (value) => String(value).replace(/\s+/g, ' ')

  if (node.kind === 'Literal') parts.push(Object.hasOwn(node.properties ?? {}, 'value') ? valueText(node.properties.value) : 'Value missing')
  if (['BinaryExpression', 'UnaryExpression'].includes(node.kind)) parts.push(node.properties?.operator || 'Operation missing')
  if (node.kind === 'Reference') parts.push(targetName(node.id))
  if (node.kind === 'CallExpression') parts.push(node.children?.callee ? targetName(node.children.callee) : 'Function missing')
  if (node.kind === 'AssignmentStatement') parts.push(node.children?.target ? targetName(node.children.target) : 'Target missing')
  if (node.kind === 'Block') parts.push(`${Array.isArray(node.children?.statements) ? node.children.statements.length : 0} steps`)
  if (node.kind === 'ReturnStatement') parts.push(node.children?.argument ? 'with value' : 'no value')
  if (node.kind === 'FunctionDeclaration' && !type) parts.push(`${Array.isArray(node.children?.parameters) ? node.children.parameters.length : 0} inputs`)

  // Les nœuds nommés et les expressions affichent leur type, même absent, pour révéler un problème.
  if (type || schema?.category === 'expression' || schema?.named) parts.push(typeLabel(type))
  return parts.join(' · ')
}

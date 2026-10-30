import { primitiveType, getNodeSchema } from '../../utils/logic/index.js'

// Prépare un brouillon UI à partir des seules propriétés existantes, sans valeur logique inventée.
export function initialNodeForm(kind, node, expectedType, symbols) {
  const properties = node?.properties ?? {}
  const target = node?.references?.target
  const symbol = symbols.find((entry) => target?.kind === 'import' ? entry.importId === target.importId : target?.kind === 'name' ? entry.name === target.name : entry.nodeId === target?.nodeId)
  return {
    name: properties.name ?? '', typeName: properties.type?.kind === 'named' ? '@alias' : properties.type?.name ?? (kind === 'Literal' || kind === 'CastExpression' ? expectedType?.name ?? '' : ''),
    operator: properties.operator ?? '', value: properties.value === undefined ? '' : Object.is(properties.value, -0) ? '-0' : String(properties.value),
    empty: properties.type?.name === 'string' && properties.value === '', symbolId: symbol?.id ?? (target ? '@unresolved' : ''),
    initializer: { mode: '', value: '', empty: false, symbolId: '' }, condition: { mode: '', value: '', empty: false, symbolId: '' },
    parameters: [], entryPoint: properties.entryPoint === true, allowIncomplete: false,
  }
}

// Les cibles symboliques utilisent les identifiants stables, jamais le libellé affiché.
export function symbolTarget(symbol) {
  return symbol.importedFrom ? { kind: 'import', importId: symbol.importId } : { kind: 'node', nodeId: symbol.nodeId }
}

// Construit un littéral typé à partir de sa représentation textuelle explicite.
function literalDraft(type, value, empty) {
  const properties = { ...(type ? { type } : {}) }
  if (value !== '' || (type?.name === 'string' && empty)) properties.value = type?.name === 'boolean' ? value === 'true' : value
  return { kind: 'Literal', properties }
}

// Ne génère un enfant que si l'utilisateur a choisi un mode d'expression.
function expressionDraft(value, type, symbols) {
  if (value.mode === 'literal') return literalDraft(type, value.value, value.empty)
  const symbol = symbols.find((entry) => entry.id === value.symbolId)
  return value.mode === 'reference' && symbol ? { kind: 'Reference', references: { target: symbolTarget(symbol) } } : null
}

// Produit une configuration nouvelle ou une modification de propriétés, sans remplacer d'enfant existant.
export function nodeConfiguration(kind, form, symbols, initialNode = null) {
  const schema = getNodeSchema(kind)
  const properties = { ...initialNode?.properties }
  const references = { ...initialNode?.references }
  const type = form.typeName === '@alias' ? initialNode?.properties.type : primitiveType(form.typeName)
  if (schema.named) properties.name = initialNode && form.name === initialNode.properties.name ? form.name : form.name.trim()
  if (kind === 'FunctionDeclaration') {
    if (form.entryPoint) properties.entryPoint = true
    else delete properties.entryPoint
  }
  if (schema.declaresType) {
    if (type) properties.type = type
    else delete properties.type
  }
  if (['BinaryExpression', 'UnaryExpression'].includes(kind)) properties.operator = form.operator
  if (kind === 'Literal') {
    const original = initialNode?.properties
    const displayed = original?.value === undefined ? '' : Object.is(original.value, -0) ? '-0' : String(original.value)
    const originalEmpty = original?.type?.name === 'string' && original.value === ''
    const unchanged = initialNode && form.value === displayed && form.empty === originalEmpty && JSON.stringify(type) === JSON.stringify(original.type)
    if (!unchanged) {
      delete properties.value
      Object.assign(properties, literalDraft(type, form.value, form.empty).properties)
    }
  }
  if (kind === 'Reference') {
    const symbol = symbols.find((entry) => entry.id === form.symbolId)
    if (symbol) references.target = symbolTarget(symbol)
    else if (!initialNode || form.symbolId !== '@unresolved') delete references.target
  }
  if (initialNode) return { properties, references }
  const children = {}
  const emptyBlock = () => ({ kind: 'Block', children: { statements: [] } })
  if (['VariableDeclaration', 'ConstantDeclaration'].includes(kind)) children.initializer = expressionDraft(form.initializer, type, symbols)
  if (['IfStatement', 'WhileStatement', 'ForStatement'].includes(kind)) {
    children.test = expressionDraft(form.condition, primitiveType('boolean'), symbols)
    children[kind === 'IfStatement' ? 'consequent' : 'body'] = emptyBlock()
  }
  if (kind === 'FunctionDeclaration') {
    children.parameters = form.parameters.map((parameter) => ({ kind: 'Parameter', properties: { name: parameter.name.trim(), ...(primitiveType(parameter.typeName) ? { type: primitiveType(parameter.typeName) } : {}) } }))
    children.body = emptyBlock()
  }
  if (kind === 'CallExpression') {
    const symbol = symbols.find((entry) => entry.id === form.symbolId)
    if (symbol) children.callee = { kind: 'Reference', references: { target: symbolTarget(symbol) } }
  }
  return { kind, properties, references, children }
}

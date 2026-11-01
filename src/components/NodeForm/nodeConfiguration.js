import { primitiveType, primitiveDefinitions, arrayType, isArrayType, isValidElementType, pointerType, isPointerType, pointerPointee, isValidPointee, getNodeSchema, binaryOperators, unaryOperators, acceptsOperand, sameType } from '../../utils/logic/index.js'

// Types entiers proposés pour l'index d'un accès à un élément de tableau ; une seule liste partagée par les formulaires.
export const integerTypeNames = Object.freeze(Object.keys(primitiveDefinitions).filter((name) => acceptsOperand('integer', primitiveType(name))))

// Fournit un brouillon vide sans inventer d'opérateur, de type ou de valeur.
export function emptyExpression() {
  return { mode: '', value: '', empty: false, symbolId: '', operator: '', operandTypeName: '' }
}

// Convertit un nom de type choisi ('int', 'int[]' ou 'int*') en type logique, sans inventer de synonyme.
export function typeFromName(name) {
  if (typeof name !== 'string' || name === '') return null
  if (name.endsWith('[]')) {
    const element = primitiveType(name.slice(0, -2))
    return element && element.name !== 'void' ? arrayType(element) : null
  }
  if (name.endsWith('*')) {
    const pointee = primitiveType(name.slice(0, -1))
    return pointee && pointee.name !== 'void' ? pointerType(pointee) : null
  }
  return primitiveType(name)
}

// Filtre les opérations par leur résultat attendu, depuis les règles du moteur.
// `&` n'apparaît que pour un pointeur attendu, `*` (déréférencement) que lorsque la valeur pointée est attendue.
export function expressionOperators(mode, type) {
  const entries = Object.entries(mode === 'unary' ? unaryOperators : binaryOperators)
  if (mode === 'unary') {
    return entries.filter(([operator, rule]) => {
      if (operator === '&') return isPointerType(type)
      if (operator === '*') return isValidPointee(type)
      if (!type) return true
      return rule.result === 'same' ? acceptsOperand(rule.operands, type) : sameType(primitiveType(rule.result), type)
    })
  }
  return entries.filter(([, rule]) => !type || (rule.result === 'same' ? acceptsOperand(rule.operands, type) : sameType(primitiveType(rule.result), type)))
}

// Type que doit viser un accès par index pour que son élément remplisse `type` ; null si ce type ne peut pas être un élément.
export function accessedArrayType(type) {
  return isValidElementType(type) ? arrayType(type) : null
}

// Type d'index choisi explicitement parmi les entiers ; `int` reste la valeur de départ du formulaire.
export function arrayIndexType(name) {
  const candidate = primitiveType(name)
  return acceptsOperand('integer', candidate) ? candidate : primitiveType('int')
}

// Résout le type explicitement choisi des opérandes, ou celui imposé par l'opération.
export function expressionOperandType(value, type) {
  if (value.mode === 'unary' && value.operator === '&') return isPointerType(type) ? pointerPointee(type) : null
  if (value.mode === 'unary' && value.operator === '*') return isValidPointee(type) ? pointerType(type) : null
  const operators = value.mode === 'unary' ? unaryOperators : binaryOperators
  const rule = Object.hasOwn(operators, value.operator) ? operators[value.operator] : null
  if (!rule) return null
  const candidate = rule.operands === 'boolean' ? primitiveType('boolean') : rule.result === 'same' && type ? type : primitiveType(value.operandTypeName)
  return candidate && acceptsOperand(rule.operands, candidate) ? candidate : null
}

// Liste ce qu'une expression peut lire ou appeler.
// `allowAnyType` couvre un emplacement sans type attendu, comme une instruction d'expression : toute lecture et tout appel, procédure `void` comprise.
export function expressionSymbols(symbols, type, allowAnyType = false) {
  return {
    references: symbols.filter((symbol) => allowAnyType ? symbol.type?.kind !== 'function' : sameType(type, symbol.type)),
    functions: symbols.filter((symbol) => symbol.type?.kind === 'function' && (allowAnyType || sameType(type, symbol.type.returnType))),
  }
}

// Prépare un brouillon UI à partir des seules propriétés existantes, sans valeur logique inventée.
export function initialNodeForm(kind, node, expectedType, symbols) {
  const properties = node?.properties ?? {}
  const target = node?.references?.target
  const symbol = symbols.find((entry) => target?.kind === 'import' ? entry.importId === target.importId : target?.kind === 'name' ? entry.name === target.name : entry.nodeId === target?.nodeId)
  const declared = properties.type
  const typeName = declared?.kind === 'named' ? '@alias'
    : declared?.kind === 'array' && declared.elementType?.kind === 'primitive' ? `${declared.elementType.name}[]`
    : declared?.kind === 'pointer' && declared.pointee?.kind === 'primitive' ? `${declared.pointee.name}*`
    : declared?.kind === 'primitive' ? declared.name
    : (kind === 'Literal' || kind === 'CastExpression') && expectedType?.kind === 'primitive' ? expectedType.name : ''
  // Le type d'élément d'un tableau est imposé par le slot attendu à la création, sinon librement choisi.
  // Pour un accès par index, le slot attendu donne le type de l'élément lu, donc le tableau visé est son type tableau.
  const arrayElementTypeName = isArrayType(expectedType) && ['ArrayLiteral', 'ArrayCreation'].includes(kind) ? expectedType.elementType.name
    : kind === 'ArrayAccess' && isValidElementType(expectedType) ? expectedType.name
    : properties.elementType?.kind === 'primitive' ? properties.elementType.name : ''
  return {
    name: properties.name ?? '', typeName,
    operator: properties.operator ?? '', value: properties.value === undefined ? '' : Object.is(properties.value, -0) ? '-0' : String(properties.value),
    empty: properties.type?.name === 'string' && properties.value === '', symbolId: symbol?.id ?? (target ? '@unresolved' : ''),
    initializer: emptyExpression(), condition: emptyExpression(), expression: emptyExpression(),
    parameters: [], entryPoint: properties.entryPoint === true, allowIncomplete: false,
    elementTypeName: arrayElementTypeName, arraySize: emptyExpression(), arrayFill: emptyExpression(), arrayElements: [],
    accessArray: emptyExpression(), accessIndex: emptyExpression(), indexTypeName: 'int',
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

// Construit toute l'expression choisie en une insertion, sans modifier d'enfant déjà existant.
export function expressionDraft(value, type, symbols, depth = 0) {
  if (!value || depth > 12) return null
  if (value.mode === 'literal') return literalDraft(type, value.value, value.empty)
  const symbol = symbols.find((entry) => entry.id === value.symbolId)
  if (value.mode === 'reference') return symbol ? { kind: 'Reference', references: { target: symbolTarget(symbol) } } : null
  if (value.mode === 'binary' || value.mode === 'unary') {
    const operandType = expressionOperandType(value, type)
    const child = (entry) => expressionDraft(entry, operandType, symbols, depth + 1)
    return value.mode === 'binary'
      ? { kind: 'BinaryExpression', properties: { operator: value.operator }, children: { left: child(value.left), right: child(value.right) } }
      : { kind: 'UnaryExpression', properties: { operator: value.operator }, children: { operand: child(value.operand) } }
  }
  if (value.mode === 'call' && symbol?.type?.kind === 'function') {
    return { kind: 'CallExpression', children: { callee: { kind: 'Reference', references: { target: symbolTarget(symbol) } }, arguments: symbol.type.parameters.map((parameter, index) => expressionDraft(value.arguments?.[index], parameter, symbols, depth + 1) ?? { kind: 'Hole' }) } }
  }
  if (value.mode === 'cast') {
    return { kind: 'CastExpression', properties: { ...(type ? { type } : {}) }, children: { argument: expressionDraft(value.argument, primitiveType(value.operandTypeName), symbols, depth + 1) } }
  }
  // Un tableau annoncé n'accepte que des éléments du type exact de son annotation.
  if (value.mode === 'arrayLiteral' && isArrayType(type)) {
    const elements = (value.arrayElements ?? []).map((element) => expressionDraft(element, type.elementType, symbols, depth + 1) ?? { kind: 'Hole' })
    return { kind: 'ArrayLiteral', properties: { elementType: type.elementType }, children: { elements } }
  }
  if (value.mode === 'arrayCreation' && isArrayType(type)) {
    const size = expressionDraft(value.arraySize, primitiveType('int'), symbols, depth + 1) ?? { kind: 'Hole' }
    const fill = value.arrayFill?.mode ? expressionDraft(value.arrayFill, type.elementType, symbols, depth + 1) : null
    return { kind: 'ArrayCreation', properties: { elementType: type.elementType }, children: { size, initializer: fill } }
  }
  // Un accès par index vise un tableau du type attendu et utilise un index entier explicitement typé.
  if (value.mode === 'arrayAccess') {
    const array = expressionDraft(value.accessArray, accessedArrayType(type), symbols, depth + 1) ?? { kind: 'Hole' }
    const index = expressionDraft(value.accessIndex, arrayIndexType(value.indexTypeName), symbols, depth + 1) ?? { kind: 'Hole' }
    return { kind: 'ArrayAccess', children: { array, index } }
  }
  return null
}

// Produit une configuration nouvelle ou une modification de propriétés, sans remplacer d'enfant existant.
export function nodeConfiguration(kind, form, symbols, initialNode = null) {
  const schema = getNodeSchema(kind)
  const properties = { ...initialNode?.properties }
  const references = { ...initialNode?.references }
  const type = form.typeName === '@alias' ? initialNode?.properties.type : typeFromName(form.typeName)
  if (schema.named) properties.name = initialNode && form.name === initialNode.properties.name ? form.name : form.name.trim()
  if (kind === 'FunctionDeclaration') {
    if (form.entryPoint) properties.entryPoint = true
    else delete properties.entryPoint
  }
  if (schema.declaresType) {
    if (type) properties.type = type
    else delete properties.type
  }
  if (['ArrayLiteral', 'ArrayCreation'].includes(kind)) {
    const elementType = primitiveType(form.elementTypeName)
    if (elementType && elementType.name !== 'void') properties.elementType = elementType
    else delete properties.elementType
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
  if (kind === 'PrintStatement') children.value = expressionDraft(form.expression, type, symbols)
  // Une instruction d'expression n'impose aucun type : un appel, y compris de procédure, ou une lecture.
  if (kind === 'ExpressionStatement') children.expression = expressionDraft(form.expression, null, symbols)
  if (kind === 'FunctionDeclaration') {
    children.parameters = form.parameters.map((parameter) => ({ kind: 'Parameter', properties: { name: parameter.name.trim(), ...(typeFromName(parameter.typeName) ? { type: typeFromName(parameter.typeName) } : {}) } }))
    children.body = emptyBlock()
  }
  if (kind === 'CallExpression') {
    const symbol = symbols.find((entry) => entry.id === form.symbolId)
    if (symbol) children.callee = { kind: 'Reference', references: { target: symbolTarget(symbol) } }
  }
  if (kind === 'ArrayLiteral') {
    const elementType = primitiveType(form.elementTypeName)
    children.elements = (form.arrayElements ?? []).map((element) => expressionDraft(element, elementType, symbols) ?? { kind: 'Hole' })
  }
  if (kind === 'ArrayCreation') {
    const elementType = primitiveType(form.elementTypeName)
    children.size = expressionDraft(form.arraySize, primitiveType('int'), symbols) ?? { kind: 'Hole' }
    children.initializer = form.arrayFill?.mode ? expressionDraft(form.arrayFill, elementType, symbols) : null
  }
  if (kind === 'ArrayAccess') {
    children.array = expressionDraft(form.accessArray, accessedArrayType(primitiveType(form.elementTypeName)), symbols) ?? { kind: 'Hole' }
    children.index = expressionDraft(form.accessIndex, arrayIndexType(form.indexTypeName), symbols) ?? { kind: 'Hole' }
  }
  return { kind, properties, references, children }
}

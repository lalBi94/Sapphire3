// Chaque slot décrit l'imbrication syntaxique, jamais une liaison symbolique.
const expression = { categories: ['expression'], required: true }
const block = { kinds: ['Block'], required: true }

// Slots pour les tableaux : éléments de même type, accès par index.
const arrayExpression = { categories: ['expression'], required: true }

export const moduleRootSlot = Object.freeze({ categories: ['declaration', 'statement'], many: true, required: true })

// Vérifie uniquement la compatibilité syntaxique, indépendamment de la portée et des types.
export function acceptsNodeKind(slot, kind) {
  const schema = getNodeSchema(kind)
  return Boolean(schema && (kind === 'Hole' || slot.kinds?.includes(kind) || slot.categories?.includes(schema.category)))
}

// `group` est un identifiant visuel stable, distinct de `category` qui pilote la compatibilité syntaxique.
export const nodeSchema = Object.freeze({
  VariableDeclaration: { category: 'declaration', group: 'variable', named: true, declaresType: true, slots: { initializer: { ...expression, required: false } } },
  ConstantDeclaration: { category: 'declaration', group: 'variable', named: true, declaresType: true, slots: { initializer: expression } },
  FunctionDeclaration: { category: 'declaration', group: 'function', named: true, declaresType: true, slots: { parameters: { kinds: ['Parameter'], many: true, required: true }, body: block } },
  Parameter: { category: 'parameter', group: 'parameter', named: true, declaresType: true, slots: {} },
  TypeDeclaration: { category: 'declaration', group: 'type', named: true, declaresType: true, slots: {} },
  Block: { category: 'statement', group: 'block', slots: { statements: { categories: ['statement', 'declaration'], many: true, required: true } } },
  ReturnStatement: { category: 'statement', group: 'return', slots: { argument: { ...expression, required: false } } },
  PrintStatement: { category: 'statement', group: 'statement', slots: { value: expression } },
  IfStatement: { category: 'statement', group: 'condition', slots: { test: expression, consequent: block, alternate: { ...block, required: false } } },
  WhileStatement: { category: 'statement', group: 'loop', slots: { test: expression, body: block } },
  ForStatement: { category: 'statement', group: 'loop', slots: { initializer: { kinds: ['VariableDeclaration', 'ConstantDeclaration', 'AssignmentStatement', 'ExpressionStatement'], required: false }, test: { ...expression, required: false }, update: { categories: ['expression'], kinds: ['AssignmentStatement'], required: false }, body: block } },
  BreakStatement: { category: 'statement', group: 'loop', slots: {} },
  ContinueStatement: { category: 'statement', group: 'loop', slots: {} },
  ExpressionStatement: { category: 'statement', group: 'statement', slots: { expression } },
  AssignmentStatement: { category: 'statement', group: 'statement', slots: { target: { kinds: ['Reference'], required: true }, value: expression } },
  BinaryExpression: { category: 'expression', group: 'operator', slots: { left: expression, right: expression } },
  UnaryExpression: { category: 'expression', group: 'operator', slots: { operand: expression } },
  Literal: { category: 'expression', group: 'value', declaresType: true, slots: {} },
  Reference: { category: 'expression', group: 'value', slots: {} },
  CallExpression: { category: 'expression', group: 'function', slots: { callee: expression, arguments: { categories: ['expression'], many: true, required: true } } },
  CastExpression: { category: 'expression', group: 'operator', declaresType: true, slots: { argument: expression } },
  Hole: { category: 'hole', group: 'incomplete', slots: {} },
  // Tableaux : littéral, création avec taille, accès par index
  ArrayLiteral: { category: 'expression', group: 'value', declaresType: true, slots: { elements: { categories: ['expression'], many: true, required: true } } },
  ArrayCreation: { category: 'expression', group: 'value', declaresType: true, slots: { size: expression, initializer: { categories: ['expression'], required: false } } },
  ArrayAccess: { category: 'expression', group: 'value', slots: { array: arrayExpression, index: expression } },
})

export const binaryOperators = Object.freeze({
  '+': { operands: 'numeric', result: 'same' },
  '-': { operands: 'numeric', result: 'same' },
  '*': { operands: 'numeric', result: 'same' },
  '/': { operands: 'numeric', result: 'same' },
  '%': { operands: 'integer', result: 'same' },
  '<': { operands: 'numeric', result: 'boolean' },
  '<=': { operands: 'numeric', result: 'boolean' },
  '>': { operands: 'numeric', result: 'boolean' },
  '>=': { operands: 'numeric', result: 'boolean' },
  '==': { operands: 'matching', result: 'boolean' },
  '!=': { operands: 'matching', result: 'boolean' },
  'and': { operands: 'boolean', result: 'boolean' },
  'or': { operands: 'boolean', result: 'boolean' },
})

export const unaryOperators = Object.freeze({
  '-': { operands: 'signedNumeric', result: 'same' },
  '+': { operands: 'numeric', result: 'same' },
  not: { operands: 'boolean', result: 'boolean' },
})

// Consulte seulement les définitions propres pour accepter aussi des identifiants hostiles.
export function getNodeSchema(kind) {
  return typeof kind === 'string' && Object.hasOwn(nodeSchema, kind) ? nodeSchema[kind] : null
}

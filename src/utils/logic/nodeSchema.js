// Chaque slot décrit l'imbrication syntaxique, jamais une liaison symbolique.
const expression = { categories: ['expression'], required: true }
const block = { kinds: ['Block'], required: true }

export const moduleRootSlot = Object.freeze({ categories: ['declaration', 'statement'], many: true, required: true })

// Vérifie uniquement la compatibilité syntaxique, indépendamment de la portée et des types.
export function acceptsNodeKind(slot, kind) {
  const schema = getNodeSchema(kind)
  return Boolean(schema && (kind === 'Hole' || slot.kinds?.includes(kind) || slot.categories?.includes(schema.category)))
}

export const nodeSchema = Object.freeze({
  VariableDeclaration: { category: 'declaration', named: true, declaresType: true, slots: { initializer: { ...expression, required: false } } },
  ConstantDeclaration: { category: 'declaration', named: true, declaresType: true, slots: { initializer: expression } },
  FunctionDeclaration: { category: 'declaration', named: true, declaresType: true, slots: { parameters: { kinds: ['Parameter'], many: true, required: true }, body: block } },
  Parameter: { category: 'parameter', named: true, declaresType: true, slots: {} },
  TypeDeclaration: { category: 'declaration', named: true, declaresType: true, slots: {} },
  Block: { category: 'statement', slots: { statements: { categories: ['statement', 'declaration'], many: true, required: true } } },
  ReturnStatement: { category: 'statement', slots: { argument: { ...expression, required: false } } },
  IfStatement: { category: 'statement', slots: { test: expression, consequent: block, alternate: { ...block, required: false } } },
  WhileStatement: { category: 'statement', slots: { test: expression, body: block } },
  ForStatement: { category: 'statement', slots: { initializer: { kinds: ['VariableDeclaration', 'ConstantDeclaration', 'AssignmentStatement', 'ExpressionStatement'], required: false }, test: { ...expression, required: false }, update: { categories: ['expression'], kinds: ['AssignmentStatement'], required: false }, body: block } },
  BreakStatement: { category: 'statement', slots: {} },
  ContinueStatement: { category: 'statement', slots: {} },
  ExpressionStatement: { category: 'statement', slots: { expression } },
  AssignmentStatement: { category: 'statement', slots: { target: { kinds: ['Reference'], required: true }, value: expression } },
  BinaryExpression: { category: 'expression', slots: { left: expression, right: expression } },
  UnaryExpression: { category: 'expression', slots: { operand: expression } },
  Literal: { category: 'expression', declaresType: true, slots: {} },
  Reference: { category: 'expression', slots: {} },
  CallExpression: { category: 'expression', slots: { callee: expression, arguments: { categories: ['expression'], many: true, required: true } } },
  CastExpression: { category: 'expression', declaresType: true, slots: { argument: expression } },
  Hole: { category: 'hole', slots: {} },
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

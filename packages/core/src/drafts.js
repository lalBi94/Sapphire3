import { types } from './types.js'

// Décrit un littéral typé.
export function literal(type, value) {
  return { kind: 'Literal', properties: { type, value } }
}

// Décrit une référence résolue par nom dans la portée courante.
export function reference(name) {
  return { kind: 'Reference', references: { target: { kind: 'name', name } } }
}

// Décrit une référence vers un import déclaré par le module.
export function importReference(importId) {
  return { kind: 'Reference', references: { target: { kind: 'import', importId } } }
}

// Décrit une référence directe vers un nœud par identifiant.
export function nodeReference(nodeId) {
  return { kind: 'Reference', references: { target: { kind: 'node', nodeId } } }
}

// Décrit un paramètre nommé et typé.
export function parameter(name, type) {
  return { kind: 'Parameter', properties: { name, type } }
}

// Décrit une variable avec son initialiseur optionnel.
export function variable(name, type, initializer = null) {
  return { kind: 'VariableDeclaration', properties: { name, type }, children: { initializer } }
}

// Décrit une constante avec son initialiseur obligatoire.
export function constant(name, type, initializer) {
  return { kind: 'ConstantDeclaration', properties: { name, type }, children: { initializer } }
}

// Décrit un bloc d'instructions.
export function block(statements = []) {
  return { kind: 'Block', children: { statements } }
}

// Décrit une déclaration de fonction, avec paramètres et corps déclaratifs.
export function functionDeclaration({ name, returnType, parameters = [], body = [], visibility = null, entryPoint = false }) {
  const properties = { name, type: returnType }
  if (visibility !== null) properties.visibility = visibility
  if (entryPoint) properties.entryPoint = true
  const parameterDrafts = parameters.map((entry) => entry?.kind === 'Parameter' ? entry : parameter(entry.name, entry.type))
  const bodyDraft = Array.isArray(body) ? block(body) : body
  return { kind: 'FunctionDeclaration', properties, children: { parameters: parameterDrafts, body: bodyDraft } }
}

// Décrit le constructeur d'une classe.
export function constructorDeclaration({ parameters = [], body = [], visibility = 'public' }) {
  const draft = functionDeclaration({ name: 'constructor', returnType: types.void, parameters, body, visibility })
  draft.properties.constructor = true
  return draft
}

// Décrit une méthode de classe, publique par défaut.
export function methodDeclaration({ name, returnType, parameters = [], body = [], visibility = 'public' }) {
  return functionDeclaration({ name, returnType, parameters, body, visibility })
}

// Décrit une instruction Print.
export function print(value) {
  return { kind: 'PrintStatement', children: { value } }
}

// Décrit un retour, avec ou sans valeur.
export function returnStatement(argument = null) {
  return { kind: 'ReturnStatement', children: { argument } }
}

// Décrit un appel de fonction ou de lambda.
export function call(callee, args = []) {
  return { kind: 'CallExpression', children: { callee, arguments: args } }
}

// Décrit une opération binaire.
export function binary(operator, left, right) {
  return { kind: 'BinaryExpression', properties: { operator }, children: { left, right } }
}

// Décrit une opération unaire.
export function unary(operator, operand) {
  return { kind: 'UnaryExpression', properties: { operator }, children: { operand } }
}

// Décrit une affectation.
export function assignment(target, value) {
  return { kind: 'AssignmentStatement', children: { target, value } }
}

// Décrit une instruction d'expression.
export function expressionStatement(expression) {
  return { kind: 'ExpressionStatement', children: { expression } }
}

// Décrit une condition avec ses blocs conséquent et alternatif.
export function ifStatement(test, consequent, alternate = null) {
  const consequentDraft = Array.isArray(consequent) ? block(consequent) : consequent
  const alternateDraft = alternate === null ? null : Array.isArray(alternate) ? block(alternate) : alternate
  return { kind: 'IfStatement', children: { test, consequent: consequentDraft, alternate: alternateDraft } }
}

// Décrit une boucle while.
export function whileStatement(test, body) {
  const bodyDraft = Array.isArray(body) ? block(body) : body
  return { kind: 'WhileStatement', children: { test, body: bodyDraft } }
}

// Décrit une boucle for.
export function forStatement({ initializer = null, test = null, update = null, body }) {
  const bodyDraft = Array.isArray(body) ? block(body) : body
  return { kind: 'ForStatement', children: { initializer, test, update, body: bodyDraft } }
}

// Décrit un alias de type transparent.
export function typeAlias(name, type) {
  return { kind: 'TypeDeclaration', properties: { name, type } }
}

// Décrit une lambda sans capture ou capturante ; l'analyse décide de sa validité.
export function lambda({ returnType, parameters = [], body }) {
  const parameterDrafts = parameters.map((entry) => entry?.kind === 'Parameter' ? entry : parameter(entry.name, entry.type))
  return { kind: 'LambdaExpression', properties: { type: returnType }, children: { parameters: parameterDrafts, body } }
}

// Décrit l'expression this d'une méthode ou d'un constructeur.
export function thisExpression() {
  return { kind: 'ThisExpression' }
}

// Décrit un accès à un membre de classe.
export function member(object, name) {
  return { kind: 'MemberExpression', properties: { name }, children: { object } }
}

// Décrit une instanciation de classe.
export function newExpression(classId, args = []) {
  return { kind: 'NewExpression', properties: { classId }, children: { arguments: args } }
}

// Décrit un tableau littéral typé.
export function arrayLiteral(elementType, elements = []) {
  return { kind: 'ArrayLiteral', properties: { elementType }, children: { elements } }
}

// Décrit une création de tableau dimensionnée.
export function arrayCreation(elementType, size, initializer = null) {
  return { kind: 'ArrayCreation', properties: { elementType }, children: { size, initializer } }
}

// Décrit un accès à un élément de tableau.
export function arrayAccess(array, index) {
  return { kind: 'ArrayAccess', children: { array, index } }
}

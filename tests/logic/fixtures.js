import { createProject, createModule, createNode } from '../../src/utils/logic/index.js'

export const intType = { kind: 'primitive', name: 'int' }
export const booleanType = { kind: 'primitive', name: 'boolean' }
export const stringType = { kind: 'primitive', name: 'string' }

// Prépare les modules nécessaires à chaque scénario, sans dépendance au canvas.
export function program(...moduleIds) {
  const source = createProject('project')
  source.modules = moduleIds.map((id) => createModule(id, id))
  return source
}

// Ajoute un enregistrement source en laissant la syntaxe indépendante de son rangement.
export function node(source, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  const entry = createNode(id, moduleId, kind, { properties, children, references })
  source.nodes.push(entry)
  return entry
}

// Rattache explicitement un nœud à la liste des racines de son module.
export function root(source, moduleId, id, kind, properties = {}, children = {}, references = {}) {
  const entry = node(source, moduleId, id, kind, properties, children, references)
  source.modules.find((module) => module.id === moduleId).rootNodeIds.push(id)
  return entry
}

// Exemple du rapport : une constante publique et une variable qui la référence ailleurs.
export function twoModules() {
  const source = program('math', 'app')
  root(source, 'math', 'answer', 'ConstantDeclaration', { name: 'answer', type: intType }, { initializer: 'fortyTwo' })
  node(source, 'math', 'fortyTwo', 'Literal', { value: 42, type: intType })
  source.modules[0].exports.push({ nodeId: 'answer', name: 'answer' })
  source.modules[1].imports.push({ id: 'answerImport', moduleId: 'math', nodeId: 'answer', localName: 'answer' })
  root(source, 'app', 'result', 'VariableDeclaration', { name: 'result', type: intType }, { initializer: 'answerReference' })
  node(source, 'app', 'answerReference', 'Reference', {}, {}, { target: { kind: 'import', importId: 'answerImport' } })
  return source
}

import {
  analyzeProgram as analyzeEngine,
  createModule as createEngineModule,
  createNode as createEngineNode,
  createNodeBundle as createEngineNodeBundle,
  createProject as createEngineProject,
  moduleKinds,
  sourceFormatVersion,
} from '../../../src/utils/logic/index.js'
import { toPublicAnalysis } from './analysis.js'
import { SapphireError, SDK_ERROR_CODES } from './errors.js'
import { assertId, assertProject } from './validation.js'

export { moduleKinds, sourceFormatVersion }

// Crée un projet source vide avec un identifiant explicite ou le nom par défaut.
export function createProject(id = 'project') {
  assertId(id, 'project id')
  return createEngineProject(id)
}

// Crée un module ordinaire ou une classe, sans l'ajouter à un projet.
export function createModule(id, name, kind = moduleKinds.module) {
  assertId(id, 'module id')
  assertId(name, 'module name')
  if (!Object.values(moduleKinds).includes(kind)) {
    throw new SapphireError(SDK_ERROR_CODES.invalidArgument, `Unknown module kind: ${kind}.`)
  }
  return createEngineModule(id, name, kind)
}

// Crée une classe nommée, sans l'ajouter à un projet.
export function createClass(id, name) {
  return createModule(id, name, moduleKinds.class)
}

// Crée un nœud permissif ; l'analyse vérifie ensuite sa structure et ses types.
export function createNode(id, moduleId, kind, options = {}) {
  assertId(id, 'node id')
  assertId(moduleId, 'module id')
  assertId(kind, 'node kind')
  return createEngineNode(id, moduleId, kind, options)
}

// Fabrique des identifiants locaux, sans collision avec un projet existant.
export function createIdFactory(project = null, prefix = 'node') {
  assertId(prefix, 'id prefix')
  const used = new Set()
  if (project) {
    for (const module of project.modules ?? []) if (typeof module?.id === 'string') used.add(module.id)
    for (const node of project.nodes ?? []) if (typeof node?.id === 'string') used.add(node.id)
  }
  let next = 0
  return () => {
    let id
    do {
      next += 1
      id = `${prefix}-${next}`
    } while (used.has(id))
    used.add(id)
    return id
  }
}

// Construit un bundle déclaratif avec des identifiants générés par l'appelant.
export function createNodeBundle(moduleId, draft, idFactory) {
  assertId(moduleId, 'module id')
  if (typeof idFactory !== 'function') {
    throw new SapphireError(SDK_ERROR_CODES.invalidArgument, 'Expected an id factory function.')
  }
  return createEngineNodeBundle(moduleId, draft, idFactory)
}

// Ajoute un module ou une classe vide au projet, avec une analyse publique.
export function addModule(project, { id, name, kind = moduleKinds.module } = {}) {
  assertProject(project)
  assertId(id, 'module id')
  assertId(name, 'module name')
  if (project.modules.some((entry) => entry?.id === id)) {
    return { ok: false, code: 'ID_CONFLICT', project, diagnostics: [] }
  }
  const module = createModule(id, name, kind)
  const candidate = { ...project, modules: [...project.modules, module] }
  const analysis = toPublicAnalysis(analyzeEngine(candidate))
  return { ok: true, project: candidate, module, analysis, diagnostics: analysis.diagnostics }
}

// Ajoute une classe vide au projet.
export function addClass(project, { id, name } = {}) {
  return addModule(project, { id, name, kind: moduleKinds.class })
}

import {
  addModuleImport,
  captureSourceNode,
  deleteSourceModule,
  deleteSourceNodes,
  deleteSourceTargets,
  duplicateSourceNode,
  duplicateSourceTargets,
  ensureModuleImports,
  insertSourceNodes,
  moveSourceNode,
  moveSourceNodes,
  removeModuleImport,
  renameSourceSymbol,
  reorderSourceNode,
  setModuleExport,
  setSourceNodeContracts,
  updateSourceNode,
} from '../../../src/utils/logic/index.js'
import { toPublicAnalysis } from './analysis.js'
import { createIdFactory, createNodeBundle } from './creation.js'
import * as drafts from './drafts.js'
import { assertProject } from './validation.js'

// Convertit un résultat interne en résultat public, sans index ni Maps.
function toPublicResult(result) {
  if (!result || typeof result !== 'object') return result
  const { index: _index, analysis, ...rest } = result
  return {
    ...rest,
    diagnostics: Array.isArray(rest.diagnostics) ? rest.diagnostics : [],
    ...(analysis ? { analysis: toPublicAnalysis(analysis) } : {}),
  }
}

// Prépare un refus atomique sans perdre la source précédente.
function failure(project, code, diagnostics = []) {
  return { ok: false, code, project, diagnostics }
}

// Retire les options internes d'index avant d'appeler le moteur.
function publicOptions(options = {}) {
  const { index: _index, analysis: _analysis, ...safe } = options
  return safe
}

// Insère un bundle déclaratif dans un slot cible.
export function insertNodes(project, request, bundle, options = {}) {
  assertProject(project)
  return toPublicResult(insertSourceNodes(project, request, bundle, publicOptions(options)))
}

// Alias singulier de insertNodes.
export function insertNode(project, request, bundle, options = {}) {
  return insertNodes(project, request, bundle, options)
}

// Modifie les propriétés ou références d'un nœud existant.
export function updateNode(project, nodeId, patch) {
  assertProject(project)
  return toPublicResult(updateSourceNode(project, nodeId, patch))
}

// Supprime un nœud et son sous-arbre.
export function deleteNodes(project, targetId, options = {}) {
  assertProject(project)
  return toPublicResult(deleteSourceNodes(project, targetId, publicOptions(options)))
}

// Alias singulier de deleteNodes.
export function deleteNode(project, targetId, options = {}) {
  return deleteNodes(project, targetId, options)
}

// Supprime un module et tous ses nœuds propriétaires.
export function deleteModule(project, moduleId) {
  assertProject(project)
  return toPublicResult(deleteSourceModule(project, moduleId))
}

// Réordonne un nœud dans sa liste parente.
export function reorderNode(project, nodeId, offset, options = {}) {
  assertProject(project)
  return toPublicResult(reorderSourceNode(project, nodeId, offset, publicOptions(options)))
}

// Renomme un symbole déclaré et tous ses liens sémantiques.
export function renameSymbol(project, nodeId, newName, options = {}) {
  assertProject(project)
  return toPublicResult(renameSourceSymbol(project, nodeId, newName, publicOptions(options)))
}

// Déplace un nœud vers un destinataire compatible.
export function moveNode(project, nodeId, receiver, options = {}) {
  assertProject(project)
  return toPublicResult(moveSourceNode(project, nodeId, receiver, publicOptions(options)))
}

// Déplace plusieurs nœuds vers un même destinataire.
export function moveNodes(project, nodeIds, receiver, options = {}) {
  assertProject(project)
  return toPublicResult(moveSourceNodes(project, nodeIds, receiver, publicOptions(options)))
}

// Duplique un nœud à la fin de sa liste parente, avec des identifiants neufs.
export function duplicateNode(project, nodeId, options = {}) {
  assertProject(project)
  const captured = captureSourceNode(project, nodeId)
  if (!captured.ok) return toPublicResult(captured)
  const idFactory = options.idFactory ?? createIdFactory(project, 'copy')
  const ids = Array.isArray(options.ids) ? options.ids : captured.clipboard.nodes.map(() => idFactory())
  return toPublicResult(duplicateSourceNode(project, nodeId, { ...publicOptions(options), ids }))
}

// Duplique plusieurs nœuds ou modules avec une fabrique d'identifiants.
export function duplicateTargets(project, targets, options = {}) {
  assertProject(project)
  const idFactory = options.idFactory ?? createIdFactory(project, 'copy')
  return toPublicResult(duplicateSourceTargets(project, targets, { ...publicOptions(options), idFactory }))
}

// Supprime plusieurs nœuds ou modules en une seule opération atomique.
export function deleteTargets(project, targets, options = {}) {
  assertProject(project)
  return toPublicResult(deleteSourceTargets(project, targets, publicOptions(options)))
}

// Remplace les contrats attachés à un nœud.
export function setNodeContracts(project, nodeId, contracts) {
  assertProject(project)
  return toPublicResult(setSourceNodeContracts(project, nodeId, contracts))
}

// Ajoute ou retire un export de module.
export function setExport(project, moduleId, nodeId, exported = true) {
  assertProject(project)
  return toPublicResult(setModuleExport(project, moduleId, nodeId, exported))
}

// Ajoute un import de module, au format source `moduleId` ou au format moteur `targetModuleId`.
export function addImport(project, moduleId, entry) {
  assertProject(project)
  const normalized = entry && typeof entry === 'object'
    ? { ...entry, targetModuleId: entry.targetModuleId ?? entry.moduleId }
    : entry
  return toPublicResult(addModuleImport(project, moduleId, normalized))
}

// Retire un import de module.
export function removeImport(project, moduleId, importId) {
  assertProject(project)
  return toPublicResult(removeModuleImport(project, moduleId, importId))
}

// Ajoute automatiquement les imports nécessaires aux références d'un bundle.
export function ensureImports(project, moduleId, sources, idFactory = null) {
  assertProject(project)
  return toPublicResult(ensureModuleImports(project, moduleId, sources, idFactory))
}

// Ajoute une déclaration à la racine d'un module ou d'une classe.
export function addDeclaration(project, moduleId, draft, options = {}) {
  assertProject(project)
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (!module) return failure(project, 'TARGET_MISSING')
  const idFactory = options.idFactory ?? createIdFactory(project, `${moduleId}-${draft?.kind ?? 'node'}`)
  const bundle = createNodeBundle(moduleId, draft, idFactory)
  if (!bundle.ok) return failure(project, bundle.code)
  const targetId = module.kind === 'class'
    ? { kind: 'module', id: moduleId, scope: options.visibility === 'private' ? 'private' : 'public' }
    : { kind: 'module', id: moduleId }
  const slot = module.kind === 'class' ? 'members' : 'rootNodeIds'
  return insertNodes(project, { targetId, slot }, bundle)
}

// Ajoute une fonction à la racine d'un module ou d'une classe.
export function addFunction(project, moduleId, definition, options = {}) {
  assertProject(project)
  const draft = drafts.functionDeclaration(definition)
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (module?.kind === 'class') return addClassMember(project, moduleId, draft, options)
  return addDeclaration(project, moduleId, draft, options)
}

// Ajoute une variable à la racine d'un module ou d'une classe.
export function addVariable(project, moduleId, { name, type, initializer = null }, options = {}) {
  assertProject(project)
  const draft = drafts.variable(name, type, initializer)
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (module?.kind === 'class') return addClassMember(project, moduleId, draft, options)
  return addDeclaration(project, moduleId, draft, options)
}

// Ajoute une constante à la racine d'un module ou d'une classe.
export function addConstant(project, moduleId, { name, type, initializer }, options = {}) {
  assertProject(project)
  const draft = drafts.constant(name, type, initializer)
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (module?.kind === 'class') return addClassMember(project, moduleId, draft, options)
  return addDeclaration(project, moduleId, draft, options)
}

// Ajoute un membre à une classe, avec sa visibilité.
export function addClassMember(project, classId, draft, options = {}) {
  assertProject(project)
  if (!draft || typeof draft !== 'object') return failure(project, 'DRAFT_INVALID')
  const visibility = draft.properties?.visibility ?? options.visibility ?? 'public'
  const rootDraft = { ...draft, properties: { ...draft.properties, visibility } }
  return addDeclaration(project, classId, rootDraft, { ...options, visibility })
}

// Ajoute une méthode publique ou privée à une classe.
export function addMethod(project, classId, definition, options = {}) {
  return addClassMember(project, classId, drafts.methodDeclaration({ ...definition, visibility: options.visibility ?? 'public' }), options)
}

// Ajoute un constructeur à une classe.
export function addConstructor(project, classId, { parameters = [], body = [], visibility = 'public' } = {}) {
  return addClassMember(project, classId, drafts.constructorDeclaration({ parameters, body, visibility }), { visibility })
}

import { moduleTypes } from './moduleTypes.js'
import { createProject, createModule, analyzeProgram, createContextIndex, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, reorderSourceNode, setModuleExport, addModuleImport, removeModuleImport, ensureModuleImports, pasteSourceNode, moveSourceNode, duplicateSourceNode } from './logic/index.js'

// Recalcule les dérivés uniquement quand la source logique change.
function withSource(state, project, analysis = analyzeProgram(project), index = createContextIndex(project, analysis)) {
  return { ...state, project, analysis, index, mutationError: null }
}

// Rejoue une mutation préparée sur le document courant si une autre édition l'a devancée.
// Les imports automatiques des fonctions exportées sont recalculés sur la source réellement courante.
function replaySourceMutation(state, action) {
  if (action.type === 'pasteNode') return pasteSourceNode(state.project, action.clipboard, action.receiver, { ids: action.ids, index: state.index })
  if (action.type === 'moveNode') return moveSourceNode(state.project, action.id, action.receiver, { index: state.index })
  if (action.type === 'duplicateNode') return duplicateSourceNode(state.project, action.id, { ids: action.ids, index: state.index })
  if (action.type === 'insert') {
    const imports = action.moduleId ? ensureModuleImports(state.project, action.moduleId, action.bundle.nodes) : { ok: true, project: state.project }
    return imports.ok ? insertSourceNodes(imports.project, action.request, action.bundle, imports.project === state.project ? { index: state.index } : {}) : imports
  }
  if (action.type === 'configure') {
    const moduleId = state.index.nodes.get(action.id)?.moduleId
    const imports = moduleId ? ensureModuleImports(state.project, moduleId, [action.patch]) : { ok: true, project: state.project }
    return imports.ok ? updateSourceNode(imports.project, action.id, action.patch) : imports
  }
  if (action.type === 'delete') return deleteSourceNodes(state.project, action.targetId, { index: state.index })
  if (action.type === 'reorderNode') return reorderSourceNode(state.project, action.id, action.offset, { index: state.index })
  if (action.type === 'moduleExport') return setModuleExport(state.project, action.moduleId, action.nodeId, action.exported)
  if (action.type === 'moduleImport') return addModuleImport(state.project, action.moduleId, action.entry)
  if (action.type === 'moduleImportRemove') return removeModuleImport(state.project, action.moduleId, action.importId)
  return { ok: false, code: 'PATCH_INVALID' }
}

// Initialise un document local ; aucune donnée utilisateur n'est écrite sur disque.
export function initialDocument() {
  return withSource({ cards: [], revision: 0, mutationError: null }, createProject('workspace'))
}

// Applique les changements atomiques en gardant les coordonnées séparées du modèle source.
export function reduceDocument(state, action) {
  if (action.type === 'replaceWorkspace') {
    return withSource({ cards: action.workspace.presentation.cards, revision: state.revision + 1, mutationError: null }, action.workspace.project)
  }
  if (action.type === 'createCard') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    const next = { ...state, cards: [...state.cards, card] }
    return card.type === 'module' ? withSource(next, { ...state.project, modules: [...state.project.modules, createModule(card.id, card.name)] }) : next
  }
  if (action.type === 'geometry' || action.type === 'text' || action.type === 'presentation') {
    return { ...state, cards: state.cards.map((card) => card.id === action.id ? { ...card, ...action.patch } : card) }
  }
  if (action.type === 'deleteModule') {
    const result = deleteSourceModule(state.project, action.id)
    return result.ok
      ? withSource({ ...state, cards: state.cards.filter((card) => card.id !== action.id) }, result.project, result.analysis, result.index)
      : { ...state, mutationError: result.code }
  }
  if (action.type === 'deleteComment') {
    return { ...state, cards: state.cards.filter((card) => card.id !== action.id || !['comment', 'image'].includes(card.type)) }
  }
  if (action.type === 'rename') {
    const card = state.cards.find((entry) => entry.id === action.id)
    if (!card || !moduleTypes[card.type].renamable || !action.name.trim()) return state
    const next = { ...state, cards: state.cards.map((entry) => entry.id === card.id ? { ...entry, name: action.name } : entry) }
    return card.type === 'module' ? withSource(next, { ...state.project, modules: state.project.modules.map((module) => module.id === card.id ? { ...module, name: action.name } : module) }) : next
  }
  if (['insert', 'configure', 'delete', 'reorderNode', 'moduleExport', 'moduleImport', 'moduleImportRemove', 'pasteNode', 'moveNode', 'duplicateNode'].includes(action.type)) {
    const result = state.project === action.previousProject ? action.prepared : replaySourceMutation(state, action)
    return result.ok ? withSource(state, result.project, result.analysis, result.index) : { ...state, mutationError: result.code }
  }
  return state
}

// Invalide la branche redo dès une édition et remet les interactions à neuf après restauration.
export function reduceHistory(state, action) {
  if (action.type === 'replaceWorkspace') {
    return { past: [], present: reduceDocument(state.present, action), future: [] }
  }
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return { past: state.past.slice(0, -1), present: { ...previous, revision: state.present.revision + 1 }, future: [state.present, ...state.future] }
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return { past: [...state.past, state.present], present: { ...next, revision: state.present.revision + 1 }, future: state.future.slice(1) }
  }
  const next = reduceDocument(state.present, action)
  if (next === state.present) return state
  if (['pasteNode', 'moveNode', 'duplicateNode'].includes(action.type) && next.project === state.present.project) return { ...state, present: next }
  if (['geometry', 'text', 'presentation'].includes(action.type)) return { ...state, present: next, future: [] }
  return { past: [...state.past, state.present], present: next, future: [] }
}

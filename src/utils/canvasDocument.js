import { logicalCardTypes, moduleCardTypes, moduleTypes } from './moduleTypes.js'
import { createProject, createModule, moduleKinds, analyzeProgram, createContextIndex, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, reorderSourceNode, setSourceNodeContracts, setModuleExport, addModuleImport, removeModuleImport, ensureModuleImports, pasteSourceNode, moveSourceNode, duplicateSourceNode, insertBookmark, renameSourceSymbol, deleteSourceTargets, duplicateSourceTargets, moveSourceNodes, bindInputButtonCallback, bindInputNumberCallback, bindColorPickerCallback, pasteSourceModule } from './logic/index.js'
import { defaultDashboardConfig } from './dashboardConfig.js'

// Recalcule les dérivés uniquement quand la source logique change.
function withSource(state, project, analysis = analyzeProgram(project), index = createContextIndex(project, analysis)) {
  return { ...state, project, analysis, index, mutationError: null }
}

// Rejoue une mutation préparée sur le document courant si une autre édition l'a devancée.
// Les imports automatiques des fonctions exportées sont recalculés sur la source réellement courante.
function replaySourceMutation(state, action) {
  if (action.type === 'pasteNode') return pasteSourceNode(state.project, action.clipboard, action.receiver, { ids: action.ids, index: state.index })
  if (action.type === 'moveNode') return moveSourceNode(state.project, action.id, action.receiver, { index: state.index })
  if (action.type === 'moveNodes') return moveSourceNodes(state.project, action.ids, action.receiver, { index: state.index })
  if (action.type === 'duplicateNode') return duplicateSourceNode(state.project, action.id, { ids: action.ids, index: state.index })
  if (action.type === 'bulkDelete') return deleteSourceTargets(state.project, action.targets, { index: state.index })
  if (action.type === 'bulkDuplicate') {
    let cursor = 0
    const idFactory = () => action.ids[cursor++] ?? ''
    return duplicateSourceTargets(state.project, action.targets, { idFactory, index: state.index })
  }
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
  if (action.type === 'contracts') return setSourceNodeContracts(state.project, action.id, action.contracts)
  if (action.type === 'renameSymbol') return renameSourceSymbol(state.project, action.id, action.name, { index: state.index })
  if (action.type === 'moduleExport') return setModuleExport(state.project, action.moduleId, action.nodeId, action.exported)
  if (action.type === 'moduleImport') return addModuleImport(state.project, action.moduleId, action.entry)
  if (action.type === 'moduleImportRemove') return removeModuleImport(state.project, action.moduleId, action.importId)
  if (action.type === 'inputButtonBind') return bindInputButtonCallback(state.project, action.moduleId, action.targetFunctionId)
  if (action.type === 'inputNumberBind') return bindInputNumberCallback(state.project, action.moduleId, action.targetFunctionId)
  if (action.type === 'colorPickerBind') return bindColorPickerCallback(state.project, action.moduleId, action.targetFunctionId)
  return { ok: false, code: 'PATCH_INVALID' }
}

// Initialise un document local ; aucune donnée utilisateur n'est écrite sur disque.
export function initialDocument() {
  return withSource({ cards: [], revision: 0, exercise: null, dashboard: defaultDashboardConfig(), mutationError: null }, createProject('workspace'))
}

// Applique les changements atomiques en gardant les coordonnées séparées du modèle source.
export function reduceDocument(state, action) {
  if (action.type === 'replaceWorkspace') {
    return withSource({ cards: action.workspace.presentation.cards, revision: state.revision + 1, exercise: action.workspace.exercise ?? null, dashboard: action.workspace.dashboard ?? defaultDashboardConfig(), mutationError: null }, action.workspace.project)
  }
  if (action.type === 'exercise') {
    return { ...state, exercise: action.exercise }
  }
  if (action.type === 'dashboard') {
    return { ...state, dashboard: action.dashboard }
  }
  if (action.type === 'refreshAnalysis') {
    return withSource(state, state.project)
  }
  if (action.type === 'restoreStarter') {
    return withSource({ ...state, cards: action.starter.presentation.cards, revision: state.revision + 1 }, action.starter.project)
  }
  if (action.type === 'createCard') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    const next = { ...state, cards: [...state.cards, card] }
    if (moduleCardTypes.includes(card.type)) {
      const kind = card.type === 'class' ? moduleKinds.class : moduleKinds.module
      return withSource(next, { ...state.project, modules: [...state.project.modules, createModule(card.id, card.name, kind)] })
    }
    return next
  }
  if (action.type === 'createScreen') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.screen.module], nodes: [...state.project.nodes, ...action.screen.nodes] })
  }
  // Une LED suit exactement la même mécanique : carte de présentation + module caché normal.
  if (action.type === 'createLed') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.led.module], nodes: [...state.project.nodes, ...action.led.nodes] })
  }
  // Un bouton d'entrée est une globale booléenne derrière une carte interactive.
  if (action.type === 'createInputButton') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.inputButton.module], nodes: [...state.project.nodes, ...action.inputButton.nodes] })
  }
  // Une entrée numérique est une fonction onChange(int) derrière un champ interactif.
  if (action.type === 'createInputNumber') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.inputNumber.module], nodes: [...state.project.nodes, ...action.inputNumber.nodes] })
  }
  // Un sélecteur de couleur est une fonction onChange(int[]) derrière une roue chromatique.
  if (action.type === 'createColorPicker') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.colorPicker.module], nodes: [...state.project.nodes, ...action.colorPicker.nodes] })
  }
  // Un module entier copié arrive avec ses nœuds et une carte neuve.
  if (action.type === 'pasteModule') {
    const result = state.project === action.previousProject ? action.prepared : pasteSourceModule(state.project, action.clipboard, { idFactory: action.idFactory, index: state.index })
    if (!result.ok) return { ...state, mutationError: result.code }
    const type = result.module.kind === 'class' ? 'class' : 'module'
    const definition = moduleTypes[type]
    const center = action.position ?? { x: 200, y: 200 }
    const card = {
      id: result.module.id,
      type,
      name: result.module.name,
      x: Math.round(center.x - definition.width / 2),
      y: Math.round(center.y - definition.height / 2),
      width: result.sourceCard?.width ?? definition.width,
      height: result.sourceCard?.height ?? definition.height,
      expandedNodeIds: [],
      ...(result.sourceCard?.emoji ? { emoji: result.sourceCard.emoji } : {}),
    }
    return withSource({ ...state, cards: [...state.cards, card] }, result.project, result.analysis, result.index)
  }
  // Une LED RVB reprend la même carte logique, avec trois canaux au lieu d'un booléen.
  if (action.type === 'createRgbLed') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.rgbLed.module], nodes: [...state.project.nodes, ...action.rgbLed.nodes] })
  }
  if (action.type === 'createGauge') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.gauge.module], nodes: [...state.project.nodes, ...action.gauge.nodes] })
  }
  if (action.type === 'createProgress') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.progress.module], nodes: [...state.project.nodes, ...action.progress.nodes] })
  }
  if (action.type === 'createHeatmap') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.heatmap.module], nodes: [...state.project.nodes, ...action.heatmap.nodes] })
  }
  if (action.type === 'createBarChart') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.barChart.module], nodes: [...state.project.nodes, ...action.barChart.nodes] })
  }
  if (action.type === 'createXyPlot') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.xyPlot.module], nodes: [...state.project.nodes, ...action.xyPlot.nodes] })
  }
  if (action.type === 'createOscilloscope') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    return withSource({ ...state, cards: [...state.cards, card] }, { ...state.project, modules: [...state.project.modules, action.oscilloscope.module], nodes: [...state.project.nodes, ...action.oscilloscope.nodes] })
  }
  if (action.type === 'insertBookmark') {
    const result = state.project === action.previousProject
      ? action.prepared
      : insertBookmark(state.project, action.bookmark, { moduleId: action.moduleId, moduleName: action.moduleName, ids: action.ids, existingModule: action.existingModule, index: state.index })
    if (!result.ok) return { ...state, mutationError: result.code }
    if (action.existingModule) return withSource(state, result.project, result.analysis, result.index)
    const definition = moduleTypes.module
    const card = { id: action.moduleId, type: 'module', name: action.moduleName, x: action.position.x, y: action.position.y, width: definition.width, height: definition.height, expandedNodeIds: [] }
    return withSource({ ...state, cards: [...state.cards, card] }, result.project, result.analysis, result.index)
  }
  if (action.type === 'geometry' || action.type === 'text' || action.type === 'presentation') {
    return { ...state, cards: state.cards.map((card) => card.id === action.id ? { ...card, ...action.patch } : card) }
  }
  if (action.type === 'layout') {
    const positions = action.positions ?? {}
    const cards = state.cards.map((card) => positions[card.id] ? { ...card, ...positions[card.id] } : card)
    return cards.every((card, index) => card === state.cards[index]) ? state : { ...state, cards }
  }
  if (action.type === 'deleteModule') {
    const result = deleteSourceModule(state.project, action.id)
    return result.ok
      ? withSource({ ...state, cards: state.cards.filter((card) => card.id !== action.id) }, result.project, result.analysis, result.index)
      : { ...state, mutationError: result.code }
  }
  if (action.type === 'deleteComment') {
    return { ...state, cards: state.cards.filter((card) => card.id !== action.id || !['comment', 'image', 'pluginWidget'].includes(card.type)) }
  }
  if (action.type === 'bulkDelete') {
    const result = state.project === action.previousProject ? action.prepared : deleteSourceTargets(state.project, action.targets, { index: state.index })
    if (!result.ok) return { ...state, mutationError: result.code }
    const removed = new Set(result.removedModuleIds)
    return withSource({ ...state, cards: state.cards.filter((card) => !removed.has(card.id)) }, result.project, result.analysis, result.index)
  }
  if (action.type === 'bulkDuplicate') {
    const result = state.project === action.previousProject ? action.prepared : replaySourceMutation(state, action)
    if (!result.ok) return { ...state, mutationError: result.code }
    const cards = result.duplicatedModules.map((entry, position) => {
      const source = state.cards.find((card) => card.id === entry.sourceModuleId)
      const spec = action.cards[position] ?? {}
      const cardType = source?.type === 'class' ? 'class' : 'module'
      return {
        ...spec,
        id: entry.moduleId,
        name: entry.name,
        type: cardType,
        x: spec.x ?? 0,
        y: spec.y ?? 0,
        width: spec.width ?? moduleTypes[cardType].width,
        height: spec.height ?? moduleTypes[cardType].height,
        expandedNodeIds: (source?.expandedNodeIds ?? []).map((id) => entry.nodeIdMap[id]).filter(Boolean),
      }
    })
    return withSource({ ...state, cards: [...state.cards, ...cards] }, result.project, result.analysis, result.index)
  }
  if (action.type === 'rename') {
    const card = state.cards.find((entry) => entry.id === action.id)
    if (!card || !moduleTypes[card.type].renamable || !action.name.trim()) return state
    const next = { ...state, cards: state.cards.map((entry) => entry.id === card.id ? { ...entry, name: action.name } : entry) }
    return logicalCardTypes.includes(card.type) ? withSource(next, { ...state.project, modules: state.project.modules.map((module) => module.id === card.id ? { ...module, name: action.name } : module) }) : next
  }
  if (['insert', 'configure', 'delete', 'reorderNode', 'contracts', 'renameSymbol', 'moduleExport', 'moduleImport', 'moduleImportRemove', 'inputButtonBind', 'inputNumberBind', 'colorPickerBind', 'pasteNode', 'moveNode', 'moveNodes', 'duplicateNode'].includes(action.type)) {
    const result = state.project === action.previousProject ? action.prepared : replaySourceMutation(state, action)
    return result.ok ? withSource(state, result.project, result.analysis, result.index) : { ...state, mutationError: result.code }
  }
  return state
}

// Indique si une action mérite une nouvelle étape d'historique.
function recordsHistory(action) {
  if (action.history === true) return true
  if (action.history === false) return false
  if (['geometry', 'text', 'layout'].includes(action.type)) return true
  if (['presentation', 'exercise', 'dashboard', 'refreshAnalysis'].includes(action.type)) return false
  return true
}

// Termine un geste en cours : une étape seulement si le document a réellement changé.
function finalizeHistoryCheckpoint(state) {
  if (!state.checkpoint) return state
  if (state.checkpoint.present === state.present) return { ...state, checkpoint: null }
  return { past: [...state.past, state.checkpoint.present], present: state.present, future: [], checkpoint: null }
}

// Invalide la branche redo dès une édition et remet les interactions à neuf après restauration.
export function reduceHistory(state, action) {
  if (action.type === 'replaceWorkspace') {
    return { past: [], present: reduceDocument(state.present, action), future: [], checkpoint: null }
  }
  if (action.type === 'restoreStarter') {
    return { past: [], present: reduceDocument(state.present, action), future: [], checkpoint: null }
  }
  if (action.type === 'historyStart') {
    const next = finalizeHistoryCheckpoint(state)
    return { ...next, checkpoint: { present: next.present } }
  }
  if (action.type === 'historyEnd') return finalizeHistoryCheckpoint(state)
  if (action.type === 'undo') {
    const next = finalizeHistoryCheckpoint(state)
    if (next.past.length === 0) return next
    const previous = next.past[next.past.length - 1]
    return { past: next.past.slice(0, -1), present: { ...previous, revision: next.present.revision + 1 }, future: [next.present, ...next.future], checkpoint: null }
  }
  if (action.type === 'redo') {
    const next = finalizeHistoryCheckpoint(state)
    if (next.future.length === 0) return next
    const following = next.future[0]
    return { past: [...next.past, next.present], present: { ...following, revision: next.present.revision + 1 }, future: next.future.slice(1), checkpoint: null }
  }
  const next = reduceDocument(state.present, action)
  if (next === state.present) return state
  if (state.checkpoint) return { ...state, present: next, future: [] }
  if (['pasteNode', 'moveNode', 'moveNodes', 'duplicateNode'].includes(action.type) && next.project === state.present.project) return { ...state, present: next }
  if (!recordsHistory(action)) return { ...state, present: next, future: [] }
  return { past: [...state.past, state.present], present: next, future: [], checkpoint: null }
}

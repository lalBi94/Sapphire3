import { useReducer } from 'react'
import { moduleCardTypes, moduleTypes } from '../utils/moduleTypes.js'
import { createScreenModule, screenDefaults } from '../utils/screenNode.js'
import { createGaugeModule, gaugeDefaults } from '../utils/gaugeNode.js'
import { createProgressModule, progressDefaults } from '../utils/progressNode.js'
import { createBarChartModule, barChartDefaults } from '../utils/barChartNode.js'
import { createHeatmapModule } from '../utils/heatmapNode.js'
import { createLedModule, ledDefaults } from '../utils/ledNode.js'
import { createRgbLedModule, rgbLedDefaults } from '../utils/rgbLedNode.js'
import { resolveContext, createNodeBundle, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, reorderSourceNode, setSourceNodeContracts, setModuleExport, addModuleImport, removeModuleImport, ensureModuleImports, captureSourceNode, pasteSourceNode, moveSourceNode, duplicateSourceNode, insertBookmark, renameSourceSymbol, deleteSourceTargets, duplicateSourceTargets, moveSourceNodes } from '../utils/logic/index.js'
import { initialDocument, reduceHistory } from '../utils/canvasDocument.js'

// Évite deux cartes Module du même nom lors de l'insertion d'un favori.
function uniqueModuleName(names, base) {
  const fallback = typeof base === 'string' && base.trim() ? base.trim() : 'Bookmark'
  if (!names.has(fallback)) return fallback
  let suffix = 2
  while (names.has(`${fallback} ${suffix}`)) suffix += 1
  return `${fallback} ${suffix}`
}

// Expose les éditions de document ; sélection et navigation restent dans les composants UI.
export default function useCanvasDocument() {
  const [history, dispatch] = useReducer(reduceHistory, undefined, () => ({ past: [], present: initialDocument(), future: [] }))
  const document = history.present

  // Produit l'identifiant une seule fois dans le handler, jamais dans un rendu ou un reducer.
  function createCard(type, position, name = moduleTypes[type]?.label) {
    const definition = moduleTypes[type]
    if (!definition) return
    if (type === 'screen') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.screen?.index) || 0)) + 1
      const screenName = `${name} ${index}`
      const screen = createScreenModule(id, screenName, index, screenDefaults)
      dispatch({ type: 'createScreen', card: { id, type, name: screenName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [], screenWidth: screenDefaults.width, screenHeight: screenDefaults.height }, screen })
      return
    }
    if (type === 'gauge') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.gauge?.index) || 0)) + 1
      const gaugeName = `${name} ${index}`
      const gauge = createGaugeModule(id, gaugeName, index, gaugeDefaults)
      dispatch({ type: 'createGauge', card: { id, type, name: gaugeName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, gauge })
      return
    }
    if (type === 'progress') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.progress?.index) || 0)) + 1
      const progressName = `${name} ${index}`
      const progress = createProgressModule(id, progressName, index, progressDefaults)
      dispatch({ type: 'createProgress', card: { id, type, name: progressName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, progress })
      return
    }
    if (type === 'heatmap') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.heatmap?.index) || 0)) + 1
      const heatmapName = `${name} ${index}`
      const heatmap = createHeatmapModule(id, heatmapName, index)
      dispatch({ type: 'createHeatmap', card: { id, type, name: heatmapName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, heatmap })
      return
    }
    if (type === 'barChart') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.barChart?.index) || 0)) + 1
      const barChartName = `${name} ${index}`
      const barChart = createBarChartModule(id, barChartName, index, barChartDefaults)
      dispatch({ type: 'createBarChart', card: { id, type, name: barChartName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, barChart })
      return
    }
    if (type === 'led') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.led?.index) || 0)) + 1
      const ledName = `${name} ${index}`
      const led = createLedModule(id, ledName, index, ledDefaults)
      dispatch({ type: 'createLed', card: { id, type, name: ledName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, led })
      return
    }
    if (type === 'rgbLed') {
      const id = crypto.randomUUID()
      const index = Math.max(0, ...document.project.modules.map((module) => Number(module.rgbLed?.index) || 0)) + 1
      const rgbLedName = `${name} ${index}`
      const rgbLed = createRgbLedModule(id, rgbLedName, index, rgbLedDefaults)
      dispatch({ type: 'createRgbLed', card: { id, type, name: rgbLedName, ...position, width: definition.width, height: definition.height, expandedNodeIds: [] }, rgbLed })
      return
    }
    dispatch({ type: 'createCard', card: { id: crypto.randomUUID(), type, name, ...(definition.hasText ? { text: '' } : {}), ...(definition.hasImage ? { image: '', caption: '' } : {}), ...position, width: definition.width, height: definition.height, expandedNodeIds: [] } })
  }

  // Modifie la présentation sans réanalyser le programme.
  function updateGeometry(id, patch) {
    dispatch({ type: 'geometry', id, patch })
  }

  // Applique d'un coup de nouvelles positions de cartes, sans toucher au programme.
  function arrangeModules(positions) {
    dispatch({ type: 'layout', positions })
  }

  // Synchronise le nom du module logique, ou seulement le titre d'une annotation visuelle.
  function renameCard(id, name) {
    dispatch({ type: 'rename', id, name })
  }

  // Ne transmet jamais le texte d'une annotation au moteur logique.
  function updateComment(id, text) {
    dispatch({ type: 'text', id, patch: { text } })
  }

  // Conserve l'image et sa légende dans la présentation, sans toucher à la source logique.
  function updateImage(id, patch) {
    dispatch({ type: 'text', id, patch })
  }

  // Prépare puis insère une nouvelle arborescence ; un état concurrent est revérifié par le reducer.
  // Une fonction exportée d'un autre module reçoit son import local dans la même opération.
  function insertNode(targetId, slot, draft) {
    const context = resolveContext(document.project, targetId, slot, document.index)
    if (!context.ok) return context
    const bundle = createNodeBundle(context.moduleId, draft, () => crypto.randomUUID())
    const imports = ensureModuleImports(document.project, context.moduleId, bundle.nodes, () => crypto.randomUUID())
    if (!imports.ok) return imports
    const request = { targetId, slot }
    const prepared = insertSourceNodes(imports.project, request, bundle, imports.imported ? {} : { index: document.index })
    if (prepared.ok) dispatch({ type: 'insert', previousProject: document.project, prepared, request, bundle, moduleId: context.moduleId })
    return prepared
  }

  // Les propriétés peuvent devenir incomplètes, mais ne remplacent aucun enfant.
  function configureNode(id, patch) {
    const moduleId = document.index.nodes.get(id)?.moduleId
    const imports = moduleId ? ensureModuleImports(document.project, moduleId, [patch], () => crypto.randomUUID()) : { ok: false, code: 'TARGET_INVALID' }
    if (!imports.ok) return imports
    const prepared = updateSourceNode(imports.project, id, patch)
    if (prepared.ok) dispatch({ type: 'configure', previousProject: document.project, prepared, id, patch })
    return prepared
  }

  // Alloue les nouveaux identifiants une fois, puis colle le sous-arbre validé atomiquement.
  function pasteNode(clipboard, receiver) {
    const ids = clipboard.nodes.map(() => crypto.randomUUID())
    const prepared = pasteSourceNode(document.project, clipboard, receiver, { ids, index: document.index })
    if (prepared.ok) dispatch({ type: 'pasteNode', previousProject: document.project, prepared, clipboard, receiver, ids })
    return prepared
  }

  // Déplace la source existante après une nouvelle validation du destinataire courant.
  function moveNode(id, receiver) {
    const prepared = moveSourceNode(document.project, id, receiver, { index: document.index })
    if (prepared.ok) dispatch({ type: 'moveNode', previousProject: document.project, prepared, id, receiver })
    return prepared
  }

  // Duplique dans la liste parente sans écraser un enfant unique.
  function duplicateNode(id) {
    const captured = captureSourceNode(document.project, id, { index: document.index })
    if (!captured.ok) return captured
    const ids = captured.clipboard.nodes.map(() => crypto.randomUUID())
    const prepared = duplicateSourceNode(document.project, id, { ids, index: document.index })
    if (prepared.ok) dispatch({ type: 'duplicateNode', previousProject: document.project, prepared, id, ids })
    return prepared
  }

  // Insère un favori dans un module neuf (avec sa carte) ou existant, en une seule étape d'historique.
  function insertSavedBookmark(bookmark, options = {}) {
    if (!Array.isArray(bookmark?.nodes) || bookmark.nodes.length === 0) return { ok: false, code: 'BOOKMARK_INVALID' }
    const ids = bookmark.nodes.map(() => crypto.randomUUID())
    const existing = Boolean(options.targetModuleId && document.index.modules.has(options.targetModuleId))
    const moduleId = existing ? options.targetModuleId : crypto.randomUUID()
    const moduleName = existing
      ? document.index.modules.get(moduleId)?.name ?? ''
      : uniqueModuleName(new Set(document.cards.filter((card) => moduleCardTypes.includes(card.type)).map((card) => card.name)), bookmark.name)
    const prepared = insertBookmark(document.project, bookmark, { moduleId, moduleName, ids, existingModule: existing, index: document.index })
    if (prepared.ok) dispatch({ type: 'insertBookmark', previousProject: document.project, prepared, bookmark, moduleId, moduleName, ids, existingModule: existing, position: options.position ?? null })
    return { ...prepared, moduleId, moduleName, existingModule: existing }
  }

  // Calcule l'aperçu d'un renommage sémantique sans modifier le document courant.
  function previewSymbolRename(id, name) {
    return renameSourceSymbol(document.project, id, name, { analysis: document.analysis, index: document.index })
  }

  // Applique le renommage après recalcul sur la source courante ; l'historique couvre l'opération entière.
  function applySymbolRename(id, name) {
    const prepared = previewSymbolRename(id, name)
    if (prepared.ok) dispatch({ type: 'renameSymbol', previousProject: document.project, prepared, id, name })
    return prepared
  }

  // Déplace plusieurs nœuds sélectionnés vers le même destinataire, en une seule réanalyse.
  function moveNodes(ids, receiver) {
    const prepared = moveSourceNodes(document.project, ids, receiver, { index: document.index })
    if (prepared.ok) dispatch({ type: 'moveNodes', previousProject: document.project, prepared, ids, receiver })
    return prepared
  }

  // Duplique un ensemble de nœuds et de modules ; les cartes des modules copiés sont ajoutées dans la même étape.
  function duplicateSelection(targets) {
    const allocated = []
    const idFactory = () => {
      const id = crypto.randomUUID()
      allocated.push(id)
      return id
    }
    const prepared = duplicateSourceTargets(document.project, targets, { idFactory, index: document.index })
    if (!prepared.ok) return prepared
    const cards = prepared.duplicatedModules.map((entry, position) => {
      const source = document.cards.find((card) => card.id === entry.sourceModuleId)
      const definition = moduleTypes.module
      return {
        id: entry.moduleId,
        type: 'module',
        name: entry.name,
        x: (source?.x ?? 0) + 32 * (position + 1),
        y: (source?.y ?? 0) + 32 * (position + 1),
        width: source?.width ?? definition.width,
        height: source?.height ?? definition.height,
        expandedNodeIds: (source?.expandedNodeIds ?? []).map((id) => entry.nodeIdMap[id]).filter(Boolean),
        ...(source?.emoji ? { emoji: source.emoji } : {}),
      }
    })
    dispatch({ type: 'bulkDuplicate', previousProject: document.project, prepared, targets, ids: allocated, cards })
    return prepared
  }

  // Supprime tous les nœuds et modules sélectionnés, avec leurs cartes, en une seule étape.
  function deleteSelection(targets) {
    const prepared = deleteSourceTargets(document.project, targets, { index: document.index })
    if (prepared.ok) dispatch({ type: 'bulkDelete', previousProject: document.project, prepared, targets })
    return prepared
  }

  // Réordonne une instruction dans sa liste parente, sans recréer le nœud ni changer ses identifiants.
  function reorderNode(id, offset) {
    const prepared = reorderSourceNode(document.project, id, offset, { index: document.index })
    if (prepared.ok) dispatch({ type: 'reorderNode', previousProject: document.project, prepared, id, offset })
    return prepared
  }

  // Change les contraintes vérifiables d'un nœud, sans toucher à ses propriétés ni à la géométrie.
  function setNodeContracts(id, contracts) {
    const prepared = setSourceNodeContracts(document.project, id, contracts)
    if (prepared.ok) dispatch({ type: 'contracts', previousProject: document.project, prepared, id, contracts })
    return prepared
  }

  // Supprime le nœud et ses descendants ; les références restantes produisent leurs diagnostics.
  function deleteNode(id) {
    const targetId = id && typeof id === 'object' ? id : { kind: 'node', id }
    const prepared = deleteSourceNodes(document.project, targetId, { index: document.index })
    if (prepared.ok) dispatch({ type: 'delete', previousProject: document.project, prepared, targetId })
    return prepared
  }

  // Retire ensemble la carte et sa source ; le reducer revérifie le document courant.
  function deleteModule(id) {
    const prepared = deleteSourceModule(document.project, id)
    if (prepared.ok) dispatch({ type: 'deleteModule', id })
    return prepared
  }

  // Publie ou retire une fonction de l'interface du module, sans modifier sa déclaration.
  function exportFunction(moduleId, nodeId, exported) {
    const prepared = setModuleExport(document.project, moduleId, nodeId, exported)
    if (prepared.ok) dispatch({ type: 'moduleExport', previousProject: document.project, prepared, moduleId, nodeId, exported })
    return prepared
  }

  // Lie une fonction d'un autre module sous un nom local stable.
  function importFunction(moduleId, candidate, localName) {
    const entry = { id: crypto.randomUUID(), targetModuleId: candidate.moduleId, nodeId: candidate.nodeId, localName }
    const prepared = addModuleImport(document.project, moduleId, entry)
    if (prepared.ok) dispatch({ type: 'moduleImport', previousProject: document.project, prepared, moduleId, entry })
    return prepared
  }

  // Supprime la liaison d'import ; les références restantes signalent leur diagnostic.
  function removeImport(moduleId, importId) {
    const prepared = removeModuleImport(document.project, moduleId, importId)
    if (prepared.ok) dispatch({ type: 'moduleImportRemove', previousProject: document.project, prepared, moduleId, importId })
    return prepared
  }

  // Retire uniquement l'annotation visuelle, sans toucher à la source ni réanalyser le programme.
  function deleteComment(id) {
    if (!document.cards.some((card) => card.id === id && ['comment', 'image'].includes(card.type))) return { ok: false, code: 'TARGET_INVALID' }
    dispatch({ type: 'deleteComment', id })
    return { ok: true }
  }

  // Conserve le pliage dans la présentation exportable, jamais dans la source logique.
  function setExpandedNodes(id, expandedNodeIds) {
    dispatch({ type: 'presentation', id, patch: { expandedNodeIds } })
  }

  // Masque ou réaffiche une carte : portée purement visuelle, la source et l'historique restent intacts.
  function setCardHidden(id, hidden) {
    dispatch({ type: 'presentation', id, patch: { hidden } })
  }

  // Verrouille ou déverrouille une carte : empêche son déplacement et son redimensionnement, sans toucher à la source.
  function setCardLocked(id, locked) {
    dispatch({ type: 'presentation', id, patch: { locked } })
  }

  // Pose ou retire l'emoji de présentation d'une carte, sans toucher à la source logique.
  function setCardEmoji(id, emoji) {
    dispatch({ type: 'presentation', id, patch: { emoji } })
  }

  // Met à jour le manifeste d'exercice sans créer d'étape undo ni réanalyser le programme.
  function setExercise(exercise) {
    dispatch({ type: 'exercise', exercise })
  }

  // Restaure le squelette d'origine sans supprimer le manifeste d'exercice.
  function restoreStarter(starter) {
    if (!starter) return
    dispatch({ type: 'restoreStarter', starter })
  }

  // Charge un document validé et force le remontage des interactions locales des cartes.
  function replaceWorkspace(workspace) {
    dispatch({ type: 'replaceWorkspace', workspace })
  }

  // Revient à l’état précédent sans toucher aux fichiers exportés.
  function undo() {
    dispatch({ type: 'undo' })
  }

  // Rejoue l’état annulé le plus récent.
  function redo() {
    dispatch({ type: 'redo' })
  }

  return { ...document, createCard, updateGeometry, arrangeModules, renameCard, updateComment, updateImage, insertNode, configureNode, pasteNode, moveNode, moveNodes, duplicateNode, duplicateSelection, deleteNode, deleteModule, deleteSelection, deleteComment, exportFunction, importFunction, removeImport, reorderNode, setNodeContracts, previewSymbolRename, applySymbolRename, setExpandedNodes, setCardHidden, setCardLocked, setCardEmoji, setExercise, restoreStarter, insertSavedBookmark, replaceWorkspace, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 }
}

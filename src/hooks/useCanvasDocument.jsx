import { useReducer } from 'react'
import { moduleTypes } from '../utils/moduleTypes.js'
import { resolveContext, createNodeBundle, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, setModuleExport, addModuleImport, removeModuleImport } from '../utils/logic/index.js'
import { initialDocument, reduceHistory } from '../utils/canvasDocument.js'

// Expose les éditions de document ; sélection et navigation restent dans les composants UI.
export default function useCanvasDocument() {
  const [history, dispatch] = useReducer(reduceHistory, undefined, () => ({ past: [], present: initialDocument(), future: [] }))
  const document = history.present

  // Produit l'identifiant une seule fois dans le handler, jamais dans un rendu ou un reducer.
  function createCard(type, position, name = moduleTypes[type]?.label) {
    const definition = moduleTypes[type]
    if (!definition) return
    dispatch({ type: 'createCard', card: { id: crypto.randomUUID(), type, name, ...(definition.hasText ? { text: '' } : {}), ...(definition.hasImage ? { image: '', caption: '' } : {}), ...position, width: definition.width, height: definition.height, expandedNodeIds: [] } })
  }

  // Modifie la présentation sans réanalyser le programme.
  function updateGeometry(id, patch) {
    dispatch({ type: 'geometry', id, patch })
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
  function insertNode(targetId, slot, draft) {
    const context = resolveContext(document.project, targetId, slot, document.index)
    if (!context.ok) return context
    const bundle = createNodeBundle(context.moduleId, draft, () => crypto.randomUUID())
    const request = { targetId, slot }
    const prepared = insertSourceNodes(document.project, request, bundle, { index: document.index })
    if (prepared.ok) dispatch({ type: 'insert', previousProject: document.project, prepared, request, bundle })
    return prepared
  }

  // Les propriétés peuvent devenir incomplètes, mais ne remplacent aucun enfant.
  function configureNode(id, patch) {
    const prepared = updateSourceNode(document.project, id, patch)
    if (prepared.ok) dispatch({ type: 'configure', previousProject: document.project, prepared, id, patch })
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

  return { ...document, createCard, updateGeometry, renameCard, updateComment, updateImage, insertNode, configureNode, deleteNode, deleteModule, deleteComment, exportFunction, importFunction, removeImport, setExpandedNodes, replaceWorkspace, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 }
}

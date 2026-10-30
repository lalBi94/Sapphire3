import { useReducer } from 'react'
import { moduleTypes } from '../utils/moduleTypes.js'
import { createProject, createModule, analyzeProgram, createContextIndex, resolveContext, createNodeBundle, insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule } from '../utils/logic/index.js'

// Recalcule les dérivés uniquement quand la source logique change.
function withSource(state, project, analysis = analyzeProgram(project), index = createContextIndex(project, analysis)) {
  return { ...state, project, analysis, index, mutationError: null }
}

// Initialise un document local ; aucune donnée utilisateur n'est écrite sur disque.
function initialDocument() {
  return withSource({ cards: [], mutationError: null }, createProject('workspace'))
}

// Applique les changements atomiques en gardant les coordonnées séparées du modèle source.
function reduceDocument(state, action) {
  if (action.type === 'createCard') {
    const card = action.card
    if (state.cards.some((entry) => entry.id === card.id)) return state
    const next = { ...state, cards: [...state.cards, card] }
    return card.type === 'comment' ? next : withSource(next, { ...state.project, modules: [...state.project.modules, createModule(card.id, card.name, card.type)] })
  }
  if (action.type === 'geometry' || action.type === 'text') {
    return { ...state, cards: state.cards.map((card) => card.id === action.id ? { ...card, ...action.patch } : card) }
  }
  if (action.type === 'deleteModule') {
    const result = deleteSourceModule(state.project, action.id)
    return result.ok
      ? withSource({ ...state, cards: state.cards.filter((card) => card.id !== action.id) }, result.project, result.analysis, result.index)
      : { ...state, mutationError: result.code }
  }
  if (action.type === 'rename') {
    const card = state.cards.find((entry) => entry.id === action.id)
    if (!card || !moduleTypes[card.type].renamable || !action.name.trim()) return state
    const next = { ...state, cards: state.cards.map((entry) => entry.id === card.id ? { ...entry, name: action.name } : entry) }
    return card.type === 'comment' ? next : withSource(next, { ...state.project, modules: state.project.modules.map((module) => module.id === card.id ? { ...module, name: action.name } : module) })
  }
  if (action.type === 'insert' || action.type === 'configure' || action.type === 'delete') {
    const result = state.project === action.previousProject ? action.prepared : action.type === 'insert'
      ? insertSourceNodes(state.project, action.request, action.bundle, { index: state.index })
      : action.type === 'configure'
        ? updateSourceNode(state.project, action.id, action.patch)
        : deleteSourceNodes(state.project, action.targetId, { index: state.index })
    return result.ok ? withSource(state, result.project, result.analysis, result.index) : { ...state, mutationError: result.code }
  }
  return state
}

// Expose les éditions de document ; sélection et navigation restent dans les composants UI.
export default function useCanvasDocument() {
  const [document, dispatch] = useReducer(reduceDocument, undefined, initialDocument)

  // Produit l'identifiant une seule fois dans le handler, jamais dans un rendu ou un reducer.
  function createCard(type, position) {
    const definition = moduleTypes[type]
    if (!definition) return
    dispatch({ type: 'createCard', card: { id: crypto.randomUUID(), type, name: definition.label, ...(definition.hasText ? { text: '' } : {}), ...position, width: definition.width, height: definition.height } })
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

  return { ...document, createCard, updateGeometry, renameCard, updateComment, insertNode, configureNode, deleteNode, deleteModule }
}

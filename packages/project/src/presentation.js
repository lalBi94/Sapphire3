import { moduleTypes } from '../../../src/utils/moduleTypes.js'

// Retourne le type de carte attendu pour un module source.
export function cardTypeForModule(module) {
  return module?.kind === 'class' ? 'class' : 'module'
}

// Calcule une position de carte par défaut sur une grille lisible.
export function defaultCardPosition(index) {
  return { x: (index % 3) * 380, y: Math.floor(index / 3) * 280 }
}

// Construit une carte Module ou Class cohérente avec sa source.
export function createModuleCard(module, options = {}, position = 0) {
  const type = cardTypeForModule(module)
  const definition = moduleTypes[type]
  const fallback = defaultCardPosition(position)
  return {
    id: module.id,
    type,
    name: module.name,
    x: options.x === undefined ? fallback.x : options.x,
    y: options.y === undefined ? fallback.y : options.y,
    width: options.width === undefined ? definition.width : options.width,
    height: options.height === undefined ? definition.height : options.height,
    expandedNodeIds: [],
    ...(options.emoji ? { emoji: options.emoji } : {}),
    ...(options.hidden === true ? { hidden: true } : {}),
    ...(options.locked === true ? { locked: true } : {}),
  }
}

// Construit une carte Comment hors source logique.
export function createCommentCard(options = {}, position = 0) {
  const definition = moduleTypes.comment
  const fallback = defaultCardPosition(position)
  return {
    id: options.id,
    type: 'comment',
    name: options.name ?? 'Comment',
    text: options.text ?? '',
    x: options.x === undefined ? fallback.x : options.x,
    y: options.y === undefined ? fallback.y : options.y,
    width: options.width === undefined ? definition.width : options.width,
    height: options.height === undefined ? definition.height : options.height,
    expandedNodeIds: [],
    ...(options.emoji ? { emoji: options.emoji } : {}),
    ...(options.hidden === true ? { hidden: true } : {}),
    ...(options.locked === true ? { locked: true } : {}),
  }
}

// Construit une carte Image avec une Data URL ou une référence `images/`.
export function createImageCard(options = {}, position = 0) {
  const definition = moduleTypes.image
  const fallback = defaultCardPosition(position)
  const imageRef = typeof options.imageRef === 'string' && options.imageRef.length > 0 ? options.imageRef : null
  return {
    id: options.id,
    type: 'image',
    name: options.name ?? 'Image',
    caption: options.caption ?? '',
    ...(imageRef ? { imageRef } : { image: options.image ?? '' }),
    x: options.x === undefined ? fallback.x : options.x,
    y: options.y === undefined ? fallback.y : options.y,
    width: options.width === undefined ? definition.width : options.width,
    height: options.height === undefined ? definition.height : options.height,
    expandedNodeIds: [],
    ...(options.emoji ? { emoji: options.emoji } : {}),
    ...(options.hidden === true ? { hidden: true } : {}),
    ...(options.locked === true ? { locked: true } : {}),
  }
}

// Liste les identifiants d'un sous-arbre source, sans suivre deux fois un enfant.
export function collectSubtreeNodeIds(project, nodeId) {
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const result = new Set()
  const pending = [nodeId]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || result.has(id)) continue
    const node = nodes.get(id)
    if (!node) continue
    result.add(id)
    for (const value of Object.values(node.children ?? {})) {
      if (Array.isArray(value)) pending.push(...value)
      else pending.push(value)
    }
  }
  return result
}

// Liste tous les nœuds appartenant à un module.
export function collectModuleNodeIds(project, moduleId) {
  return new Set(project.nodes.filter((node) => node.moduleId === moduleId).map((node) => node.id))
}

// Retire des identifiants supprimés des états de pliage de toutes les cartes.
export function removeExpandedNodeIds(cards, removedIds) {
  return cards.map((card) => {
    const expandedNodeIds = (card.expandedNodeIds ?? []).filter((id) => !removedIds.has(id))
    return expandedNodeIds.length === (card.expandedNodeIds ?? []).length ? card : { ...card, expandedNodeIds }
  })
}

// Nettoie la sélection si elle pointe vers un objet supprimé.
export function cleanSelection(selected, { moduleIds = new Set(), nodeIds = new Set() } = {}) {
  if (!selected) return selected ?? null
  if (selected.kind === 'module' && moduleIds.has(selected.id)) return null
  if (selected.kind === 'node' && nodeIds.has(selected.id)) return null
  return selected
}

// Retrouve une déclaration par nom dans un module.
export function findNodeByName(project, moduleId, name) {
  if (typeof name !== 'string' || name.length === 0) return null
  return project.nodes.find((node) => node.moduleId === moduleId && node.properties?.name === name) ?? null
}

// Indique si un type de carte porte un module ou une classe.
export function isModuleCardType(type) {
  return type === 'module' || type === 'class'
}

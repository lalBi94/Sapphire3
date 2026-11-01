import { isId, isRecord, sourceFormatVersion, moduleKinds, createProject } from './logic/model.js'
import { serializeSource } from './logic/serialization.js'
import { moduleTypes, minimumModuleSize } from './moduleTypes.js'
import { isEmbeddedImage } from './embeddedImage.js'

export const workspaceFileVersion = 1

// Conserve le message technique pour les tests et expose un code stable à l'interface traduite.
function workspaceError(message, code = 'WORKSPACE_INVALID') {
  return Object.assign(new Error(message), { code })
}

// Ne laisse entrer que des identifiants ou des trous dans les relations syntaxiques affichées.
function validNodeLink(value) {
  return value === null || isId(value)
}

// Refuse les structures que l'interface ne peut pas restaurer, sans exiger un programme sémantiquement complet.
function validateProject(project) {
  if (!isRecord(project) || project.formatVersion !== sourceFormatVersion || !isId(project.id) || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw workspaceError('Invalid or unsupported logical project format.')
  }
  const moduleIds = new Set()
  for (const module of project.modules) {
    if (!isRecord(module) || !isId(module.id) || moduleIds.has(module.id) || module.kind !== moduleKinds.module || !isId(module.name) || !['rootNodeIds', 'imports', 'exports'].every((field) => Array.isArray(module[field]))) {
      throw workspaceError('Invalid module data. Legacy Main modules are not supported.')
    }
    moduleIds.add(module.id)
    if (!module.rootNodeIds.every(validNodeLink)) throw workspaceError('Invalid module root identifiers.')
  }
  const nodeIds = new Set()
  for (const node of project.nodes) {
    if (!isRecord(node) || !isId(node.id) || nodeIds.has(node.id) || !moduleIds.has(node.moduleId) || !isId(node.kind) || !['properties', 'children', 'references'].every((field) => isRecord(node[field]))) {
      throw workspaceError('Invalid node data or duplicate node identifiers.')
    }
    nodeIds.add(node.id)
    if (node.properties.name !== undefined && typeof node.properties.name !== 'string') throw workspaceError('Invalid declaration name.')
    if (node.properties.operator !== undefined && typeof node.properties.operator !== 'string') throw workspaceError('Invalid operator data.')
    if (node.properties.type?.name !== undefined && typeof node.properties.type.name !== 'string') throw workspaceError('Invalid type name.')
    if (node.properties.value !== null && typeof node.properties.value === 'object') throw workspaceError('Invalid literal value.')
    if (!Object.values(node.children).every((value) => Array.isArray(value) ? value.every(validNodeLink) : validNodeLink(value))) throw workspaceError('Invalid child identifiers.')
  }
}

// Contrôle la géométrie et les liens de présentation avant tout remplacement du document courant.
function validatePresentation(project, presentation) {
  if (!isRecord(presentation) || !Array.isArray(presentation.cards)) throw workspaceError('Invalid workspace presentation.')
  const camera = presentation.camera
  if (!isRecord(camera) || !['x', 'y', 'zoomLevel'].every((key) => Number.isFinite(camera[key])) || camera.zoomLevel > 2 || !Number.isFinite(2 ** camera.zoomLevel) || 2 ** camera.zoomLevel === 0) {
    throw workspaceError('Invalid canvas position or zoom.')
  }
  const modules = new Map(project.modules.map((module) => [module.id, module]))
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const ids = new Set()
  for (const card of presentation.cards) {
    if (!isRecord(card) || !isId(card.id) || ids.has(card.id) || !Object.hasOwn(moduleTypes, card.type) || typeof card.name !== 'string' || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(card[key])) || card.width < minimumModuleSize.width || card.height < minimumModuleSize.height) {
      throw workspaceError('Invalid card data or geometry.')
    }
    if (card.type === 'module'
      ? !modules.has(card.id) || modules.get(card.id).name !== card.name
      : modules.has(card.id) || (card.type === 'comment' && typeof card.text !== 'string') || (card.type === 'image' && (!isEmbeddedImage(card.image) || typeof card.caption !== 'string'))) {
      throw workspaceError('Cards do not match the logical project.')
    }
    if (!Array.isArray(card.expandedNodeIds) || new Set(card.expandedNodeIds).size !== card.expandedNodeIds.length || card.expandedNodeIds.some((id) => !isId(id) || nodes.get(id)?.moduleId !== card.id || card.type !== 'module')) {
      throw workspaceError('Invalid expanded node data.')
    }
    if (card.hidden !== undefined && typeof card.hidden !== 'boolean') throw workspaceError('Invalid card visibility.')
    if (card.locked !== undefined && typeof card.locked !== 'boolean') throw workspaceError('Invalid card lock.')
    ids.add(card.id)
  }
  if (project.modules.some((module) => !ids.has(module.id))) throw workspaceError('A module is missing its visual card.')
  const selected = presentation.selected
  if (selected !== null && (!isRecord(selected) || (selected.kind === 'module' ? !modules.has(selected.id) : selected.kind !== 'node' || !nodes.has(selected.id)))) {
    throw workspaceError('Invalid workspace selection.')
  }
}

// N'écrit les drapeaux de carte masquée ou verrouillée que lorsqu'ils sont vrais, pour garder les fichiers habituels inchangés.
function exportableCard(card, nodes) {
  const { hidden, locked, ...rest } = card
  return { ...rest, ...(hidden ? { hidden: true } : {}), ...(locked ? { locked: true } : {}), expandedNodeIds: (card.expandedNodeIds ?? []).filter((id) => nodes.get(id)?.moduleId === card.id) }
}

// Produit le même instantané JSON versionné pour les extensions .sp3 et .json.
export function serializeWorkspace(project, cards, camera, selected = null) {
  validateProject(project)
  // Les identifiants de nœuds supprimés ne doivent pas survivre dans l'état de pliage exporté.
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const presentation = {
    cards: cards.map((card) => exportableCard(card, nodes)),
    camera, selected,
  }
  validatePresentation(project, presentation)
  const result = serializeSource({ application: 'Sapphire 3', workspaceVersion: workspaceFileVersion, project, presentation })
  if (result.json === null) throw workspaceError('The workspace contains data that cannot be exported as JSON.', 'WORKSPACE_NOT_SERIALIZABLE')
  return result.json
}

// Lit un instantané complet ou une source logique JSON v1 avec disposition initiale explicite.
export function deserializeWorkspace(text) {
  let data
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw workspaceError('The selected file is not valid JSON.', 'WORKSPACE_JSON_INVALID')
  }
  if (!isRecord(data)) throw workspaceError('The selected file must contain a workspace or logical project.')
  if (Object.hasOwn(data, 'workspaceVersion')) {
    if (data.application !== 'Sapphire 3' || data.workspaceVersion !== workspaceFileVersion) throw workspaceError('Unsupported Sapphire workspace version.', 'WORKSPACE_VERSION_UNSUPPORTED')
    validateProject(data.project)
    validatePresentation(data.project, data.presentation)
    if (serializeSource(data).json === null) throw workspaceError('The file contains unsupported JSON values.', 'WORKSPACE_NOT_SERIALIZABLE')
    return data
  }
  validateProject(data)
  const definition = moduleTypes.module
  const cards = data.modules.map((module, position) => ({ id: module.id, type: 'module', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: definition.width, height: definition.height, expandedNodeIds: [] }))
  return JSON.parse(serializeWorkspace(data, cards, { x: 0, y: 0, zoomLevel: 0 }))
}

// Produit un document vierge explicite pour repartir d'un workspace neuf, sans fichier associé.
export function emptyWorkspace() {
  return { project: createProject('workspace'), presentation: { cards: [], camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null } }
}

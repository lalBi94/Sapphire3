import { SapphireError, SDK_ERROR_CODES } from './errors.js'

// Vérifie la forme minimale d'un projet source avant toute opération publique.
export function assertProject(project) {
  if (!project || typeof project !== 'object' || project.formatVersion !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw new SapphireError(SDK_ERROR_CODES.invalidProject, 'Expected a Sapphire source project with formatVersion 1, modules and nodes.')
  }
  return project
}

// Vérifie qu'un identifiant non vide est fourni.
export function assertId(value, label = 'identifier') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SapphireError(SDK_ERROR_CODES.invalidArgument, `Expected a non-empty ${label}.`)
  }
  return value
}

// Retrouve un module par identifiant ou signale son absence.
export function requireModule(project, moduleId) {
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (!module) throw new SapphireError(SDK_ERROR_CODES.invalidArgument, `Unknown module: ${moduleId}.`)
  return module
}

// Retrouve un nœud par identifiant ou signale son absence.
export function requireNode(project, nodeId) {
  const node = project.nodes.find((entry) => entry?.id === nodeId)
  if (!node) throw new SapphireError(SDK_ERROR_CODES.invalidArgument, `Unknown node: ${nodeId}.`)
  return node
}

import { createDiagnostic } from '../../../src/utils/logic/diagnostics.js'

/**
 * Codes stables introduits par le SDK Transpiler. Les codes `TRANSPILE_*`
 * du moteur restent la référence pour les diagnostics de génération.
 */
export const TRANSPILER_ERROR_CODES = Object.freeze({
  invalidArgument: 'TRANSPILER_INVALID_ARGUMENT',
  invalidProject: 'TRANSPILER_INVALID_PROJECT',
  internal: 'TRANSPILER_INTERNAL',
})

/** Erreur d'API du SDK, distincte d'un diagnostic de compilation. */
export class TranspilerError extends Error {
  /**
   * @param {string} code Code stable du SDK.
   * @param {string} message Message lisible.
   * @param {{details?: unknown, cause?: unknown}} [options]
   */
  constructor(code, message, { details = null, cause = null } = {}) {
    super(message)
    this.name = 'TranspilerError'
    this.code = code
    this.details = details
    if (cause !== null) this.cause = cause
  }

  // Représentation sérialisable pour une CLI ou une API.
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

// Reconnaît une erreur produite par le SDK Transpiler.
export function isTranspilerError(value) {
  return value instanceof TranspilerError
}

// Vérifie la forme minimale d'un projet source avant analyse.
export function assertProject(project) {
  if (!project || typeof project !== 'object' || project.formatVersion !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.invalidProject, 'Expected a Sapphire source project with formatVersion 1, modules and nodes.')
  }
  return project
}

// Vérifie qu'un identifiant non vide est fourni.
export function assertId(value, label = 'identifier') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.invalidArgument, `Expected a non-empty ${label}.`)
  }
  return value
}

// Normalise une sélection de module ou de nœud.
export function normalizeSelection(selection) {
  if (typeof selection === 'string') return { kind: 'node', id: assertId(selection, 'node id') }
  if (!selection || typeof selection !== 'object' || !['module', 'node'].includes(selection.kind)) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.invalidArgument, 'Expected a selection { kind: "module" | "node", id }.')
  }
  return { kind: selection.kind, id: assertId(selection.id, `${selection.kind} id`) }
}

// Produit un diagnostic de cible absente, avec la localisation disponible.
export function missingTargetDiagnostic(project, kind, id) {
  return createDiagnostic('TARGET_MISSING', `${kind === 'module' ? 'Module' : 'Node'} introuvable : ${id}.`, {
    projectId: project?.id ?? null,
    moduleId: kind === 'module' ? id : null,
    nodeId: kind === 'node' ? id : null,
    field: null,
  })
}

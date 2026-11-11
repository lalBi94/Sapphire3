/**
 * Codes d'erreur stables du SDK debug. Les codes du moteur (`SIMULATION_*`,
 * `DEBUG_HISTORY_LIMIT`) restent visibles dans l'état et les exports.
 */
export const DEBUG_ERROR_CODES = Object.freeze({
  disposed: 'DEBUG_DISPOSED',
  invalidArgument: 'DEBUG_INVALID_ARGUMENT',
  invalidProject: 'DEBUG_INVALID_PROJECT',
  unknownNode: 'DEBUG_UNKNOWN_NODE',
  invalidIndex: 'DEBUG_INVALID_INDEX',
  internal: 'DEBUG_INTERNAL',
})

/** Erreur d'API du SDK, distincte d'un diagnostic ou d'un arrêt du programme. */
export class DebugError extends Error {
  /**
   * @param {string} code Code stable du SDK.
   * @param {string} message Message lisible.
   * @param {{details?: unknown, cause?: unknown}} [options]
   */
  constructor(code, message, { details = null, cause = null } = {}) {
    super(message)
    this.name = 'DebugError'
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

// Reconnaît une erreur produite par le SDK debug.
export function isDebugError(value) {
  return value instanceof DebugError
}

// Vérifie la forme minimale d'un projet source avant analyse.
export function assertProject(project) {
  if (!project || typeof project !== 'object' || project.formatVersion !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidProject, 'Expected a Sapphire source project with formatVersion 1, modules and nodes.')
  }
  return project
}

// Vérifie qu'un identifiant non vide est fourni.
export function assertId(value, label = 'identifier') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidArgument, `Expected a non-empty ${label}.`)
  }
  return value
}

// Vérifie qu'un index de frame est un entier dans les bornes disponibles.
export function assertFrameIndex(index, length) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= length) {
    throw new DebugError(DEBUG_ERROR_CODES.invalidIndex, `Expected a frame index between 0 and ${Math.max(length - 1, 0)}.`, { details: { index, frameCount: length } })
  }
  return index
}

/**
 * Codes d'erreur stables du runtime. Les codes du moteur logique
 * (`SIMULATION_*`, `TRANSPILE_*`, etc.) sont conservés lorsqu'ils existent.
 */
export const RUNTIME_ERROR_CODES = Object.freeze({
  disposed: 'RUNTIME_DISPOSED',
  busy: 'RUNTIME_BUSY',
  invalidArgument: 'RUNTIME_INVALID_ARGUMENT',
  invalidProject: 'RUNTIME_INVALID_PROJECT',
  invalidBudget: 'RUNTIME_BUDGET_INVALID',
  functionNotFound: 'RUNTIME_FUNCTION_NOT_FOUND',
  functionAmbiguous: 'RUNTIME_FUNCTION_AMBIGUOUS',
  functionUnsupported: 'RUNTIME_FUNCTION_UNSUPPORTED',
  notLive: 'RUNTIME_NOT_LIVE',
  liveActive: 'RUNTIME_LIVE_ACTIVE',
  cancelled: 'RUNTIME_CANCELLED',
  workerUnavailable: 'RUNTIME_WORKER_UNAVAILABLE',
  workerFailed: 'RUNTIME_WORKER_FAILED',
  workspaceInvalid: 'RUNTIME_WORKSPACE_INVALID',
  executionFailed: 'RUNTIME_EXECUTION_FAILED',
})

/**
 * Erreur typée du runtime. Elle porte un code stable, les diagnostics du
 * moteur et des détails sérialisables pour une CLI, un worker ou une API.
 */
export class RuntimeError extends Error {
  /**
   * @param {string} code Code stable du runtime ou du moteur.
   * @param {string} message Message lisible.
   * @param {{diagnostics?: Array<object>, details?: unknown, cause?: unknown}} [options]
   */
  constructor(code, message, { diagnostics = [], details = null, cause = null } = {}) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics : []
    this.details = details
    if (cause !== null) this.cause = cause
  }

  // Représentation sérialisable pour une frontière de worker ou une API.
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      diagnostics: this.diagnostics,
      details: this.details,
    }
  }
}

// Reconnaît une erreur produite par le runtime.
export function isRuntimeError(value) {
  return value instanceof RuntimeError
}

// Convertit une erreur quelconque en RuntimeError stable.
export function toRuntimeError(error, fallbackCode = RUNTIME_ERROR_CODES.executionFailed) {
  if (error instanceof RuntimeError) return error
  return new RuntimeError(error?.code ?? fallbackCode, error?.message ?? 'Runtime execution failed.', { cause: error })
}

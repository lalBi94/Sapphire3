/**
 * Codes stables du SDK graph. Les codes du moteur (`TARGET_*`, diagnostics
 * sémantiques) restent visibles dans les métadonnées des graphes.
 */
export const GRAPH_ERROR_CODES = Object.freeze({
  invalidArgument: 'GRAPH_INVALID_ARGUMENT',
  invalidProject: 'GRAPH_INVALID_PROJECT',
  invalidGraph: 'GRAPH_INVALID_GRAPH',
  targetRequired: 'GRAPH_TARGET_REQUIRED',
  targetNotFound: 'GRAPH_TARGET_NOT_FOUND',
  targetAmbiguous: 'GRAPH_TARGET_AMBIGUOUS',
  nodeNotFound: 'GRAPH_NODE_NOT_FOUND',
  unsupportedFormat: 'GRAPH_UNSUPPORTED_FORMAT',
  internal: 'GRAPH_INTERNAL',
})

/** Erreur d'API du SDK graph, distincte d'un diagnostic sémantique. */
export class GraphError extends Error {
  /**
   * @param {string} code Code stable.
   * @param {string} message Message lisible.
   * @param {{diagnostics?: Array<object>, details?: unknown, cause?: unknown}} [options]
   */
  constructor(code, message, { diagnostics = [], details = null, cause = null } = {}) {
    super(message)
    this.name = 'GraphError'
    this.code = code
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics : []
    this.details = details
    if (cause !== null) this.cause = cause
  }

  // Représentation sérialisable pour une CLI, un agent ou une API.
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

// Reconnaît une erreur produite par le SDK graph.
export function isGraphError(value) {
  return value instanceof GraphError
}

// Convertit une erreur quelconque en GraphError stable.
export function toGraphError(error, fallbackCode = GRAPH_ERROR_CODES.internal) {
  if (error instanceof GraphError) return error
  return new GraphError(error?.code ?? fallbackCode, error?.message ?? 'Sapphire graph operation failed.', {
    diagnostics: error?.diagnostics ?? [],
    details: error?.details ?? null,
    cause: error,
  })
}

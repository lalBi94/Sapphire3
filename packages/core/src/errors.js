/**
 * Codes d'erreur stables introduits par le SDK. Les diagnostics du moteur
 * conservent leurs propres codes dans `diagnosticCodes`.
 */
export const SDK_ERROR_CODES = Object.freeze({
  invalidArgument: 'SDK_INVALID_ARGUMENT',
  invalidProject: 'SDK_INVALID_PROJECT',
  operationFailed: 'SDK_OPERATION_FAILED',
  programInvalid: 'SDK_PROGRAM_INVALID',
  serializationInvalid: 'SERIALIZATION_INVALID',
})

/**
 * Erreur levée par les helpers `assertResult` et `assertValid`. Les mutations
 * retournent des résultats inspectables pour éviter une exception obligatoire.
 */
export class SapphireError extends Error {
  /**
   * @param {string} code Code stable du moteur ou du SDK.
   * @param {string} message Message lisible.
   * @param {{diagnostics?: Array<object>, details?: unknown, cause?: unknown}} [options]
   */
  constructor(code, message, { diagnostics = [], details = null, cause = null } = {}) {
    super(message)
    this.name = 'SapphireError'
    this.code = code
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics : []
    this.details = details
    if (cause !== null) this.cause = cause
  }

  // Représentation sérialisable pour une CLI ou une frontière HTTP.
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

// Reconnaît une erreur produite par le SDK.
export function isSapphireError(value) {
  return value instanceof SapphireError
}

// Lève une SapphireError lorsqu'un résultat de mutation n'a pas réussi.
export function assertResult(result, message = 'Sapphire operation failed.') {
  if (result?.ok) return result
  throw new SapphireError(result?.code ?? SDK_ERROR_CODES.operationFailed, message, {
    diagnostics: result?.diagnostics ?? [],
    details: result,
  })
}

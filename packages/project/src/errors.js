/**
 * Codes stables introduits par le SDK project. Les codes existants du format
 * (`WORKSPACE_*`) et du Core SDK sont conservés lorsqu'ils existent.
 */
export const PROJECT_ERROR_CODES = Object.freeze({
  invalidArgument: 'PROJECT_INVALID_ARGUMENT',
  invalidWorkspace: 'PROJECT_WORKSPACE_INVALID',
  invalidProject: 'PROJECT_INVALID_PROJECT',
  moduleNotFound: 'PROJECT_MODULE_NOT_FOUND',
  nodeNotFound: 'PROJECT_NODE_NOT_FOUND',
  cardNotFound: 'PROJECT_CARD_NOT_FOUND',
  duplicateId: 'PROJECT_DUPLICATE_ID',
  mutationFailed: 'PROJECT_MUTATION_FAILED',
  semanticInvalid: 'PROJECT_PROGRAM_INVALID',
  serializationInvalid: 'PROJECT_SERIALIZATION_INVALID',
  imageMissing: 'PROJECT_IMAGE_MISSING',
  imageInvalid: 'PROJECT_IMAGE_INVALID',
  archiveInvalid: 'PROJECT_ARCHIVE_INVALID',
  archiveUnsafeEntry: 'PROJECT_ARCHIVE_UNSAFE_ENTRY',
  storageMissing: 'PROJECT_STORAGE_MISSING',
  storageUnavailable: 'PROJECT_STORAGE_UNAVAILABLE',
  unsupportedInput: 'PROJECT_UNSUPPORTED_INPUT',
})

/** Erreur d'API ou de format du SDK project. */
export class ProjectError extends Error {
  /**
   * @param {string} code Code stable.
   * @param {string} message Message lisible.
   * @param {{diagnostics?: Array<object>, details?: unknown, object?: {kind: string, id: string|null}, cause?: unknown}} [options]
   */
  constructor(code, message, { diagnostics = [], details = null, object = null, cause = null } = {}) {
    super(message)
    this.name = 'ProjectError'
    this.code = code
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics : []
    this.details = details
    this.object = object
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
      object: this.object,
    }
  }
}

// Reconnaît une erreur produite par le SDK project.
export function isProjectError(value) {
  return value instanceof ProjectError
}

// Convertit une erreur de format ou de mutation en ProjectError stable.
export function toProjectError(error, fallbackCode = PROJECT_ERROR_CODES.mutationFailed, options = {}) {
  if (error instanceof ProjectError) return error
  return new ProjectError(error?.code ?? fallbackCode, error?.message ?? 'Sapphire project operation failed.', {
    diagnostics: error?.diagnostics ?? [],
    details: error?.details ?? null,
    object: options.object ?? null,
    cause: error,
  })
}

// Lève une ProjectError lorsqu'un résultat de mutation a échoué.
export function assertWorkspaceResult(result, message = 'Sapphire workspace operation failed.') {
  if (result?.ok) return result
  throw new ProjectError(result?.code ?? PROJECT_ERROR_CODES.mutationFailed, message, {
    diagnostics: result?.diagnostics ?? [],
    details: result,
    object: result?.object ?? null,
  })
}

// Produit un diagnostic structuré, associé à un objet quand il est connu.
export function projectDiagnostic(code, message, { severity = 'error', object = null, details = null, ...rest } = {}) {
  return {
    code,
    severity,
    message,
    ...(object ? { object } : {}),
    ...(details === null ? {} : { details }),
    ...rest,
  }
}

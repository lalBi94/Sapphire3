export const PLUGIN_DIAGNOSTIC_CODES = Object.freeze({
  invalidDocument: 'PLUGIN_INVALID_DOCUMENT',
  invalidField: 'PLUGIN_INVALID_FIELD',
  unsupportedFormat: 'PLUGIN_FORMAT_UNSUPPORTED',
  unsupportedApi: 'PLUGIN_API_UNSUPPORTED',
  unsupportedPermission: 'PLUGIN_PERMISSION_UNSUPPORTED',
  missingPermission: 'PLUGIN_PERMISSION_MISSING',
  duplicateId: 'PLUGIN_DUPLICATE_ID',
  duplicateOperation: 'PLUGIN_DUPLICATE_OPERATION',
  duplicateComposite: 'PLUGIN_DUPLICATE_COMPOSITE',
  dependencyInvalid: 'PLUGIN_DEPENDENCY_INVALID',
  dependencyMissing: 'PLUGIN_DEPENDENCY_MISSING',
  dependencyVersion: 'PLUGIN_DEPENDENCY_VERSION',
  dependencyCycle: 'PLUGIN_DEPENDENCY_CYCLE',
  incompatibleHost: 'PLUGIN_HOST_INCOMPATIBLE',
  rendererInvalid: 'PLUGIN_RENDERER_INVALID',
  expressionInvalid: 'PLUGIN_EXPRESSION_INVALID',
  compositeInvalid: 'PLUGIN_COMPOSITE_INVALID',
  operationMissing: 'PLUGIN_OPERATION_MISSING',
})

// Crée un diagnostic stable, sérialisable et localisé par code.
export function createPluginDiagnostic(code, message, path = null) {
  return { code, severity: 'error', message, path }
}

// Transforme une liste de diagnostics en résultat d'API sans lever d'exception.
export function pluginFailure(code, message, diagnostics = []) {
  return {
    ok: false,
    code,
    message,
    diagnostics: diagnostics.length ? diagnostics : [createPluginDiagnostic(code, message)],
  }
}

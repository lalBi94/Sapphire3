export const diagnosticCodes = Object.freeze({
  invalidSource: 'SOURCE_INVALID',
  unsupportedVersion: 'FORMAT_VERSION_UNSUPPORTED',
  invalidId: 'ID_INVALID',
  duplicateId: 'ID_DUPLICATE',
  invalidModule: 'MODULE_INVALID',
  duplicateEntryPoint: 'ENTRY_POINT_DUPLICATE',
  invalidEntryPoint: 'ENTRY_POINT_INVALID',
  missingNode: 'NODE_NOT_FOUND',
  invalidStructure: 'STRUCTURE_INVALID',
  incomplete: 'NODE_INCOMPLETE',
  unknownKind: 'NODE_KIND_UNKNOWN',
  cycle: 'SYNTAX_CYCLE',
  multipleParents: 'SYNTAX_MULTIPLE_PARENTS',
  detached: 'NODE_DETACHED',
  unresolved: 'REFERENCE_UNRESOLVED',
  conflict: 'DECLARATION_CONFLICT',
  invalidImport: 'IMPORT_INVALID',
  invalidExport: 'EXPORT_INVALID',
  typeMismatch: 'TYPE_MISMATCH',
  typeRequired: 'TYPE_REQUIRED',
  invalidType: 'TYPE_INVALID',
  untypedExpression: 'EXPRESSION_UNTYPED',
  voidNotAllowed: 'VOID_NOT_ALLOWED',
  typeCycle: 'TYPE_CYCLE',
  constantCycle: 'CONSTANT_CYCLE',
  invalidLiteral: 'LITERAL_INVALID',
  overflow: 'NUMERIC_OVERFLOW',
  underflow: 'NUMERIC_UNDERFLOW',
  divisionByZero: 'DIVISION_BY_ZERO',
  missingReturn: 'RETURN_MISSING',
  illegalPlacement: 'PLACEMENT_ILLEGAL',
  invalidJson: 'JSON_INVALID',
  depthExceeded: 'DEPTH_EXCEEDED',
})

/** @typedef {{projectId: string|null, moduleId: string|null, nodeId: string|null, field: string|null}} Location */
/** @typedef {{code: string, severity: 'error'|'warning'|'info', message: string, location: Location}} Diagnostic */

// Produit des diagnostics homogènes et sérialisables, même pour une source incomplète.
export function createDiagnostic(code, message, location = {}, severity = 'error') {
  const normalized = { projectId: null, moduleId: null, nodeId: null, field: null, ...location }
  for (const key of Object.keys(normalized)) {
    if (typeof normalized[key] !== 'string') normalized[key] = null
  }
  return {
    code,
    severity,
    message,
    location: normalized,
  }
}

// Sépare le droit de produire du code du droit d'inspecter un programme invalide.
export function hasBlockingDiagnostics(diagnostics) {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

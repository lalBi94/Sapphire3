import { createDiagnostic, diagnosticCodes as codes } from './diagnostics.js'
import { isRecord, sourceFormatVersion } from './model.js'

// Vérifie que JSON ne perdra ni valeurs non représentables, ni cycles, ni champs cachés.
function checkJson(value, active = new Set(), depth = 0) {
  if (depth > 200) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0)
  if (!Array.isArray(value) && !isRecord(value)) return false
  if (active.has(value) || Object.getOwnPropertySymbols(value).length > 0) return false
  if (Object.values(Object.getOwnPropertyDescriptors(value)).some((descriptor) => !('value' in descriptor))) return false
  if (!Array.isArray(value) && Object.getOwnPropertyNames(value).length !== Object.keys(value).length) return false
  if (Array.isArray(value) && (Object.getOwnPropertyNames(value).length !== value.length + 1 || Object.keys(value).length !== value.length || Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).includes(false))) return false
  active.add(value)
  const valid = Object.values(value).every((child) => checkJson(child, active, depth + 1))
  active.delete(value)
  return valid
}

// Sérialise les données source telles quelles, y compris leurs erreurs éditoriales.
export function serializeSource(source) {
  if (!isRecord(source) || !checkJson(source)) {
    return { json: null, diagnostics: [createDiagnostic(codes.invalidJson, 'Données non conservables en JSON standard : valeur non finie, -0 numérique (utiliser le texte "-0"), cycle ou champ non représentable.')] }
  }
  return { json: JSON.stringify(source, null, 2), diagnostics: [] }
}

// Préserve un document de version inconnue sans tenter de le migrer implicitement.
export function deserializeSource(json) {
  let source
  try {
    if (typeof json !== 'string') throw new Error('not-text')
    source = JSON.parse(json)
  } catch {
    return { source: null, diagnostics: [createDiagnostic(codes.invalidJson, 'Document JSON illisible.')] }
  }
  if (!isRecord(source)) return { source, diagnostics: [createDiagnostic(codes.invalidSource, 'Le document racine doit être un objet.')] }
  const diagnostics = source.formatVersion === sourceFormatVersion ? [] : [createDiagnostic(codes.unsupportedVersion, 'Version inconnue : document conservé sans migration.', { field: 'formatVersion' })]
  return { source, diagnostics }
}

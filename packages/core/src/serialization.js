import {
  analyzeProgram as analyzeEngine,
  deserializeSource,
  serializeSource,
} from '../../../src/utils/logic/index.js'
import { toPublicAnalysis } from './analysis.js'
import { SDK_ERROR_CODES } from './errors.js'
import { assertProject } from './validation.js'

// Écrit le modèle source versionné en JSON standard, sans perte silencieuse.
export function serializeProject(project) {
  assertProject(project)
  const result = serializeSource(project)
  return {
    ok: result.json !== null,
    code: result.json === null ? SDK_ERROR_CODES.serializationInvalid : null,
    json: result.json,
    diagnostics: result.diagnostics,
  }
}

// Lit un modèle source versionné et l'analyse sans exiger un programme valide.
export function deserializeProject(json) {
  const parsed = deserializeSource(json)
  if (parsed.source === null) {
    return {
      ok: false,
      code: SDK_ERROR_CODES.serializationInvalid,
      project: null,
      analysis: null,
      diagnostics: parsed.diagnostics,
    }
  }
  const analysis = toPublicAnalysis(analyzeEngine(parsed.source))
  return {
    ok: parsed.diagnostics.length === 0,
    code: parsed.diagnostics[0]?.code ?? null,
    project: parsed.source,
    analysis,
    diagnostics: [...parsed.diagnostics, ...analysis.diagnostics],
  }
}

// Alias court pour les outils qui parlent de JSON plutôt que de projet.
export const toJSON = serializeProject
export const fromJSON = deserializeProject

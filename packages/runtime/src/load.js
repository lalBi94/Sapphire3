import { analyzeProgram, deserializeSource } from '../../../src/utils/logic/index.js'
import { deserializeWorkspace } from '../../../src/utils/workspaceFile.js'
import { toRuntimeAnalysis } from './analysis.js'
import { RuntimeError, RUNTIME_ERROR_CODES } from './errors.js'

// Décode une entrée texte, binaire ou déjà chargée.
function decodeText(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (input instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(input))
  return null
}

// Reconnaît l'enveloppe workspace versionnée.
function isWorkspace(data) {
  return Boolean(data && typeof data === 'object' && !Array.isArray(data) &&
    (Object.hasOwn(data, 'workspaceVersion') || (data.application === 'Sapphire 3' && data.project)))
}

// Analyse un projet et expose un résultat public minimal.
function analyzeLoaded(project, formatDiagnostics = []) {
  const analysis = analyzeProgram(project)
  return {
    project,
    analysis,
    diagnostics: [...formatDiagnostics, ...analysis.diagnostics],
    canGenerate: analysis.canGenerate,
  }
}

// Charge un projet depuis un texte JSON de projet ou de workspace.
export function loadProjectText(text) {
  let data
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The runtime input is not valid JSON.')
  }
  if (isWorkspace(data)) {
    try {
      const workspace = deserializeWorkspace(text)
      return analyzeLoaded(workspace.project)
    } catch (error) {
      throw new RuntimeError(error?.code ?? RUNTIME_ERROR_CODES.workspaceInvalid, error?.message ?? 'Invalid Sapphire workspace.', { cause: error })
    }
  }
  const parsed = deserializeSource(text)
  if (!parsed.source) {
    throw new RuntimeError(parsed.diagnostics?.[0]?.code ?? RUNTIME_ERROR_CODES.invalidProject, 'The runtime input is not a Sapphire logical project.', { diagnostics: parsed.diagnostics })
  }
  const project = parsed.source
  if (project.formatVersion !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'Expected a logical project with formatVersion 1, modules and nodes.', { diagnostics: parsed.diagnostics })
  }
  return analyzeLoaded(project, parsed.diagnostics)
}

// Sérialise un objet d'entrée en JSON avec une erreur runtime stable.
function stringifyInput(input) {
  try {
    return JSON.stringify(input)
  } catch {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The project cannot be serialized as JSON.')
  }
}

// Charge un projet de façon synchrone depuis une chaîne, un objet ou des octets.
export function loadProjectSync(input) {
  if (input && typeof input === 'object' && !(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
    if (input.project) return loadProjectText(stringifyInput(input))
    if (input.formatVersion !== undefined || Array.isArray(input.modules) || Array.isArray(input.nodes)) return loadProjectText(stringifyInput(input))
  }
  const text = decodeText(input)
  if (text === null) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidArgument, 'Expected a project object, a workspace object, a JSON string or UTF-8 bytes. Use await loadProject() for Blob and Response inputs.')
  }
  return loadProjectText(text)
}

// Charge un projet de façon asynchrone, y compris depuis un Blob ou une Response.
export async function loadProject(input) {
  let loaded
  if (input && typeof input === 'object' && typeof input.text === 'function') {
    let text
    try {
      text = await input.text()
    } catch (error) {
      throw new RuntimeError(RUNTIME_ERROR_CODES.invalidProject, 'The runtime input could not be read.', { cause: error })
    }
    loaded = loadProjectText(text)
  } else {
    loaded = loadProjectSync(input)
  }
  return { ...loaded, analysis: toRuntimeAnalysis(loaded.analysis) }
}

// Alias explicite pour extraire un projet d'un workspace `.sp3`.
export const loadWorkspace = loadProject

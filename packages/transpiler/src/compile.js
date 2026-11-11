import { transpileProgram, transpileSelection } from '../../../src/utils/transpilation/index.js'
import { assertId, assertProject, missingTargetDiagnostic, normalizeSelection, TranspilerError, TRANSPILER_ERROR_CODES } from './errors.js'
import { buildProgramMetadata, buildSelectionMetadata, normalizeDiagnostics } from './metadata.js'
import { getTargetCapabilities } from './targets.js'

// Valide et normalise la cible demandée.
function normalizeTarget(options) {
  const target = options?.target ?? 'javascript'
  if (typeof target !== 'string' || target.trim().length === 0) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.invalidArgument, 'Expected a non-empty target identifier.')
  }
  return target
}

// Prépare un résultat de compilation homogène.
function resultOf({ ok, target, kind, standalone, code, diagnostics, metadata }) {
  return {
    ok: Boolean(ok),
    target,
    kind,
    standalone,
    code: code ?? '',
    diagnostics: normalizeDiagnostics(diagnostics),
    metadata: metadata ?? null,
  }
}

// Transpile un programme complet vers une cible installée.
export function compile(project, options = {}) {
  assertProject(project)
  const target = normalizeTarget(options)
  const descriptor = getTargetCapabilities(target)
  let result
  try {
    result = transpileProgram(project, { ...options, target })
  } catch (error) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.internal, 'Transpilation failed internally.', { cause: error })
  }
  return resultOf({
    ok: result.ok,
    target,
    kind: 'program',
    standalone: true,
    code: result.ok ? result.code : '',
    diagnostics: result.diagnostics,
    metadata: result.ok ? buildProgramMetadata(result, descriptor, target) : null,
  })
}

// Transpile un module entier en extrait de prévisualisation.
export function compileModule(project, moduleId, options = {}) {
  assertProject(project)
  assertId(moduleId, 'module id')
  const target = normalizeTarget(options)
  if (!project.modules.some((module) => module.id === moduleId)) {
    return resultOf({
      ok: false,
      target,
      kind: 'module',
      standalone: false,
      code: '',
      diagnostics: [missingTargetDiagnostic(project, 'module', moduleId)],
      metadata: null,
    })
  }
  const selection = { kind: 'module', id: moduleId }
  const descriptor = getTargetCapabilities(target)
  let result
  try {
    result = transpileSelection(project, selection, { ...options, target })
  } catch (error) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.internal, 'Module transpilation failed internally.', { cause: error })
  }
  return resultOf({
    ok: result.ok,
    target,
    kind: 'module',
    standalone: false,
    code: result.ok ? result.code : '',
    diagnostics: result.diagnostics,
    metadata: result.ok ? buildSelectionMetadata(project, selection, result, descriptor, target) : null,
  })
}

// Transpile un nœud ou un module sélectionné en extrait de prévisualisation.
export function compileSelection(project, selection, options = {}) {
  assertProject(project)
  const normalized = normalizeSelection(selection)
  if (normalized.kind === 'module') return compileModule(project, normalized.id, options)
  const target = normalizeTarget(options)
  if (!project.nodes.some((node) => node.id === normalized.id)) {
    return resultOf({
      ok: false,
      target,
      kind: 'selection',
      standalone: false,
      code: '',
      diagnostics: [missingTargetDiagnostic(project, 'node', normalized.id)],
      metadata: null,
    })
  }
  const descriptor = getTargetCapabilities(target)
  let result
  try {
    result = transpileSelection(project, normalized, { ...options, target })
  } catch (error) {
    throw new TranspilerError(TRANSPILER_ERROR_CODES.internal, 'Selection transpilation failed internally.', { cause: error })
  }
  return resultOf({
    ok: result.ok,
    target,
    kind: 'selection',
    standalone: false,
    code: result.ok ? result.code : '',
    diagnostics: result.diagnostics,
    metadata: result.ok ? buildSelectionMetadata(project, normalized, result, descriptor, target) : null,
  })
}

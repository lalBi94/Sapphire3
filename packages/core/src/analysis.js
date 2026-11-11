import {
  analyzeProgram as analyzeEngine,
  buildLogicalAst,
  diagnosticCodes,
  findAstNode,
  hasBlockingDiagnostics,
} from '../../../src/utils/logic/index.js'
import { SapphireError, SDK_ERROR_CODES } from './errors.js'
import { assertProject } from './validation.js'

export { diagnosticCodes, findAstNode, hasBlockingDiagnostics }

// Convertit le résultat interne en objet public sérialisable, sans Maps instables.
export function toPublicAnalysis(analysis) {
  const semantic = analysis.semantic ?? {}
  const nodeTypes = new Map((semantic.nodeTypes ?? []).map((entry) => [entry.nodeId, entry.type]))
  const nodes = semantic.index?.nodes ?? new Map()
  const classMembers = [...(semantic.index?.classMembers ?? new Map())].map(([classId, members]) => {
    const describe = ([name, nodeId]) => {
      const node = nodes.get(nodeId)
      return {
        name,
        nodeId,
        kind: node?.kind ?? null,
        type: nodeTypes.get(nodeId) ?? null,
        visibility: members.public.has(name) ? 'public' : 'private',
        constructor: node?.properties?.constructor === true,
      }
    }
    return {
      classId,
      public: [...members.public.entries()].map(describe),
      private: [...members.private.entries()].map(describe),
      constructor: members.constructor ?? null,
      constructorVisibility: members.constructorVisibility ?? null,
    }
  })
  return {
    ok: !hasBlockingDiagnostics(analysis.diagnostics ?? []),
    canGenerate: Boolean(analysis.canGenerate),
    diagnostics: analysis.diagnostics ?? [],
    ast: analysis.ast,
    scopes: semantic.scopes ?? [],
    symbols: semantic.symbols ?? [],
    references: semantic.references ?? [],
    nodeTypes: semantic.nodeTypes ?? [],
    genericCalls: semantic.genericCalls ?? [],
    untypedNodeIds: semantic.untypedNodeIds ?? [],
    classes: semantic.classes ?? [],
    classMembers,
  }
}

// Analyse complète : AST, portées, symboles, types, génériques, lambdas et classes.
export function analyze(project, { onProgress = null } = {}) {
  assertProject(project)
  return toPublicAnalysis(analyzeEngine(project, { onProgress }))
}

// Validation légère : seuls le droit de générer et les diagnostics sont exposés.
export function validate(project, options = {}) {
  const analysis = analyze(project, options)
  return { ok: analysis.canGenerate, canGenerate: analysis.canGenerate, diagnostics: analysis.diagnostics }
}

// Construit uniquement l'AST syntaxique et ses diagnostics.
export function buildAst(project) {
  assertProject(project)
  const built = buildLogicalAst(project)
  return { ast: built.ast, diagnostics: built.diagnostics }
}

// Lève une erreur structurée si le programme contient un diagnostic bloquant.
export function assertValid(project, message = 'Sapphire program has blocking diagnostics.') {
  const analysis = analyze(project)
  if (analysis.canGenerate) return analysis
  throw new SapphireError(SDK_ERROR_CODES.programInvalid, message, {
    diagnostics: analysis.diagnostics,
    details: { projectId: project?.id ?? null },
  })
}

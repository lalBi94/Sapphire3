import { buildLogicalAst } from './ast.js'
import { hasBlockingDiagnostics } from './diagnostics.js'
import { buildSemanticModel } from './semantics.js'
import { analyzeTypes } from './typeAnalysis.js'

// Assemble les passes pures sans bloquer l'inspection d'une source incomplète ou invalide.
export function analyzeProgram(source, { onProgress = null } = {}) {
  onProgress?.({ phase: 'analysis', step: 'syntax', current: 1, total: 3 })
  const built = buildLogicalAst(source)
  onProgress?.({ phase: 'analysis', step: 'semantics', current: 2, total: 3 })
  const semantic = buildSemanticModel(built.ast)
  onProgress?.({ phase: 'analysis', step: 'types', current: 3, total: 3 })
  const typed = analyzeTypes(semantic, built.ast.sourceId)
  const diagnostics = [...built.diagnostics, ...semantic.diagnostics, ...typed.diagnostics]
  return {
    source, ast: built.ast,
    semantic: { ...semantic.model, symbols: typed.symbols, nodeTypes: typed.nodeTypes, untypedNodeIds: typed.untypedNodeIds, genericCalls: typed.genericCalls, index: semantic.index },
    diagnostics, canGenerate: !hasBlockingDiagnostics(diagnostics),
  }
}

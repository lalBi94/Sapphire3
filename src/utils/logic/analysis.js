import { buildLogicalAst } from './ast.js'
import { hasBlockingDiagnostics } from './diagnostics.js'
import { buildSemanticModel } from './semantics.js'
import { analyzeTypes } from './typeAnalysis.js'

// Assemble les passes pures sans bloquer l'inspection d'une source incomplète ou invalide.
export function analyzeProgram(source) {
  const built = buildLogicalAst(source)
  const semantic = buildSemanticModel(built.ast)
  const typed = analyzeTypes(semantic, built.ast.sourceId)
  const diagnostics = [...built.diagnostics, ...semantic.diagnostics, ...typed.diagnostics]
  return {
    source, ast: built.ast,
    semantic: { ...semantic.model, symbols: typed.symbols, nodeTypes: typed.nodeTypes, untypedNodeIds: typed.untypedNodeIds },
    diagnostics, canGenerate: !hasBlockingDiagnostics(diagnostics),
  }
}

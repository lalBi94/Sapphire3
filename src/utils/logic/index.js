import { walkAst } from './ast.js'

export { createProject, createModule, createNode, moduleKinds, sourceFormatVersion } from './model.js'
export { primitiveDefinitions, primitiveType, sameType, acceptsOperand } from './primitives.js'
export { buildLogicalAst, walkAst } from './ast.js'
export { buildSemanticModel } from './semantics.js'
export { diagnosticCodes, hasBlockingDiagnostics } from './diagnostics.js'
export { serializeSource, deserializeSource } from './serialization.js'
export { analyzeProgram } from './analysis.js'
export { createContextIndex, resolveContext, getVisibleSymbols } from './contextResolver.js'
export { getAvailableActions } from './actionResolver.js'
export { createNodeBundle } from './nodeFactory.js'
export { insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule } from './sourceMutation.js'
export { nodeSchema, getNodeSchema, binaryOperators, unaryOperators } from './nodeSchema.js'
export { simulateProgram } from './simulation.js'
export { analyzeReachability } from './reachability.js'
export { createDebugSession, moveDebugSession } from './debugging.js'
export { getModuleRootSymbols, getModuleFunctions, getImportCandidates, setModuleExport, addModuleImport, removeModuleImport } from './moduleInterface.js'

// Retrouve une construction à partir de son identifiant graphique/source stable.
export function findAstNode(ast, sourceId) {
  let found = null
  walkAst(ast, (node) => {
    if (!found && node.sourceId === sourceId && !['Invalid', 'Hole'].includes(node.kind)) found = node
  })
  return found
}

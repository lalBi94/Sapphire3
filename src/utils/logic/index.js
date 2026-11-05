import { walkAst } from './ast.js'

export { createProject, createModule, createNode, moduleKinds, sourceFormatVersion } from './model.js'
export { primitiveDefinitions, primitiveType, sameType, acceptsOperand, arrayType, isArrayType, arrayElementType, isValidElementType, pointerType, isPointerType, pointerPointee, isValidPointee, isValidParameterType, isValidReturnType, functionType, isFunctionType, typeFromRecord, genericType, isGenericType, containsGeneric } from './primitives.js'
export { maximumTypeParameters, isTypeParameterName, declaredTypeParameters, typeParameterConstraint, substituteType } from './generics.js'
export { buildLogicalAst, walkAst } from './ast.js'
export { buildSemanticModel } from './semantics.js'
export { diagnosticCodes, hasBlockingDiagnostics } from './diagnostics.js'
export { serializeSource, deserializeSource } from './serialization.js'
export { analyzeProgram } from './analysis.js'
export { createContextIndex, resolveContext, getVisibleSymbols } from './contextResolver.js'
export { getAvailableActions } from './actionResolver.js'
export { createNodeBundle } from './nodeFactory.js'
export { insertSourceNodes, updateSourceNode, deleteSourceNodes, deleteSourceModule, reorderSourceNode, setSourceNodeContracts } from './sourceMutation.js'
export { renameSourceSymbol } from './rename.js'
export { nodeSchema, getNodeSchema, binaryOperators, unaryOperators } from './nodeSchema.js'
export { mathNatives, getMathNative, mathNativeIds } from './mathNatives.js'
export { simulateProgram } from './simulation.js'
export { analyzeReachability } from './reachability.js'
export { buildDependencyGraph, buildControlFlowGraph } from './nodeGraphs.js'
export { getModuleLinks } from './moduleLinks.js'
export { moduleInitializationOrder } from './moduleInitialization.js'
export { captureSourceNode, pasteSourceNode, moveSourceNode, duplicateSourceNode } from './nodeTransfer.js'
export { deleteSourceTargets, duplicateSourceTargets, moveSourceNodes } from './selectionActions.js'
export { createDebugSession, moveDebugSession, resolveDebugScreens } from './debugging.js'
export { contractKinds, contractDefinitions, contractKindsForType, getContractDefinition, createContract, isContract, isContractKind, satisfiesContract, normalizeContracts, contractLabel } from './contracts.js'
export { getUnusedDeclarationIds } from './deadCode.js'
export { deletionImpact } from './deletionImpact.js'
export { analyzePurity, getPureIds } from './purity.js'
export { captureBookmark, insertBookmark, describeBookmark } from './bookmarks.js'
export { getModuleRootSymbols, getModuleFunctions, getImportCandidates, getUnusedImportIds, setModuleExport, addModuleImport, removeModuleImport, getCallableSymbols, ensureModuleImports } from './moduleInterface.js'

// Retrouve une construction à partir de son identifiant graphique/source stable.
export function findAstNode(ast, sourceId) {
  let found = null
  walkAst(ast, (node) => {
    if (!found && node.sourceId === sourceId && !['Invalid', 'Hole'].includes(node.kind)) found = node
  })
  return found
}

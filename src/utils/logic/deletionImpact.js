import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
import { deleteSourceNodes } from './sourceMutation.js'

// Compte ce qui casserait ailleurs si la cible était supprimée : appels, autres références, imports.
export function deletionImpact(project, targetId, options = {}) {
  const analysis = options.analysis ?? analyzeProgram(project)
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analysis)
  const removal = deleteSourceNodes(project, targetId, { index })
  if (!removal.ok) return { ok: false, code: removal.code, calls: 0, references: 0, imports: 0, total: 0, removedCount: 0 }
  const removedIds = new Set(removal.removedNodeIds ?? [])
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  let calls = 0
  let references = 0
  for (const reference of analysis.semantic.references) {
    // Une référence déjà emportée par la suppression ne casse rien d'autre.
    if (removedIds.has(reference.nodeId)) continue
    const symbol = symbols.get(reference.symbolId)
    if (!symbol || !removedIds.has(symbol.nodeId)) continue
    // Un appel se reconnaît à la référence placée dans le slot `callee` d'un appel.
    const parent = index.parents.get(reference.nodeId)?.[0]
    if (parent?.slot === 'callee') calls += 1
    else references += 1
  }
  const imports = (project.modules ?? []).reduce((count, module) => count + (Array.isArray(module?.imports) ? module.imports.filter((entry) => removedIds.has(entry?.nodeId)).length : 0), 0)
  return { ok: true, calls, references, imports, total: calls + references + imports, removedCount: removedIds.size }
}
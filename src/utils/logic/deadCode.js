import { analyzeProgram } from './analysis.js'

// Déclarations privées qu'aucune référence résolue n'utilise, exportées ou point d'entrée exclues.
export function getUnusedDeclarationIds(project, analysis = analyzeProgram(project)) {
  const symbolsById = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  // Une référence vers un import vise la déclaration cible : son nodeId reste la déclaration.
  const used = new Set()
  for (const reference of analysis.semantic.references) {
    const symbol = symbolsById.get(reference?.symbolId)
    if (symbol) used.add(symbol.nodeId)
  }
  const exported = new Set((project.modules ?? []).flatMap((module) => (module.exports ?? []).map((entry) => entry?.nodeId)))
  const unused = []
  const seen = new Set()
  for (const symbol of analysis.semantic.symbols) {
    if (symbol.importedFrom) continue
    if (!['VariableDeclaration', 'ConstantDeclaration', 'FunctionDeclaration'].includes(symbol.kind)) continue
    if (seen.has(symbol.nodeId) || used.has(symbol.nodeId) || exported.has(symbol.nodeId)) continue
    const node = project.nodes?.find((entry) => entry?.id === symbol.nodeId)
    if (node?.properties?.entryPoint === true) continue
    seen.add(symbol.nodeId)
    unused.push(symbol.nodeId)
  }
  return unused
}
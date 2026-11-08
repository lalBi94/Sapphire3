import { analyzeProgram } from './analysis.js'

// Déclarations qu'aucune référence résolue n'utilise : variables, constantes, fonctions et paramètres privés.
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
    // Le binding onClick et sa fonction vide sont appelés par l'interface, hors références source.
    if (typeof symbol.name === 'string' && (symbol.name.startsWith('INPUT_SP3_GLOBAL_ONCLICK_') || symbol.name.startsWith('INPUT_SP3_GLOBAL_NOOP_'))) continue
    if (!['VariableDeclaration', 'ConstantDeclaration', 'FunctionDeclaration', 'Parameter'].includes(symbol.kind)) continue
    if (seen.has(symbol.nodeId) || used.has(symbol.nodeId) || exported.has(symbol.nodeId)) continue
    const node = project.nodes?.find((entry) => entry?.id === symbol.nodeId)
    if (node?.properties?.entryPoint === true) continue
    seen.add(symbol.nodeId)
    unused.push(symbol.nodeId)
  }
  return unused
}
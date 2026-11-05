import { isId, isRecord } from './model.js'

// Ordonne les modules pour que chaque initialiseur global voie ses dépendances déjà initialisées.
export function moduleInitializationOrder(project, analysis = null) {
  const modules = (Array.isArray(project?.modules) ? project.modules : []).filter((module) => isRecord(module) && isId(module.id))
  const positions = new Map(modules.map((module, position) => [module.id, position]))
  const dependencies = new Map(modules.map((module) => [module.id, new Set()]))
  const symbols = new Map((analysis?.semantic?.symbols ?? []).filter(isRecord).map((symbol) => [symbol.id, symbol]))

  // Une référence à un import crée une arête du module consommateur vers son fournisseur.
  for (const reference of analysis?.semantic?.references ?? []) {
    if (!isRecord(reference) || !isId(reference.symbolId)) continue
    const symbol = symbols.get(reference.symbolId)
    if (!symbol || !isId(symbol.moduleId) || !isId(symbol.importedFrom) || symbol.moduleId === symbol.importedFrom) continue
    if (!dependencies.has(symbol.moduleId) || !positions.has(symbol.importedFrom)) continue
    dependencies.get(symbol.moduleId).add(symbol.importedFrom)
  }

  // Tri stable : ordre source tant qu'aucune dépendance ne l'impose, puis repli source en cas de cycle.
  const ordered = []
  const placed = new Set()
  while (ordered.length < modules.length) {
    let next = null
    for (const module of modules) {
      if (placed.has(module.id)) continue
      if ([...dependencies.get(module.id)].every((dependency) => placed.has(dependency))) {
        next = module
        break
      }
    }
    if (!next) next = modules.find((module) => !placed.has(module.id))
    ordered.push(next)
    placed.add(next.id)
  }
  return ordered
}

import { isId, isRecord } from './model.js'

/**
 * @typedef {{id:string, fromId:string, toId:string, fromName:string, toName:string,
 *   exports:Array<{nodeId:string, name:string, localName:string, uses:number}>}} ModuleLink
 * Un lien part du module exportateur et entre dans le module qui l'utilise réellement ; aucune flèche inverse.
 */

// Retrouve le nom publié par le module exportateur, sans inventer celui d'un export mal formé.
function publishedName(provider, nodeId) {
  const entry = (Array.isArray(provider?.exports) ? provider.exports : []).find((item) => isRecord(item) && item.nodeId === nodeId)
  return isId(entry?.name) ? entry.name : null
}

// Liste les exportations réellement visées par au moins une référence résolue depuis un autre module.
export function getModuleLinks(index) {
  const symbols = index?.analysis?.semantic?.symbols
  const references = index?.analysis?.semantic?.references
  if (!index?.modules || !Array.isArray(symbols) || !Array.isArray(references)) return []

  const importedSymbols = new Map(symbols.filter((symbol) => isRecord(symbol) && isId(symbol.importedFrom)).map((symbol) => [symbol.id, symbol]))
  const links = new Map()

  for (const reference of references) {
    if (!isRecord(reference)) continue
    const symbol = importedSymbols.get(reference.symbolId)
    if (!symbol || !isId(symbol.moduleId) || !isId(symbol.nodeId)) continue
    if (symbol.moduleId === symbol.importedFrom) continue
    const receiver = index.modules.get(symbol.moduleId)
    const provider = index.modules.get(symbol.importedFrom)
    if (!receiver || !provider) continue

    const key = `${symbol.importedFrom}::${symbol.moduleId}`
    const link = links.get(key) ?? {
      id: key,
      fromId: symbol.importedFrom,
      toId: symbol.moduleId,
      fromName: provider.name ?? '',
      toName: receiver.name ?? '',
      exports: [],
    }
    const used = link.exports.find((entry) => entry.nodeId === symbol.nodeId)
    if (used) used.uses += 1
    else {
      const name = publishedName(provider, symbol.nodeId) ?? (isId(symbol.name) ? symbol.name : '')
      link.exports.push({ nodeId: symbol.nodeId, name, localName: symbol.name ?? '', uses: 1 })
    }
    links.set(key, link)
  }

  return [...links.values()]
}

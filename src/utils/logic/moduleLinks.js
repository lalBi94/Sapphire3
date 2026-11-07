import { isId, isRecord, moduleKinds } from './model.js'

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

// Rassemble les classes citées par une annotation de type, y compris dans une signature de fonction.
function classIdsOf(type, found = new Set(), depth = 0) {
  if (!isRecord(type) || depth > 12) return found
  if (type.kind === 'class' && isId(type.classId)) found.add(type.classId)
  else if (type.kind === 'array') classIdsOf(type.elementType, found, depth + 1)
  else if (type.kind === 'pointer') classIdsOf(type.pointee, found, depth + 1)
  else if (type.kind === 'function') {
    for (const parameter of Array.isArray(type.parameters) ? type.parameters : []) classIdsOf(parameter, found, depth + 1)
    classIdsOf(type.returnType, found, depth + 1)
  }
  return found
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

  // Une classe instanciée ou citée comme type crée la même dépendance : de sa carte vers le module consommateur.
  function addClassUse(classId, receiverId, uses = 1) {
    if (!isId(classId) || !isId(receiverId) || classId === receiverId) return
    const provider = index.modules.get(classId)
    const receiver = index.modules.get(receiverId)
    if (!provider || !receiver || provider.kind !== moduleKinds.class) return
    const key = `${classId}::${receiverId}`
    const link = links.get(key) ?? {
      id: key,
      fromId: classId,
      toId: receiverId,
      fromName: provider.name ?? '',
      toName: receiver.name ?? '',
      exports: [],
    }
    const entryId = `class:${classId}`
    const used = link.exports.find((entry) => entry.nodeId === entryId)
    if (used) used.uses += uses
    else link.exports.push({ nodeId: entryId, name: provider.name ?? '', localName: '', uses })
    links.set(key, link)
  }

  if (index.nodes) {
    for (const node of index.nodes.values()) {
      if (!isRecord(node) || !isId(node.moduleId)) continue
      if (node.kind === 'NewExpression') {
        addClassUse(node.properties?.classId, node.moduleId)
        continue
      }
      for (const classId of classIdsOf(node.properties?.type)) addClassUse(classId, node.moduleId)
    }
  }

  return [...links.values()]
}

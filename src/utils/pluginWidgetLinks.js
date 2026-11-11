// Dépendances déclarées par les widgets de plugin vers les modules qui fournissent
// les variables liées et les fonctions de sortie. Le widget n'est pas un module
// logique : le lien représente uniquement une dépendance de présentation explicite.

// Ajoute une utilisation à un lien de module vers une carte de plugin.
function addUse(links, moduleId, moduleName, card, nodeId, name, localName) {
  const key = `${moduleId}::plugin:${card.id}`
  const link = links.get(key) ?? {
    id: `plugin:${key}`,
    fromId: moduleId,
    toId: card.id,
    fromName: moduleName,
    toName: card.name || card.pluginId || card.id,
    exports: [],
  }
  const existing = link.exports.find((entry) => entry.nodeId === nodeId)
  if (existing) existing.uses += 1
  else link.exports.push({ nodeId, name, localName: localName || name, uses: 1 })
  links.set(key, link)
}

// Liste les liens des widgets de plugin vers les modules qui fournissent leurs liaisons.
export function getPluginWidgetLinks(project, index, cards) {
  if (!index?.modules || !index?.nodes) return []
  const symbols = index.analysis?.semantic?.symbols ?? []
  const byName = new Map()
  for (const symbol of symbols) {
    if (!['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(symbol?.kind) || typeof symbol.name !== 'string') continue
    const list = byName.get(symbol.name) ?? []
    list.push(symbol)
    byName.set(symbol.name, list)
  }
  const links = new Map()
  for (const card of cards ?? []) {
    if (card?.type !== 'pluginWidget' || card.hidden) continue
    for (const name of Object.values(card.bindings?.inputs ?? {})) {
      if (typeof name !== 'string' || name.length === 0) continue
      for (const symbol of byName.get(name) ?? []) {
        const moduleId = symbol.importedFrom || symbol.moduleId
        if (!index.modules.has(moduleId)) continue
        addUse(links, moduleId, index.modules.get(moduleId).name ?? '', card, symbol.nodeId, symbol.name, symbol.name)
      }
    }
    for (const functionId of Object.values(card.bindings?.outputs ?? {})) {
      const node = index.nodes.get(functionId)
      if (node?.kind !== 'FunctionDeclaration' || !index.modules.has(node.moduleId)) continue
      const name = node.properties?.name ?? node.id
      addUse(links, node.moduleId, index.modules.get(node.moduleId).name ?? '', card, node.id, name, name)
    }
  }
  return [...links.values()].sort((left, right) => `${left.fromId}|${left.toId}`.localeCompare(`${right.fromId}|${right.toId}`))
}

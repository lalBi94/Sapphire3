// Nom stable de la globale booléenne interne à un bouton d'entrée.
export function inputButtonGlobalName(index) {
  return `INPUT_SP3_GLOBAL_ISPRESS_${index}`
}

// Retrouve le nœud global d'un bouton depuis son module, sans dépendre de l'interface.
export function inputButtonNodeId(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputButton?.index
  if (!Number.isInteger(index)) return null
  return (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node.properties?.name === inputButtonGlobalName(index))?.id ?? null
}

// Produit la table d'entrées attendue par le moteur depuis les cartes de présentation.
export function collectInputButtonValues(project, cards) {
  const inputs = {}
  for (const card of cards ?? []) {
    if (card?.type !== 'toggleButton' && card?.type !== 'holdButton') continue
    const nodeId = inputButtonNodeId(project, card.id)
    if (nodeId) inputs[nodeId] = Boolean(card.pressed)
  }
  return inputs
}

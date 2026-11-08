// Nom stable de la globale booléenne historique d'un bouton d'entrée.
export function inputButtonGlobalName(index) {
  return `INPUT_SP3_GLOBAL_ISPRESS_${index}`
}

// Nom stable de la fonction `onClick(bool)` interne à un bouton d'entrée.
export function inputButtonOnClickName(index) {
  return `INPUT_SP3_GLOBAL_ONCLICK_${index}`
}

// Nom stable de la fonction vide utilisée avant tout binding.
export function inputButtonNoopName(index) {
  return `INPUT_SP3_GLOBAL_NOOP_${index}`
}

// Retrouve le nœud global historique d'un bouton depuis son module.
export function inputButtonNodeId(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputButton?.index
  if (!Number.isInteger(index)) return null
  return (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node?.properties?.name === inputButtonGlobalName(index))?.id ?? null
}

// Retrouve la variable `onClick` d'un bouton, ou null pour un ancien bouton `isPress`.
export function inputButtonOnClickNodeId(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputButton?.index
  if (!Number.isInteger(index)) return null
  return (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node?.kind === 'VariableDeclaration' && node?.properties?.name === inputButtonOnClickName(index))?.id ?? null
}

// Décrit le binding courant : variable onClick, initialiseur et cible résolue.
export function inputButtonOnClickBinding(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputButton?.index
  if (!Number.isInteger(index)) return null
  const onClickNodeId = inputButtonOnClickNodeId(project, moduleId)
  if (!onClickNodeId) return null
  const nodes = new Map((project?.nodes ?? []).map((node) => [node?.id, node]))
  const declaration = nodes.get(onClickNodeId)
  const initializerId = declaration?.children?.initializer ?? null
  const initializer = nodes.get(initializerId)
  const target = initializer?.kind === 'Reference' ? initializer.references?.target ?? null : null
  const noopName = inputButtonNoopName(index)
  let callbackId = null
  let importId = null
  if (target?.kind === 'name') {
    if (target.name !== noopName) {
      callbackId = (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node?.kind === 'FunctionDeclaration' && node?.properties?.name === target.name)?.id ?? null
    }
  } else if (target?.kind === 'import') {
    importId = target.importId
    callbackId = (module?.imports ?? []).find((entry) => entry?.id === target.importId)?.nodeId ?? null
  }
  return { onClickNodeId, initializerId, target, callbackId, importId, noopName, moduleId, index }
}

// Identifiant de la fonction liée au bouton, ou null si le bouton est vide.
export function inputButtonCallbackId(project, moduleId) {
  return inputButtonOnClickBinding(project, moduleId)?.callbackId ?? null
}

// Produit la table d'entrées historique attendue par le moteur depuis les cartes.
export function collectInputButtonValues(project, cards) {
  const inputs = {}
  for (const card of cards ?? []) {
    if (card?.type !== 'toggleButton' && card?.type !== 'holdButton') continue
    const nodeId = inputButtonNodeId(project, card.id)
    if (nodeId) inputs[nodeId] = Boolean(card.pressed)
  }
  return inputs
}

// Nom stable de la fonction `onChange(int)` interne à une entrée numérique.
export function inputNumberOnChangeName(index) {
  return `INPUT_SP3_GLOBAL_ONCHANGE_${index}`
}

// Nom stable de la fonction vide utilisée avant tout binding.
export function inputNumberNoopName(index) {
  return `INPUT_SP3_GLOBAL_NOOP_${index}`
}

// Retrouve la variable `onChange` d'une entrée numérique depuis son module.
export function inputNumberOnChangeNodeId(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputNumber?.index
  if (!Number.isInteger(index)) return null
  return (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node?.kind === 'VariableDeclaration' && node?.properties?.name === inputNumberOnChangeName(index))?.id ?? null
}

// Décrit le binding courant : variable onChange, initialiseur et cible résolue.
export function inputNumberOnChangeBinding(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.inputNumber?.index
  if (!Number.isInteger(index)) return null
  const onChangeNodeId = inputNumberOnChangeNodeId(project, moduleId)
  if (!onChangeNodeId) return null
  const nodes = new Map((project?.nodes ?? []).map((node) => [node?.id, node]))
  const declaration = nodes.get(onChangeNodeId)
  const initializerId = declaration?.children?.initializer ?? null
  const initializer = nodes.get(initializerId)
  const target = initializer?.kind === 'Reference' ? initializer.references?.target ?? null : null
  const noopName = inputNumberNoopName(index)
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
  return { onChangeNodeId, initializerId, target, callbackId, importId, noopName, moduleId, index }
}

// Identifiant de la fonction liée à l'entrée numérique, ou null si elle est vide.
export function inputNumberCallbackId(project, moduleId) {
  return inputNumberOnChangeBinding(project, moduleId)?.callbackId ?? null
}

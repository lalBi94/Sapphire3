// Préfixe stable des noms internes d'un sélecteur de couleur.
export function colorPickerPrefix(channels) {
  return channels === 4 ? 'RGBA_PICKER' : 'RGB_PICKER'
}

// Nom stable de la fonction `onChange(int[])` interne à un sélecteur.
export function colorPickerOnChangeName(index, channels = 3) {
  return `${colorPickerPrefix(channels)}_SP3_GLOBAL_ONCHANGE_${index}`
}

// Nom stable de la fonction vide utilisée avant tout binding.
export function colorPickerNoopName(index, channels = 3) {
  return `${colorPickerPrefix(channels)}_SP3_GLOBAL_NOOP_${index}`
}

// Retourne le nombre de canaux d'un sélecteur, avec trois canaux par défaut.
export function colorPickerChannels(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  return module?.colorPicker?.channels === 4 ? 4 : 3
}

// Normalise une valeur de couleur en trois ou quatre entiers 0..255.
export function normalizeColorValue(value, channels = 3) {
  const count = channels === 4 ? 4 : 3
  const fallback = [255, 213, 71, 255]
  return Array.from({ length: count }, (_, index) => {
    const entry = Array.isArray(value) ? value[index] : fallback[index]
    return Number.isInteger(entry) && entry >= 0 && entry <= 255 ? entry : fallback[index]
  })
}

// Valeur initiale d'un sélecteur, indépendante de React et du rendu.
export function colorPickerDefaults(channels = 3) {
  return normalizeColorValue(null, channels)
}

// Retrouve la variable `onChange` d'un sélecteur depuis son module.
export function colorPickerOnChangeNodeId(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.colorPicker?.index
  if (!Number.isInteger(index)) return null
  const name = colorPickerOnChangeName(index, colorPickerChannels(project, moduleId))
  return (project?.nodes ?? []).find((node) => node?.moduleId === moduleId && node?.kind === 'VariableDeclaration' && node?.properties?.name === name)?.id ?? null
}

// Décrit le binding courant : variable onChange, initialiseur et cible résolue.
export function colorPickerOnChangeBinding(project, moduleId) {
  const module = (project?.modules ?? []).find((entry) => entry?.id === moduleId)
  const index = module?.colorPicker?.index
  if (!Number.isInteger(index)) return null
  const channels = colorPickerChannels(project, moduleId)
  const onChangeNodeId = colorPickerOnChangeNodeId(project, moduleId)
  if (!onChangeNodeId) return null
  const nodes = new Map((project?.nodes ?? []).map((node) => [node?.id, node]))
  const declaration = nodes.get(onChangeNodeId)
  const initializerId = declaration?.children?.initializer ?? null
  const initializer = nodes.get(initializerId)
  const target = initializer?.kind === 'Reference' ? initializer.references?.target ?? null : null
  const noopName = colorPickerNoopName(index, channels)
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
  return { onChangeNodeId, initializerId, target, callbackId, importId, noopName, moduleId, index, channels }
}

// Identifiant de la fonction liée au sélecteur, ou null si elle est vide.
export function colorPickerCallbackId(project, moduleId) {
  return colorPickerOnChangeBinding(project, moduleId)?.callbackId ?? null
}

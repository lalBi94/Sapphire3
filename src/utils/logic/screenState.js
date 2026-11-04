// Produit le nom stable d'une variable globale interne à un écran.
export function screenGlobalName(kind, index) {
  return `SCREEN_SP3_GLOBAL_${kind}_${index}`
}

// Prépare un lecteur d'écrans : les nœuds globaux sont résolus une seule fois,
// puis chaque image ne lit que les valeurs courantes de l'exécution.
export function createScreenStateReader(project) {
  const screens = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.screen) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    screens.push({
      moduleId: module.id,
      widthNodeId: find(screenGlobalName('WIDTH', module.screen.index))?.id ?? null,
      heightNodeId: find(screenGlobalName('HEIGHT', module.screen.index))?.id ?? null,
      pixelsNodeId: find(screenGlobalName('PIXELS', module.screen.index))?.id ?? null,
      width: module.screen.width,
      height: module.screen.height,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const screen of screens) {
      const width = Number(values.get(screen.widthNodeId) ?? screen.width)
      const height = Number(values.get(screen.heightNodeId) ?? screen.height)
      const pixels = values.get(screen.pixelsNodeId)
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) continue
      states[screen.moduleId] = {
        width,
        height,
        pixels: Array.isArray(pixels) ? pixels.slice(0, width * height * 4).map((value) => Number(value)) : [],
      }
    }
    return states
  }
}

// Lit l'état courant des écrans depuis les variables globales d'une exécution.
export function readScreenStates(project, values) {
  return createScreenStateReader(project)(values)
}

// Compare deux états d'écran pour ne conserver que les images qui changent vraiment.
export function sameScreenStates(left, right) {
  if (left === right) return true
  if (!left || !right) return false
  const leftIds = Object.keys(left)
  const rightIds = Object.keys(right)
  if (leftIds.length !== rightIds.length) return false
  for (const id of leftIds) {
    const first = left[id]
    const second = right[id]
    if (!second || first.width !== second.width || first.height !== second.height || first.pixels.length !== second.pixels.length) return false
    for (let index = 0; index < first.pixels.length; index += 1) {
      if (first.pixels[index] !== second.pixels[index]) return false
    }
  }
  return true
}

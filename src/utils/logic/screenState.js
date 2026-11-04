// Produit le nom stable d'une variable globale interne à un écran.
export function screenGlobalName(kind, index) {
  return `SCREEN_SP3_GLOBAL_${kind}_${index}`
}

// Lit l'état courant des écrans depuis les variables globales d'une exécution.
export function readScreenStates(project, values) {
  if (!(values instanceof Map)) return {}
  const states = {}
  for (const module of project?.modules ?? []) {
    if (!module?.screen) continue
    const find = (name) => project.nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    const pixelsNode = find(screenGlobalName('PIXELS', module.screen.index))
    const widthNode = find(screenGlobalName('WIDTH', module.screen.index))
    const heightNode = find(screenGlobalName('HEIGHT', module.screen.index))
    const width = Number(values.get(widthNode?.id) ?? module.screen.width)
    const height = Number(values.get(heightNode?.id) ?? module.screen.height)
    const pixels = values.get(pixelsNode?.id)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) continue
    states[module.id] = {
      width,
      height,
      pixels: Array.isArray(pixels) ? pixels.slice(0, width * height * 4).map((value) => Number(value)) : [],
    }
  }
  return states
}

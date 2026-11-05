// Lit l'état des LED depuis les variables globales d'une exécution.
export function ledGlobalName(index) {
  return `LED_SP3_GLOBAL_VALUE_${index}`
}

// Prépare un lecteur de LED : le nœud global est résolu une seule fois.
export function createLedStateReader(project) {
  const leds = []
  for (const module of project?.modules ?? []) {
    if (!module?.led) continue
    const node = (project.nodes ?? []).find((entry) => entry?.moduleId === module.id && entry.properties?.name === ledGlobalName(module.led.index))
    leds.push({ moduleId: module.id, valueNodeId: node?.id ?? null })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const led of leds) {
      const value = values.get(led.valueNodeId)
      if (typeof value !== 'boolean') continue
      states[led.moduleId] = { value }
    }
    return states
  }
}

// Lit l'état courant des LED, sans conserver de Map runtime.
export function readLedStates(project, values) {
  return createLedStateReader(project)(values)
}
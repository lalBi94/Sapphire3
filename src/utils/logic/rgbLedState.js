// Lit l'état des LED RVB depuis les variables globales d'une exécution.
export function rgbLedGlobalName(channel, index) {
  return `RGBLED_SP3_GLOBAL_${channel}_${index}`
}

const channels = [
  ['red', 'RED'],
  ['green', 'GREEN'],
  ['blue', 'BLUE'],
]

// Prépare un lecteur de LED RVB : les trois globales sont résolues une seule fois.
export function createRgbLedStateReader(project) {
  const leds = []
  for (const module of project?.modules ?? []) {
    if (!module?.rgbLed) continue
    const nodes = project.nodes ?? []
    const nodeId = (channel) => nodes.find((entry) => entry?.moduleId === module.id && entry.properties?.name === rgbLedGlobalName(channel, module.rgbLed.index))?.id ?? null
    leds.push({ moduleId: module.id, red: nodeId('RED'), green: nodeId('GREEN'), blue: nodeId('BLUE') })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const led of leds) {
      const red = values.get(led.red)
      const green = values.get(led.green)
      const blue = values.get(led.blue)
      if (![red, green, blue].every((value) => typeof value === 'number' || typeof value === 'bigint')) continue
      const channels = { red: Number(red), green: Number(green), blue: Number(blue) }
      if (!Object.values(channels).every((value) => Number.isInteger(value))) continue
      states[led.moduleId] = channels
    }
    return states
  }
}

// Lit l'état courant des LED RVB, sans conserver de Map runtime.
export function readRgbLedStates(project, values) {
  return createRgbLedStateReader(project)(values)
}

// Les canaux sont tous nommés de la même façon, pour construire les globales du module.
export { channels as rgbLedChannels }

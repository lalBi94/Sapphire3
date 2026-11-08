// Lit les canaux et la fenêtre d'un oscilloscope depuis les variables globales d'une exécution.
export function oscilloscopeGlobalName(kind, index) {
  return `OSC_SP3_GLOBAL_${kind}_${index}`
}

// Nom stable d'une variable de canal, pour un emplacement fixe du module caché.
export function oscilloscopeChannelName(kind, index, slot) {
  return `OSC_SP3_GLOBAL_CH_${kind}_${index}_${slot}`
}

// Bornes de sécurité partagées par le module, le lecteur et l'interface.
export const maximumOscilloscopeChannels = 6
export const oscilloscopeDefaultSamples = 64
export const maximumOscilloscopeSamples = 256
export const minimumOscilloscopeSamples = 16

// Prépare un lecteur d'oscilloscopes : les nœuds globaux sont résolus une seule fois.
export function createOscilloscopeStateReader(project) {
  const scopes = []
  const nodes = project?.nodes ?? []
  for (const module of project?.modules ?? []) {
    if (!module?.oscilloscope) continue
    const find = (name) => nodes.find((node) => node?.moduleId === module.id && node.properties?.name === name)
    const samples = Math.max(minimumOscilloscopeSamples, Math.min(maximumOscilloscopeSamples, Number(module.oscilloscope.samples) || oscilloscopeDefaultSamples))
    const channels = []
    for (let slot = 0; slot < maximumOscilloscopeChannels; slot += 1) {
      channels.push({
        activeNodeId: find(oscilloscopeChannelName('ACTIVE', module.oscilloscope.index, slot))?.id ?? null,
        idNodeId: find(oscilloscopeChannelName('ID', module.oscilloscope.index, slot))?.id ?? null,
        valuesNodeId: find(oscilloscopeChannelName('Y', module.oscilloscope.index, slot))?.id ?? null,
      })
    }
    scopes.push({
      moduleId: module.id,
      samples,
      xMinNodeId: find(oscilloscopeGlobalName('X_MIN', module.oscilloscope.index))?.id ?? null,
      xMaxNodeId: find(oscilloscopeGlobalName('X_MAX', module.oscilloscope.index))?.id ?? null,
      revisionNodeId: find(oscilloscopeGlobalName('REVISION', module.oscilloscope.index))?.id ?? null,
      channels,
    })
  }
  return (values) => {
    if (!(values instanceof Map)) return {}
    const states = {}
    for (const scope of scopes) {
      let xMin = Number(values.get(scope.xMinNodeId))
      let xMax = Number(values.get(scope.xMaxNodeId))
      if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
        xMin = -10
        xMax = 10
      }
      const channels = []
      for (const channel of scope.channels) {
        if (!values.get(channel.activeNodeId)) continue
        const raw = values.get(channel.valuesNodeId)
        if (!Array.isArray(raw)) continue
        const id = Math.trunc(Number(values.get(channel.idNodeId)) || 0)
        const length = Math.min(scope.samples, raw.length)
        const channelValues = new Array(length)
        for (let index = 0; index < length; index += 1) {
          const value = Number(raw[index])
          channelValues[index] = Number.isFinite(value) ? value : null
        }
        channels.push({ id, values: channelValues })
      }
      // L'ordre des identifiants reste stable même après réutilisation d'un emplacement.
      channels.sort((left, right) => left.id - right.id)
      states[scope.moduleId] = {
        xMin,
        xMax,
        samples: scope.samples,
        revision: Math.trunc(Number(values.get(scope.revisionNodeId)) || 0),
        channels,
      }
    }
    return states
  }
}

// Lit l'état courant des oscilloscopes, sans conserver de Map runtime.
export function readOscilloscopeStates(project, values) {
  return createOscilloscopeStateReader(project)(values)
}

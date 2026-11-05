import { simulateProgram } from '../utils/logic/index.js'

// Exécute une simulation hors du fil principal et renvoie un résultat sérialisable.
self.onmessage = (event) => {
  const { id, project, options } = event.data ?? {}
  try {
    const result = simulateProgram(project, options)
    // Une relance de lecture d'écran n'a pas besoin de la trace ni des états par pas.
    if (options?.screenOnly) {
      self.postMessage({
        id,
        result: {
          ok: result.ok,
          screens: result.screens,
          gauges: result.gauges,
          leds: result.leds,
          screenFrames: result.screenFrames,
          screenFrameGauges: result.screenFrameGauges,
          screenFrameLeds: result.screenFrameLeds,
        },
      })
      return
    }
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: { message: error?.message ?? 'Simulation failed.', code: error?.code ?? null } })
  }
}

import { analyzeProgram, createDebugSession, simulateProgram } from '../utils/logic/index.js'
import { transpileProgram } from '../utils/transpilation/index.js'

// Transmet une avancement sérialisable au demandeur, sans exposer les objets internes du moteur.
function reporter(id) {
  return (progress) => self.postMessage({ id, progress })
}

// Exécute une opération lourde hors du fil principal.
// L'annulation est obtenue en terminant le worker : aucun calcul synchrone ne peut être interrompu autrement.
self.onmessage = (event) => {
  const { id, action = 'simulate', project, options = {} } = event.data ?? {}
  try {
    if (action === 'debug') {
      const { project: _project, result: _result, ...session } = createDebugSession(project, { ...options, onProgress: reporter(id) })
      self.postMessage({ id, session })
      return
    }
    if (action === 'transpile') {
      const { analysis: _analysis, ...result } = transpileProgram(project, { ...options, onProgress: reporter(id) })
      self.postMessage({ id, result })
      return
    }
    if (action === 'check') {
      const targets = Array.isArray(options.targets) ? options.targets : []
      const analysis = analyzeProgram(project, { onProgress: reporter(id) })
      const checks = {}
      targets.forEach((target, index) => {
        checks[target] = transpileProgram(project, { target, analysis }).ok ? 'ok' : 'blocked'
        self.postMessage({ id, progress: { phase: 'check', current: index + 1, total: targets.length } })
      })
      self.postMessage({ id, checks })
      return
    }
    const result = simulateProgram(project, { ...options, onProgress: reporter(id) })
    // Une relance de lecture d'écran n'a pas besoin de la trace ni des états par pas.
    if (options.screenOnly) {
      self.postMessage({
        id,
        result: {
          ok: result.ok,
          screens: result.screens,
          gauges: result.gauges,
          leds: result.leds,
          progresses: result.progresses,
          barCharts: result.barCharts,
          screenFrames: result.screenFrames,
          screenFrameGauges: result.screenFrameGauges,
          screenFrameLeds: result.screenFrameLeds,
          screenFrameProgresses: result.screenFrameProgresses,
          screenFrameBarCharts: result.screenFrameBarCharts,
        },
      })
      return
    }
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: { message: error?.message ?? 'Engine operation failed.', code: error?.code ?? null } })
  }
}

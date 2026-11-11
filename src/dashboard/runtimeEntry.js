// Point d'entrée du runtime embarqué : uniquement le moteur de simulation pur.

import { simulateProgram } from '../utils/logic/simulation.js'
import { applyPluginRuntimePayload } from '../utils/plugins/pluginRuntime.js'

export function simulate(project, options = {}) {
  const { plugins = [], ...simulationOptions } = options
  applyPluginRuntimePayload(plugins)
  return simulateProgram(project, simulationOptions)
}

import { simulateProgram } from '../../../src/utils/logic/index.js'
import { runLiveProgram } from '../../../src/utils/logic/liveSimulation.js'
import { RuntimeError, RUNTIME_ERROR_CODES } from './errors.js'

// Exécute le point d'entrée ou une fonction choisie avec un budget de pas borné.
export function runBounded(project, { maxSteps = 10000, functionId = null, args = [], inputs = {}, onProgress = null } = {}) {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidBudget, 'The step budget must be an integer between 1 and 100000.')
  }
  return simulateProgram(project, { maxSteps, functionId, args, inputs, onProgress })
}

// Exécute le point d'entrée en mode live coopératif ; le pilote contrôle chaque frame.
export function runLive(project, { inputs = {}, sliceSteps = 400, onFrame = null } = {}) {
  if (!Number.isSafeInteger(sliceSteps) || sliceSteps < 1 || sliceSteps > 100000) {
    throw new RuntimeError(RUNTIME_ERROR_CODES.invalidBudget, 'The live slice size must be an integer between 1 and 100000.')
  }
  return runLiveProgram(project, { inputs, sliceSteps, onFrame })
}

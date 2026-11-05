import { simulateProgram } from '../utils/logic/index.js'

// Exécute une simulation hors du fil principal et renvoie un résultat sérialisable.
self.onmessage = (event) => {
  const { id, project, options } = event.data ?? {}
  try {
    self.postMessage({ id, result: simulateProgram(project, options) })
  } catch (error) {
    self.postMessage({ id, error: { message: error?.message ?? 'Simulation failed.', code: error?.code ?? null } })
  }
}

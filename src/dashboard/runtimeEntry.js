// Point d'entrée du runtime embarqué : uniquement le moteur de simulation pur.

import { simulateProgram } from '../utils/logic/simulation.js'

export function simulate(project, options) {
  return simulateProgram(project, options)
}

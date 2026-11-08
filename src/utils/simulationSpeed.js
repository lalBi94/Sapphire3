export const simulationStepDelay = 420
export const simulationSpeedMin = 1
export const simulationSpeedMax = 100
export const liveSpeedDefault = 25
const liveTickBase = 800
const liveTickMin = 8

// Borne une vitesse choisie par l'utilisateur à un entier utilisable.
export function clampSimulationSpeed(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return simulationSpeedMin
  return Math.max(simulationSpeedMin, Math.min(simulationSpeedMax, Math.round(number)))
}

// Calcule l'étape visée à partir du temps écoulé, sans perdre de vitesse quand le rendu ralentit.
export function simulationTargetStep(startIndex, elapsed, speed, totalSteps) {
  const advanced = Math.floor((Math.max(0, elapsed) / simulationStepDelay) * clampSimulationSpeed(speed))
  return Math.min(Math.max(0, totalSteps - 1), startIndex + Math.max(0, advanced))
}

// Convertit la vitesse live en délai entre deux tranches, sans descendre sous 8 ms.
export function liveTickDelay(speed) {
  return Math.max(liveTickMin, Math.round(liveTickBase / clampSimulationSpeed(speed)))
}

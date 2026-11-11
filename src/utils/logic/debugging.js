import { analyzeProgram } from './analysis.js'
import { analyzeReachability } from './reachability.js'
import { simulateProgram } from './simulation.js'

// Normalise une collection de points d'arrêt en Set sans dépendre de la forme reçue.
function breakpointSet(value) {
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

// Retourne le premier point d'arrêt rencontré dans un saut, ou la destination prévue.
function stopBefore(frames, start, end, breakpoints) {
  for (let cursor = start; cursor <= end; cursor += 1) {
    if (breakpoints.has(frames[cursor].nodeId)) return cursor
  }
  return end
}

// Reconstruit l'état des écrans d'un arrêt depuis l'image de base et les pixels modifiés.
export function resolveDebugScreens(frames, index) {
  if (!Array.isArray(frames) || !Number.isInteger(index) || index < 0 || index >= frames.length) return {}
  let baseIndex = index
  while (baseIndex >= 0 && !frames[baseIndex].screenBase) baseIndex -= 1
  if (baseIndex < 0) return {}
  const screens = {}
  for (const [id, screen] of Object.entries(frames[baseIndex].screenBase)) screens[id] = { ...screen, pixels: screen.pixels.slice() }
  for (let cursor = baseIndex + 1; cursor <= index; cursor += 1) {
    for (const patch of frames[cursor].screenPatch ?? []) {
      const screen = screens[patch.id]
      if (!screen) continue
      for (let offset = 0; offset < patch.indices.length; offset += 1) screen.pixels[patch.indices[offset]] = patch.values[offset]
    }
  }
  return screens
}

// Prépare une trace bornée sans mutation source ; le debug démarre toujours sur le premier arrêt.
export function createDebugSession(project, options = {}) {
  const breakpoints = breakpointSet(options.breakpoints)
  const analysis = analyzeProgram(project, { onProgress: options.onProgress })
  const reachability = analyzeReachability(project, analysis)
  const result = simulateProgram(project, { ...options, captureDebug: true })
  const frames = result.debugFrames ?? []
  return { project, frames, cursor: 0, history: [], reachability, breakpoints, errorCode: frames.length ? null : result.errorCode, result, diagnostics: analysis.diagnostics }
}

// Avance d'une instruction, reprend jusqu'au prochain point d'arrêt, termine le scope actif ou restaure un arrêt.
export function moveDebugSession(session, action, options = {}) {
  if (!session || session.frames.length === 0) return session
  const breakpoints = breakpointSet(options.breakpoints ?? session.breakpoints)
  if (action === 'restart') {
    if (session.cursor === 0 && session.history.length === 0) return session
    return { ...session, cursor: 0, history: [], breakpoints }
  }
  if (action === 'back') {
    if (session.history.length === 0) return session
    return { ...session, cursor: session.history.at(-1), history: session.history.slice(0, -1), breakpoints }
  }
  if (action === 'continue') {
    if (session.cursor >= session.frames.length - 1) return session
    const cursor = stopBefore(session.frames, session.cursor + 1, session.frames.length - 1, breakpoints)
    return { ...session, cursor, history: [...session.history, session.cursor], breakpoints }
  }
  if (!['next', 'scope'].includes(action) || session.cursor >= session.frames.length - 1) return session
  let cursor = session.cursor + 1
  if (action === 'scope') {
    const scopeId = session.frames[session.cursor].scopeIds.at(-1)
    while (cursor < session.frames.length - 1) {
      const next = session.frames[cursor]
      if (scopeId ? !next.scopeIds.includes(scopeId) : next.scopeIds.length > 0) break
      cursor += 1
    }
    // Un saut qui franchit un point d'arrêt s'y arrête au lieu d'aller au bout du scope.
    cursor = stopBefore(session.frames, session.cursor + 1, cursor, breakpoints)
  }
  return { ...session, cursor, history: [...session.history, session.cursor], breakpoints }
}

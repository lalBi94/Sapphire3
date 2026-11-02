import { analyzeProgram } from './analysis.js'
import { analyzeReachability } from './reachability.js'
import { simulateProgram } from './simulation.js'

// Normalise une collection de points d'arrêt en Set sans dépendre de la forme reçue.
function breakpointSet(value) {
  if (value instanceof Set) return value
  if (Array.isArray(value)) return new Set(value)
  return new Set()
}

// Retourne l'index du premier arrêt correspondant à un point d'arrêt, ou -1.
function firstBreakpoint(frames, breakpoints) {
  return frames.findIndex((frame) => breakpoints.has(frame.nodeId))
}

// Prépare une trace bornée sans mutation source ; l'interface ne restitue que l'arrêt courant.
export function createDebugSession(project, options = {}) {
  const breakpoints = breakpointSet(options.breakpoints)
  const analysis = analyzeProgram(project)
  const reachability = analyzeReachability(project, analysis)
  const result = simulateProgram(project, { ...options, captureDebug: true })
  const frames = result.debugFrames ?? []
  const start = firstBreakpoint(frames, breakpoints)
  return { project, frames, cursor: start >= 0 ? start : 0, history: [], reachability, breakpoints, errorCode: frames.length ? null : result.errorCode, result }
}

// Avance d'une instruction, reprend jusqu'au prochain point d'arrêt, termine le scope actif ou restaure un arrêt.
export function moveDebugSession(session, action, options = {}) {
  if (!session || session.frames.length === 0) return session
  const breakpoints = breakpointSet(options.breakpoints ?? session.breakpoints)
  if (action === 'restart') {
    const start = firstBreakpoint(session.frames, breakpoints)
    const cursor = start >= 0 ? start : 0
    if (cursor === 0 && session.history.length === 0) return session
    return { ...session, cursor, history: [], breakpoints }
  }
  if (action === 'back') {
    if (session.history.length === 0) return session
    return { ...session, cursor: session.history.at(-1), history: session.history.slice(0, -1), breakpoints }
  }
  if (action === 'continue') {
    if (session.cursor >= session.frames.length - 1) return session
    let cursor = session.cursor + 1
    while (cursor < session.frames.length && !breakpoints.has(session.frames[cursor].nodeId)) cursor += 1
    if (cursor >= session.frames.length) cursor = session.frames.length - 1
    if (cursor === session.cursor) return session
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
  }
  return { ...session, cursor, history: [...session.history, session.cursor], breakpoints }
}

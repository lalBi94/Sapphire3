import { analyzeProgram } from './analysis.js'
import { analyzeReachability } from './reachability.js'
import { simulateProgram } from './simulation.js'

// Prépare une trace bornée sans mutation source ; l'interface ne restitue que l'arrêt courant.
export function createDebugSession(project, options = {}) {
  const analysis = analyzeProgram(project)
  const reachability = analyzeReachability(project, analysis)
  const result = simulateProgram(project, { ...options, captureDebug: true })
  return { project, frames: result.debugFrames ?? [], cursor: 0, history: [], reachability, errorCode: result.debugFrames?.length ? null : result.errorCode, result }
}

// Avance d'une instruction, termine le scope actif ou restaure exactement le dernier arrêt utilisateur.
export function moveDebugSession(session, action) {
  if (!session || session.frames.length === 0) return session
  if (action === 'restart') {
    return session.cursor === 0 && session.history.length === 0 ? session : { ...session, cursor: 0, history: [] }
  }
  if (action === 'back') {
    if (session.history.length === 0) return session
    return { ...session, cursor: session.history.at(-1), history: session.history.slice(0, -1) }
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
  return { ...session, cursor, history: [...session.history, session.cursor] }
}

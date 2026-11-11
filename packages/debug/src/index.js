/**
 * SDK Debug Sapphire 3.
 *
 * Le SDK expose un débogueur fondé sur une trace enregistrée. Il ne suspend
 * jamais un interpréteur et ne prétend pas fournir un débogage live.
 *
 * @module @sapphire3/debug
 * @typedef {object} DebugState
 * @property {string} sessionId
 * @property {'paused'|'completed'|'error'|'invalid'|'disposed'} status
 * @property {number|null} cursor
 * @property {string|null} nodeId
 * @property {object[]} callStack
 * @property {object[]} scopes
 * @property {object[]} globals
 * @property {object[]} locals
 * @property {object[]} parameters
 * @property {string[]} output
 * @property {object} widgets
 * @property {string} lastStopReason
 */

/** Version du package debug. */
export const DEBUG_VERSION = '0.1.0'

/** Version du contrat public du SDK debug. */
export const DEBUG_API_VERSION = 1

export {
  DEBUG_EVENT_TYPES,
  DEBUG_STOP_REASONS,
  DebugSession,
  createDebugSession,
} from './session.js'
export {
  DEBUG_ERROR_CODES,
  DebugError,
  isDebugError,
} from './errors.js'

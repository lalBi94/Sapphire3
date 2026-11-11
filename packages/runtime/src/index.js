/**
 * SDK Runtime Sapphire 3.
 *
 * @module @sapphire3/runtime
 * @typedef {object} RuntimeRunResult
 * @property {boolean} ok
 * @property {'bounded'|'live'} mode
 * @property {string[]} output
 * @property {number} steps
 * @property {object[]} diagnostics
 * @property {object|null} error
 * @property {object} widgets
 */

/** Version du package runtime. */
export const RUNTIME_VERSION = '0.1.0'

/** Version du contrat public du runtime. */
export const RUNTIME_API_VERSION = 1

export { SapphireRuntime, createRuntime } from './runtime.js'
export { loadProject, loadWorkspace } from './load.js'
export { RUNTIME_ERROR_CODES, RuntimeError, isRuntimeError, toRuntimeError } from './errors.js'

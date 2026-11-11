/**
 * SDK Transpiler Sapphire 3.
 *
 * @module @sapphire3/Transpiler
 * @typedef {object} CompileResult
 * @property {boolean} ok
 * @property {string} target
 * @property {'program'|'module'|'selection'} kind
 * @property {boolean} standalone
 * @property {string} code
 * @property {object[]} diagnostics
 * @property {object|null} metadata
 */

/** Version du package Transpiler. */
export const TRANSPILER_VERSION = '0.1.0'

/** Version du contrat public du Transpiler. */
export const TRANSPILER_API_VERSION = 1

export { compile, compileModule, compileSelection } from './compile.js'
export { getTargetCapabilities, getTargets } from './targets.js'
export { TRANSPILER_ERROR_CODES, TranspilerError, isTranspilerError } from './errors.js'

/**
 * SDK Graph Sapphire 3.
 *
 * Extrait, analyse et exporte les graphes structurels et logiques d'un projet
 * Sapphire sans dépendre de React, du DOM, du canvas ou d'une bibliothèque de
 * rendu graphique.
 *
 * @module @sapphire3/graph
 * @typedef {object} Graph
 * @property {boolean} ok
 * @property {string} kind
 * @property {boolean} directed
 * @property {object[]} nodes
 * @property {object[]} edges
 * @property {object} metadata
 */

/** Version du package graph. */
export const GRAPH_VERSION = '0.1.0'

/** Version du contrat public du SDK graph. */
export const GRAPH_API_VERSION = 1

/** Formats d'export disponibles. */
export const GRAPH_FORMATS = Object.freeze(['json', 'dot', 'mermaid'])

export {
  GRAPH_ERROR_CODES,
  GraphError,
  isGraphError,
  toGraphError,
} from './errors.js'

export { getDependencyGraph } from './dependency.js'
export { getControlFlowGraph } from './cfg.js'
export { getCallGraph, getFlowGraph } from './call.js'
export { getAstGraph } from './ast.js'
export { analyzeGraph } from './analysis.js'
export { exportGraph } from './export.js'
export { assertGraphShape } from './helpers.js'

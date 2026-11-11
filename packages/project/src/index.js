/**
 * SDK Project Sapphire 3.
 *
 * Crée, charge, valide, modifie et exporte des workspaces complets sans
 * dépendre de React, du DOM, de Neutralinojs ou du système de fichiers Node.js.
 *
 * @module @sapphire3/project
 * @typedef {object} WorkspaceMutationResult
 * @property {boolean} ok
 * @property {ProjectWorkspace} workspace
 * @property {string|null} code
 * @property {object[]} diagnostics
 */

/** Version du package project. */
export const PROJECT_VERSION = '0.1.0'

/** Version du contrat public du SDK project. */
export const PROJECT_API_VERSION = 1

export {
  PROJECT_ERROR_CODES,
  ProjectError,
  assertWorkspaceResult,
  isProjectError,
  projectDiagnostic,
  toProjectError,
} from './errors.js'

export {
  PROJECT_FORMAT_VERSION,
  ProjectWorkspace,
  WORKSPACE_VERSION,
  createWorkspace,
  loadProject,
  loadWorkspace,
  serializeProject,
  serializeWorkspace,
  serializeWorkspaceDocument,
  validateProject,
  validateWorkspace,
} from './document.js'

export {
  WORKSPACE_DOCUMENT_NAME,
  buildWorkspaceArchive,
  loadWorkspaceArchive,
  readWorkspaceArchive,
} from './archive.js'

export {
  createMemoryStorage,
  exportWorkspaceArchiveToStorage,
  loadWorkspaceArchiveFromStorage,
  loadWorkspaceBundle,
  loadWorkspaceFromStorage,
  saveWorkspaceBundle,
  saveWorkspaceToStorage,
} from './storage.js'

export { WorkspaceBuilder, createWorkspaceBuilder } from './builder.js'

export {
  binaryOperators,
  createIdFactory,
  diagnosticCodes,
  drafts,
  moduleKinds,
  nodeSchema,
  sourceFormatVersion,
  types,
} from '../../../packages/core/src/index.js'

/** Alias explicite pour un workspace vide. */
export { createWorkspace as createEmptyWorkspace } from './document.js'

/** Alias d'import/export pour les intégrations qui préfèrent ce vocabulaire. */
export { loadWorkspace as parseWorkspace, serializeWorkspace as exportWorkspace } from './document.js'

/**
 * SDK Core Sapphire 3.
 *
 * @module @sapphire3/core
 * @typedef {object} SourceProject
 * @property {1} formatVersion
 * @property {string} id
 * @property {SourceModule[]} modules
 * @property {SourceNode[]} nodes
 *
 * @typedef {object} SourceModule
 * @property {string} id
 * @property {string} name
 * @property {'module'|'class'} kind
 * @property {Array<string|null>} rootNodeIds
 * @property {Array<object>} imports
 * @property {Array<object>} exports
 *
 * @typedef {object} SourceNode
 * @property {string} id
 * @property {string} moduleId
 * @property {string} kind
 * @property {object} properties
 * @property {object} children
 * @property {object} references
 *
 * @typedef {object} Diagnostic
 * @property {string} code
 * @property {'error'|'warning'|'info'} severity
 * @property {string} message
 * @property {object} location
 *
 * @typedef {object} PublicAnalysis
 * @property {boolean} ok
 * @property {boolean} canGenerate
 * @property {Diagnostic[]} diagnostics
 * @property {object} ast
 * @property {object[]} scopes
 * @property {object[]} symbols
 * @property {object[]} references
 * @property {object[]} nodeTypes
 * @property {object[]} genericCalls
 * @property {string[]} untypedNodeIds
 * @property {object[]} classes
 * @property {object[]} classMembers
 */
import * as draftHelpers from './drafts.js'

/** Version du package, indépendante du numéro de version de l'application. */
export const SDK_VERSION = '0.1.0'

/**
 * Version du contrat public. Une rupture de compatibilité incrémente ce
 * numéro et la version majeure du package ; les ajouts restent mineurs.
 */
export const SDK_API_VERSION = 1

export {
  SDK_ERROR_CODES,
  SapphireError,
  assertResult,
  isSapphireError,
} from './errors.js'

export {
  analyze,
  assertValid,
  buildAst,
  diagnosticCodes,
  findAstNode,
  hasBlockingDiagnostics,
  validate,
} from './analysis.js'

export {
  addClass,
  addModule,
  createClass,
  createIdFactory,
  createModule,
  createNode,
  createNodeBundle,
  createProject,
  moduleKinds,
  sourceFormatVersion,
} from './creation.js'

export {
  addClassMember,
  addConstant,
  addConstructor,
  addDeclaration,
  addFunction,
  addImport,
  addMethod,
  addVariable,
  deleteModule,
  deleteNode,
  deleteNodes,
  deleteTargets,
  duplicateNode,
  duplicateTargets,
  ensureImports,
  insertNode,
  insertNodes,
  moveNode,
  moveNodes,
  removeImport,
  renameSymbol,
  reorderNode,
  setExport,
  setNodeContracts,
  updateNode,
} from './mutation.js'

export {
  getModule,
  getModuleInfo,
  getNode,
  getNodeSymbol,
  getNodeType,
  getParent,
  getReferencesTo,
  inspectNode,
  listClassMembers,
  listSymbols,
  summarize,
} from './inspection.js'

export {
  deserializeProject,
  fromJSON,
  serializeProject,
  toJSON,
} from './serialization.js'

export {
  arrayType,
  classType,
  functionType,
  pointerType,
  primitiveType,
  sameType,
  typeFromRecord,
  types,
} from './types.js'

export {
  arrayAccess,
  arrayCreation,
  arrayLiteral,
  assignment,
  binary,
  block,
  call,
  constant,
  constructorDeclaration,
  expressionStatement,
  forStatement,
  functionDeclaration,
  ifStatement,
  importReference,
  lambda,
  literal,
  member,
  methodDeclaration,
  newExpression,
  nodeReference,
  parameter,
  print,
  reference,
  returnStatement,
  thisExpression,
  typeAlias,
  unary,
  variable,
  whileStatement,
} from './drafts.js'

/** Espace pratique regroupant tous les constructeurs de brouillons déclaratifs. */
export const drafts = Object.freeze({ ...draftHelpers })

export {
  binaryOperators,
  contractKinds,
  createContract,
  getNodeSchema,
  isContract,
  nodeSchema,
  normalizeContracts,
  unaryOperators,
} from '../../../src/utils/logic/index.js'

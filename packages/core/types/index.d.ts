/**
 * Public type definitions for @sapphire3/core.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export type PrimitiveName =
  | 'short int'
  | 'short uint'
  | 'int'
  | 'uint'
  | 'float'
  | 'double'
  | 'string'
  | 'char'
  | 'boolean'
  | 'void'

export type ModuleKind = 'module' | 'class'

export type SymbolTarget =
  | { kind: 'name'; name: string }
  | { kind: 'node'; nodeId: string }
  | { kind: 'import'; importId: string }

export type SapphireType =
  | { kind: 'primitive'; name: PrimitiveName }
  | { kind: 'array'; elementType: SapphireType }
  | { kind: 'pointer'; pointee: SapphireType }
  | { kind: 'function'; parameters: SapphireType[]; returnType: SapphireType }
  | { kind: 'class'; classId: string; name?: string }
  | { kind: 'generic'; name: string }
  | { kind: 'named'; target: SymbolTarget }

export interface ModuleImport {
  id: string
  moduleId: string
  nodeId: string
  localName: string
}

export interface ModuleExport {
  nodeId: string
  name: string
}

export interface SourceModule {
  id: string
  name: string
  kind: ModuleKind
  rootNodeIds: Array<string | null>
  imports: ModuleImport[]
  exports: ModuleExport[]
  [key: string]: unknown
}

export interface SourceNode {
  id: string
  moduleId: string
  kind: string
  properties: Record<string, unknown>
  children: Record<string, string | null | Array<string | null>>
  references: Record<string, unknown>
  [key: string]: unknown
}

export interface SourceProject {
  formatVersion: 1
  id: string
  modules: SourceModule[]
  nodes: SourceNode[]
}

export interface DiagnosticLocation {
  projectId: string | null
  moduleId: string | null
  nodeId: string | null
  field: string | null
}

export interface Diagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  location: DiagnosticLocation
}

export interface SymbolInfo {
  id: string
  name: string
  nodeId: string
  moduleId: string
  scopeId: string
  kind: string
  type?: SapphireType
  importedFrom?: string
  importId?: string
  visibility?: 'public' | 'private'
  constructor?: boolean
  [key: string]: unknown
}

export interface ClassMemberInfo {
  name: string
  nodeId: string
  kind: string | null
  type: SapphireType | null
  visibility: 'public' | 'private'
  constructor: boolean
}

export interface ClassMembersInfo {
  classId: string
  public: ClassMemberInfo[]
  private: ClassMemberInfo[]
  constructor: string | null
  constructorVisibility: 'public' | 'private' | null
}

export interface ReferenceInfo {
  nodeId: string
  moduleId: string
  scopeId: string
  field: string
  target: SymbolTarget
  symbolId: string | null
}

export interface NodeTypeEntry {
  nodeId: string
  type: SapphireType
}

export interface GenericCallInfo {
  nodeId: string
  type?: SapphireType
  types: Array<{ name: string; type: SapphireType }>
}

export interface ScopeInfo {
  id: string
  moduleId: string
  ownerNodeId: string | null
  parentId: string | null
  symbolIds: string[]
}

export interface ClassInfo {
  id: string
  name: string
}

export interface PublicAnalysis {
  ok: boolean
  canGenerate: boolean
  diagnostics: Diagnostic[]
  ast: unknown
  scopes: ScopeInfo[]
  symbols: SymbolInfo[]
  references: ReferenceInfo[]
  nodeTypes: NodeTypeEntry[]
  genericCalls: GenericCallInfo[]
  untypedNodeIds: string[]
  classes: ClassInfo[]
  classMembers: ClassMembersInfo[]
}

export interface ValidationResult {
  ok: boolean
  canGenerate: boolean
  diagnostics: Diagnostic[]
}

export interface AstResult {
  ast: unknown
  diagnostics: Diagnostic[]
}

export interface NodeDraft {
  kind: string
  properties?: Record<string, unknown>
  children?: Record<string, unknown>
  references?: Record<string, unknown>
}

export interface NodeBundleResult {
  ok: boolean
  code?: string
  rootId?: string
  nodes?: SourceNode[]
}

export interface ModuleResult {
  ok: boolean
  code?: string
  project: SourceProject
  module?: SourceModule
  analysis?: PublicAnalysis
  diagnostics: Diagnostic[]
}

export interface MutationResult {
  ok: boolean
  code?: string
  project: SourceProject
  diagnostics: Diagnostic[]
  analysis?: PublicAnalysis
  [key: string]: unknown
}

export interface RenameChange {
  kind: string
  moduleId: string
  nodeId: string | null
  field: string
  from: string
  to: string
}

export interface RenameResult extends MutationResult {
  changes: RenameChange[]
  oldName: string
  newName: string
  nodeId: string
  reboundNodeIds?: string[]
}

export interface SerializationResult {
  ok: boolean
  code: string | null
  json: string | null
  diagnostics: Diagnostic[]
}

export interface DeserializationResult {
  ok: boolean
  code: string | null
  project: SourceProject | null
  analysis: PublicAnalysis | null
  diagnostics: Diagnostic[]
}

export interface NodeInspection {
  node: SourceNode
  astNode: unknown
  parent: { kind: 'module' | 'node'; id: string; slot: string } | null
  type: SapphireType | null
  symbol: SymbolInfo | null
  references: ReferenceInfo[]
  referencesTo: ReferenceInfo[]
  analysis: PublicAnalysis
}

export interface ModuleInfo {
  module: SourceModule
  imports: ModuleImport[]
  exports: ModuleExport[]
  symbols: SymbolInfo[]
  functions: SymbolInfo[]
  members: ClassMemberInfo[]
  constructor: ClassMemberInfo | null
  importCandidates: unknown[]
  unusedImportIds: string[]
  analysis: PublicAnalysis
}

export interface ProjectSummary {
  ok: boolean
  canGenerate: boolean
  diagnostics: number
  diagnosticsByCode: Record<string, number>
  modules: Array<{ id: string; name: string; kind: ModuleKind; roots: number; imports: number; exports: number }>
  nodes: number
  symbols: number
  references: number
  classes: number
  untypedNodeIds: number
}

export interface IdFactory {
  (): string
}

export declare const SDK_VERSION: string
export declare const SDK_API_VERSION: number

export declare const SDK_ERROR_CODES: Readonly<{
  invalidArgument: 'SDK_INVALID_ARGUMENT'
  invalidProject: 'SDK_INVALID_PROJECT'
  operationFailed: 'SDK_OPERATION_FAILED'
  programInvalid: 'SDK_PROGRAM_INVALID'
  serializationInvalid: 'SERIALIZATION_INVALID'
}>

export declare const diagnosticCodes: Readonly<Record<string, string>>
export declare const moduleKinds: Readonly<{ module: 'module'; class: 'class' }>
export declare const sourceFormatVersion: 1

export declare class SapphireError extends Error {
  name: 'SapphireError'
  code: string
  diagnostics: Diagnostic[]
  details: unknown
  cause?: unknown
  constructor(code: string, message: string, options?: { diagnostics?: Diagnostic[]; details?: unknown; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; diagnostics: Diagnostic[]; details: unknown }
}

export declare function isSapphireError(value: unknown): value is SapphireError
export declare function assertResult<T extends { ok: boolean }>(result: T, message?: string): T
export declare function assertValid(project: SourceProject, message?: string): PublicAnalysis

export declare function createProject(id?: string): SourceProject
export declare function createModule(id: string, name: string, kind?: ModuleKind): SourceModule
export declare function createClass(id: string, name: string): SourceModule
export declare function createNode(id: string, moduleId: string, kind: string, options?: { properties?: Record<string, unknown>; children?: Record<string, unknown>; references?: Record<string, unknown> }): SourceNode
export declare function createIdFactory(project?: SourceProject | null, prefix?: string): IdFactory
export declare function createNodeBundle(moduleId: string, draft: NodeDraft, idFactory: IdFactory): NodeBundleResult
export declare function addModule(project: SourceProject, config: { id: string; name: string; kind?: ModuleKind }): ModuleResult
export declare function addClass(project: SourceProject, config: { id: string; name: string }): ModuleResult

export declare function analyze(project: SourceProject, options?: { onProgress?: (progress: unknown) => void }): PublicAnalysis
export declare function validate(project: SourceProject, options?: { onProgress?: (progress: unknown) => void }): ValidationResult
export declare function buildAst(project: SourceProject): AstResult
export declare function findAstNode(ast: unknown, sourceId: string): unknown
export declare function hasBlockingDiagnostics(diagnostics: Diagnostic[]): boolean

export declare function insertNodes(project: SourceProject, request: { targetId: unknown; slot?: string }, bundle: NodeBundleResult, options?: Record<string, unknown>): MutationResult
export declare function insertNode(project: SourceProject, request: { targetId: unknown; slot?: string }, bundle: NodeBundleResult, options?: Record<string, unknown>): MutationResult
export declare function updateNode(project: SourceProject, nodeId: string, patch: { properties?: Record<string, unknown>; references?: Record<string, unknown> }): MutationResult
export declare function deleteNodes(project: SourceProject, targetId: unknown, options?: Record<string, unknown>): MutationResult
export declare function deleteNode(project: SourceProject, targetId: unknown, options?: Record<string, unknown>): MutationResult
export declare function deleteModule(project: SourceProject, moduleId: string): MutationResult
export declare function reorderNode(project: SourceProject, nodeId: string, offset: number, options?: Record<string, unknown>): MutationResult
export declare function renameSymbol(project: SourceProject, nodeId: string, newName: string, options?: Record<string, unknown>): RenameResult
export declare function moveNode(project: SourceProject, nodeId: string, receiver: unknown, options?: Record<string, unknown>): MutationResult
export declare function moveNodes(project: SourceProject, nodeIds: string[], receiver: unknown, options?: Record<string, unknown>): MutationResult
export declare function duplicateNode(project: SourceProject, nodeId: string, options?: Record<string, unknown>): MutationResult
export declare function duplicateTargets(project: SourceProject, targets: unknown[], options?: Record<string, unknown>): MutationResult
export declare function deleteTargets(project: SourceProject, targets: unknown[], options?: Record<string, unknown>): MutationResult
export declare function setNodeContracts(project: SourceProject, nodeId: string, contracts: unknown[]): MutationResult
export declare function setExport(project: SourceProject, moduleId: string, nodeId: string, exported?: boolean): MutationResult
export declare function addImport(project: SourceProject, moduleId: string, entry: ModuleImport): MutationResult
export declare function removeImport(project: SourceProject, moduleId: string, importId: string): MutationResult
export declare function ensureImports(project: SourceProject, moduleId: string, sources: unknown[], idFactory?: IdFactory | null): MutationResult
export declare function addDeclaration(project: SourceProject, moduleId: string, draft: NodeDraft, options?: Record<string, unknown>): MutationResult
export declare function addFunction(project: SourceProject, moduleId: string, definition: { name: string; returnType: SapphireType; parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' | null; entryPoint?: boolean }, options?: Record<string, unknown>): MutationResult
export declare function addVariable(project: SourceProject, moduleId: string, definition: { name: string; type: SapphireType; initializer?: NodeDraft | null }, options?: Record<string, unknown>): MutationResult
export declare function addConstant(project: SourceProject, moduleId: string, definition: { name: string; type: SapphireType; initializer: NodeDraft }, options?: Record<string, unknown>): MutationResult
export declare function addClassMember(project: SourceProject, classId: string, draft: NodeDraft, options?: { visibility?: 'public' | 'private'; [key: string]: unknown }): MutationResult
export declare function addMethod(project: SourceProject, classId: string, definition: { name: string; returnType: SapphireType; parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' }, options?: Record<string, unknown>): MutationResult
export declare function addConstructor(project: SourceProject, classId: string, definition?: { parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' }): MutationResult

export declare function getModule(project: SourceProject, moduleId: string): SourceModule | null
export declare function getNode(project: SourceProject, nodeId: string): SourceNode | null
export declare function getNodeType(analysis: PublicAnalysis, nodeId: string): SapphireType | null
export declare function getNodeSymbol(analysis: PublicAnalysis, nodeId: string): SymbolInfo | null
export declare function getReferencesTo(analysis: PublicAnalysis, nodeId: string): ReferenceInfo[]
export declare function getParent(project: SourceProject, nodeId: string): { kind: 'module' | 'node'; id: string; slot: string } | null
export declare function inspectNode(project: SourceProject, nodeId: string): NodeInspection | null
export declare function getModuleInfo(project: SourceProject, moduleId: string): ModuleInfo | null
export declare function listClassMembers(analysis: PublicAnalysis, classId: string): ClassMembersInfo | null
export declare function listSymbols(analysis: PublicAnalysis, moduleId?: string | null): SymbolInfo[]
export declare function summarize(project: SourceProject): ProjectSummary

export declare function serializeProject(project: SourceProject): SerializationResult
export declare function deserializeProject(json: string): DeserializationResult
export declare function toJSON(project: SourceProject): SerializationResult
export declare function fromJSON(json: string): DeserializationResult

export declare function primitiveType(name: PrimitiveName): SapphireType | null
export declare function arrayType(elementType: SapphireType): SapphireType | null
export declare function pointerType(pointee: SapphireType): SapphireType | null
export declare function functionType(parameters: SapphireType[], returnType: SapphireType): SapphireType | null
export declare function classType(classId: string, name?: string): SapphireType | null
export declare function sameType(left: SapphireType | null, right: SapphireType | null): boolean
export declare function typeFromRecord(record: unknown): SapphireType | null

export declare const types: Readonly<{
  shortInt: SapphireType
  shortUint: SapphireType
  int: SapphireType
  uint: SapphireType
  float: SapphireType
  double: SapphireType
  string: SapphireType
  char: SapphireType
  boolean: SapphireType
  void: SapphireType
  pointerTo: typeof pointerType
  arrayOf: typeof arrayType
  functionOf: typeof functionType
  classOf: typeof classType
}>

export declare function literal(type: SapphireType, value: unknown): NodeDraft
export declare function reference(name: string): NodeDraft
export declare function importReference(importId: string): NodeDraft
export declare function nodeReference(nodeId: string): NodeDraft
export declare function parameter(name: string, type: SapphireType): NodeDraft
export declare function variable(name: string, type: SapphireType, initializer?: NodeDraft | null): NodeDraft
export declare function constant(name: string, type: SapphireType, initializer: NodeDraft): NodeDraft
export declare function block(statements?: NodeDraft[]): NodeDraft
export declare function functionDeclaration(definition: { name: string; returnType: SapphireType; parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' | null; entryPoint?: boolean }): NodeDraft
export declare function constructorDeclaration(definition?: { parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' }): NodeDraft
export declare function methodDeclaration(definition: { name: string; returnType: SapphireType; parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body?: NodeDraft[] | NodeDraft; visibility?: 'public' | 'private' }): NodeDraft
export declare function print(value: NodeDraft): NodeDraft
export declare function returnStatement(argument?: NodeDraft | null): NodeDraft
export declare function call(callee: NodeDraft, args?: NodeDraft[]): NodeDraft
export declare function binary(operator: string, left: NodeDraft, right: NodeDraft): NodeDraft
export declare function unary(operator: string, operand: NodeDraft): NodeDraft
export declare function assignment(target: NodeDraft, value: NodeDraft): NodeDraft
export declare function expressionStatement(expression: NodeDraft): NodeDraft
export declare function ifStatement(test: NodeDraft, consequent: NodeDraft | NodeDraft[], alternate?: NodeDraft | NodeDraft[] | null): NodeDraft
export declare function whileStatement(test: NodeDraft, body: NodeDraft | NodeDraft[]): NodeDraft
export declare function forStatement(definition: { initializer?: NodeDraft | null; test?: NodeDraft | null; update?: NodeDraft | null; body: NodeDraft | NodeDraft[] }): NodeDraft
export declare function typeAlias(name: string, type: SapphireType): NodeDraft
export declare function lambda(definition: { returnType: SapphireType; parameters?: Array<{ name: string; type: SapphireType } | NodeDraft>; body: NodeDraft }): NodeDraft
export declare function thisExpression(): NodeDraft
export declare function member(object: NodeDraft, name: string): NodeDraft
export declare function newExpression(classId: string, args?: NodeDraft[]): NodeDraft
export declare function arrayLiteral(elementType: SapphireType, elements?: NodeDraft[]): NodeDraft
export declare function arrayCreation(elementType: SapphireType, size: NodeDraft, initializer?: NodeDraft | null): NodeDraft
export declare function arrayAccess(array: NodeDraft, index: NodeDraft): NodeDraft

export declare const drafts: Readonly<{
  literal: typeof literal
  reference: typeof reference
  importReference: typeof importReference
  nodeReference: typeof nodeReference
  parameter: typeof parameter
  variable: typeof variable
  constant: typeof constant
  block: typeof block
  functionDeclaration: typeof functionDeclaration
  constructorDeclaration: typeof constructorDeclaration
  methodDeclaration: typeof methodDeclaration
  print: typeof print
  returnStatement: typeof returnStatement
  call: typeof call
  binary: typeof binary
  unary: typeof unary
  assignment: typeof assignment
  expressionStatement: typeof expressionStatement
  ifStatement: typeof ifStatement
  whileStatement: typeof whileStatement
  forStatement: typeof forStatement
  typeAlias: typeof typeAlias
  lambda: typeof lambda
  thisExpression: typeof thisExpression
  member: typeof member
  newExpression: typeof newExpression
  arrayLiteral: typeof arrayLiteral
  arrayCreation: typeof arrayCreation
  arrayAccess: typeof arrayAccess
}>

export declare const nodeSchema: Readonly<Record<string, unknown>>
export declare function getNodeSchema(kind: string): unknown
export declare const binaryOperators: Readonly<Record<string, unknown>>
export declare const unaryOperators: Readonly<Record<string, unknown>>
export declare const contractKinds: readonly string[]
export declare function createContract(kind: string, args?: unknown[]): unknown
export declare function isContract(value: unknown): boolean
export declare function normalizeContracts(contracts: unknown[]): unknown[]

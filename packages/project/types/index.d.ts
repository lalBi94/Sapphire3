/**
 * Public type definitions for @sapphire3/project.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export interface TypeRef {
  kind: string
  name?: string
  elementType?: TypeRef
  pointee?: TypeRef
  parameters?: TypeRef[]
  returnType?: TypeRef
  classId?: string
  [key: string]: unknown
}

export interface SourceModule {
  id: string
  name: string
  kind: 'module' | 'class'
  rootNodeIds: Array<string | null>
  imports: Array<Record<string, unknown>>
  exports: Array<Record<string, unknown>>
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

export interface Camera {
  x: number
  y: number
  zoomLevel: number
}

export interface Selection {
  kind: 'module' | 'node'
  id: string
}

export interface PresentationCard {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  expandedNodeIds: string[]
  [key: string]: unknown
}

export interface Presentation {
  cards: PresentationCard[]
  camera: Camera
  selected: Selection | null
  [key: string]: unknown
}

export interface ExerciseManifest {
  version: 1
  title: string
  instructions: string
  tests: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface DashboardConfig {
  name: string
  description: string
  themeId: string
  palette: Record<string, string> | null
  layoutKey: string
  [key: string]: unknown
}

export interface WorkspaceDocument {
  application: 'Sapphire 3'
  workspaceVersion: 3
  project: SourceProject
  presentation: Presentation
  exercise?: ExerciseManifest
  dashboard?: DashboardConfig
  [key: string]: unknown
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
  location?: DiagnosticLocation
  source?: 'structural' | 'semantic'
  object?: { kind: string; id: string | null }
  [key: string]: unknown
}

export interface StructuralValidation {
  ok: boolean
  code: string | null
  message: string | null
  diagnostics: Diagnostic[]
}

export interface SemanticValidation {
  ok: boolean
  canGenerate: boolean
  diagnostics: Diagnostic[]
}

export interface WorkspaceValidation {
  ok: boolean
  structural: StructuralValidation
  semantic: SemanticValidation
  diagnostics: Diagnostic[]
}

export interface ProjectValidation {
  ok: boolean
  canGenerate: boolean
  diagnostics: Diagnostic[]
}

export interface WorkspaceObject {
  kind: string
  id: string | null
}

export interface WorkspaceMutationResult {
  ok: boolean
  workspace: ProjectWorkspace
  code: string | null
  message: string | null
  diagnostics: Diagnostic[]
  object: WorkspaceObject | null
  details?: unknown
  nodeId?: string
  moduleId?: string
  cardId?: string
  promoted?: Array<{ id: string; reference: string }>
}

export interface CreateWorkspaceOptions {
  id?: string
  camera?: Camera
  selected?: Selection | null
  exercise?: ExerciseManifest | null
  dashboard?: DashboardConfig | null
  metadata?: Record<string, unknown>
  presentationMetadata?: Record<string, unknown>
  resources?: Map<string, Uint8Array> | Record<string, Uint8Array>
  extraFiles?: Map<string, Uint8Array> | Record<string, Uint8Array>
}

export interface WorkspaceLoadOptions {
  resources?: Map<string, Uint8Array> | Record<string, Uint8Array>
  extraFiles?: Map<string, Uint8Array> | Record<string, Uint8Array>
}

export interface ModuleDefinition {
  id: string
  name: string
  kind?: 'module' | 'class'
  x?: number
  y?: number
  width?: number
  height?: number
  emoji?: string
  hidden?: boolean
  locked?: boolean
  presentation?: {
    x?: number
    y?: number
    width?: number
    height?: number
    emoji?: string
    hidden?: boolean
    locked?: boolean
  }
  [key: string]: unknown
}

export interface CommentDefinition {
  id: string
  name?: string
  text?: string
  x?: number
  y?: number
  width?: number
  height?: number
  emoji?: string
  hidden?: boolean
  locked?: boolean
}

export interface ImageDefinition {
  id: string
  name?: string
  caption?: string
  image?: string
  imageRef?: string
  bytes?: Uint8Array | ArrayBuffer
  x?: number
  y?: number
  width?: number
  height?: number
  emoji?: string
  hidden?: boolean
  locked?: boolean
}

export interface FunctionDefinition {
  name: string
  returnType: TypeRef
  parameters?: Array<{ name: string; type: TypeRef }>
  body?: unknown[] | Record<string, unknown>
  entryPoint?: boolean
  visibility?: 'public' | 'private'
  [key: string]: unknown
}

export interface VariableDefinition {
  name: string
  type: TypeRef
  initializer?: unknown
}

export interface ConstantDefinition {
  name: string
  type: TypeRef
  initializer: unknown
}

export interface ConstructorDefinition {
  parameters?: Array<{ name: string; type: TypeRef }>
  body?: unknown[]
  visibility?: 'public' | 'private'
}

export interface ImportEntry {
  id?: string
  moduleId?: string
  targetModuleId?: string
  nodeId?: string
  nodeName?: string
  localName?: string
  [key: string]: unknown
}

export interface ArchiveOptions {
  strictImages?: boolean
}

export interface ArchiveReadResult {
  workspace: ProjectWorkspace
  missingImages: string[]
}

export interface StorageAdapter {
  readText(path: string): Promise<string> | string
  writeText(path: string, text: string): Promise<void> | void
  readBinary?(path: string): Promise<Uint8Array | ArrayBuffer> | Uint8Array | ArrayBuffer
  writeBinary?(path: string, bytes: Uint8Array | ArrayBuffer): Promise<void> | void
  exists?(path: string): Promise<boolean> | boolean
  remove?(path: string): Promise<void> | void
}

export interface MemoryStorage extends StorageAdapter {
  files: Map<string, string | Uint8Array>
  readText(path: string): Promise<string>
  writeText(path: string, text: string): Promise<void>
  readBinary(path: string): Promise<Uint8Array>
  writeBinary(path: string, bytes: Uint8Array | ArrayBuffer): Promise<void>
  exists(path: string): Promise<boolean>
  remove(path: string): Promise<void>
}

export interface WorkspaceBundle {
  workspace: ProjectWorkspace
  missingImages: string[]
}

export interface SavedWorkspaceBundle extends WorkspaceBundle {
  path: string
  writtenImages: string[]
  writtenFiles: string[]
}

export declare class ProjectWorkspace {
  constructor(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace, options?: WorkspaceLoadOptions)

  readonly workspaceVersion: 3
  readonly projectId: string | null
  readonly moduleCount: number
  readonly nodeCount: number
  readonly cardCount: number
  readonly project: SourceProject
  readonly presentation: Presentation
  readonly cards: PresentationCard[]
  readonly camera: Camera
  readonly selected: Selection | null
  readonly exercise: ExerciseManifest | null
  readonly dashboard: DashboardConfig | null
  readonly metadata: Record<string, unknown>
  readonly presentationMetadata: Record<string, unknown>

  getModule(moduleId: string): SourceModule | null
  getNode(nodeId: string): SourceNode | null
  getCard(cardId: string): PresentationCard | null
  getNodeId(moduleId: string, name: string): string | null
  getImageResource(reference: string): Uint8Array | null
  listImageResources(): string[]
  getMissingImageReferences(): string[]
  getExtraFile(name: string): Uint8Array | null
  listExtraFiles(): string[]

  toDocument(): WorkspaceDocument
  toJSON(): string
  toProjectJSON(): string
  validate(): WorkspaceValidation
  clone(): ProjectWorkspace

  addModule(definition: ModuleDefinition): WorkspaceMutationResult
  addClass(definition: ModuleDefinition): WorkspaceMutationResult
  removeModule(moduleId: string): WorkspaceMutationResult
  renameModule(moduleId: string, name: string): WorkspaceMutationResult
  moveModule(moduleId: string, position: { x?: number; y?: number; width?: number; height?: number }): WorkspaceMutationResult
  updateCard(cardId: string, patch: Record<string, unknown>): WorkspaceMutationResult
  setCamera(camera: Camera): WorkspaceMutationResult
  setSelected(selected: Selection | null): WorkspaceMutationResult

  addComment(options: CommentDefinition): WorkspaceMutationResult
  addImage(options: ImageDefinition): WorkspaceMutationResult
  removeCard(cardId: string): WorkspaceMutationResult

  addFunction(moduleId: string, definition: FunctionDefinition, options?: Record<string, unknown>): WorkspaceMutationResult
  addMethod(classId: string, definition: FunctionDefinition, options?: Record<string, unknown>): WorkspaceMutationResult
  addConstructor(classId: string, definition?: ConstructorDefinition): WorkspaceMutationResult
  addVariable(moduleId: string, definition: VariableDefinition, options?: Record<string, unknown>): WorkspaceMutationResult
  addConstant(moduleId: string, definition: ConstantDefinition, options?: Record<string, unknown>): WorkspaceMutationResult
  addClassMember(classId: string, draft: unknown, options?: Record<string, unknown>): WorkspaceMutationResult
  addNode(moduleId: string, draft: unknown, options?: Record<string, unknown>): WorkspaceMutationResult
  updateNode(nodeId: string, patch: Record<string, unknown>): WorkspaceMutationResult
  deleteNode(nodeId: string): WorkspaceMutationResult
  moveNode(nodeId: string, receiver: unknown, options?: Record<string, unknown>): WorkspaceMutationResult
  reorderNode(nodeId: string, offset: number, options?: Record<string, unknown>): WorkspaceMutationResult
  renameSymbol(nodeId: string, name: string, options?: Record<string, unknown>): WorkspaceMutationResult

  addImport(moduleId: string, entry: ImportEntry): WorkspaceMutationResult
  removeImport(moduleId: string, importId: string): WorkspaceMutationResult
  ensureImports(moduleId: string, sources: unknown[], idFactory?: (() => string) | null): WorkspaceMutationResult
  setExport(moduleId: string, nodeId: string, exported?: boolean): WorkspaceMutationResult
  setNodeContracts(nodeId: string, contracts: unknown[]): WorkspaceMutationResult

  setExercise(exercise: ExerciseManifest | null): WorkspaceMutationResult
  setDashboard(dashboard: DashboardConfig | null): WorkspaceMutationResult
  setImageResource(reference: string, bytes: Uint8Array | ArrayBuffer): WorkspaceMutationResult
  removeImageResource(reference: string): WorkspaceMutationResult
  setExtraFile(name: string, bytes: Uint8Array | ArrayBuffer): WorkspaceMutationResult
  removeExtraFile(name: string): WorkspaceMutationResult
  promoteEmbeddedImages(): WorkspaceMutationResult
}

export declare class WorkspaceBuilder {
  constructor(options?: CreateWorkspaceOptions)
  readonly workspace: ProjectWorkspace
  readonly diagnostics: Diagnostic[]
  readonly lastNodeId: string | null

  addModule(id: string, options?: Omit<ModuleDefinition, 'id'>): this
  addClass(id: string, options?: Omit<ModuleDefinition, 'id'>): this
  addFunction(moduleId: string, definition: FunctionDefinition, options?: Record<string, unknown>): this
  addVariable(moduleId: string, definition: VariableDefinition, options?: Record<string, unknown>): this
  addConstant(moduleId: string, definition: ConstantDefinition, options?: Record<string, unknown>): this
  addMethod(classId: string, definition: FunctionDefinition, options?: Record<string, unknown>): this
  addConstructor(classId: string, definition?: ConstructorDefinition): this
  addClassMember(classId: string, draft: unknown, options?: Record<string, unknown>): this
  addNode(moduleId: string, draft: unknown, options?: Record<string, unknown>): this
  updateNode(nodeId: string, patch: Record<string, unknown>): this
  deleteNode(nodeId: string): this
  moveNode(nodeId: string, receiver: unknown, options?: Record<string, unknown>): this
  reorderNode(nodeId: string, offset: number, options?: Record<string, unknown>): this
  renameSymbol(nodeId: string, name: string, options?: Record<string, unknown>): this
  setNodeContracts(nodeId: string, contracts: unknown[]): this
  ensureImports(moduleId: string, sources: unknown[], idFactory?: (() => string) | null): this
  addImport(moduleId: string, entry: ImportEntry): this
  setExport(moduleId: string, nodeReference: string, exported?: boolean): this
  addComment(options: CommentDefinition): this
  addImage(options: ImageDefinition): this
  removeCard(cardId: string): this
  removeModule(moduleId: string): this
  renameModule(moduleId: string, name: string): this
  moveModule(moduleId: string, position: { x?: number; y?: number; width?: number; height?: number }): this
  updateCard(cardId: string, patch: Record<string, unknown>): this
  setCamera(camera: Camera): this
  setSelected(selected: Selection | null): this
  setExercise(exercise: ExerciseManifest | null): this
  setDashboard(dashboard: DashboardConfig | null): this
  setImageResource(reference: string, bytes: Uint8Array | ArrayBuffer): this
  removeImageResource(reference: string): this
  setExtraFile(name: string, bytes: Uint8Array | ArrayBuffer): this
  removeExtraFile(name: string): this
  nodeId(moduleId: string, name: string): string | null

  build(options?: { requireValidProgram?: boolean }): {
    ok: boolean
    workspace: ProjectWorkspace
    diagnostics: Diagnostic[]
    validation: WorkspaceValidation
  }
  buildOrThrow(options?: { requireValidProgram?: boolean }): ProjectWorkspace
  toJSON(options?: { requireValidProgram?: boolean }): string
}

export declare const PROJECT_VERSION: string
export declare const PROJECT_API_VERSION: number
export declare const WORKSPACE_VERSION: 3
export declare const PROJECT_FORMAT_VERSION: 1
export declare const WORKSPACE_DOCUMENT_NAME: 'workspace.sp3'

export declare const PROJECT_ERROR_CODES: Readonly<{
  invalidArgument: 'PROJECT_INVALID_ARGUMENT'
  invalidWorkspace: 'PROJECT_WORKSPACE_INVALID'
  invalidProject: 'PROJECT_INVALID_PROJECT'
  moduleNotFound: 'PROJECT_MODULE_NOT_FOUND'
  nodeNotFound: 'PROJECT_NODE_NOT_FOUND'
  cardNotFound: 'PROJECT_CARD_NOT_FOUND'
  duplicateId: 'PROJECT_DUPLICATE_ID'
  mutationFailed: 'PROJECT_MUTATION_FAILED'
  semanticInvalid: 'PROJECT_PROGRAM_INVALID'
  serializationInvalid: 'PROJECT_SERIALIZATION_INVALID'
  imageMissing: 'PROJECT_IMAGE_MISSING'
  imageInvalid: 'PROJECT_IMAGE_INVALID'
  archiveInvalid: 'PROJECT_ARCHIVE_INVALID'
  archiveUnsafeEntry: 'PROJECT_ARCHIVE_UNSAFE_ENTRY'
  storageMissing: 'PROJECT_STORAGE_MISSING'
  storageUnavailable: 'PROJECT_STORAGE_UNAVAILABLE'
  unsupportedInput: 'PROJECT_UNSUPPORTED_INPUT'
}>

export declare class ProjectError extends Error {
  name: 'ProjectError'
  code: string
  diagnostics: Diagnostic[]
  details: unknown
  object: WorkspaceObject | null
  cause?: unknown
  constructor(code: string, message: string, options?: { diagnostics?: Diagnostic[]; details?: unknown; object?: WorkspaceObject | null; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; diagnostics: Diagnostic[]; details: unknown; object: WorkspaceObject | null }
}

export declare function isProjectError(value: unknown): value is ProjectError
export declare function toProjectError(error: unknown, fallbackCode?: string, options?: { object?: WorkspaceObject | null }): ProjectError
export declare function assertWorkspaceResult(result: WorkspaceMutationResult, message?: string): WorkspaceMutationResult
export declare function projectDiagnostic(code: string, message: string, options?: Record<string, unknown>): Diagnostic

export declare function createWorkspace(options?: CreateWorkspaceOptions): ProjectWorkspace
export declare function createEmptyWorkspace(options?: CreateWorkspaceOptions): ProjectWorkspace
export declare function loadWorkspace(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace, options?: WorkspaceLoadOptions): ProjectWorkspace
export declare function parseWorkspace(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace, options?: WorkspaceLoadOptions): ProjectWorkspace
export declare function loadProject(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace): SourceProject
export declare function serializeWorkspace(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace): string
export declare function exportWorkspace(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace): string
export declare function serializeProject(input: SourceProject | WorkspaceDocument | ProjectWorkspace | string | Uint8Array | ArrayBuffer): string
export declare function serializeWorkspaceDocument(document: WorkspaceDocument | ProjectWorkspace): string
export declare function validateWorkspace(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace): WorkspaceValidation
export declare function validateProject(project: SourceProject): ProjectValidation

export declare function buildWorkspaceArchive(input: string | Uint8Array | ArrayBuffer | SourceProject | WorkspaceDocument | ProjectWorkspace, options?: ArchiveOptions): Uint8Array
export declare function readWorkspaceArchive(bytes: Uint8Array | ArrayBuffer, options?: ArchiveOptions): ArchiveReadResult
export declare function loadWorkspaceArchive(bytes: Uint8Array | ArrayBuffer, options?: ArchiveOptions): ProjectWorkspace

export declare function createMemoryStorage(initial?: Record<string, string | Uint8Array | ArrayBuffer> | Map<string, string | Uint8Array | ArrayBuffer>): MemoryStorage
export declare function loadWorkspaceFromStorage(adapter: StorageAdapter, options?: { path?: string }): Promise<ProjectWorkspace>
export declare function saveWorkspaceToStorage(adapter: StorageAdapter, input: ProjectWorkspace | WorkspaceDocument | SourceProject | string | Uint8Array | ArrayBuffer, options?: { path?: string }): Promise<{ path: string; workspace: ProjectWorkspace }>
export declare function loadWorkspaceBundle(adapter: StorageAdapter, options?: { documentPath?: string; strictImages?: boolean }): Promise<WorkspaceBundle>
export declare function saveWorkspaceBundle(adapter: StorageAdapter, input: ProjectWorkspace | WorkspaceDocument | SourceProject | string | Uint8Array | ArrayBuffer, options?: { documentPath?: string; promoteEmbeddedImages?: boolean; strictImages?: boolean }): Promise<SavedWorkspaceBundle>
export declare function exportWorkspaceArchiveToStorage(adapter: StorageAdapter, input: ProjectWorkspace | WorkspaceDocument | SourceProject | string | Uint8Array | ArrayBuffer, options?: ArchiveOptions & { path?: string }): Promise<{ path: string; bytes: Uint8Array }>
export declare function loadWorkspaceArchiveFromStorage(adapter: StorageAdapter, options?: ArchiveOptions & { path?: string }): Promise<ArchiveReadResult>

export declare const drafts: Record<string, (...args: any[]) => unknown>
export declare const types: {
  shortInt: TypeRef
  shortUint: TypeRef
  int: TypeRef
  uint: TypeRef
  float: TypeRef
  double: TypeRef
  string: TypeRef
  char: TypeRef
  boolean: TypeRef
  void: TypeRef
  pointerTo: (pointee: TypeRef) => TypeRef
  arrayOf: (elementType: TypeRef) => TypeRef
  functionOf: (parameters: TypeRef[], returnType: TypeRef) => TypeRef
  classOf: (classId: string, name?: string) => TypeRef
}
export declare const moduleKinds: Readonly<{ module: 'module'; class: 'class' }>
export declare const sourceFormatVersion: 1
export declare function createIdFactory(project?: SourceProject | null, prefix?: string): () => string
export declare const binaryOperators: readonly string[]
export declare const diagnosticCodes: Readonly<Record<string, string>>
export declare const nodeSchema: Readonly<Record<string, unknown>>

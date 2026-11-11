/**
 * Public type definitions for @sapphire3/Transpiler.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export type TargetId = 'javascript' | 'python' | 'c' | 'cpp' | 'java' | string
export type CompileKind = 'program' | 'module' | 'selection'
export type TargetStatus = 'stable' | 'experimental' | 'unavailable'

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
  nodeId: string | null
  moduleId: string | null
  field: string | null
}

export interface TargetCapabilities {
  primitives: boolean
  strings: boolean
  chars: boolean
  variables: boolean
  functions: boolean
  controlFlow: boolean
  print: boolean
  arrays: boolean
  pointers: boolean
  functionReferences: boolean | 'named'
  lambdas: boolean | 'nonCapturing'
  closures: boolean
  forEach: boolean
  classes: boolean
  generics: boolean
  nativeMath: boolean | 'partial'
  explicitCasts: boolean
  contracts: boolean
  widgets: boolean
  traceability: boolean
  standalone: boolean
}

export interface TargetDescriptor {
  id: TargetId
  name: string
  extension: string
  installed: boolean
  available: boolean
  status: TargetStatus
  operational: boolean
  experimental: boolean
  capabilities: TargetCapabilities
  [key: string]: unknown
}

export interface Selection {
  kind: 'node' | 'module'
  id: string
}

export interface CompileOptions {
  target?: TargetId
  onProgress?: (progress: unknown) => void
  [key: string]: unknown
}

export interface CompilationFragment {
  id: string
  kind: string
  sourceId: string | null
  start: number
  end: number
}

export interface GeneratedDeclaration {
  nodeId: string
  moduleId: string
  kind: string
  name: string | null
  generatedName: string
  classId?: string
  className?: string | null
}

export interface GeneratedClass {
  classId: string
  generatedName: string
}

export interface EntryPointMetadata {
  nodeId: string
  generatedName: string
}

export interface HelperMetadata {
  embedded: boolean
  standalone: boolean
  external: string[]
  compileFlags: string[]
}

export interface CompileMetadata {
  mode: CompileKind
  target: TargetId
  standalone: boolean
  codeLength: number
  fragments: CompilationFragment[]
  declarations: GeneratedDeclaration[]
  classes: GeneratedClass[]
  entryPoint: EntryPointMetadata | null
  helpers: HelperMetadata
  targetStatus: TargetStatus
  operational: boolean
  experimental: boolean
  capabilities: TargetCapabilities | null
  selection?: Selection
  expandedTo?: Selection
}

export interface CompileResult {
  ok: boolean
  target: TargetId
  kind: CompileKind
  standalone: boolean
  code: string
  diagnostics: Diagnostic[]
  metadata: CompileMetadata | null
}

export declare const TRANSPILER_VERSION: string
export declare const TRANSPILER_API_VERSION: number

export declare const TRANSPILER_ERROR_CODES: Readonly<{
  invalidArgument: 'TRANSPILER_INVALID_ARGUMENT'
  invalidProject: 'TRANSPILER_INVALID_PROJECT'
  internal: 'TRANSPILER_INTERNAL'
}>

export declare class TranspilerError extends Error {
  name: 'TranspilerError'
  code: string
  details: unknown
  cause?: unknown
  constructor(code: string, message: string, options?: { details?: unknown; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; details: unknown }
}

export declare function isTranspilerError(value: unknown): value is TranspilerError
export declare function compile(project: SourceProject, options?: CompileOptions): CompileResult
export declare function compileModule(project: SourceProject, moduleId: string, options?: CompileOptions): CompileResult
export declare function compileSelection(project: SourceProject, selection: Selection | string, options?: CompileOptions): CompileResult
export declare function getTargets(): TargetDescriptor[]
export declare function getTargetCapabilities(target: string): TargetDescriptor | null

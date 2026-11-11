/**
 * Public type definitions for @sapphire3/runtime.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export type ModuleKind = 'module' | 'class'

export interface SourceModule {
  id: string
  name: string
  kind: ModuleKind
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

export interface WorkspaceLike {
  application?: string
  workspaceVersion?: number
  project: SourceProject
  [key: string]: unknown
}

export interface TextSource {
  text(): Promise<string>
}

export type RuntimeInput =
  | SourceProject
  | WorkspaceLike
  | string
  | Uint8Array
  | ArrayBuffer
  | TextSource

export type SyncRuntimeInput =
  | SourceProject
  | WorkspaceLike
  | string
  | Uint8Array
  | ArrayBuffer

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

export interface RuntimeSymbol {
  id: string
  name: string
  nodeId: string
  moduleId: string
  scopeId: string
  kind: string
  type?: unknown
  importedFrom?: string
  importId?: string
  [key: string]: unknown
}

export interface RuntimeNodeType {
  nodeId: string
  type: unknown
}

export interface RuntimeClassInfo {
  id: string
  name: string
}

export interface RuntimeAnalysis {
  canGenerate: boolean
  diagnostics: Diagnostic[]
  symbols: RuntimeSymbol[]
  nodeTypes: RuntimeNodeType[]
  classes: RuntimeClassInfo[]
}

export interface LoadedProject {
  project: SourceProject
  analysis: RuntimeAnalysis
  diagnostics: Diagnostic[]
  canGenerate: boolean
}

export interface RuntimeContracts {
  total: number
  observations: number
  violations: unknown[]
  active?: unknown[]
}

export interface RuntimeWidgets {
  screens: Record<string, unknown>
  gauges: Record<string, unknown>
  leds: Record<string, unknown>
  rgbLeds: Record<string, unknown>
  progresses: Record<string, unknown>
  barCharts: Record<string, unknown>
  xyPlots: Record<string, unknown>
  oscilloscopes: Record<string, unknown>
  heatmaps: Record<string, unknown>
}

export interface RuntimeFrameSeries {
  screens: unknown[]
  gauges: unknown[]
  leds: unknown[]
  rgbLeds: unknown[]
  progresses: unknown[]
  barCharts: unknown[]
  xyPlots: unknown[]
  oscilloscopes: unknown[]
  heatmaps: unknown[]
}

export interface RuntimeFrame extends RuntimeWidgets {
  steps: number
  currentNodeId: string | null
  output: string[]
  contracts: RuntimeContracts
  done?: boolean
  error?: { code: string; message: string }
  returnValue?: string | null
}

export type PublicReturnValue = string | number | boolean | Array<string | number | boolean | null> | null

export interface BoundedResult extends RuntimeWidgets {
  ok: boolean
  mode: 'bounded'
  functionId: string | null
  output: string[]
  outputSteps: number[]
  trace: string[]
  steps: number
  result: PublicReturnValue
  returnValue: string | null
  diagnostics: Diagnostic[]
  errorCode: string | null
  error: RuntimeError | null
  variables: unknown[]
  contracts: RuntimeContracts
  widgets: RuntimeWidgets
  frames: RuntimeFrameSeries
}

export interface LiveResult extends RuntimeWidgets {
  ok: boolean
  mode: 'live'
  stopped: boolean
  output: string[]
  steps: number
  currentNodeId: string | null
  result: PublicReturnValue
  returnValue: string | null
  diagnostics: Diagnostic[]
  errorCode: string | null
  error: RuntimeError | null
  contracts: RuntimeContracts
  widgets: RuntimeWidgets
  frames: RuntimeFrame[]
  state: RuntimeFrame | null
}

export type RuntimeResult = BoundedResult | LiveResult

export interface RuntimeStatusEvent {
  status: 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'done' | 'error' | 'disposed'
  mode?: 'bounded' | 'live'
  result?: RuntimeResult
  error?: RuntimeError
}

export interface RuntimeOutputEvent {
  lines: string[]
  output: string[]
}

export interface RuntimeProgress {
  phase: string
  step?: string
  current: number
  total: number
}

export interface RuntimeEvent {
  nodeId: string
  value: unknown
}

export interface RuntimeOptions {
  maxSteps?: number
  sliceSteps?: number
  inputs?: Record<string, unknown>
  isolation?: 'inline' | 'worker'
  workerFactory?: () => WorkerLike
}

export interface RunOptions {
  maxSteps?: number
  inputs?: Record<string, unknown>
  signal?: AbortSignal
}

export interface LiveOptions {
  sliceSteps?: number
  inputs?: Record<string, unknown>
  signal?: AbortSignal
  captureFrames?: boolean
  maxFrames?: number
}

export type FunctionRef = string | { id: string } | { name: string; moduleId?: string }

export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: { message?: string }) => void) | null
}

export declare const RUNTIME_VERSION: string
export declare const RUNTIME_API_VERSION: number

export declare const RUNTIME_ERROR_CODES: Readonly<{
  disposed: 'RUNTIME_DISPOSED'
  busy: 'RUNTIME_BUSY'
  invalidArgument: 'RUNTIME_INVALID_ARGUMENT'
  invalidProject: 'RUNTIME_INVALID_PROJECT'
  invalidBudget: 'RUNTIME_BUDGET_INVALID'
  functionNotFound: 'RUNTIME_FUNCTION_NOT_FOUND'
  functionAmbiguous: 'RUNTIME_FUNCTION_AMBIGUOUS'
  functionUnsupported: 'RUNTIME_FUNCTION_UNSUPPORTED'
  notLive: 'RUNTIME_NOT_LIVE'
  liveActive: 'RUNTIME_LIVE_ACTIVE'
  cancelled: 'RUNTIME_CANCELLED'
  workerUnavailable: 'RUNTIME_WORKER_UNAVAILABLE'
  workerFailed: 'RUNTIME_WORKER_FAILED'
  workspaceInvalid: 'RUNTIME_WORKSPACE_INVALID'
  executionFailed: 'RUNTIME_EXECUTION_FAILED'
}>

export declare class RuntimeError extends Error {
  name: 'RuntimeError'
  code: string
  diagnostics: Diagnostic[]
  details: unknown
  cause?: unknown
  constructor(code: string, message: string, options?: { diagnostics?: Diagnostic[]; details?: unknown; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; diagnostics: Diagnostic[]; details: unknown }
}

export declare function isRuntimeError(value: unknown): value is RuntimeError
export declare function toRuntimeError(error: unknown, fallbackCode?: string): RuntimeError

export declare class SapphireRuntime {
  readonly project: SourceProject
  readonly analysis: RuntimeAnalysis
  readonly diagnostics: Diagnostic[]
  readonly canRun: boolean
  readonly status: RuntimeStatusEvent['status']
  readonly state: RuntimeFrame | null
  on(event: 'status', handler: (event: RuntimeStatusEvent) => void): () => void
  on(event: 'frame', handler: (frame: RuntimeFrame) => void): () => void
  on(event: 'output', handler: (event: RuntimeOutputEvent) => void): () => void
  on(event: 'progress', handler: (event: RuntimeProgress) => void): () => void
  on(event: 'error', handler: (error: RuntimeError) => void): () => void
  on(event: 'done', handler: (result: RuntimeResult) => void): () => void
  on(event: string, handler: (payload: unknown) => void): () => void
  off(event: string, handler: (payload: unknown) => void): boolean
  run(options?: RunOptions): Promise<BoundedResult>
  runFunction(functionRef: FunctionRef, args?: unknown[], options?: RunOptions): Promise<BoundedResult>
  startLive(options?: LiveOptions): Promise<LiveResult>
  pause(): boolean
  resume(): boolean
  stop(): boolean
  sendInputs(inputs: Record<string, unknown>): void
  sendEvents(events: RuntimeEvent[]): void
  dispose(): void
}

export declare function createRuntime(projectInput: SyncRuntimeInput, options?: RuntimeOptions): SapphireRuntime
export declare function loadProject(input: RuntimeInput): Promise<LoadedProject>
export declare function loadWorkspace(input: RuntimeInput): Promise<LoadedProject>

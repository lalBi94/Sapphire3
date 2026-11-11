/**
 * Public type definitions for @sapphire3/debug.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export type DebugStatus = 'paused' | 'completed' | 'error' | 'invalid' | 'disposed'
export type DebugStopReason =
  | 'initial'
  | 'step-into'
  | 'step-next'
  | 'step-out'
  | 'step-out-scope'
  | 'continue'
  | 'step-back'
  | 'restart'
  | 'breakpoint'
  | 'end'
  | 'error'
export type DebugEventType =
  | 'created'
  | 'position'
  | 'stop'
  | 'breakpoint'
  | 'resume'
  | 'error'
  | 'finished'
  | 'restart'
  | 'breakpoints'
  | 'disposed'

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
  [key: string]: unknown
}

export interface ArrayPreview {
  length: number
  cells: Array<string | number | boolean>
}

export interface PointerPreview {
  kind: 'reference' | 'element' | 'unknown'
  nodeId?: string | null
  instanceId?: number | null
  arrayNodeId?: string | null
  arrayInstanceId?: number | null
  index?: number
  length?: number | null
  label: string
  constant?: boolean
}

export interface VariableBinding {
  nodeId: string
  moduleId: string
  name: string
  type: unknown
  initialized: boolean
  value?: string | number | boolean
  array?: ArrayPreview
  pointer?: PointerPreview
}

export interface LocalVariable extends VariableBinding {
  kind: string | null
  scopeId: string
  instanceId: number
  scopeKind: string
  callableNodeId: string | null
}

export interface CallStackEntry {
  depth: number
  instanceId: number
  scopeId: string
  nodeId: string
  kind: string
  name: string
  moduleId: string | null
  moduleName: string | null
  classId: string | null
  className: string | null
  isLambda: boolean
  entryPoint: boolean
}

export interface ScopeEntry {
  instanceId: number
  nodeId: string
  scopeId: string
  kind: string
  nodeKind: string | null
  name: string
  moduleId: string | null
  callableNodeId: string | null
  variables: VariableBinding[]
}

export interface NodeDescriptor {
  id: string
  kind: string
  moduleId: string
  name: string | null
  type: unknown
  entryPoint: boolean
  constructor: boolean
  visibility: string | null
}

export interface ModuleDescriptor {
  id: string
  name: string
  kind: 'module' | 'class'
}

export interface ClassDescriptor {
  id: string
  name: string
}

export interface WidgetStates {
  gauges: Record<string, unknown>
  leds: Record<string, unknown>
  rgbLeds: Record<string, unknown>
  progresses: Record<string, unknown>
  barCharts: Record<string, unknown>
  xyPlots: Record<string, unknown>
  oscilloscopes: Record<string, unknown>
  heatmaps: Record<string, unknown>
}

export interface WidgetStatesWithScreens extends WidgetStates {
  screens: Record<string, unknown> | null
}

export interface ReachabilitySummary {
  ok: boolean
  reachableCount: number
  unreachableCount: number
  functionCount: number
}

export interface ReachabilityResult {
  ok: boolean
  reachableNodeIds: string[]
  unreachableNodeIds: string[]
  functions: Array<{ nodeId: string; reachable: boolean }>
}

export interface DebugState {
  sessionId: string
  disposed: boolean
  status: DebugStatus
  cursor: number | null
  frameCount: number
  nodeId: string | null
  currentNode: NodeDescriptor | null
  currentModule: ModuleDescriptor | null
  currentClass: ClassDescriptor | null
  currentFunction: CallStackEntry | null
  callStack: CallStackEntry[]
  scopes: ScopeEntry[]
  globals: VariableBinding[]
  locals: LocalVariable[]
  parameters: LocalVariable[]
  output: string[]
  widgets: WidgetStates
  screens: null
  hasScreens: boolean
  instructionCount: number
  navigationHistory: number[]
  breakpoints: string[]
  diagnostics: Diagnostic[]
  reachability: ReachabilitySummary
  lastStopReason: DebugStopReason | 'disposed'
  errorCode: string | null
  error: string | null
  terminal: boolean
  canStepBack: boolean
  canStepInto: boolean
  canStepNext: boolean
  canStepOut: boolean
  canStepOutScope: boolean
  canContinue: boolean
  canRestart: boolean
  createdAt: string
}

export interface DebugEvent {
  type: DebugEventType
  sessionId: string
  sequence: number
  timestamp: number
  reason?: string
  previousCursor?: number | null
  cursor?: number | null
  nodeId?: string | null
  status?: DebugStatus
  terminal?: boolean
  errorCode?: string | null
  message?: string
  diagnostics?: Diagnostic[]
  breakpoints?: string[]
  source?: string
  action?: string
  from?: number | null
  to?: number | null
  ok?: boolean
  outputLength?: number
  frameCount?: number
  diagnosticCount?: number
  traceErrorCode?: string | null
  [key: string]: unknown
}

export interface DebugSessionOptions {
  maxSteps?: number
  breakpoints?: string[] | Set<string>
  functionId?: string
  args?: unknown[]
  inputs?: Record<string, unknown>
  onProgress?: (progress: unknown) => void
  onEvent?: (event: DebugEvent) => void
}

export interface InstructionHistoryOptions {
  from?: number
  limit?: number
}

export interface InstructionHistoryEntry {
  ordinal: number
  frameIndex: number
  nodeId: string
  status: 'paused' | 'completed' | 'error'
  errorCode: string | null
  moduleId: string | null
  moduleName: string | null
  functionNodeId: string | null
  functionName: string | null
}

export interface InstructionHistory {
  total: number
  from: number
  limit: number
  entries: InstructionHistoryEntry[]
}

export interface TraceExportOptions {
  from?: number
  to?: number
  maxFrames?: number
  maxOutputEntries?: number
  includeVariables?: boolean
  includeOutput?: boolean
  includeWidgets?: boolean
  includeScreens?: boolean
  includeReachability?: boolean
  includeDiagnostics?: boolean
  includeProject?: boolean
}

export interface TraceFrame {
  index: number
  nodeId: string | null
  status: 'paused' | 'completed' | 'error'
  errorCode: string | null
  moduleId: string | null
  moduleName: string | null
  callStack: CallStackEntry[]
  scopeIds: number[]
  globals?: VariableBinding[]
  localScopes?: Array<{
    instanceId: number
    nodeId: string
    scopeId: string
    variables: VariableBinding[]
  }>
  output?: string[]
  outputTruncated?: boolean
  widgets?: WidgetStates
  screens?: Record<string, unknown>
}

export interface TraceExportSummary {
  frameCount: number
  from: number
  to: number
  exportedFrames: number
  cursor: number | null
  status: DebugStatus
  lastStopReason: DebugStopReason | 'disposed'
  errorCode: string | null
  traceErrorCode: string | null
  breakpoints: string[]
  outputLength: number
  truncated: boolean
  maxFrames: number
  maxOutputEntries: number
  includes: {
    variables: boolean
    output: boolean
    widgets: boolean
    screens: boolean
    reachability: boolean
    diagnostics: boolean
    project: boolean
  }
}

export interface TraceExport {
  format: 'sapphire3-debug-trace'
  version: 1
  sessionId: string
  createdAt: string
  exportedAt: string
  source: {
    projectId: string | null
    formatVersion: number | null
  }
  summary: TraceExportSummary
  frames: TraceFrame[]
  project: SourceProject | null
  reachability: ReachabilityResult | null
  diagnostics: Diagnostic[] | null
}

export declare const DEBUG_VERSION: string
export declare const DEBUG_API_VERSION: number
export declare const DEBUG_EVENT_TYPES: Readonly<DebugEventType[]>
export declare const DEBUG_STOP_REASONS: Readonly<{
  initial: 'initial'
  stepInto: 'step-into'
  stepNext: 'step-next'
  stepOut: 'step-out'
  stepOutScope: 'step-out-scope'
  continue: 'continue'
  stepBack: 'step-back'
  restart: 'restart'
  breakpoint: 'breakpoint'
  end: 'end'
  error: 'error'
}>

export declare const DEBUG_ERROR_CODES: Readonly<{
  disposed: 'DEBUG_DISPOSED'
  invalidArgument: 'DEBUG_INVALID_ARGUMENT'
  invalidProject: 'DEBUG_INVALID_PROJECT'
  unknownNode: 'DEBUG_UNKNOWN_NODE'
  invalidIndex: 'DEBUG_INVALID_INDEX'
  internal: 'DEBUG_INTERNAL'
}>

export declare class DebugError extends Error {
  name: 'DebugError'
  code: string
  details: unknown
  cause?: unknown
  constructor(code: string, message: string, options?: { details?: unknown; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; details: unknown }
}

export declare function isDebugError(value: unknown): value is DebugError

export declare class DebugSession {
  readonly id: string
  readonly sessionId: string
  readonly disposed: boolean
  readonly frameCount: number
  readonly cursor: number | null
  readonly status: DebugStatus
  readonly lastStopReason: DebugStopReason | 'disposed'
  readonly breakpoints: string[]
  readonly errorCode: string | null
  readonly error: string | null
  readonly terminal: boolean
  readonly canStepBack: boolean
  readonly canStepInto: boolean
  readonly canStepNext: boolean
  readonly canStepOut: boolean
  readonly canStepOutScope: boolean
  readonly canContinue: boolean
  readonly canRestart: boolean

  constructor(project: SourceProject, options?: DebugSessionOptions)

  state(): DebugState
  stepInto(): DebugState
  stepNext(): DebugState
  stepOut(): DebugState
  stepOutScope(): DebugState
  continue(): DebugState
  stepBack(): DebugState
  restart(): DebugState

  setBreakpoints(value: string[] | Set<string>): string[]
  addBreakpoint(nodeId: string): string[]
  removeBreakpoint(nodeId: string): string[]
  clearBreakpoints(): string[]
  getBreakpoints(): string[]

  getFrame(index?: number | null): unknown | null
  getScreens(index?: number | null): Record<string, unknown>
  getWidgets(options?: { screens?: boolean; index?: number }): WidgetStatesWithScreens
  getInstructionHistory(options?: InstructionHistoryOptions): InstructionHistory
  getProject(): SourceProject
  getReachability(): ReachabilityResult
  getDiagnostics(): Diagnostic[]
  exportTrace(options?: TraceExportOptions): TraceExport

  on(type: DebugEventType | '*', listener: (event: DebugEvent) => void): () => void
  off(type: DebugEventType | '*', listener: (event: DebugEvent) => void): boolean
  listenerCount(type?: DebugEventType | '*'): number
  dispose(): void
}

export declare function createDebugSession(project: SourceProject, options?: DebugSessionOptions): DebugSession

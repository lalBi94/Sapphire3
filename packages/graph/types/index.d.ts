/**
 * Public type definitions for @sapphire3/graph.
 * The runtime is JavaScript ESM; these declarations describe the stable SDK
 * surface without migrating the application to TypeScript.
 */

export type GraphFormat = 'json' | 'dot' | 'graphviz' | 'mermaid' | 'mmd' | string
export type GraphKind = 'dependency' | 'control-flow' | 'call' | 'ast' | 'flow' | string
export type GraphDirection = 'out' | 'in' | 'both'
export type GraphAlgorithm = 'dfs' | 'bfs'

export interface SourceProject {
  formatVersion: 1
  id: string
  modules: Array<Record<string, unknown>>
  nodes: Array<Record<string, unknown>>
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
  [key: string]: unknown
}

export interface GraphNode {
  id: string
  sourceId?: string | null
  kind: string
  entity?: string
  name?: string | null
  label?: string
  moduleId?: string | null
  moduleName?: string | null
  classId?: string | null
  className?: string | null
  type?: unknown
  declaredType?: unknown
  visibility?: 'public' | 'private' | null
  entryPoint?: boolean
  isConstructor?: boolean
  parameter?: boolean
  callable?: boolean
  reachable?: boolean | null
  external?: boolean
  recursive?: boolean
  moduleLevel?: boolean
  resolution?: 'direct' | 'indirect' | 'unresolved'
  reason?: string | null
  targetNodeId?: string | null
  targetSymbolId?: string | null
  targetType?: unknown
  callNodeId?: string | null
  sourceKind?: string
  invalid?: boolean
  layout?: { x?: number; y?: number; path?: string; midX?: number; midY?: number }
  [key: string]: unknown
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  kind: string
  label?: string
  count?: number
  callNodeIds?: string[]
  referenceNodeIds?: string[]
  callKinds?: string[]
  importedFrom?: string | null
  targetSymbolId?: string | null
  exports?: Array<Record<string, unknown>>
  fromId?: string
  toId?: string
  layout?: { path?: string; midX?: number; midY?: number }
  [key: string]: unknown
}

export interface GraphMetadata {
  kind: GraphKind
  projectId: string | null
  rootId: string | null
  rootKind: string | null
  scope: string | null
  incomplete: boolean
  nodeCount: number
  edgeCount: number
  diagnostics: Diagnostic[]
  unresolvedNodeIds: string[]
  [key: string]: unknown
}

export interface Graph {
  ok: boolean
  kind: GraphKind
  directed: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: GraphMetadata
}

export interface DependencyGraphOptions {
  scope?: 'project' | 'module' | 'node' | 'target'
  target?: string | { kind: 'module' | 'node'; id: string }
  id?: string
  includeParameters?: boolean
  includeLambdas?: boolean
  includeImports?: boolean
  includeExports?: boolean
  includeModuleLinks?: boolean
  includeCalls?: boolean
  includeReferences?: boolean
  includeUnresolved?: boolean
}

export interface ControlFlowGraphOptions {
  target?: string | { kind: 'module' | 'node'; id: string }
  includeUnreachable?: boolean
}

export interface CallGraphOptions {
  includeModuleLevel?: boolean
  includeUnresolved?: boolean
}

export interface AstGraphOptions {
  includeProject?: boolean
  includeModules?: boolean
  includeReferences?: boolean
  includeImportsExports?: boolean
  includeInvalid?: boolean
  includeUnresolved?: boolean
  maxNodes?: number
}

export interface FlowGraphOptions {
  [key: string]: unknown
}

export interface GraphAnalysisOptions {
  from?: string
  to?: string
  algorithm?: GraphAlgorithm
  direction?: GraphDirection
  edgeKinds?: string[]
  maxDepth?: number
  maxPaths?: number
  allTransitive?: boolean
}

export interface GraphTraversal {
  algorithm: GraphAlgorithm
  from: string
  direction: GraphDirection
  maxDepth: number
  order: string[]
  depth: Record<string, number>
}

export interface GraphAnalysis {
  ok: boolean
  code?: string
  message?: string
  directed?: boolean
  nodeCount?: number
  edgeCount?: number
  filteredEdgeCount?: number
  ignoredEdgeCount?: number
  algorithm?: GraphAlgorithm
  direction?: GraphDirection
  edgeKinds?: string[] | null
  from?: string | null
  to?: string | null
  traversal?: GraphTraversal | null
  reachableFrom?: string[]
  directDependencies?: string[]
  reverseDependencies?: string[]
  transitiveDependencies?: Record<string, string[]> | null
  paths?: string[][] | null
  pathsTruncated?: boolean
  acyclic?: boolean
  hasCycles?: boolean
  cycles?: string[][]
  stronglyConnectedComponents?: string[][]
  topologicalOrder?: string[] | null
  incomplete?: boolean
  unresolvedNodeIds?: string[]
  summary?: {
    nodeCount: number
    edgeCount: number
    filteredEdgeCount: number
    componentCount: number
    cycleCount: number
    reachableCount: number
  }
}

export interface GraphExportOptions {
  graphName?: string
  direction?: 'LR' | 'TD' | 'TB' | 'RL' | 'BT'
  pretty?: boolean
}

export declare const GRAPH_VERSION: string
export declare const GRAPH_API_VERSION: number
export declare const GRAPH_FORMATS: Readonly<Array<'json' | 'dot' | 'mermaid'>>

export declare const GRAPH_ERROR_CODES: Readonly<{
  invalidArgument: 'GRAPH_INVALID_ARGUMENT'
  invalidProject: 'GRAPH_INVALID_PROJECT'
  invalidGraph: 'GRAPH_INVALID_GRAPH'
  targetRequired: 'GRAPH_TARGET_REQUIRED'
  targetNotFound: 'GRAPH_TARGET_NOT_FOUND'
  targetAmbiguous: 'GRAPH_TARGET_AMBIGUOUS'
  nodeNotFound: 'GRAPH_NODE_NOT_FOUND'
  unsupportedFormat: 'GRAPH_UNSUPPORTED_FORMAT'
  internal: 'GRAPH_INTERNAL'
}>

export declare class GraphError extends Error {
  name: 'GraphError'
  code: string
  diagnostics: Diagnostic[]
  details: unknown
  cause?: unknown
  constructor(code: string, message: string, options?: { diagnostics?: Diagnostic[]; details?: unknown; cause?: unknown })
  toJSON(): { name: string; code: string; message: string; diagnostics: Diagnostic[]; details: unknown }
}

export declare function isGraphError(value: unknown): value is GraphError
export declare function toGraphError(error: unknown, fallbackCode?: string): GraphError
export declare function assertGraphShape(graph: Graph): Graph

export declare function getDependencyGraph(project: SourceProject, options?: DependencyGraphOptions): Graph
export declare function getControlFlowGraph(project: SourceProject, target: string | { kind: 'module' | 'node'; id: string }, options?: ControlFlowGraphOptions): Graph
export declare function getCallGraph(project: SourceProject, options?: CallGraphOptions): Graph
export declare function getAstGraph(project: SourceProject, options?: AstGraphOptions): Graph
export declare function getFlowGraph(project: SourceProject, options?: FlowGraphOptions): Graph
export declare function analyzeGraph(graph: Graph, options?: GraphAnalysisOptions): GraphAnalysis
export declare function exportGraph(graph: Graph, format?: GraphFormat, options?: GraphExportOptions): string

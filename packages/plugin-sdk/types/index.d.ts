/**
 * Public declarations for @sapphire3/plugin-sdk.
 * The runtime is plain JavaScript ESM; the application does not require TypeScript.
 */

export type PluginPermission =
  | 'ui.widgets'
  | 'engine.native-operations'
  | 'engine.composites'
  | 'workspace.widget-state'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network.access'
  | 'native.api'

export type PluginCapability = 'widgets' | 'nativeOperations' | 'composites'
export type PrimitiveName =
  | 'short int' | 'short uint' | 'int' | 'uint' | 'float' | 'double'
  | 'string' | 'char' | 'boolean' | 'void'
export interface PrimitiveType { kind: 'primitive'; name: PrimitiveName }
export interface ArrayType { kind: 'array'; elementType: PrimitiveType }
export type PluginType = PrimitiveType | ArrayType
export type PluginInputType = PrimitiveType | ArrayType

export interface PluginDependency {
  id: string
  version: string
  optional?: boolean
}

export interface PluginSize {
  width: number
  height: number
}

export type WidgetPropertyType = 'string' | 'int' | 'float' | 'boolean' | 'color' | 'select'

export interface WidgetProperty {
  id: string
  label: string
  type: WidgetPropertyType
  default: string | number | boolean
  options?: string[]
}

export interface WidgetPort {
  id: string
  name: string
  type: PluginInputType
  description?: string
}

export interface WidgetInteraction {
  id: string
  kind: 'slider' | 'button'
  label: string
  min?: number
  max?: number
  step?: number
  stateKey?: string
  output?: string
  value?: string | number | boolean
}

export type RendererNode =
  | { kind: 'stack' | 'row'; children: RendererNode[] }
  | { kind: 'text'; text: string }
  | { kind: 'value'; source: string; label?: string; suffix?: string; precision?: number }
  | { kind: 'bar'; source: string; label?: string; min?: number; max?: number }
  | { kind: 'led'; source: string; label?: string }
  | { kind: 'input'; interaction: string }
  | { kind: 'button'; interaction: string }
  | { kind: 'divider' }
  | { kind: 'spacer' }

export interface PluginWidget {
  id: string
  name: string
  description: string
  category: string
  icon: string
  version?: string
  author?: string
  defaultSize: PluginSize
  minSize: PluginSize
  properties?: WidgetProperty[]
  inputs?: WidgetPort[]
  outputs?: WidgetPort[]
  interactions?: WidgetInteraction[]
  initialState: Record<string, unknown>
  renderer: RendererNode
}

export type ExpressionNode =
  | { kind: 'param'; name: string }
  | { kind: 'literal'; type: PrimitiveType; value: string | number | boolean }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/' | '%' | '<' | '<=' | '>' | '>=' | '==' | '!=' | 'and' | 'or'; left: ExpressionNode; right: ExpressionNode }
  | { kind: 'unary'; operator: '-' | '+' | 'not'; operand: ExpressionNode }
  | { kind: 'conditional'; test: ExpressionNode; consequent: ExpressionNode; alternate: ExpressionNode }

export interface NativeOperationParameter {
  name: string
  type: PluginInputType
}

export interface NativeOperation {
  id: string
  name: string
  description: string
  parameters: NativeOperationParameter[]
  returnType: PluginType
  purity: 'pure' | 'effect'
  effects?: string[]
  implementation: ExpressionNode
  validation?: ExpressionNode
  transpilers?: {
    javascript?: ExpressionNode
    python?: ExpressionNode
  }
}

export interface CompositeNode {
  id: string
  name: string
  description: string
  expansion: Record<string, unknown>
}

export interface PluginManifest {
  pluginFormatVersion: 1
  apiVersion: 1
  id: string
  name: string
  version: string
  author: string
  description: string
  license?: string
  homepage?: string
  minAppVersion?: string
  permissions: PluginPermission[]
  dependencies?: PluginDependency[]
  widgets?: PluginWidget[]
  nativeOperations?: NativeOperation[]
  composites?: CompositeNode[]
}

export interface PluginDiagnostic {
  code: string
  severity: 'error'
  message: string
  path: string | null
}

export interface PluginValidationResult {
  ok: boolean
  plugin: PluginManifest | null
  code?: string
  message?: string
  diagnostics: PluginDiagnostic[]
}

export interface NativeOperationDefinition {
  id: string
  name: string
  description: string
  group: string
  parameters: PluginInputType[]
  returnType: PluginType
  purity: 'pure' | 'effect'
  effects: string[]
  pluginId: string
  pluginName: string
  pluginVersion: string
  run(args: unknown[]): unknown
  emit(target: 'javascript' | 'python', argumentCodes: string[]): string | null
}

export declare const PLUGIN_API_VERSION: 1
export declare const PLUGIN_FORMAT_VERSION: 1
export declare const PLUGIN_FILE_EXTENSION: 'sp3plugin'
export declare const PLUGIN_SDK_VERSION: string
export declare const PLUGIN_CONTRACT_VERSION: 1
export declare const PLUGIN_DOCUMENT_VERSION: 1

export declare const PLUGIN_PERMISSIONS: Readonly<{
  widgets: 'ui.widgets'
  nativeOperations: 'engine.native-operations'
  composites: 'engine.composites'
  widgetState: 'workspace.widget-state'
  filesystemRead: 'filesystem.read'
  filesystemWrite: 'filesystem.write'
  network: 'network.access'
  native: 'native.api'
}>
export declare const SUPPORTED_PLUGIN_PERMISSIONS: Readonly<PluginPermission[]>
export declare const PLUGIN_CAPABILITIES: Readonly<{ widgets: 'widgets'; nativeOperations: 'nativeOperations'; composites: 'composites' }>
export declare const PLUGIN_LIMITS: Readonly<Record<string, number>>
export declare const WIDGET_RENDERER_KINDS: Readonly<string[]>
export declare const WIDGET_INTERACTION_KINDS: Readonly<string[]>
export declare const WIDGET_PROPERTY_TYPES: Readonly<string[]>
export declare const NATIVE_OPERATION_PURITY: Readonly<string[]>
export declare const NATIVE_OPERATION_EMITTER_TARGETS: Readonly<string[]>
export declare const COMPOSITE_ROOT_KINDS: Readonly<string[]>
export declare const COMPOSITE_NODE_KINDS: Readonly<string[]>
export declare const PLUGIN_DIAGNOSTIC_CODES: Readonly<Record<string, string>>

export declare function definePlugin(document: PluginManifest): PluginManifest
export declare function defineWidget(widget: PluginWidget): PluginWidget
export declare function defineNativeOperation(operation: NativeOperation): NativeOperation
export declare function defineComposite(composite: CompositeNode): CompositeNode
export declare function validatePluginDocument(value: unknown): PluginValidationResult
export declare function validateManifest(value: unknown): PluginValidationResult
export declare function stringifyPluginDocument(document: PluginManifest): string
export declare function getPluginCapabilities(plugin: PluginManifest): PluginCapability[]
export declare function isJsonSafe(value: unknown): boolean
export declare function isPlainRecord(value: unknown): value is Record<string, unknown>
export declare function isPluginType(value: unknown, options?: { allowVoid?: boolean }): value is PluginType
export declare function validatePluginExpression(expression: unknown, parameters?: string[], depth?: number, path?: string): { ok: boolean; diagnostics: PluginDiagnostic[]; parameters: string[] }
export declare function evaluatePluginExpression(expression: ExpressionNode, argumentValues: unknown[], parameterNames: string[], depth?: number): unknown
export declare function emitPluginExpression(expression: ExpressionNode, target: 'javascript' | 'python', argumentCodes: string[], parameterNames: string[], depth?: number): string
export declare function normalizeLiteralValue(value: unknown, type: PluginType): unknown
export declare function runtimeTypeOf(value: unknown): PrimitiveType | null
export declare function runtimeValueMatchesType(value: unknown, type: PluginType): boolean
export declare function compareVersions(left: string, right: string): number
export declare function satisfiesVersionRange(version: string, range: string): boolean
export declare function sanitizeWidgetProperties(widget: PluginWidget, overrides?: Record<string, unknown>): Record<string, unknown>
export declare function sanitizeWidgetState(widget: PluginWidget, persisted?: Record<string, unknown> | null): Record<string, unknown>
export declare function createWidgetInstance(widget: PluginWidget, overrides?: { properties?: Record<string, unknown>; state?: Record<string, unknown>; bindings?: { inputs?: Record<string, string>; outputs?: Record<string, string> } }): { properties: Record<string, unknown>; state: Record<string, unknown>; bindings: { inputs: Record<string, string>; outputs: Record<string, string> } }
export declare function createNativeOperationDefinition(plugin: PluginManifest, operation: NativeOperation): NativeOperationDefinition
export declare function expandCompositeDraft(composite: CompositeNode): Record<string, unknown>
export declare function getNativeOperationParameterNames(operation: NativeOperation): string[]
export declare function createPluginDiagnostic(code: string, message: string, path?: string | null): PluginDiagnostic

// Contrat public du SDK plugin. Toute rupture de format doit incrémenter
// `PLUGIN_API_VERSION` et `PLUGIN_FORMAT_VERSION`.
export const PLUGIN_API_VERSION = 1
export const PLUGIN_FORMAT_VERSION = 1
export const PLUGIN_FILE_EXTENSION = 'sp3plugin'
export const PLUGIN_MANIFEST_KEY = 'pluginFormatVersion'

export const PLUGIN_PERMISSIONS = Object.freeze({
  widgets: 'ui.widgets',
  nativeOperations: 'engine.native-operations',
  composites: 'engine.composites',
  widgetState: 'workspace.widget-state',
  filesystemRead: 'filesystem.read',
  filesystemWrite: 'filesystem.write',
  network: 'network.access',
  native: 'native.api',
})

// Capacités réellement implémentées par la première version de l'hôte.
// Les permissions de fichiers, réseau et API native sont déclarables dans le
// manifeste mais refusées à l'installation : aucun accès correspondant n'existe.
export const SUPPORTED_PLUGIN_PERMISSIONS = Object.freeze([
  PLUGIN_PERMISSIONS.widgets,
  PLUGIN_PERMISSIONS.nativeOperations,
  PLUGIN_PERMISSIONS.composites,
  PLUGIN_PERMISSIONS.widgetState,
])

export const PLUGIN_CAPABILITIES = Object.freeze({
  widgets: 'widgets',
  nativeOperations: 'nativeOperations',
  composites: 'composites',
})

export const PLUGIN_LIMITS = Object.freeze({
  maximumPlugins: 64,
  maximumWidgets: 32,
  maximumNativeOperations: 64,
  maximumComposites: 64,
  maximumProperties: 24,
  maximumPorts: 16,
  maximumRendererNodes: 120,
  maximumRendererDepth: 10,
  maximumExpressionDepth: 40,
  maximumStringLength: 4096,
  maximumDependencies: 32,
  maximumStateBytes: 65536,
})

export const WIDGET_RENDERER_KINDS = Object.freeze([
  'stack', 'row', 'text', 'value', 'bar', 'led', 'input', 'button', 'divider', 'spacer',
])

export const WIDGET_INTERACTION_KINDS = Object.freeze(['slider', 'button'])

export const WIDGET_PROPERTY_TYPES = Object.freeze(['string', 'int', 'float', 'boolean', 'color', 'select'])

export const NATIVE_OPERATION_PURITY = Object.freeze(['pure', 'effect'])

export const NATIVE_OPERATION_EMITTER_TARGETS = Object.freeze(['javascript', 'python'])

// Constructions natives autorisées comme racine d'un nœud composite de niveau A.
// L'hôte revalide le brouillon avec son propre schéma lors de l'insertion.
export const COMPOSITE_ROOT_KINDS = Object.freeze([
  'VariableDeclaration', 'ConstantDeclaration', 'FunctionDeclaration', 'Block', 'ReturnStatement',
  'PrintStatement', 'ForEachStatement', 'IfStatement', 'WhileStatement', 'ForStatement',
  'BreakStatement', 'ContinueStatement', 'ExpressionStatement', 'AssignmentStatement',
  'BinaryExpression', 'UnaryExpression', 'Literal', 'Reference', 'CallExpression', 'MathCall',
  'CastExpression', 'ArrayLiteral', 'ArrayCreation', 'ArrayAccess', 'NewExpression',
  'ThisExpression', 'MemberExpression',
])

export const COMPOSITE_NODE_KINDS = Object.freeze([...COMPOSITE_ROOT_KINDS, 'Hole', 'Parameter'])

export const PLUGIN_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{1,63}$/
export const PLUGIN_ENTITY_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/
export const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * Contrats JSON du modèle source, indépendants de l'interface.
 * @typedef {'short int'|'short uint'|'int'|'uint'|'float'|'double'|'string'|'char'|'boolean'|'void'} PrimitiveName
 * @typedef {{kind:'primitive', name:PrimitiveName}|{kind:'named', target:SymbolReference}} TypeReference
 * @typedef {{kind:'name', name:string}|{kind:'node', nodeId:string}|{kind:'import', importId:string}} SymbolReference
 * @typedef {{id:string, moduleId:string, nodeId:string, localName:string}} ModuleImport
 * @typedef {{nodeId:string, name:string}} ModuleExport
 * @typedef {{id:string, name:string, kind:'module', rootNodeIds:Array<string|null>, imports:ModuleImport[], exports:ModuleExport[]}} SourceModule
 * @typedef {'VariableDeclaration'|'ConstantDeclaration'|'FunctionDeclaration'|'Parameter'|'TypeDeclaration'|'Block'|'ReturnStatement'|'IfStatement'|'WhileStatement'|'ForStatement'|'BreakStatement'|'ContinueStatement'|'ExpressionStatement'|'AssignmentStatement'|'BinaryExpression'|'UnaryExpression'|'Literal'|'Reference'|'CallExpression'|'CastExpression'|'Hole'} NodeKind
 * @typedef {{id:string, moduleId:string, kind:NodeKind, properties:Object, children:Object<string,string|null|Array<string|null>>, references:Object<string,SymbolReference>}} SourceNode
 * @typedef {{formatVersion:1, id:string, modules:SourceModule[], nodes:SourceNode[]}} SourceProject
 * FunctionDeclaration accepte properties.entryPoint (booléen optionnel) ; true désigne l'unique point d'entrée du projet, sans imposer son nom ni sa signature cible.
 * Les données invalides restent acceptées en entrée des analyses ; les typedefs
 * décrivent la forme nominale, pas une obligation de validité pendant l'édition.
 */

export const sourceFormatVersion = 1
export const moduleKinds = Object.freeze({ module: 'module' })

// Fournit un document vide ; les identifiants sont injectés, jamais générés par le moteur.
export function createProject(id) {
  return { formatVersion: sourceFormatVersion, id, modules: [], nodes: [] }
}

// Prépare une unité logique sans information de position ou de stockage physique.
export function createModule(id, name, kind = moduleKinds.module) {
  return { id, name, kind, rootNodeIds: [], imports: [], exports: [] }
}

// Prépare un nœud permissif ; ses contraintes seront vérifiées lors de l'analyse.
export function createNode(id, moduleId, kind, { properties = {}, children = {}, references = {} } = {}) {
  return { id, moduleId, kind, properties, children, references }
}

// Reconnaît uniquement les dictionnaires de données, pas les tableaux ni les instances.
export function isRecord(value) {
  return value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

// Vérifie les clés stables sans imposer de convention de nommage métier.
export function isId(value) {
  return typeof value === 'string' && value.trim().length > 0
}

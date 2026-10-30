import { createDiagnostic, diagnosticCodes as codes } from './diagnostics.js'
import { isId, isRecord } from './model.js'
import { getNodeSchema } from './nodeSchema.js'
import { getPlacementIssue } from './placement.js'

/**
 * @typedef {{id:string, moduleId:string, ownerNodeId:string|null, parentId:string|null, symbolIds:string[]}} Scope
 * @typedef {{id:string, name:string, nodeId:string, moduleId:string, scopeId:string, kind:string, type?:Object, importedFrom?:string}} Symbol
 * @typedef {{nodeId:string, moduleId:string, scopeId:string, field:string, target:Object, symbolId:string|null}} ResolvedReference
 * L'index renvoyé contient des Map locales ; seul le modèle source est persisté.
 */

// Construit les portées, puis résout les références sans les confondre avec la parenté AST.
export function buildSemanticModel(ast) {
  const diagnostics = []
  const scopes = []
  const symbols = []
  const references = []
  const nodes = new Map()
  const scopeByNode = new Map()
  const contexts = new Map()
  const scopeIndex = new Map()
  const bindings = new Map()
  const moduleScopes = new Map()
  const symbolByNode = new Map()
  const importSymbols = new Map()
  const moduleIndex = new Map(ast.modules.map((module) => [module.sourceId, module]))

  // Ajoute une erreur sémantique au nœud ou au champ de module concerné.
  function report(code, message, moduleId, nodeId = null, field = null) {
    diagnostics.push(createDiagnostic(code, message, { projectId: ast.sourceId, moduleId, nodeId, field }))
  }

  // Crée une portée lexicale distincte de l'appartenance à un module.
  function addScope(id, moduleId, ownerNodeId, parentId) {
    const scope = { id, moduleId, ownerNodeId, parentId, symbolIds: [] }
    scopes.push(scope)
    scopeIndex.set(id, scope)
    bindings.set(id, new Map())
    return id
  }

  // Enregistre un symbole en gardant la première déclaration accessible en cas de conflit.
  function declare(symbol) {
    const names = bindings.get(symbol.scopeId)
    if (names.has(symbol.name)) {
      report(codes.conflict, `Déclaration conflictuelle : ${symbol.name}.`, symbol.moduleId, symbol.importedFrom ? null : symbol.nodeId, symbol.importedFrom ? 'imports' : 'properties.name')
    } else {
      names.set(symbol.name, symbol)
    }
    symbols.push(symbol)
    scopeIndex.get(symbol.scopeId).symbolIds.push(symbol.id)
  }

  // Attribue les portées et les contextes à tous les nœuds réellement construits.
  function collect(node, scopeId, context, reuseBlockScope = false) {
    if (Array.isArray(node)) {
      node.forEach((entry) => collect(entry, scopeId, context, reuseBlockScope))
      return
    }
    if (!node || node.kind === 'Invalid' || node.kind === 'Hole') return
    nodes.set(node.sourceId, node)
    scopeByNode.set(node.sourceId, scopeId)
    contexts.set(node.sourceId, context)
    const schema = getNodeSchema(node.kind)
    if (schema?.named && isId(node.properties.name)) {
      const symbol = { id: `node:${node.sourceId}`, name: node.properties.name, nodeId: node.sourceId, moduleId: node.moduleId, scopeId, kind: node.kind }
      declare(symbol)
      symbolByNode.set(node.sourceId, symbol)
    }
    const placementIssue = getPlacementIssue(node.kind, context)
    if (placementIssue) report(codes.illegalPlacement, placementIssue, node.moduleId, node.sourceId)

    if (node.kind === 'FunctionDeclaration') {
      const inner = addScope(`function:${node.sourceId}`, node.moduleId, node.sourceId, scopeId)
      for (const parameter of node.children.parameters ?? []) collect(parameter, inner, { functionId: node.sourceId, loopDepth: 0, parameterList: true })
      collect(node.children.body, inner, { functionId: node.sourceId, loopDepth: 0 }, true)
      return
    }
    let childScope = scopeId
    if (node.kind === 'Block' && !reuseBlockScope) childScope = addScope(`block:${node.sourceId}`, node.moduleId, node.sourceId, scopeId)
    if (node.kind === 'ForStatement') childScope = addScope(`for:${node.sourceId}`, node.moduleId, node.sourceId, scopeId)
    // Le bloc lui-même est inspectable dans sa portée propre.
    scopeByNode.set(node.sourceId, childScope)
    const childContext = { ...context, parameterList: false, isModuleRoot: false }
    if (['WhileStatement', 'ForStatement'].includes(node.kind)) childContext.loopDepth += 1
    for (const child of Object.values(node.children).flat().filter(Boolean)) collect(child, childScope, childContext)
  }

  for (const module of ast.modules) {
    const scopeId = addScope(`module:${module.sourceId}`, module.sourceId, null, null)
    moduleScopes.set(module.sourceId, scopeId)
    for (const node of module.body) collect(node, scopeId, { functionId: null, loopDepth: 0, isModuleRoot: true })
    // Les fragments détachés restent analysables mais ne publient pas de symboles au module.
    for (const node of module.detachedNodes) {
      const detachedScope = addScope(`detached:${node.sourceId}`, module.sourceId, node.sourceId, scopeId)
      collect(node, detachedScope, { functionId: null, loopDepth: 0 })
    }
  }

  const exportedNodes = new Map()
  for (const module of ast.modules) {
    const exported = new Set()
    const names = new Set()
    for (const [index, entry] of module.exports.entries()) {
      const symbol = isRecord(entry) ? symbolByNode.get(entry.nodeId) : null
      if (!symbol || symbol.scopeId !== moduleScopes.get(module.sourceId) || !isId(entry.name) || names.has(entry.name) || exported.has(entry.nodeId)) {
        report(codes.invalidExport, 'Export absent, dupliqué ou non déclaré à la racine du module.', module.sourceId, isId(entry?.nodeId) ? entry.nodeId : null, `exports[${index}]`)
      } else {
        names.add(entry.name)
        exported.add(entry.nodeId)
      }
    }
    exportedNodes.set(module.sourceId, exported)
  }

  for (const module of ast.modules) {
    const imports = new Map()
    importSymbols.set(module.sourceId, imports)
    for (const [index, entry] of module.imports.entries()) {
      const valid = isRecord(entry) && isId(entry.id) && isId(entry.localName) && moduleIndex.has(entry.moduleId) &&
        entry.moduleId !== module.sourceId && exportedNodes.get(entry.moduleId)?.has(entry.nodeId) && !imports.has(entry.id)
      if (!valid) {
        report(codes.invalidImport, 'Import invalide : cible absente, privée, locale ou identifiant dupliqué.', module.sourceId, null, `imports[${index}]`)
        continue
      }
      const target = symbolByNode.get(entry.nodeId)
      const symbol = { ...target, id: `import:${JSON.stringify([module.sourceId, entry.id])}`, name: entry.localName, moduleId: module.sourceId, scopeId: moduleScopes.get(module.sourceId), importedFrom: entry.moduleId, importId: entry.id }
      declare(symbol)
      imports.set(entry.id, symbol)
    }
  }

  // Cherche un nom dans la portée courante puis ses parents, jamais dans tous les nœuds du module.
  function lookupName(scopeId, name) {
    let current = scopeId
    while (current) {
      const symbol = bindings.get(current)?.get(name)
      if (symbol) return symbol
      current = scopeIndex.get(current)?.parentId
    }
    return null
  }

  // Résout une cible explicite en respectant la visibilité lexicale et les imports déclarés.
  function resolveTarget(target, node, field) {
    const scopeId = scopeByNode.get(node.sourceId)
    let symbol = null
    if (isRecord(target)) {
      if (target.kind === 'name' && isId(target.name)) symbol = lookupName(scopeId, target.name)
      if (target.kind === 'node' && isId(target.nodeId)) {
        let current = scopeId
        while (current && !symbol) {
          symbol = [...bindings.get(current).values()].find((entry) => entry.nodeId === target.nodeId) ?? null
          current = scopeIndex.get(current)?.parentId
        }
      }
      if (target.kind === 'import' && isId(target.importId)) symbol = importSymbols.get(node.moduleId)?.get(target.importId) ?? null
    }
    const reference = { nodeId: node.sourceId, moduleId: node.moduleId, scopeId, field, target: target ?? null, symbolId: symbol?.id ?? null }
    references.push(reference)
    if (!symbol) report(codes.unresolved, 'Référence non résolue ou inaccessible dans cette portée.', node.moduleId, node.sourceId, field)
    return symbol
  }

  const referenceSymbols = new Map()
  const typeSymbols = new Map()
  for (const node of nodes.values()) {
    if (node.kind === 'Reference') referenceSymbols.set(node.sourceId, resolveTarget(node.references.target, node, 'references.target'))
    const annotation = node.properties.type
    if (getNodeSchema(node.kind)?.declaresType && isRecord(annotation) && annotation.kind === 'named') {
      const symbol = resolveTarget(annotation.target, node, 'properties.type.target')
      if (symbol && symbol.kind !== 'TypeDeclaration') report(codes.typeMismatch, 'La référence de type cible une valeur et non un type.', node.moduleId, node.sourceId, 'properties.type')
      typeSymbols.set(node.sourceId, symbol?.kind === 'TypeDeclaration' ? symbol : null)
    }
    for (const field of Object.keys(node.references)) {
      if (node.kind !== 'Reference' || field !== 'target') report(codes.invalidStructure, `Référence non prise en charge : ${field}.`, node.moduleId, node.sourceId, `references.${field}`)
    }
  }

  return {
    model: { scopes, symbols, references, nodeScopes: [...scopeByNode].map(([nodeId, scopeId]) => ({ nodeId, scopeId })), nodeTypes: [] },
    diagnostics,
    index: { nodes, scopeByNode, contexts, symbolByNode, referenceSymbols, typeSymbols },
  }
}

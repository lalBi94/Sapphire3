import { isId, isRecord } from './model.js'
import { getNodeSchema, moduleRootSlot, acceptsNodeKind } from './nodeSchema.js'
import { primitiveType } from './primitives.js'

// Indexe la source et les résultats déjà calculés, sans reconstruire d'AST à l'ouverture du menu.
export function createContextIndex(project, analysis = null) {
  const modules = new Map()
  const nodes = new Map()
  const parents = new Map()
  const duplicates = new Set()
  for (const module of Array.isArray(project?.modules) ? project.modules : []) {
    if (!isRecord(module) || !isId(module.id)) continue
    if (modules.has(module.id)) duplicates.add(`module:${module.id}`)
    else modules.set(module.id, module)
  }
  for (const node of Array.isArray(project?.nodes) ? project.nodes : []) {
    if (!isRecord(node) || !isId(node.id)) continue
    if (nodes.has(node.id)) duplicates.add(`node:${node.id}`)
    else nodes.set(node.id, node)
  }

  // Conserve toutes les parentés pour détecter les contextes ambigus au lieu d'en choisir un.
  function addParent(childId, parent) {
    if (!isId(childId)) return
    if (!parents.has(childId)) parents.set(childId, [])
    parents.get(childId).push(parent)
  }

  for (const module of modules.values()) {
    if (Array.isArray(module.rootNodeIds)) module.rootNodeIds.forEach((id) => addParent(id, { kind: 'module', id: module.id, slot: 'rootNodeIds' }))
  }
  for (const node of nodes.values()) {
    for (const [slot, value] of Object.entries(isRecord(node.children) ? node.children : {})) {
      for (const id of Array.isArray(value) ? value : [value]) addParent(id, { kind: 'node', id: node.id, slot })
    }
  }
  return {
    project, analysis, modules, nodes, parents, duplicates,
    nodeTypes: new Map((analysis?.semantic.nodeTypes ?? []).map((entry) => [entry.nodeId, entry.type])),
    nodeScopes: new Map((analysis?.semantic.nodeScopes ?? []).map((entry) => [entry.nodeId, entry.scopeId])),
    scopes: new Map((analysis?.semantic.scopes ?? []).map((scope) => [scope.id, scope])),
    symbols: new Map((analysis?.semantic.symbols ?? []).map((symbol) => [symbol.id, symbol])),
    references: new Map((analysis?.semantic.references ?? []).map((reference) => [reference.nodeId, reference])),
  }
}

// Désambiguïse les identifiants source de module et de nœud, qui appartiennent à deux espaces distincts.
export function normalizeTarget(index, targetId) {
  if (isRecord(targetId) && ['module', 'node'].includes(targetId.kind) && isId(targetId.id)) return { kind: targetId.kind, id: targetId.id }
  if (!isId(targetId)) return null
  const module = index.modules.has(targetId)
  const node = index.nodes.has(targetId)
  return module !== node ? { kind: module ? 'module' : 'node', id: targetId } : null
}

// Retrouve une portée d'insertion ainsi que le contexte des futurs enfants, non celui du propriétaire seul.
export function resolveContext(project, targetId, slotName, suppliedIndex = null) {
  const index = suppliedIndex?.project === project ? suppliedIndex : createContextIndex(project)
  const target = normalizeTarget(index, targetId)
  if (!target || index.duplicates.has(`${target.kind}:${target.id}`)) return { ok: false, code: 'TARGET_INVALID', index }
  const record = (target.kind === 'module' ? index.modules : index.nodes).get(target.id)
  const moduleId = target.kind === 'module' ? target.id : record?.moduleId
  if (!record || !index.modules.has(moduleId)) return { ok: false, code: 'TARGET_NOT_FOUND', index }
  const path = []
  let current = target
  const visited = new Set()
  while (current.kind === 'node') {
    if (visited.has(current.id) || visited.size >= 200 || index.duplicates.has(`node:${current.id}`)) return { ok: false, code: 'CONTEXT_AMBIGUOUS', index }
    visited.add(current.id)
    const node = index.nodes.get(current.id)
    const parents = index.parents.get(current.id) ?? []
    if (!node || node.moduleId !== moduleId || parents.length !== 1) return { ok: false, code: 'CONTEXT_AMBIGUOUS', index }
    const parent = parents[0]
    if (parent.kind === 'node') {
      const owner = index.nodes.get(parent.id)
      const definitions = getNodeSchema(owner?.kind)?.slots
      const definition = definitions && Object.hasOwn(definitions, parent.slot) ? definitions[parent.slot] : null
      if (!definition || !acceptsNodeKind(definition, node.kind) || Boolean(definition.many) !== Array.isArray(owner.children?.[parent.slot])) return { ok: false, code: 'CONTEXT_INVALID', index }
    }
    path.unshift(node)
    current = parents[0]
  }
  if (current.id !== moduleId) return { ok: false, code: 'CONTEXT_AMBIGUOUS', index }
  const definitions = target.kind === 'module' ? { rootNodeIds: moduleRootSlot } : getNodeSchema(record.kind)?.slots ?? {}
  const slots = Object.entries(definitions).map(([name, definition]) => {
    const value = target.kind === 'module' ? record.rootNodeIds : record.children?.[name]
    const malformedOwner = target.kind === 'node' && record.children !== undefined && !isRecord(record.children)
    const malformed = malformedOwner || (definition.many ? value !== undefined && !Array.isArray(value) : Array.isArray(value))
    return { name, ...definition, occupied: !definition.many && value !== null && value !== undefined, malformed }
  })
  const slot = slots.find((entry) => entry.name === slotName) ?? (slotName === undefined && slots.length === 1 ? slots[0] : null)
  if (slotName !== undefined && !slot) return { ok: false, code: 'SLOT_NOT_FOUND', index, target, record, slots }
  const context = { isModuleRoot: target.kind === 'module', functionId: null, loopDepth: 0, parameterList: false }
  for (const node of path) {
    if (node.kind === 'FunctionDeclaration') { context.functionId = node.id; context.loopDepth = 0 }
    if (['WhileStatement', 'ForStatement'].includes(node.kind)) context.loopDepth += 1
  }
  context.parameterList = record.kind === 'FunctionDeclaration' && slot?.name === 'parameters'
  let scopeId = target.kind === 'module'
    ? [...index.scopes.values()].find((scope) => scope.moduleId === moduleId && scope.parentId === null)?.id ?? null
    : index.nodeScopes.get(target.id) ?? null
  if (record.kind === 'FunctionDeclaration') scopeId = [...index.scopes.values()].find((scope) => scope.ownerNodeId === record.id)?.id ?? scopeId
  const expectedType = getExpectedType(record, slot?.name, path, index)
  return { ok: true, index, target, record, moduleId, path, slots, slot, context, scopeId, expectedType }
}

// Déduit seulement les types déjà connus ; aucune valeur ni annotation de secours n'est introduite.
function getExpectedType(record, slot, path, index) {
  if (!slot) return null
  if (slot === 'test' && ['IfStatement', 'WhileStatement', 'ForStatement'].includes(record.kind)) return primitiveType('boolean')
  if (slot === 'initializer' && ['VariableDeclaration', 'ConstantDeclaration'].includes(record.kind)) return index.nodeTypes.get(record.id) ?? null
  if (record.kind === 'ReturnStatement' && slot === 'argument') {
    const owner = [...path].reverse().find((node) => node.kind === 'FunctionDeclaration')
    return index.nodeTypes.get(owner?.id)?.returnType ?? null
  }
  if (record.kind === 'AssignmentStatement' && slot === 'value') return index.nodeTypes.get(record.children?.target) ?? null
  if (record.kind === 'CallExpression' && slot === 'arguments') {
    const parameters = index.nodeTypes.get(record.children?.callee)?.parameters
    return parameters?.[Array.isArray(record.children?.arguments) ? record.children.arguments.length : 0] ?? null
  }
  if (record.kind === 'BinaryExpression') {
    const other = record.children?.[slot === 'left' ? 'right' : 'left']
    return index.nodeTypes.get(other) ?? null
  }
  return null
}

// Liste les symboles lexicaux visibles sans ajouter les déclarations privées d'un autre module.
export function getVisibleSymbols(context) {
  const visible = []
  const names = new Set()
  let scopeId = context.scopeId
  while (scopeId) {
    for (const symbol of context.index.analysis?.semantic.symbols ?? []) {
      if (symbol.scopeId !== scopeId || names.has(symbol.name)) continue
      names.add(symbol.name)
      visible.push(symbol)
    }
    scopeId = context.index.scopes.get(scopeId)?.parentId ?? null
  }
  return visible
}

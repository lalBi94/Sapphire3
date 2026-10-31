import { analyzeProgram } from './analysis.js'
import { createContextIndex, resolveContext } from './contextResolver.js'

// Retrouve les enfants syntaxiques sans traiter les références comme une imbrication.
function childrenOf(node) {
  return Object.values(node?.children ?? {}).flat().filter((id) => typeof id === 'string')
}

// Parcourt un sous-arbre sans boucle, même si la source importée est invalide.
function descendants(index, roots) {
  const ids = new Set()
  const pending = [...roots].reverse()
  while (pending.length) {
    const id = pending.pop()
    if (ids.has(id) || !index.nodes.has(id)) continue
    ids.add(id)
    pending.push(...childrenOf(index.nodes.get(id)).reverse())
  }
  return ids
}

// Décrit les dépendances syntaxiques, références et appels directs, y compris entrants.
export function buildDependencyGraph(project, target, suppliedIndex = null) {
  const index = suppliedIndex?.project === project && suppliedIndex.analysis ? suppliedIndex : createContextIndex(project, analyzeProgram(project))
  const context = resolveContext(project, target, undefined, index)
  if (!context.ok) return { ok: false, code: context.code, nodes: [], edges: [] }
  const roots = target.kind === 'module' ? context.record.rootNodeIds : [target.id]
  const subtree = descendants(index, roots)
  const nodes = new Map()
  const edges = []
  const edgeKeys = new Set()

  // Conserve un sommet par identifiant source, sans dupliquer une cible importée.
  function addNode(id) {
    if (nodes.has(id)) return
    const source = index.nodes.get(id)
    if (source) nodes.set(id, { id, sourceId: id, kind: source.kind, name: source.properties?.name ?? '', moduleId: source.moduleId, external: !subtree.has(id) })
  }

  // Déduplique les relations tout en conservant leur nature explicite.
  function connect(from, to, kind) {
    if (!index.nodes.has(from) || !index.nodes.has(to)) return
    const key = JSON.stringify([from, to, kind])
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    addNode(from)
    addNode(to)
    edges.push({ from, to, kind })
  }

  for (const id of subtree) {
    addNode(id)
    for (const child of childrenOf(index.nodes.get(id))) connect(id, child, 'contains')
  }
  const references = index.analysis?.semantic.references ?? []
  for (const reference of references) {
    const source = index.nodes.get(reference.nodeId)
    if (!source) continue
    const resolved = index.symbols.get(reference.symbolId)
    const destination = resolved?.nodeId
    if (!destination || (!subtree.has(source.id) && !subtree.has(destination))) continue
    const parent = index.parents.get(source.id)?.[0]
    const call = parent?.slot === 'callee' && index.nodes.get(parent.id)?.kind === 'CallExpression'
    const write = parent?.slot === 'target' && index.nodes.get(parent.id)?.kind === 'AssignmentStatement'
    connect(call ? parent.id : source.id, destination, reference.field === 'properties.type.target' ? 'type' : call ? 'calls' : write ? 'writes' : 'reads')
  }
  return { ok: true, rootId: target.id, rootKind: target.kind, nodes: [...nodes.values()], edges, unresolvedNodeIds: [...new Set(references.filter((entry) => subtree.has(entry.nodeId) && !entry.symbolId).map((entry) => entry.nodeId))] }
}

// Construit le CFG intraprocédural ; chaque expression de condition reste une unité atomique.
export function buildControlFlowGraph(project, target, suppliedIndex = null) {
  const index = suppliedIndex?.project === project && suppliedIndex.analysis ? suppliedIndex : createContextIndex(project, analyzeProgram(project))
  const context = resolveContext(project, target, undefined, index)
  if (!context.ok) return { ok: false, code: context.code, nodes: [], edges: [] }
  const fn = [...context.path].reverse().find((node) => node.kind === 'FunctionDeclaration')
  const module = index.modules.get(context.moduleId)
  const roots = fn ? [fn.children.body] : module.rootNodeIds.filter((id) => index.nodes.get(id)?.kind !== 'FunctionDeclaration')
  const order = [...descendants(index, roots)]
  let entryId = 'cfg:entry'
  let exitId = 'cfg:exit'
  while (index.nodes.has(entryId)) entryId += ':'
  while (index.nodes.has(exitId)) exitId += ':'
  const nodes = new Map([
    [entryId, { id: entryId, kind: 'entry', sourceId: fn?.id ?? null }],
    [exitId, { id: exitId, kind: 'exit', sourceId: null }],
  ])
  const edges = []
  let incomplete = (index.analysis?.diagnostics ?? []).some((entry) => entry.severity === 'error' && (order.includes(entry.location.nodeId) || entry.location.nodeId === fn?.id))

  // Ajoute une instruction ou un test à sa place source, sans suivre les appels de fonctions.
  function addNode(id, kind = null) {
    const source = index.nodes.get(id)
    if (!source) { incomplete = true; return }
    nodes.set(id, { id, sourceId: id, kind: kind ?? source.kind, name: source.properties?.name ?? '' })
  }

  // Relie deux points de contrôle en conservant les branches et transferts de boucle.
  function connect(from, to, kind = 'next') {
    edges.push({ from, to, kind })
  }

  // Assemble une séquence à rebours pour connaître le successeur de chaque instruction.
  function sequence(ids, next, loop, path) {
    let start = next
    for (const id of [...ids].reverse()) start = statement(id, start, loop, path)
    return start
  }

  // Décrit les branchements structurés, retours, break et continue sans exécution.
  function statement(id, next, loop = null, path = new Set()) {
    const node = index.nodes.get(id)
    if (!node || path.has(id) || path.size >= 200) { incomplete = true; return next }
    const visited = new Set(path).add(id)
    if (node.kind === 'Block') return sequence(node.children.statements ?? [], next, loop, visited)
    if (['FunctionDeclaration', 'TypeDeclaration', 'Parameter'].includes(node.kind)) return next
    addNode(id)
    if (node.kind === 'IfStatement') {
      connect(id, statement(node.children.consequent, next, loop, visited), 'true')
      connect(id, node.children.alternate ? statement(node.children.alternate, next, loop, visited) : next, 'false')
    } else if (['WhileStatement', 'ForStatement'].includes(node.kind)) {
      const update = node.kind === 'ForStatement' && node.children.update ? statement(node.children.update, id, loop, visited) : id
      const body = statement(node.children.body, update, { breakTo: next, continueTo: update }, visited)
      connect(id, body, node.children.test ? 'true' : 'next')
      if (node.children.test) connect(id, next, 'false')
      if (!node.children.test && node.kind === 'WhileStatement') incomplete = true
      return node.kind === 'ForStatement' && node.children.initializer ? statement(node.children.initializer, id, loop, visited) : id
    } else if (node.kind === 'ReturnStatement') connect(id, exitId, 'return')
    else if (node.kind === 'BreakStatement') { connect(id, loop?.breakTo ?? exitId, 'break'); if (!loop) incomplete = true }
    else if (node.kind === 'ContinueStatement') { connect(id, loop?.continueTo ?? exitId, 'continue'); if (!loop) incomplete = true }
    else connect(id, next)
    return id
  }

  const start = sequence(roots, exitId, null, new Set())
  connect(entryId, start)
  const sorted = [entryId, ...order.filter((id) => nodes.has(id)), exitId]
  const reachable = new Set([entryId])
  const pending = [entryId]
  const outgoing = new Map()
  for (const edge of edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, [])
    outgoing.get(edge.from).push(edge.to)
  }
  while (pending.length) for (const id of outgoing.get(pending.pop()) ?? []) if (!reachable.has(id)) { reachable.add(id); pending.push(id) }
  return { ok: true, rootId: fn?.id ?? module.id, rootKind: fn ? 'node' : 'module', scope: fn ? 'function' : 'module', incomplete, nodes: sorted.map((id) => ({ ...nodes.get(id), reachable: reachable.has(id) })), edges }
}

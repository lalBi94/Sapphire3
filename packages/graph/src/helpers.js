import { analyzeProgram, analyzeReachability, createContextIndex } from '../../../src/utils/logic/index.js'
import { GRAPH_ERROR_CODES, GraphError } from './errors.js'

// Reconnaît un objet simple, sans prototype exotique.
export function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// Produit un identifiant graphique déterministe qui ne collisionne pas.
export function uniqueId(base, used) {
  let id = String(base)
  let suffix = 1
  while (used.has(id)) {
    suffix += 1
    id = `${base}#${suffix}`
  }
  used.add(id)
  return id
}

// Compare deux identifiants de façon stable et indépendante de la locale.
export function compareIds(left, right) {
  const first = String(left)
  const second = String(right)
  return first < second ? -1 : first > second ? 1 : 0
}

// Trie une copie d'objets par identifiant.
export function sortById(values) {
  return [...values].sort((left, right) => compareIds(left.id, right.id))
}

// Retourne le libellé lisible d'un nœud de graphe.
export function nodeLabel(node) {
  return String(node?.label || node?.name || node?.kind || node?.id || '')
}

// Normalise les extrémités d'une arête, y compris les graphes IDE `fromId`/`toId`.
export function edgeEndpoints(edge) {
  return { from: edge?.from ?? edge?.fromId ?? null, to: edge?.to ?? edge?.toId ?? null }
}

// Prépare l'analyse et l'index sémantiques communs à tous les graphes.
export function prepareProject(project) {
  if (!project || typeof project !== 'object' || project.formatVersion !== 1 || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    return { ok: false, code: GRAPH_ERROR_CODES.invalidProject, message: 'Expected a Sapphire source project with formatVersion 1, modules and nodes.', diagnostics: [] }
  }
  try {
    const analysis = analyzeProgram(project)
    const index = createContextIndex(project, analysis)
    const reachability = analyzeReachability(project, analysis)
    return { ok: true, project, analysis, index, reachability }
  } catch (error) {
    return {
      ok: false,
      code: error?.code ?? GRAPH_ERROR_CODES.invalidProject,
      message: error?.message ?? 'The Sapphire project cannot be analyzed.',
      diagnostics: error?.diagnostics ?? [],
      cause: error,
    }
  }
}

// Résout une cible module/nœud avec un code stable en cas d'ambiguïté.
export function resolveGraphTarget(index, value) {
  if (isRecord(value) && ['module', 'node'].includes(value.kind) && typeof value.id === 'string') {
    if (value.kind === 'module' && index.modules.has(value.id)) return { ok: true, target: { kind: 'module', id: value.id } }
    if (value.kind === 'node' && index.nodes.has(value.id)) return { ok: true, target: { kind: 'node', id: value.id } }
    return { ok: false, code: GRAPH_ERROR_CODES.targetNotFound }
  }
  if (typeof value !== 'string' || value.length === 0) return { ok: false, code: GRAPH_ERROR_CODES.targetRequired }
  const module = index.modules.has(value)
  const node = index.nodes.has(value)
  if (module && node) return { ok: false, code: GRAPH_ERROR_CODES.targetAmbiguous }
  if (module) return { ok: true, target: { kind: 'module', id: value } }
  if (node) return { ok: true, target: { kind: 'node', id: value } }
  return { ok: false, code: GRAPH_ERROR_CODES.targetNotFound }
}

// Indique si une analyse contient au moins une erreur bloquante.
export function hasErrors(diagnostics) {
  return (Array.isArray(diagnostics) ? diagnostics : []).some((entry) => entry?.severity === 'error')
}

// Construit une réponse d'échec homogène pour une extraction de graphe.
export function failureGraph(kind, code, message, diagnostics = [], details = null) {
  return {
    ok: false,
    kind,
    code,
    message,
    directed: true,
    nodes: [],
    edges: [],
    metadata: {
      kind,
      projectId: null,
      rootId: null,
      rootKind: null,
      scope: null,
      incomplete: true,
      nodeCount: 0,
      edgeCount: 0,
      diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
      unresolvedNodeIds: [],
      code,
      message,
      details,
    },
  }
}

// Assemble la structure commune `nodes`/`edges`/`metadata`.
export function createGraph({ kind, projectId, rootId = null, rootKind = null, scope = null, nodes = [], edges = [], metadata = {} }) {
  const preparedNodes = nodes.map((node) => ({
    ...node,
    label: node.label || node.name || node.kind || node.id,
  }))
  const seen = new Set()
  const preparedEdges = []
  for (const edge of edges) {
    const endpoints = edgeEndpoints(edge)
    if (typeof endpoints.from !== 'string' || typeof endpoints.to !== 'string') continue
    const base = `${endpoints.from}->${endpoints.to}:${edge.kind ?? 'edge'}`
    let id = base
    let suffix = 1
    while (seen.has(id)) {
      suffix += 1
      id = `${base}#${suffix}`
    }
    seen.add(id)
    preparedEdges.push({ ...edge, id, from: endpoints.from, to: endpoints.to })
  }
  return {
    ok: true,
    kind,
    directed: true,
    nodes: preparedNodes,
    edges: preparedEdges,
    metadata: {
      kind,
      projectId: projectId ?? null,
      rootId,
      rootKind,
      scope,
      incomplete: Boolean(metadata.incomplete),
      nodeCount: preparedNodes.length,
      edgeCount: preparedEdges.length,
      diagnostics: Array.isArray(metadata.diagnostics) ? metadata.diagnostics : [],
      unresolvedNodeIds: Array.isArray(metadata.unresolvedNodeIds) ? metadata.unresolvedNodeIds : [],
      ...metadata,
    },
  }
}

// Vérifie la forme minimale d'un graphe fourni par un appelant.
export function assertGraphShape(graph) {
  if (!isRecord(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new GraphError(GRAPH_ERROR_CODES.invalidGraph, 'Expected a graph with nodes and edges arrays.')
  }
  return graph
}

// Indique si un type sémantique est une fonction.
export function isFunctionType(type) {
  return type?.kind === 'function'
}

// Retrouve le module d'un nœud et son éventuel nom de classe.
export function moduleInfo(index, moduleId) {
  const module = index.modules.get(moduleId) ?? null
  return {
    module,
    moduleName: module?.name ?? '',
    classId: module?.kind === 'class' ? module.id : null,
    className: module?.kind === 'class' ? module.name ?? '' : null,
  }
}

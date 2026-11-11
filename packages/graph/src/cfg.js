import { buildControlFlowGraph } from '../../../src/utils/logic/index.js'
import { createGraph, failureGraph, moduleInfo, prepareProject, resolveGraphTarget } from './helpers.js'

// Construit le CFG intraprocédural d'une fonction, d'une lambda ou d'un module.
export function getControlFlowGraph(project, target, options = {}) {
  const prepared = prepareProject(project)
  if (!prepared.ok) return failureGraph('control-flow', prepared.code, prepared.message, prepared.diagnostics, prepared.cause)
  const value = target ?? options.target
  if (value === undefined || value === null) return failureGraph('control-flow', 'GRAPH_TARGET_REQUIRED', 'A function or module target is required.', prepared.analysis.diagnostics ?? [])
  const resolved = resolveGraphTarget(prepared.index, value)
  if (!resolved.ok) return failureGraph('control-flow', resolved.code, 'The control-flow target cannot be resolved.', prepared.analysis.diagnostics ?? [])

  let raw
  try {
    raw = buildControlFlowGraph(prepared.project, resolved.target, prepared.index)
  } catch (error) {
    return failureGraph('control-flow', error?.code ?? 'GRAPH_INTERNAL', error?.message ?? 'Control-flow graph extraction failed.', prepared.analysis.diagnostics ?? [], error)
  }
  if (!raw.ok) return failureGraph('control-flow', raw.code ?? 'TARGET_INVALID', 'The control-flow target cannot be resolved.', raw.diagnostics ?? [])

  const nodes = raw.nodes.map((node) => {
    const source = node.sourceId ? prepared.index.nodes.get(node.sourceId) : null
    const info = moduleInfo(prepared.index, source?.moduleId ?? null)
    return {
      ...node,
      entity: node.kind === 'entry' || node.kind === 'exit' ? node.kind : 'instruction',
      label: node.name || node.kind || node.id,
      moduleId: source?.moduleId ?? null,
      moduleName: info.moduleName,
      type: node.sourceId ? prepared.index.nodeTypes.get(node.sourceId) ?? null : null,
      reachable: node.reachable !== false,
    }
  })
  const entry = raw.nodes.find((node) => node.kind === 'entry')?.id ?? null
  const exit = raw.nodes.find((node) => node.kind === 'exit')?.id ?? null
  return createGraph({
    kind: 'control-flow',
    projectId: prepared.project.id,
    rootId: raw.rootId,
    rootKind: raw.rootKind,
    scope: raw.scope,
    nodes,
    edges: raw.edges.map((edge) => ({ ...edge, directed: true })),
    metadata: {
      incomplete: raw.incomplete || !prepared.analysis.canGenerate,
      diagnostics: prepared.analysis.diagnostics ?? [],
      unresolvedNodeIds: [],
      entryId: entry,
      exitId: exit,
      functionId: raw.scope === 'function' ? raw.rootId : null,
      moduleId: resolved.target.kind === 'module' ? resolved.target.id : prepared.index.nodes.get(raw.rootId)?.moduleId ?? null,
      unreachableNodeIds: raw.nodes.filter((node) => node.reachable === false).map((node) => node.sourceId).filter(Boolean),
      includeUnreachable: options.includeUnreachable !== false,
    },
  })
}

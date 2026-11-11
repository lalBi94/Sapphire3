import { GRAPH_ERROR_CODES, GraphError } from './errors.js'
import { assertGraphShape, compareIds, edgeEndpoints, nodeLabel } from './helpers.js'

// Échappe une chaîne pour un identifiant ou un label Graphviz DOT.
function escapeDot(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
}

// Échappe un label Mermaid sans interpréter de HTML utilisateur.
function escapeMermaid(value, edge = false) {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '<br/>')
  return edge ? escaped.replace(/\|/g, '&#124;') : escaped
}

// Retourne les nœuds triés par identifiant.
function sortedNodes(graph) {
  return [...graph.nodes].filter((node) => node && typeof node.id === 'string').sort((left, right) => compareIds(left.id, right.id))
}

// Retourne les arêtes triées par extrémités, nature et identifiant.
function sortedEdges(graph) {
  return [...graph.edges].sort((left, right) => {
    const first = edgeEndpoints(left)
    const second = edgeEndpoints(right)
    return compareIds(
      `${first.from}|${first.to}|${left.kind ?? ''}|${left.id ?? ''}`,
      `${second.from}|${second.to}|${right.kind ?? ''}|${right.id ?? ''}`,
    )
  })
}

// Construit un export Graphviz DOT déterministe.
function exportDot(graph, options) {
  const name = escapeDot(options.graphName ?? graph.metadata?.projectId ?? graph.kind ?? 'SapphireGraph')
  const rankdir = ['LR', 'TB', 'RL', 'BT'].includes(options.direction) ? options.direction : 'LR'
  const lines = [
    `digraph "${name}" {`,
    `  graph [rankdir="${rankdir}"];`,
    '  node [shape="box", fontsize="10"];',
    '  edge [fontsize="9"];',
  ]
  for (const node of sortedNodes(graph)) {
    const attributes = [`label="${escapeDot(nodeLabel(node))}"`]
    if (['entry', 'exit'].includes(node.kind)) attributes.push('shape="ellipse"')
    else if (['module', 'class', 'project'].includes(node.kind)) attributes.push('shape="folder"')
    if (['unresolved', 'unresolved-call', 'unresolved-reference'].includes(node.kind)) attributes.push('style="dashed"')
    lines.push(`  "${escapeDot(node.id)}" [${attributes.join(', ')}];`)
  }
  for (const edge of sortedEdges(graph)) {
    const { from, to } = edgeEndpoints(edge)
    if (typeof from !== 'string' || typeof to !== 'string') continue
    const label = edge.label ?? edge.kind ?? ''
    const attributes = label ? [`label="${escapeDot(label)}"`] : []
    if (['unresolved', 'calls-unresolved', 'calls-indirect'].includes(edge.kind)) attributes.push('style="dashed"')
    lines.push(`  "${escapeDot(from)}" -> "${escapeDot(to)}"${attributes.length ? ` [${attributes.join(', ')}]` : ''};`)
  }
  lines.push('}')
  return lines.join('\n')
}

// Construit un export Mermaid flowchart avec des identifiants sûrs.
function exportMermaid(graph, options) {
  const direction = ['TD', 'TB', 'BT', 'RL', 'LR'].includes(options.direction) ? options.direction : 'LR'
  const nodes = sortedNodes(graph)
  const ids = new Map(nodes.map((node, position) => [node.id, `n${position}`]))
  const lines = [`flowchart ${direction}`]
  if (nodes.length === 0) lines.push('  %% empty graph')
  for (const node of nodes) {
    lines.push(`  ${ids.get(node.id)}["${escapeMermaid(nodeLabel(node))}"]`)
  }
  for (const edge of sortedEdges(graph)) {
    const { from, to } = edgeEndpoints(edge)
    if (!ids.has(from) || !ids.has(to)) continue
    const label = edge.label ?? edge.kind ?? ''
    lines.push(`  ${ids.get(from)} -->${label ? `|${escapeMermaid(label, true)}|` : ''} ${ids.get(to)}`)
  }
  return lines.join('\n')
}

/**
 * Exporte un graphe en JSON, Graphviz DOT ou Mermaid.
 * Les noms et labels sont échappés ; aucune bibliothèque de rendu n'est requise.
 */
export function exportGraph(graph, format = 'json', options = {}) {
  assertGraphShape(graph)
  const normalized = String(format).toLowerCase()
  if (normalized === 'json') return JSON.stringify(graph, null, options.pretty === false ? 0 : 2)
  if (normalized === 'dot' || normalized === 'graphviz') return exportDot(graph, options)
  if (normalized === 'mermaid' || normalized === 'mmd') return exportMermaid(graph, options)
  throw new GraphError(GRAPH_ERROR_CODES.unsupportedFormat, `Unsupported graph format: ${format}.`, { details: { format } })
}

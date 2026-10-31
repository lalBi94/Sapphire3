import { useId } from 'react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { buildDependencyGraph, buildControlFlowGraph, getNodeSchema } from '../../utils/logic/index.js'
import { kindLabel, diagnosticLabel, nodeSummary } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './NodeGraphPanel.css'

// Donne un libellé localisé aux sommets sans traduire les noms saisis.
function nodeLabel(node, index, t) {
  if (node.kind === 'entry' || node.kind === 'exit') return t(`graph.${node.kind}`)
  const source = index.nodes.get(node.sourceId)
  const kind = kindLabel(source?.kind ?? node.kind, t)
  const summary = source && !source.properties?.name ? nodeSummary(source, index, getNodeSchema(source.kind), t) : ''
  const label = source?.properties?.name ? `${source.properties.name} · ${kind}` : summary ? `${kind} · ${summary}` : kind
  const module = node.external ? index.modules.get(source?.moduleId) : null
  return module ? `${label} · ${module.name}` : label
}

// Dessine des arêtes dirigées et conserve une liste textuelle accessible des relations.
export default function NodeGraphPanel({ project, index, target, mode, onSelect, onClose }) {
  const markerId = useId().replace(/:/g, '')
  const { t } = useTranslation()
  const graph = mode === 'cfg' ? buildControlFlowGraph(project, target, index) : buildDependencyGraph(project, target, index)
  const positions = new Map(graph.nodes.map((node, position) => [node.id, { x: 28, y: 28 + position * 80 }]))
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const height = Math.max(180, graph.nodes.length * 80 + 30)
  const title = t(mode === 'cfg' ? 'graph.cfg' : 'graph.dependencies')
  const root = graph.rootKind === 'module' ? index.modules.get(graph.rootId) : index.nodes.get(graph.rootId)

  // Ouvre les propriétés de la source sans fermer ni déplacer le graphe courant.
  function selectNode(node) {
    if (node.sourceId) onSelect({ kind: 'node', id: node.sourceId })
  }

  return <FloatingPanel className="node-graph-panel" title={title} onClose={onClose}>
    <p className="node-graph-panel__scope">{root?.properties?.name ?? root?.name ?? target.id}</p>
    <p>{t(mode === 'cfg' ? 'graph.cfgHint' : 'graph.dependenciesHint')}</p>
    {!graph.ok ? <p role="status">{diagnosticLabel(graph.code, t)}</p> : <>
      {(graph.incomplete || graph.unresolvedNodeIds?.length > 0) && <p role="status">{t('graph.incomplete')}</p>}
      {graph.nodes.length === 0 ? <p>{t('graph.empty')}</p> : <div className="node-graph-panel__viewport" tabIndex={0} role="region" aria-label={title}>
        <svg width="740" height={height} viewBox={`0 0 740 ${height}`} role="group" aria-label={title}>
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="currentColor" /></marker></defs>
          {graph.edges.map((edge, position) => {
            const from = positions.get(edge.from)
            const to = positions.get(edge.to)
            if (!from || !to) return null
            const lane = 370 + (position % 9) * 36
            const y1 = from.y + 23
            const y2 = to.y + 23
            const path = edge.from === edge.to ? `M328 ${y1} C${lane} ${y1 - 50}, ${lane} ${y1 + 50}, 328 ${y1 + 10}` : `M328 ${y1} C${lane} ${y1}, ${lane} ${y2}, 328 ${y2}`
            return <g key={`${edge.from}:${edge.to}:${edge.kind}:${position}`} className={`node-graph-panel__edge node-graph-panel__edge--${edge.kind}`}>
              <path d={path} markerEnd={`url(#${markerId})`}><title>{t(`graph.edge.${edge.kind}`)}</title></path>
              {edge.kind !== 'contains' && edge.kind !== 'next' && <text x={lane - 12} y={(y1 + y2) / 2 - 5}>{t(`graph.edge.${edge.kind}`)}</text>}
            </g>
          })}
          {graph.nodes.map((node) => {
            const position = positions.get(node.id)
            const label = nodeLabel(node, index, t)
            return <g key={node.id} transform={`translate(${position.x} ${position.y})`} className={`node-graph-panel__node${node.sourceId === target.id ? ' node-graph-panel__node--selected' : ''}${node.external ? ' node-graph-panel__node--external' : ''}${node.reachable === false ? ' node-graph-panel__node--unreachable' : ''}`} role={node.sourceId ? 'button' : 'group'} tabIndex={node.sourceId ? 0 : undefined} aria-label={`${label}${node.external ? ` · ${t('graph.external')}` : ''}`} onClick={() => selectNode(node)} onKeyDown={(event) => { if (node.sourceId && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectNode(node) } }}>
              <title>{label}{node.sourceId ? ` · ${node.sourceId}` : ''}</title><rect width="300" height="46" rx="12" /><text x="12" y="28">{label.length > 39 ? `${label.slice(0, 38)}…` : label}</text>
            </g>
          })}
        </svg>
      </div>}
      <details className="node-graph-panel__relations"><summary>{t('graph.relations', { count: graph.edges.length })}</summary>
        <ul>{graph.edges.map((edge, position) => <li key={position}>{nodeLabel(byId.get(edge.from), index, t)} → <strong>{t(`graph.edge.${edge.kind}`)}</strong> → {nodeLabel(byId.get(edge.to), index, t)}</li>)}</ul>
      </details>
    </>}
  </FloatingPanel>
}

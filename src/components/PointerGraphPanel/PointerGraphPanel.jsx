import { useTranslation } from '../../contexts/LanguageContext.jsx'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { buildPointerGraph, memoryValue } from '../../utils/memorySpace.js'
import { kindLabel, typeLabel } from '../LogicTree/logicLabels.js'
import './PointerGraphPanel.css'

const cardWidth = 208
const columnGap = 92
const padding = 16
const groupHeader = 34
const variableGap = 10
const cellHeight = 22
const variableHeight = 58

// Calcule une disposition verticale stable : une colonne par portée active, cases incluses.
function layout(graph) {
  const positions = new Map()
  const groups = []
  let x = padding
  let maximumHeight = 120

  for (const group of graph.groups) {
    let y = groupHeader
    for (const variable of group.variables) {
      const height = variableHeight + (variable.cells.length > 0 ? 8 + variable.cells.length * cellHeight : 0)
      positions.set(variable.id, { x: x + 8, y, width: cardWidth - 16, height })
      variable.cells.forEach((cell, position) => {
        positions.set(cell.id, { x: x + 8, y: y + variableHeight + 8 + position * cellHeight, width: cardWidth - 16, height: cellHeight })
      })
      y += height + variableGap
    }
    const height = Math.max(72, y + 8)
    groups.push({ ...group, x, y: 0, width: cardWidth, height })
    maximumHeight = Math.max(maximumHeight, height + padding)
    x += cardWidth + columnGap
  }

  return { groups, positions, width: Math.max(300, x - columnGap + padding), height: maximumHeight }
}

// Dessine une arête courbe entre deux emplacements du graphe, dans les deux directions.
function edgePath(from, to) {
  const reverse = to.x < from.x
  const startX = reverse ? from.x : from.x + from.width
  const endX = reverse ? to.x + to.width : to.x
  const startY = from.y + from.height / 2
  const endY = to.y + to.height / 2
  const bend = Math.max(32, Math.abs(endX - startX) / 2)
  const direction = reverse ? -1 : 1
  return `M ${startX} ${startY} C ${startX + direction * bend} ${startY}, ${endX - direction * bend} ${endY}, ${endX} ${endY}`
}

// Affiche les pointeurs, les tableaux et les portées actives du point d'arrêt courant.
export default function PointerGraphPanel({ index, frame, onClose }) {
  const { t } = useTranslation()
  const graph = buildPointerGraph(index, frame)
  const placed = layout(graph)
  const unresolved = graph.edges.filter((edge) => !edge.resolved).length

  // Retrouve le libellé d'une portée active sans confondre module et fonction.
  function scopeName(group) {
    if (group.kind === 'global') return t('pointerGraph.globals')
    const node = index.nodes.get(group.nodeId)
    return node?.properties?.name || kindLabel(node?.kind ?? 'Block', t)
  }

  return <FloatingPanel title={t('pointerGraph.title')} label={t('pointerGraph.title')} info={t('pointerGraph.hint')} onClose={onClose} className="pointer-graph-panel">
    {graph.variables.length === 0 ? <p className="pointer-graph__empty">{t('pointerGraph.empty')}</p> : <>
      <p className="pointer-graph__legend">{t('pointerGraph.legend', { count: graph.edges.length })}{unresolved > 0 ? ` · ${t('pointerGraph.unresolved', { count: unresolved })}` : ''}</p>
      <div className="pointer-graph" style={{ width: placed.width, height: placed.height }}>
        {placed.groups.map((group) => <section key={group.id} className="pointer-graph__scope" style={{ left: group.x, top: group.y, width: group.width, height: group.height }}>
          <h3>{scopeName(group)}{group.address && <code>{group.address}</code>}</h3>
        </section>)}
        <svg className="pointer-graph__edges" width={placed.width} height={placed.height} aria-hidden="true">
          <defs><marker id="pointer-graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" /></marker></defs>
          {graph.edges.filter((edge) => edge.resolved).map((edge) => {
            const from = placed.positions.get(edge.from)
            const to = placed.positions.get(edge.to)
            if (!from || !to) return null
            return <path key={edge.id} className={`pointer-graph__edge pointer-graph__edge--${edge.kind}`} d={edgePath(from, to)} markerEnd="url(#pointer-graph-arrow)"><title>{edge.label}</title></path>
          })}
        </svg>
        {graph.groups.flatMap((group) => group.variables).map((variable) => <div key={variable.id} className={`pointer-graph__variable${variable.pointer ? ' pointer-graph__variable--pointer' : ''}`} style={{ left: placed.positions.get(variable.id)?.x, top: placed.positions.get(variable.id)?.y, width: placed.positions.get(variable.id)?.width, height: placed.positions.get(variable.id)?.height }}>
          <div className="pointer-graph__head"><code>{variable.address}</code><strong>{variable.name}</strong><small>{typeLabel(variable.type, t)}</small></div>
          <div className="pointer-graph__value">{variable.pointer ? <><span className="pointer-graph__badge">{t('pointerGraph.pointer')}</span>{variable.pointer.label}</> : variable.array ? t('pointerGraph.arrayLength', { count: variable.array.length }) : variable.initialized ? memoryValue(variable.value) : t('debug.uninitialized')}</div>
          {variable.cells.length > 0 && <ul className="pointer-graph__cells">
            {variable.cells.map((cell) => <li key={cell.id}><code>{cell.address}</code><span>[{cell.index}]</span><strong>{cell.value}</strong></li>)}
          </ul>}
        </div>)}
      </div>
    </>}
  </FloatingPanel>
}

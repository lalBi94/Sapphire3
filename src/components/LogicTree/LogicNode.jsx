import { getNodeSchema } from '../../utils/logic/index.js'
import { kindLabel, nodeSummary } from './logicLabels.js'

// Rend une construction avec ses slots ; les cycles ou liens manquants restent des fragments lisibles.
export default function LogicNode({ id, index, selectedId, onSelect, ancestors, collapsedIds, onToggle }) {
  const node = index.nodes.get(id)
  const schema = node ? getNodeSchema(node.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => entry.location.nodeId === id)
  const slots = Object.entries(schema?.slots ?? {})
  const collapsed = collapsedIds.has(id)
  const name = node?.properties?.name || kindLabel(node?.kind ?? '')
  const summary = node ? nodeSummary(node, index, schema) : ''

  // L'événement ne remonte pas à un autre nœud ou au module contenant la sélection.
  function handleSelect(event) {
    event.stopPropagation()
    onSelect({ kind: 'node', id })
  }

  // Le pliage reste une présentation locale et ne sélectionne pas le nœud.
  function handleToggle(event) {
    event.stopPropagation()
    onToggle(id)
  }

  if (!node) return <p className="logic-tree__missing">Missing node: {String(id)}</p>
  if (ancestors.includes(id) || ancestors.length >= 60) return <p className="logic-tree__missing">Cyclic or deeply nested fragment: {id}</p>
  return (
    <section className={`logic-node${selectedId === id ? ' logic-node--selected' : ''}${collapsed ? ' logic-node--collapsed' : ''}`} data-source-node={id} aria-label={name} onClick={handleSelect}>
      <div className="logic-node__header">
        <button type="button" className="logic-node__toggle" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${name}`} onClick={handleToggle}>{collapsed ? '▸' : '▾'}</button>
        <button type="button" className="logic-node__heading" onClick={handleSelect} aria-pressed={selectedId === id}>
          <span>{kindLabel(node.kind)}{node.properties?.name ? ` · ${node.properties.name}` : ''}</span>
          {diagnostics.length > 0 && <span className="logic-node__issues" aria-label={`${diagnostics.length} diagnostics`}>{diagnostics.length}</span>}
        </button>
      </div>
      {summary && <div className={`logic-node__summary${collapsed ? ' logic-node__summary--collapsed' : ''}`}>{summary}</div>}
      {!collapsed && slots.map(([slotName, slot]) => {
        const value = node.children?.[slotName]
        const children = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        return <div className="logic-node__slot" data-slot={slotName} key={slotName}>
          <span className="logic-node__slot-label">{slotName}{slot.many ? ` [${children.length}]` : ''}</span>
          {children.length === 0 ? <span className="logic-node__empty">{slot.required ? 'Incomplete' : 'Empty'}</span> : children.map((childId, position) => <LogicNode key={`${childId}:${position}`} id={childId} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[...ancestors, id]} collapsedIds={collapsedIds} onToggle={onToggle} />)}
        </div>
      })}
    </section>
  )
}

import { ChevronDown, ChevronRight } from 'lucide-react'
import { getNodeSchema } from '../../utils/logic/index.js'
import { kindLabel, nodeSummary, slotLabel } from './logicLabels.js'
import NodeMenuButton from '../NodeMenuButton/NodeMenuButton.jsx'

// Rend une construction avec ses slots ; les cycles ou liens manquants restent des fragments lisibles.
export default function LogicNode({ id, index, selectedId, onSelect, ancestors, expandedIds, onToggle, onOpenActions }) {
  const node = index.nodes.get(id)
  const schema = node ? getNodeSchema(node.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => entry.location.nodeId === id)
  const slots = Object.entries(schema?.slots ?? {})
  const expanded = expandedIds.has(id)
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

  if (!node) return <p className="logic-tree__missing">This block is missing.</p>
  if (ancestors.includes(id) || ancestors.length >= 60) return <p className="logic-tree__missing">This block cannot be shown here.</p>
  return (
    <section className={`logic-node${selectedId === id ? ' logic-node--selected' : ''}${expanded ? '' : ' logic-node--collapsed'}`} data-source-node={id} data-group={schema?.group ?? 'incomplete'} aria-label={name} onClick={handleSelect}>
      <NodeMenuButton label={name} onOpen={(event) => onOpenActions(event, { kind: 'node', id })} />
      <div className="logic-node__header">
        <button type="button" className="logic-node__toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`} onClick={handleToggle}>
          {expanded ? <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /> : <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" className="logic-node__heading" onClick={handleSelect} aria-pressed={selectedId === id}>
          <span>{kindLabel(node.kind)}{node.properties?.name ? ` · ${node.properties.name}` : ''}</span>
          {node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true && <span className="logic-node__entry-point">Start here</span>}
          {diagnostics.length > 0 && <span className="logic-node__issues" aria-label={`${diagnostics.length} issues`}>{diagnostics.length}</span>}
        </button>
      </div>
      {summary && <div className={`logic-node__summary${expanded ? '' : ' logic-node__summary--collapsed'}`}>{summary}</div>}
      {expanded && slots.map(([slotName, slot]) => {
        const value = node.children?.[slotName]
        const children = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        return <div className="logic-node__slot" data-slot={slotName} key={slotName}>
          <span className="logic-node__slot-label">{slotLabel(slotName)}{slot.many ? ` [${children.length}]` : ''}</span>
          {children.length === 0 ? <span className="logic-node__empty">{slot.required ? 'Add something' : 'Empty'}</span> : children.map((childId, position) => <LogicNode key={`${childId}:${position}`} id={childId} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[...ancestors, id]} expandedIds={expandedIds} onToggle={onToggle} onOpenActions={onOpenActions} />)}
        </div>
      })}
    </section>
  )
}

import { getNodeSchema } from '../../utils/logic/index.js'
import { kindLabel, typeLabel } from './logicLabels.js'

// Rend une construction avec ses slots ; les cycles ou liens manquants restent des fragments lisibles.
export default function LogicNode({ id, index, selectedId, onSelect, ancestors }) {
  const node = index.nodes.get(id)
  const schema = node ? getNodeSchema(node.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => entry.location.nodeId === id)
  const slots = Object.entries(schema?.slots ?? {})

  // L'événement ne remonte pas à un autre nœud ou au module contenant la sélection.
  function handleSelect(event) {
    event.stopPropagation()
    onSelect({ kind: 'node', id })
  }

  if (!node) return <p className="logic-tree__missing">Missing node: {String(id)}</p>
  if (ancestors.includes(id) || ancestors.length >= 60) return <p className="logic-tree__missing">Cyclic or deeply nested fragment: {id}</p>
  return (
    <section className={`logic-node${selectedId === id ? ' logic-node--selected' : ''}`} data-source-node={id} aria-label={node.properties?.name || kindLabel(node.kind)} onClick={handleSelect}>
      <button type="button" className="logic-node__heading" onClick={handleSelect} aria-pressed={selectedId === id}>
        <span>{kindLabel(node.kind)}{node.properties?.name ? ` · ${node.properties.name}` : ''}</span>
        {diagnostics.length > 0 && <span className="logic-node__issues" aria-label={`${diagnostics.length} diagnostics`}>{diagnostics.length}</span>}
      </button>
      <div className="logic-node__summary">
        {['Literal', 'BinaryExpression', 'UnaryExpression'].includes(node.kind) && <span>{node.kind === 'Literal' ? (Object.hasOwn(node.properties, 'value') ? String(node.properties.value) : 'No value') : node.properties.operator || 'No operator'}</span>}
        {schema?.category === 'expression' || schema?.named ? <span>{typeLabel(index.nodeTypes.get(id))}</span> : null}
      </div>
      {slots.map(([name, slot]) => {
        const value = node.children?.[name]
        const children = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        return <div className="logic-node__slot" data-slot={name} key={name}>
          <span className="logic-node__slot-label">{name}{slot.many ? ` [${children.length}]` : ''}</span>
          {children.length === 0 ? <span className="logic-node__empty">{slot.required ? 'Incomplete' : 'Empty'}</span> : children.map((childId, position) => <LogicNode key={`${childId}:${position}`} id={childId} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[...ancestors, id]} />)}
        </div>
      })}
    </section>
  )
}

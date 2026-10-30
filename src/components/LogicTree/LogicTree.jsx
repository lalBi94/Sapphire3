import { useEffect, useRef, useState } from 'react'
import LogicNode from './LogicNode.jsx'
import './LogicTree.css'

// Rassemble les nœuds du module pour repérer ceux réellement ajoutés entre deux rendus.
function moduleNodeIds(module, index) {
  const ids = new Set()
  for (const node of index.nodes.values()) {
    if (node.moduleId === module.id) ids.add(node.id)
  }
  return ids
}

// Parcourt les racines source dans leur ordre ; les nœuds sont pliés tant qu'ils ne sont pas dépliés.
export default function LogicTree({ module, index, selectedId, onSelect }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const knownIds = useRef(null)

  // Déplie les nœuds ajoutés après le montage, ainsi que leurs parents, sans rouvrir l'existant.
  useEffect(() => {
    const current = moduleNodeIds(module, index)
    const previous = knownIds.current
    knownIds.current = current
    if (!previous) return
    const added = [...current].filter((id) => !previous.has(id))
    if (added.length === 0) return
    setExpandedIds((ids) => {
      const next = new Set(ids)
      for (const id of added) {
        let cursor = id
        const visited = new Set()
        while (cursor && !visited.has(cursor)) {
          visited.add(cursor)
          next.add(cursor)
          const parent = index.parents.get(cursor)?.[0]
          cursor = parent?.kind === 'node' ? parent.id : null
        }
      }
      return next
    })
  }, [module, index])

  // Mémorise seulement les nœuds explicitement dépliés, sans toucher à la source logique.
  function handleToggle(id) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="logic-tree" data-canvas-scroll>
      {module.rootNodeIds.length === 0 && <p className="logic-tree__empty">Right-click to add nodes.</p>}
      {module.rootNodeIds.map((id, position) => <LogicNode key={`${id}:${position}`} id={id} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[]} expandedIds={expandedIds} onToggle={handleToggle} />)}
    </div>
  )
}

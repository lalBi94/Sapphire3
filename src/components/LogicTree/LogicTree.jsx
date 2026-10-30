import { useState } from 'react'
import LogicNode from './LogicNode.jsx'
import './LogicTree.css'

// Parcourt les racines source dans leur ordre et conserve l'état de pliage local à la carte.
export default function LogicTree({ module, index, selectedId, onSelect }) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())

  // Bascule uniquement la présentation du nœud ciblé, sans toucher à la source logique.
  function handleToggle(id) {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="logic-tree" data-canvas-scroll>
      {module.rootNodeIds.length === 0 && <p className="logic-tree__empty">Right-click to add nodes.</p>}
      {module.rootNodeIds.map((id, position) => <LogicNode key={`${id}:${position}`} id={id} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[]} collapsedIds={collapsedIds} onToggle={handleToggle} />)}
    </div>
  )
}

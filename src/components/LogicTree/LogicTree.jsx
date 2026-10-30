import LogicNode from './LogicNode.jsx'
import './LogicTree.css'

// Parcourt les racines source dans leur ordre, indépendamment du rangement global des nœuds.
export default function LogicTree({ module, index, selectedId, onSelect }) {
  return (
    <div className="logic-tree" data-canvas-scroll>
      {module.rootNodeIds.length === 0 && <p className="logic-tree__empty">Right-click to add nodes.</p>}
      {module.rootNodeIds.map((id, position) => <LogicNode key={`${id}:${position}`} id={id} index={index} selectedId={selectedId} onSelect={onSelect} ancestors={[]} />)}
    </div>
  )
}

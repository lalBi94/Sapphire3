import { useState } from 'react'

// Demande une confirmation locale avant de retirer un nœud et ses descendants.
export default function DeleteNodeButton({ nodeId, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) return <button type="button" className="node-properties__delete" onClick={() => setConfirming(true)}>Delete node</button>
  return (
    <div className="node-properties__confirm" role="group" aria-label="Confirm deletion">
      <p>Delete this node and all of its child nodes? References to it remain and are reported.</p>
      <div>
        <button type="button" className="node-properties__delete" onClick={() => onDelete(nodeId)}>Confirm deletion</button>
        <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'

// Demande une confirmation locale avant de retirer une cible et son contenu.
export default function DeleteNodeButton({ targetId, kind = 'node', onDelete }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) return <button type="button" className="node-properties__delete" onClick={() => setConfirming(true)}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />Delete {kind}</button>
  return (
    <div className="node-properties__confirm" role="group" aria-label="Confirm deletion">
      <p>{kind === 'module' ? 'Delete this module and all of its nodes?' : 'Delete this node and all of its child nodes?'} References to it remain and are reported.</p>
      <div>
        <button type="button" className="node-properties__delete" onClick={() => onDelete(targetId)}><Check size={16} strokeWidth={1.75} aria-hidden="true" />Confirm deletion</button>
        <button type="button" onClick={() => setConfirming(false)}><X size={16} strokeWidth={1.75} aria-hidden="true" />Cancel</button>
      </div>
    </div>
  )
}

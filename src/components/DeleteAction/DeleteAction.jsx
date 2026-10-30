import { useEffect, useRef, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import './DeleteAction.css'

// Demande une confirmation locale avant de retirer une cible et son contenu.
export default function DeleteAction({ targetId, kind = 'node', onDelete, menu = false }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(null)
  const triggerRef = useRef(null)
  const restoreFocusRef = useRef(false)

  useEffect(() => {
    if (confirming) cancelRef.current.focus({ preventScroll: true })
    else if (restoreFocusRef.current) {
      triggerRef.current.focus({ preventScroll: true })
      restoreFocusRef.current = false
    }
  }, [confirming])

  // Ne masque pas un refus de suppression sur une cible devenue indisponible.
  function handleConfirm() {
    const result = onDelete(targetId)
    if (result?.ok === false) setError(result.code.replaceAll('_', ' '))
  }

  // Revient au bouton initial après une annulation, y compris dans un menu parcouru au clavier.
  function handleCancel() {
    restoreFocusRef.current = true
    setConfirming(false)
    setError('')
  }

  if (!confirming) return <div className="delete-action"><button ref={triggerRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={() => setConfirming(true)}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />Delete {kind}</button></div>
  return (
    <div className="delete-action" role="group" aria-label="Confirm deletion">
      <p>{kind === 'comment' ? 'Delete this comment?' : `${kind === 'module' ? 'Delete this module and all of its nodes?' : 'Delete this node and all of its child nodes?'} References to it remain and are reported.`}</p>
      <div className="delete-action__choices">
        <button type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={handleConfirm}><Check size={16} strokeWidth={1.75} aria-hidden="true" />Confirm deletion</button>
        <button ref={cancelRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button" onClick={handleCancel}><X size={16} strokeWidth={1.75} aria-hidden="true" />Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

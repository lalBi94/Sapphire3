import { useEffect, useRef, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import './DeleteAction.css'
import { useTranslation } from '../../i18n.jsx'

// Demande une confirmation locale avant de retirer une cible et son contenu.
export default function DeleteAction({ targetId, kind = 'node', onDelete, menu = false }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(null)
  const triggerRef = useRef(null)
  const restoreFocusRef = useRef(false)
  const targetLabel = kind === 'comment' ? t('canvas.note') : kind === 'image' ? t('canvas.image') : kind

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
    if (result?.ok === false) setError(t('errors.couldNotDelete'))
  }

  // Revient au bouton initial après une annulation, y compris dans un menu parcouru au clavier.
  function handleCancel() {
    restoreFocusRef.current = true
    setConfirming(false)
    setError('')
  }

  if (!confirming) return <div className="delete-action"><button ref={triggerRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={() => setConfirming(true)}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.delete')} {targetLabel}</button></div>
  return (
    <div className="delete-action" role="group" aria-label="Confirm delete">
      <p>{kind === 'comment' ? t('canvas.deleteNote') : kind === 'image' ? t('canvas.deleteImage') : `${kind === 'module' ? t('canvas.deleteModule') : t('canvas.deleteInside')} ${t('canvas.brokenLinks')}`}</p>
      <div className="delete-action__choices">
        <button type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={handleConfirm}><Check size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.delete')}</button>
        <button ref={cancelRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button" onClick={handleCancel}><X size={16} strokeWidth={1.75} aria-hidden="true" />{t('import.cancel')}</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

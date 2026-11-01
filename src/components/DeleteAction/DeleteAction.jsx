import { useEffect, useRef, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import './DeleteAction.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Décrit l'impact d'une suppression en appels, références et imports cassés.
function impactDetails(impact, t) {
  const count = (value, one, many) => t(value === 1 ? one : many, { count: value })
  return [
    impact.calls ? count(impact.calls, 'canvas.impactCall', 'canvas.impactCalls') : null,
    impact.references ? count(impact.references, 'canvas.impactReference', 'canvas.impactReferences') : null,
    impact.imports ? count(impact.imports, 'canvas.impactImport', 'canvas.impactImports') : null,
  ].filter(Boolean).join(', ')
}

// Demande une confirmation locale avant de retirer une cible et son contenu.
export default function DeleteAction({ targetId, kind = 'node', onDelete, onPreview, menu = false }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [impact, setImpact] = useState(null)
  const cancelRef = useRef(null)
  const triggerRef = useRef(null)
  const restoreFocusRef = useRef(false)
  const targetLabel = t(kind === 'comment' ? 'canvas.note' : kind === 'image' ? 'canvas.image' : kind === 'module' ? 'canvas.module' : 'canvas.block')

  useEffect(() => {
    if (confirming) cancelRef.current.focus({ preventScroll: true })
    else if (restoreFocusRef.current) {
      triggerRef.current.focus({ preventScroll: true })
      restoreFocusRef.current = false
    }
  }, [confirming])

  // Prépare l'aperçu d'impact au moment d'ouvrir la confirmation, sans le recalculer ensuite.
  function handleTrigger() {
    setImpact(onPreview ? onPreview() : null)
    setConfirming(true)
  }

  // Ne masque pas un refus de suppression sur une cible devenue indisponible.
  function handleConfirm() {
    const result = onDelete(targetId)
    if (result?.ok === false) setError('errors.couldNotDelete')
  }

  // Revient au bouton initial après une annulation, y compris dans un menu parcouru au clavier.
  function handleCancel() {
    restoreFocusRef.current = true
    setConfirming(false)
    setError('')
  }

  if (!confirming) return <div className="delete-action"><button ref={triggerRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={handleTrigger}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.delete')} {targetLabel}</button></div>
  return (
    <div className="delete-action" role="group" aria-label={t('canvas.confirmDelete')}>
      <p>{kind === 'comment' ? t('canvas.deleteNote') : kind === 'image' ? t('canvas.deleteImage') : `${kind === 'module' ? t('canvas.deleteModule') : t('canvas.deleteInside')} ${t('canvas.brokenLinks')}`}</p>
      {impact?.ok && impact.total > 0 && <p className="delete-action__impact" role="alert">{t('canvas.deleteImpact', { details: impactDetails(impact, t) })}</p>}
      <div className="delete-action__choices">
        <button type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button delete-action__button--danger" onClick={handleConfirm}><Check size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.delete')}</button>
        <button ref={cancelRef} type="button" role={menu ? 'menuitem' : undefined} className="delete-action__button" onClick={handleCancel}><X size={16} strokeWidth={1.75} aria-hidden="true" />{t('import.cancel')}</button>
      </div>
      {error && <p role="alert">{t(error)}</p>}
    </div>
  )
}

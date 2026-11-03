import { useState } from 'react'
import { Copy, Trash2, X } from 'lucide-react'
import { failureLabel } from '../../utils/translations.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './SelectionToolbar.css'

// Barre commune aux opérations groupées : duplication, suppression confirmée et fermeture.
export default function SelectionToolbar({ count, onDuplicate, onDelete, onClear }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  // Exécute une opération groupée et conserve un refus visible.
  function run(action) {
    const result = action()
    if (result?.ok === false) setError(result.code)
    else setError(null)
    return result
  }

  // Demande une confirmation locale avant de retirer plusieurs cibles.
  function handleDelete() {
    const result = run(onDelete)
    if (result?.ok) setConfirming(false)
  }

  return <div className="selection-toolbar" data-canvas-ui role="toolbar" aria-label={t('selection.title')} onPointerDown={(event) => event.stopPropagation()}>
    <span className="selection-toolbar__count">{t('selection.count', { count })}</span>
    {!confirming ? <>
      <button type="button" onClick={() => run(onDuplicate)}><Copy size={13} aria-hidden="true" />{t('selection.duplicate')}</button>
      <button type="button" className="selection-toolbar__danger" onClick={() => { setConfirming(true); setError(null) }}><Trash2 size={13} aria-hidden="true" />{t('selection.delete')}</button>
      <button type="button" aria-label={t('selection.clear')} title={t('selection.clear')} onClick={onClear}><X size={13} aria-hidden="true" /></button>
    </> : <>
      <span>{t('selection.confirmDelete', { count })}</span>
      <button type="button" className="selection-toolbar__danger" onClick={handleDelete}><Trash2 size={13} aria-hidden="true" />{t('canvas.delete')}</button>
      <button type="button" onClick={() => { setConfirming(false); setError(null) }}>{t('import.cancel')}</button>
    </>}
    {error && <span className="selection-toolbar__error" role="alert">{failureLabel({ code: error }, t)}</span>}
  </div>
}

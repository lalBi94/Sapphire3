import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { useNotifications } from '../../contexts/NotificationContext.jsx'
import { mascotForType, mascotStates } from '../../utils/mascot.js'
import './MascotNotification.css'

// Formate l'heure de l'historique dans la langue active, sans dépendre du thème.
function historyTime(timestamp, language) {
  return new Date(timestamp).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
}

// Affiche le robot, la notification courante et l'historique récent.
export default function MascotNotification({ hasMinimap = false }) {
  const { t, language } = useTranslation()
  const { active, history, dismiss, clearHistory } = useNotifications()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const rootRef = useRef(null)
  const closeTimer = useRef(null)
  const state = active ? mascotForType(active.type) : mascotStates.idle
  const isError = active?.type === 'error' || active?.type === 'transpile_failed' || active?.type === 'shortcut_conflict'

  useEffect(() => {
    setClosing(false)
    return () => window.clearTimeout(closeTimer.current)
  }, [active?.id, active?.updatedAt])

  useEffect(() => {
    if (!historyOpen) return undefined
    // Ferme l'historique au clic extérieur ou avec Échap, sans toucher au document.
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) setHistoryOpen(false)
    }
    function handleKey(event) {
      if (event.key === 'Escape') setHistoryOpen(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [historyOpen])

  // Laisse la bulle se refermer brièvement avant de libérer la notification.
  function closeActive(id) {
    if (!id) return
    setClosing(true)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      dismiss(id)
      setClosing(false)
    }, 140)
  }

  // Exécute une action puis referme la bulle si elle ne demande pas de rester ouverte.
  function runAction(action) {
    action.onClick?.(active)
    if (action.close !== false) closeActive(active?.id)
  }

  return <div
    ref={rootRef}
    className={`mascot-notification${hasMinimap ? ' mascot-notification--with-minimap' : ''}`}
    data-canvas-ui
    onPointerDown={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <button
      type="button"
      className={`mascot-notification__robot${active ? ' mascot-notification__robot--active' : ''}`}
      aria-label={t(historyOpen ? 'mascot.closeHistory' : 'mascot.open')}
      title={t(historyOpen ? 'mascot.closeHistory' : 'mascot.open')}
      onClick={() => setHistoryOpen((current) => !current)}
    >
      <img key={`${active?.id ?? 'idle'}:${active?.type ?? 'idle'}`} className="mascot-notification__image" src={state.src} alt="" aria-hidden="true" />
    </button>

    {historyOpen
      ? <section className="mascot-notification__bubble mascot-notification__history" role="dialog" aria-label={t('mascot.history')}>
        <header className="mascot-notification__header">
          <strong>{t('mascot.history')}</strong>
          <button type="button" className="mascot-notification__icon" aria-label={t('mascot.closeHistory')} onClick={() => setHistoryOpen(false)}><X size={14} aria-hidden="true" /></button>
        </header>
        {history.length === 0
          ? <p className="mascot-notification__empty">{t('mascot.historyEmpty')}</p>
          : <ol className="mascot-notification__list">{history.map((entry) => <li key={`${entry.id}:${entry.updatedAt}`}>
            <span className={`mascot-notification__dot mascot-notification__dot--${entry.type}`} aria-hidden="true" />
            <span className="mascot-notification__entry">
              {entry.title && <strong>{entry.title}</strong>}
              <span>{entry.message}</span>
            </span>
            <time dateTime={new Date(entry.updatedAt).toISOString()}>{historyTime(entry.updatedAt, language)}</time>
          </li>)}</ol>}
        {history.length > 0 && <button type="button" className="mascot-notification__clear" onClick={clearHistory}><Trash2 size={13} aria-hidden="true" />{t('mascot.clearHistory')}</button>}
      </section>
      : active && <section key={active.id} className={`mascot-notification__bubble mascot-notification__bubble--${active.type}${closing ? ' mascot-notification__bubble--leaving' : ''}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
        <header className="mascot-notification__header">
          {active.title && <strong>{active.title}</strong>}
          <button type="button" className="mascot-notification__icon" aria-label={t('mascot.dismiss')} onClick={() => closeActive(active.id)}><X size={14} aria-hidden="true" /></button>
        </header>
        <p className="mascot-notification__message">{active.message}</p>
        {active.actions.length > 0 && <div className="mascot-notification__actions">{active.actions.map((action) => <button type="button" key={action.label} onClick={() => runAction(action)}>{action.label}</button>)}</div>}
      </section>}
  </div>
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { useNotifications } from '../../contexts/NotificationContext.jsx'
import { mascotForType, mascotStates } from '../../utils/mascot.js'
import './MascotNotification.css'

// Formate l'heure de l'historique dans la langue active, sans dépendre du thème.
function historyTime(timestamp, language) {
  return new Date(timestamp).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
}

// Place la bulle à côté du robot sans jamais dépasser le canvas.
function bubblePlacement(position) {
  const margin = 8
  const gap = 10
  const roomRight = position.areaWidth - position.left - position.width - gap - margin
  const roomLeft = position.left - gap - margin
  const toLeft = roomRight < 220 && roomLeft > roomRight
  const roomUp = position.areaHeight - position.bottom - margin
  const roomDown = position.bottom + position.height - margin
  const upward = roomUp >= 220 || roomUp >= roomDown
  return {
    position: 'absolute',
    ...(toLeft ? { right: `calc(100% + ${gap}px)`, left: 'auto' } : { left: `calc(100% + ${gap}px)`, right: 'auto' }),
    ...(upward ? { bottom: 0, top: 'auto' } : { top: 0, bottom: 'auto' }),
    maxWidth: `${Math.round(Math.max(160, Math.min(360, toLeft ? roomLeft : roomRight)))}px`,
    maxHeight: `${Math.round(Math.max(140, Math.min(420, upward ? roomUp : roomDown)))}px`,
  }
}

// Affiche le robot, la notification courante et l'historique récent.
export default function MascotNotification({ hasMinimap = false }) {
  const { t, language } = useTranslation()
  const { active, history, dismiss, clearHistory } = useNotifications()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [robotPosition, setRobotPosition] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const rootRef = useRef(null)
  const robotRef = useRef(null)
  const closeTimer = useRef(null)
  const dragRef = useRef(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const state = active ? mascotForType(active.type) : mascotStates.idle
  const isError = active?.type === 'error' || active?.type === 'transpile_failed' || active?.type === 'shortcut_conflict'
  // La bulle est positionnée hors du flux pour rester visible, même après un déplacement.
  const bubbleBase = robotPosition ?? metrics
  const bubbleStyle = bubbleBase ? bubblePlacement(bubbleBase) : undefined

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

  // Mesure la position du robot et la borne au canvas, y compris après un redimensionnement.
  useLayoutEffect(() => {
    function measure() {
      const root = rootRef.current
      const parent = root?.offsetParent
      const robot = robotRef.current
      if (!root || !parent || !robot) return
      const area = parent.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      const robotRect = robot.getBoundingClientRect()
      setMetrics({
        left: rootRect.left - area.left,
        bottom: area.bottom - rootRect.bottom,
        areaWidth: area.width,
        areaHeight: area.height,
        width: robotRect.width,
        height: robotRect.height,
      })
      setRobotPosition((current) => current ? {
        ...current,
        left: Math.min(Math.max(8, current.left), Math.max(8, area.width - robotRect.width - 8)),
        bottom: Math.min(Math.max(8, current.bottom), Math.max(8, area.height - robotRect.height - 8)),
        areaWidth: area.width,
        areaHeight: area.height,
        width: robotRect.width,
        height: robotRect.height,
      } : current)
    }
    measure()
    window.addEventListener('resize', measure)
    const parent = rootRef.current?.offsetParent
    const observer = typeof ResizeObserver === 'function' && parent ? new ResizeObserver(measure) : null
    observer?.observe(parent)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [hasMinimap])

  // Capture le robot et mémorise sa position rendue dans le canvas.
  function handleRobotPointerDown(event) {
    if (event.button !== 0) return
    const root = rootRef.current
    const robot = robotRef.current
    const parent = root?.offsetParent
    if (!root || !robot || !parent) return
    const parentRect = parent.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const robotRect = robot.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rootRect.left - parentRect.left,
      bottom: parentRect.bottom - rootRect.bottom,
      width: robotRect.width,
      height: robotRect.height,
      areaWidth: parentRect.width,
      areaHeight: parentRect.height,
    }
    draggingRef.current = false
    suppressClickRef.current = false
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture indisponible */ }
  }

  // Déplace le robot librement, en le maintenant dans les limites du canvas.
  function handleRobotPointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!draggingRef.current && Math.hypot(dx, dy) < 4) return
    if (!draggingRef.current) {
      draggingRef.current = true
      setDragging(true)
    }
    suppressClickRef.current = true
    const margin = 8
    const left = Math.min(Math.max(margin, drag.left + dx), Math.max(margin, drag.areaWidth - drag.width - margin))
    const bottom = Math.min(Math.max(margin, drag.bottom - dy), Math.max(margin, drag.areaHeight - drag.height - margin))
    setRobotPosition({ left, bottom, areaWidth: drag.areaWidth, areaHeight: drag.areaHeight, width: drag.width, height: drag.height })
  }

  // Termine le glisser sans transformer le geste en ouverture d'historique.
  function handleRobotPointerEnd(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (draggingRef.current) {
      suppressClickRef.current = true
      draggingRef.current = false
      setDragging(false)
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* capture déjà libérée */ }
    }
  }

  // Ouvre ou referme l'historique, sauf après un vrai déplacement.
  function handleRobotClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setHistoryOpen((current) => !current)
  }

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
    style={robotPosition ? { left: `${robotPosition.left}px`, bottom: `${robotPosition.bottom}px` } : undefined}
    data-canvas-ui
    onPointerDown={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <button
      ref={robotRef}
      type="button"
      className={`mascot-notification__robot${active ? ' mascot-notification__robot--active' : ''}${dragging ? ' mascot-notification__robot--dragging' : ''}`}
      aria-label={t(historyOpen ? 'mascot.closeHistory' : 'mascot.open')}
      title={t(historyOpen ? 'mascot.closeHistory' : 'mascot.open')}
      onClick={handleRobotClick}
      onPointerDown={handleRobotPointerDown}
      onPointerMove={handleRobotPointerMove}
      onPointerUp={handleRobotPointerEnd}
      onPointerCancel={handleRobotPointerEnd}
      onLostPointerCapture={handleRobotPointerEnd}
    >
      <img key={`${active?.id ?? 'idle'}:${active?.type ?? 'idle'}`} className="mascot-notification__image" src={state.src} alt="" aria-hidden="true" draggable={false} />
    </button>

    {historyOpen
      ? <section className="mascot-notification__bubble mascot-notification__history" role="dialog" aria-label={t('mascot.history')} style={bubbleStyle}>
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
      : active && <section key={active.id} className={`mascot-notification__bubble mascot-notification__bubble--${active.type}${closing ? ' mascot-notification__bubble--leaving' : ''}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} style={bubbleStyle}>
        <header className="mascot-notification__header">
          {active.title && <strong>{active.title}</strong>}
          <button type="button" className="mascot-notification__icon" aria-label={t('mascot.dismiss')} onClick={() => closeActive(active.id)}><X size={14} aria-hidden="true" /></button>
        </header>
        <p className="mascot-notification__message">{active.message}</p>
        {active.actions.length > 0 && <div className="mascot-notification__actions">{active.actions.map((action) => <button type="button" key={action.label} onClick={() => runAction(action)}>{action.label}</button>)}</div>}
      </section>}
  </div>
}

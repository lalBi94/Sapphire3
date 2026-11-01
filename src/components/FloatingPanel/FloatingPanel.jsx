import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { snapPanelToArea } from '../../utils/panelSnap.js'
import './FloatingPanel.css'

// Partage les gestes et le cadre des fenêtres de propriétés et d'analyse.
export default function FloatingPanel({ title, label, onClose, className = '', children }) {
  const [geometry, setGeometry] = useState(null)
  const gestureRef = useRef(null)
  const { t } = useTranslation()

  // Mesure le panneau dans son canvas avant un geste souris ou clavier.
  function measure(element) {
    const panel = element.closest('[data-floating-panel]')
    const parent = panel?.offsetParent
    if (!parent) return null
    const bounds = panel.getBoundingClientRect()
    const area = parent.getBoundingClientRect()
    return { x: bounds.left - area.left, y: bounds.top - area.top, width: bounds.width, height: bounds.height, areaWidth: area.width, areaHeight: area.height }
  }

  // Borne la géométrie au canvas ; au pointeur, la fenêtre s'aimante aux bords proches.
  function apply(origin, dx, dy, resize, snap = false) {
    const maximumWidth = Math.max(240, origin.areaWidth - origin.x - 8)
    const maximumHeight = Math.max(180, origin.areaHeight - origin.y - 16)
    if (resize) {
      setGeometry({ x: origin.x, y: origin.y, width: Math.min(maximumWidth, Math.max(240, origin.width + dx)), height: Math.min(maximumHeight, Math.max(180, origin.height + dy)) })
      return
    }
    const x = Math.min(Math.max(8, origin.areaWidth - origin.width - 8), Math.max(8, origin.x + dx))
    const y = Math.min(Math.max(8, origin.areaHeight - origin.height - 8), Math.max(8, origin.y + dy))
    const position = snap ? snapPanelToArea({ x, y, width: origin.width, height: origin.height, areaWidth: origin.areaWidth, areaHeight: origin.areaHeight }) : { x, y }
    setGeometry({ ...position, width: origin.width, height: origin.height })
  }

  // Capture une seule interaction, depuis l'en-tête ou le coin de redimensionnement.
  function start(event, resize = false) {
    if (event.button !== 0 || gestureRef.current || (!resize && event.target.closest('button'))) return
    const origin = measure(event.currentTarget)
    if (!origin) return
    event.preventDefault()
    event.stopPropagation()
    // Le geste est enregistré avant la capture : une capture indisponible ne bloque pas le déplacement.
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin, resize }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture indisponible */ }
  }

  // Convertit le déplacement en pixels d'interface, indépendamment du zoom du canvas.
  function move(event) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    apply(gesture.origin, event.clientX - gesture.x, event.clientY - gesture.y, gesture.resize, true)
  }

  // Libère le geste après relâchement, annulation ou perte de capture.
  function end(event) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Offre les mêmes déplacements et dimensions aux flèches du clavier.
  function keyDown(event, resize = false) {
    if (event.target !== event.currentTarget) return
    const directions = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
    const direction = directions[event.key]
    if (!direction) return
    const origin = measure(event.currentTarget)
    if (!origin) return
    event.preventDefault()
    apply(origin, ...direction, resize)
  }

  const style = geometry ? { left: geometry.x, top: geometry.y, right: 'auto', bottom: 'auto', width: geometry.width, height: geometry.height } : undefined
  return <aside className={`floating-panel ${className}`} style={style} data-floating-panel data-canvas-ui data-canvas-scroll aria-label={label ?? title} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <header className="floating-panel__header" tabIndex={0} aria-label={t('details.move')} title={t('details.moveHint')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyDown}>
      <h2>{title}</h2><button type="button" aria-label={t('panel.close')} onClick={onClose}><X size={18} strokeWidth={1.75} aria-hidden="true" /></button>
    </header>
    <div className="floating-panel__content">{children}</div>
    <button className="floating-panel__resize" type="button" aria-label={t('details.resize')} title={t('details.resizeHint')} onPointerDown={(event) => start(event, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={(event) => keyDown(event, true)}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12l8-8M8 12l4-4" /></svg>
    </button>
  </aside>
}

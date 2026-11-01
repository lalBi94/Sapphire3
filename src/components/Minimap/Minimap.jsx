import { useEffect, useRef, useState } from 'react'
import { minimapLayout } from '../../utils/minimap.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './Minimap.css'

const mapWidth = 184
const mapHeight = 128
const keyboardStep = 40

// Affiche une vue miniature des modules avec le rectangle de la caméra, navigable au clic ou au clavier.
export default function Minimap({ modules = [], camera, zoom, canvasRef, onNavigate }) {
  const { t } = useTranslation()
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  // Suit la taille réelle de la surface pour convertir la vue en unités monde.
  useEffect(() => {
    const element = canvasRef?.current
    if (!element) return undefined
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [canvasRef])

  const layout = minimapLayout({ modules, camera, zoom, viewport, width: mapWidth, height: mapHeight })

  // Convertit un point écran de la mini-carte en centre de vue monde.
  function navigate(event) {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    onNavigate(layout.toWorldX(event.clientX - rect.left), layout.toWorldY(event.clientY - rect.top))
  }

  // Recentre la caméra dès l'appui, puis suit le doigt tant qu'il reste capturé.
  function handlePointerDown(event) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = event.pointerId
    navigate(event)
    // La capture échoue seulement pour un identifiant de pointeur non actif ; la navigation a déjà eu lieu.
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture indisponible */ }
  }

  function handlePointerMove(event) {
    if (dragRef.current !== event.pointerId) return
    event.stopPropagation()
    navigate(event)
  }

  function handlePointerEnd(event) {
    if (dragRef.current !== event.pointerId) return
    event.stopPropagation()
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Déplace la vue aux flèches pour rester utilisable sans souris.
  function handleKeyDown(event) {
    const moves = { ArrowLeft: [-keyboardStep, 0], ArrowRight: [keyboardStep, 0], ArrowUp: [0, -keyboardStep], ArrowDown: [0, keyboardStep] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    event.stopPropagation()
    onNavigate(camera.x + move[0], camera.y + move[1])
  }

  if (modules.length === 0) return null
  const viewWidth = Math.max(2, (layout.view.right - layout.view.left) * layout.scale)
  const viewHeight = Math.max(2, (layout.view.bottom - layout.view.top) * layout.scale)

  return <div
    ref={containerRef}
    className="minimap"
    role="button"
    tabIndex={0}
    aria-label={t('minimap.label')}
    title={t('minimap.hint')}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerEnd}
    onLostPointerCapture={handlePointerEnd}
    onKeyDown={handleKeyDown}
  >
    <svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true">
      {modules.map((module) => <rect key={module.id} className="minimap__module" x={layout.toPxX(module.x)} y={layout.toPxY(module.y)} width={Math.max(2, module.width * layout.scale)} height={Math.max(2, module.height * layout.scale)} rx="2" />)}
      <rect className="minimap__view" x={layout.toPxX(layout.view.left)} y={layout.toPxY(layout.view.top)} width={viewWidth} height={viewHeight} rx="2" />
    </svg>
  </div>
}

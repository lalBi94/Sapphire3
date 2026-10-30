import { useRef } from 'react'
import { minimumModuleSize, moduleTypes } from '../../utils/moduleTypes.js'
import './CanvasModule.css'

// Affiche un conteneur vide ancré dans le monde et redimensionnable depuis son angle.
export default function CanvasModule({ module, camera, zoom, onResize }) {
  const resizeRef = useRef(null)

  const definition = moduleTypes[module.type]

  // Mémorise les dimensions initiales et capture le geste sur la poignée.
  function handleResizeStart(event) {
    if (event.button !== 0 || resizeRef.current) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: module.width,
      height: module.height,
      zoom,
    }
  }

  // Convertit le déplacement écran en dimensions du monde, avec un minimum lisible.
  function handleResizeMove(event) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return

    const width = Math.max(minimumModuleSize.width, resize.width + (event.clientX - resize.x) / resize.zoom)
    const height = Math.max(minimumModuleSize.height, resize.height + (event.clientY - resize.y) / resize.zoom)
    if (Number.isFinite(width) && Number.isFinite(height)) onResize(module.id, width, height)
  }

  // Termine le redimensionnement après relâchement, annulation ou perte de capture.
  function handleResizeEnd(event) {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  // Rend les dimensions ajustables au clavier depuis la poignée.
  function handleResizeKeyDown(event) {
    const directions = {
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0],
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    onResize(
      module.id,
      Math.max(minimumModuleSize.width, module.width + direction[0]),
      Math.max(minimumModuleSize.height, module.height + direction[1]),
    )
  }

  return (
    <section
      className={`canvas-module canvas-module--${module.type}`}
      aria-label={definition.label}
      style={{
        left: `calc(50% + ${(module.x - camera.x) * zoom}px)`,
        top: `calc(50% + ${(module.y - camera.y) * zoom}px)`,
        width: module.width,
        height: module.height,
        transform: `scale(${zoom})`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="canvas-module__header">
        <span className="canvas-module__marker" aria-hidden="true" />
        <h2>{definition.label}</h2>
      </header>
      <button
        className="canvas-module__resize"
        type="button"
        aria-label={`Resize ${definition.label}`}
        title="Drag to resize. Arrow keys adjust the size."
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onLostPointerCapture={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 12l7-7M9 12l3-3" />
        </svg>
      </button>
    </section>
  )
}

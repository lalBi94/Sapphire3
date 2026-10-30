import { useState } from 'react'
import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import CanvasStatus from '../CanvasStatus/CanvasStatus.jsx'
import CanvasContextMenu from '../CanvasContextMenu/CanvasContextMenu.jsx'
import CanvasModule from '../CanvasModule/CanvasModule.jsx'
import { moduleTypes } from '../../utils/moduleTypes.js'
import './Canvas.css'

// Assemble la surface de programmation et son déplacement libre.
export default function Canvas() {
  const [modules, setModules] = useState([])
  const [contextMenu, setContextMenu] = useState(null)
  const {
    camera,
    zoom,
    canvasRef,
    isPanning,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleKeyDown,
    handleRecenter,
  } = useCanvasPan()

  // Positionne le menu dans la fenêtre et conserve le point de création dans le monde.
  function handleContextMenu(event) {
    event.preventDefault()
    if (event.target.closest('.canvas-status')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    setContextMenu({
      x: Math.max(8, Math.min(x, bounds.width - 192)),
      y: Math.max(8, Math.min(y, bounds.height - 96)),
      worldX: camera.x + (x - bounds.width / 2) / zoom,
      worldY: camera.y + (y - bounds.height / 2) / zoom,
    })
  }

  // Ferme le menu et rend le focus au canvas si l'action le demande.
  function handleCloseMenu(restoreFocus) {
    setContextMenu(null)
    if (restoreFocus) canvasRef.current.focus({ preventScroll: true })
  }

  // Crée seulement un conteneur visuel, sans interpréter son contenu.
  function handleCreateModule(type) {
    const definition = moduleTypes[type]
    if (!contextMenu || !definition) return
    setModules((current) => [...current, {
      id: crypto.randomUUID(),
      type,
      x: contextMenu.worldX,
      y: contextMenu.worldY,
      width: definition.width,
      height: definition.height,
    }])
    handleCloseMenu(true)
  }

  // Met à jour uniquement les dimensions du conteneur concerné.
  function handleResizeModule(id, width, height) {
    setModules((current) => current.map((module) => module.id === id ? { ...module, width, height } : module))
  }

  return (
    <main
      ref={canvasRef}
      className={`canvas${isPanning ? ' canvas--panning' : ''}`}
      aria-label="Programming canvas. Drag or use arrow keys to pan. Scroll to zoom. Right-click to create a module."
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      <CanvasGrid camera={camera} zoom={zoom} />
      {modules.map((module) => (
        <CanvasModule key={module.id} module={module} camera={camera} zoom={zoom} onResize={handleResizeModule} />
      ))}
      <CanvasStatus camera={camera} zoom={zoom} onRecenter={handleRecenter} />
      {contextMenu && (
        <CanvasContextMenu x={contextMenu.x} y={contextMenu.y} onCreate={handleCreateModule} onClose={handleCloseMenu} />
      )}
    </main>
  )
}

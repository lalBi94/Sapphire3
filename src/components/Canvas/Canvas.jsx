import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import './Canvas.css'

// Assemble la surface de programmation et son déplacement libre.
export default function Canvas() {
  const {
    position,
    isPanning,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleKeyDown,
  } = useCanvasPan()

  return (
    <main
      className={`canvas${isPanning ? ' canvas--panning' : ''}`}
      aria-label="Espace de programmation. Glissez pour vous déplacer, ou utilisez les flèches du clavier."
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <CanvasGrid position={position} />
    </main>
  )
}

import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import CanvasStatus from '../CanvasStatus/CanvasStatus.jsx'
import './Canvas.css'

// Assemble la surface de programmation et son déplacement libre.
export default function Canvas() {
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

  return (
    <main
      ref={canvasRef}
      className={`canvas${isPanning ? ' canvas--panning' : ''}`}
      aria-label="Espace de programmation. Glissez ou utilisez les flèches pour vous déplacer. Molette pour zoomer."
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <CanvasGrid camera={camera} zoom={zoom} />
      <CanvasStatus camera={camera} zoom={zoom} onRecenter={handleRecenter} />
    </main>
  )
}

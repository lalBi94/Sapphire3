import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import './Canvas.css'

// Réserve toute la fenêtre à la future surface de programmation.
export default function Canvas() {
  return (
    <main className="canvas" aria-label="Espace de programmation">
      <CanvasGrid />
    </main>
  )
}

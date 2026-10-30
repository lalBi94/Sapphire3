import './CanvasStatus.css'

// Garde les valeurs extrêmes lisibles sans afficher de faux zéros.
function formatValue(value, maximumFractionDigits = 1) {
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude >= 1e9 || magnitude < 0.01)) {
    return value.toExponential(2)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value === 0 ? 0 : value)
}

// Présente la position du milieu de la vue et l'action de retour à l'origine.
export default function CanvasStatus({ camera, zoom, onRecenter }) {
  return (
    <aside
      className="canvas-status"
      aria-label="Canvas position and zoom"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="canvas-status__position">
        <span>X <output>{formatValue(camera.x)}</output></span>
        <span>Y <output>{formatValue(camera.y)}</output></span>
      </span>
      <span className="canvas-status__zoom" aria-label="Zoom">
        {formatValue(zoom * 100)} %
      </span>
      <button type="button" onClick={onRecenter} title="Return to origin (0, 0)" aria-label="Return to origin (0, 0)">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 2v4m0 8v4M2 10h4m8 0h4" />
        </svg>
      </button>
    </aside>
  )
}

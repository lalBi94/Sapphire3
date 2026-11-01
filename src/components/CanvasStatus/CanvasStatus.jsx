import { Crosshair, EyeOff } from 'lucide-react'
import './CanvasStatus.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Garde les valeurs extrêmes lisibles sans afficher de faux zéros.
function formatValue(value, maximumFractionDigits = 1) {
  const magnitude = Math.abs(value)
  if (magnitude !== 0 && (magnitude >= 1e9 || magnitude < 0.01)) {
    return value.toExponential(2)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value === 0 ? 0 : value)
}

// Présente la position du milieu de la vue, le raccourci pour rouvrir les cartes masquées et le retour à l'origine.
export default function CanvasStatus({ camera, zoom, hiddenCount = 0, onShowAllHidden, onRecenter }) {
  const { t } = useTranslation()
  const hiddenLabel = hiddenCount === 0 ? null : hiddenCount === 1 ? t('canvas.hiddenOne') : t('canvas.hiddenCount', { count: hiddenCount })
  return (
    <aside
      className="canvas-status"
      aria-label={t('canvas.view')}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="canvas-status__position">
        <span>X <output>{formatValue(camera.x)}</output></span>
        <span>Y <output>{formatValue(camera.y)}</output></span>
      </span>
      <span className="canvas-status__zoom" aria-label={t('nav.zoom')}>
        {formatValue(zoom * 100)} %
      </span>
      {hiddenLabel && <button type="button" className="canvas-status__hidden" onClick={onShowAllHidden} title={t('canvas.showAll')} aria-label={`${t('canvas.showAll')} · ${hiddenLabel}`}>
        <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>{hiddenLabel}</span>
      </button>}
      <button type="button" onClick={onRecenter} title={t('canvas.center')} aria-label={t('canvas.center')}>
        <Crosshair size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </aside>
  )
}

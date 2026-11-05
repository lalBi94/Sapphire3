import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { heatmapDefaults } from '../../utils/logic/heatmapState.js'
import './HeatmapCard.css'

// Dessine les cellules au pas courant uniquement : aucune horloge ni séquence d'images.
export default function HeatmapCard({ card, dimensions = heatmapDefaults, state = null }) {
  const { t } = useTranslation()
  const width = state?.width ?? dimensions.width
  const height = state?.height ?? dimensions.height
  const values = state?.values ?? Array(width * height).fill(0)
  const maximum = Math.max(1, ...values.map(Math.abs))
  return <div className="heatmap-card" data-canvas-scroll>
    <div className="heatmap-card__grid" role="img" aria-label={t('heatmap.grid', { name: card.name, width, height })} style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, gridTemplateRows: `repeat(${height}, 1fr)` }}>
      {values.map((value, index) => <span key={index} className="heatmap-card__cell" title={`(${index % width}, ${Math.floor(index / width)}): ${value}`} style={{ '--heat': `${Math.abs(value) / maximum * 100}%` }} />)}
    </div>
  </div>
}

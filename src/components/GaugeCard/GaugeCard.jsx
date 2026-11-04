import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './GaugeCard.css'

// Convertit un ratio 0..1 en point sur l'arc, angles croissants dans le sens horaire.
function pointAt(ratio) {
  const angle = (135 + 270 * ratio) * (Math.PI / 180)
  return { x: 100 + 74 * Math.cos(angle), y: 100 + 74 * Math.sin(angle) }
}

// Arc de l'anneau entre deux ratios, avec le grand arc quand c'est nécessaire.
function arcPath(from, to) {
  const start = pointAt(from)
  const end = pointAt(to)
  const large = (to - from) * 270 > 180 ? 1 : 0
  return `M${start.x.toFixed(2)} ${start.y.toFixed(2)} A74 74 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

// Affiche une valeur numérique en retirant les zéros inutiles.
function formatValue(value) {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

// Jauge circulaire pilotée par le module caché, avec dégradé et halo du thème.
export default function GaugeCard({ card, state = null }) {
  const { t } = useTranslation()
  const min = state?.min ?? 0
  const max = state?.max ?? 100
  const value = state?.value ?? min
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
  const percent = Math.round(ratio * 100)
  const label = card.name || t('card.gauge')
  const ticks = Array.from({ length: 11 }, (_, index) => index / 10)

  return <div className="gauge-card" data-canvas-scroll>
    <svg className="gauge-card__svg" viewBox="0 0 200 200" role="img" aria-label={t('gauge.value', { name: label, value: formatValue(value), max: formatValue(max) })}>
      <defs>
        <linearGradient id={`gauge-arc-${card.id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="55%" stopColor="var(--color-node-condition)" />
          <stop offset="100%" stopColor="var(--color-selection)" />
        </linearGradient>
      </defs>
      <path className="gauge-card__track" d={arcPath(0, 1)} />
      {ticks.map((tick) => {
        const outer = pointAt(tick)
        const inner = { x: 100 + (outer.x - 100) * 0.84, y: 100 + (outer.y - 100) * 0.84 }
        return <line key={tick} className="gauge-card__tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
      })}
      {ratio > 0.001 && <path className="gauge-card__value" d={arcPath(0, ratio)} stroke={`url(#gauge-arc-${card.id})`} />}
      {ratio > 0.001 && <path className="gauge-card__glow" d={arcPath(0, ratio)} stroke={`url(#gauge-arc-${card.id})`} />}
      <text className="gauge-card__readout" x="100" y="94" textAnchor="middle">{formatValue(value)}</text>
      <text className="gauge-card__percent" x="100" y="116" textAnchor="middle">{percent}%</text>
      <text className="gauge-card__range" x="34" y="168" textAnchor="middle">{formatValue(min)}</text>
      <text className="gauge-card__range" x="166" y="168" textAnchor="middle">{formatValue(max)}</text>
    </svg>
  </div>
}
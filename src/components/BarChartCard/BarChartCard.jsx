import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import { barChartRows } from '../../utils/widgetData.js'
import './BarChartCard.css'

// Affiche une valeur numérique en retirant les zéros inutiles.
function formatValue(value) {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

// Graphique à barres piloté par le module caché, avec dégradé et halo du thème.
// Pendant la lecture des écrans, il suit les états capturés au même rythme de 24 fps.
export default function BarChartCard({ card, state = null, frames = null, playing = false }) {
  const { t } = useTranslation()
  const [frameIndex, setFrameIndex] = useState(0)
  const playbackRef = useRef(0)

  // Une nouvelle série d'images repart de la première.
  useEffect(() => {
    playbackRef.current = 0
    setFrameIndex(0)
  }, [frames])

  // Avance au rythme fixe des moniteurs, sans re-rendre tout le canvas.
  useEffect(() => {
    if (!frames?.length || !playing) return undefined
    const timer = window.setInterval(() => {
      playbackRef.current = (playbackRef.current + 1) % frames.length
      setFrameIndex(playbackRef.current)
    }, screenPlaybackFrameDelay)
    return () => window.clearInterval(timer)
  }, [frames, playing])

  const animated = frames?.length ? frames[Math.min(frameIndex, frames.length - 1)]?.[card.id] ?? null : null
  const current = animated ?? state
  const values = Array.isArray(current?.values) ? current.values : []
  const maximum = values.length > 0 ? Math.max(0, ...values) : 0
  const minimum = values.length > 0 ? Math.min(0, ...values) : 0
  const span = maximum - minimum || 1
  // La ligne zéro reste en bas pour des valeurs positives, en haut si tout est négatif.
  const baseline = values.some((value) => value < 0) ? (maximum / span) * 100 : 100
  const label = card.name || t('card.barChart')

  return <div className="bar-chart-card" data-canvas-scroll>
    <div className="bar-chart-card__head">
      <span className="bar-chart-card__name">{label}</span>
      <span className="bar-chart-card__count">{t('barChart.count', { count: values.length })}</span>
    </div>
    <div className="bar-chart-card__plot" role="img" aria-label={t('barChart.values', { name: label, count: values.length, min: formatValue(minimum), max: formatValue(maximum) })}>
      {values.length === 0
        ? <span className="bar-chart-card__empty">—</span>
        : <div className="bar-chart-card__bars" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
          <span className="bar-chart-card__baseline" style={{ top: `${baseline}%` }} aria-hidden="true" />
          {values.map((value, index) => {
            const height = (Math.abs(value) / span) * 100
            const style = value < 0
              ? { top: `${baseline}%`, height: `${height}%` }
              : { bottom: `${100 - baseline}%`, height: `${height}%` }
            if (value === 0) style.display = 'none'
            return <span className="bar-chart-card__slot" key={index} aria-hidden="true">
              <span className={`bar-chart-card__bar${value < 0 ? ' bar-chart-card__bar--negative' : ''}`} style={style} />
            </span>
          })}
        </div>}
    </div>
    <div className="bar-chart-card__meta">
      <span>{formatValue(minimum)}</span>
      <span>{formatValue(maximum)}</span>
    </div>
    {values.length > 0 && <table className="visually-hidden">
      <caption>{t('barChart.tableCaption', { name: label })}</caption>
      <thead><tr><th scope="col">{t('barChart.tablePosition')}</th><th scope="col">{t('barChart.tableValue')}</th></tr></thead>
      <tbody>
        {barChartRows(values).map((row) => <tr key={row.position}>
          <th scope="row">{row.position}</th>
          <td>{formatValue(row.value)}</td>
        </tr>)}
      </tbody>
    </table>}
  </div>
}

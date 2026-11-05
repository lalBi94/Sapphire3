import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import './ProgressCard.css'

// Affiche une valeur numérique en retirant les zéros inutiles.
function formatValue(value) {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

// Barre de progression pilotée par le module caché, avec dégradé et halo du thème.
// Pendant la lecture des écrans, elle suit les états capturés au même rythme de 24 fps.
export default function ProgressCard({ card, state = null, frames = null, playing = false }) {
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
  const min = current?.min ?? 0
  const max = current?.max ?? 100
  const value = current?.value ?? min
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
  const percent = Math.round(ratio * 100)
  const width = `${ratio * 100}%`
  const label = card.name || t('card.progress')

  return <div className="progress-card" data-canvas-scroll>
    <div className="progress-card__head">
      <span className="progress-card__name">{label}</span>
      <span className="progress-card__percent">{percent}%</span>
    </div>
    <div className="progress-card__track" role="img" aria-label={t('progress.value', { name: label, value: formatValue(value), max: formatValue(max) })}>
      <span className="progress-card__fill" style={{ width }} />
      <span className="progress-card__glow" style={{ width }} aria-hidden="true" />
    </div>
    <div className="progress-card__meta">
      <span>{formatValue(min)}</span>
      <span>{formatValue(value)} / {formatValue(max)}</span>
    </div>
  </div>
}

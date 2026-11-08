import { useEffect, useRef, useState } from 'react'
import { Coordinates, Mafs, Polyline } from 'mafs'
import 'mafs/core.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import './XyPlotCard.css'

// Traceur XY interactif : Mafs fournit le déplacement et le zoom, les points viennent du module caché.
export default function XyPlotCard({ card, state = null, frames = null, playing = false }) {
  const { t } = useTranslation()
  const [frameIndex, setFrameIndex] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const playbackRef = useRef(0)
  const frameRef = useRef(null)
  const viewRef = useRef({ revision: -1, viewBox: { x: [-10, 10], y: [-10, 10] } })

  // Une nouvelle série d'images repart de la première.
  useEffect(() => {
    playbackRef.current = 0
    setFrameIndex(0)
  }, [frames])

  // Suit les images d'écran au même rythme que les autres widgets.
  useEffect(() => {
    if (!frames?.length || !playing) return undefined
    const timer = window.setInterval(() => {
      playbackRef.current = (playbackRef.current + 1) % frames.length
      setFrameIndex(playbackRef.current)
    }, screenPlaybackFrameDelay)
    return () => window.clearInterval(timer)
  }, [frames, playing])

  // Mafs reçoit des dimensions explicites pour suivre le redimensionnement de la carte.
  useEffect(() => {
    const node = frameRef.current
    if (!node) return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize({ width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)) })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const animated = frames?.length ? frames[Math.min(frameIndex, frames.length - 1)]?.[card.id] ?? null : null
  const current = animated ?? state
  const points = current?.points ?? []
  const xMin = Number.isFinite(current?.xMin) ? current.xMin : -10
  const xMax = Number.isFinite(current?.xMax) ? current.xMax : 10
  const yMin = Number.isFinite(current?.yMin) ? current.yMin : -10
  const yMax = Number.isFinite(current?.yMax) ? current.yMax : 10
  const label = card.name || t('card.xyPlot')
  const revision = current?.revision ?? 0
  // Le cadrage ne bouge qu'à une nouvelle fonction ou un nouveau SET_RANGE, pas à chaque pas.
  if (revision !== viewRef.current.revision) {
    viewRef.current = { revision, viewBox: { x: [xMin, xMax], y: [yMin, yMax] } }
  }
  const viewBox = viewRef.current.viewBox

  return <div className="xy-plot-card" ref={frameRef} role="group" aria-label={t('xyPlot.summary', { name: label, count: points.length })}>
    {size.width > 0 && size.height > 0 && <Mafs
      key={`${card.id}:${revision}`}
      width={size.width}
      height={size.height}
      viewBox={viewBox}
      pan
      zoom
      preserveAspectRatio="contain"
    >
      <Coordinates.Cartesian />
      {points.length > 1 && <Polyline points={points} color="var(--color-primary)" weight={2} />}
    </Mafs>}
    {points.length < 2 && <p className="xy-plot-card__empty">{t('xyPlot.empty')}</p>}
  </div>
}

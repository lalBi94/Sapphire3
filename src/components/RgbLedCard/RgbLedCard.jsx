import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import './RgbLedCard.css'

// Borne un canal sur 0..255 et l'arrondit pour l'affichage.
function channel(value) {
  return Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0
}

// Affiche un voyant RVB : la couleur des trois canaux, avec un halo proportionnel.
// Pendant la lecture des écrans, il suit les états capturés au même rythme de 24 fps.
export default function RgbLedCard({ card, state = null, frames = null, playing = false }) {
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
  const name = card.name || t('card.rgbLed')
  const red = channel(current?.red)
  const green = channel(current?.green)
  const blue = channel(current?.blue)
  // Le halo suit le canal le plus lumineux ; le noir reste un voyant éteint.
  const intensity = Math.max(red, green, blue) / 255
  const style = {
    '--rgb-led-color': `rgb(${red} ${green} ${blue})`,
    '--rgb-led-spread': `${Math.round(3 + intensity * 19)}px`,
  }

  return <div className="rgb-led-card" data-canvas-scroll>
    <span className="rgb-led-card__lamp" role="img" style={style} aria-label={t('rgbLed.color', { name, red, green, blue })} />
    <span className="rgb-led-card__values" aria-hidden="true">{red} · {green} · {blue}</span>
  </div>
}

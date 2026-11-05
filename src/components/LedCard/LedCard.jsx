import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import './LedCard.css'

// Affiche un voyant booléen : éteint discret, allumé avec le dégradé et le halo du thème.
// Pendant la lecture des écrans, il suit les états capturés au même rythme de 24 fps.
export default function LedCard({ card, state = null, frames = null, playing = false }) {
  const { t } = useTranslation()
  const [frameIndex, setFrameIndex] = useState(0)
  const playbackRef = useRef(0)

  useEffect(() => {
    playbackRef.current = 0
    setFrameIndex(0)
  }, [frames])

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
  const name = card.name || t('card.led')
  const on = current?.value === true
  return <div className={`led-card${on ? ' led-card--on' : ''}`} data-canvas-scroll>
    <span className="led-card__lamp" role="img" aria-label={t(on ? 'led.on' : 'led.off', { name })} />
  </div>
}
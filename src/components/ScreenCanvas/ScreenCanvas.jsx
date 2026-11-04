import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { findFrameCycle } from '../../utils/screenPlayback.js'
import './ScreenCanvas.css'

// Peint un état d'écran en réutilisant la même ImageData pour éviter une allocation par frame.
function paintScreen(context, imageRef, state, fallbackWidth, fallbackHeight) {
  const width = state?.width ?? fallbackWidth
  const height = state?.height ?? fallbackHeight
  const pixels = state?.pixels ?? []
  let image = imageRef.current
  if (!image || image.width !== width || image.height !== height) {
    image = context.createImageData(width, height)
    imageRef.current = image
  }
  const data = image.data
  const length = width * height * 4
  for (let index = 0; index < length; index += 1) data[index] = pixels[index] ?? 0
  context.putImageData(image, 0, 0)
}

// Dessine le tampon RGBA de l'écran dans un canvas, sans allocation de grille DOM.
export default function ScreenCanvas({ card, state = null, frames = null, screenId = null, playing = false, readOnly = false, onScale }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const playbackRef = useRef(0)
  const playbackDirectionRef = useRef(1)
  const cycleRef = useRef(0)
  const framesRef = useRef(null)
  const width = state?.width ?? card.screenWidth ?? 15
  const height = state?.height ?? card.screenHeight ?? 9
  const pixels = state?.pixels ?? []
  const scale = Math.min(4, Math.max(0.25, Number(card.screenScale) || 1))
  const cell = Math.max(2, Math.round(8 * scale))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    paintScreen(canvas.getContext('2d'), imageRef, state, width, height)
  }, [state, width, height])

  // Rejoue les images capturées à environ 30 fps directement dans le canvas, sans état React par frame.
  // Une période détectée donne une boucle avant infinie et sans raccord ; sinon, aller-retour.
  useEffect(() => {
    if (framesRef.current !== frames) {
      framesRef.current = frames
      playbackRef.current = 0
      playbackDirectionRef.current = 1
      cycleRef.current = findFrameCycle(frames, screenId)
    }
    const canvas = canvasRef.current
    if (!canvas || !frames?.length || !screenId) return undefined
    const context = canvas.getContext('2d')
    const draw = () => {
      const frame = frames[Math.min(playbackRef.current, frames.length - 1)]?.[screenId] ?? null
      if (frame) paintScreen(context, imageRef, frame, width, height)
    }
    draw()
    if (!playing) return undefined
    const timer = window.setInterval(() => {
      const cycle = cycleRef.current
      if (cycle > 1) {
        // Boucle périodique : on repart à l'image 0 après la dernière image du cycle.
        playbackRef.current = (playbackRef.current + 1) % cycle
        draw()
        return
      }
      const last = frames.length - 1
      if (last <= 0) return
      let next = playbackRef.current + playbackDirectionRef.current
      if (next > last) {
        playbackDirectionRef.current = -1
        next = last - 1
      } else if (next < 0) {
        playbackDirectionRef.current = 1
        next = 1
      }
      playbackRef.current = next
      draw()
    }, 33)
    return () => window.clearInterval(timer)
  }, [frames, screenId, playing, width, height])

  // Modifie uniquement l'échelle de présentation, dans les bornes de la carte.
  function changeScale(delta) {
    const next = Math.min(4, Math.max(0.25, Math.round((scale + delta) * 100) / 100))
    if (next !== scale) onScale?.(next)
  }

  return <div className="screen-canvas" data-canvas-scroll>
    <div className="screen-canvas__viewport">
      <canvas ref={canvasRef} width={width} height={height} style={{ width: width * cell, height: height * cell }} aria-label={t('screen.title', { width, height })} />
    </div>
    <div className="screen-canvas__footer">
      <span>{width} × {height}</span>
      <span>{Math.round(scale * 100)}%</span>
      {!readOnly && <div className="screen-canvas__scale">
        <button type="button" aria-label={t('screen.scaleDown')} title={t('screen.scaleDown')} onClick={() => changeScale(-0.25)}><Minus size={12} aria-hidden="true" /></button>
        <button type="button" aria-label={t('screen.scaleUp')} title={t('screen.scaleUp')} onClick={() => changeScale(0.25)}><Plus size={12} aria-hidden="true" /></button>
      </div>}
    </div>
    {!state && !frames?.length && <p className="screen-canvas__idle">{t('screen.idle')}</p>}
  </div>
}

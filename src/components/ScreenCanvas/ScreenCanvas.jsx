import { useEffect, useRef, useState } from 'react'
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
// La taille vient uniquement de la carte : l'application choisit le meilleur ratio.
export default function ScreenCanvas({ card, state = null, frames = null, screenId = null, playing = false }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const imageRef = useRef(null)
  const playbackRef = useRef(0)
  const cycleRef = useRef(0)
  const framesRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const width = state?.width ?? card.screenWidth ?? 15
  const height = state?.height ?? card.screenHeight ?? 9

  // Suit la taille réelle du cadre : redimensionner la carte redimensionne l'écran.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const style = getComputedStyle(viewport)
      const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      setBox({ width: Math.max(0, viewport.clientWidth - horizontal), height: Math.max(0, viewport.clientHeight - vertical) })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    measure()
    return () => observer.disconnect()
  }, [])

  // Facteur entier le plus grand qui remplit le cadre sans jamais flouter les pixels.
  const cell = box.width > 0 && box.height > 0
    ? Math.max(1, Math.floor(Math.min(box.width / width, box.height / height)))
    : 1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    paintScreen(canvas.getContext('2d'), imageRef, state, width, height)
  }, [state, width, height])

  // Rejoue les images capturées à environ 30 fps directement dans le canvas, sans état React par frame.
  // La lecture avance toujours : elle boucle sur la période détectée, sinon sur toute la séquence.
  useEffect(() => {
    if (framesRef.current !== frames) {
      framesRef.current = frames
      playbackRef.current = 0
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
      const cycle = cycleRef.current > 1 ? cycleRef.current : frames.length
      if (cycle <= 1) return
      playbackRef.current = (playbackRef.current + 1) % cycle
      draw()
    }, 33)
    return () => window.clearInterval(timer)
  }, [frames, screenId, playing, width, height])

  return <div className="screen-canvas" data-canvas-scroll>
    <div ref={viewportRef} className="screen-canvas__viewport">
      <canvas ref={canvasRef} width={width} height={height} style={{ width: width * cell, height: height * cell }} aria-label={t('screen.title', { width, height })} />
    </div>
    <div className="screen-canvas__footer">
      <span>{width} × {height}</span>
    </div>
    {!state && !frames?.length && <p className="screen-canvas__idle">{t('screen.idle')}</p>}
  </div>
}
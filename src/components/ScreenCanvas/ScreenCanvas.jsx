import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './ScreenCanvas.css'

// Dessine le tampon RGBA de l'écran dans un canvas, sans allocation de grille DOM.
export default function ScreenCanvas({ card, state = null, readOnly = false, onScale }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const width = state?.width ?? card.screenWidth ?? 15
  const height = state?.height ?? card.screenHeight ?? 9
  const pixels = state?.pixels ?? []
  const scale = Math.min(4, Math.max(0.25, Number(card.screenScale) || 1))
  const cell = Math.max(2, Math.round(8 * scale))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, width, height)
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4
      const red = pixels[offset] ?? 0
      const green = pixels[offset + 1] ?? 0
      const blue = pixels[offset + 2] ?? 0
      const alpha = pixels[offset + 3] ?? 0
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`
      context.fillRect(index % width, Math.floor(index / width), 1, 1)
    }
  }, [pixels, width, height])

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
    {!state && <p className="screen-canvas__idle">{t('screen.idle')}</p>}
  </div>
}

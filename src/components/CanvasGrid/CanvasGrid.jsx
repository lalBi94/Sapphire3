import { useEffect, useRef, useState } from 'react'
import './CanvasGrid.css'

const width = 1600
const height = 1000
const spacing = 40

// Écarte progressivement les points périphériques pour courber la grille.
function distortPoint(x, y) {
  const normalizedX = (x - width / 2) / (width / 2)
  const normalizedY = (y - height / 2) / (height / 2)
  const distortion = 1 + 0.16 * (normalizedX ** 4 + normalizedY ** 4)

  return [
    width / 2 + (x - width / 2) * distortion,
    height / 2 + (y - height / 2) * distortion,
  ]
}

// Trace une ligne échantillonnée, droite au centre et incurvée aux extrémités.
function createLine(position, vertical) {
  const length = vertical ? height : width
  const points = []

  for (let offset = -spacing; offset <= length + spacing; offset += 10) {
    const [x, y] = distortPoint(
      vertical ? position : offset,
      vertical ? offset : position,
    )
    points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return points.join(' ')
}

// Répète uniquement les lignes visibles, même très loin de l'origine.
export default function CanvasGrid({ position }) {
  const [scale, setScale] = useState(1)
  const gridRef = useRef(null)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width: viewportWidth, height: viewportHeight } = entry.contentRect
      setScale(Math.max(viewportWidth / width, viewportHeight / height) || 1)
    })
    observer.observe(gridRef.current)
    return () => observer.disconnect()
  }, [])

  const offsetX = (((position.x / scale) % spacing) + spacing) % spacing
  const offsetY = (((position.y / scale) % spacing) + spacing) % spacing
  const lines = []

  for (let x = offsetX - spacing; x <= width + spacing; x += spacing) {
    lines.push(createLine(x, true))
  }

  for (let y = offsetY - spacing - 20; y <= height + spacing; y += spacing) {
    lines.push(createLine(y, false))
  }

  return (
    <svg
      ref={gridRef}
      className="canvas-grid"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path d={lines.join(' ')} />
    </svg>
  )
}

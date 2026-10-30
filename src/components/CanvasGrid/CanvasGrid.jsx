import { useEffect, useRef, useState } from 'react'
import './CanvasGrid.css'

// Écarte progressivement les points périphériques pour courber la grille.
function distortPoint(x, y, width, height) {
  const normalizedX = (x - width / 2) / (width / 2)
  const normalizedY = (y - height / 2) / (height / 2)
  const distortion = 1 + 0.16 * (normalizedX ** 4 + normalizedY ** 4)

  return [
    width / 2 + (x - width / 2) * distortion,
    height / 2 + (y - height / 2) * distortion,
  ]
}

// Trace une ligne échantillonnée dans la projection courbée du viewport.
function createLine(position, vertical, width, height) {
  const length = vertical ? height : width
  const points = []

  for (let offset = -80; offset <= length + 80; offset += 10) {
    const [x, y] = distortPoint(
      vertical ? position : offset,
      vertical ? offset : position,
      width,
      height,
    )
    points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return points.join(' ')
}

// Maintient une densité lisible quelle que soit l'échelle, avec une origine fixe.
export default function CanvasGrid({ camera, zoom, distorted = true }) {
  const [size, setSize] = useState({ width: 1600, height: 1000 })
  const gridRef = useRef(null)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(gridRef.current)
    return () => observer.disconnect()
  }, [])

  const { width, height } = size
  const spacing = 40 * 2 ** (camera.zoomLevel + Math.max(0, Math.ceil(-camera.zoomLevel)))
  const originX = width / 2 - camera.x * zoom
  const originY = height / 2 - camera.y * zoom
  const offsetX = ((originX % spacing) + spacing) % spacing
  const offsetY = ((originY % spacing) + spacing) % spacing
  const originVisible = originX >= 0 && originX <= width && originY >= 0 && originY <= height
  const [crossX, crossY] = originVisible ? distortPoint(originX, originY, width, height) : [0, 0]
  const lines = []

  for (let x = offsetX - spacing; x <= width + spacing; x += spacing) {
    lines.push(distorted ? createLine(x, true, width, height) : `M${x},0 L${x},${height}`)
  }

  for (let y = offsetY - spacing; y <= height + spacing; y += spacing) {
    lines.push(distorted ? createLine(y, false, width, height) : `M0,${y} L${width},${y}`)
  }

  return (
    <svg
      ref={gridRef}
      className="canvas-grid"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={lines.join(' ')} />
      {originVisible && (
        <path
          className="canvas-grid__origin"
          d={`M${crossX - 7},${crossY}h14 M${crossX},${crossY - 7}v14`}
        />
      )}
    </svg>
  )
}

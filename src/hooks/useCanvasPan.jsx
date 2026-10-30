import { useEffect, useRef, useState } from 'react'

// Gère une position libre sans agrandir la surface ni accumuler des éléments.
export default function useCanvasPan() {
  const [camera, setCamera] = useState({ x: 0, y: 0, zoomLevel: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const dragRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const element = canvasRef.current

    // Zoome autour du milieu de la vue sans déclencher le défilement du WebView.
    function handleWheel(event) {
      if (event.target.closest('input, textarea, [data-canvas-scroll]')) return
      event.preventDefault()
      if (dragRef.current) return

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit))
      setCamera((current) => {
        const zoomLevel = Math.min(2, current.zoomLevel - delta / 400)
        // Ne pas laisser la précision numérique produire une échelle nulle.
        if (2 ** zoomLevel === 0) return current
        return { ...current, zoomLevel }
      })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  const zoom = 2 ** camera.zoomLevel

  // Capture le pointeur pour poursuivre le déplacement hors de la surface.
  function handlePointerDown(event) {
    if (dragRef.current || (event.button !== 0 && event.button !== 1)) return

    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: camera,
      zoom,
    }
    setIsPanning(true)
  }

  // Calcule la translation depuis le début du geste, sans dépendre du rythme de rendu.
  function handlePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const x = drag.origin.x - (event.clientX - drag.x) / drag.zoom
    const y = drag.origin.y - (event.clientY - drag.y) / drag.zoom
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    setCamera({ ...drag.origin, x, y })
  }

  // Termine aussi les gestes annulés et les captures perdues.
  function handlePointerEnd(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return

    dragRef.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  // Permet également de parcourir la surface avec les flèches du clavier.
  function handleKeyDown(event) {
    if (dragRef.current) return

    const directions = {
      ArrowLeft: { x: -40, y: 0 },
      ArrowRight: { x: 40, y: 0 },
      ArrowUp: { x: 0, y: -40 },
      ArrowDown: { x: 0, y: 40 },
    }
    const direction = directions[event.key]
    if (!direction) return

    event.preventDefault()
    setCamera((current) => {
      const x = current.x + direction.x / zoom
      const y = current.y + direction.y / zoom
      return Number.isFinite(x) && Number.isFinite(y) ? { ...current, x, y } : current
    })
  }

  // Replace le milieu de la vue sur l'origine sans modifier le zoom choisi.
  function handleRecenter() {
    setCamera((current) => ({ ...current, x: 0, y: 0 }))
    canvasRef.current.focus({ preventScroll: true })
  }

  return {
    camera,
    zoom,
    canvasRef,
    isPanning,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleKeyDown,
    handleRecenter,
  }
}

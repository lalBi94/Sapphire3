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
      if (!dragRef.current && event.target.closest('input, textarea, [data-canvas-scroll]')) return
      event.preventDefault()

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

  // Modifie le niveau de zoom sans changer le centre de la vue.
  function setZoomLevel(nextZoomLevel) {
    if (!Number.isFinite(nextZoomLevel) || 2 ** nextZoomLevel === 0) return
    setCamera((current) => ({ ...current, zoomLevel: Math.min(2, nextZoomLevel) }))
    canvasRef.current?.focus({ preventScroll: true })
  }

  // Ajoute un facteur de zoom à la vue courante.
  function zoomBy(factor) {
    setZoomLevel(camera.zoomLevel + Math.log2(factor))
  }

  // Restaure un affichage à taille réelle.
  function resetZoom() {
    setZoomLevel(0)
  }

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
    }
    setIsPanning(true)
  }

  // Déplace depuis le dernier pointeur au zoom courant, sans annuler un zoom effectué pendant le glisser.
  function handlePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    setCamera((current) => {
      const scale = 2 ** current.zoomLevel
      const x = current.x - deltaX / scale
      const y = current.y - deltaY / scale
      return Number.isFinite(x) && Number.isFinite(y) ? { ...current, x, y } : current
    })
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

  // Cadre le contenu demandé dans la surface visible sans dépasser l'échelle réelle.
  function handleRecenter(bounds = { x: 0, y: 0, width: 0, height: 0 }) {
    const x = Number.isFinite(bounds.x) ? bounds.x : 0
    const y = Number.isFinite(bounds.y) ? bounds.y : 0
    const width = Math.max(0, Number.isFinite(bounds.width) ? bounds.width : 0)
    const height = Math.max(0, Number.isFinite(bounds.height) ? bounds.height : 0)
    const viewportWidth = canvasRef.current?.clientWidth ?? 0
    const viewportHeight = canvasRef.current?.clientHeight ?? 0
    const availableWidth = Math.max(1, viewportWidth - 64)
    const availableHeight = Math.max(1, viewportHeight - 64)
    const fittedZoom = width > 0 && height > 0
      ? Math.min(1, availableWidth / width, availableHeight / height)
      : 1
    const zoomLevel = Math.min(0, Math.log2(fittedZoom))
    setCamera((current) => ({ ...current, x, y, zoomLevel }))
    canvasRef.current.focus({ preventScroll: true })
  }

  // Recentre la vue sur un point monde sans changer le zoom ni l'état du canvas.
  function panTo(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    setCamera((current) => ({ ...current, x, y }))
  }

  // Restaure une vue validée sans conserver un éventuel geste de déplacement.
  function restoreCamera(nextCamera) {
    const pointerId = dragRef.current?.pointerId
    if (pointerId !== undefined && canvasRef.current.hasPointerCapture(pointerId)) canvasRef.current.releasePointerCapture(pointerId)
    dragRef.current = null
    setIsPanning(false)
    setCamera(nextCamera)
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
    panTo,
    setZoomLevel,
    zoomBy,
    resetZoom,
    restoreCamera,
  }
}

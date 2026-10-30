import { useRef, useState } from 'react'

// Gère une position libre sans agrandir la surface ni accumuler des éléments.
export default function useCanvasPan() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const dragRef = useRef(null)

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
      origin: position,
    }
    setIsPanning(true)
  }

  // Calcule la translation depuis le début du geste, sans dépendre du rythme de rendu.
  function handlePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setPosition({
      x: drag.origin.x + event.clientX - drag.x,
      y: drag.origin.y + event.clientY - drag.y,
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
      ArrowLeft: { x: 40, y: 0 },
      ArrowRight: { x: -40, y: 0 },
      ArrowUp: { x: 0, y: 40 },
      ArrowDown: { x: 0, y: -40 },
    }
    const direction = directions[event.key]
    if (!direction) return

    event.preventDefault()
    setPosition((current) => ({
      x: current.x + direction.x,
      y: current.y + direction.y,
    }))
  }

  return {
    position,
    isPanning,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleKeyDown,
  }
}

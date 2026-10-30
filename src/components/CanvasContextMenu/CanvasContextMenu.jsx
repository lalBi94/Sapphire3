import { useEffect, useRef } from 'react'
import { moduleTypes } from '../../utils/moduleTypes.js'
import './CanvasContextMenu.css'

// Propose les créations disponibles et gère la fermeture ainsi que le focus clavier.
export default function CanvasContextMenu({ x, y, onCreate, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    menuRef.current.querySelector('button').focus()
  }, [])

  useEffect(() => {
    // Ferme le menu lorsqu'un autre élément reçoit un appui.
    function handleOutsidePointer(event) {
      if (!menuRef.current.contains(event.target)) onClose(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true)
  }, [onClose])

  // Permet de parcourir les actions sans déplacer le canvas.
  function handleKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose(true)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    event.preventDefault()
    const buttons = [...menuRef.current.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + direction + buttons.length) % buttons.length].focus()
  }

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Create a module"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {Object.entries(moduleTypes).map(([type, definition]) => (
        <button key={type} type="button" role="menuitem" onClick={() => onCreate(type)}>
          {definition.action}
        </button>
      ))}
    </div>
  )
}

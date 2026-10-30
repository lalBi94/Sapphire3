import { useEffect, useRef } from 'react'
import { Box, MessageSquare } from 'lucide-react'
import { moduleTypes } from '../../utils/moduleTypes.js'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import './CanvasContextMenu.css'

const menuIcons = {
  module: Box,
  comment: MessageSquare,
}

// Propose les créations disponibles et gère la fermeture ainsi que le focus clavier.
export default function CanvasContextMenu({ x, y, onCreate, onClose, commentId = null, onDeleteComment, anchored = false }) {
  const menuRef = useRef(null)

  useEffect(() => {
    menuRef.current.querySelector('button:not(:disabled)').focus()
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
    const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
    const index = buttons.indexOf(document.activeElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + direction + buttons.length) % buttons.length].focus()
  }

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      data-canvas-ui
      data-canvas-scroll
      style={{ left: `min(${x}px, max(8px, calc(100% - 192px)))`, top: anchored ? y : commentId ? `min(${y}px, max(8px, calc(100% - 240px)))` : y, maxHeight: anchored ? `calc(100% - ${y + 8}px)` : undefined }}
      role="menu"
      aria-label={commentId ? 'Comment menu' : 'Create a canvas item'}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {commentId ? <DeleteAction targetId={commentId} kind="comment" onDelete={onDeleteComment} menu /> : Object.entries(moduleTypes).map(([type, definition]) => {
        const Icon = menuIcons[type]
        return <button key={type} type="button" role="menuitem" onClick={() => onCreate(type)}>
          <Icon className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
          {definition.action}
        </button>
      })}
    </div>
  )
}

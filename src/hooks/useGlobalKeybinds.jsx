import { useEffect, useRef } from 'react'
import { useKeybindsContext } from '../contexts/KeybindsContext.jsx'
import { keybindActions, shortcutFromEvent } from '../utils/keybinds.js'

const allowInInput = new Set(keybindActions.filter((action) => action.allowInInput).map((action) => action.id))

// Reconnaît les champs et éditeurs où le navigateur doit garder ses propres raccourcis.
function isEditingTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
}

// Centralise l'écoute clavier et délègue uniquement aux actions disponibles du canvas.
export default function useGlobalKeybinds(actions) {
  const { bindings } = useKeybindsContext()
  const actionsRef = useRef(actions)
  const bindingsRef = useRef(bindings)
  actionsRef.current = actions
  bindingsRef.current = bindings

  useEffect(() => {
    // Un seul écouteur capture toutes les combinaisons enregistrées.
    function handleKeyDown(event) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      if (event.target instanceof Element && event.target.closest('[data-keybind-capture]')) return
      if (document.querySelector('dialog[open]')) return
      const shortcut = shortcutFromEvent(event)
      if (!shortcut) return
      const entries = Object.entries(bindingsRef.current)
      const match = entries.find(([, value]) => value === shortcut)
      if (!match) return
      const [id] = match
      const action = actionsRef.current?.[id]
      if (!action) return
      if (isEditingTarget(event.target) && !allowInInput.has(id)) return
      if (action.available && !action.available()) return
      event.preventDefault()
      action.run()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])
}

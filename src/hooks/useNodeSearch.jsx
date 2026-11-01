import { useEffect, useState } from 'react'

// Garde l'état ouvert/fermé de la recherche et écoute Ctrl+F (ou Cmd+F) sur toute la fenêtre.
export default function useNodeSearch() {
  const [state, setState] = useState({ open: false, token: 0 })

  // Ouvre la recherche, ou rend simplement la main au champ quand elle est déjà ouverte.
  function show() {
    setState((current) => ({ open: true, token: current.token + 1 }))
  }

  useEffect(() => {
    // En capture : le raccourci reste disponible même quand une carte ou un champ détient le focus.
    function handleShortcut(event) {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey || event.repeat) return
      if (event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      show()
    }
    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [])

  return { open: state.open, token: state.token, show, close: () => setState((current) => ({ ...current, open: false })) }
}

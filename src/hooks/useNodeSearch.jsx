import { useState } from 'react'

// Garde l'état ouvert/fermé de la recherche ; le raccourci est géré par le registre central.
export default function useNodeSearch() {
  const [state, setState] = useState({ open: false, token: 0 })

  // Ouvre la recherche, ou rend simplement la main au champ quand elle est déjà ouverte.
  function show() {
    setState((current) => ({ open: true, token: current.token + 1 }))
  }

  return { open: state.open, token: state.token, show, close: () => setState((current) => ({ ...current, open: false })) }
}

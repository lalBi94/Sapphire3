import { useEffect, useState } from 'react'

// Ordre de premier plan partagé par les fenêtres volantes : la dernière touchée passe devant.
// L'ordre reste borné (10 + rang), donc les menus et infobulles du canvas gardent la priorité.
const listeners = new Set()
let order = []
let sequence = 0

// Prévient les fenêtres montées qu'elles doivent recalculer leur rang.
function notify() {
  for (const listener of [...listeners]) listener()
}

// Fournit à une fenêtre volante son rang courant et de quoi passer devant.
export default function usePanelFront() {
  const [id] = useState(() => `panel-${++sequence}`)
  const [, setRevision] = useState(0)

  useEffect(() => {
    const listener = () => setRevision((current) => current + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Place cette fenêtre en tête de l'ordre partagé.
  function bringToFront() {
    order = [...order.filter((entry) => entry !== id), id]
    notify()
  }

  const position = order.indexOf(id)
  return { zIndex: position === -1 ? null : 10 + position, bringToFront }
}

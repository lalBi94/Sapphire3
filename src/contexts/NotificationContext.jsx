import { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { activeNotification, normalizeNotification, reduceNotifications } from '../utils/notifications.js'

const NotificationContext = createContext(null)

// Fournit la file, l'historique et l'API notify à toute l'application.
export default function NotificationProvider({ children }) {
  const [state, dispatch] = useReducer(reduceNotifications, { items: [], history: [] })
  const sequence = useRef(0)
  const active = activeNotification(state.items)

  // Programme la disparition des notifications ordinaires ; les messages persistants restent ouverts.
  useEffect(() => {
    if (!active || !(active.duration > 0)) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'dismiss', id: active.id }), active.duration)
    return () => window.clearTimeout(timer)
  }, [active?.id, active?.updatedAt, active?.duration])

  // Ajoute ou met à jour une notification et retourne son identifiant.
  function notify(input = {}) {
    sequence.current += 1
    const id = input.id ?? `notification-${Date.now()}-${sequence.current}`
    dispatch({ type: 'notify', notification: normalizeNotification(input, id) })
    return id
  }

  // Ferme une notification sans effacer l'historique.
  function dismiss(id) {
    if (id) dispatch({ type: 'dismiss', id })
  }

  // Purge file et historique lors d'un changement de document ou de session.
  function clear() {
    dispatch({ type: 'clear' })
  }

  // Efface uniquement l'historique récent.
  function clearHistory() {
    dispatch({ type: 'clearHistory' })
  }

  return <NotificationContext.Provider value={{ active, items: state.items, history: state.history, notify, dismiss, clear, clearHistory }}>{children}</NotificationContext.Provider>
}

// Accède au système central depuis un composant ou un hook.
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider.')
  return context
}

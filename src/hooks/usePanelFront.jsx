import { useEffect, useRef, useState } from 'react'

// Ordre de premier plan partagé par les fenêtres volantes : la dernière touchée passe devant.
// L'ordre reste borné (10 + rang), donc les menus et infobulles du canvas gardent la priorité.
const listeners = new Set()
const windowListeners = new Set()
let order = []
let sequence = 0
// Registre des fenêtres ouvertes, dans leur ordre d'ouverture, pour le volet Windows.
const windows = new Map()

// Prévient les fenêtres montées qu'elles doivent recalculer leur rang.
function notify() {
  for (const listener of [...listeners]) listener()
}

// Prévient le volet Windows que la liste des fenêtres a changé.
function notifyWindows() {
  for (const listener of [...windowListeners]) listener()
}

// Enregistre une fenêtre visible et les commandes qu'elle expose.
function registerWindow(entry) {
  windows.set(entry.id, entry)
  notifyWindows()
}

// Retire une fenêtre fermée de la liste.
function unregisterWindow(id) {
  if (windows.delete(id)) notifyWindows()
}

// Liste les fenêtres ouvertes, dans leur ordre d'ouverture.
export function getWindows() {
  return [...windows.values()]
}

// Abonne le volet Windows aux ouvertures, fermetures et changements de pliage.
export function subscribeWindows(listener) {
  windowListeners.add(listener)
  return () => windowListeners.delete(listener)
}

// Amène une fenêtre devant et la déplie pour la rendre visible.
export function focusWindow(id) {
  windows.get(id)?.focus()
}

// Plie ou déplie une fenêtre depuis le volet.
export function setWindowCollapsed(id, collapsed) {
  windows.get(id)?.setCollapsed?.(collapsed)
}

// Ferme une fenêtre depuis le volet.
export function closeWindow(id) {
  windows.get(id)?.close?.()
}

// Ferme toutes les fenêtres ouvertes, sans modifier le document.
export function closeAllWindows() {
  for (const entry of [...windows.values()]) entry.close?.()
}

// Plie toutes les fenêtres qui le permettent.
export function collapseAllWindows() {
  for (const entry of [...windows.values()]) entry.setCollapsed?.(true)
}

// Répartit en cascade les fenêtres déplaçables, de la droite vers la gauche.
export function cascadeWindows() {
  const movable = [...windows.values()].filter((entry) => entry.arrange)
  movable.forEach((entry, index) => entry.arrange(index, movable.length))
}

// Fournit à une fenêtre volante son rang courant, de quoi passer devant, et l'enregistre dans le volet Windows.
export default function usePanelFront(options = {}) {
  const [id] = useState(() => `panel-${++sequence}`)
  const [, setRevision] = useState(0)
  const handlers = useRef({})
  const { title, collapsed = false, onClose, setCollapsed, arrange } = options
  const canClose = typeof onClose === 'function'
  const canCollapse = typeof setCollapsed === 'function'
  const canArrange = typeof arrange === 'function'
  const hasTitle = Boolean(title)

  useEffect(() => {
    const listener = () => setRevision((current) => current + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Garde les dernières commandes et le titre accessibles aux entrées du registre.
  useEffect(() => {
    handlers.current = { title, bringToFront, onClose, setCollapsed, arrange, collapsed }
  })

  // Place cette fenêtre en tête de l'ordre partagé.
  function bringToFront() {
    order = [...order.filter((entry) => entry !== id), id]
    notify()
  }

  useEffect(() => {
    if (!hasTitle) return undefined
    registerWindow({
      id,
      get title() { return handlers.current.title ?? '' },
      collapsed,
      focus: () => {
        handlers.current.bringToFront()
        if (handlers.current.collapsed && handlers.current.setCollapsed) handlers.current.setCollapsed(false)
      },
      close: canClose ? () => handlers.current.onClose?.() : null,
      setCollapsed: canCollapse ? (value) => handlers.current.setCollapsed?.(value) : null,
      arrange: canArrange ? (index, total) => handlers.current.arrange?.(index, total) : null,
    })
    return () => unregisterWindow(id)
  }, [id, hasTitle, collapsed, canClose, canCollapse, canArrange])

  const position = order.indexOf(id)
  return { zIndex: position === -1 ? null : 10 + position, bringToFront }
}
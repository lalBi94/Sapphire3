import { useEffect, useState } from 'react'
import { cascadeWindows, closeAllWindows, closeWindow, collapseAllWindows, focusWindow, getWindows, setWindowCollapsed, subscribeWindows } from './usePanelFront.jsx'

// Expose les fenêtres ouvertes et les commandes du volet Windows.
export default function useWindowManager() {
  const [, setRevision] = useState(0)

  useEffect(() => subscribeWindows(() => setRevision((current) => current + 1)), [])

  return {
    windows: getWindows(),
    focus: focusWindow,
    setCollapsed: setWindowCollapsed,
    close: closeWindow,
    closeAll: closeAllWindows,
    collapseAll: collapseAllWindows,
    cascade: cascadeWindows,
  }
}
import { createContext, useContext } from 'react'
import useKeybinds from '../hooks/useKeybinds.jsx'

const KeybindsContext = createContext(null)

// Partage le catalogue personnalisé entre le canvas, les paramètres et le gestionnaire clavier.
export default function KeybindsProvider({ children }) {
  const value = useKeybinds()
  return <KeybindsContext.Provider value={value}>{children}</KeybindsContext.Provider>
}

// Refuse une utilisation hors du fournisseur au lieu de retomber sur des raccourcis implicites.
export function useKeybindsContext() {
  const value = useContext(KeybindsContext)
  if (!value) throw new Error('useKeybindsContext must be used inside KeybindsProvider.')
  return value
}

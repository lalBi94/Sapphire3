import { Plus } from 'lucide-react'
import './NodeMenuButton.css'

// Ouvre le même menu que le clic droit, sous le bouton situé en haut à droite du propriétaire.
export default function NodeMenuButton({ label, onOpen }) {
  // Isole l'action du clic de sélection et fournit le bouton comme ancre du menu.
  function handleClick(event) {
    event.stopPropagation()
    onOpen(event)
  }

  return <button type="button" className="node-menu-button" aria-label={`Open menu for ${label}`} aria-haspopup="menu" title={`Open menu for ${label}`} onPointerDown={(event) => event.stopPropagation()} onClick={handleClick}><Plus size={12} strokeWidth={2} aria-hidden="true" /></button>
}

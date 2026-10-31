import { Plus } from 'lucide-react'
import './NodeMenuButton.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Ouvre le même menu que le clic droit, sous le bouton situé en haut à droite du propriétaire.
export default function NodeMenuButton({ label, onOpen }) {
  const { t } = useTranslation()
  // Isole l'action du clic de sélection et fournit le bouton comme ancre du menu.
  function handleClick(event) {
    event.stopPropagation()
    onOpen(event)
  }

  const menuLabel = t('canvas.openMenu', { name: label })
  return <button type="button" className="node-menu-button" aria-label={menuLabel} aria-haspopup="menu" title={menuLabel} onPointerDown={(event) => event.stopPropagation()} onClick={handleClick}><Plus size={12} strokeWidth={2} aria-hidden="true" /></button>
}

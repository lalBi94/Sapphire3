import { Info } from 'lucide-react'
import './InfoHint.css'

// Petite icône d'information : le texte explicatif reste disponible au survol et au focus.
export default function InfoHint({ text, className = '' }) {
  if (!text) return null
  return <span className={`info-hint${className ? ` ${className}` : ''}`} role="img" aria-label={text} title={text} tabIndex={0}>
    <Info size={12} strokeWidth={1.8} aria-hidden="true" />
  </span>
}

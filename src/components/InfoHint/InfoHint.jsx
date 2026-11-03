import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import './InfoHint.css'

// Petite icône d'information avec une vraie infobulle, au survol et au focus clavier.
export default function InfoHint({ text, className = '' }) {
  const [tip, setTip] = useState(null)
  const anchorRef = useRef(null)
  if (!text) return null

  // Positionne l'infobulle près de l'icône, dans les limites de la fenêtre.
  function show() {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const width = Math.min(280, Math.max(160, window.innerWidth - 16))
    const below = rect.bottom + 110 < window.innerHeight
    setTip({
      width,
      left: Math.min(Math.max(8, rect.left - 8), Math.max(8, window.innerWidth - width - 8)),
      ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
    })
  }

  // Referme l'infobulle dès que le pointeur ou le focus quitte l'icône.
  function hide() {
    setTip(null)
  }

  return <>
    <span ref={anchorRef} className={`info-hint${className ? ` ${className}` : ''}`} role="img" aria-label={text} tabIndex={0} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <Info size={12} strokeWidth={1.8} aria-hidden="true" />
    </span>
    {tip && createPortal(<span className="info-hint__tooltip" role="tooltip" style={{ left: tip.left, width: tip.width, ...(tip.top !== undefined ? { top: tip.top } : { bottom: tip.bottom }) }}>{text}</span>, window.document.body)}
  </>
}

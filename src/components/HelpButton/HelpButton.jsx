import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, ExternalLink, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { openExternal } from '../../services/externalLinks.js'
import './HelpButton.css'

// Bouton « ? » avec un petit panneau local et un lien vers la page en ligne du sujet.
export default function HelpButton({ title, summary, url, className = '' }) {
  const { t } = useTranslation()
  const [position, setPosition] = useState(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  // Referme le panneau au clic extérieur ou à Échap, sans interrompre le reste de l'interface.
  useEffect(() => {
    if (!position) return
    function handlePointer(event) {
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return
      setPosition(null)
    }
    function handleKey(event) {
      if (event.key !== 'Escape') return
      setPosition(null)
      buttonRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', handlePointer, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [position])

  // Donne le focus au panneau dès son ouverture pour garder la navigation clavier dedans.
  useEffect(() => {
    if (position) panelRef.current?.focus({ preventScroll: true })
  }, [position])

  // Ouvre le panneau sous le bouton, ou au-dessus quand la place manque.
  function toggle() {
    if (position) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(320, window.innerWidth - 16)
    const below = rect.bottom + 210 < window.innerHeight
    setPosition({
      width,
      left: Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8)),
      ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
    })
  }

  // Ferme le panneau puis ouvre la documentation en ligne dans le navigateur système.
  function handleOpen() {
    setPosition(null)
    openExternal(url)
  }

  return <>
    <button ref={buttonRef} type="button" className={`help-button${position ? ' help-button--active' : ''}${className ? ` ${className}` : ''}`}
      aria-label={t('help.button', { topic: title })} title={t('help.button', { topic: title })}
      aria-haspopup="dialog" aria-expanded={Boolean(position)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); toggle() }}>
      <CircleHelp size={14} strokeWidth={1.9} aria-hidden="true" />
    </button>
    {position && createPortal(<div ref={panelRef} className="help-panel" role="dialog" aria-label={t('help.title')} data-help-panel
      style={{ width: position.width, left: position.left, ...(position.top !== undefined ? { top: position.top } : { bottom: position.bottom }) }}
      tabIndex={-1} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <header className="help-panel__header">
        <h3 className="help-panel__title">{title}</h3>
        <button type="button" className="help-panel__close" aria-label={t('help.close')} onClick={() => { setPosition(null); buttonRef.current?.focus({ preventScroll: true }) }}><X size={14} aria-hidden="true" /></button>
      </header>
      <p className="help-panel__summary">{summary}</p>
      <a className="help-panel__link" href={url} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); handleOpen() }}>
        {t('help.open')}<ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>, document.body)}
  </>
}

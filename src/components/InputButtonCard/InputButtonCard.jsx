import { useEffect, useRef } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './InputButtonCard.css'

const repeatDelay = 500

// Bouton d'entrée : appelle la fonction liée avec l'état courant.
export default function InputButtonCard({ card, onChange, onTrigger, callbacks = [], boundCallbackId = null, onBind, callbackSupported = true }) {
  const { t } = useTranslation()
  const pressed = Boolean(card.pressed)
  const hold = card.type === 'holdButton'
  const triggerRef = useRef(onTrigger)
  const intervalRef = useRef(0)
  const holdActiveRef = useRef(false)
  triggerRef.current = onTrigger

  // Arrête la répétition du toggle.
  const clearRepeat = () => {
    if (!intervalRef.current) return
    window.clearInterval(intervalRef.current)
    intervalRef.current = 0
  }

  useEffect(() => () => clearRepeat(), [])

  // Met à jour l'état visuel sans modifier la source logique.
  const setPressed = (value) => onChange?.(Boolean(value))

  // Déclenche la fonction liée ; le premier appel peut démarrer le live.
  const trigger = (value, autoStart) => triggerRef.current?.(Boolean(value), Boolean(autoStart))

  // Répète l'appel tant que le toggle reste actif.
  const startRepeat = () => {
    clearRepeat()
    intervalRef.current = window.setInterval(() => trigger(true, false), repeatDelay)
  }

  // Bascule le toggle et déclenche immédiatement le callback.
  const handleToggle = () => {
    const next = !pressed
    setPressed(next)
    trigger(next, next)
    if (next) startRepeat()
    else clearRepeat()
  }

  // Envoie une seule impulsion true au début d'un appui maintenu.
  const pressHold = () => {
    if (holdActiveRef.current) return
    holdActiveRef.current = true
    setPressed(true)
    trigger(true, true)
  }

  // Relâche l'appui maintenu sans rappeler le callback.
  const releaseHold = () => {
    if (!holdActiveRef.current) return
    holdActiveRef.current = false
    setPressed(false)
  }

  const keyboardHold = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) pressHold()
  }

  const releaseKeyboardHold = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    releaseHold()
  }

  const missingCallback = Boolean(boundCallbackId) && !callbacks.some((callback) => callback.nodeId === boundCallbackId)

  return <div className="input-button-card">
    <button
      type="button"
      className={`input-button-card__button${pressed ? ' input-button-card__button--pressed' : ''}`}
      aria-pressed={pressed}
      aria-label={t(hold ? 'inputButton.holdLabel' : 'inputButton.toggleLabel', { name: card.name })}
      onPointerDown={hold ? (event) => { event.preventDefault(); pressHold() } : undefined}
      onPointerUp={hold ? releaseHold : undefined}
      onPointerLeave={hold ? releaseHold : undefined}
      onPointerCancel={hold ? releaseHold : undefined}
      onKeyDown={hold ? keyboardHold : undefined}
      onKeyUp={hold ? releaseKeyboardHold : undefined}
      onBlur={hold ? releaseHold : undefined}
      onClick={hold ? undefined : handleToggle}
    >
      <span className="input-button-card__name">{callbackSupported ? 'onClick' : 'isPress'}</span>
      <span className="input-button-card__state">{pressed ? t('inputButton.pressed') : t('inputButton.released')}</span>
    </button>
    {callbackSupported ? <details className="input-button-card__configuration">
      <summary>{t('card.configuration')}</summary>
      <label className="input-button-card__binding">
        <span>{t('inputButton.callback')}</span>
        <select
          value={boundCallbackId ?? ''}
          disabled={callbacks.length === 0 && !boundCallbackId}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onBind?.(event.target.value || null)}
        >
          <option value="">{t('inputButton.noCallback')}</option>
          {callbacks.map((callback) => <option key={callback.nodeId} value={callback.nodeId}>{callback.moduleName ? `${callback.moduleName} · ${callback.name}` : callback.name}</option>)}
          {missingCallback && <option value={boundCallbackId}>{t('inputButton.missingCallback')}</option>}
        </select>
      </label>
    </details> : null}
    <p className="input-button-card__hint">{callbackSupported ? t(hold ? 'inputButton.holdHint' : 'inputButton.toggleHint') : t('inputButton.legacyHint')}</p>
  </div>
}

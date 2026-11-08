import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './InputButtonCard.css'

// Bouton d'entrée : bascule persistante ou impulsion tant que le pointeur reste enfoncé.
export default function InputButtonCard({ card, onChange }) {
  const { t } = useTranslation()
  const pressed = Boolean(card.pressed)
  const hold = card.type === 'holdButton'
  const setPressed = (value) => onChange?.(Boolean(value))
  const keyboardHold = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    setPressed(true)
  }
  const releaseHold = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    setPressed(false)
  }

  return <div className="input-button-card">
    <button
      type="button"
      className={`input-button-card__button${pressed ? ' input-button-card__button--pressed' : ''}`}
      aria-pressed={pressed}
      aria-label={t(hold ? 'inputButton.holdLabel' : 'inputButton.toggleLabel', { name: card.name })}
      onPointerDown={hold ? (event) => { event.preventDefault(); setPressed(true) } : undefined}
      onPointerUp={hold ? () => setPressed(false) : undefined}
      onPointerLeave={hold ? () => setPressed(false) : undefined}
      onPointerCancel={hold ? () => setPressed(false) : undefined}
      onKeyDown={hold ? keyboardHold : undefined}
      onKeyUp={hold ? releaseHold : undefined}
      onBlur={hold ? () => setPressed(false) : undefined}
      onClick={hold ? undefined : () => setPressed(!pressed)}
    >
      <span className="input-button-card__name">isPress</span>
      <span className="input-button-card__state">{pressed ? t('inputButton.pressed') : t('inputButton.released')}</span>
    </button>
    <p className="input-button-card__hint">{t(hold ? 'inputButton.holdHint' : 'inputButton.toggleHint')}</p>
  </div>
}

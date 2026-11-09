import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './NumberInputCard.css'

const intMin = -2147483648
const intMax = 2147483647

// Lit un entier strictement valide, sans accepter les exposants ni les décimales.
function parseInteger(raw) {
  if (!/^-?\d+$/.test(String(raw).trim())) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= intMin && value <= intMax ? value : null
}

// Entrée numérique : appelle la fonction liée avec la valeur entière courante.
export default function NumberInputCard({ card, onChange, onTrigger, callbacks = [], boundCallbackId = null, onBind }) {
  const { t } = useTranslation()
  const committed = Number.isInteger(card.value) ? card.value : 0
  const [draft, setDraft] = useState(String(committed))
  const focusedRef = useRef(false)
  const hintId = `number-input-hint-${card.id}`

  // Reflète une valeur venue de l'extérieur (undo, import) sans écraser une saisie en cours.
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(committed))
  }, [committed])

  // Signale une nouvelle valeur au document et au callback lié.
  function commit(value) {
    if (value === committed) return
    onChange?.(value)
    onTrigger?.(value, true)
  }

  // Met à jour le brouillon, puis déclenche le callback dès qu'un entier complet est saisi.
  function handleInput(event) {
    const raw = event.target.value
    setDraft(raw)
    const value = parseInteger(raw)
    if (value !== null) commit(value)
  }

  // Normalise le champ à la sortie ou après Entrée.
  function handleBlur() {
    focusedRef.current = false
    const value = parseInteger(draft)
    if (value === null) {
      setDraft(String(committed))
      return
    }
    if (value !== committed) commit(value)
    setDraft(String(value))
  }

  // Revient à la valeur validée avec Échap.
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(String(committed))
      event.currentTarget.blur()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  // Incrémente ou décrémente en partant de la valeur affichée si elle est valide.
  function step(delta) {
    const base = parseInteger(draft) ?? committed
    const value = Math.max(intMin, Math.min(intMax, base + delta))
    setDraft(String(value))
    commit(value)
  }

  const missingCallback = Boolean(boundCallbackId) && !callbacks.some((callback) => callback.nodeId === boundCallbackId)

  return <div className="number-input-card">
    <div className="number-input-card__field">
      <button
        type="button"
        className="number-input-card__step"
        aria-label={t('inputNumber.decrement', { name: card.name })}
        title={t('inputNumber.decrement', { name: card.name })}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => step(-1)}
      >−</button>
      <div className="number-input-card__value">
        <input
          type="number"
          inputMode="numeric"
          min={intMin}
          max={intMax}
          step="1"
          value={draft}
          aria-label={t('inputNumber.valueLabel', { name: card.name })}
          aria-describedby={hintId}
          onFocus={() => { focusedRef.current = true }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={handleInput}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <span className="number-input-card__type" aria-hidden="true">int</span>
      </div>
      <button
        type="button"
        className="number-input-card__step"
        aria-label={t('inputNumber.increment', { name: card.name })}
        title={t('inputNumber.increment', { name: card.name })}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => step(1)}
      >+</button>
    </div>
    <label className="number-input-card__binding">
      <span>{t('inputNumber.callback')}</span>
      <select
        value={boundCallbackId ?? ''}
        disabled={callbacks.length === 0 && !boundCallbackId}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => onBind?.(event.target.value || null)}
      >
        <option value="">{t('inputNumber.noCallback')}</option>
        {callbacks.map((callback) => <option key={callback.nodeId} value={callback.nodeId}>{callback.moduleName ? `${callback.moduleName} · ${callback.name}` : callback.name}</option>)}
        {missingCallback && <option value={boundCallbackId}>{t('inputNumber.missingCallback')}</option>}
      </select>
    </label>
    <p className="number-input-card__hint" id={hintId}>{t('inputNumber.hint')}</p>
  </div>
}

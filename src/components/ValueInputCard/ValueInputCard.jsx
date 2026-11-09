import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './ValueInputCard.css'

const intMin = -2147483648
const intMax = 2147483647
const floatMax = 3.4028234663852886e38

// Lit une valeur strictement valide pour le type demandé.
function parseValue(raw, valueType) {
  if (valueType === 'string') return String(raw)
  const text = String(raw).trim()
  if (valueType === 'int') {
    if (!/^-?\d+$/.test(text)) return null
    const value = Number(text)
    return Number.isSafeInteger(value) && value >= intMin && value <= intMax ? value : null
  }
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) && Math.abs(value) <= floatMax ? value : null
}

// Entrée typée : appelle la fonction liée avec la valeur courante.
export default function ValueInputCard({ card, valueType = 'int', onChange, onTrigger, callbacks = [], boundCallbackId = null, onBind }) {
  const { t } = useTranslation()
  const isString = valueType === 'string'
  const isFloat = valueType === 'float'
  const committed = isString
    ? (typeof card.value === 'string' ? card.value : '')
    : isFloat
      ? (Number.isFinite(card.value) ? card.value : 0)
      : (Number.isInteger(card.value) ? card.value : 0)
  const [draft, setDraft] = useState(String(committed))
  const focusedRef = useRef(false)
  const hintId = `value-input-hint-${card.id}`

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

  // Met à jour le brouillon, puis déclenche le callback dès qu'une valeur complète est saisie.
  function handleInput(event) {
    const raw = event.target.value
    setDraft(raw)
    const value = parseValue(raw, valueType)
    if (value !== null) commit(value)
  }

  // Normalise le champ à la sortie ou après Entrée.
  function handleBlur() {
    focusedRef.current = false
    const value = parseValue(draft, valueType)
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
    const base = parseValue(draft, valueType) ?? committed
    const raw = base + delta
    const value = isFloat
      ? Math.max(-floatMax, Math.min(floatMax, Math.round(raw * 1e6) / 1e6))
      : Math.max(intMin, Math.min(intMax, raw))
    setDraft(String(value))
    commit(value)
  }

  const matchingCallbacks = callbacks.filter((callback) => callback.valueType === valueType)
  const missingCallback = Boolean(boundCallbackId) && !matchingCallbacks.some((callback) => callback.nodeId === boundCallbackId)

  return <div className={`value-input-card value-input-card--${valueType}`}>
    {isString ? (
      <div className="value-input-card__string">
        <span className="value-input-card__quote" aria-hidden="true">“</span>
        <input
          type="text"
          value={draft}
          aria-label={t('inputValue.valueLabel', { name: card.name })}
          aria-describedby={hintId}
          onFocus={() => { focusedRef.current = true }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={handleInput}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <span className="value-input-card__quote" aria-hidden="true">”</span>
      </div>
    ) : (
      <div className="value-input-card__field">
        <button
          type="button"
          className="value-input-card__step"
          aria-label={t('inputValue.decrement', { name: card.name })}
          title={t('inputValue.decrement', { name: card.name })}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(isFloat ? -0.1 : -1)}
        >−</button>
        <div className="value-input-card__value">
          <input
            type="number"
            inputMode={isFloat ? 'decimal' : 'numeric'}
            min={isFloat ? -floatMax : intMin}
            max={isFloat ? floatMax : intMax}
            step={isFloat ? '0.1' : '1'}
            value={draft}
            aria-label={t('inputValue.valueLabel', { name: card.name })}
            aria-describedby={hintId}
            onFocus={() => { focusedRef.current = true }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onChange={handleInput}
            onPointerDown={(event) => event.stopPropagation()}
          />
          <span className="value-input-card__type" aria-hidden="true">{valueType}</span>
        </div>
        <button
          type="button"
          className="value-input-card__step"
          aria-label={t('inputValue.increment', { name: card.name })}
          title={t('inputValue.increment', { name: card.name })}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(isFloat ? 0.1 : 1)}
        >+</button>
      </div>
    )}
    <label className="value-input-card__binding">
      <span>{t('inputValue.callback')}</span>
      <select
        value={boundCallbackId ?? ''}
        disabled={matchingCallbacks.length === 0 && !boundCallbackId}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => onBind?.(event.target.value || null)}
      >
        <option value="">{t('inputValue.noCallback')}</option>
        {matchingCallbacks.map((callback) => <option key={callback.nodeId} value={callback.nodeId}>{callback.moduleName ? `${callback.moduleName} · ${callback.name}` : callback.name}</option>)}
        {missingCallback && <option value={boundCallbackId}>{t('inputValue.missingCallback')}</option>}
      </select>
    </label>
    <p className="value-input-card__hint" id={hintId}>{t('inputValue.hint')}</p>
  </div>
}

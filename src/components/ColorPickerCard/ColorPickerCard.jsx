import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { normalizeColorValue } from '../../utils/logic/colorPickerState.js'
import './ColorPickerCard.css'

const presets = [
  [255, 213, 71],
  [255, 96, 96],
  [255, 160, 64],
  [110, 220, 120],
  [64, 200, 255],
  [110, 120, 255],
  [200, 110, 255],
  [255, 255, 255],
]

// Convertit une couleur RGB 0..255 en teinte, saturation et luminosité.
function rgbToHsv([red, green, blue]) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const maximum = Math.max(r, g, b)
  const minimum = Math.min(r, g, b)
  const delta = maximum - minimum
  let hue = 0
  if (delta !== 0) {
    if (maximum === r) hue = ((g - b) / delta) % 6
    else if (maximum === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { h: hue, s: maximum === 0 ? 0 : delta / maximum, v: maximum }
}

// Convertit une teinte, saturation et luminosité en couleur RGB 0..255.
function hsvToRgb({ h, s, v }) {
  const chroma = v * s
  const sector = (h % 360) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  let red = 0
  let green = 0
  let blue = 0
  if (sector < 1) [red, green, blue] = [chroma, second, 0]
  else if (sector < 2) [red, green, blue] = [second, chroma, 0]
  else if (sector < 3) [red, green, blue] = [0, chroma, second]
  else if (sector < 4) [red, green, blue] = [0, second, chroma]
  else if (sector < 5) [red, green, blue] = [second, 0, chroma]
  else [red, green, blue] = [chroma, 0, second]
  const base = v - chroma
  return [red, green, blue].map((entry) => Math.round(Math.max(0, Math.min(1, entry + base)) * 255))
}

// Formate une couleur en hexadécimal, avec alpha pour les sélecteurs RGBA.
function formatHex(color, channels) {
  const base = `#${color.slice(0, 3).map((entry) => entry.toString(16).padStart(2, '0')).join('')}`
  return channels === 4 ? `${base}${color[3].toString(16).padStart(2, '0')}` : base
}

// Lit un hexadécimal court ou long et retourne les canaux attendus.
function parseHex(text, channels) {
  let raw = String(text).trim().replace(/^#/, '')
  if (!/^[0-9a-f]+$/i.test(raw)) return null
  if (raw.length === 3 || raw.length === 4) raw = raw.split('').map((entry) => entry + entry).join('')
  if (raw.length !== 6 && raw.length !== 8) return null
  const values = []
  for (let index = 0; index < raw.length; index += 2) values.push(Number.parseInt(raw.slice(index, index + 2), 16))
  const rgb = values.slice(0, 3)
  const alpha = values.length === 4 ? values[3] : 255
  return channels === 4 ? [...rgb, alpha] : rgb
}

// Compare deux couleurs canal par canal.
function sameColor(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => entry === right[index])
}

// Sélecteur de couleur : roue chromatique, hexadécimal, canaux, alpha et callback.
export default function ColorPickerCard({ card, channels = 3, onChange, onTrigger, callbacks = [], boundCallbackId = null, onBind }) {
  const { t } = useTranslation()
  const current = normalizeColorValue(card.value, channels)
  const currentKey = current.join(',')
  const [hsv, setHsv] = useState(() => rgbToHsv(current))
  const [drafts, setDrafts] = useState(() => current.map(String))
  const [hexDraft, setHexDraft] = useState(() => formatHex(current, channels))
  const currentRef = useRef(current)
  const hsvRef = useRef(hsv)
  const lastCommitted = useRef(null)
  const hexFocused = useRef(false)
  const wheelRef = useRef(null)
  const dragging = useRef(false)

  // Reflète une couleur venue de l'extérieur (undo, import) sans écraser un geste local.
  useEffect(() => {
    const next = normalizeColorValue(card.value, channels)
    if (lastCommitted.current && sameColor(next, lastCommitted.current)) return
    lastCommitted.current = null
    currentRef.current = next
    const nextHsv = rgbToHsv(next)
    hsvRef.current = nextHsv
    setHsv(nextHsv)
    setDrafts(next.map(String))
    if (!hexFocused.current) setHexDraft(formatHex(next, channels))
  }, [currentKey, channels])

  // Publie la couleur et prévient le callback lié.
  function commit(next, nextHsv = rgbToHsv(next)) {
    const normalized = normalizeColorValue(next, channels)
    currentRef.current = normalized
    hsvRef.current = nextHsv
    lastCommitted.current = normalized
    setHsv(nextHsv)
    setDrafts(normalized.map(String))
    if (!hexFocused.current) setHexDraft(formatHex(normalized, channels))
    onChange?.(normalized)
    onTrigger?.(normalized, true)
  }

  // Calcule la teinte et la saturation depuis la position dans la roue.
  function updateFromPointer(event) {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    const radius = Math.min(rect.width, rect.height) / 2
    const saturation = Math.max(0, Math.min(1, Math.hypot(x, y) / radius))
    const hue = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360
    const value = hsvRef.current.v === 0 ? 1 : hsvRef.current.v
    const nextHsv = { h: hue, s: saturation, v: value }
    const rgb = hsvToRgb(nextHsv)
    commit(channels === 4 ? [...rgb, currentRef.current[3]] : rgb, nextHsv)
  }

  // Démarre un geste de sélection dans la roue.
  function handleWheelDown(event) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    updateFromPointer(event)
  }

  // Suit le pointeur tant que le geste reste actif.
  function handleWheelMove(event) {
    if (!dragging.current) return
    event.stopPropagation()
    updateFromPointer(event)
  }

  // Termine le geste de sélection.
  function handleWheelUp(event) {
    if (!dragging.current) return
    event.stopPropagation()
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Ajuste teinte et saturation au clavier.
  function handleWheelKeyDown(event) {
    let next = null
    if (event.key === 'ArrowLeft') next = { ...hsvRef.current, h: (hsvRef.current.h - 5 + 360) % 360 }
    else if (event.key === 'ArrowRight') next = { ...hsvRef.current, h: (hsvRef.current.h + 5) % 360 }
    else if (event.key === 'ArrowUp') next = { ...hsvRef.current, s: Math.min(1, hsvRef.current.s + 0.05) }
    else if (event.key === 'ArrowDown') next = { ...hsvRef.current, s: Math.max(0, hsvRef.current.s - 0.05) }
    if (!next) return
    event.preventDefault()
    const rgb = hsvToRgb(next)
    commit(channels === 4 ? [...rgb, currentRef.current[3]] : rgb, next)
  }

  // Modifie la luminosité en conservant la teinte et la saturation.
  function handleValueChange(event) {
    const nextHsv = { ...hsvRef.current, v: Number(event.target.value) / 100 }
    const rgb = hsvToRgb(nextHsv)
    commit(channels === 4 ? [...rgb, currentRef.current[3]] : rgb, nextHsv)
  }

  // Modifie uniquement le canal alpha.
  function handleAlphaChange(event) {
    const next = [...currentRef.current]
    next[3] = Number(event.target.value)
    commit(next)
  }

  // Met à jour un canal numérique sans perdre les autres.
  function handleChannelInput(index, raw) {
    const nextDrafts = [...drafts]
    nextDrafts[index] = raw
    setDrafts(nextDrafts)
    if (!/^\d{1,3}$/.test(raw)) return
    const value = Number(raw)
    if (value > 255) return
    const next = [...currentRef.current]
    next[index] = value
    commit(next)
  }

  // Normalise le brouillon du canal à la sortie.
  function handleChannelBlur() {
    setDrafts(currentRef.current.map(String))
  }

  // Accepte un hexadécimal complet sans interrompre la saisie.
  function handleHexInput(event) {
    const raw = event.target.value
    setHexDraft(raw)
    const parsed = parseHex(raw, channels)
    if (parsed) commit(parsed)
  }

  // Normalise le champ hexadécimal à la sortie.
  function handleHexBlur() {
    hexFocused.current = false
    setHexDraft(formatHex(currentRef.current, channels))
  }

  const missingCallback = Boolean(boundCallbackId) && !callbacks.some((callback) => callback.nodeId === boundCallbackId)
  const previewColor = channels === 4
    ? `rgba(${current[0]}, ${current[1]}, ${current[2]}, ${current[3] / 255})`
    : `rgb(${current[0]}, ${current[1]}, ${current[2]})`
  const thumbAngle = ((hsv.h - 90) * Math.PI) / 180
  const thumbX = 50 + Math.cos(thumbAngle) * hsv.s * 50
  const thumbY = 50 + Math.sin(thumbAngle) * hsv.s * 50

  return <div className={`color-picker-card color-picker-card--${channels === 4 ? 'rgba' : 'rgb'}`}>
    <div className="color-picker-card__top">
      <div
        ref={wheelRef}
        className="color-picker-card__wheel"
        role="slider"
        tabIndex={0}
        aria-label={t('colorPicker.wheel')}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${Math.round(hsv.h)}° · ${Math.round(hsv.s * 100)}%`}
        style={{ '--wheel-value': hsv.v }}
        onPointerDown={handleWheelDown}
        onPointerMove={handleWheelMove}
        onPointerUp={handleWheelUp}
        onPointerCancel={handleWheelUp}
        onKeyDown={handleWheelKeyDown}
      >
        <span className="color-picker-card__wheel-saturation" aria-hidden="true" />
        <span className="color-picker-card__wheel-dark" aria-hidden="true" />
        <span className="color-picker-card__thumb" style={{ left: `${thumbX}%`, top: `${thumbY}%`, background: previewColor }} aria-hidden="true" />
      </div>
      <div className="color-picker-card__controls">
        <div className="color-picker-card__preview" style={{ '--picker-color': previewColor }}>
          <span className="color-picker-card__preview-color" aria-hidden="true" />
        </div>
        <label className="color-picker-card__hex">
          <span>{t('colorPicker.hex')}</span>
          <input
            type="text"
            value={hexDraft}
            spellCheck="false"
            aria-label={t('colorPicker.hex')}
            onFocus={() => { hexFocused.current = true }}
            onBlur={handleHexBlur}
            onChange={handleHexInput}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>
        <div className="color-picker-card__channels">
          {['R', 'G', 'B', ...(channels === 4 ? ['A'] : [])].map((label, index) => <label key={label}>
            <span>{label}</span>
            <input
              type="number"
              min="0"
              max="255"
              step="1"
              value={drafts[index]}
              aria-label={label}
              onBlur={handleChannelBlur}
              onChange={(event) => handleChannelInput(index, event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
            />
          </label>)}
        </div>
        <label className="color-picker-card__slider">
          <span>{t('colorPicker.value')}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(hsv.v * 100)}
            aria-label={t('colorPicker.value')}
            onChange={handleValueChange}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>
        {channels === 4 && <label className="color-picker-card__slider">
          <span>{t('colorPicker.alpha')}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={current[3]}
            aria-label={t('colorPicker.alpha')}
            onChange={handleAlphaChange}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>}
      </div>
    </div>
    <div className="color-picker-card__presets" role="group" aria-label={t('colorPicker.presets')}>
      {presets.map((preset) => <button
        key={preset.join('-')}
        type="button"
        className="color-picker-card__preset"
        style={{ '--swatch': `rgb(${preset[0]}, ${preset[1]}, ${preset[2]})` }}
        aria-label={formatHex([...preset, 255], 4)}
        title={formatHex([...preset, 255], 4)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => commit(channels === 4 ? [...preset, currentRef.current[3]] : preset)}
      />)}
    </div>
    <details className="color-picker-card__configuration">
      <summary>{t('card.configuration')}</summary>
      <label className="color-picker-card__binding">
        <span>{t('inputValue.callback')}</span>
        <select
          value={boundCallbackId ?? ''}
          disabled={callbacks.length === 0 && !boundCallbackId}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onBind?.(event.target.value || null)}
        >
          <option value="">{t('inputValue.noCallback')}</option>
          {callbacks.map((callback) => <option key={callback.nodeId} value={callback.nodeId}>{callback.moduleName ? `${callback.moduleName} · ${callback.name}` : callback.name}</option>)}
          {missingCallback && <option value={boundCallbackId}>{t('inputValue.missingCallback')}</option>}
        </select>
      </label>
    </details>
    <p className="color-picker-card__hint">{t('colorPicker.hint', { count: channels })}</p>
  </div>
}

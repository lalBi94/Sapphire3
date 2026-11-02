import { useState } from 'react'
import { Keyboard, RotateCcw, Trash2 } from 'lucide-react'
import InfoHint from '../InfoHint/InfoHint.jsx'
import { useKeybindsContext } from '../../contexts/KeybindsContext.jsx'
import { formatShortcut, keybindActions, keybindCategories, shortcutFromEvent } from '../../utils/keybinds.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Panneau des raccourcis : capture directe, conflits refusés et restauration des défauts.
export default function KeybindsSection() {
  const { bindings, assign, clear, reset, resetAll, isCustom } = useKeybindsContext()
  const { t } = useTranslation()
  const [capturing, setCapturing] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const search = query.trim().toLocaleLowerCase()

  // Retrouve le libellé d'une action, y compris pour expliquer un conflit.
  function actionLabel(id) {
    const action = keybindActions.find((entry) => entry.id === id)
    return action ? t(action.labelKey) : id
  }

  // Filtre les actions par leur libellé traduit sans masquer les catégories vides.
  function matches(action) {
    return !search || t(action.labelKey).toLocaleLowerCase().includes(search)
  }

  // Démarre la capture : le gestionnaire global ignore cet élément grâce à data-keybind-capture.
  function startCapture(id) {
    setCapturing(id)
    setError(null)
  }

  // Capture une combinaison, refuse les conflits et n'exécute jamais l'action pendant la saisie.
  function capture(event, action) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setCapturing(null)
      setError(null)
      return
    }
    if (event.key === 'Tab') {
      setCapturing(null)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const shortcut = shortcutFromEvent(event)
    if (!shortcut) return
    const result = assign(action.id, shortcut)
    if (!result.ok) {
      setError({ id: action.id, code: result.code, conflictId: result.conflictId })
      return
    }
    setCapturing(null)
    setError(null)
  }

  // Applique une suppression ou une restauration et affiche le conflit éventuel.
  function applyChange(result, id) {
    if (result.ok) setError(null)
    else setError({ id, code: result.code, conflictId: result.conflictId })
  }

  return <div className="settings-section keybinds-section">
    <div className="keybinds-section__toolbar">
      <label className="keybinds-section__search">
        <input type="search" value={query} placeholder={t('keybind.search')} aria-label={t('keybind.search')} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button type="button" className="keybinds-section__reset-all" onClick={() => { setError(null); resetAll() }}><RotateCcw size={14} aria-hidden="true" />{t('keybind.resetAll')}</button>
      <InfoHint text={t('keybind.hint')} />
    </div>
    {keybindCategories.map((category) => {
      const visible = category.actions.filter(matches)
      if (visible.length === 0) return null
      return <section className="keybind-group" key={category.id}>
        <h4 className="keybind-group__title">{t(category.labelKey)}</h4>
        <ul className="keybind-list">
          {visible.map((action) => {
            const active = capturing === action.id
            const actionError = error?.id === action.id ? error : null
            return <li className="keybind-row" key={action.id}>
              <span className="keybind-row__label">{t(action.labelKey)}</span>
              <button type="button" className={`keybind-row__capture${active ? ' keybind-row__capture--active' : ''}`} data-keybind-capture={active ? '' : undefined} aria-label={t('keybind.capture', { action: t(action.labelKey) })} onClick={() => startCapture(action.id)} onKeyDown={(event) => capture(event, action)} onBlur={() => setCapturing((current) => current === action.id ? null : current)}>
                <Keyboard size={13} aria-hidden="true" />
                {active ? t('keybind.press') : bindings[action.id] ? <kbd>{formatShortcut(bindings[action.id])}</kbd> : <em>{t('keybind.unassigned')}</em>}
              </button>
              <button type="button" className="keybind-row__action" disabled={!bindings[action.id]} aria-label={t('keybind.clear', { action: t(action.labelKey) })} title={t('keybind.clear', { action: t(action.labelKey) })} onClick={() => applyChange(clear(action.id), action.id)}><Trash2 size={13} aria-hidden="true" /></button>
              <button type="button" className="keybind-row__action" disabled={!isCustom(action.id)} aria-label={t('keybind.reset', { action: t(action.labelKey) })} title={t('keybind.reset', { action: t(action.labelKey) })} onClick={() => applyChange(reset(action.id), action.id)}><RotateCcw size={13} aria-hidden="true" /></button>
              {actionError && <p className="keybind-row__error" role="alert">{actionError.code === 'KEYBIND_CONFLICT' ? t('keybind.conflict', { action: actionLabel(actionError.conflictId) }) : t('keybind.invalid')}</p>}
            </li>
          })}
        </ul>
      </section>
    })}
    {!keybindActions.some(matches) && <p className="settings-section__empty">{t('keybind.noResults')}</p>}
  </div>
}

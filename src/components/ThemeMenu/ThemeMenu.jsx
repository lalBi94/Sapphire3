import { useState } from 'react'
import { Check, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { hexColorValue, normalizeThemeColor, themeColorGroups } from '../../utils/theme.js'
import './ThemeMenu.css'

// Affiche le choix des thèmes, les thèmes personnalisés et leur éditeur dans le volet Theme.
export default function ThemeMenu() {
  const { t } = useTranslation()
  const { theme, presetThemes, customThemes, setTheme, createTheme, updateTheme, deleteTheme } = useTheme()
  const [editingId, setEditingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const editing = customThemes.find((entry) => entry.id === editingId) ?? null

  // Crée un thème copié du thème actif, puis ouvre directement son éditeur.
  function handleCreate() {
    setConfirmingId(null)
    setEditingId(createTheme(t('theme.defaultName')))
  }

  // Applique une couleur choisie au thème édité, en conservant la transparence éventuelle de sa base.
  function handleColor(token, value) {
    updateTheme(editing.id, { overrides: { ...editing.overrides, [token]: normalizeThemeColor(editing.colors[token], value) } })
  }

  if (editing) {
    return (
      <div className="theme-menu theme-menu--editing">
        <button type="button" className="theme-menu__back" onClick={() => setEditingId(null)}><ChevronLeft size={14} aria-hidden="true" />{t('theme.done')}</button>
        <label className="theme-menu__field">{t('theme.name')}<input type="text" aria-label={t('theme.name')} value={editing.name} onChange={(event) => updateTheme(editing.id, { name: event.target.value })} /></label>
        <label className="project-navigation__check"><input type="checkbox" checked={editing.mode === 'dark'} onChange={(event) => updateTheme(editing.id, { mode: event.target.checked ? 'dark' : 'light' })} />{t('theme.dark')}</label>
        {themeColorGroups.map((group) => <div className="theme-menu__group" key={group.labelKey}>
          <p>{t(group.labelKey)}</p>
          {group.tokens.map((field) => <label className="theme-menu__color" key={field.token}>
            <input type="color" aria-label={t(field.labelKey)} value={hexColorValue(editing.colors[field.token])} onChange={(event) => handleColor(field.token, event.target.value)} />
            <span>{t(field.labelKey)}</span>
          </label>)}
        </div>)}
      </div>
    )
  }

  return (
    <div className="theme-menu">
      <p>{t('theme.choose')}</p>
      {presetThemes.map((option) => <button type="button" className={`theme-menu__option${option.id === theme.id ? ' theme-menu__option--selected' : ''}`} aria-pressed={option.id === theme.id} key={option.id} onClick={() => setTheme(option.id)}>
        <span className="theme-menu__swatches" aria-hidden="true">{Object.values(option.colors).slice(0, 5).map((color, index) => <span key={`${option.id}:${index}`} style={{ backgroundColor: color }} />)}</span>
        <span className="theme-menu__label">{t(option.labelKey)}</span>
        {option.id === theme.id && <Check size={14} aria-hidden="true" />}
      </button>)}
      <p>{t('theme.custom')}</p>
      {customThemes.length === 0 && <p className="theme-menu__empty">{t('theme.noCustom')}</p>}
      {customThemes.map((entry) => <div className="theme-menu__custom" key={entry.id}>
        <button type="button" className={`theme-menu__option${entry.id === theme.id ? ' theme-menu__option--selected' : ''}`} aria-pressed={entry.id === theme.id} onClick={() => setTheme(entry.id)}>
          <span className="theme-menu__swatches" aria-hidden="true">{Object.values(entry.colors).slice(0, 5).map((color, index) => <span key={`${entry.id}:${index}`} style={{ backgroundColor: color }} />)}</span>
          <span className="theme-menu__label">{entry.name}</span>
          {entry.id === theme.id && <Check size={14} aria-hidden="true" />}
        </button>
        <button type="button" className="theme-menu__icon" aria-label={`${t('theme.edit')} ${entry.name}`} title={t('theme.edit')} onClick={() => { setConfirmingId(null); setEditingId(entry.id) }}><Pencil size={13} aria-hidden="true" /></button>
        <button type="button" className="theme-menu__icon theme-menu__icon--danger" aria-label={`${t('theme.delete')} ${entry.name}`} title={t('theme.delete')} onClick={() => setConfirmingId(entry.id)}><Trash2 size={13} aria-hidden="true" /></button>
      </div>)}
      {confirmingId && <div className="theme-menu__confirm" role="group" aria-label={t('theme.delete')}>
        <p>{t('theme.confirmDelete')}</p>
        <div>
          <button type="button" className="theme-menu__icon theme-menu__icon--danger" onClick={() => { deleteTheme(confirmingId); setConfirmingId(null) }}>{t('canvas.delete')}</button>
          <button type="button" className="theme-menu__icon" onClick={() => setConfirmingId(null)}>{t('import.cancel')}</button>
        </div>
      </div>}
      <button type="button" className="theme-menu__new" onClick={handleCreate}><Plus size={14} aria-hidden="true" />{t('theme.new')}</button>
    </div>
  )
}

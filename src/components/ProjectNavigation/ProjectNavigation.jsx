import { useEffect, useRef } from 'react'
import { Check, ChevronDown, Download, FolderOpen, Palette, Save, Upload, X } from 'lucide-react'
import { useTranslation } from '../../i18n.jsx'
import { useTheme } from '../../theme.jsx'
import './ProjectNavigation.css'

// Bloque le remplacement du document tant qu'il n'a pas été confirmé explicitement.
function ImportConfirmation({ path, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  return <dialog ref={dialogRef} className="project-navigation__confirmation" aria-labelledby="import-title" onCancel={onCancel}>
    <h2 id="import-title">{t('import.title')}</h2>
    <p>{t('import.body')}</p>
    <p className="project-navigation__path">{path}</p>
    <div><button type="button" autoFocus onClick={onCancel}>{t('import.cancel')}</button><button type="button" className="project-navigation__primary" onClick={onConfirm}>{t('import.confirm')}</button></div>
  </dialog>
}

// Réserve les menus futurs et expose les opérations de fichier sans connaître le canvas ni les API natives.
export default function ProjectNavigation({ busy, message, error, pendingImport, onSave, onSaveAs, onOpenSp3, onImport, onConfirmImport, onCancelImport, onDismiss, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onZoom100, onCenter, distorted, onToggleDistortion, hasSelection, onOpenSelectionMenu }) {
  const navigationRef = useRef(null)
  const { language, setLanguage, t } = useTranslation()
  const { theme, themes, setTheme } = useTheme()

  useEffect(() => {
    // Ferme les volets lorsque l'utilisateur interagit ailleurs dans l'application.
    function handleOutside(event) {
      if (!navigationRef.current.contains(event.target)) closeMenus()
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  // Garde un seul volet ouvert, y compris dans les moteurs sans prise en charge de details[name].
  function handleToggle(event) {
    if (!event.currentTarget.open) return
    for (const menu of navigationRef.current.querySelectorAll('details')) {
      if (menu !== event.currentTarget) menu.open = false
    }
  }

  // Referme les menus sans modifier la sélection ou la vue du document.
  function closeMenus() {
    for (const menu of navigationRef.current.querySelectorAll('details')) menu.open = false
  }

  // Rend le focus au déclencheur du volet fermé au clavier.
  function handleKeyDown(event) {
    if (event.key !== 'Escape') return
    const openMenu = navigationRef.current.querySelector('details[open]')
    closeMenus()
    openMenu?.querySelector('summary').focus()
  }

  // Ferme le volet avant l'ouverture du dialogue de fichier.
  function handleSaveAs(extension) {
    closeMenus()
    onSaveAs(extension)
  }

  // Ferme le volet avant l'ouverture du dialogue de fichier.
  function handleOpenSp3() {
    closeMenus()
    onOpenSp3()
  }

  // Ferme le volet avant l'ecriture du fichier courant ou l'ouverture d'Enregistrer sous.
  function handleSave() {
    closeMenus()
    onSave()
  }

  // Conserve un menu ferme avant toute operation native.
  function handleImport() {
    closeMenus()
    onImport()
  }

  return <>
    <nav ref={navigationRef} className="project-navigation" aria-label="Workspace navigation" onKeyDown={handleKeyDown}>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.settings')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" disabled={busy || !!pendingImport} onClick={handleOpenSp3}><FolderOpen size={14} aria-hidden="true" />{t('nav.openSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleSave}><Save size={14} aria-hidden="true" />{t('nav.saveSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleImport}><Upload size={14} aria-hidden="true" />{t('nav.import')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleSaveAs('json')}><Download size={14} aria-hidden="true" />{t('nav.exportJson')}</button>
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.edit')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" disabled={!canUndo} onClick={onUndo}>{t('nav.undo')}</button>
          <button type="button" disabled={!canRedo} onClick={onRedo}>{t('nav.redo')}</button>
          {hasSelection && <button type="button" onClick={onOpenSelectionMenu}>{t('nav.addToSelection')}</button>}
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.view')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <p>{t('nav.zoom')}</p>
          <button type="button" onClick={onZoomIn}>{t('nav.zoomIn')}</button>
          <button type="button" onClick={onZoomOut}>{t('nav.zoomOut')}</button>
          <button type="button" onClick={onZoom100}>{t('nav.zoom100')}</button>
          <button type="button" onClick={onCenter}>{t('nav.center')}</button>
          <label className="project-navigation__check"><input type="checkbox" checked={distorted} onChange={onToggleDistortion} />{t('nav.distortion')}</label>
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Palette size={13} aria-hidden="true" />{t('nav.theme')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu project-navigation__theme-menu">
          <p>{t('theme.choose')}</p>
          {themes.map((option) => (
            <button type="button" className={`project-navigation__theme-option${option.id === theme.id ? ' project-navigation__theme-option--selected' : ''}`} aria-pressed={option.id === theme.id} key={option.id} onClick={() => setTheme(option.id)}>
              <span className="project-navigation__theme-colors" aria-hidden="true">
                {Object.values(option.colors).slice(0, 5).map((color, index) => <span key={`${option.id}:${index}`} style={{ backgroundColor: color }} />)}
              </span>
              <span className="project-navigation__theme-label">{t(option.labelKey)}</span>
              {option.id === theme.id && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </details>
      <span className="project-navigation__status" role="status">{busy ? t('nav.working') : message}</span>
      <label className="project-navigation__language">{t('nav.language')}
        <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('nav.language')}>
          <option value="en">{t('nav.english')}</option>
          <option value="fr">{t('nav.french')}</option>
        </select>
      </label>
      {error && <div className="project-navigation__error" role="alert"><span>{error}</span><button type="button" aria-label={t('nav.dismiss')} onClick={onDismiss}><X size={14} aria-hidden="true" /></button></div>}
    </nav>
    {pendingImport && <ImportConfirmation path={pendingImport.path} onConfirm={onConfirmImport} onCancel={onCancelImport} />}
  </>
}

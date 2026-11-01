import { useEffect, useRef } from 'react'
import { Bug, ChevronDown, Clock3, Code2, Eye, FileInput, FileOutput, FilePlus, FolderOpen, Library, Palette, Play, Save, SaveAll, Search, VectorSquare, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import ThemeMenu from '../ThemeMenu/ThemeMenu.jsx'
import { supportedLanguages } from '../../utils/translations.js'
import { examples } from '../../utils/examples.js'
import { transpilationLanguages } from '../../utils/transpilation/index.js'
import './ProjectNavigation.css'

// Bloque un remplacement du document tant qu'il n'a pas été confirmé explicitement.
function ReplaceConfirmation({ titleKey, bodyKey, detail, confirmKey, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  return <dialog ref={dialogRef} className="project-navigation__confirmation" aria-labelledby="replace-title" onCancel={onCancel}>
    <h2 id="replace-title">{t(titleKey)}</h2>
    <p>{t(bodyKey)}</p>
    {detail && <p className="project-navigation__path">{detail}</p>}
    <div><button type="button" autoFocus onClick={onCancel}>{t('import.cancel')}</button><button type="button" className="project-navigation__primary" onClick={onConfirm}>{t(confirmKey)}</button></div>
  </dialog>
}

// Réserve les menus futurs et expose les opérations de fichier sans connaître le canvas ni les API natives.
export default function ProjectNavigation({ busy, message, error, pendingImport, pendingNew, recentFiles, onSave, onSaveAs, onExportSvg, onOpenSp3, onOpenRecent, onImport, onOpenExample, onConfirmImport, onCancelImport, onNew, onConfirmNew, onCancelNew, onDismiss, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onZoom100, onCenter, distorted, onToggleDistortion, heatmapAvailable = false, heatmap = false, onToggleHeatmap, hiddenCards = [], onShowCard, onShowAllHidden, hasSelection, onOpenSelectionMenu, onOpenSearch, onRunSimulation, onDebugSp3, onTranspile, selectedFunction = null, onOpenFunction }) {
  const navigationRef = useRef(null)
  const { language, setLanguage, t } = useTranslation()

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

  // Ouvre la recherche Ctrl+F, avec ou sans sélection.
  function handleOpenSearch() {
    closeMenus()
    if (onOpenSearch) onOpenSearch()
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

  // Ferme le volet avant la lecture d'un fichier recent.
  function handleOpenRecent(path) {
    closeMenus()
    onOpenRecent(path)
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

  // Referme les volets avant de lancer le mode SP3 demandé, sans activer les modes graphiques futurs.
  function handleRun(debug = false) {
    closeMenus()
    if (debug) onDebugSp3()
    else onRunSimulation()
  }

  return <>
    <nav ref={navigationRef} className="project-navigation" aria-label={t('nav.aria')} onKeyDown={handleKeyDown}>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.settings')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" disabled={busy || !!pendingImport} onClick={onNew}><FilePlus size={14} aria-hidden="true" />{t('nav.new')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleOpenSp3}><FolderOpen size={14} aria-hidden="true" />{t('nav.openSp3')}</button>
          <p>{t('nav.recentFiles')}</p>
          {recentFiles.length === 0
            ? <p>{t('nav.noRecentFiles')}</p>
            : recentFiles.map((path) => <button type="button" className="project-navigation__recent-file" title={path} disabled={busy || !!pendingImport} onClick={() => handleOpenRecent(path)} key={path}><Clock3 size={14} aria-hidden="true" /><span>{path}</span></button>)}
          <button type="button" disabled={busy || !!pendingImport} onClick={handleSave}><Save size={14} aria-hidden="true" />{t('nav.saveSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleSaveAs('sp3')}><SaveAll size={14} aria-hidden="true" />{t('nav.saveAsSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleImport}><FileInput size={14} aria-hidden="true" />{t('nav.import')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleSaveAs('json')}><FileOutput size={14} aria-hidden="true" />{t('nav.exportJson')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => { closeMenus(); onExportSvg() }}><VectorSquare size={14} aria-hidden="true" />{t('nav.exportSvg')}</button>
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.edit')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" disabled={!canUndo} onClick={onUndo}>{t('nav.undo')}</button>
          <button type="button" disabled={!canRedo} onClick={onRedo}>{t('nav.redo')}</button>
          <button type="button" onClick={handleOpenSearch}><Search size={14} aria-hidden="true" />{t('nav.search')}</button>
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
          {heatmapAvailable && <label className="project-navigation__check"><input type="checkbox" checked={heatmap} onChange={onToggleHeatmap} />{t('heatmap.toggle')}</label>}
          {hiddenCards.length > 0 && <>
            <p>{t('nav.hiddenCards')}</p>
            <div className="project-navigation__hidden-list">{hiddenCards.map((card) => <button type="button" className="project-navigation__hidden-card" key={card.id} aria-label={`${t('canvas.show')} ${card.name}`} title={card.name} onClick={() => onShowCard(card.id)}>
              <Eye size={14} aria-hidden="true" /><span>{card.name}</span>
            </button>)}</div>
            <button type="button" onClick={onShowAllHidden}>{t('canvas.showAll')}</button>
          </>}
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Palette size={13} aria-hidden="true" />{t('nav.theme')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu project-navigation__theme-menu">
          <ThemeMenu />
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Library size={13} aria-hidden="true" />{t('nav.examples')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <p>{t('examples.choose')}</p>
          {examples.map((example) => <button type="button" key={example.id} onClick={() => { closeMenus(); onOpenExample(example.id) }}>{t(example.labelKey)}</button>)}
        </div>
      </details>
      <div className="project-navigation__run-controls">
        <details name="workspace-menu" onToggle={handleToggle}>
          <summary><Code2 size={13} aria-hidden="true" />{t('transpile.button')}<ChevronDown size={12} aria-hidden="true" /></summary>
          <div className="project-navigation__menu">
            <p>{t('transpile.chooseLanguage')}</p>
            {transpilationLanguages.map((option) => <button type="button" key={option.id} disabled={!option.available} onClick={() => { closeMenus(); onTranspile(option.id) }}>{option.name}{!option.available && ` · ${t('transpile.unavailable')}`}</button>)}
          </div>
        </details>
        <button type="button" className="project-navigation__run" title={t('run.simulateSp3')} onClick={() => handleRun()}><Play size={13} fill="currentColor" aria-hidden="true" />{t('nav.run')}</button>
        <details name="workspace-menu" onToggle={handleToggle}>
          <summary className="project-navigation__run-toggle" aria-label={t('run.actions')} title={t('run.actions')}><ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="project-navigation__menu project-navigation__run-menu">
            <p>{t('run.workspace')}</p>
            <button type="button" onClick={() => handleRun()}><Play size={14} aria-hidden="true" />{t('run.simulateSp3')}</button>
            <button type="button" onClick={() => handleRun(true)}><Bug size={14} aria-hidden="true" />{t('run.debugSp3')}</button>
            {selectedFunction && <>
              <p>{t('run.selectedFunction')}</p>
              <button type="button" onClick={() => { closeMenus(); onOpenFunction(selectedFunction.id) }}><Play size={14} aria-hidden="true" />{t('run.thisFunction')}</button>
              <button type="button" onClick={() => { closeMenus(); onOpenFunction(selectedFunction.id) }}><Bug size={14} aria-hidden="true" />{t('run.debugThisFunction')}</button>
            </>}
            <p>{t('run.graphical')}</p>
            <button type="button" disabled title={t('run.later')}>{t('run.simulateGraphical')}</button>
            <button type="button" disabled title={t('run.later')}>{t('run.debugGraphical')}</button>
            <p className="project-navigation__future-note">{t('run.later')}</p>
          </div>
        </details>
      </div>
      <span className="project-navigation__status" role="status">{busy ? t('nav.working') : message}</span>
      <label className="project-navigation__language">{t('nav.language')}
        <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('nav.language')}>
          {supportedLanguages.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>      </label>
      {error && <div className="project-navigation__error" role="alert"><span>{error}</span><button type="button" aria-label={t('nav.dismiss')} onClick={onDismiss}><X size={14} aria-hidden="true" /></button></div>}
    </nav>
    {pendingImport && <ReplaceConfirmation titleKey="import.title" bodyKey="import.body" detail={pendingImport.detail ?? pendingImport.path} confirmKey="import.confirm" onConfirm={onConfirmImport} onCancel={onCancelImport} />}
    {pendingNew && <ReplaceConfirmation titleKey="new.title" bodyKey="new.body" confirmKey="new.confirm" onConfirm={onConfirmNew} onCancel={onCancelNew} />}
  </>
}

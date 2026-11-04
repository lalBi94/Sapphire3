import { Fragment, useEffect, useRef, useState } from 'react'
import { Bug, Bookmark, BookmarkPlus, ChevronDown, Clock3, Code2, Download, Eye, EyeOff, FileInput, FileOutput, FilePlus, FolderOpen, LayoutGrid, Library, Maximize2, Palette, Pause, Play, Power, RefreshCw, Save, SaveAll, Search, Settings2, Square, Trash2, VectorSquare, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import ThemeMenu from '../ThemeMenu/ThemeMenu.jsx'
import { supportedLanguages } from '../../utils/translations.js'
import { exampleCategories, exampleSubcategories, examples } from '../../utils/examples.js'
import { transpilationLanguages } from '../../utils/transpilation/index.js'
import { describeBookmark } from '../../utils/logic/index.js'
import { appVersion } from '../../utils/appInfo.js'
import { typeLabel } from '../LogicTree/logicLabels.js'
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
export default function ProjectNavigation({ busy, message, error, pendingImport, pendingNew, recentFiles, onSave, onSaveAs, onExportSvg, onOpenSp3, onOpenRecent, onImport, onOpenExample, onConfirmImport, onCancelImport, onNew, onConfirmNew, onCancelNew, onDismiss, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onZoom100, onCenter, onArrangeModules, distorted, onToggleDistortion, minimapVisible = true, onToggleMinimap, fullScreen = false, onToggleFullScreen, gridVisible = true, onToggleGrid, hiddenCards = [], onShowCard, onShowAllHidden, presentation = false, onTogglePresentation, hasSelection, onOpenSelectionMenu, onOpenSearch, onRunSimulation, onRunGraphical, onDebugSp3, onTranspile, onCheckTranspile, selectedFunction = null, onOpenFunction, simulationRunning = false, simulationPaused = false, onPauseSimulation, onResumeSimulation, onStopSimulation, onOpenRepository, onOpenSettings, onQuit, updateAvailable = false, updateVersion = '', onInstallUpdate, bookmarks = [], modules = [], canBookmark = false, onSaveBookmark, onInsertBookmark, onDeleteBookmark, onOpenBookmarks }) {
  const navigationRef = useRef(null)
  const [insertingId, setInsertingId] = useState(null)
  const [transpileChecks, setTranspileChecks] = useState({})
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
  // Les groupes imbriqués du volet Examples déclenchent aussi un événement : ils sont ignorés.
  function handleToggle(event) {
    if (event.target !== event.currentTarget) return
    if (!event.currentTarget.open) return
    for (const menu of navigationRef.current.querySelectorAll('details[name="workspace-menu"]')) {
      if (menu !== event.currentTarget) menu.open = false
    }
  }

  // Recalcule, à l'ouverture du menu Transpile, si le code courant est transpilable vers chaque cible installée.
  function handleTranspileToggle(event) {
    handleToggle(event)
    if (event.currentTarget.open && typeof onCheckTranspile === 'function') setTranspileChecks(onCheckTranspile())
  }

  // Referme les menus sans modifier la sélection ou la vue du document.
  function closeMenus() {
    setInsertingId(null)
    for (const menu of navigationRef.current.querySelectorAll('details')) menu.open = false
  }

  // Ouvre le choix de destination d'un favori, ou l'insère au plus simple.
  function handleBookmarkInsert(entry, describe) {
    if (describe.kind !== 'function' || modules.length === 0) {
      onInsertBookmark(entry.id, null)
      return
    }
    setInsertingId((current) => current === entry.id ? null : entry.id)
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

  // Referme les volets avant de lancer le mode demandé, sans activer les modes graphiques futurs.
  function handleRun(debug = false) {
    closeMenus()
    if (debug) onDebugSp3()
    else onRunSimulation()
  }

  // Referme les volets avant d'ouvrir la simulation graphique simplifiée.
  function handleRunGraphical() {
    closeMenus()
    onRunGraphical()
  }

  // Referme les volets avant de basculer le mode présentation.
  function handlePresentation() {
    closeMenus()
    onTogglePresentation()
  }

  return <>
    <nav ref={navigationRef} className="project-navigation" aria-label={t('nav.aria')} onKeyDown={handleKeyDown}>
      {!presentation && <>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.settings')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" onClick={() => { closeMenus(); onOpenSettings() }}><Settings2 size={14} aria-hidden="true" />{t('settings.open')}</button>
          <p className="project-navigation__section">{t('menu.workspace')}</p>
          <button type="button" disabled={busy || !!pendingImport} onClick={onNew}><FilePlus size={14} aria-hidden="true" />{t('nav.new')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleOpenSp3}><FolderOpen size={14} aria-hidden="true" />{t('nav.openSp3')}</button>
          <p>{t('nav.recentFiles')}</p>
          {recentFiles.length === 0
            ? <p>{t('nav.noRecentFiles')}</p>
            : recentFiles.map((path) => <button type="button" className="project-navigation__recent-file" title={path} disabled={busy || !!pendingImport} onClick={() => handleOpenRecent(path)} key={path}><Clock3 size={14} aria-hidden="true" /><span>{path}</span></button>)}
          <button type="button" disabled={busy || !!pendingImport} onClick={handleSave}><Save size={14} aria-hidden="true" />{t('nav.saveSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleSaveAs('sp3')}><SaveAll size={14} aria-hidden="true" />{t('nav.saveAsSp3')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={handleImport}><FileInput size={14} aria-hidden="true" />{t('nav.import')}</button>
          <p className="project-navigation__section">{t('menu.exports')}</p>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleSaveAs('json')}><FileOutput size={14} aria-hidden="true" />{t('nav.exportJson')}</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => { closeMenus(); onExportSvg() }}><VectorSquare size={14} aria-hidden="true" />{t('nav.exportSvg')}</button>
          <button type="button" className="project-navigation__quit" onClick={() => { closeMenus(); onQuit() }}><Power size={14} aria-hidden="true" />{t('settings.quit')}</button>
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.edit')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <p className="project-navigation__section">{t('menu.history')}</p>
          <button type="button" disabled={!canUndo} onClick={onUndo}>{t('nav.undo')}</button>
          <button type="button" disabled={!canRedo} onClick={onRedo}>{t('nav.redo')}</button>
          <p className="project-navigation__section">{t('menu.selection')}</p>
          <button type="button" onClick={handleOpenSearch}><Search size={14} aria-hidden="true" />{t('nav.search')}</button>
          {hasSelection && <button type="button" onClick={onOpenSelectionMenu}>{t('nav.addToSelection')}</button>}
        </div>
      </details>
      </>}
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>{t('nav.view')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <p className="project-navigation__section">{t('menu.presentation')}</p>
          <label className="project-navigation__check"><input type="checkbox" checked={presentation} onChange={handlePresentation} />{t('nav.presentation')}</label>
          <p className="project-navigation__section">{t('nav.zoom')}</p>
          <button type="button" onClick={onZoomIn}>{t('nav.zoomIn')}</button>
          <button type="button" onClick={onZoomOut}>{t('nav.zoomOut')}</button>
          <button type="button" onClick={onZoom100}>{t('nav.zoom100')}</button>
          <button type="button" onClick={onCenter}>{t('nav.center')}</button>
          {!presentation && <>
          <p className="project-navigation__section">{t('nav.layout')}</p>
          <button type="button" onClick={onArrangeModules}><LayoutGrid size={14} aria-hidden="true" />{t('nav.arrangeModules')}</button>
          </>}
          <p className="project-navigation__section">{t('menu.display')}</p>
          <label className="project-navigation__check"><input type="checkbox" checked={distorted} onChange={onToggleDistortion} />{t('nav.distortion')}</label>
          <label className="project-navigation__check"><input type="checkbox" checked={minimapVisible} onChange={onToggleMinimap} />{t('nav.minimap')}</label>
          <label className="project-navigation__check"><input type="checkbox" checked={!gridVisible} onChange={onToggleGrid} />{t('nav.hideGrid')}</label>
          <label className="project-navigation__check"><input type="checkbox" checked={fullScreen} onChange={onToggleFullScreen} />{t('nav.fullscreen')}</label>
          {!presentation && hiddenCards.length > 0 && <>
            <p className="project-navigation__section">{t('nav.hiddenCards')}</p>
            <div className="project-navigation__hidden-list">{hiddenCards.map((card) => <button type="button" className="project-navigation__hidden-card" key={card.id} aria-label={`${t('canvas.show')} ${card.name}`} title={card.name} onClick={() => onShowCard(card.id)}>
              <Eye size={14} aria-hidden="true" /><span>{card.name}</span>
            </button>)}</div>
            <button type="button" onClick={onShowAllHidden}>{t('canvas.showAll')}</button>
          </>}
        </div>
      </details>
      {!presentation && <>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Palette size={13} aria-hidden="true" />{t('nav.theme')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu project-navigation__theme-menu">
          <ThemeMenu />
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Library size={13} aria-hidden="true" />{t('nav.examples')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          {exampleCategories.map((category) => {
            const entries = examples.filter((example) => example.category === category.id)
            if (entries.length === 0) return null
            // Regroupe par sous-catégorie ; une catégorie sans sous-catégorie liste ses exemples directement.
            const groups = []
            for (const example of entries) {
              const key = example.subcategory ?? ''
              let group = groups.find((entry) => entry.key === key)
              if (!group) { group = { key, items: [] }; groups.push(group) }
              group.items.push(example)
            }
            const nested = groups.some((group) => group.key !== '')
            const exampleButton = (example) => <button type="button" key={example.id} onClick={() => { closeMenus(); onOpenExample(example.id) }}>{t(example.labelKey)}</button>
            return <details className="project-navigation__group" key={category.id}>
              <summary><span className="project-navigation__group-label">{t(category.labelKey)}</span><span className="project-navigation__group-count">{entries.length}</span></summary>
              <div className="project-navigation__group-body">
                {nested
                  ? groups.map((group) => {
                    const subcategory = exampleSubcategories.find((entry) => entry.id === group.key)
                    if (!subcategory) return group.items.map(exampleButton)
                    return <details className="project-navigation__subgroup" key={group.key}>
                      <summary><span className="project-navigation__group-label">{t(subcategory.labelKey)}</span><span className="project-navigation__group-count">{group.items.length}</span></summary>
                      <div className="project-navigation__group-body">{group.items.map(exampleButton)}</div>
                    </details>
                  })
                  : entries.map(exampleButton)}
              </div>
            </details>
          })}
        </div>
      </details>
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary><Bookmark size={13} aria-hidden="true" />{t('nav.bookmarks')}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <p className="project-navigation__section">{t('menu.actions')}</p>
          <button type="button" disabled={!canBookmark} onClick={onSaveBookmark}><BookmarkPlus size={14} aria-hidden="true" />{t('bookmark.save')}</button>
          {!canBookmark && <p className="project-navigation__hint">{t('bookmark.onlyPure')}</p>}
          <button type="button" onClick={() => { closeMenus(); onOpenBookmarks() }}><Maximize2 size={14} aria-hidden="true" />{t('bookmark.openWindow')}</button>
          <p className="project-navigation__section">{t('menu.saved')}</p>
          {bookmarks.length === 0
            ? <p>{t('bookmark.empty')}</p>
            : <div className="project-navigation__bookmarks">{bookmarks.map((entry) => {
              const describe = describeBookmark(entry)
              const blocks = describe.nodeCount === 1 ? t('bookmark.blocksOne') : t('bookmark.blocks', { count: describe.nodeCount })
              const functions = describe.functionCount === 1 ? t('bookmark.functionsOne') : t('bookmark.functions', { count: describe.functionCount })
              const signature = describe.kind === 'function'
                ? `(${describe.parameters.map((type) => typeLabel(type, t)).join(', ')}) → ${typeLabel(describe.returnType, t)}`
                : functions
              return <div className="project-navigation__bookmark-entry" key={entry.id}>
                <div className="project-navigation__bookmark">
                  <button type="button" className="project-navigation__bookmark-insert" title={t('bookmark.insert', { name: entry.name })} onClick={() => handleBookmarkInsert(entry, describe)}><Download size={13} aria-hidden="true" /><span className="project-navigation__bookmark-text">
                    <span className="project-navigation__bookmark-name">{describe.name || entry.name}</span>
                    <span className="project-navigation__bookmark-summary">{signature} · {blocks}</span>
                  </span></button>
                  <button type="button" className="project-navigation__bookmark-delete" aria-label={t('bookmark.delete', { name: entry.name })} title={t('bookmark.delete', { name: entry.name })} onClick={() => onDeleteBookmark(entry.id)}><Trash2 size={13} aria-hidden="true" /></button>
                </div>
                {insertingId === entry.id && <div className="project-navigation__destinations">
                  <p>{t('bookmark.destination')}</p>
                  <button type="button" onClick={() => { setInsertingId(null); onInsertBookmark(entry.id, null) }}>{t('bookmark.newModule')}</button>
                  {modules.map((module) => <button type="button" key={module.id} onClick={() => { setInsertingId(null); onInsertBookmark(entry.id, module.id) }}>{t('bookmark.intoModule', { name: module.name })}</button>)}
                </div>}
              </div>
            })}
            </div>}
        </div>
      </details>
      </>}
      <div className="project-navigation__run-controls">
        {!presentation && <details name="workspace-menu" onToggle={handleTranspileToggle}>
          <summary><Code2 size={13} aria-hidden="true" />{t('transpile.button')}<ChevronDown size={12} aria-hidden="true" /></summary>
          <div className="project-navigation__menu">
            <p className="project-navigation__section">{t('transpile.chooseLanguage')}</p>
            {transpilationLanguages.map((option) => {
              const status = option.available ? transpileChecks[option.id] : 'unavailable'
              const chipClass = status === 'ok' ? ' project-navigation__chip--available' : status === 'blocked' ? ' project-navigation__chip--blocked' : ' project-navigation__chip--unavailable'
              const chipLabel = status === 'ok' ? t('transpile.ready') : status === 'blocked' ? t('transpile.blocked') : t('transpile.unavailable')
              return <button type="button" key={option.id} disabled={!option.available} onClick={() => { closeMenus(); onTranspile(option.id) }}><span>{option.name}</span><span className={`project-navigation__chip${chipClass}`}>{chipLabel}</span></button>
            })}
          </div>
        </details>}
        <button type="button" className={`project-navigation__run${simulationRunning ? ' project-navigation__run--running' : ''}`} title={t('run.simulateSp3')} onClick={() => handleRun()}><Play size={13} fill="currentColor" aria-hidden="true" />{t('nav.run')}</button>
        {simulationRunning && <button type="button" className="project-navigation__run-action" title={t('simulation.pause')} aria-label={t('simulation.pause')} onClick={onPauseSimulation}><Pause size={12} fill="currentColor" aria-hidden="true" />{t('simulation.pause')}</button>}
        {simulationPaused && <button type="button" className="project-navigation__run-action" title={t('simulation.resume')} aria-label={t('simulation.resume')} onClick={onResumeSimulation}><Play size={12} fill="currentColor" aria-hidden="true" />{t('simulation.resume')}</button>}
        {(simulationRunning || simulationPaused) && <button type="button" className="project-navigation__stop" title={t('simulation.stop')} aria-label={t('simulation.stop')} onClick={onStopSimulation}><Square size={12} fill="currentColor" aria-hidden="true" />{t('simulation.stop')}</button>}
        <details name="workspace-menu" onToggle={handleToggle}>
          <summary className="project-navigation__run-toggle" aria-label={t('run.actions')} title={t('run.actions')}><ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="project-navigation__menu project-navigation__run-menu">
            <p className="project-navigation__section">{t('run.workspace')}</p>
            <button type="button" onClick={() => handleRun()}><Play size={14} aria-hidden="true" />{t('run.simulateSp3')}</button>
            <button type="button" onClick={() => handleRun(true)}><Bug size={14} aria-hidden="true" />{t('run.debugSp3')}</button>
            {selectedFunction && <>
              <p className="project-navigation__section">{t('run.selectedFunction')}</p>
              <button type="button" onClick={() => { closeMenus(); onOpenFunction(selectedFunction.id) }}><Play size={14} aria-hidden="true" />{t('run.thisFunction')}</button>
              <button type="button" onClick={() => { closeMenus(); onOpenFunction(selectedFunction.id) }}><Bug size={14} aria-hidden="true" />{t('run.debugThisFunction')}</button>
            </>}
            <p className="project-navigation__section">{t('run.graphical')}</p>
            <button type="button" onClick={handleRunGraphical}>{t('run.simulateGraphical')}</button>
            <button type="button" disabled title={t('run.later')}>{t('run.debugGraphical')}</button>
            <p className="project-navigation__future-note">{t('run.later')}</p>
          </div>
        </details>
      </div>
      <span className="project-navigation__status" role="status">{busy ? t('nav.working') : message}</span>
      <label className="project-navigation__language">
        <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('nav.language')}>
          {supportedLanguages.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>      </label>
      {!presentation && updateAvailable && <button type="button" className="project-navigation__update" onClick={onInstallUpdate} title={t('update.available', { version: updateVersion })}><Download size={13} aria-hidden="true" />{t('update.now')}</button>}
      {presentation && <button type="button" className="project-navigation__presentation-exit" onClick={handlePresentation} title={t('presentation.exit')}><EyeOff size={13} aria-hidden="true" />{t('presentation.exit')}</button>}
      <button type="button" className="project-navigation__reload" onClick={() => window.location.reload()} aria-label={t('nav.reload')} title={t('nav.reload')}><RefreshCw size={13} aria-hidden="true" /></button>
      <button type="button" className="project-navigation__signature" onClick={onOpenRepository} aria-label={`${t('nav.github')} · ${t('nav.version')} ${appVersion}`} title={`${t('nav.github')} · ${t('nav.version')} ${appVersion}`}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" /></svg>
        <span className="project-navigation__signature-version">v{appVersion}</span>
      </button>
      {error && <div className="project-navigation__error" role="alert"><span>{error}</span><button type="button" aria-label={t('nav.dismiss')} onClick={onDismiss}><X size={14} aria-hidden="true" /></button></div>}
    </nav>
    {!presentation && pendingImport && <ReplaceConfirmation titleKey="import.title" bodyKey="import.body" detail={pendingImport.detail ?? pendingImport.path} confirmKey="import.confirm" onConfirm={onConfirmImport} onCancel={onCancelImport} />}
    {!presentation && pendingNew && <ReplaceConfirmation titleKey="new.title" bodyKey="new.body" confirmKey="new.confirm" onConfirm={onConfirmNew} onCancel={onCancelNew} />}
  </>
}

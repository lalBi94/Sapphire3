import { BookmarkPlus, Check, Download, ExternalLink, FileInput, FileOutput, FilePlus, FolderOpen, Maximize2, RefreshCw, Save, SaveAll, Trash2, VectorSquare } from 'lucide-react'
import ThemeMenu from '../ThemeMenu/ThemeMenu.jsx'
import KeybindsSection from './KeybindsSection.jsx'
import WebDashboardSection from './WebDashboardSection.jsx'
import LanguageFlag, { languageFlagColors } from './LanguageFlag.jsx'
import { describeBookmark, getNodeSchema } from '../../utils/logic/index.js'
import { supportedLanguages } from '../../utils/translations.js'
import { appVersion } from '../../utils/appInfo.js'
import { diagnosticLabel, groupLabel, typeLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import appLogo from '../../assets/branding/01_WEB/WEBP_lossless/sapphire3_logo_128x128_lossless.webp'

// Espace de travail : actions de fichier, disposition du canvas, vue et chemins récents.
export function WorkspaceSection({ busy, pendingImport, onNew, onOpenWorkspace, onSave, onSaveWorkspaceAs, onExportArchive, onImport, onExportSvg, recentWorkspaces, onOpenRecent, distorted = false, onToggleDistortion, minimapVisible = true, onToggleMinimap, magnetEnabled = true, onToggleMagnet, navVisible = true, onToggleNav, hiddenCards = [], onShowAllHidden, onZoomIn, onZoomOut, onZoom100, onCenter }) {
  const { t } = useTranslation()
  const disabled = busy || Boolean(pendingImport)
  return <div className="settings-section">
    <div className="settings-section__actions">
      <button type="button" disabled={disabled} onClick={onNew}><FilePlus size={14} aria-hidden="true" />{t('nav.new')}</button>
      <button type="button" disabled={disabled} onClick={onOpenWorkspace}><FolderOpen size={14} aria-hidden="true" />{t('nav.openWorkspace')}</button>
      <button type="button" disabled={disabled} onClick={onSave}><Save size={14} aria-hidden="true" />{t('nav.saveWorkspace')}</button>
      <button type="button" disabled={disabled} onClick={onSaveWorkspaceAs}><SaveAll size={14} aria-hidden="true" />{t('nav.saveWorkspaceAs')}</button>
      <button type="button" disabled={disabled} onClick={onImport}><FileInput size={14} aria-hidden="true" />{t('nav.importLegacy')}</button>
      <button type="button" disabled={disabled} onClick={onExportArchive}><FileOutput size={14} aria-hidden="true" />{t('nav.exportWorkspace')}</button>
      <button type="button" disabled={disabled} onClick={onExportSvg}><VectorSquare size={14} aria-hidden="true" />{t('nav.exportSvg')}</button>
    </div>

    <p className="settings-section__subtitle">{t('settings.layout')}</p>
    <label className="settings-check"><input type="checkbox" checked={distorted} onChange={onToggleDistortion} />{t('nav.distortion')}</label>
    <label className="settings-check"><input type="checkbox" checked={minimapVisible} onChange={onToggleMinimap} />{t('nav.minimap')}</label>
    <label className="settings-check"><input type="checkbox" checked={magnetEnabled} onChange={onToggleMagnet} />{t('nav.magnet')}</label>
    <label className="settings-check"><input type="checkbox" checked={navVisible} onChange={onToggleNav} />{t('settings.navBar')}</label>
    {hiddenCards.length > 0 && <div className="settings-section__actions"><button type="button" onClick={onShowAllHidden}>{t('canvas.showAll')} · {hiddenCards.length}</button></div>}

    <p className="settings-section__subtitle">{t('nav.view')}</p>
    <div className="settings-section__actions settings-section__grid">
      <button type="button" onClick={onZoomIn}>{t('nav.zoomIn')}</button>
      <button type="button" onClick={onZoomOut}>{t('nav.zoomOut')}</button>
      <button type="button" onClick={onZoom100}>{t('nav.zoom100')}</button>
      <button type="button" onClick={onCenter}>{t('nav.center')}</button>
    </div>

    <p className="settings-section__subtitle">{t('nav.recentWorkspaces')}</p>
    {recentWorkspaces.length === 0
      ? <p className="settings-section__empty">{t('nav.noRecentWorkspaces')}</p>
      : <ul className="settings-section__recent">{recentWorkspaces.map((path) => <li key={path}><button type="button" disabled={disabled} title={path} onClick={() => onOpenRecent(path)}>{path}</button></li>)}</ul>}
  </div>
}

// Informations du projet : données brutes, diagnostics courants et répartitions interprétées.
export function ProjectInfoSection({ project, currentFolder, diagnostics = [], referenceCount = 0, unusedCount = 0 }) {
  const { t } = useTranslation()
  const roots = project.modules.flatMap((module) => module.rootNodeIds)
  const entry = roots.map((id) => project.nodes.find((node) => node.id === id)).find((node) => node?.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  const functionCount = project.nodes.filter((node) => node.kind === 'FunctionDeclaration').length
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')
  const issues = [...errors, ...warnings]
  const modules = project.modules.map((module) => ({ id: module.id, name: module.name, count: project.nodes.filter((node) => node.moduleId === module.id).length }))
  const maxModule = Math.max(1, ...modules.map((module) => module.count))
  const families = new Map()
  for (const node of project.nodes) {
    const group = getNodeSchema(node.kind)?.group ?? 'incomplete'
    families.set(group, (families.get(group) ?? 0) + 1)
  }
  const familyRows = [...families.entries()].sort((left, right) => right[1] - left[1])
  const maxFamily = Math.max(1, ...familyRows.map(([, count]) => count))
  const moduleName = (id) => project.modules.find((module) => module.id === id)?.name ?? ''

  return <div className="settings-section">
    <dl className="settings-info">
      <div><dt>{t('settings.info.modules')}</dt><dd>{project.modules.length}</dd></div>
      <div><dt>{t('settings.info.nodes')}</dt><dd>{project.nodes.length}</dd></div>
      <div><dt>{t('settings.info.functions')}</dt><dd>{functionCount}</dd></div>
      <div><dt>{t('settings.info.references')}</dt><dd>{referenceCount}</dd></div>
      <div><dt>{t('settings.info.unused')}</dt><dd>{unusedCount}</dd></div>
      <div><dt>{t('settings.info.entryPoint')}</dt><dd>{entry?.properties?.name ?? t('settings.info.none')}</dd></div>
      <div><dt>{t('settings.info.folder')}</dt><dd className="settings-info__path">{currentFolder ?? t('settings.info.notSaved')}</dd></div>
    </dl>

    <p className="settings-section__subtitle">{t('transpile.diagnostics')}</p>
    <p className="settings-info__counts">
      <span className={errors.length ? 'settings-count settings-count--error' : 'settings-count'}>{t('settings.info.errors')} · {errors.length}</span>
      <span className={warnings.length ? 'settings-count settings-count--warning' : 'settings-count'}>{t('settings.info.warnings')} · {warnings.length}</span>
    </p>
    {issues.length === 0
      ? <p className="settings-section__empty">{t('settings.info.noIssues')}</p>
      : <ul className="settings-issues">{issues.slice(0, 12).map((diagnostic, index) => <li key={`${diagnostic.code}:${index}`} className={diagnostic.severity === 'warning' ? 'settings-issues__warning' : ''}>
        <span>{diagnosticLabel(diagnostic.code, t)}</span>
        <span className="settings-issues__meta">{moduleName(diagnostic.location?.moduleId)}{diagnostic.location?.moduleId ? ' · ' : ''}<code>{diagnostic.code}</code></span>
      </li>)}</ul>}
    {issues.length > 12 && <p className="settings-section__hint">{t('settings.info.more', { count: issues.length - 12 })}</p>}

    {modules.length > 0 && <>
      <p className="settings-section__subtitle">{t('settings.info.nodesByModule')}</p>
      <ul className="settings-chart">{modules.map((module) => <li key={module.id}>
        <span className="settings-chart__label" title={module.name}>{module.name}</span>
        <span className="settings-chart__track"><span className="settings-chart__bar" style={{ width: `${(module.count / maxModule) * 100}%` }} /></span>
        <span className="settings-chart__value">{module.count}</span>
      </li>)}</ul>
    </>}

    {familyRows.length > 0 && <>
      <p className="settings-section__subtitle">{t('settings.info.families')}</p>
      <ul className="settings-chart">{familyRows.map(([group, count]) => <li key={group}>
        <span className="settings-chart__label" title={groupLabel(group, t)}>{groupLabel(group, t)}</span>
        <span className="settings-chart__track"><span className="settings-chart__bar settings-chart__bar--group" style={{ width: `${(count / maxFamily) * 100}%` }} /></span>
        <span className="settings-chart__value">{count}</span>
      </li>)}</ul>
    </>}
  </div>
}

// Thème : galerie stylisée du sélecteur de thèmes, sans duplication de la logique.
export function ThemeSection() {
  return <div className="settings-section settings-section--theme"><ThemeMenu variant="settings" /></div>
}

// Langue : toutes les langues proposées, sous forme de boutons radio dans une grille.
export function LanguageSection() {
  const { t, language, setLanguage } = useTranslation()
  return <div className="settings-section">
    <fieldset className="settings-radio-group" aria-label={t('nav.language')}>
      {supportedLanguages.map((option) => {
        const selected = option.id === language
        const colors = languageFlagColors[option.id] ?? languageFlagColors.en
        return <label className={selected ? 'settings-radio settings-radio--selected' : 'settings-radio'} key={option.id} style={{ '--flag-a': colors[0], '--flag-b': colors[1], '--flag-c': colors[2] }}>
          <input type="radio" name="settings-language" value={option.id} checked={selected} onChange={() => setLanguage(option.id)} />
          <span className="settings-radio__flag"><LanguageFlag language={option.id} /></span>
          <span className="settings-radio__label">{option.label}</span>
          {selected && <Check size={14} aria-hidden="true" />}
        </label>
      })}
    </fieldset>
  </div>
}

// Favoris : enregistrement, fenêtre détaillée et liste abrégée avec insertion ou suppression.
export function BookmarksSection({ bookmarks = [], canBookmark, onSaveBookmark, onOpenBookmarks, onInsertBookmark, onDeleteBookmark }) {
  const { t } = useTranslation()
  return <div className="settings-section">
    <div className="settings-section__actions">
      <button type="button" disabled={!canBookmark} onClick={onSaveBookmark}><BookmarkPlus size={14} aria-hidden="true" />{t('bookmark.save')}</button>
      <button type="button" onClick={onOpenBookmarks}><Maximize2 size={14} aria-hidden="true" />{t('bookmark.openWindow')}</button>
    </div>
    {!canBookmark && <p className="settings-section__hint">{t('bookmark.onlyPure')}</p>}
    {bookmarks.length === 0
      ? <p className="settings-section__empty">{t('bookmark.empty')}</p>
      : <ul className="settings-bookmarks">{bookmarks.map((entry) => {
        const describe = describeBookmark(entry)
        const signature = describe.kind === 'function' ? `(${describe.parameters.map((type) => typeLabel(type, t)).join(', ')}) → ${typeLabel(describe.returnType, t)}` : ''
        return <li key={entry.id}>
          <span className="settings-bookmarks__text"><strong>{describe.name || entry.name}</strong>{signature && <span>{signature}</span>}</span>
          <button type="button" aria-label={t('bookmark.insert', { name: entry.name })} title={t('bookmark.insert', { name: entry.name })} onClick={() => onInsertBookmark(entry.id, null)}><Download size={13} aria-hidden="true" /></button>
          <button type="button" className="settings-bookmarks__delete" aria-label={t('bookmark.delete', { name: entry.name })} title={t('bookmark.delete', { name: entry.name })} onClick={() => onDeleteBookmark(entry.id)}><Trash2 size={13} aria-hidden="true" /></button>
        </li>
      })}</ul>}
  </div>
}

// Application : version courante, état de mise à jour et lien vers le dépôt.
export function ApplicationSection({ onOpenRepository, update, onCheckUpdate, onInstallUpdate, discordEnabled = true, onToggleDiscord = () => {} }) {
  const { t } = useTranslation()
  const status = update?.status ?? 'idle'
  const release = update?.release ?? null
  const manual = release?.installMode === 'manual'
  const statusText = status === 'available' ? t('update.available', { version: release.version })
    : status === 'checking' ? t('update.checking')
      : status === 'none' ? t('update.upToDate')
        : status === 'unavailable' ? t('update.desktop')
          : status === 'unsupported' ? t('update.unsupported')
            : status === 'error' ? t('update.error')
              : t('update.idle')
  return <div className="settings-section">
    <div className="settings-section__identity">
      <img src={appLogo} width="64" height="64" alt="" />
      <strong>Sapphire 3</strong>
    </div>
    <p className="settings-section__row"><span>{t('nav.version')}</span><strong>{appVersion}</strong></p>
    <label className="settings-check"><input type="checkbox" checked={discordEnabled} onChange={(event) => onToggleDiscord(event.target.checked)} />{t('settings.discordPresence')}</label>
    <p className="settings-section__hint">{t('settings.discordPresenceHint')}</p>
    <p className="settings-section__row"><span>{t('update.status')}</span><strong>{statusText}</strong></p>
    <div className="settings-section__actions">
      <button type="button" disabled={status === 'checking' || status === 'unavailable' || status === 'unsupported'} onClick={onCheckUpdate}><RefreshCw size={14} aria-hidden="true" />{status === 'checking' ? t('update.checking') : t('update.check')}</button>
      {release && <button type="button" className="settings-section__primary" onClick={onInstallUpdate}><Download size={14} aria-hidden="true" />{t(manual ? 'update.download' : 'update.now')}</button>}
    </div>
    {manual && <p className="settings-section__hint">{t('update.manualHint')}</p>}
    <div className="settings-section__actions"><button type="button" onClick={onOpenRepository}><ExternalLink size={14} aria-hidden="true" />{t('nav.github')}</button></div>
  </div>
}

// Registre des catégories et sous-catégories : ajouter une entrée ici suffit à créer une nouvelle page.
export const settingsCategories = [
  { id: 'project', labelKey: 'settings.category.project', sections: [
    { id: 'workspace', labelKey: 'menu.workspace', Component: WorkspaceSection },
    { id: 'info', labelKey: 'settings.section.info', Component: ProjectInfoSection },
  ] },
  { id: 'appearance', labelKey: 'settings.category.appearance', sections: [
    { id: 'theme', labelKey: 'nav.theme', Component: ThemeSection },
    { id: 'language', labelKey: 'nav.language', Component: LanguageSection },
  ] },
  { id: 'keybinds', labelKey: 'settings.category.keybinds', sections: [
    { id: 'shortcuts', labelKey: 'settings.section.keybinds', Component: KeybindsSection },
  ] },
  { id: 'bookmarks', labelKey: 'nav.bookmarks', sections: [
    { id: 'library', labelKey: 'settings.section.library', Component: BookmarksSection },
  ] },
  { id: 'export', labelKey: 'settings.category.export', sections: [
    { id: 'webDashboard', labelKey: 'settings.section.webDashboard', Component: WebDashboardSection },
  ] },
  { id: 'about', labelKey: 'settings.category.about', sections: [
    { id: 'application', labelKey: 'settings.section.application', Component: ApplicationSection },
  ] },
]

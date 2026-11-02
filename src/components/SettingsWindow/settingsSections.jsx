import { BookmarkPlus, Download, ExternalLink, FileInput, FileOutput, FilePlus, FolderOpen, Maximize2, RefreshCw, Save, SaveAll, Trash2, VectorSquare } from 'lucide-react'
import ThemeMenu from '../ThemeMenu/ThemeMenu.jsx'
import { describeBookmark } from '../../utils/logic/index.js'
import { supportedLanguages } from '../../utils/translations.js'
import { appVersion } from '../../utils/appInfo.js'
import { typeLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Espace de travail : actions de fichier, exports et chemins récents.
export function WorkspaceSection({ busy, pendingImport, onNew, onOpenSp3, onSave, onSaveAs, onImport, onExportSvg, recentFiles, onOpenRecent }) {
  const { t } = useTranslation()
  const disabled = busy || Boolean(pendingImport)
  return <div className="settings-section">
    <div className="settings-section__actions">
      <button type="button" disabled={disabled} onClick={onNew}><FilePlus size={14} aria-hidden="true" />{t('nav.new')}</button>
      <button type="button" disabled={disabled} onClick={onOpenSp3}><FolderOpen size={14} aria-hidden="true" />{t('nav.openSp3')}</button>
      <button type="button" disabled={disabled} onClick={onSave}><Save size={14} aria-hidden="true" />{t('nav.saveSp3')}</button>
      <button type="button" disabled={disabled} onClick={() => onSaveAs('sp3')}><SaveAll size={14} aria-hidden="true" />{t('nav.saveAsSp3')}</button>
      <button type="button" disabled={disabled} onClick={onImport}><FileInput size={14} aria-hidden="true" />{t('nav.import')}</button>
      <button type="button" disabled={disabled} onClick={() => onSaveAs('json')}><FileOutput size={14} aria-hidden="true" />{t('nav.exportJson')}</button>
      <button type="button" disabled={disabled} onClick={onExportSvg}><VectorSquare size={14} aria-hidden="true" />{t('nav.exportSvg')}</button>
    </div>
    <p className="settings-section__subtitle">{t('nav.recentFiles')}</p>
    {recentFiles.length === 0
      ? <p className="settings-section__empty">{t('nav.noRecentFiles')}</p>
      : <ul className="settings-section__recent">{recentFiles.map((path) => <li key={path}><button type="button" disabled={disabled} title={path} onClick={() => onOpenRecent(path)}>{path}</button></li>)}</ul>}
  </div>
}

// Informations du projet courant : volumes, point d'entrée et fichier associé.
export function ProjectInfoSection({ project, currentPath }) {
  const { t } = useTranslation()
  const roots = project.modules.flatMap((module) => module.rootNodeIds)
  const entry = roots.map((id) => project.nodes.find((node) => node.id === id)).find((node) => node?.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  return <dl className="settings-info">
    <div><dt>{t('settings.info.modules')}</dt><dd>{project.modules.length}</dd></div>
    <div><dt>{t('settings.info.nodes')}</dt><dd>{project.nodes.length}</dd></div>
    <div><dt>{t('settings.info.entryPoint')}</dt><dd>{entry?.properties?.name ?? t('settings.info.none')}</dd></div>
    <div><dt>{t('settings.info.file')}</dt><dd className="settings-info__path">{currentPath ?? t('settings.info.notSaved')}</dd></div>
  </dl>
}

// Thème : le sélecteur de thèmes existant, sans duplication.
export function ThemeSection() {
  return <div className="settings-section"><ThemeMenu /></div>
}

// Langue : le catalogue reste la seule source des langues proposées.
export function LanguageSection() {
  const { t, language, setLanguage } = useTranslation()
  return <div className="settings-section">
    <label className="settings-field">{t('nav.language')}
      <select aria-label={t('nav.language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
        {supportedLanguages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
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
export function ApplicationSection({ onOpenRepository, update, onCheckUpdate, onInstallUpdate }) {
  const { t } = useTranslation()
  const status = update?.status ?? 'idle'
  const release = update?.release ?? null
  const statusText = status === 'available' ? t('update.available', { version: release.version })
    : status === 'checking' ? t('update.checking')
      : status === 'none' ? t('update.upToDate')
        : status === 'unavailable' ? t('update.desktop')
          : status === 'error' ? t('update.error')
            : t('update.idle')
  return <div className="settings-section">
    <p className="settings-section__row"><span>{t('nav.version')}</span><strong>{appVersion}</strong></p>
    <p className="settings-section__row"><span>{t('update.status')}</span><strong>{statusText}</strong></p>
    <div className="settings-section__actions">
      <button type="button" disabled={status === 'checking' || status === 'unavailable'} onClick={onCheckUpdate}><RefreshCw size={14} aria-hidden="true" />{status === 'checking' ? t('update.checking') : t('update.check')}</button>
      {release && <button type="button" className="settings-section__primary" onClick={onInstallUpdate}><Download size={14} aria-hidden="true" />{t('update.now')}</button>}
    </div>
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
  { id: 'bookmarks', labelKey: 'nav.bookmarks', sections: [
    { id: 'library', labelKey: 'settings.section.library', Component: BookmarksSection },
  ] },
  { id: 'about', labelKey: 'settings.category.about', sections: [
    { id: 'application', labelKey: 'settings.section.application', Component: ApplicationSection },
  ] },
]

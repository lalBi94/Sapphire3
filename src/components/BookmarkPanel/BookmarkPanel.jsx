import { useState } from 'react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { describeBookmark } from '../../utils/logic/index.js'
import { typeLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './BookmarkPanel.css'

// Fenêtre détaillée des favoris personnels : contenu, signature, volumes et insertion.
export default function BookmarkPanel({ bookmarks = [], modules = [], onInsertBookmark, onDeleteBookmark, onClose }) {
  const { language, t } = useTranslation()
  const [destinations, setDestinations] = useState({})

  // Affiche la date d'enregistrement dans la langue active, sans format figé.
  function savedLabel(entry) {
    if (!entry.savedAt) return ''
    try {
      return t('bookmark.savedOn', { date: new Date(entry.savedAt).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' }) })
    } catch {
      return ''
    }
  }

  return <FloatingPanel title={t('nav.bookmarks')} label={t('nav.bookmarks')} onClose={onClose} className="bookmark-panel">
    {bookmarks.length === 0
      ? <p className="bookmark-panel__empty">{t('bookmark.empty')}</p>
      : <ul className="bookmark-panel__list">{bookmarks.map((entry) => {
        const describe = describeBookmark(entry)
        const blocks = describe.nodeCount === 1 ? t('bookmark.blocksOne') : t('bookmark.blocks', { count: describe.nodeCount })
        const functions = describe.functionCount === 1 ? t('bookmark.functionsOne') : t('bookmark.functions', { count: describe.functionCount })
        const signature = describe.kind === 'function'
          ? `(${describe.parameters.map((type) => typeLabel(type, t)).join(', ')}) → ${typeLabel(describe.returnType, t)}`
          : functions
        const destination = destinations[entry.id] ?? ''
        return <li className="bookmark-panel__item" key={entry.id}>
          <div className="bookmark-panel__heading">
            <span className="bookmark-panel__kind">{t(describe.kind === 'function' ? 'bookmark.function' : 'bookmark.module')}</span>
            <strong>{describe.name || entry.name}</strong>
          </div>
          <p className="bookmark-panel__signature">{signature}</p>
          <p className="bookmark-panel__facts">{blocks} · {functions}{entry.savedAt ? ` · ${savedLabel(entry)}` : ''}</p>
          {describe.kind === 'module' && describe.functionNames.length > 0 && <p className="bookmark-panel__contents"><span>{t('bookmark.contents')}</span> {describe.functionNames.join(' · ')}</p>}
          <div className="bookmark-panel__actions">
            <select aria-label={t('bookmark.destination')} value={destination} onChange={(event) => setDestinations((current) => ({ ...current, [entry.id]: event.target.value }))}>
              <option value="">{t('bookmark.newModule')}</option>
              {describe.kind === 'function' && modules.map((module) => <option key={module.id} value={module.id}>{t('bookmark.intoModule', { name: module.name })}</option>)}
            </select>
            <button type="button" onClick={() => onInsertBookmark(entry.id, destination || null)}>{t('bookmark.insertAction')}</button>
            <button type="button" className="bookmark-panel__delete" aria-label={t('bookmark.delete', { name: entry.name })} onClick={() => onDeleteBookmark(entry.id)}>{t('bookmark.deleteAction')}</button>
          </div>
        </li>
      })}</ul>}
  </FloatingPanel>
}

import { ChevronDown, ChevronUp, ChevronsDownUp, Layers, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import useWindowManager from '../../hooks/useWindowManager.jsx'
import './WindowMenu.css'

// Liste les fenêtres flottantes ouvertes et permet de les retrouver, plier, fermer ou ranger.
export default function WindowMenu({ onFocus }) {
  const { t } = useTranslation()
  const { windows, focus, setCollapsed, close, closeAll, collapseAll, cascade } = useWindowManager()
  const canCollapse = windows.some((entry) => entry.setCollapsed)
  const canArrange = windows.some((entry) => entry.arrange)

  return <div className="window-menu">
    <p className="project-navigation__section">{t('windows.open')}</p>
    {windows.length === 0
      ? <p className="project-navigation__hint">{t('windows.empty')}</p>
      : <ul className="window-menu__list">
        {windows.map((entry) => <li className="window-menu__row" key={entry.id}>
          <button type="button" className="window-menu__focus" aria-label={t('windows.focus', { name: entry.title })} title={entry.title} onClick={() => { focus(entry.id); onFocus?.() }}>
            <span>{entry.title}</span>
          </button>
          {entry.setCollapsed && <button type="button" className="window-menu__action" aria-label={t(entry.collapsed ? 'panel.expand' : 'panel.collapse')} title={t(entry.collapsed ? 'panel.expand' : 'panel.collapse')} onClick={() => setCollapsed(entry.id, !entry.collapsed)}>
            {entry.collapsed ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronUp size={13} aria-hidden="true" />}
          </button>}
          <button type="button" className="window-menu__action" aria-label={t('panel.close')} title={t('panel.close')} onClick={() => close(entry.id)}>
            <X size={13} aria-hidden="true" />
          </button>
        </li>)}
      </ul>}
    <p className="project-navigation__section">{t('windows.arrange')}</p>
    <button type="button" disabled={!canArrange} onClick={cascade}><Layers size={14} aria-hidden="true" />{t('windows.cascade')}</button>
    <button type="button" disabled={!canCollapse} onClick={collapseAll}><ChevronsDownUp size={14} aria-hidden="true" />{t('windows.collapseAll')}</button>
    <button type="button" disabled={windows.length === 0} onClick={closeAll}><X size={14} aria-hidden="true" />{t('windows.closeAll')}</button>
  </div>
}
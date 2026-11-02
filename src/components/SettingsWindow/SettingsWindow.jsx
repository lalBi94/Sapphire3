import { useState } from 'react'
import { Power } from 'lucide-react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { settingsCategories } from './settingsSections.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './SettingsWindow.css'

// Fenêtre de paramètres de l'application : catégories et sous-catégories à gauche, contenu à droite.
// Les pages proviennent du registre `settingsCategories` ; en ajouter une n'exige que d'étendre ce registre.
export default function SettingsWindow(props) {
  const { onClose, onQuit } = props
  const { t } = useTranslation()
  const first = settingsCategories[0]
  const [selection, setSelection] = useState(`${first.id}:${first.sections[0].id}`)
  const [categoryId, sectionId] = selection.split(':')
  const category = settingsCategories.find((entry) => entry.id === categoryId) ?? first
  const section = category.sections.find((entry) => entry.id === sectionId) ?? category.sections[0]
  const Content = section.Component

  return <FloatingPanel title={t('settings.title')} label={t('settings.title')} onClose={onClose} className="settings-window">
    <div className="settings-window__body">
      <nav className="settings-window__nav" aria-label={t('settings.title')}>
        {settingsCategories.map((entry) => <section className="settings-window__group" key={entry.id}>
          <p className="settings-window__group-title">{t(entry.labelKey)}</p>
          <ul>
            {entry.sections.map((item) => {
              const id = `${entry.id}:${item.id}`
              const active = id === selection
              return <li key={item.id}><button type="button" className={`settings-window__tab${active ? ' settings-window__tab--active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setSelection(id)}>{t(item.labelKey)}</button></li>
            })}
          </ul>
        </section>)}
        {onQuit && <button type="button" className="settings-window__quit" onClick={onQuit}><Power size={14} aria-hidden="true" />{t('settings.quit')}</button>}
      </nav>
      <section className="settings-window__content" aria-label={t(section.labelKey)}>
        <h3 className="settings-window__content-title">{t(section.labelKey)}</h3>
        <Content {...props} />
      </section>
    </div>
  </FloatingPanel>
}

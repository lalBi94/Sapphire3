import { useTranslation } from '../../contexts/LanguageContext.jsx'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import ModuleNameForm from '../NodeProperties/ModuleNameForm.jsx'
import '../NodeForm/NodeForm.css'
import './ScreenProperties.css'

// Affiche les propriétés d'une carte écran et l'API de son module caché.
export default function ScreenProperties({ card, module, state = null, links = [], onRename, onSelect, onClose }) {
  const { t } = useTranslation()
  const width = card.screenWidth ?? module?.screen?.width ?? 0
  const height = card.screenHeight ?? module?.screen?.height ?? 0
  const callers = links.filter((link) => link.fromId === card.id)
  const exports = Array.isArray(module?.exports) ? module.exports : []
  const pixelCount = state ? Math.round(state.pixels.length / 4) : 0

  return <FloatingPanel className="screen-properties" title={`${t('card.screen')} · ${card.name}`} label={t('screen.properties')} onClose={onClose}>
    <ModuleNameForm key={`${module?.id ?? card.id}:${module?.name ?? card.name}`} module={module} onRename={onRename} />
    <section className="screen-properties__section" aria-label={t('screen.display')}>
      <h3>{t('screen.display')}</h3>
      <p className="screen-properties__dimensions">{t('screen.title', { width, height })}</p>
      <p className="screen-properties__state">{state ? t('screen.pixels', { count: pixelCount }) : t('screen.idle')}</p>
    </section>
    <section className="screen-properties__section" aria-label={t('screen.api')}>
      <h3>{t('screen.api')}</h3>
      {exports.length === 0 ? <p className="screen-properties__empty">—</p> : <ul className="screen-properties__api">
        {exports.map((entry) => <li key={entry.nodeId}><code>{entry.name}</code></li>)}
      </ul>}
    </section>
    <section className="screen-properties__section" aria-label={t('screen.callers')}>
      <h3>{t('screen.callers')}</h3>
      {callers.length === 0 ? <p className="screen-properties__empty">{t('screen.noCallers')}</p> : <ul className="screen-properties__callers">
        {callers.map((link) => <li key={link.id}>
          <button type="button" onClick={() => onSelect({ kind: 'module', id: link.toId })}>{link.toName}</button>
          <span>{link.exports.map((entry) => entry.name).join(', ')}</span>
        </li>)}
      </ul>}
    </section>
  </FloatingPanel>
}
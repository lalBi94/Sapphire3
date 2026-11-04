import { Minus, Plus } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import ModuleNameForm from '../NodeProperties/ModuleNameForm.jsx'
import '../NodeForm/NodeForm.css'
import './ScreenProperties.css'

// Affiche les propriétés d'une carte écran et l'API de son module caché.
export default function ScreenProperties({ card, module, state = null, links = [], onRename, onScale, onSelect, onClose }) {
  const { t } = useTranslation()
  const scale = Math.min(4, Math.max(0.25, Number(card.screenScale) || 1))
  const width = card.screenWidth ?? module?.screen?.width ?? 0
  const height = card.screenHeight ?? module?.screen?.height ?? 0
  const callers = links.filter((link) => link.fromId === card.id)
  const exports = Array.isArray(module?.exports) ? module.exports : []
  const pixelCount = state ? Math.round(state.pixels.length / 4) : 0

  // Modifie l'échelle d'affichage dans les mêmes bornes que la carte.
  function changeScale(delta) {
    const next = Math.min(4, Math.max(0.25, Math.round((scale + delta) * 100) / 100))
    if (next !== scale) onScale?.(next)
  }

  return <FloatingPanel className="screen-properties" title={`${t('card.screen')} · ${card.name}`} label={t('screen.properties')} onClose={onClose}>
    <ModuleNameForm key={`${module?.id ?? card.id}:${module?.name ?? card.name}`} module={module} onRename={onRename} />
    <section className="screen-properties__section" aria-label={t('screen.display')}>
      <h3>{t('screen.display')}</h3>
      <p className="screen-properties__dimensions">{t('screen.title', { width, height })}</p>
      <div className="screen-properties__scale">
        <span>{t('screen.scale')}</span>
        <button type="button" aria-label={t('screen.scaleDown')} title={t('screen.scaleDown')} onClick={() => changeScale(-0.25)}><Minus size={12} aria-hidden="true" /></button>
        <output>{Math.round(scale * 100)}%</output>
        <button type="button" aria-label={t('screen.scaleUp')} title={t('screen.scaleUp')} onClick={() => changeScale(0.25)}><Plus size={12} aria-hidden="true" /></button>
      </div>
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

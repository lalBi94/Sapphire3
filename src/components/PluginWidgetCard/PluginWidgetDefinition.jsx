import { Puzzle } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './PluginWidgetCard.css'

// Affiche la définition déclarative du widget, en lecture seule.
export default function PluginWidgetDefinition({ card, entry }) {
  const { t } = useTranslation()
  if (!entry) {
    return <div className="plugin-widget-definition plugin-widget-definition--missing" role="status">
      <strong>{t('plugins.widgetMissing')}</strong>
      <p>{t('plugins.widgetMissingHint')}</p>
      <code>{card.pluginId}/{card.widgetId}</code>
    </div>
  }
  return <div className="plugin-widget-definition">
    <div className="plugin-widget-definition__meta">
      <Puzzle size={16} aria-hidden="true" />
      <strong>{entry.widget.name}</strong>
      <code>{entry.pluginId}/{entry.widget.id} · v{entry.pluginVersion}</code>
    </div>
    <pre className="plugin-widget-definition__code" tabIndex={0} aria-label={t('plugins.definition')}>{JSON.stringify(entry.widget, null, 2)}</pre>
  </div>
}

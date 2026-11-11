import { useState } from 'react'
import { FileInput, Power, Trash2, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { usePlugins } from '../../contexts/PluginContext.jsx'

// Traduit un identifiant de capacité stable sans traduire les noms saisis.
function capabilityLabel(capability, t) {
  return t(`plugins.capability.${capability}`)
}

// Affiche les plugins installés, leurs erreurs, leur activation et leur désinstallation.
export default function PluginsSection({ workspacePlugins = [] }) {
  const { language, t } = useTranslation()
  const { installedPlugins, busy, lastError, importFromFile, setEnabled, uninstall } = usePlugins()
  const [message, setMessage] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  // Importe un fichier local et publie un retour court sans masquer une erreur.
  async function handleImport() {
    setMessage(null)
    const result = await importFromFile(language)
    if (result.ok) setMessage({ type: 'success', text: t('plugins.imported', { name: result.name ?? result.record?.id ?? '' }) })
    else if (result.code !== 'PLUGIN_IMPORT_CANCELLED') setMessage({ type: 'error', text: `${result.code ?? 'PLUGIN_IMPORT_FAILED'} — ${result.message ?? ''}` })
  }

  // Confirme puis retire un plugin ; les cartes du workspace restent intactes.
  function handleUninstall(pluginId) {
    if (confirmId !== pluginId) {
      setConfirmId(pluginId)
      return
    }
    const result = uninstall(pluginId)
    setConfirmId(null)
    if (result.ok) setMessage({ type: 'success', text: t('plugins.uninstalled') })
  }

  // Bascule l'activation et signale une éventuelle dépendance manquante.
  function handleToggle(pluginId, enabled) {
    const result = setEnabled(pluginId, !enabled)
    if (result.ok) setMessage({ type: 'success', text: t(enabled ? 'plugins.disabledNotice' : 'plugins.enabledNotice') })
  }

  const missing = workspacePlugins.filter((dependency) => dependency.missing)

  return <div className="settings-section plugins-section">
    <div className="settings-section__actions">
      <button type="button" disabled={busy} onClick={handleImport}><FileInput size={14} aria-hidden="true" />{busy ? t('plugins.importing') : t('plugins.import')}</button>
    </div>
    <p className="settings-section__hint">{t('plugins.localOnly')}</p>
    <p className="settings-section__hint">{t('plugins.securityHint')}</p>
    {message && <p className={message.type === 'error' ? 'plugins-message plugins-message--error' : 'plugins-message'} role="status">{message.text}</p>}
    {lastError && !message && <p className="plugins-message plugins-message--error" role="status">{lastError.code ?? 'PLUGIN_ERROR'} — {lastError.message ?? ''}</p>}

    <p className="settings-section__subtitle">{t('plugins.installed')}</p>
    {installedPlugins.length === 0
      ? <p className="settings-section__empty">{t('plugins.empty')}</p>
      : <ul className="plugins-list">
        {installedPlugins.map((entry) => {
          const plugin = entry.validation?.ok ? entry.validation.plugin : null
          const name = plugin?.name ?? entry.id
          return <li key={entry.id} className={`plugins-list__item${entry.active ? ' plugins-list__item--active' : ''}`}>
            <div className="plugins-list__head">
              <strong>{name}</strong>
              <span className={`plugins-badge${entry.active ? ' plugins-badge--active' : ''}`}>{t(entry.active ? 'plugins.active' : 'plugins.inactive')}</span>
            </div>
            {plugin ? <>
              <p className="plugins-list__meta">{plugin.author} · v{plugin.version} · {plugin.id}</p>
              <p className="plugins-list__description">{plugin.description}</p>
              <p className="plugins-list__capabilities">{t('plugins.capabilities')} : {entry.capabilities.map((capability) => capabilityLabel(capability, t)).join(', ')}</p>
              <p className="plugins-list__permissions">{t('plugins.permissions')} : {plugin.permissions.join(', ')}</p>
              {entry.missingDependencies.length > 0 && <p className="plugins-list__error">{t('plugins.missingDependencies')} : {entry.missingDependencies.join(', ')}</p>}
            </> : <p className="plugins-list__error">{entry.validation?.code ?? 'PLUGIN_INVALID'} — {entry.validation?.message ?? ''}</p>}
            {entry.errors?.filter((error) => error.code !== 'PLUGIN_DEPENDENCY_OPTIONAL_MISSING').map((error, index) => <p className="plugins-list__error" key={`${error.code}:${index}`}>{error.code} — {error.message}</p>)}
            <div className="plugins-list__actions">
              <button type="button" onClick={() => handleToggle(entry.id, entry.enabled)}><Power size={13} aria-hidden="true" />{t(entry.enabled ? 'plugins.disable' : 'plugins.enable')}</button>
              {confirmId === entry.id ? <>
                <button type="button" className="plugins-list__danger" onClick={() => handleUninstall(entry.id)}><Trash2 size={13} aria-hidden="true" />{t('plugins.uninstallConfirm')}</button>
                <button type="button" onClick={() => setConfirmId(null)}><X size={13} aria-hidden="true" />{t('plugins.uninstallCancel')}</button>
              </> : <button type="button" className="plugins-list__danger" onClick={() => handleUninstall(entry.id)}><Trash2 size={13} aria-hidden="true" />{t('plugins.uninstall')}</button>}
            </div>
          </li>
        })}
      </ul>}

    <p className="settings-section__subtitle">{t('plugins.workspaceDependencies')}</p>
    {workspacePlugins.length === 0
      ? <p className="settings-section__empty">{t('plugins.noWorkspaceDependencies')}</p>
      : <ul className="plugins-workspace">
        {workspacePlugins.map((dependency) => <li key={`${dependency.pluginId}/${dependency.widgetId}`} className={dependency.missing ? 'plugins-workspace__missing' : ''}>
          <span>{dependency.pluginId}/{dependency.widgetId}</span>
          <span>{dependency.count} · {t(dependency.missing ? 'plugins.missing' : 'plugins.available')}</span>
        </li>)}
      </ul>}
    {missing.length > 0 && <p className="settings-section__hint">{t('plugins.missingWorkspaceHint')}</p>}
  </div>
}

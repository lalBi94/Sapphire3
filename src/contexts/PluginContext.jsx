import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyPluginRecords,
  choosePluginFile,
  installPluginText,
  loadInstalledPluginRecords,
  saveInstalledPluginRecords,
} from '../services/plugins.js'
import { hydratePreferences } from '../services/preferences.js'
import { appVersion } from '../utils/appInfo.js'
import { removePluginRecord, resolvePluginRecords, setPluginRecordEnabled } from '../utils/plugins/pluginLifecycle.js'

const PluginContext = createContext(null)

// Fournit les plugins installés, leur résolution et les actions de gestion locale.
export default function PluginProvider({ children }) {
  const [records, setRecords] = useState(loadInstalledPluginRecords)
  const [runtimeVersion, setRuntimeVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState(null)
  const userChangedRef = useRef(false)
  const resolution = useMemo(() => resolvePluginRecords(records, { hostVersion: appVersion }), [records])
  const activePlugins = useMemo(() => resolution.activeRecords.map((entry) => entry.validation.plugin), [resolution])
  const activeWidgets = useMemo(() => activePlugins.flatMap((plugin) => plugin.widgets.map((widget) => ({
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    author: widget.author ?? plugin.author,
    widget,
  }))), [activePlugins])

  // Recharge la copie durable après l'ouverture du stockage natif, sans écraser une installation récente.
  useEffect(() => {
    let cancelled = false
    hydratePreferences().then(() => {
      if (cancelled || userChangedRef.current) return
      const loaded = loadInstalledPluginRecords()
      applyPluginRecords(loaded, appVersion)
      setRecords(loaded)
      setRuntimeVersion((version) => version + 1)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Applique une nouvelle liste, configure immédiatement le registre puis persiste.
  function commit(nextRecords) {
    userChangedRef.current = true
    const applied = applyPluginRecords(nextRecords, appVersion)
    setRecords(nextRecords)
    setRuntimeVersion((current) => current + 1)
    saveInstalledPluginRecords(nextRecords)
    return applied
  }

  // Installe un manifeste déjà lu, sans toucher au workspace courant.
  function installDocument(document, options = {}) {
    const result = installPluginText(records, JSON.stringify(document), options)
    if (!result.ok) {
      setLastError(result)
      return result
    }
    commit(result.records)
    setLastError(null)
    return result
  }

  // Ouvre un fichier local et l'installe après validation et contrôle des conflits.
  async function importFromFile(language = 'en') {
    setBusy(true)
    setLastError(null)
    try {
      const file = await choosePluginFile(language)
      if (!file) return { ok: false, code: 'PLUGIN_IMPORT_CANCELLED' }
      const result = installPluginText(records, file.text, { sourceName: file.name })
      if (!result.ok) {
        setLastError(result)
        return result
      }
      commit(result.records)
      return { ...result, name: file.name }
    } catch (error) {
      const failure = { ok: false, code: error?.code ?? 'PLUGIN_IMPORT_FAILED', message: error?.message ?? 'Plugin import failed.' }
      setLastError(failure)
      return failure
    } finally {
      setBusy(false)
    }
  }

  // Active ou désactive un plugin sans désinstaller ses données.
  function setEnabled(pluginId, enabled) {
    const result = setPluginRecordEnabled(records, pluginId, enabled)
    if (!result.ok) {
      setLastError(result)
      return result
    }
    commit(result.records)
    setLastError(null)
    return result
  }

  // Retire un plugin installé ; les cartes du workspace restent intactes.
  function uninstall(pluginId) {
    const result = removePluginRecord(records, pluginId)
    if (!result.ok) {
      setLastError(result)
      return result
    }
    commit(result.records)
    setLastError(null)
    return result
  }

  // Reconfigure le registre sans changer la liste installée, après une évolution externe.
  function refreshRuntime() {
    applyPluginRecords(records, appVersion)
    setRuntimeVersion((current) => current + 1)
  }

  return <PluginContext.Provider value={{
    records,
    resolution,
    installedPlugins: resolution.records,
    activePlugins,
    activeWidgets,
    errors: resolution.errors,
    runtimeVersion,
    busy,
    lastError,
    installDocument,
    importFromFile,
    setEnabled,
    uninstall,
    refreshRuntime,
  }}>{children}</PluginContext.Provider>
}

// Accède au gestionnaire local de plugins depuis les composants React.
export function usePlugins() {
  return useContext(PluginContext)
}

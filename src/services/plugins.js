import { readPreference, writePreference } from './preferences.js'
import { appVersion } from '../utils/appInfo.js'
import { translate } from '../utils/translations.js'
import { installPluginRecord, normalizePluginRecords, resolvePluginRecords } from '../utils/plugins/pluginLifecycle.js'
import { configurePluginRuntime } from '../utils/plugins/pluginRuntime.js'

const storageKey = 'sapphire-plugins'
const maximumPluginFileSize = 2 * 1024 * 1024
let clientPromise

// Initialise uniquement le client natif local, au premier accès depuis la fenêtre desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) {
    throw Object.assign(new Error('DESKTOP_REQUIRED'), { code: 'DESKTOP_REQUIRED' })
  }
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => {
      client.init()
      return client
    })
  }
  return clientPromise
}

// Relit les plugins installés depuis le cache local, sans exécuter leur contenu.
export function loadInstalledPluginRecords() {
  try {
    return normalizePluginRecords(JSON.parse(readPreference(storageKey) ?? '[]'))
  } catch {
    return []
  }
}

// Écrit les plugins installés dans le cache local et la copie durable native.
export function saveInstalledPluginRecords(records) {
  writePreference(storageKey, JSON.stringify(normalizePluginRecords(records)))
}

// Résout les dépendances et configure le registre pur utilisé par le moteur.
export function applyPluginRecords(records, hostVersion = appVersion) {
  const resolution = resolvePluginRecords(records, { hostVersion })
  configurePluginRuntime(resolution.activeDocuments)
  return resolution
}

// Configure le registre au démarrage avant la première analyse du document.
export function initializePluginRuntime() {
  return applyPluginRecords(loadInstalledPluginRecords(), appVersion)
}

// Installe un texte de manifeste JSON déjà choisi par l'utilisateur.
export function installPluginText(records, text, options = {}) {
  let document
  try {
    document = JSON.parse(String(text).replace(/^\uFEFF/, ''))
  } catch {
    return { ok: false, code: 'PLUGIN_JSON_INVALID', message: 'The selected plugin file is not valid JSON.', records }
  }
  return installPluginRecord(records, document, options)
}

// Ouvre un fichier `.sp3plugin` local et retourne son texte, sans import dynamique de code.
export async function choosePluginFile(language = 'en') {
  const { os, filesystem } = await getClient()
  const path = await os.showOpenDialog(translate(language, 'plugins.importTitle'), {
    multiSelections: false,
    filters: [{ name: translate(language, 'plugins.filter'), extensions: ['sp3plugin', 'json'] }],
  })
  const selected = Array.isArray(path) ? path[0] : path
  if (!selected) return null
  const info = await filesystem.getStats(selected)
  if (!info?.isFile || info.size > maximumPluginFileSize) throw Object.assign(new Error('PLUGIN_FILE_INVALID'), { code: 'PLUGIN_FILE_INVALID' })
  return {
    path: selected,
    name: String(selected).split(/[\\/]/).pop(),
    text: await filesystem.readFile(selected),
  }
}

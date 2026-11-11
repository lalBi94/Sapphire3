import {
  createNativeOperationDefinition,
  expandCompositeDraft,
  validatePluginDocument,
} from '../../../packages/plugin-sdk/src/index.js'
import { setPluginExtensions } from '../logic/pluginExtensions.js'

let activeDocuments = []
let activePlugins = []
let widgetEntries = new Map()
let nativeOperations = new Map()
let compositeEntries = new Map()
let runtimeDiagnostics = []

// Vide les cartes du registre sans toucher aux documents persistés.
function reset() {
  activeDocuments = []
  activePlugins = []
  widgetEntries = new Map()
  nativeOperations = new Map()
  compositeEntries = new Map()
  runtimeDiagnostics = []
  setPluginExtensions({ natives: [], composites: [] })
}

// Active un ensemble de manifestes déjà autorisés par le gestionnaire de plugins.
// La fonction revalide chaque document : un worker ne fait jamais confiance au payload reçu.
export function configurePluginRuntime(documents) {
  reset()
  if (!Array.isArray(documents)) return { ok: true, plugins: [] }
  const seenPluginIds = new Set()
  const seenOperationIds = new Set()
  const seenCompositeIds = new Set()
  for (const candidate of documents) {
    const result = validatePluginDocument(candidate)
    if (!result.ok) {
      runtimeDiagnostics.push({
        pluginId: candidate?.id ?? null,
        code: result.code,
        message: result.message,
        diagnostics: result.diagnostics,
      })
      continue
    }
    const plugin = result.plugin
    if (seenPluginIds.has(plugin.id)) {
      runtimeDiagnostics.push({ pluginId: plugin.id, code: 'PLUGIN_DUPLICATE_ID', message: 'Duplicate active plugin id.' })
      continue
    }
    seenPluginIds.add(plugin.id)
    activeDocuments.push(plugin)
    activePlugins.push(plugin)
    for (const widget of plugin.widgets) {
      const key = `${plugin.id}/${widget.id}`
      if (widgetEntries.has(key)) {
        runtimeDiagnostics.push({ pluginId: plugin.id, code: 'PLUGIN_DUPLICATE_ID', message: `Duplicate widget id: ${widget.id}.` })
        continue
      }
      widgetEntries.set(key, {
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        author: widget.author ?? plugin.author,
        description: widget.description,
        widget,
      })
    }
    for (const operation of plugin.nativeOperations) {
      if (seenOperationIds.has(operation.id)) {
        runtimeDiagnostics.push({ pluginId: plugin.id, code: 'PLUGIN_DUPLICATE_OPERATION', message: `Duplicate native operation id: ${operation.id}.` })
        continue
      }
      seenOperationIds.add(operation.id)
      nativeOperations.set(operation.id, createNativeOperationDefinition(plugin, operation))
    }
    for (const composite of plugin.composites) {
      const key = `${plugin.id}/${composite.id}`
      if (seenCompositeIds.has(key)) {
        runtimeDiagnostics.push({ pluginId: plugin.id, code: 'PLUGIN_DUPLICATE_COMPOSITE', message: `Duplicate composite id: ${composite.id}.` })
        continue
      }
      seenCompositeIds.add(key)
      compositeEntries.set(key, {
        pluginId: plugin.id,
        pluginName: plugin.name,
        compositeId: composite.id,
        name: composite.name,
        description: composite.description,
        rootKind: composite.expansion.kind,
        draft: expandCompositeDraft(composite),
      })
    }
  }
  setPluginExtensions({
    natives: [...nativeOperations.values()],
    composites: [...compositeEntries.values()],
  })
  return { ok: true, plugins: activePlugins, diagnostics: runtimeDiagnostics }
}

// Remplace le registre depuis un payload sérialisable reçu par un worker.
export function applyPluginRuntimePayload(payload) {
  const documents = Array.isArray(payload) ? payload : Array.isArray(payload?.plugins) ? payload.plugins : []
  return configurePluginRuntime(documents)
}

// Retourne les manifestes actifs pour les transmettre au worker du moteur.
export function getPluginRuntimePayload() {
  return activeDocuments
}

// Retourne les plugins actifs, dans l'ordre d'activation.
export function getActivePlugins() {
  return activePlugins
}

// Retrouve un widget actif par identifiants stables.
export function getActiveWidget(pluginId, widgetId) {
  return widgetEntries.get(`${pluginId}/${widgetId}`) ?? null
}

// Liste les widgets actifs proposés dans le menu de création.
export function getActiveWidgets() {
  return [...widgetEntries.values()]
}

// Retrouve une opération native active par identifiant source.
export function getPluginNativeOperation(id) {
  return typeof id === 'string' ? nativeOperations.get(id) ?? null : null
}

// Liste les opérations natives actives, dans l'ordre des plugins.
export function getPluginNativeOperations() {
  return [...nativeOperations.values()]
}

// Liste les identifiants d'opérations natives actives.
export function getPluginNativeOperationIds() {
  return [...nativeOperations.keys()]
}

// Liste les composites actifs, prêts à devenir des actions du menu de nœuds.
export function getActiveCompositeActions() {
  return [...compositeEntries.values()]
}

// Retrouve un composite actif par identifiants stables.
export function getActiveComposite(pluginId, compositeId) {
  return compositeEntries.get(`${pluginId}/${compositeId}`) ?? null
}

// Expose les diagnostics de validation rencontrés lors de la configuration.
export function getPluginRuntimeDiagnostics() {
  return runtimeDiagnostics
}

// Indique si un identifiant d'opération est déjà utilisé par un plugin actif.
export function hasPluginNativeOperation(id) {
  return nativeOperations.has(id)
}

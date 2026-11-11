import { createWidgetInstance, sanitizeWidgetProperties, sanitizeWidgetState } from '../../../packages/plugin-sdk/src/index.js'
import { formatPluginText, resolvePluginSource } from '../pluginWidgetView.js'

export { formatPluginText, resolvePluginSource } from '../pluginWidgetView.js'

// Construit une carte persistable pour un widget de plugin actif.
export function createPluginWidgetCard(entry, position, name = null) {
  const widget = entry.widget
  const instance = createWidgetInstance(widget)
  return {
    id: crypto.randomUUID(),
    type: 'pluginWidget',
    name: name ?? widget.name,
    pluginId: entry.pluginId,
    widgetId: widget.id,
    pluginVersion: entry.pluginVersion,
    x: position.x,
    y: position.y,
    width: widget.defaultSize.width,
    height: widget.defaultSize.height,
    minWidth: widget.minSize.width,
    minHeight: widget.minSize.height,
    properties: instance.properties,
    state: instance.state,
    bindings: instance.bindings,
    expandedNodeIds: [],
  }
}

// Reconstruit les propriétés, l'état et les liaisons d'un widget restauré.
export function resolvePluginWidgetInstance(card, widget) {
  return {
    properties: sanitizeWidgetProperties(widget, card?.properties),
    state: sanitizeWidgetState(widget, card?.state),
    bindings: {
      inputs: card?.bindings?.inputs && typeof card.bindings.inputs === 'object' ? { ...card.bindings.inputs } : {},
      outputs: card?.bindings?.outputs && typeof card.bindings.outputs === 'object' ? { ...card.bindings.outputs } : {},
    },
  }
}

// Liste les dépendances de widgets présentes dans un workspace, avec leur disponibilité.
export function collectPluginWorkspaceDependencies(cards, activeWidgets) {
  const active = new Set((activeWidgets ?? []).map((entry) => `${entry.pluginId}/${entry.widget.id}`))
  const dependencies = new Map()
  for (const card of cards ?? []) {
    if (card?.type !== 'pluginWidget' || typeof card.pluginId !== 'string' || typeof card.widgetId !== 'string') continue
    const key = `${card.pluginId}/${card.widgetId}`
    const current = dependencies.get(key) ?? {
      pluginId: card.pluginId,
      widgetId: card.widgetId,
      pluginVersion: card.pluginVersion ?? null,
      count: 0,
      missing: !active.has(key),
    }
    current.count += 1
    dependencies.set(key, current)
  }
  return [...dependencies.values()].sort((left, right) => `${left.pluginId}/${left.widgetId}`.localeCompare(`${right.pluginId}/${right.widgetId}`))
}

// Aplatit les variables disponibles pour les liaisons d'entrée d'un widget.
export function collectPluginVariables({ liveVariables = [], debugFrame = null, simulationVariables = [] } = {}) {
  const variables = []
  const add = (entry) => {
    if (!entry || typeof entry.name !== 'string') return
    variables.push({
      id: entry.id ?? entry.nodeId ?? entry.name,
      name: entry.name,
      kind: entry.kind ?? 'global',
      type: entry.type ?? null,
      value: entry.value ?? null,
      raw: entry.raw ?? entry.value ?? null,
    })
  }
  for (const entry of liveVariables ?? []) add(entry)
  for (const entry of debugFrame?.globals ?? []) add({ ...entry, kind: 'global', raw: entry.value })
  for (const scope of debugFrame?.localScopes ?? []) for (const entry of scope.variables ?? []) add({ ...entry, kind: 'local', raw: entry.value })
  for (const entry of simulationVariables ?? []) add(entry)
  const seen = new Set()
  return variables.filter((entry) => {
    const key = `${entry.kind}:${entry.name}:${entry.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

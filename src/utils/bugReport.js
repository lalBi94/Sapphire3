import { ancestorNodeIds } from './nodeTree.js'
import { appVersion } from './appInfo.js'

// Convertit une référence de type résolue en texte court et stable.
function typeToString(type) {
  if (!type) return null
  if (type.kind === 'primitive') return type.name
  if (type.kind === 'array') return `${typeToString(type.elementType) ?? '?'}[]`
  if (type.kind === 'named') return type.target?.name ?? 'named'
  return type.kind
}

// Décrit un nœud par son genre et son nom saisis, sans texte traduit.
function nodeLabel(node) {
  if (!node) return '?'
  return node.properties?.name ? `${node.properties.name} (${node.kind})` : node.kind
}

// Met en forme une localisation de diagnostic à partir d'identifiants stables.
function locationText(location) {
  if (!location) return ''
  return ['moduleId', 'nodeId', 'field'].filter((key) => location[key]).map((key) => `${key}=${location[key]}`).join(' ')
}

// Regroupe version, cible sélectionnée et diagnostics dans un rapport texte copiable.
export function buildBugReport({ project, index, target, language = 'en', date = new Date().toISOString(), limit = 50 }) {
  const lines = []
  const push = (value = '') => lines.push(value)
  const diagnostics = index?.analysis?.diagnostics ?? []
  const node = target?.kind === 'node' ? index.nodes.get(target.id) : null
  const moduleId = target?.kind === 'module' ? target.id : node?.moduleId
  const module = moduleId ? index.modules.get(moduleId) : null

  push('Sapphire 3 — bug report')
  push(`Version: ${appVersion}`)
  push(`Language: ${language}`)
  push(`Date: ${date}`)
  push()
  push('Selected element')
  push(`Kind: ${target?.kind ?? 'none'}`)
  if (module) push(`Module: ${module.name} (${module.id})`)
  if (node) {
    const trail = [module?.name, ...ancestorNodeIds(index, node.id).map((id) => nodeLabel(index.nodes.get(id)))].filter(Boolean)
    push(`Path: ${trail.join(' > ')}`)
    push(`Node: ${node.kind}${node.properties?.name ? ` "${node.properties.name}"` : ''} (${node.id})`)
    const type = typeToString(index.nodeTypes.get(node.id))
    if (type) push(`Type: ${type}`)
    push(`Slots: ${Object.entries(node.children ?? {}).map(([slot, value]) => `${slot}=${Array.isArray(value) ? value.length : value ? 1 : 0}`).join(', ') || 'none'}`)
  }
  push()

  const own = diagnostics.filter((entry) => target?.kind === 'module' ? entry.location?.moduleId === target.id : entry.location?.nodeId === target?.id)
  push(`Diagnostics for the selection (${own.length})`)
  if (own.length === 0) push('- none')
  for (const entry of own) push(`- [${entry.severity}] ${entry.code}${locationText(entry.location) ? ` @ ${locationText(entry.location)}` : ''}${entry.message ? ` — ${entry.message}` : ''}`)
  push()

  const bySeverity = diagnostics.reduce((counts, entry) => ({ ...counts, [entry.severity]: (counts[entry.severity] ?? 0) + 1 }), {})
  push('Project summary')
  push(`Modules: ${project?.modules?.length ?? 0}`)
  push(`Nodes: ${project?.nodes?.length ?? 0}`)
  push(`Diagnostics: ${diagnostics.length}${diagnostics.length ? ` (${Object.entries(bySeverity).map(([severity, count]) => `${severity}: ${count}`).join(', ')})` : ''}`)

  const others = diagnostics.filter((entry) => !own.includes(entry))
  if (others.length) {
    push()
    push(`Other diagnostics (${others.length})`)
    for (const entry of others.slice(0, limit)) push(`- [${entry.severity}] ${entry.code}${locationText(entry.location) ? ` @ ${locationText(entry.location)}` : ''}`)
    if (others.length > limit) push(`… and ${others.length - limit} more`)
  }
  return lines.join('\n')
}

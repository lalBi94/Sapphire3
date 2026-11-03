import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
import { isId, isRecord } from './model.js'
import { getNodeSchema } from './nodeSchema.js'

// Compare les diagnostics par localisation stable, sans dépendre du texte affiché.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Identifie une référence résolue indépendamment de son ordre de parcours.
function referenceKey(reference) {
  return `${reference.nodeId}|${reference.field}`
}

// Reconstruit la cible d'une référence de nom sans toucher aux autres champs du nœud.
function renamedTarget(node, field, name) {
  if (field === 'references.target') {
    return { ...node, references: { ...node.references, target: { ...node.references?.target, name } } }
  }
  if (field === 'properties.type.target') {
    return { ...node, properties: { ...node.properties, type: { ...node.properties?.type, target: { ...node.properties?.type?.target, name } } } }
  }
  return null
}

// Renomme un symbole déclaré et tous ses liens sémantiques, sans remplacer de texte libre.
export function renameSourceSymbol(project, nodeId, newName, options = {}) {
  const failure = (code, diagnostics = [], details = {}) => ({ ok: false, code, project, diagnostics, changes: [], ...details })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!isId(nodeId)) return failure('TARGET_INVALID')
  const name = typeof newName === 'string' ? newName.trim() : ''
  if (!isId(name)) return failure('RENAME_INVALID')

  const matches = project.nodes.filter((node) => node?.id === nodeId)
  if (matches.length !== 1) return failure('TARGET_INVALID')
  const declaration = matches[0]
  if (!getNodeSchema(declaration.kind)?.named) return failure('TARGET_INVALID')

  const analysis = options.analysis?.source === project ? options.analysis : analyzeProgram(project)
  const index = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analysis)
  const oldName = typeof declaration.properties?.name === 'string' ? declaration.properties.name : ''
  if (name === oldName) return { ok: true, project, analysis, index, changes: [], diagnostics: [], oldName, newName: name, nodeId }

  const declarationSymbol = analysis.semantic.symbols.find((symbol) => symbol.nodeId === nodeId && !symbol.importedFrom) ?? null
  const renamedSymbolIds = new Set(declarationSymbol ? [declarationSymbol.id] : [])
  for (const symbol of analysis.semantic.symbols) {
    if (declarationSymbol && symbol.importedFrom === declaration.moduleId && symbol.nodeId === nodeId && symbol.importId && symbol.name === oldName) {
      renamedSymbolIds.add(symbol.id)
    }
  }

  const changes = [{ kind: 'declaration', moduleId: declaration.moduleId, nodeId, field: 'properties.name', from: oldName, to: name }]
  const modules = project.modules.map((module) => {
    let changed = false
    const imports = (Array.isArray(module.imports) ? module.imports : []).map((entry) => {
      if (!isRecord(entry) || entry.moduleId !== declaration.moduleId || entry.nodeId !== nodeId || !oldName || entry.localName !== oldName) return entry
      changed = true
      changes.push({ kind: 'import', moduleId: module.id, nodeId: null, importId: entry.id, field: 'localName', from: oldName, to: name })
      return { ...entry, localName: name }
    })
    const exports = (Array.isArray(module.exports) ? module.exports : []).map((entry) => {
      if (!isRecord(entry) || entry.nodeId !== nodeId || !oldName || entry.name !== oldName) return entry
      changed = true
      changes.push({ kind: 'export', moduleId: module.id, nodeId, field: 'name', from: oldName, to: name })
      return { ...entry, name }
    })
    return changed ? { ...module, imports, exports } : module
  })

  const changedNodes = new Map()
  if (declarationSymbol) {
    for (const reference of analysis.semantic.references) {
      if (!renamedSymbolIds.has(reference.symbolId) || reference.target?.kind !== 'name') continue
      const node = project.nodes.find((entry) => entry?.id === reference.nodeId)
      if (!node) continue
      const next = renamedTarget(changedNodes.get(node.id) ?? node, reference.field, name)
      if (!next) continue
      changedNodes.set(node.id, next)
      changes.push({
        kind: reference.field === 'properties.type.target' ? 'type' : 'reference',
        moduleId: reference.moduleId,
        nodeId: reference.nodeId,
        field: reference.field,
        from: oldName,
        to: name,
      })
    }
  }

  const declarationWithName = changedNodes.get(nodeId) ?? declaration
  changedNodes.set(nodeId, { ...declarationWithName, properties: { ...declarationWithName.properties, name } })
  const candidate = { ...project, modules, nodes: project.nodes.map((entry) => changedNodes.get(entry?.id) ?? entry) }
  const nextAnalysis = analyzeProgram(candidate)
  const nextIndex = createContextIndex(candidate, nextAnalysis)
  const previousKeys = new Set(analysis.diagnostics.map(diagnosticKey))
  const diagnostics = nextAnalysis.diagnostics.filter((diagnostic) => diagnostic.severity === 'error' && !previousKeys.has(diagnosticKey(diagnostic)))
  const previousReferences = new Map(analysis.semantic.references.map((reference) => [referenceKey(reference), reference.symbolId]))
  const reboundNodeIds = [...new Set(nextAnalysis.semantic.references.filter((reference) => {
    const previous = previousReferences.get(referenceKey(reference))
    return previousReferences.has(referenceKey(reference)) && !renamedSymbolIds.has(previous) && reference.symbolId !== previous
  }).map((reference) => reference.nodeId))]
  const code = diagnostics.length ? 'RENAME_INVALID' : reboundNodeIds.length ? 'RENAME_REBIND' : null
  return {
    ok: !code,
    ...(code ? { code } : {}),
    project: candidate,
    analysis: nextAnalysis,
    index: nextIndex,
    changes,
    diagnostics,
    ...(reboundNodeIds.length ? { reboundNodeIds } : {}),
    oldName,
    newName: name,
    nodeId,
  }
}

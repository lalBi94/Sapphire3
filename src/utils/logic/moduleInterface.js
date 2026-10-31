import { analyzeProgram } from './analysis.js'
import { createContextIndex, getVisibleSymbols } from './contextResolver.js'
import { diagnosticCodes as codes } from './diagnostics.js'
import { isId, isRecord } from './model.js'

const interfaceCodes = new Set([codes.invalidImport, codes.invalidExport, codes.conflict])

// Retrouve la portée racine du module, distincte des portées de fonction et de bloc.
function moduleScopeId(analysis, moduleId) {
  return analysis.semantic.scopes.find((scope) => scope.moduleId === moduleId && scope.parentId === null)?.id ?? null
}

// Reconnaît une déclaration nommée de premier niveau, sans prendre un import pour une déclaration locale.
function rootSymbol(project, analysis, moduleId, nodeId) {
  const scopeId = moduleScopeId(analysis, moduleId)
  if (!scopeId) return null
  return analysis.semantic.symbols.find((symbol) => !symbol.importedFrom && symbol.nodeId === nodeId && symbol.scopeId === scopeId) ?? null
}

// Liste les déclarations de premier niveau réellement visibles dans le module.
export function getModuleRootSymbols(project, moduleId, analysis = analyzeProgram(project)) {
  const scopeId = moduleScopeId(analysis, moduleId)
  if (!scopeId) return []
  return analysis.semantic.symbols.filter((symbol) => !symbol.importedFrom && symbol.scopeId === scopeId)
}

// Les appels ne visent pour l'instant que des fonctions exportables entre modules.
export function getModuleFunctions(project, moduleId, analysis = analyzeProgram(project)) {
  return getModuleRootSymbols(project, moduleId, analysis).filter((symbol) => symbol.kind === 'FunctionDeclaration')
}

// Propose les fonctions des autres modules qui ne sont pas déjà importées ici.
export function getImportCandidates(project, moduleId, analysis = analyzeProgram(project)) {
  const current = project.modules.find((module) => module?.id === moduleId)
  const imports = Array.isArray(current?.imports) ? current.imports : []
  const candidates = []
  for (const module of project.modules) {
    if (!isRecord(module) || module.id === moduleId) continue
    for (const symbol of getModuleFunctions(project, module.id, analysis)) {
      if (imports.some((entry) => entry?.moduleId === module.id && entry?.nodeId === symbol.nodeId)) continue
      candidates.push({ moduleId: module.id, moduleName: module.name, nodeId: symbol.nodeId, name: symbol.name })
    }
  }
  return candidates
}

// Compare les diagnostics par localisation stable, sans dépendre du texte affiché.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Refuse uniquement les nouvelles erreurs d'interface ; les erreurs existantes restent visibles.
function interfaceFailure(previous, next) {
  const known = new Set(previous.diagnostics.map(diagnosticKey))
  return next.diagnostics.some((diagnostic) => interfaceCodes.has(diagnostic.code) && !known.has(diagnosticKey(diagnostic)))
}

// Produit le résultat commun avec des dérivés recalculés, sans muter la source précédente.
function result(project, analysis = analyzeProgram(project)) {
  return { ok: true, project, analysis, index: createContextIndex(project, analysis) }
}

// Ajoute ou retire un export de fonction de premier niveau, sans laisser un import pendre.
export function setModuleExport(project, moduleId, nodeId, exported) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!isId(moduleId) || !isId(nodeId) || typeof exported !== 'boolean') return failure('TARGET_INVALID')
  const modules = project.modules.filter((module) => module?.id === moduleId)
  if (modules.length !== 1) return failure(modules.length ? 'TARGET_INVALID' : 'TARGET_MISSING')
  const module = modules[0]
  const analysis = analyzeProgram(project)
  const symbol = rootSymbol(project, analysis, moduleId, nodeId)
  if (!symbol) return failure(codes.invalidExport)
  const exports = Array.isArray(module.exports) ? module.exports : []
  const existing = exports.find((entry) => entry?.nodeId === nodeId)
  if (exported === Boolean(existing)) return result(project, analysis)
  if (!exported && project.modules.some((entry) => entry.id !== moduleId && (entry.imports ?? []).some((entryImport) => entryImport?.moduleId === moduleId && entryImport?.nodeId === nodeId))) {
    return failure('EXPORT_IN_USE')
  }
  const nextExports = exported ? [...exports, { nodeId, name: symbol.name }] : exports.filter((entry) => entry?.nodeId !== nodeId)
  const candidate = { ...project, modules: project.modules.map((entry) => entry.id === moduleId ? { ...entry, exports: nextExports } : entry) }
  const nextAnalysis = analyzeProgram(candidate)
  if (interfaceFailure(analysis, nextAnalysis)) return failure('MODULE_INTERFACE_INVALID')
  return result(candidate, nextAnalysis)
}

// Ajoute un import stable ; l'export manquant de la fonction visée est créé explicitement.
export function addModuleImport(project, moduleId, entry) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!isRecord(entry) || !isId(entry.id) || !isId(entry.targetModuleId) || !isId(entry.nodeId) || typeof entry.localName !== 'string') return failure('IMPORT_INVALID')
  const modules = project.modules.filter((module) => module?.id === moduleId)
  const targets = project.modules.filter((module) => module?.id === entry.targetModuleId)
  if (modules.length !== 1 || targets.length !== 1) return failure('TARGET_MISSING')
  if (moduleId === entry.targetModuleId) return failure('IMPORT_TARGET_INVALID')
  const localName = entry.localName.trim()
  if (!localName) return failure('IMPORT_INVALID')
  const analysis = analyzeProgram(project)
  const symbol = rootSymbol(project, analysis, entry.targetModuleId, entry.nodeId)
  if (!symbol || symbol.kind !== 'FunctionDeclaration') return failure('IMPORT_TARGET_INVALID')
  const module = modules[0]
  const target = targets[0]
  const imports = Array.isArray(module.imports) ? module.imports : []
  if (imports.some((importEntry) => importEntry?.id === entry.id || (importEntry?.moduleId === entry.targetModuleId && importEntry?.nodeId === entry.nodeId))) return failure('IMPORT_ALREADY_EXISTS')
  const scopeId = moduleScopeId(analysis, moduleId)
  if (analysis.semantic.symbols.some((existing) => existing.scopeId === scopeId && existing.name === localName)) return failure('IMPORT_NAME_TAKEN')
  const targetExports = Array.isArray(target.exports) ? target.exports : []
  const hasExport = targetExports.some((exportEntry) => exportEntry?.nodeId === entry.nodeId)
  const nextTargetExports = hasExport ? targetExports : [...targetExports, { nodeId: entry.nodeId, name: symbol.name }]
  const candidate = {
    ...project,
    modules: project.modules.map((current) => current.id === moduleId
      ? { ...current, imports: [...imports, { id: entry.id, moduleId: entry.targetModuleId, nodeId: entry.nodeId, localName }] }
      : current.id === entry.targetModuleId ? { ...current, exports: nextTargetExports } : current),
  }
  const nextAnalysis = analyzeProgram(candidate)
  if (interfaceFailure(analysis, nextAnalysis)) return failure('MODULE_INTERFACE_INVALID')
  return result(candidate, nextAnalysis)
}

// Retire seulement la liaison d'import ; les références restantes produisent leurs diagnostics.
export function removeModuleImport(project, moduleId, importId) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules)) return failure('SOURCE_INVALID')
  if (!isId(moduleId) || !isId(importId)) return failure('TARGET_INVALID')
  const modules = project.modules.filter((module) => module?.id === moduleId)
  if (modules.length !== 1) return failure(modules.length ? 'TARGET_INVALID' : 'TARGET_MISSING')
  const module = modules[0]
  const imports = Array.isArray(module.imports) ? module.imports : []
  if (!imports.some((entry) => entry?.id === importId)) return failure('TARGET_MISSING')
  const candidate = { ...project, modules: project.modules.map((entry) => entry.id === moduleId ? { ...entry, imports: imports.filter((importEntry) => importEntry?.id !== importId) } : entry) }
  return result(candidate)
}

// Complète les symboles visibles avec les fonctions exportées des autres modules.
// L'export reste la seule publication ; l'import local est créé au moment où la fonction est utilisée.
export function getCallableSymbols(context) {
  const visible = getVisibleSymbols(context)
  const project = context.index?.project
  const analysis = context.index?.analysis ?? (project ? analyzeProgram(project) : null)
  if (!project || !analysis || !isId(context.moduleId)) return visible
  const known = new Set(visible.map((symbol) => symbol.nodeId))
  const external = []
  for (const module of project.modules) {
    if (!isRecord(module) || module.id === context.moduleId) continue
    for (const symbol of getModuleFunctions(project, module.id, analysis)) {
      if (known.has(symbol.nodeId) || !Array.isArray(module.exports) || !module.exports.some((entry) => entry?.nodeId === symbol.nodeId)) continue
      known.add(symbol.nodeId)
      external.push({ ...symbol, id: `export:${module.id}:${symbol.nodeId}`, external: true, moduleName: module.name })
    }
  }
  return [...visible, ...external]
}

// Ajoute les imports manquants des fonctions exportées visées par une nouvelle source.
// Les noms locaux déjà pris reçoivent un suffixe ; la cible reste identifiée par son nœud stable.
export function ensureModuleImports(project, moduleId, sources, idFactory = null) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  if (!isId(moduleId) || !project.modules.some((module) => module?.id === moduleId)) return failure('TARGET_MISSING')
  const targets = (Array.isArray(sources) ? sources : []).map((source) => source?.references?.target).filter((target) => target?.kind === 'node' && isId(target.nodeId))
  let current = project
  for (const target of targets) {
    const node = current.nodes.find((entry) => entry?.id === target.nodeId)
    if (!node || node.moduleId === moduleId) continue
    const owner = current.modules.find((entry) => entry?.id === node.moduleId)
    if (!Array.isArray(owner?.exports) || !owner.exports.some((entry) => entry?.nodeId === node.id)) return failure('IMPORT_TARGET_INVALID')
    const importing = current.modules.find((entry) => entry?.id === moduleId)
    if ((importing?.imports ?? []).some((entry) => entry?.nodeId === node.id)) continue
    const base = isId(node.properties?.name) ? node.properties.name : 'function'
    let accepted = null
    for (let suffix = 0; suffix < 100 && !accepted; suffix += 1) {
      const localName = suffix === 0 ? base : `${base}${suffix + 1}`
      const id = idFactory ? idFactory() : `auto:${moduleId}:${node.id}${suffix === 0 ? '' : `:${suffix + 1}`}`
      const next = addModuleImport(current, moduleId, { id, targetModuleId: node.moduleId, nodeId: node.id, localName })
      if (next.ok) accepted = next.project
      else if (next.code !== 'IMPORT_NAME_TAKEN' && next.code !== 'IMPORT_ALREADY_EXISTS') return failure(next.code)
    }
    if (!accepted) return failure('IMPORT_NAME_TAKEN')
    current = accepted
  }
  return { ok: true, project: current, imported: current !== project }
}

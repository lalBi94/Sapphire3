import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
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

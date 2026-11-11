import {
  analyzeProgram as analyzeEngine,
  findAstNode,
  getImportCandidates,
  getModuleFunctions,
  getModuleRootSymbols,
  getUnusedImportIds,
} from '../../../src/utils/logic/index.js'
import { analyze, toPublicAnalysis } from './analysis.js'
import { assertProject } from './validation.js'

// Retourne un module par identifiant, ou null.
export function getModule(project, moduleId) {
  return project?.modules?.find((entry) => entry?.id === moduleId) ?? null
}

// Retourne un nœud par identifiant, ou null.
export function getNode(project, nodeId) {
  return project?.nodes?.find((entry) => entry?.id === nodeId) ?? null
}

// Retourne le type résolu d'un nœud, ou null.
export function getNodeType(analysis, nodeId) {
  return analysis?.nodeTypes?.find((entry) => entry.nodeId === nodeId)?.type ?? null
}

// Retourne le symbole associé à une déclaration, une référence résolue ou un membre de classe.
export function getNodeSymbol(analysis, nodeId) {
  const declaration = analysis?.symbols?.find((symbol) => symbol.nodeId === nodeId)
  if (declaration) return declaration
  const reference = analysis?.references?.find((entry) => entry.nodeId === nodeId)
  if (reference) return analysis.symbols.find((symbol) => symbol.id === reference.symbolId) ?? null
  const classInfo = (analysis?.classMembers ?? []).find((entry) => [...entry.public, ...entry.private].some((member) => member.nodeId === nodeId))
  if (!classInfo) return null
  const member = [...classInfo.public, ...classInfo.private].find((entry) => entry.nodeId === nodeId)
  return {
    id: `member:${nodeId}`,
    name: member.name,
    nodeId,
    moduleId: classInfo.classId,
    scopeId: '',
    kind: member.kind,
    type: member.type,
    visibility: member.visibility,
    constructor: member.constructor,
  }
}

// Liste les références qui ciblent un nœud déclaré, imports compris.
export function getReferencesTo(analysis, nodeId) {
  const symbolIds = new Set((analysis?.symbols ?? []).filter((symbol) => symbol.nodeId === nodeId).map((symbol) => symbol.id))
  return (analysis?.references ?? []).filter((reference) => symbolIds.has(reference.symbolId))
}

// Retrouve le parent syntaxique d'un nœud, ou null pour un nœud détaché.
export function getParent(project, nodeId) {
  for (const module of project?.modules ?? []) {
    if (Array.isArray(module.rootNodeIds) && module.rootNodeIds.includes(nodeId)) {
      return { kind: 'module', id: module.id, slot: 'rootNodeIds' }
    }
  }
  for (const node of project?.nodes ?? []) {
    for (const [slot, value] of Object.entries(node.children ?? {})) {
      const ids = Array.isArray(value) ? value : [value]
      if (ids.includes(nodeId)) return { kind: 'node', id: node.id, slot }
    }
  }
  return null
}

// Rassemble nœud, AST, parent, type, symbole et références d'un identifiant.
export function inspectNode(project, nodeId) {
  assertProject(project)
  const node = getNode(project, nodeId)
  if (!node) return null
  const analysis = analyze(project)
  return {
    node,
    astNode: findAstNode(analysis.ast, nodeId),
    parent: getParent(project, nodeId),
    type: getNodeType(analysis, nodeId),
    symbol: getNodeSymbol(analysis, nodeId),
    references: analysis.references.filter((reference) => reference.nodeId === nodeId),
    referencesTo: getReferencesTo(analysis, nodeId),
    analysis,
  }
}

// Décrit l'interface d'un module : imports, exports, symboles, fonctions et membres de classe.
export function getModuleInfo(project, moduleId) {
  assertProject(project)
  const module = getModule(project, moduleId)
  if (!module) return null
  const engineAnalysis = analyzeEngine(project)
  const analysis = toPublicAnalysis(engineAnalysis)
  const classInfo = analysis.classMembers.find((entry) => entry.classId === moduleId) ?? null
  const members = classInfo ? [...classInfo.public, ...classInfo.private] : []
  return {
    module,
    imports: module.imports ?? [],
    exports: module.exports ?? [],
    symbols: getModuleRootSymbols(project, moduleId, engineAnalysis),
    functions: getModuleFunctions(project, moduleId, engineAnalysis),
    members,
    constructor: classInfo?.constructor ? members.find((member) => member.nodeId === classInfo.constructor) ?? null : null,
    importCandidates: getImportCandidates(project, moduleId, engineAnalysis),
    unusedImportIds: getUnusedImportIds(project, moduleId, engineAnalysis),
    analysis,
  }
}

// Liste les membres publics et privés d'une classe, ou null.
export function listClassMembers(analysis, classId) {
  return (analysis?.classMembers ?? []).find((entry) => entry.classId === classId) ?? null
}

// Liste les symboles d'une analyse, éventuellement limités à un module.
export function listSymbols(analysis, moduleId = null) {
  return (analysis?.symbols ?? []).filter((symbol) => moduleId === null || symbol.moduleId === moduleId)
}

// Produit un résumé sérialisable d'un projet et de ses diagnostics.
export function summarize(project) {
  assertProject(project)
  const analysis = analyze(project)
  const diagnosticsByCode = {}
  for (const diagnostic of analysis.diagnostics) diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] ?? 0) + 1
  return {
    ok: analysis.canGenerate,
    canGenerate: analysis.canGenerate,
    diagnostics: analysis.diagnostics.length,
    diagnosticsByCode,
    modules: project.modules.map((module) => ({
      id: module.id,
      name: module.name,
      kind: module.kind,
      roots: Array.isArray(module.rootNodeIds) ? module.rootNodeIds.length : 0,
      imports: Array.isArray(module.imports) ? module.imports.length : 0,
      exports: Array.isArray(module.exports) ? module.exports.length : 0,
    })),
    nodes: project.nodes.length,
    symbols: analysis.symbols.length,
    references: analysis.references.length,
    classes: analysis.classes.length,
    untypedNodeIds: analysis.untypedNodeIds.length,
  }
}

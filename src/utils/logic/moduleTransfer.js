import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
import { isId, isRecord } from './model.js'

const widgetKeys = ['screen', 'gauge', 'progress', 'barChart', 'xyPlot', 'oscilloscope', 'heatmap', 'led', 'rgbLed', 'inputButton', 'inputNumber', 'colorPicker']

// Un module de widget possède une carte et des globales indexées : sa copie demande une réindexation dédiée.
function isWidgetModule(module) {
  return widgetKeys.some((key) => module?.[key])
}

// Vérifie la forme minimale d'un module source.
function validModule(module) {
  return isRecord(module) && isId(module.id) && isId(module.name) && (module.kind === 'module' || module.kind === 'class') && Array.isArray(module.rootNodeIds) && Array.isArray(module.imports) && Array.isArray(module.exports)
}

// Vérifie la forme minimale d'un nœud transporté.
function validNode(node) {
  return isRecord(node) && isId(node.id) && isId(node.moduleId) && isId(node.kind) && isRecord(node.properties) && isRecord(node.children) && isRecord(node.references)
}

// Compare deux diagnostics par leur localisation stable, sans dépendre du message traduit.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Collecte les identifiants de classe référencés dans un type, y compris les signatures imbriquées.
function collectClassIds(type, ids, depth = 0) {
  if (!isRecord(type) || depth > 20) return
  if (type.kind === 'class' && isId(type.classId)) ids.add(type.classId)
  if (type.kind === 'function') {
    for (const parameter of Array.isArray(type.parameters) ? type.parameters : []) collectClassIds(parameter, ids, depth + 1)
    collectClassIds(type.returnType, ids, depth + 1)
  }
}

// Remappe un type de classe vers le nouvel identifiant du module copié.
function remapClassType(type, sourceId, targetId, depth = 0) {
  if (!isRecord(type) || depth > 20) return
  if (type.kind === 'class' && type.classId === sourceId) type.classId = targetId
  if (type.kind === 'function') {
    for (const parameter of Array.isArray(type.parameters) ? type.parameters : []) remapClassType(parameter, sourceId, targetId, depth + 1)
    remapClassType(type.returnType, sourceId, targetId, depth + 1)
  }
}

// Capture un module logique entier, ses nœuds et sa carte de présentation optionnelle.
export function captureSourceModule(project, moduleId, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID' }
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (!module) return { ok: false, code: 'TARGET_MISSING' }
  if (!validModule(module)) return { ok: false, code: 'TRANSFER_MODULE_UNSUPPORTED' }
  if (isWidgetModule(module)) return { ok: false, code: 'TRANSFER_MODULE_UNSUPPORTED' }
  const nodes = project.nodes.filter((node) => node?.moduleId === moduleId)
  if (nodes.some((node) => !validNode(node)) || new Set(nodes.map((node) => node.id)).size !== nodes.length) return { ok: false, code: 'TRANSFER_STRUCTURE_INVALID' }
  if (module.rootNodeIds.some((id) => !nodes.some((node) => node.id === id))) return { ok: false, code: 'TRANSFER_STRUCTURE_INVALID' }
  try {
    return {
      ok: true,
      clipboard: {
        version: 1,
        module: structuredClone(module),
        nodes: nodes.map((node) => structuredClone(node)),
        ...(options.card ? { card: structuredClone(options.card) } : {}),
      },
    }
  } catch {
    return { ok: false, code: 'TRANSFER_STRUCTURE_INVALID' }
  }
}

// Clone un module capturé sous de nouveaux identifiants, sans modifier la source.
function cloneModule(project, clipboard, idFactory) {
  const source = clipboard.module
  const moduleId = idFactory()
  if (!isId(moduleId) || project.modules.some((module) => module.id === moduleId)) return { ok: false, code: 'ID_CONFLICT' }
  const nodeIds = new Map(clipboard.nodes.map((node) => [node.id, idFactory()]))
  const nodeValues = [...nodeIds.values()]
  if (nodeValues.some((id) => !isId(id)) || new Set(nodeValues).size !== nodeValues.length || nodeValues.some((id) => project.nodes.some((node) => node.id === id))) return { ok: false, code: 'ID_CONFLICT' }
  const importIds = new Map(source.imports.map((entry) => [entry.id, idFactory()]))
  if ([...importIds.values()].some((id) => !isId(id)) || new Set(importIds.values()).size !== importIds.size) return { ok: false, code: 'ID_CONFLICT' }

  const roots = source.rootNodeIds.map((id) => nodeIds.get(id))
  if (roots.some((id) => !id)) return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }

  // Recopie un lien en remappant uniquement les cibles internes au module cloné.
  const remapTarget = (target) => {
    if (target?.kind === 'node' && nodeIds.has(target.nodeId)) target.nodeId = nodeIds.get(target.nodeId)
    if (target?.kind === 'import' && importIds.has(target.importId)) target.importId = importIds.get(target.importId)
  }

  let nodes
  try {
    nodes = clipboard.nodes.map((sourceNode) => {
      const node = structuredClone(sourceNode)
      node.id = nodeIds.get(sourceNode.id)
      node.moduleId = moduleId
      node.children = Object.fromEntries(Object.entries(node.children ?? {}).map(([slot, value]) => [slot, Array.isArray(value) ? value.map((id) => nodeIds.get(id) ?? id) : value == null ? value : nodeIds.get(value) ?? value]))
      remapTarget(node.references?.target)
      remapTarget(node.properties?.type?.target)
      remapClassType(node.properties?.type, source.id, moduleId)
      if (source.kind === 'class' && node.kind === 'NewExpression' && node.properties?.classId === source.id) node.properties.classId = moduleId
      if (node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true) node.properties.entryPoint = false
      return node
    })
  } catch {
    return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }
  }

  const imports = source.imports.map((entry) => ({ ...entry, id: importIds.get(entry.id) }))
  const exports = source.exports.map((entry) => isRecord(entry) && nodeIds.has(entry.nodeId) ? { ...entry, nodeId: nodeIds.get(entry.nodeId) } : entry)
  const module = { ...source, id: moduleId, rootNodeIds: roots, imports, exports }
  return { ok: true, module, nodes }
}

// Colle un module capturé sous de nouveaux identifiants, en conservant ses imports externes.
export function pasteSourceModule(project, clipboard, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID' }
  if (!isRecord(clipboard) || clipboard.version !== 1 || !validModule(clipboard.module) || !Array.isArray(clipboard.nodes)) return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }
  if (isWidgetModule(clipboard.module)) return { ok: false, code: 'TRANSFER_MODULE_UNSUPPORTED' }
  if (clipboard.nodes.some((node) => !validNode(node)) || new Set(clipboard.nodes.map((node) => node.id)).size !== clipboard.nodes.length) return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }
  if (clipboard.nodes.some((node) => node.moduleId !== clipboard.module.id)) return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }
  if (typeof options.idFactory !== 'function') return { ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' }

  const cloned = cloneModule(project, clipboard, options.idFactory)
  if (!cloned.ok) return cloned

  // Vérifie que les imports du module copié existent encore dans le workspace cible.
  for (const entry of cloned.module.imports) {
    const target = project.modules.find((candidate) => candidate.id === entry?.moduleId)
    if (!target || !(target.rootNodeIds ?? []).includes(entry?.nodeId)) return { ok: false, code: 'TRANSFER_IMPORT_MISSING' }
  }

  // Vérifie les références de classe externes ; la classe copiée se référence elle-même via son nouvel identifiant.
  const classIds = new Set()
  for (const node of cloned.nodes) {
    if (isId(node.properties?.classId)) classIds.add(node.properties.classId)
    collectClassIds(node.properties?.type, classIds)
  }
  for (const classId of classIds) {
    if (classId === cloned.module.id) continue
    if (!project.modules.some((candidate) => candidate.id === classId && candidate.kind === 'class')) return { ok: false, code: 'TRANSFER_CLASS_MISSING' }
  }

  // Un nom de module doit rester unique dans le workspace cible.
  const usedNames = new Set(project.modules.map((entry) => entry.name).filter((name) => typeof name === 'string'))
  let name = cloned.module.name
  if (usedNames.has(name)) {
    let suffix = 2
    while (usedNames.has(`${name} ${suffix}`)) suffix += 1
    name = `${name} ${suffix}`
  }

  const module = { ...cloned.module, name }
  const candidate = { ...project, modules: [...project.modules, module], nodes: [...project.nodes, ...cloned.nodes] }
  const analysis = analyzeProgram(candidate)
  const previousIndex = options.index?.project === project && options.index.analysis ? options.index : createContextIndex(project, analyzeProgram(project))
  const known = new Set(previousIndex.analysis.diagnostics.map(diagnosticKey))
  const invalid = analysis.diagnostics.filter((diagnostic) => diagnostic.severity === 'error' && !known.has(diagnosticKey(diagnostic)))
  if (invalid.length) return { ok: false, code: 'TRANSFER_INVALID', diagnostics: invalid }
  return {
    ok: true,
    project: candidate,
    analysis,
    index: createContextIndex(candidate, analysis),
    module,
    nodes: cloned.nodes,
    sourceCard: clipboard.card ?? null,
  }
}

import { analyzeProgram } from './analysis.js'
import { createContextIndex, resolveContext, getVisibleSymbols } from './contextResolver.js'
import { getAvailableActions } from './actionResolver.js'
import { deleteSourceNodes, insertSourceNodes } from './sourceMutation.js'
import { ensureModuleImports } from './moduleInterface.js'
import { getNodeSchema } from './nodeSchema.js'
import { isId, isRecord } from './model.js'

// Réutilise une analyse seulement lorsqu'elle décrit exactement la source courante.
function currentIndex(project, supplied) {
  return supplied?.project === project && supplied.analysis ? supplied : createContextIndex(project, analyzeProgram(project))
}

// Retourne un refus atomique sans perdre la source précédente.
function failure(project, code, diagnostics = []) {
  return { ok: false, project, code, diagnostics }
}

// Capture un sous-arbre exclusif et fige ses références résolues en identifiants stables.
export function captureSourceNode(project, nodeId, options = {}) {
  const index = currentIndex(project, options.index)
  const context = resolveContext(project, { kind: 'node', id: nodeId }, undefined, index)
  if (!context.ok) return failure(project, context.code)
  const ids = new Set()
  const pending = [nodeId]
  while (pending.length) {
    const id = pending.pop()
    if (ids.has(id)) return failure(project, 'TRANSFER_STRUCTURE_INVALID')
    const node = index.nodes.get(id)
    if (!node || node.moduleId !== context.moduleId || index.duplicates.has(`node:${id}`)) return failure(project, 'TRANSFER_STRUCTURE_INVALID')
    ids.add(id)
    for (const child of Object.values(node.children ?? {}).flat().filter((value) => value != null)) {
      const parents = index.parents.get(child) ?? []
      if (parents.length !== 1 || parents[0].kind !== 'node' || parents[0].id !== id) return failure(project, 'TRANSFER_STRUCTURE_INVALID')
      pending.push(child)
    }
  }
  let nodes
  try { nodes = [...ids].map((id) => structuredClone(index.nodes.get(id))) }
  catch { return failure(project, 'TRANSFER_STRUCTURE_INVALID') }
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const reference of index.analysis.semantic.references) {
    if (!ids.has(reference.nodeId)) continue
    const symbol = index.symbols.get(reference.symbolId)
    if (!symbol) return failure(project, 'TRANSFER_REFERENCE_UNRESOLVED')
    const node = byId.get(reference.nodeId)
    const target = { kind: 'node', nodeId: symbol.nodeId }
    if (reference.field === 'references.target') node.references.target = target
    if (reference.field === 'properties.type.target') node.properties.type.target = target
  }
  return { ok: true, clipboard: { version: 1, rootId: nodeId, nodes } }
}

// Identifie un diagnostic sans dépendre de sa langue ni de son message.
function diagnosticKey(entry) {
  return JSON.stringify([entry.code, entry.location])
}

// Autorise les trous d'édition déjà permis par l'insertion, pas les régressions de références.
function isIncomplete(entry, index) {
  if (['NODE_INCOMPLETE', 'EXPRESSION_UNTYPED', 'RETURN_MISSING'].includes(entry.code)) return true
  const node = index.nodes.get(entry.location.nodeId)
  if (entry.code === 'LITERAL_INVALID' && node?.kind === 'Literal' && !Object.hasOwn(node.properties, 'value')) return true
  if (entry.code !== 'TYPE_MISMATCH') return false
  if (node?.kind === 'ReturnStatement' && entry.location.field === 'children.argument' && (!node.children.argument || index.nodes.get(node.children.argument)?.kind === 'Hole')) return true
  const signature = node?.kind === 'CallExpression' ? index.nodeTypes.get(node.children.callee) : null
  return entry.location.field === 'children.arguments' && signature?.kind === 'function' && (node.children.arguments?.length ?? 0) < signature.parameters.length
}

// Vérifie aussi les utilisateurs du nœud déplacé et les références par nom qui pourraient changer de cible.
function validateTransfer(project, previous, inserted, transferredIds) {
  const known = new Set(previous.analysis.diagnostics.map(diagnosticKey))
  const invalid = inserted.analysis.diagnostics.filter((entry) => entry.severity === 'error' && !known.has(diagnosticKey(entry)) && !isIncomplete(entry, inserted.index))
  if (invalid.length) return failure(project, 'TRANSFER_INVALID', invalid)
  const nextReferences = new Map(inserted.analysis.semantic.references.map((entry) => [JSON.stringify([entry.nodeId, entry.field]), entry]))
  for (const reference of previous.analysis.semantic.references) {
    if (transferredIds.has(reference.nodeId)) continue
    const original = previous.symbols.get(reference.symbolId)
    if (!original) continue
    const next = nextReferences.get(JSON.stringify([reference.nodeId, reference.field]))
    const resolved = inserted.index.symbols.get(next?.symbolId)
    if (resolved?.nodeId !== original.nodeId) return failure(project, 'TRANSFER_REFERENCES_CHANGED')
  }
  return inserted
}

// Remappe les seules relations source connues ; noms et champs inconnus restent conservés.
function copiedNodes(clipboard, moduleId, ids, move) {
  const remap = new Map(clipboard.nodes.map((node, position) => [node.id, move ? node.id : ids[position]]))
  return clipboard.nodes.map((source) => {
    const node = structuredClone(source)
    node.id = remap.get(source.id)
    node.moduleId = moduleId
    node.children = Object.fromEntries(Object.entries(node.children).map(([slot, value]) => [slot, Array.isArray(value) ? value.map((id) => remap.get(id) ?? id) : remap.get(value) ?? value]))
    for (const target of [node.references?.target, node.properties?.type?.target]) {
      if (target?.kind === 'node' && remap.has(target.nodeId)) target.nodeId = remap.get(target.nodeId)
    }
    if (!move && node.kind === 'FunctionDeclaration' && node.properties.entryPoint === true) node.properties.entryPoint = false
    return node
  })
}

// Prépare le déplacement ou la copie puis choisit l'unique slot réellement compatible.
function transfer(project, clipboard, receiver, options) {
  const index = currentIndex(project, options.index)
  const target = resolveContext(project, receiver, undefined, index)
  if (!target.ok) return failure(project, target.code)
  if (clipboard?.version !== 1 || !isId(clipboard.rootId) || !Array.isArray(clipboard.nodes) || !clipboard.nodes.length || !clipboard.nodes.every((node) => isRecord(node) && isId(node.id) && isRecord(node.properties) && isRecord(node.children) && isRecord(node.references)) || !clipboard.nodes.some((node) => node.id === clipboard.rootId)) return failure(project, 'TRANSFER_CLIPBOARD_INVALID')
  const sourceIds = new Set(clipboard.nodes.map((node) => node.id))
  if (sourceIds.size !== clipboard.nodes.length) return failure(project, 'TRANSFER_CLIPBOARD_INVALID')
  if (options.move && target.target.kind === 'node' && sourceIds.has(target.target.id)) return failure(project, 'TRANSFER_CYCLE')
  if (!options.move && (!Array.isArray(options.ids) || options.ids.length !== clipboard.nodes.length)) return failure(project, 'TRANSFER_CLIPBOARD_INVALID')
  if (!options.move && (options.ids.some((id) => !isId(id) || index.nodes.has(id)) || new Set(options.ids).size !== options.ids.length)) return failure(project, 'ID_CONFLICT')
  const detached = options.move ? deleteSourceNodes(project, { kind: 'node', id: clipboard.rootId }, { index }) : { ok: true, project }
  if (!detached.ok) return failure(project, detached.code)
  let nodes
  try { nodes = copiedNodes(clipboard, target.moduleId, options.ids, options.move) }
  catch { return failure(project, 'TRANSFER_CLIPBOARD_INVALID') }
  const root = nodes.find((node) => node.id === (options.move ? clipboard.rootId : options.ids[clipboard.nodes.findIndex((node) => node.id === clipboard.rootId)]))
  const imports = ensureModuleImports(detached.project, target.moduleId, nodes)
  if (!imports.ok) return failure(project, imports.code)
  const available = getAvailableActions(imports.project, target.target, options.slot, { index: imports.project === project ? index : undefined })
  if (!available.ok) return failure(project, available.code)
  const slots = [...new Set(available.actions.filter((action) => action.kind === root.kind).map((action) => action.slot))]
  if (!slots.length) return failure(project, 'TRANSFER_INCOMPATIBLE')
  if (!options.move && getNodeSchema(root.kind)?.named) {
    const names = new Set(getVisibleSymbols(available).map((symbol) => symbol.name))
    const base = root.properties.name
    let suffix = 2
    while (names.has(root.properties.name)) root.properties.name = `${base}${suffix++}`
  }
  const accepted = []
  let refused = null
  const originalParent = index.parents.get(clipboard.rootId)?.[0]
  for (const slot of slots) {
    if (options.move && originalParent?.kind === target.target.kind && originalParent.id === target.target.id && originalParent.slot === slot) {
      const value = originalParent.kind === 'module' ? index.modules.get(originalParent.id).rootNodeIds : index.nodes.get(originalParent.id).children[slot]
      if (!Array.isArray(value) || value.at(-1) === clipboard.rootId) { refused = failure(project, 'TRANSFER_NO_CHANGE'); continue }
    }
    const inserted = insertSourceNodes(imports.project, { targetId: target.target, slot }, { ok: true, rootId: root.id, nodes })
    const result = inserted.ok ? validateTransfer(project, index, inserted, options.move ? sourceIds : new Set()) : failure(project, inserted.code, inserted.diagnostics)
    if (result.ok) accepted.push({ ...result, slot })
    else refused = result
  }
  if (accepted.length > 1) return failure(project, 'TRANSFER_AMBIGUOUS')
  if (!accepted.length) return refused ?? failure(project, 'TRANSFER_INCOMPATIBLE')
  return { ...accepted[0], transferredNodeIds: nodes.map((node) => node.id) }
}

// Colle une capture locale avec des identifiants neufs alloués par l'appelant.
export function pasteSourceNode(project, clipboard, receiver, options = {}) {
  return transfer(project, clipboard, receiver, { ...options, move: false })
}

// Déplace les mêmes identifiants, sans publication implicite ni perte de références externes.
export function moveSourceNode(project, nodeId, receiver, options = {}) {
  const captured = captureSourceNode(project, nodeId, options)
  if (!captured.ok) return captured
  return transfer(project, captured.clipboard, receiver, { ...options, move: true })
}

// Duplique à la fin de la liste parente ; un slot unique occupé n'est jamais remplacé.
export function duplicateSourceNode(project, nodeId, options = {}) {
  const index = currentIndex(project, options.index)
  const captured = captureSourceNode(project, nodeId, { index })
  if (!captured.ok) return captured
  const parent = index.parents.get(nodeId)?.[0]
  return pasteSourceNode(project, captured.clipboard, { kind: parent.kind, id: parent.id }, { ...options, index, slot: parent.slot })
}

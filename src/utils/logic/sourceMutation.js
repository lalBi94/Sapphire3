import { analyzeProgram } from './analysis.js'
import { getAvailableActions } from './actionResolver.js'
import { createContextIndex } from './contextResolver.js'
import { diagnosticCodes as codes } from './diagnostics.js'
import { isId, isRecord } from './model.js'
import { sameType, primitiveType, acceptsOperand } from './primitives.js'
import { binaryOperators, unaryOperators } from './nodeSchema.js'

const hardInsertionCodes = new Set([
  codes.invalidStructure, codes.missingNode, codes.invalidModule, codes.multipleParents, codes.cycle,
  codes.illegalPlacement, codes.typeMismatch, codes.invalidType, codes.voidNotAllowed,
  codes.invalidLiteral, codes.overflow, codes.underflow, codes.divisionByZero, codes.conflict,
])

// Compare les diagnostics par localisation stable, sans dépendre du texte traduit.
function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.code, diagnostic.location])
}

// Utilise une contrainte de résultat explicite même si des enfants manquent, sans publier de faux type résolu.
function resultConstraint(root, analysis, expectedType) {
  const resolved = analysis.semantic.nodeTypes.find((entry) => entry.nodeId === root.id)?.type
  if (resolved) return { type: resolved }
  if (['Literal', 'CastExpression'].includes(root.kind) && root.properties.type?.kind === 'primitive') return { type: primitiveType(root.properties.type.name) }
  if (['BinaryExpression', 'UnaryExpression'].includes(root.kind)) {
    const operators = root.kind === 'BinaryExpression' ? binaryOperators : unaryOperators
    const operator = root.properties.operator
    const rule = typeof operator === 'string' && Object.hasOwn(operators, operator) ? operators[operator] : null
    if (rule?.result === 'same' && expectedType && !acceptsOperand(rule.operands, expectedType)) return { incompatible: true }
    if (rule && rule.result !== 'same') return { type: primitiveType(rule.result) }
  }
  if (root.kind === 'CallExpression') return { type: analysis.semantic.nodeTypes.find((entry) => entry.nodeId === root.children.callee)?.type?.returnType ?? null }
  return { type: null }
}

// Insère atomiquement une nouvelle arborescence, après contrôle du slot, du contexte et des types connus.
export function insertSourceNodes(project, request, bundle, options = {}) {
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', diagnostics: [], project }
  const context = getAvailableActions(project, request?.targetId, request?.slot, options)
  // Toute erreur renvoie exactement la source précédente ; aucun enfant n'est déplacé ou écrasé.
  const failure = (code, diagnostics = []) => ({ ok: false, code, diagnostics, project })
  if (!context.ok) return failure(context.code)
  if (!context.slot) return failure('SLOT_REQUIRED')
  if (context.slot.occupied || context.slot.malformed) return failure('SLOT_OCCUPIED')
  if (!bundle?.ok || !Array.isArray(bundle.nodes) || !isId(bundle.rootId)) return failure('DRAFT_INVALID')
  const root = bundle.nodes.find((node) => node?.id === bundle.rootId)
  if (!root || !context.actions.some((action) => action.kind === root.kind && action.slot === context.slot.name)) return failure('PLACEMENT_ILLEGAL')
  const ids = new Set()
  for (const node of bundle.nodes) {
    if (!isRecord(node) || !isId(node.id) || ids.has(node.id) || context.index.nodes.has(node.id)) return failure('ID_CONFLICT')
    if (node.moduleId !== context.moduleId) return failure('MODULE_INVALID')
    if (!isRecord(node.children) || !isRecord(node.properties) || !isRecord(node.references)) return failure('DRAFT_INVALID')
    ids.add(node.id)
  }
  for (const node of bundle.nodes) {
    for (const id of Object.values(node.children).flat()) {
      if (id !== null && !ids.has(id)) return failure('EXISTING_CHILD_FORBIDDEN')
    }
  }
  const slotName = context.slot.name
  let modules = project.modules
  let nodes = project.nodes
  if (context.target.kind === 'module') {
    modules = modules.map((module) => module?.id === context.target.id ? { ...module, rootNodeIds: [...(module.rootNodeIds ?? []), bundle.rootId] } : module)
  } else {
    nodes = nodes.map((node) => node?.id === context.target.id ? {
      ...node,
      children: { ...node.children, [slotName]: context.slot.many ? [...(node.children?.[slotName] ?? []), bundle.rootId] : bundle.rootId },
    } : node)
  }
  const candidate = { ...project, modules, nodes: [...nodes, ...bundle.nodes] }
  const analysis = analyzeProgram(candidate)
  const constraint = resultConstraint(root, analysis, context.expectedType)
  if (constraint.incompatible || (context.expectedType && constraint.type && !sameType(context.expectedType, constraint.type))) return failure('TYPE_MISMATCH')
  const previous = context.index.analysis ?? analyzeProgram(project)
  const previousKeys = new Set(previous.diagnostics.map(diagnosticKey))
  const invalid = analysis.diagnostics.filter((diagnostic) => {
    const call = candidate.nodes.find((node) => node?.id === diagnostic.location.nodeId)
    const signature = call?.kind === 'CallExpression' ? analysis.semantic.nodeTypes.find((entry) => entry.nodeId === call.children?.callee)?.type : null
    const pendingArguments = diagnostic.code === codes.typeMismatch && diagnostic.location.field === 'children.arguments' && signature?.kind === 'function' && (Array.isArray(call.children?.arguments) ? call.children.arguments.length : 0) < signature.parameters.length
    const pendingLiteral = diagnostic.code === codes.invalidLiteral && call?.kind === 'Literal' && isRecord(call.properties) && !Object.hasOwn(call.properties, 'value')
    const pendingReturn = diagnostic.code === codes.typeMismatch && call?.kind === 'ReturnStatement' && diagnostic.location.field === 'children.argument' && (call.children?.argument == null || candidate.nodes.find((node) => node?.id === call.children?.argument)?.kind === 'Hole')
    return !pendingArguments && !pendingLiteral && !pendingReturn && hardInsertionCodes.has(diagnostic.code) && !previousKeys.has(diagnosticKey(diagnostic))
  })
  if (invalid.length > 0) return failure('INSERTION_INVALID', invalid)
  // Des fragments incomplets sont permis, mais aucun enregistrement neuf ne peut rester détaché.
  if (analysis.diagnostics.some((diagnostic) => diagnostic.code === codes.detached && ids.has(diagnostic.location.nodeId))) return failure('DRAFT_INVALID')
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId: bundle.rootId }
}

// Modifie les seules propriétés configurables, en conservant tous les identifiants et liens existants.
export function updateSourceNode(project, nodeId, patch) {
  if (!isRecord(patch) || Object.keys(patch).some((key) => !['properties', 'references'].includes(key))) return { ok: false, code: 'PATCH_INVALID', project }
  if ((patch.properties !== undefined && !isRecord(patch.properties)) || (patch.references !== undefined && !isRecord(patch.references))) return { ok: false, code: 'PATCH_INVALID', project }
  if (!Array.isArray(project?.nodes)) return { ok: false, code: 'SOURCE_INVALID', project }
  const matches = project.nodes.filter((node) => node?.id === nodeId)
  if (matches.length !== 1) return { ok: false, code: 'TARGET_INVALID', project }
  const candidate = { ...project, nodes: project.nodes.map((node) => node?.id === nodeId ? { ...node, ...patch } : node) }
  const analysis = analyzeProgram(candidate)
  return { ok: true, project: candidate, analysis, index: createContextIndex(candidate, analysis), nodeId }
}

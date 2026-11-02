import { nodeSchema, acceptsNodeKind } from './nodeSchema.js'
import { isArrayType } from './primitives.js'
import { getPlacementIssue } from './placement.js'
import { resolveContext } from './contextResolver.js'

// Calcule les insertions depuis les slots et le contexte ; aucun AST n'est reconstruit ici.
export function getAvailableActions(project, targetId, slotName, options = {}) {
  const context = resolveContext(project, targetId, slotName, options.index)
  if (!context.ok) return { ...context, actions: [] }
  const actions = []
  const slots = context.slot ? [context.slot] : context.slots
  for (const slot of slots) {
    if (slot.occupied || slot.malformed) continue
    if (context.record.kind === 'CallExpression' && slot.name === 'arguments') {
      const signature = context.index.nodeTypes.get(context.record.children?.callee)
      if (signature?.kind === 'function' && (context.record.children?.arguments?.length ?? 0) >= signature.parameters.length) continue
    }
    const insertionContext = { ...context.context, parameterList: context.record.kind === 'FunctionDeclaration' && slot.name === 'parameters' }
    if (context.expectedType?.name === 'void') continue
    for (const kind of Object.keys(nodeSchema)) {
      if (kind === 'Hole' || !acceptsNodeKind(slot, kind) || getPlacementIssue(kind, insertionContext)) continue
      if (context.record.kind === 'CallExpression' && slot.name === 'callee' && kind !== 'Reference') continue
      // Un tableau ne peut remplir qu'un emplacement qui attend un tableau ; le choix reste libre sinon.
      if (['ArrayLiteral', 'ArrayCreation'].includes(kind) && context.expectedType && !isArrayType(context.expectedType)) continue
      actions.push({ id: `${slot.name}:${kind}`, kind, slot: slot.name, category: nodeSchema[kind].category })
    }
  }
  return { ...context, actions }
}

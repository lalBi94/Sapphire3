import { nodeSchema, acceptsNodeKind } from './nodeSchema.js'
import { getMathNativeEntries } from './mathNatives.js'
import { isArrayType } from './primitives.js'
import { getPlacementIssue } from './placement.js'
import { resolveContext } from './contextResolver.js'
import { getPluginCompositeActions } from './pluginExtensions.js'

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
    const insertionContext = { ...context.context, parameterList: ['FunctionDeclaration', 'LambdaExpression'].includes(context.record.kind) && slot.name === 'parameters' }
    if (context.expectedType?.name === 'void') continue
    for (const kind of Object.keys(nodeSchema)) {
      if (kind === 'Hole' || !acceptsNodeKind(slot, kind) || getPlacementIssue(kind, insertionContext)) continue
      if (context.record.kind === 'CallExpression' && slot.name === 'callee' && !['Reference', 'LambdaExpression', 'MemberExpression'].includes(kind)) continue
      // Un tableau ne peut remplir qu'un emplacement qui attend un tableau ; le choix reste libre sinon.
      if (['ArrayLiteral', 'ArrayCreation'].includes(kind) && context.expectedType && !isArrayType(context.expectedType)) continue
      // Chaque opération native est proposée séparément, dans sa sous-catégorie (Maths, Texte, Tableaux).
      if (kind === 'MathCall') {
        for (const native of getMathNativeEntries()) actions.push({ id: `${slot.name}:${kind}:${native.id}`, kind, slot: slot.name, category: nodeSchema[kind].category, group: native.group ?? 'native.math', preset: { name: native.id } })
        continue
      }
      actions.push({ id: `${slot.name}:${kind}`, kind, slot: slot.name, category: nodeSchema[kind].category })
    }
    // Une classe accepte un seul constructeur, proposé comme méthode spéciale.
    if (context.classScope && !context.index.classMembers?.get(context.moduleId)?.constructor) {
      actions.push({ id: `${slot.name}:constructor`, kind: 'FunctionDeclaration', slot: slot.name, category: 'declaration', group: 'function', labelKey: 'class.constructor', preset: { constructor: true } })
    }
    // Les nœuds composites de niveau A deviennent des actions natives dans le menu.
    for (const composite of getPluginCompositeActions()) {
      if (!acceptsNodeKind(slot, composite.rootKind) || getPlacementIssue(composite.rootKind, insertionContext)) continue
      const schema = nodeSchema[composite.rootKind]
      actions.push({
        id: `${slot.name}:composite:${composite.pluginId}:${composite.compositeId}`,
        kind: composite.rootKind,
        slot: slot.name,
        category: schema?.category ?? 'statement',
        group: 'plugin.composites',
        label: composite.name,
        composite: {
          pluginId: composite.pluginId,
          compositeId: composite.compositeId,
          name: composite.name,
          draft: composite.draft,
        },
      })
    }
  }
  return { ...context, actions }
}

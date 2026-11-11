import { isFunctionType, moduleInfo } from './helpers.js'

// Décrit une fonction, une méthode ou une lambda pour un nœud de call graph.
export function describeCallable(index, node, reachability = null) {
  const info = moduleInfo(index, node.moduleId)
  const kind = node.kind === 'LambdaExpression' ? 'lambda' : info.classId ? 'method' : 'function'
  const name = node.kind === 'LambdaExpression' ? '<lambda>' : node.properties?.name ?? node.id
  const type = index.nodeTypes.get(node.id) ?? null
  const parameters = (node.children?.parameters ?? []).map((id) => index.nodes.get(id)?.properties?.name ?? '?')
  return {
    id: node.id,
    sourceId: node.id,
    kind,
    entity: 'callable',
    name,
    label: name,
    moduleId: node.moduleId,
    moduleName: info.moduleName,
    classId: info.classId,
    className: info.className,
    type,
    parameters,
    entryPoint: node.properties?.entryPoint === true,
    isConstructor: node.properties?.constructor === true,
    callable: true,
    reachable: reachability?.functions?.find((entry) => entry.nodeId === node.id)?.reachable ?? null,
    sourceKind: node.kind,
  }
}

// Retrouve un membre de classe par nom, constructeur compris.
function classMemberNodeId(index, classId, name) {
  const members = index.classMembers.get(classId)
  if (!members || typeof name !== 'string') return null
  if (name === 'constructor' && members.constructor) return members.constructor
  return members.public.get(name) ?? members.private.get(name) ?? null
}

// Résout la cible statique d'un appel, ou expose explicitement l'incertitude.
export function resolveCallee(index, callNode) {
  const callee = index.nodes.get(callNode?.children?.callee)
  if (!callee) return { resolution: 'unresolved', callKind: 'unresolved', reason: 'callee-missing' }

  if (callee.kind === 'LambdaExpression') {
    return {
      resolution: 'direct',
      callKind: 'lambda',
      targetNodeId: callee.id,
      targetType: index.nodeTypes.get(callee.id) ?? null,
    }
  }

  if (callee.kind === 'Reference') {
    const reference = index.references.get(callee.id)
    const symbol = reference?.symbolId ? index.symbols.get(reference.symbolId) : null
    if (!symbol?.nodeId) return { resolution: 'unresolved', callKind: 'unresolved', reason: 'reference-unresolved', referenceNodeId: callee.id }
    const target = index.nodes.get(symbol.nodeId)
    if (target?.kind === 'FunctionDeclaration' || target?.kind === 'LambdaExpression') {
      const info = moduleInfo(index, target.moduleId)
      return {
        resolution: 'direct',
        callKind: target.kind === 'LambdaExpression' ? 'lambda' : info.classId ? 'method' : 'function',
        targetNodeId: target.id,
        targetSymbolId: symbol.id,
        targetType: symbol.type ?? index.nodeTypes.get(target.id) ?? null,
        importedFrom: symbol.importedFrom ?? null,
      }
    }
    const targetType = symbol.type ?? index.nodeTypes.get(symbol.nodeId) ?? null
    return {
      resolution: 'indirect',
      callKind: 'indirect',
      targetNodeId: symbol.nodeId,
      targetSymbolId: symbol.id,
      targetType,
      reason: isFunctionType(targetType) ? 'function-reference' : 'non-callable-symbol',
      importedFrom: symbol.importedFrom ?? null,
    }
  }

  if (callee.kind === 'MemberExpression') {
    const objectType = index.nodeTypes.get(callee.children?.object) ?? null
    if (objectType?.kind !== 'class' || !objectType.classId) {
      return { resolution: 'unresolved', callKind: 'unresolved', reason: 'receiver-type-unknown', targetType: objectType }
    }
    const memberId = classMemberNodeId(index, objectType.classId, callee.properties?.name)
    if (!memberId) return { resolution: 'unresolved', callKind: 'unresolved', reason: 'method-not-found', targetType: objectType }
    const target = index.nodes.get(memberId)
    if (target?.kind === 'FunctionDeclaration') {
      return {
        resolution: 'direct',
        callKind: 'method',
        targetNodeId: memberId,
        targetType: index.nodeTypes.get(memberId) ?? null,
        classId: objectType.classId,
      }
    }
    const targetType = index.nodeTypes.get(memberId) ?? target?.properties?.type ?? null
    return {
      resolution: 'indirect',
      callKind: 'indirect',
      targetNodeId: memberId,
      targetType,
      reason: isFunctionType(targetType) ? 'function-field' : 'non-callable-member',
      classId: objectType.classId,
    }
  }

  return { resolution: 'unresolved', callKind: 'unresolved', reason: 'dynamic-callee', calleeKind: callee.kind }
}

// Résout le constructeur statique d'une instanciation de classe.
export function resolveConstructor(index, node) {
  const classId = node?.properties?.classId
  const members = classId ? index.classMembers.get(classId) : null
  if (!members) return { resolution: 'unresolved', callKind: 'constructor', reason: 'class-unknown', targetType: classId ? { kind: 'class', classId } : null }
  if (!members.constructor) return { resolution: 'unresolved', callKind: 'constructor', reason: 'implicit-constructor', targetType: { kind: 'class', classId } }
  return {
    resolution: 'direct',
    callKind: 'constructor',
    targetNodeId: members.constructor,
    targetType: index.nodeTypes.get(members.constructor) ?? null,
    classId,
  }
}

// Collecte tous les sites d'appel avec leur appelant lexical et leur résolution.
export function collectCallSites(prepared) {
  const { project, index } = prepared
  const sites = []
  for (const callNode of project.nodes) {
    if (!['CallExpression', 'NewExpression'].includes(callNode?.kind)) continue
    const callerNodeId = index.contexts.get(callNode.id)?.functionId ?? null
    sites.push({
      callNodeId: callNode.id,
      moduleId: callNode.moduleId,
      callerNodeId,
      moduleLevel: callerNodeId === null,
      callee: callNode.kind === 'NewExpression' ? resolveConstructor(index, callNode) : resolveCallee(index, callNode),
    })
  }
  return sites
}

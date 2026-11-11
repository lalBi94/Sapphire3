import { createDiagnostic } from '../logic/diagnostics.js'
import { getNodeSchema } from '../logic/nodeSchema.js'

// Retourne uniquement un enfant AST complet d'un emplacement simple.
export function child(node, name) {
  const value = node?.children?.[name]
  return value && !Array.isArray(value) && !['Invalid', 'Hole'].includes(value.kind) ? value : null
}

// Prépare les données sémantiques et noms stables communs aux émetteurs, sans seconde analyse.
export function createGenerationContext(analysis, { selection = null, reservedWords, runtimeNames, allowDollar = false, reservedMemberNames = [] }) {
  const diagnostics = []
  const { ast, semantic } = analysis
  const { nodes, symbolByNode, referenceSymbols } = semantic.index
  const typeByNode = new Map(semantic.nodeTypes.map(({ nodeId, type }) => [nodeId, type]))
  const modules = new Map(ast.modules.map((module) => [module.sourceId, module]))
  const entryPoints = [...nodes.values()].filter((node) => node.kind === 'FunctionDeclaration' && node.properties.entryPoint === true)
  if (!selection) {
    if (entryPoints.length === 0) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_REQUIRED', 'Une fonction point d’entrée est nécessaire pour générer le programme.', { projectId: ast.sourceId }))
    if (entryPoints.length > 1) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_DUPLICATE', 'Une seule fonction point d’entrée est autorisée.', { projectId: ast.sourceId }))
    if (entryPoints.length === 1 && entryPoints[0].children.parameters.length > 0) diagnostics.push(createDiagnostic('TRANSPILE_ENTRY_POINT_INPUTS', 'Le point d’entrée ne doit pas demander de paramètres.', entryPoints[0].location))
  }
  const generatedNames = new Map()
  const usedNames = new Set(['main', ...runtimeNames])
  const parents = new Map()
  for (const node of nodes.values()) for (const value of Object.values(node.children).flat()) if (value?.sourceId) parents.set(value.sourceId, node)

  // Adapte uniquement l'alphabet et les mots réservés au langage cible.
  function identifier(name) {
    const normalized = String(name).replace(allowDollar ? /[^\w$]/g : /[^\w]/g, '_')
    const result = /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`
    return reservedWords.has(result) ? `_${result}` : result
  }

  // Réserve un nom technique sans le confondre avec une déclaration source.
  function reserveSyntheticName(base) {
    let name = identifier(base)
    while (usedNames.has(name)) name = `_${name}`
    usedNames.add(name)
    return name
  }

  // Réserve tous les noms avant l'émission pour conserver les appels intermodules et récursifs.
  function reserveDeclaration(node) {
    if (generatedNames.has(node.sourceId)) return generatedNames.get(node.sourceId)
    const module = modules.get(node.moduleId)
    const base = identifier(`${module?.name ?? node.moduleId}_${node.properties.name}`)
    let name = base
    let suffix = 2
    while (usedNames.has(name)) name = `${base}_${suffix++}`
    usedNames.add(name)
    generatedNames.set(node.sourceId, name)
    const symbol = symbolByNode.get(node.sourceId)
    if (symbol) generatedNames.set(symbol.id, name)
    return name
  }
  for (const node of nodes.values()) if (getNodeSchema(node.kind)?.named) reserveDeclaration(node)

  // Noms de classe et de membres : stables, uniques dans leur portée et indépendants du langage cible.
  const classMembers = analysis.semantic.index?.classMembers ?? new Map()
  const classMemberNames = new Map()
  for (const [classId, members] of classMembers) {
    const names = new Map()
    const used = new Set(reservedMemberNames)
    for (const scope of ['public', 'private']) {
      for (const name of members[scope].keys()) {
        let candidate = identifier(name)
        while (used.has(candidate)) candidate = `_${candidate}`
        used.add(candidate)
        names.set(name, candidate)
      }
    }
    classMemberNames.set(classId, names)
  }
  const classNames = new Map()
  for (const module of ast.modules) if (module.moduleKind === 'class') classNames.set(module.sourceId, reserveSyntheticName(module.name || module.sourceId))

  // Utilise la résolution déjà validée plutôt que de réinterpréter les noms source.
  function referenceName(node) {
    const symbol = referenceSymbols.get(node?.sourceId)
    if (!symbol) {
      diagnostics.push(createDiagnostic('TRANSPILE_REFERENCE_UNRESOLVED', 'Une référence ne peut pas être générée.', node?.location))
      return 'sapphireUninitialized'
    }
    if (generatedNames.has(symbol.id)) return generatedNames.get(symbol.id)
    const target = nodes.get(symbol.nodeId)
    return target ? reserveDeclaration(target) : identifier(symbol.name)
  }

  return { analysis, ast, nodes, modules, parents, typeByNode, generatedNames, diagnostics, selection, reserveDeclaration, reserveSyntheticName, referenceName, memberName: identifier, classNames, classMembers, classMemberNames, entryName: entryPoints.length === 1 ? reserveDeclaration(entryPoints[0]) : null }
}

// Décrit les noms générés et le point d'entrée pour la traçabilité du SDK.
export function generationMetadata(context, { selection = null, constructorName = null } = {}) {
  const { nodes, modules, generatedNames, classNames, classMemberNames, entryName } = context
  const declarations = []
  for (const node of nodes.values()) {
    const generatedName = generatedNames.get(node.sourceId)
    if (!generatedName) continue
    if (!['FunctionDeclaration', 'VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(node.kind)) continue
    const module = modules.get(node.moduleId)
    const isClassMember = module?.moduleKind === 'class' && module.body.some((entry) => entry.sourceId === node.sourceId)
    const memberName = isClassMember ? classMemberNames.get(node.moduleId)?.get(node.properties?.name) : null
    const resolvedName = isClassMember && node.properties?.constructor === true ? constructorName ?? memberName ?? generatedName : memberName ?? generatedName
    declarations.push({
      nodeId: node.sourceId,
      moduleId: node.moduleId,
      kind: node.kind,
      name: node.properties?.name ?? null,
      generatedName: resolvedName,
      ...(isClassMember ? { classId: node.moduleId, className: classNames.get(node.moduleId) ?? null } : {}),
    })
  }
  const entry = [...nodes.values()].find((node) => node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  return {
    declarations,
    classes: [...classNames].map(([classId, generatedName]) => ({ classId, generatedName })),
    entryPoint: entry && entryName ? { nodeId: entry.sourceId, generatedName: entryName } : null,
    selection: selection ? { kind: selection.kind, id: selection.id } : null,
  }
}

// Valide et émet un extrait avec les mêmes callbacks que le programme complet.
export function generateSelection(context, { functionCode, statementCode, expression, classCode = null, constructorName = null }) {
  const { selection, modules, nodes, analysis, diagnostics, reserveDeclaration } = context
  if (!selection) return null
  const selected = selection.kind === 'module' ? modules.get(selection.id) : nodes.get(selection.id)
  if (!selected) return { ok: false, code: '', diagnostics: [{ code: 'TARGET_MISSING' }] }
  const selectedModule = selection.kind === 'module' ? selected : modules.get(selected.moduleId)
  const classSelection = selectedModule?.moduleKind === 'class' ? selectedModule : null
  const subtree = new Set()
  const pending = classSelection ? [...classSelection.body] : selection.kind === 'module' ? [...selected.body] : [selected]
  while (pending.length) {
    const node = pending.pop()
    if (!node || subtree.has(node.sourceId)) continue
    subtree.add(node.sourceId)
    pending.push(...Object.values(node.children ?? {}).flat().filter((value) => value && typeof value === 'object'))
  }
  const blocking = analysis.diagnostics.filter((entry) => entry.severity === 'error' && (subtree.has(entry.location.nodeId) || (selection.kind === 'module' && entry.location.moduleId === selection.id)))
  if (blocking.length) return { ok: false, code: '', diagnostics: blocking }

  // Sélectionne une catégorie syntaxique, sans faire dépendre le modèle du langage cible.
  function snippet(node) {
    if (node.kind === 'FunctionDeclaration') return functionCode(node)
    if (node.kind === 'Parameter') return reserveDeclaration(node)
    if (node.kind === 'TypeDeclaration') return ''
    return getNodeSchema(node.kind)?.category === 'expression' ? expression(node) : statementCode(node, 0)
  }
  const classSource = classSelection && classCode ? classCode(classSelection) : null
  const code = classSource ?? (selection.kind === 'module' ? selected.body.map(snippet).filter(Boolean).join('\n\n') : snippet(selected))
  return { ok: diagnostics.length === 0, code: diagnostics.length ? '' : code, diagnostics, metadata: generationMetadata(context, { selection, constructorName }) }
}

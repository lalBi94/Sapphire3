import { createDiagnostic } from '../logic/diagnostics.js'
import { getNodeSchema } from '../logic/nodeSchema.js'

// Retourne uniquement un enfant AST complet d'un emplacement simple.
export function child(node, name) {
  const value = node?.children?.[name]
  return value && !Array.isArray(value) && !['Invalid', 'Hole'].includes(value.kind) ? value : null
}

// Prépare les données sémantiques et noms stables communs aux émetteurs, sans seconde analyse.
export function createGenerationContext(analysis, { selection = null, reservedWords, runtimeNames, allowDollar = false }) {
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

  return { analysis, ast, nodes, modules, parents, typeByNode, generatedNames, diagnostics, selection, reserveDeclaration, referenceName, entryName: entryPoints.length === 1 ? reserveDeclaration(entryPoints[0]) : null }
}

// Valide et émet un extrait avec les mêmes callbacks que le programme complet.
export function generateSelection(context, { functionCode, statementCode, expression }) {
  const { selection, modules, nodes, analysis, diagnostics, reserveDeclaration } = context
  if (!selection) return null
  const selected = selection.kind === 'module' ? modules.get(selection.id) : nodes.get(selection.id)
  if (!selected) return { ok: false, code: '', diagnostics: [{ code: 'TARGET_MISSING' }] }
  const subtree = new Set()
  const pending = selection.kind === 'module' ? [...selected.body] : [selected]
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
  const code = selection.kind === 'module' ? selected.body.map(snippet).filter(Boolean).join('\n\n') : snippet(selected)
  return { ok: diagnostics.length === 0, code: diagnostics.length ? '' : code, diagnostics }
}

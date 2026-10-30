import { createDiagnostic, diagnosticCodes as codes } from './diagnostics.js'
import { isId, isRecord, moduleKinds, sourceFormatVersion } from './model.js'
import { getNodeSchema, moduleRootSlot, acceptsNodeKind } from './nodeSchema.js'

/**
 * @typedef {{kind:string, sourceId:string|null, moduleId:string|null, properties:Object, references:Object, children:Object, location:import('./diagnostics.js').Location}} LogicalNode
 * Les slots children contiennent des LogicalNode, et non les identifiants source.
 * Hole et Invalid gardent la localisation d'origine sans fabriquer d'identifiant.
 */

// Transforme les liens syntaxiques en arbres inspectables sans modifier les données source.
export function buildLogicalAst(source) {
  const diagnostics = []
  const ast = { kind: 'Project', sourceId: isId(source?.id) ? source.id : null, modules: [], unassignedNodes: [] }
  const projectId = ast.sourceId

  // Ajoute une erreur attachée au propriétaire du champ défectueux.
  function report(code, message, location = {}, severity = 'error') {
    diagnostics.push(createDiagnostic(code, message, { projectId, ...location }, severity))
  }

  if (!isRecord(source)) {
    report(codes.invalidSource, 'Le projet doit être un objet JSON.')
    return { ast, diagnostics }
  }
  if (!isId(source.id)) report(codes.invalidId, 'Identifiant de projet absent ou invalide.')
  if (source.formatVersion !== sourceFormatVersion) report(codes.unsupportedVersion, 'Version du modèle source non prise en charge.', { field: 'formatVersion' })

  // Indexe la première occurrence valide et signale les doublons, sans réécrire la source.
  function indexRecords(records, entity) {
    const index = new Map()
    if (!Array.isArray(records)) {
      report(codes.invalidSource, `La collection ${entity} doit être un tableau.`, { field: entity })
      return index
    }
    records.forEach((record, position) => {
      const location = { field: `${entity}[${position}]`, moduleId: entity === 'modules' ? record?.id : record?.moduleId, nodeId: entity === 'nodes' ? record?.id : null }
      if (!isRecord(record) || !isId(record.id)) {
        report(codes.invalidId, `Identifiant invalide dans ${entity}.`, location)
      } else if (index.has(record.id)) {
        report(codes.duplicateId, `Identifiant dupliqué : ${record.id}.`, location)
      } else {
        index.set(record.id, record)
      }
    })
    return index
  }

  const modules = indexRecords(source.modules, 'modules')
  const nodes = indexRecords(source.nodes, 'nodes')
  let entryPointFound = false
  for (const node of nodes.values()) {
    const marker = isRecord(node.properties) ? node.properties.entryPoint : undefined
    if (marker === undefined) continue
    const location = { moduleId: node.moduleId, nodeId: node.id, field: 'properties.entryPoint' }
    if (node.kind !== 'FunctionDeclaration' || typeof marker !== 'boolean') {
      report(codes.invalidEntryPoint, 'Le rôle de point d’entrée est un booléen réservé aux fonctions.', location)
    } else if (marker) {
      if (entryPointFound) report(codes.duplicateEntryPoint, 'Un projet peut contenir zéro ou une seule fonction point d’entrée.', location)
      entryPointFound = true
    }
  }
  const attached = new Set()
  const active = new Set()

  // Matérialise un emplacement non constructible au lieu d'interrompre tout l'AST.
  function placeholder(kind, location, reason, sourceId = null) {
    return { kind, sourceId, moduleId: location.moduleId ?? null, properties: { reason }, references: {}, children: {}, location: { projectId, ...location } }
  }

  // Déplie un identifiant en sous-arbre et contrôle cycles, appartenance et catégories.
  function buildNode(id, moduleId, location, expected = null, depth = 0) {
    if (id === null || id === undefined) {
      report(codes.incomplete, 'Emplacement syntaxique incomplet.', location)
      return placeholder('Hole', location, 'missing')
    }
    if (!isId(id) || !nodes.has(id)) {
      report(codes.missingNode, `Nœud introuvable : ${isId(id) ? id : '(identifiant invalide)'}.`, location)
      return placeholder('Invalid', location, 'missing-node', isId(id) ? id : null)
    }
    const node = nodes.get(id)
    const ownLocation = { projectId, moduleId, nodeId: id, field: null }
    if (node.moduleId !== moduleId) {
      report(codes.invalidModule, 'Un enfant syntaxique doit appartenir au même module que son parent.', location)
      return placeholder('Invalid', location, 'foreign-module', id)
    }
    if (active.has(id)) {
      report(codes.cycle, 'Cycle dans les liens syntaxiques.', { ...location, nodeId: id })
      return placeholder('Invalid', ownLocation, 'cycle', id)
    }
    if (attached.has(id)) {
      report(codes.multipleParents, 'Ce nœud possède plusieurs parents syntaxiques.', { ...location, nodeId: id })
      return placeholder('Invalid', ownLocation, 'multiple-parents', id)
    }
    if (depth > 200) {
      report(codes.depthExceeded, 'Profondeur syntaxique maximale de sécurité dépassée.', ownLocation)
      return placeholder('Invalid', ownLocation, 'depth-limit', id)
    }
    attached.add(id)
    active.add(id)
    const schema = getNodeSchema(node.kind)
    if (!schema) report(codes.unknownKind, `Construction inconnue : ${typeof node.kind === 'string' ? node.kind : '(catégorie invalide)'}.`, ownLocation)
    if (schema && expected && !acceptsNodeKind(expected, node.kind)) {
      report(codes.invalidStructure, 'Construction non autorisée dans cet emplacement.', ownLocation)
    }
    if (node.kind === 'Hole') report(codes.incomplete, 'Nœud laissé volontairement incomplet.', ownLocation)
    if (!isRecord(node.properties)) report(codes.invalidStructure, 'Les propriétés doivent être un objet.', ownLocation)
    if (!isRecord(node.references)) report(codes.invalidStructure, 'Les références doivent être un objet.', ownLocation)
    if (!isRecord(node.children)) report(codes.invalidStructure, 'Les liens syntaxiques doivent être un objet.', ownLocation)
    const properties = isRecord(node.properties) ? node.properties : {}
    if (schema?.named && !isId(properties.name)) report(codes.incomplete, 'Nom de déclaration manquant.', { ...ownLocation, field: 'properties.name' })
    if (properties.type !== undefined && !schema?.declaresType) report(codes.invalidStructure, 'Cette construction ne porte pas d’annotation de type ; son type est déterminé par ses opérandes ou sa référence.', { ...ownLocation, field: 'properties.type' })
    const children = Object.create(null)
    const slots = isRecord(node.children) ? node.children : {}
    const definitions = schema?.slots ?? {}
    for (const name of new Set([...Object.keys(definitions), ...Object.keys(slots)])) {
      const definition = Object.hasOwn(definitions, name) ? definitions[name] : null
      const value = slots[name]
      const childLocation = { ...ownLocation, field: `children.${name}` }
      if (!Object.hasOwn(definitions, name)) report(codes.invalidStructure, `Emplacement inconnu : ${name}.`, childLocation)
      if (definition?.many || Array.isArray(value)) {
        if (!Array.isArray(value)) {
          report(codes.incomplete, `La liste ${name} est absente ou invalide.`, childLocation)
          children[name] = []
        } else {
          if (definition && !definition.many) report(codes.invalidStructure, 'Une liste remplace un emplacement simple.', childLocation)
          children[name] = value.map((childId, index) => buildNode(childId, moduleId, { ...childLocation, field: `children.${name}[${index}]` }, definition, depth + 1))
        }
      } else if ((value === undefined || value === null) && !definition?.required) {
        children[name] = null
      } else {
        children[name] = buildNode(value, moduleId, childLocation, definition, depth + 1)
      }
    }
    active.delete(id)
    return { kind: schema ? node.kind : 'Invalid', sourceKind: node.kind, sourceId: id, moduleId, properties, references: isRecord(node.references) ? node.references : {}, children, location: ownLocation }
  }

  for (const module of modules.values()) {
    const location = { moduleId: module.id }
    if (!Object.values(moduleKinds).includes(module.kind)) report(codes.invalidModule, 'Catégorie de module inconnue.', location)
    if (!isId(module.name)) report(codes.incomplete, 'Nom de module manquant.', location)
    for (const field of ['rootNodeIds', 'imports', 'exports']) {
      if (!Array.isArray(module[field])) report(codes.invalidStructure, `La collection ${field} doit être un tableau.`, { ...location, field })
    }
    const roots = Array.isArray(module.rootNodeIds) ? module.rootNodeIds : []
    ast.modules.push({
      kind: 'Module', sourceId: module.id, name: module.name, moduleKind: module.kind,
      imports: Array.isArray(module.imports) ? module.imports : [],
      exports: Array.isArray(module.exports) ? module.exports : [],
      body: roots.map((id, index) => buildNode(id, module.id, { ...location, field: `rootNodeIds[${index}]` }, moduleRootSlot)),
      detachedNodes: [],
    })
  }

  for (const node of nodes.values()) {
    if (!modules.has(node.moduleId)) {
      report(codes.invalidModule, 'Le module propriétaire du nœud est introuvable.', { moduleId: isId(node.moduleId) ? node.moduleId : null, nodeId: node.id })
      ast.unassignedNodes.push({ kind: 'Invalid', sourceId: node.id, moduleId: node.moduleId ?? null, properties: node.properties, references: node.references, children: {}, location: { projectId, moduleId: node.moduleId ?? null, nodeId: node.id, field: null } })
    }
  }
  const detached = [...nodes.values()].filter((node) => modules.has(node.moduleId) && !attached.has(node.id))
  const incoming = new Set()
  for (const node of detached) {
    const links = isRecord(node.children) ? Object.values(node.children).flat() : []
    for (const id of links) {
      if (isId(id) && nodes.get(id)?.moduleId === node.moduleId) incoming.add(id)
    }
  }
  // Commence par les racines des fragments, indépendamment de l'ordre des enregistrements.
  const detachedOrder = [...detached.filter((node) => !incoming.has(node.id)), ...detached]
  for (const node of detachedOrder) {
    if (!attached.has(node.id)) {
      report(codes.detached, 'Nœud conservé mais non rattaché aux racines du module.', { moduleId: node.moduleId, nodeId: node.id })
      const module = ast.modules.find((entry) => entry.sourceId === node.moduleId)
      module.detachedNodes.push(buildNode(node.id, node.moduleId, { moduleId: node.moduleId, nodeId: node.id }))
    }
  }
  return { ast, diagnostics }
}

// Parcourt l'AST logique, y compris les fragments détachés, sans suivre les références.
export function walkAst(ast, visitor) {
  const stack = [...ast.modules.flatMap((module) => [...module.body, ...module.detachedNodes]), ...ast.unassignedNodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    visitor(node)
    const children = Object.values(node.children).flat().filter(Boolean)
    stack.push(...children.reverse())
  }
}

import { createNode, isId, isRecord } from './model.js'
import { getNodeSchema, acceptsNodeKind } from './nodeSchema.js'

// Transforme une configuration en nouveaux enregistrements uniquement ; aucun nœud existant n'est touché.
export function createNodeBundle(moduleId, draft, idFactory) {
  const nodes = []
  const ids = new Set()

  // Construit les enfants demandés dans leur ordre, avec des slots vides explicites si incomplets.
  function build(config, depth = 0) {
    const schema = isRecord(config) ? getNodeSchema(config.kind) : null
    if (!schema || depth > 100) throw new Error('DRAFT_INVALID')
    const id = idFactory()
    if (!isId(id) || ids.has(id)) throw new Error('ID_INVALID')
    ids.add(id)
    const properties = config.properties ?? {}
    const references = config.references ?? {}
    if (!isRecord(properties) || !isRecord(references) || (config.children !== undefined && !isRecord(config.children))) throw new Error('DRAFT_INVALID')
    for (const name of Object.keys(config.children ?? {})) {
      if (!Object.hasOwn(schema.slots, name)) throw new Error('SLOT_NOT_FOUND')
    }
    const entry = createNode(id, moduleId, config.kind, { properties: { ...properties }, references: { ...references }, children: {} })
    nodes.push(entry)
    for (const [name, slot] of Object.entries(schema.slots)) {
      const value = config.children?.[name]
      if (value === null || value === undefined) entry.children[name] = slot.many ? [] : null
      else {
        if (Boolean(slot.many) !== Array.isArray(value)) throw new Error('SLOT_CARDINALITY')
        const configs = Array.isArray(value) ? value : [value]
        for (const child of configs) if (!isRecord(child) || !acceptsNodeKind(slot, child.kind)) throw new Error('SLOT_INCOMPATIBLE')
        const children = configs.map((child) => build(child, depth + 1))
        entry.children[name] = slot.many ? children : children[0]
      }
    }
    return id
  }

  try {
    if (!isId(moduleId) || typeof idFactory !== 'function') return { ok: false, code: 'DRAFT_INVALID' }
    const rootId = build(draft)
    return { ok: true, rootId, nodes }
  } catch (error) {
    return { ok: false, code: ['DRAFT_INVALID', 'ID_INVALID', 'SLOT_NOT_FOUND', 'SLOT_CARDINALITY', 'SLOT_INCOMPATIBLE'].includes(error?.message) ? error.message : 'DRAFT_INVALID' }
  }
}

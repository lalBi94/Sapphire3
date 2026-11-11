import { getPluginCapabilities, validatePluginDocument, PLUGIN_DIAGNOSTIC_CODES } from '../../../packages/plugin-sdk/src/index.js'
import { satisfiesVersionRange } from '../../../packages/plugin-sdk/src/version.js'
import { mathNatives } from '../logic/mathNatives.js'

const builtInOperationIds = Object.freeze(Object.keys(mathNatives))

// Retourne une copie JSON d'un manifeste pour isoler le registre des objets de l'appelant.
function cloneDocument(document) {
  try {
    return JSON.parse(JSON.stringify(document))
  } catch {
    return document
  }
}

// Vérifie les conflits d'identifiants globaux entre plugins et opérations natives intégrées.
export function findPluginConflicts(records, plugin, builtIns = builtInOperationIds) {
  const conflicts = []
  if (!Array.isArray(records)) return conflicts
  for (const record of records) {
    if (record?.id === plugin.id) conflicts.push({ code: 'PLUGIN_DUPLICATE_ID', message: `Plugin ${plugin.id} is already installed.` })
    const existing = validatePluginDocument(record?.document)
    if (!existing.ok) continue
    for (const operation of plugin.nativeOperations) {
      if (existing.plugin.nativeOperations.some((entry) => entry.id === operation.id)) {
        conflicts.push({ code: 'PLUGIN_DUPLICATE_OPERATION', message: `Native operation ${operation.id} is already provided by ${existing.plugin.id}.` })
      }
    }
  }
  for (const operation of plugin.nativeOperations) {
    if (builtIns.includes(operation.id)) conflicts.push({ code: 'PLUGIN_DUPLICATE_OPERATION', message: `Native operation ${operation.id} conflicts with a built-in operation.` })
  }
  return conflicts
}

// Installe un manifeste local après validation et contrôle des conflits.
export function installPluginRecord(records, document, options = {}) {
  const current = Array.isArray(records) ? records : []
  if (current.length >= 64) return { ok: false, code: 'PLUGIN_LIMIT_REACHED', message: 'Too many installed plugins.', records: current }
  const validation = validatePluginDocument(document)
  if (!validation.ok) return { ok: false, code: validation.code, message: validation.message, diagnostics: validation.diagnostics, records: current }
  const conflicts = findPluginConflicts(current, validation.plugin, options.builtInOperationIds)
  if (conflicts.length > 0) return { ok: false, code: conflicts[0].code, message: conflicts[0].message, diagnostics: conflicts, records: current }
  const record = {
    id: validation.plugin.id,
    document: cloneDocument(validation.plugin),
    enabled: options.enabled !== false,
    installedAt: Number.isFinite(options.now) ? options.now : Date.now(),
    sourceName: typeof options.sourceName === 'string' ? options.sourceName.slice(0, 200) : null,
  }
  return { ok: true, record, records: [...current, record] }
}

// Active ou désactive un plugin installé sans modifier son document.
export function setPluginRecordEnabled(records, pluginId, enabled) {
  const current = Array.isArray(records) ? records : []
  if (!current.some((record) => record?.id === pluginId)) return { ok: false, code: 'PLUGIN_NOT_FOUND', records: current }
  return {
    ok: true,
    records: current.map((record) => record?.id === pluginId ? { ...record, enabled: Boolean(enabled) } : record),
  }
}

// Retire proprement un plugin du registre local.
export function removePluginRecord(records, pluginId) {
  const current = Array.isArray(records) ? records : []
  if (!current.some((record) => record?.id === pluginId)) return { ok: false, code: 'PLUGIN_NOT_FOUND', records: current }
  return { ok: true, records: current.filter((record) => record?.id !== pluginId) }
}

// Normalise les enregistrements relus du stockage, sans supprimer un document invalide.
export function normalizePluginRecords(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const records = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string' || seen.has(candidate.id)) continue
    if (!candidate.document || typeof candidate.document !== 'object') continue
    seen.add(candidate.id)
    records.push({
      id: candidate.id,
      document: candidate.document,
      enabled: candidate.enabled !== false,
      installedAt: Number.isFinite(candidate.installedAt) ? candidate.installedAt : 0,
      sourceName: typeof candidate.sourceName === 'string' ? candidate.sourceName : null,
    })
  }
  return records.slice(0, 64)
}

// Vérifie la compatibilité de l'hôte avec un manifeste déjà validé.
export function checkPluginCompatibility(plugin, hostVersion = 'dev') {
  const errors = []
  if (hostVersion !== 'dev' && plugin.minAppVersion && !satisfiesVersionRange(hostVersion, `>=${plugin.minAppVersion}`)) {
    errors.push({ code: 'PLUGIN_HOST_INCOMPATIBLE', message: `Plugin ${plugin.id} requires Sapphire ${plugin.minAppVersion} or newer.` })
  }
  return errors
}

// Ordonne les plugins actifs après leurs dépendances, puis signale les cycles.
function orderActiveRecords(activeRecords, byId) {
  const indegree = new Map(activeRecords.map((record) => [record.id, 0]))
  const dependents = new Map(activeRecords.map((record) => [record.id, []]))
  for (const record of activeRecords) {
    for (const dependency of record.document.dependencies ?? []) {
      if (dependency.optional) continue
      if (!byId.has(dependency.id) || !indegree.has(dependency.id)) continue
      indegree.set(record.id, (indegree.get(record.id) ?? 0) + 1)
      dependents.get(dependency.id).push(record.id)
    }
  }
  const queue = activeRecords.filter((record) => indegree.get(record.id) === 0).map((record) => record.id).sort()
  const order = []
  while (queue.length > 0) {
    const id = queue.shift()
    order.push(id)
    for (const dependent of dependents.get(id) ?? []) {
      indegree.set(dependent, indegree.get(dependent) - 1)
      if (indegree.get(dependent) === 0) queue.push(dependent)
      queue.sort()
    }
  }
  const cyclic = activeRecords.filter((record) => !order.includes(record.id)).map((record) => record.id)
  return { order, cyclic }
}

// Résout les plugins installés : validation, dépendances, compatibilité et ordre d'activation.
export function resolvePluginRecords(records, options = {}) {
  const hostVersion = typeof options.hostVersion === 'string' ? options.hostVersion : 'dev'
  const normalized = normalizePluginRecords(records)
  const resolved = []
  const validById = new Map()
  for (const record of normalized) {
    const validation = validatePluginDocument(record.document)
    const capabilities = validation.ok ? getPluginCapabilities(validation.plugin) : []
    const errors = validation.ok ? checkPluginCompatibility(validation.plugin, hostVersion) : [{
      code: validation.code,
      message: validation.message,
      diagnostics: validation.diagnostics,
    }]
    const entry = { ...record, validation, capabilities, errors: [...errors], warnings: [], missingDependencies: [], active: false }
    resolved.push(entry)
    if (validation.ok && record.enabled && errors.length === 0) validById.set(record.id, entry)
  }
  const activeCandidates = []
  for (const entry of resolved) {
    if (!entry.validation.ok || !entry.enabled || entry.errors.length > 0) continue
    for (const dependency of entry.validation.plugin.dependencies ?? []) {
      const target = validById.get(dependency.id)
      if (!target) {
        const diagnostic = {
          code: dependency.optional ? 'PLUGIN_DEPENDENCY_OPTIONAL_MISSING' : PLUGIN_DIAGNOSTIC_CODES.dependencyMissing,
          message: `Missing dependency: ${dependency.id} ${dependency.version}.`,
        }
        if (dependency.optional) entry.warnings.push(diagnostic)
        else {
          entry.errors.push(diagnostic)
          entry.missingDependencies.push(dependency.id)
        }
        continue
      }
      if (!satisfiesVersionRange(target.validation.plugin.version, dependency.version)) {
        const diagnostic = {
          code: PLUGIN_DIAGNOSTIC_CODES.dependencyVersion,
          message: `Dependency ${dependency.id} requires ${dependency.version}, found ${target.validation.plugin.version}.`,
        }
        if (dependency.optional) entry.warnings.push(diagnostic)
        else {
          entry.errors.push(diagnostic)
          entry.missingDependencies.push(dependency.id)
        }
      }
    }
    if (entry.errors.length === 0) activeCandidates.push(entry)
  }
  const byId = new Map(activeCandidates.map((entry) => [entry.id, entry]))
  const ordered = orderActiveRecords(activeCandidates, byId)
  for (const id of ordered.cyclic) {
    const entry = byId.get(id)
    if (entry) entry.errors.push({ code: PLUGIN_DIAGNOSTIC_CODES.dependencyCycle, message: `Dependency cycle involving ${id}.` })
  }
  const activeRecords = ordered.order.map((id) => byId.get(id)).filter(Boolean)
  for (const entry of activeRecords) entry.active = true
  return {
    records: resolved,
    activeRecords,
    activeDocuments: activeRecords.map((entry) => entry.validation.plugin),
    errors: resolved.flatMap((entry) => entry.errors.map((error) => ({ pluginId: entry.id, ...error }))),
  }
}

// Indique si un plugin installé peut être activé, pour l'affichage des paramètres.
export function isPluginRecordActive(entry) {
  return entry?.active === true
}

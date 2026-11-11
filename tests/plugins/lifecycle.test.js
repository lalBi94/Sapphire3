import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findPluginConflicts,
  installPluginRecord,
  normalizePluginRecords,
  removePluginRecord,
  resolvePluginRecords,
  setPluginRecordEnabled,
} from '../../src/utils/plugins/pluginLifecycle.js'
import { readExamplePlugin } from './fixtures.js'

test('plugins : installation, activation, désactivation et désinstallation', () => {
  const voltmeter = readExamplePlugin('voltmeter')
  const installed = installPluginRecord([], voltmeter, { now: 100 })
  assert.equal(installed.ok, true)
  assert.equal(installed.records.length, 1)
  assert.equal(installed.record.enabled, true)
  const resolved = resolvePluginRecords(installed.records, { hostVersion: '0.1.0' })
  assert.equal(resolved.activeDocuments.length, 1)
  assert.equal(resolved.records[0].active, true)
  assert.deepEqual(resolved.records[0].capabilities, ['widgets'])

  const disabled = setPluginRecordEnabled(installed.records, voltmeter.id, false)
  assert.equal(disabled.ok, true)
  assert.equal(resolvePluginRecords(disabled.records, { hostVersion: '0.1.0' }).activeDocuments.length, 0)
  const removed = removePluginRecord(disabled.records, voltmeter.id)
  assert.equal(removed.ok, true)
  assert.deepEqual(removed.records, [])
})

test('plugins : conflits d’identifiants et d’opérations intégrées', () => {
  const clamp = readExamplePlugin('clamp')
  const first = installPluginRecord([], clamp)
  assert.equal(first.ok, true)
  const duplicate = installPluginRecord(first.records, clamp)
  assert.equal(duplicate.ok, false)
  assert.equal(duplicate.code, 'PLUGIN_DUPLICATE_ID')

  const builtIn = structuredClone(clamp)
  builtIn.id = 'org.example.builtin-conflict'
  builtIn.name = 'Built-in conflict'
  builtIn.nativeOperations[0].id = 'clamp'
  const conflict = installPluginRecord([], builtIn)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.code, 'PLUGIN_DUPLICATE_OPERATION')
  assert.ok(findPluginConflicts([], builtIn).some((entry) => entry.code === 'PLUGIN_DUPLICATE_OPERATION'))
})

test('plugins : compatibilité d’hôte, dépendances manquantes et versions', () => {
  const clamp = readExamplePlugin('clamp')
  const dependent = structuredClone(readExamplePlugin('voltmeter'))
  dependent.id = 'org.example.dependent'
  dependent.name = 'Dependent plugin'
  dependent.dependencies = [{ id: clamp.id, version: '^2.0.0' }]
  const installed = installPluginRecord(installPluginRecord([], clamp).records, dependent)
  assert.equal(installed.ok, true)
  const resolution = resolvePluginRecords(installed.records, { hostVersion: '0.1.0' })
  const entry = resolution.records.find((record) => record.id === dependent.id)
  assert.equal(entry.active, false)
  assert.ok(entry.errors.some((error) => error.code === 'PLUGIN_DEPENDENCY_VERSION'))
  assert.deepEqual(entry.missingDependencies, [clamp.id])

  const missing = structuredClone(dependent)
  missing.id = 'org.example.missing-dependency'
  missing.dependencies = [{ id: 'org.example.absent', version: '^1.0.0' }]
  const missingInstall = installPluginRecord([], missing)
  const missingResolution = resolvePluginRecords(missingInstall.records, { hostVersion: '0.1.0' })
  assert.ok(missingResolution.records[0].errors.some((error) => error.code === 'PLUGIN_DEPENDENCY_MISSING'))

  const oldHost = structuredClone(readExamplePlugin('voltmeter'))
  oldHost.id = 'org.example.future'
  oldHost.minAppVersion = '99.0.0'
  const oldInstall = installPluginRecord([], oldHost)
  const oldResolution = resolvePluginRecords(oldInstall.records, { hostVersion: '0.1.0' })
  assert.ok(oldResolution.records[0].errors.some((error) => error.code === 'PLUGIN_HOST_INCOMPATIBLE'))
})

test('plugins : ordre de dépendances, cycles et stockage invalide préservé', () => {
  const first = structuredClone(readExamplePlugin('voltmeter'))
  first.id = 'org.example.first'
  first.name = 'First'
  const second = structuredClone(readExamplePlugin('between'))
  second.id = 'org.example.second'
  second.name = 'Second'
  second.dependencies = [{ id: first.id, version: '^1.0.0' }]
  let records = installPluginRecord([], second).records
  records = installPluginRecord(records, first).records
  const resolution = resolvePluginRecords(records, { hostVersion: '0.1.0' })
  assert.deepEqual(resolution.activeDocuments.map((plugin) => plugin.id), [first.id, second.id])

  const cyclicA = structuredClone(first)
  cyclicA.id = 'org.example.cycle-a'
  cyclicA.dependencies = [{ id: 'org.example.cycle-b', version: '^1.0.0' }]
  const cyclicB = structuredClone(first)
  cyclicB.id = 'org.example.cycle-b'
  cyclicB.dependencies = [{ id: 'org.example.cycle-a', version: '^1.0.0' }]
  const cyclic = resolvePluginRecords(installPluginRecord(installPluginRecord([], cyclicA).records, cyclicB).records, { hostVersion: '0.1.0' })
  assert.equal(cyclic.activeDocuments.length, 0)
  assert.ok(cyclic.errors.some((error) => error.code === 'PLUGIN_DEPENDENCY_CYCLE'))

  const invalid = normalizePluginRecords([{ id: 'broken', document: { id: 'broken' }, enabled: true }, { id: 'broken', document: {}, enabled: true }, null])
  assert.equal(invalid.length, 1)
  const invalidResolution = resolvePluginRecords(invalid, { hostVersion: '0.1.0' })
  assert.equal(invalidResolution.records[0].active, false)
  assert.equal(invalidResolution.records[0].validation.ok, false)
  assert.equal(invalidResolution.activeDocuments.length, 0)
})

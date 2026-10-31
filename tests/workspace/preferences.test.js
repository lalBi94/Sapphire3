import test from 'node:test'
import assert from 'node:assert/strict'
import { readPreference, writePreference } from '../../src/services/preferences.js'

test('préférences : stockage indisponible signalé sans interrompre le document', () => {
  const previousWindow = globalThis.window
  const previousWarn = console.warn
  const warnings = []
  globalThis.window = { get localStorage() { throw new Error('Storage denied') } }
  console.warn = (...args) => warnings.push(args)
  try {
    assert.equal(readPreference('theme'), null)
    assert.doesNotThrow(() => writePreference('theme', 'sapphire'))
    assert.equal(warnings.length, 2)
  } finally {
    console.warn = previousWarn
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

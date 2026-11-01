import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBugReport } from '../../src/utils/bugReport.js'
import { analyzeProgram, createContextIndex } from '../../src/utils/logic/index.js'
import { debugFixture } from '../logic/fixtures.js'

// Reconstruit l'index exactement comme le fait le document du canvas.
function indexOf(project) {
  return createContextIndex(project, analyzeProgram(project))
}

test('rapport de bug : version, langue, cible et emplacement regroupés', () => {
  const project = debugFixture()
  const report = buildBugReport({ project, index: indexOf(project), target: { kind: 'node', id: 'local' }, language: 'fr', date: '2026-01-01T00:00:00.000Z' })
  assert.match(report, /^Sapphire 3 — bug report/)
  assert.match(report, /Language: fr/)
  assert.match(report, /Date: 2026-01-01T00:00:00.000Z/)
  assert.match(report, /Module: Debug \(m\)/)
  assert.match(report, /Path: Debug > start \(FunctionDeclaration\) > Block > x \(VariableDeclaration\)/)
  assert.match(report, /Node: VariableDeclaration "x" \(local\)/)
  assert.match(report, /Type: int/)
  assert.match(report, /Slots: initializer=1/)
  assert.match(report, /Modules: 1/)
  assert.match(report, /Diagnostics for the selection \(0\)/)
})

test('rapport de bug : les diagnostics réels apparaissent avec un code stable', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'one').properties.type = { kind: 'primitive', name: 'string' }
  const report = buildBugReport({ project, index: indexOf(project), target: { kind: 'node', id: 'local' } })
  assert.match(report, /Diagnostics: [1-9]/, 'au moins un diagnostic compté')
  assert.match(report, /\[(error|warning|info)\] [A-Z_]+/, 'un code de diagnostic est listé')
})

test('rapport de bug : cible absente sans plantage', () => {
  const project = debugFixture()
  const report = buildBugReport({ project, index: indexOf(project), target: null })
  assert.match(report, /Kind: none/)
  assert.match(report, /Modules: 1/)
  assert.match(report, /Diagnostics for the selection \(0\)/)
})

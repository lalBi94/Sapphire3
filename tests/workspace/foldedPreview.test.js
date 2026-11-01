import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex } from '../../src/utils/logic/index.js'
import { foldedPreviewLines } from '../../src/utils/nodeTree.js'
import { debugFixture } from '../logic/fixtures.js'

// Reconstruit l'index visuel comme le fait le document du canvas.
function indexOf(project) {
  return createContextIndex(project, analyzeProgram(project))
}

test('aperçu replié : premières instructions d’un bloc, dans l’ordre des slots', () => {
  const project = debugFixture()
  project.nodes.find((node) => node.id === 'unusedBody').children.statements = ['deadPrint']
  const index = indexOf(project)
  const preview = foldedPreviewLines(index, 'main', (node) => node.kind, 8)
  assert.equal(preview.lines[0].text, 'VariableDeclaration')
  assert.equal(preview.lines[0].depth, 0, 'le bloc conteneur n’occupe pas de ligne')
  assert.ok(preview.lines.some((line) => line.depth > 0), 'l’imbrication est conservée')
  assert.equal(preview.lines.length, 8)
  assert.ok(preview.hidden > 0, 'le reste est compté')
})

test('aperçu replié : le dépassement est compté sans être énuméré', () => {
  const preview = foldedPreviewLines(indexOf(debugFixture()), 'main', (node) => node.kind, 3)
  assert.equal(preview.lines.length, 3)
  assert.ok(preview.hidden > 0, 'les instructions au-delà de la limite sont comptées')
})

test('aperçu replié : un nœud sans contenu ou inconnu ne propose rien', () => {
  const index = indexOf(debugFixture())
  assert.deepEqual(foldedPreviewLines(index, 'unusedBody', (node) => node.kind), { lines: [], hidden: 0 })
  assert.deepEqual(foldedPreviewLines(index, 'one', (node) => node.kind), { lines: [], hidden: 0 })
  assert.deepEqual(foldedPreviewLines(index, 'missing', (node) => node.kind), { lines: [], hidden: 0 })
})

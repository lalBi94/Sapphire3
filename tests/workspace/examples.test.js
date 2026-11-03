import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { examples, exampleCategories } from '../../src/utils/examples.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { analyzeProgram, simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'

const expectedOutput = {
  fibonacci: ['55'],
  sorting: ['1', '3', '5', '8'],
  quickSort: ['1', '3', '5', '8'],
  coinChange: ['6'],
  arrays: ['7', '4'],
  recursion: ['120'],
  imports: ['25'],
  foreach: ['3', '1', '4', '1', '5'],
  pointers: ['3', '8', '8', '3'],
  higherOrder: ['42'],
  maths: ['7', '3', '9', '9'],
}

test('bibliothèque d’exemples : chaque projet est valide, analysable et s’exécute', () => {
  assert.deepEqual(examples.map((example) => example.id), ['fibonacci', 'sorting', 'quickSort', 'coinChange', 'arrays', 'recursion', 'imports', 'foreach', 'pointers', 'higherOrder', 'maths'])
  for (const example of examples) {
    assert.ok(exampleCategories.some((category) => category.id === example.category), `${example.id}: catégorie connue`)
    const workspace = deserializeWorkspace(JSON.stringify(example.build()))
    assert.ok(workspace.presentation.cards.length >= 1, example.id)
    assert.ok(workspace.presentation.cards.some((card) => card.type === 'comment' && card.text.length > 0), `${example.id}: annotation Comment`)
    const analysis = analyzeProgram(workspace.project)
    assert.deepEqual(analysis.diagnostics, [], example.id)
    const result = simulateProgram(workspace.project)
    assert.equal(result.ok, true, `${example.id}: ${result.errorCode ?? ''}`)
    assert.deepEqual(result.output, expectedOutput[example.id], example.id)
  }
})

test('exemples multi-modules quickSort et coinChange : JavaScript et Python reproduisent la simulation', () => {
  for (const id of ['quickSort', 'coinChange']) {
    const project = examples.find((example) => example.id === id).build().project
    const expected = simulateProgram(project).output.map((line) => `${line}\n`).join('')
    const javascript = transpileProgram(project)
    assert.equal(javascript.ok, true, `${id}: JavaScript ${javascript.diagnostics.map((entry) => entry.code).join(' ')}`)
    const jsOutput = execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8', timeout: 3000 }).replace(/\r\n/g, '\n')
    assert.equal(jsOutput, expected, id)
    const python = transpileProgram(project, { target: 'python' })
    assert.equal(python.ok, true, `${id}: Python ${python.diagnostics.map((entry) => entry.code).join(' ')}`)
    const pyOutput = execFileSync('python', ['-c', python.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).replace(/\r\n/g, '\n')
    assert.equal(pyOutput, expected, id)
  }
})

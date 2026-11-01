import test from 'node:test'
import assert from 'node:assert/strict'
import { createContextIndex } from '../../src/utils/logic/index.js'
import { normalizeSearchText, nodeDisplayName, searchNodes } from '../../src/utils/nodeSearch.js'
import { translate } from '../../src/utils/translations.js'
import { intType, node, program, root } from '../logic/fixtures.js'

const en = (key, values) => translate('en', key, values)
const fr = (key, values) => translate('fr', key, values)

// Document sans analyse : la recherche ne doit dépendre ni des types résolus ni de React.
function fixture() {
  const source = program('math', 'app')
  root(source, 'math', 'counter', 'VariableDeclaration', { name: 'compteurGlobal', type: intType })
  root(source, 'math', 'main', 'FunctionDeclaration', { name: 'traiteDonnees', type: intType }, { parameters: [], body: 'mainBody' })
  node(source, 'math', 'mainBody', 'Block', {}, { statements: ['nested'] })
  node(source, 'math', 'nested', 'VariableDeclaration', { name: 'xTemp', type: intType })
  root(source, 'app', 'evaluation', 'ExpressionStatement', {}, { expression: 'plainValue' })
  node(source, 'app', 'plainValue', 'Literal', { value: 7, type: intType })
  root(source, 'app', 'valueCopy', 'VariableDeclaration', { name: 'valueCopy', type: intType })
  root(source, 'app', 'scoreTotal', 'VariableDeclaration', { name: 'scoreTotal', type: intType })
  root(source, 'app', 'totalScore', 'VariableDeclaration', { name: 'totalScore', type: intType })
  node(source, 'ghost', 'orphan', 'VariableDeclaration', { name: 'fantome', type: intType })
  return createContextIndex(source)
}

test('recherche : un nom saisi retrouve le bloc avec son module, sa construction et son résumé', () => {
  const results = searchNodes('compt', fixture(), en)
  assert.equal(results.length, 1)
  const [entry] = results
  assert.equal(entry.nodeId, 'counter')
  assert.equal(entry.moduleId, 'math')
  assert.equal(entry.moduleName, 'math')
  assert.equal(entry.name, 'compteurGlobal')
  assert.equal(entry.kindLabel, 'Variable')
  assert.equal(entry.named, true)
  assert.equal(typeof entry.summary, 'string')
})

test('recherche : les constructions sans nom restent atteignables par leur type', () => {
  const index = fixture()
  const results = searchNodes('evaluate', index, en)
  assert.deepEqual(results.map((entry) => entry.nodeId), ['evaluation'])
  assert.equal(results[0].named, false)
  assert.equal(nodeDisplayName(index.nodes.get('evaluation'), en), 'Evaluate a value')
})

test('recherche : casse et accents ignorés, comme un clavier français', () => {
  assert.equal(normalizeSearchText('Évaluer Une Valeur'), 'evaluer une valeur')
  assert.equal(normalizeSearchText(undefined), '')
  const index = fixture()
  assert.deepEqual(searchNodes('EVALUER', index, fr).map((entry) => entry.nodeId), ['evaluation'])
  assert.deepEqual(searchNodes('etapes', index, fr).map((entry) => entry.nodeId), ['mainBody'])
})

test('recherche : le chemin affiché remonte les ancêtres jusqu’au module', () => {
  const [entry] = searchNodes('xtemp', fixture(), en)
  assert.equal(entry.trail, 'math › traiteDonnees › Steps')
})

test('recherche : un bloc dont le module est absent de la source est ignoré', () => {
  assert.deepEqual(searchNodes('fantome', fixture(), en), [])
  assert.deepEqual(searchNodes('   ', fixture(), en), [])
  assert.deepEqual(searchNodes('variable', null, en), [])
})

test('recherche : les noms saisis d’abord, puis la position du terme, ordre stable', () => {
  const index = fixture()
  assert.deepEqual(searchNodes('score', index, en).map((entry) => entry.name), ['scoreTotal', 'totalScore'])
  const byValue = searchNodes('value', index, en)
  assert.equal(byValue[0].name, 'valueCopy')
  assert.equal(byValue[1].nodeId, 'plainValue')
})

test('recherche : la liste reste bornée quel que soit le nombre de blocs', () => {
  const source = program('big')
  for (let position = 0; position < 120; position += 1) {
    node(source, 'big', `item${position}`, 'VariableDeclaration', { name: `item${position}`, type: intType })
  }
  assert.equal(searchNodes('item', createContextIndex(source), en).length, 100)
})

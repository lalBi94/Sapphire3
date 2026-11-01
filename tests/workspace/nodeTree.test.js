import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeProgram, createContextIndex } from '../../src/utils/logic/index.js'
import { expandableNodeIdsByModule, expandAllNodeIds, isFullyExpanded } from '../../src/utils/nodeTree.js'
import { twoModules, debugFixture } from '../logic/fixtures.js'

// Reconstruit l'index visuel exactement comme le fait le document du canvas.
function indexOf(project) {
  return createContextIndex(project, analyzeProgram(project))
}

test('nœuds dépliables : uniquement ceux qui contiennent vraiment un autre nœud', () => {
  const index = indexOf(twoModules())
  const expandable = expandableNodeIdsByModule(index)
  assert.deepEqual([...expandable.keys()], ['math', 'app'])
  assert.deepEqual(expandable.get('math'), ['answer'])
  assert.deepEqual(expandable.get('app'), ['result'])
})

test('nœuds dépliables : les slots null et les listes vides ne comptent pas comme un contenu', () => {
  const expandable = expandableNodeIdsByModule(indexOf(debugFixture())).get('m')
  assert.deepEqual([...expandable].sort(), ['branch', 'call', 'callPrint', 'condition', 'deadPrint', 'g', 'increment', 'inner', 'local', 'main', 'mainBody', 'printAfter', 'product', 'returnTwice', 'sum', 'twice', 'twiceBody', 'unused'].sort())
  assert.ok(!expandable.includes('returnMain'), 'un retour sans argument reste repliable')
  assert.ok(!expandable.includes('unusedBody'), 'une liste d’étapes vide n’a rien à déplier')
  assert.ok(!expandable.includes('one'), 'une littérale reste une feuille')
})

test('tout déplier et tout replier : calculs de liste et état de la bascule', () => {
  assert.deepEqual(expandAllNodeIds(['leaf', 'a'], ['a', 'b']), ['leaf', 'a', 'b'], 'les choix déjà faits sont conservés')
  assert.deepEqual(expandAllNodeIds(undefined, ['a']), ['a'])
  assert.equal(isFullyExpanded(['a', 'b', 'leaf'], ['a', 'b']), true, 'les feuilles peuvent rester repliées')
  assert.equal(isFullyExpanded(['a'], ['a', 'b']), false)
  assert.equal(isFullyExpanded(['a', 'b'], []), false, 'rien à déplier ne se dit jamais tout déplié')
})

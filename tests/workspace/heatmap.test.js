import test from 'node:test'
import assert from 'node:assert/strict'
import { executionCounts, heatLevels, ancestorCounts } from '../../src/utils/executionHeat.js'

test('comptage : chaque passage dans la trace est additionné par nœud', () => {
  const counts = executionCounts(['a', 'loop', 'body', 'loop', 'body', 'loop'])
  assert.equal(counts.get('loop'), 3)
  assert.equal(counts.get('body'), 2)
  assert.equal(counts.get('a'), 1)
  assert.equal(counts.get('never'), undefined)
  assert.equal(executionCounts([]).size, 0)
  assert.equal(executionCounts(['a', 42, null]).get('a'), 1, 'les entrées non textuelles sont ignorées')
})

test('niveaux : 0 pour un nœud jamais exécuté, 4 pour le plus exécuté', () => {
  const big = heatLevels(executionCounts([...Array(1000).fill('loop'), 'once']))
  assert.equal(big.get('loop'), 4, 'le maximum est au niveau le plus haut')
  assert.equal(big.get('once'), 1, 'un passage isolé reste froid face à une boucle chaude')
  const small = heatLevels(executionCounts(['a', 'b', 'b']))
  assert.equal(small.get('b'), 4)
  assert.ok(small.get('a') >= 1 && small.get('a') < 4)
  assert.equal(small.get('never'), undefined, 'seuls les nœuds comptés ont un niveau')
})

test('niveaux : une seule exécution générale ne s’emballe pas', () => {
  const levels = heatLevels(executionCounts(['a', 'b']))
  assert.equal(levels.get('a'), 1)
  assert.equal(levels.get('b'), 1)
  assert.deepEqual([...heatLevels(new Map()).values()], [])
})

test('ancêtres : une boucle ou un bloc hérite du maximum de son contenu', () => {
  const index = { parents: new Map([['body', [{ kind: 'node', id: 'loop' }]], ['loop', [{ kind: 'node', id: 'block' }]], ['block', [{ kind: 'module', id: 'm' }]]]) }
  const propagated = ancestorCounts(executionCounts(['body', 'body', 'body', 'loop']), index)
  assert.equal(propagated.get('body'), 3)
  assert.equal(propagated.get('loop'), 3, 'la boucle reflète ses itérations')
  assert.equal(propagated.get('block'), 3)
  assert.equal(propagated.get('m'), undefined, 'un module n’hérite pas')
  assert.deepEqual([...ancestorCounts(new Map(), index).keys()], [])
})

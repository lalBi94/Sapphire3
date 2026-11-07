import test from 'node:test'
import assert from 'node:assert/strict'
import { cardCategories, moduleTypes } from '../../src/utils/moduleTypes.js'

test('catégories de création : chaque carte est proposée exactement une fois', () => {
  const types = cardCategories.flatMap((category) => category.types)
  assert.deepEqual([...types].sort(), Object.keys(moduleTypes).sort())
  assert.equal(new Set(types).size, types.length)
  for (const category of cardCategories) {
    assert.ok(category.id)
    assert.ok(category.labelKey)
    assert.ok(category.types.length > 0)
  }
})

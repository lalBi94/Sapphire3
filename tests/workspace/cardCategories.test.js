import test from 'node:test'
import assert from 'node:assert/strict'
import { cardCategories, moduleTypes } from '../../src/utils/moduleTypes.js'

test('catégories de création : chaque carte est proposée exactement une fois', () => {
  const types = cardCategories.flatMap((category) => category.types)
  const staticTypes = Object.keys(moduleTypes).filter((type) => type !== 'pluginWidget')
  assert.deepEqual([...types].sort(), staticTypes.sort())
  assert.equal(new Set(types).size, types.length)
  for (const category of cardCategories) {
    assert.ok(category.id)
    assert.ok(category.labelKey)
    assert.ok(category.types.length > 0)
    if (category.groups) {
      const grouped = category.groups.flatMap((group) => group.types)
      assert.deepEqual([...grouped].sort(), [...category.types].sort(), `${category.id}: sous-catégories complètes`)
      assert.equal(new Set(grouped).size, grouped.length, `${category.id}: aucune carte en double`)
      for (const group of category.groups) {
        assert.ok(group.id)
        assert.ok(group.labelKey)
        assert.ok(group.types.length > 0)
      }
    }
  }
})

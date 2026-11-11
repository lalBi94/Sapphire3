import test from 'node:test'
import assert from 'node:assert/strict'
import { cardCategories, moduleTypes } from '../../src/utils/moduleTypes.js'

// Rassemble récursivement les types d'un groupe de widgets.
function groupTypes(group) {
  return Array.isArray(group.groups) ? group.groups.flatMap(groupTypes) : group.types
}

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
      const grouped = category.groups.flatMap(groupTypes)
      assert.deepEqual([...grouped].sort(), [...category.types].sort(), `${category.id}: sous-catégories complètes`)
      assert.equal(new Set(grouped).size, grouped.length, `${category.id}: aucune carte en double`)
      for (const group of category.groups) {
        assert.ok(group.id)
        assert.ok(group.labelKey)
        assert.ok(groupTypes(group).length > 0)
      }
    }
  }
})

test('catégories de création : les entrées ont des sous-catégories dédiées', () => {
  const widgets = cardCategories.find((category) => category.id === 'widgets')
  const inputs = widgets.groups.find((group) => group.id === 'inputs')
  assert.deepEqual(inputs.groups.map((group) => group.id), ['buttons', 'numbers', 'text', 'colors'])
  assert.deepEqual(inputs.groups.flatMap((group) => group.types), ['toggleButton', 'holdButton', 'numberInput', 'floatInput', 'stringInput', 'rgbPicker', 'rgbaPicker'])
})

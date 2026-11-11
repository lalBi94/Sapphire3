import test from 'node:test'
import assert from 'node:assert/strict'
import { applyKeybind, clearKeybind, defaultKeybinds, findKeybindConflicts, keybindActions, normalizeShortcut, parseKeybinds, resetAllKeybinds, resetKeybind, resolveKeybinds, serializeKeybinds, shortcutFromEvent } from '../../src/utils/keybinds.js'

test('raccourcis : les valeurs par défaut sont normalisées, uniques et couvrent les actions attendues', () => {
  const expected = {
    'workspace.new': 'Ctrl+N', 'workspace.open': 'Ctrl+O', 'workspace.save': 'Ctrl+S',
    'edit.undo': 'Ctrl+Z', 'edit.redo': 'Ctrl+Y', 'edit.copyNode': 'Ctrl+C', 'edit.cutNode': 'Ctrl+X', 'edit.pasteNode': 'Ctrl+V', 'edit.search': 'Ctrl+F',
    'navigation.center': 'Ctrl+Shift+F', 'navigation.zoom100': 'Ctrl+0', 'navigation.toggleMinimap': 'Ctrl+M',
    'execution.run': 'F5', 'execution.stop': 'Shift+F5', 'execution.debug': 'F6',
  }
  assert.deepEqual(defaultKeybinds, expected)
  assert.equal(new Set(Object.values(defaultKeybinds)).size, Object.keys(defaultKeybinds).length)
  for (const action of keybindActions) assert.equal(normalizeShortcut(action.defaultShortcut), action.defaultShortcut, action.id)
  assert.deepEqual(findKeybindConflicts(defaultKeybinds), [])
})

test('raccourcis : normalisation des événements, des modificateurs et des touches spéciales', () => {
  assert.equal(shortcutFromEvent({ key: 'f', ctrlKey: true }), 'Ctrl+F')
  assert.equal(shortcutFromEvent({ key: 'F', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+F')
  assert.equal(shortcutFromEvent({ key: 'F5', shiftKey: true }), 'Shift+F5')
  assert.equal(shortcutFromEvent({ key: '0', ctrlKey: true }), 'Ctrl+0')
  assert.equal(shortcutFromEvent({ key: ' ', altKey: true }), 'Alt+Space')
  assert.equal(shortcutFromEvent({ key: 'f', metaKey: true }), 'Ctrl+F')
  assert.equal(shortcutFromEvent({ key: 'f', ctrlKey: true, repeat: true }), null)
  assert.equal(shortcutFromEvent({ key: 'Control', ctrlKey: true }), null)
  assert.equal(normalizeShortcut('shift+ctrl+f'), 'Ctrl+Shift+F')
  assert.equal(normalizeShortcut('Ctrl + Alt + ArrowLeft'), 'Ctrl+Alt+ArrowLeft')
  assert.equal(normalizeShortcut('Ctrl+Shift'), null)
  assert.equal(normalizeShortcut('Ctrl+F+O'), null)
})

test('raccourcis : conflits refusés, suppression et restauration', () => {
  const bindings = { ...defaultKeybinds }
  const conflict = applyKeybind(bindings, 'workspace.new', 'Ctrl+O')
  assert.equal(conflict.ok, false)
  assert.equal(conflict.code, 'KEYBIND_CONFLICT')
  assert.equal(conflict.conflictId, 'workspace.open')

  const changed = applyKeybind(bindings, 'workspace.save', 'Ctrl+Alt+S')
  assert.equal(changed.ok, true)
  assert.equal(changed.bindings['workspace.save'], 'Ctrl+Alt+S')
  assert.equal(applyKeybind(changed.bindings, 'workspace.save', 'not a key').ok, false)

  const cleared = clearKeybind(changed.bindings, 'workspace.save')
  assert.equal(cleared.ok, true)
  assert.equal(cleared.bindings['workspace.save'], '')
  assert.equal(resetKeybind(cleared.bindings, 'workspace.save').bindings['workspace.save'], 'Ctrl+S')
  assert.deepEqual(resetAllKeybinds(), defaultKeybinds)
})

test('raccourcis : stockage des seules personnalisations, données invalides et doublons écartés', () => {
  const custom = applyKeybind({ ...defaultKeybinds }, 'workspace.save', 'Ctrl+Alt+S').bindings
  assert.deepEqual(JSON.parse(serializeKeybinds(custom)), { 'workspace.save': 'Ctrl+Alt+S' })
  assert.deepEqual(parseKeybinds('{'), {})
  assert.deepEqual(parseKeybinds('[]'), {})

  const restored = resolveKeybinds(JSON.parse(serializeKeybinds(custom)))
  assert.equal(restored['workspace.save'], 'Ctrl+Alt+S')
  assert.equal(restored['workspace.new'], 'Ctrl+N')

  const duplicate = resolveKeybinds({ 'workspace.new': 'Ctrl+S', 'workspace.save': 'Ctrl+S' })
  const conflicts = findKeybindConflicts(duplicate)
  assert.deepEqual(conflicts, [])
  assert.equal(resolveKeybinds({ 'workspace.new': 'Ctrl+S' })['workspace.open'], 'Ctrl+O')
  assert.equal(resolveKeybinds({ 'workspace.new': 'Ctrl+S' })['workspace.new'], 'Ctrl+S')
})

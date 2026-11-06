import test from 'node:test'
import assert from 'node:assert/strict'
import { activeNotification, normalizeNotification, reduceNotifications } from '../../src/utils/notifications.js'

function add(state, input, id, now) {
  return reduceNotifications(state, { type: 'notify', notification: normalizeNotification(input, id, now) })
}

test('notifications : priorités et durées par défaut', () => {
  const error = normalizeNotification({ type: 'error', message: 'boom' }, 'e', 1000)
  const info = normalizeNotification({ type: 'info', message: 'hello' }, 'i', 1000)
  assert.equal(error.priority, 100)
  assert.equal(error.duration, 0)
  assert.equal(info.priority, 30)
  assert.ok(info.duration > 0)
})

test('notifications : la priorité choisit la bulle visible, puis l’ancienneté', () => {
  let state = { items: [], history: [] }
  state = add(state, { type: 'info', message: 'first' }, 'a', 1000)
  state = add(state, { type: 'success', message: 'second' }, 'b', 1001)
  assert.equal(activeNotification(state.items).id, 'b')
  state = add(state, { type: 'error', message: 'urgent' }, 'c', 1002)
  assert.equal(activeNotification(state.items).id, 'c')
  state = reduceNotifications(state, { type: 'dismiss', id: 'c' })
  assert.equal(activeNotification(state.items).id, 'b')
})

test('notifications : même clé remplacée, doublon rapproché ignoré', () => {
  let state = { items: [], history: [] }
  state = add(state, { type: 'loading', message: 'working', key: 'job', duration: 0 }, 'a', 1000)
  state = add(state, { type: 'success', message: 'done', key: 'job' }, 'b', 1500)
  assert.equal(state.items.length, 1)
  assert.equal(state.items[0].id, 'a')
  assert.equal(state.items[0].type, 'success')
  assert.equal(state.history.length, 1)
  assert.equal(state.history[0].key, 'job')
  const duplicate = add(state, { type: 'success', message: 'done' }, 'c', 2000)
  assert.equal(duplicate, state)
})

test('notifications : fermeture, purge de session et limite d’historique', () => {
  let state = { items: [], history: [] }
  for (let index = 0; index < 23; index += 1) state = add(state, { type: 'info', message: `m${index}` }, `n${index}`, 1000 + index * 10)
  assert.equal(state.items.length, 23)
  assert.equal(state.history.length, 20)
  state = reduceNotifications(state, { type: 'dismiss', id: 'n10' })
  assert.equal(state.items.some((entry) => entry.id === 'n10'), false)
  state = reduceNotifications(state, { type: 'clear' })
  assert.deepEqual(state, { items: [], history: [] })
})

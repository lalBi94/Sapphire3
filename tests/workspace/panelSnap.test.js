import test from 'node:test'
import assert from 'node:assert/strict'
import { snapPanelToArea } from '../../src/utils/panelSnap.js'

const area = { areaWidth: 1000, areaHeight: 800 }

test('aimantation : un bord proche attire la fenêtre sur la position alignée', () => {
  const left = snapPanelToArea({ x: 20, y: 400, width: 300, height: 200, ...area })
  assert.deepEqual(left, { x: 8, y: 400 }, 'le bord gauche aligne la fenêtre')
  const right = snapPanelToArea({ x: 678, y: 20, width: 300, height: 200, ...area })
  assert.deepEqual(right, { x: 692, y: 8 }, 'le bord droit et le haut alignent la fenêtre')
  const bottom = snapPanelToArea({ x: 400, y: 585, width: 300, height: 200, ...area })
  assert.deepEqual(bottom, { x: 400, y: 592 }, 'le bord bas aligne la fenêtre')
})

test('aimantation : une position loin des bords reste inchangée', () => {
  assert.deepEqual(snapPanelToArea({ x: 300, y: 300, width: 300, height: 200, ...area }), { x: 300, y: 300 })
})

test('aimantation : le seuil est paramétrable et un bord unique attire encore', () => {
  assert.deepEqual(snapPanelToArea({ x: 40, y: 40, width: 300, height: 200, ...area, threshold: 10 }), { x: 40, y: 40 })
  const huge = snapPanelToArea({ x: 20, y: 20, width: 2000, height: 2000, ...area })
  assert.deepEqual(huge, { x: 8, y: 8 }, 'une fenêtre plus grande que l’espace n’a qu’un bord utile')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreFuzzyMatch } from '../../src/utils/fuzzySearch.js'
import { normalizeFuzzyText } from '../../src/utils/searchText.js'

test('recherche floue : normalisation des accents et de la ponctuation', () => {
  assert.equal(normalizeFuzzyText('Évaluer, l’opérateur !'), 'evaluer l operateur')
  assert.equal(normalizeFuzzyText('While-loop'), 'while loop')
  assert.equal(normalizeFuzzyText('Привет, мир!'), 'привет мир')
  assert.equal(normalizeFuzzyText('ब्लॉक खोजें'), 'ब्लॉक खोजें')
  assert.equal(normalizeFuzzyText(undefined), '')
})

test('recherche floue : exact, préfixe, sous-chaîne et sous-séquence', () => {
  const print = [{ text: 'Print', weight: 1 }]
  assert.equal(scoreFuzzyMatch('print', print), 1)
  assert.ok(scoreFuzzyMatch('pri', print) > 0.9)
  assert.ok(scoreFuzzyMatch('rin', print) > 0.7)
  assert.ok(scoreFuzzyMatch('prnt', print) > 0)
  assert.equal(scoreFuzzyMatch('', print), 0)
})

test('recherche floue : fautes de frappe et lettres inversées', () => {
  const whileLoop = [{ text: 'While loop', weight: 1 }]
  assert.ok(scoreFuzzyMatch('whle', whileLoop) > 0)
  assert.ok(scoreFuzzyMatch('wlo', whileLoop) > 0)
  assert.ok(scoreFuzzyMatch('whlie', whileLoop) > 0)
  assert.equal(scoreFuzzyMatch('xyz', whileLoop), 0)
})

test('recherche floue : plusieurs mots et champs pondérés', () => {
  const nativePow = [
    { text: 'pow', weight: 1 },
    { text: 'SP3 native operations', weight: 0.72 },
  ]
  assert.ok(scoreFuzzyMatch('native pow', nativePow) > 0)
  assert.ok(scoreFuzzyMatch('pow native', nativePow) > 0)
  const labelScore = scoreFuzzyMatch('print', [{ text: 'Print', weight: 1 }])
  const groupScore = scoreFuzzyMatch('print', [{ text: 'Print', weight: 0.7 }])
  assert.ok(labelScore > groupScore)
  assert.equal(scoreFuzzyMatch('print pow', [{ text: 'Print', weight: 1 }]), 0)
})

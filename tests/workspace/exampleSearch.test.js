import test from 'node:test'
import assert from 'node:assert/strict'
import { searchExamples } from '../../src/utils/exampleSearch.js'

const entries = [
  { id: 'trafficControl', labelKey: 'Traffic control', category: 'hard', subcategory: 'simulation' },
  { id: 'dnaAnalyzer', labelKey: 'Analyseur d’ADN', category: 'hard', subcategory: 'widgets' },
  { id: 'sortRace', labelKey: 'Course de tris', category: 'medium', subcategory: 'sorting' },
]

test('recherche d’exemples : requête vide et plusieurs mots-clés', () => {
  assert.equal(searchExamples(entries, ''), entries)
  assert.equal(searchExamples(entries, '   '), entries)
  assert.deepEqual(searchExamples(entries, 'course tri').map((entry) => entry.id), ['sortRace'])
  assert.deepEqual(searchExamples(entries, 'hard').map((entry) => entry.id), ['trafficControl', 'dnaAnalyzer'])
})

test('recherche d’exemples : nom, catégorie, sous-catégorie, identifiant et accents', () => {
  assert.deepEqual(searchExamples(entries, 'adn').map((entry) => entry.id), ['dnaAnalyzer'])
  assert.deepEqual(searchExamples(entries, 'widgets').map((entry) => entry.id), ['dnaAnalyzer'])
  assert.deepEqual(searchExamples(entries, 'trafficcontrol').map((entry) => entry.id), ['trafficControl'])
  assert.deepEqual(searchExamples(entries, 'simulation').map((entry) => entry.id), ['trafficControl'])
  assert.deepEqual(searchExamples(entries, 'aucun résultat'), [])
})

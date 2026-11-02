import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMathText, renderMath } from '../../src/utils/mathText.js'

test('texte mathématique : texte simple, blocs `$$ … $$` et texte autour', () => {
  assert.deepEqual(parseMathText(''), [])
  assert.deepEqual(parseMathText('une note'), [{ kind: 'text', value: 'une note' }])
  assert.deepEqual(parseMathText('avant $$ x^2 $$ après'), [
    { kind: 'text', value: 'avant ' },
    { kind: 'math', value: ' x^2 ' },
    { kind: 'text', value: ' après' },
  ])
  assert.deepEqual(parseMathText('$$ a $$ $$ b $$'), [
    { kind: 'math', value: ' a ' },
    { kind: 'text', value: ' ' },
    { kind: 'math', value: ' b ' },
  ])
})

test('texte mathématique : un `$$` non fermé reste du texte, sans perte de contenu', () => {
  assert.deepEqual(parseMathText('début $$ jamais fermé'), [{ kind: 'text', value: 'début $$ jamais fermé' }])
  assert.deepEqual(parseMathText('a $$ b $$ c $$ d'), [
    { kind: 'text', value: 'a ' },
    { kind: 'math', value: ' b ' },
    { kind: 'text', value: ' c $$ d' },
  ])
})

test('rendu mathématique : KaTeX produit du HTML, jamais d’exception ni de lien dangereux', () => {
  const html = renderMath('x^2 + 1')
  assert.equal(typeof html, 'string')
  assert.ok(html.includes('katex'), 'sortie KaTeX')

  // Contenu invalide : rendu en erreur lisible plutôt qu'un plantage.
  const broken = renderMath('\\frac{1}{')
  assert.equal(typeof broken, 'string')
  assert.ok(broken.length > 0)

  // `trust:false` neutralise les commandes pouvant produire un lien sortant.
  const href = renderMath('\\href{http://example.test}{x}')
  assert.ok(!href.includes('href="http'), 'aucun lien produit')
})

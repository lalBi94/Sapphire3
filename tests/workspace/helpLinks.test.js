import test from 'node:test'
import assert from 'node:assert/strict'
import { cardHelpTopic, moduleHelpTopic, nodeHelpTopic } from '../../src/utils/helpLinks.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { translations } from '../../src/utils/translations.js'

const wiki = 'https://github.com/lalBi94/Sapphire3/wiki/'

test('aide contextuelle : chaque carte possède un libellé, un résumé traduit et une URL en ligne', () => {
  for (const type of Object.keys(moduleTypes)) {
    const topic = cardHelpTopic(type)
    assert.ok(topic.url.startsWith(wiki), `${type}: ${topic.url}`)
    assert.ok(Object.hasOwn(translations.en, topic.titleKey), `${type}: ${topic.titleKey}`)
    assert.ok(Object.hasOwn(translations.en, topic.summaryKey), `${type}: ${topic.summaryKey}`)
  }
})

test('aide contextuelle : les cartes pointent vers la page et l’ancre attendues', () => {
  assert.equal(cardHelpTopic('module').url, `${wiki}Interface#cartes`)
  assert.equal(cardHelpTopic('class').url, `${wiki}Langage#classes`)
  assert.equal(cardHelpTopic('screen').url, `${wiki}Widgets#screen`)
  assert.equal(cardHelpTopic('progress').url, `${wiki}Widgets#progressbar`)
  assert.equal(cardHelpTopic('numberInput').url, `${wiki}Widgets#entrée-numérique`)
  assert.equal(cardHelpTopic('comment').url, `${wiki}Concepts#ce-qui-reste-hors-du-modèle-logique`)
  assert.equal(moduleHelpTopic({ kind: 'class' }).url, `${wiki}Langage#classes`)
  assert.equal(moduleHelpTopic({ kind: 'module' }).url, `${wiki}Interface#cartes`)
})

test('aide contextuelle : les opérations choisissent la section de langage correspondante', () => {
  assert.equal(nodeHelpTopic({ kind: 'MathCall' }).url, `${wiki}Langage#opérations-natives`)
  assert.equal(nodeHelpTopic({ kind: 'PrintStatement' }).url, `${wiki}Langage#opérations-natives`)
  assert.equal(nodeHelpTopic({ kind: 'FunctionDeclaration' }).url, `${wiki}Langage#constructions`)
  assert.equal(nodeHelpTopic({ kind: 'VariableDeclaration' }).url, `${wiki}Langage#constructions`)
  assert.equal(nodeHelpTopic({ kind: 'IfStatement' }).url, `${wiki}Langage#constructions`)
  assert.equal(nodeHelpTopic({ kind: 'BinaryExpression' }).url, `${wiki}Langage#règles-dexpression`)
  assert.equal(nodeHelpTopic({ kind: 'ArrayLiteral' }).url, `${wiki}Langage#types`)
  assert.equal(nodeHelpTopic({ kind: 'ThisExpression' }).url, `${wiki}Langage#classes`)
  assert.equal(nodeHelpTopic({ kind: 'LambdaExpression' }).url, `${wiki}Langage#lambdas-et-fermetures`)
  assert.equal(nodeHelpTopic({ kind: 'Hole' }).url, `${wiki}Langage#constructions`)
  for (const topic of [nodeHelpTopic({ kind: 'MathCall' }), nodeHelpTopic({ kind: 'Hole' }), nodeHelpTopic(null)]) {
    assert.ok(Object.hasOwn(translations.en, topic.summaryKey), topic.summaryKey)
  }
})

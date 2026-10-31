import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { translations, translate, failureLabel } from '../../src/utils/translations.js'
import { diagnosticCodes, nodeSchema, createProject, simulateProgram } from '../../src/utils/logic/index.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { kindLabel, slotLabel, diagnosticLabel, nodeSummary, typeLabel } from '../../src/components/LogicTree/logicLabels.js'
import { deserializeWorkspace } from '../../src/utils/workspaceFile.js'
import { exportWorkspaceFile, importWorkspaceFile, writeWorkspaceFile } from '../../src/services/workspaceFiles.js'

// Recense uniquement les sources applicatives, sans parcourir les dépendances ni les builds.
async function sourceFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(path)
  }
  return files
}

test('catalogue anglais/français : mêmes clés, textes présents et paramètres identiques', () => {
  assert.deepEqual(Object.keys(translations.en), Object.keys(translations.fr))
  for (const [key, english] of Object.entries(translations.en)) {
    const french = translations.fr[key]
    assert.equal(typeof french, 'string', key)
    assert.ok(english.trim() && french.trim(), key)
    assert.deepEqual(english.match(/\{\w+\}/g)?.sort(), french.match(/\{\w+\}/g)?.sort(), key)
  }
})

test('toutes les clés statiques des composants et services existent dans le catalogue', async () => {
  for (const path of await sourceFiles(new URL('../../src/', import.meta.url))) {
    if (path.pathname.endsWith('/translations.js')) continue
    const text = await readFile(path, 'utf8')
    for (const match of text.matchAll(/\bt\('([^']+)'|translate\(language, '([^']+)'/g)) {
      const key = match[1] ?? match[2]
      assert.ok(Object.hasOwn(translations.en, key), `${path.pathname}: ${key}`)
    }
  }
})

test('diagnostics, constructions, emplacements et cartes possèdent des libellés bilingues', () => {
  for (const code of Object.values(diagnosticCodes)) assert.ok(Object.hasOwn(translations.fr, `error.${code}`), code)
  for (const [kind, schema] of Object.entries(nodeSchema)) {
    assert.ok(Object.hasOwn(translations.fr, `kind.${kind}`), kind)
    for (const slot of Object.keys(schema.slots)) assert.ok(Object.hasOwn(translations.fr, `slot.${slot}`), slot)
  }
  for (const definition of Object.values(moduleTypes)) {
    assert.ok(Object.hasOwn(translations.fr, definition.labelKey))
    assert.ok(Object.hasOwn(translations.fr, definition.actionKey))
  }
})

test('traductions indépendantes : pas de langue globale, interpolation sans réinterpréter les données', () => {
  assert.equal(translate('fr', 'canvas.move', { name: '<b>{name}</b>' }), 'Déplacer <b>{name}</b>')
  assert.equal(translate('en', 'canvas.move', { name: 'Note' }), 'Move Note')
  assert.equal(translate('constructor', 'nav.run'), 'Run')
  assert.equal(translate('fr', 'toString'), 'toString')
  assert.equal(translate('fr', 'missing.key'), 'missing.key')
})

test('libellés des arbres : résumés et diagnostics traduits, noms et types source conservés', () => {
  const t = (key, values) => translate('fr', key, values)
  assert.equal(kindLabel('BreakStatement', t), 'Sortir de la boucle')
  assert.equal(slotLabel('children.arguments[2]', t), 'Entrées')
  assert.equal(slotLabel('properties.entryPoint', t), 'Point d’entrée')
  assert.equal(diagnosticLabel('NUMERIC_OVERFLOW', t), 'Ce nombre dépasse les bornes du type.')
  assert.equal(typeLabel({ kind: 'primitive', name: 'short uint' }, t), 'short uint')
  assert.equal(typeLabel(null, t), 'Type non défini')
  const index = { nodeTypes: new Map() }
  assert.equal(nodeSummary({ id: 'b', kind: 'Block', children: { statements: ['a', 'c'] } }, index, nodeSchema.Block, t), '2 étapes')
  assert.equal(nodeSummary({ id: 'b', kind: 'Block', children: { statements: ['a'] } }, index, nodeSchema.Block, t), '1 étape')
  assert.equal(nodeSummary({ id: 'v', kind: 'Literal', properties: { value: 'My text' } }, index, nodeSchema.Literal, t), 'My text · Type non défini')
})

test('erreurs de simulation et import : codes stables traduisibles sans analyser les messages internes', () => {
  const result = simulateProgram(createProject('empty'))
  assert.equal(result.errorCode, 'SIMULATION_ENTRY_MISSING')
  const t = (key, values) => translate('fr', key, values)
  assert.equal(failureLabel({ code: result.errorCode }, t), 'Aucun point d’entrée n’est désigné.')
  assert.throws(() => deserializeWorkspace('not json'), (failure) => {
    assert.equal(failure.code, 'WORKSPACE_JSON_INVALID')
    assert.equal(failureLabel(failure, t), 'Le fichier sélectionné n’est pas un JSON valide.')
    return true
  })
  assert.equal(failureLabel({ code: 'NEW_NATIVE_ERROR', message: 'English detail' }, t), 'L’opération a échoué (NEW_NATIVE_ERROR).')
})

test('fichiers : refus natifs et formats invalides exposent un code et des paramètres', async () => {
  await assert.rejects(exportWorkspaceFile('txt', '{}'), { code: 'EXPORT_FORMAT_INVALID' })
  await assert.rejects(importWorkspaceFile(['sp3'], 'fr'), { code: 'DESKTOP_REQUIRED' })
  await assert.rejects(writeWorkspaceFile('wrong.json', '{}'), (failure) => {
    assert.equal(failure.code, 'FILE_EXTENSION_INVALID')
    assert.equal(failureLabel(failure, (key, values) => translate('fr', key, values)), 'Choisissez un fichier .sp3.')
    return true
  })
})

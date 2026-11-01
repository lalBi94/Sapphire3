import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCustomThemes, hexColorValue, normalizeThemeColor, resolveCustomColors } from '../../src/utils/theme.js'

test('thèmes personnalisés : seules les entrées entièrement valides sont conservées', () => {
  const raw = JSON.stringify([
    { id: 'custom-1', name: ' Océan ', baseId: 'sapphire', mode: 'dark', overrides: { '--color-yellow': '#00FF88' } },
    { id: 'custom-2', name: 'Base inconnue', baseId: 'nope', mode: 'dark', overrides: {} },
    { id: 'custom-3', name: 'Mode douteux', baseId: 'neon', mode: 'blue', overrides: {} },
    { id: 'custom-1', name: 'Doublon', baseId: 'rose', mode: 'dark', overrides: {} },
    { id: 'custom-4', name: '   ', baseId: 'rose', mode: 'dark', overrides: {} },
    { id: 'custom-5', name: 'Couleurs filtrées', baseId: 'rose', mode: 'light', overrides: { '--color-text': '#abc', '--color-input': 'pas une couleur', '--color-black': '#11223344' } },
    'pas un objet',
  ])
  const themes = parseCustomThemes(raw, ['sapphire', 'neon', 'rose'])
  assert.deepEqual(themes.map((entry) => entry.id), ['custom-1', 'custom-5'])
  assert.equal(themes[0].name, 'Océan', 'le nom est nettoyé de ses espaces')
  assert.deepEqual(themes[0].overrides, { '--color-yellow': '#00ff88' }, 'la couleur est mise en minuscules')
  assert.deepEqual(themes[1].overrides, { '--color-black': '#11223344' }, 'seules les couleurs hexadécimales valides sont gardées')
})

test('thèmes personnalisés : une préférence illisible ou absente ne renvoie aucune erreur', () => {
  assert.deepEqual(parseCustomThemes(null, ['sapphire']), [])
  assert.deepEqual(parseCustomThemes('{ pas du json', ['sapphire']), [])
  assert.deepEqual(parseCustomThemes('{"id":"x"}', ['sapphire']), [])
})

test('couleurs de thème : conversion pour le sélecteur et transparence conservée', () => {
  assert.equal(hexColorValue('#F5D547'), '#f5d547')
  assert.equal(hexColorValue('#ffffff24'), '#ffffff', 'la transparence est retirée pour le sélecteur natif')
  assert.equal(hexColorValue('transparent'), '#000000')
  assert.equal(normalizeThemeColor('#ffffff24', '#112233'), '#11223324', 'la transparence de base est réappliquée')
  assert.equal(normalizeThemeColor('#ffffff', '#112233'), '#112233')
})

test('couleurs de thème : les choix remplacent la base sans en perdre', () => {
  const base = { '--color-black': '#000000', '--color-yellow': '#ffff00' }
  assert.deepEqual(resolveCustomColors(base, { '--color-yellow': '#00ff00' }), { '--color-black': '#000000', '--color-yellow': '#00ff00' })
  assert.deepEqual(resolveCustomColors(base, null), base)
})

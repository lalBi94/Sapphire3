import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLightColors, parseCustomThemes, hexColorValue, normalizeThemeColor, resolveCustomColors } from '../../src/utils/theme.js'

// Mélange une couleur translucide sur un fond opaque, comme une teinte douce.
function mixOver(color, background, alpha) {
  const channels = (value) => {
    const int = parseInt(value.slice(1, 7), 16)
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
  }
  const foreground = channels(color)
  const base = channels(background)
  return `#${foreground.map((part, index) => Math.round(part * alpha + base[index] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`
}

// Calcule le contraste WCAG entre deux couleurs hexadécimales.
function contrastRatio(first, second) {
  const luminance = (value) => {
    const int = parseInt(value.slice(1, 7), 16)
    const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((part) => {
      const amount = part / 255
      return amount <= 0.03928 ? amount / 12.92 : ((amount + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

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

test('thèmes clairs : le texte, les accents et les statuts restent lisibles', () => {
  const palettes = [
    { name: 'Sapphire', colors: { '--color-yellow': '#f5d547', '--color-violet': '#c4b1ff', '--mascot-filter': 'brightness(1)' } },
    { name: 'Void', colors: { '--color-yellow': '#b6ff2e', '--color-violet': '#6ee7ff', '--mascot-filter': 'sepia(1)' } },
    { name: 'Monochrome', colors: { '--color-yellow': '#e9e7f2', '--color-violet': '#b9b4c9', '--color-diagnostic': '#f2b8b8' } },
  ]
  const statusTokens = ['--color-diagnostic', '--color-pure', '--color-warning', '--color-error']
  for (const { name, colors } of palettes) {
    const light = buildLightColors(colors)
    const background = light['--color-black']
    assert.ok(contrastRatio(light['--color-text'], background) >= 7, `${name} : texte principal`)
    assert.ok(contrastRatio(light['--color-text-muted'], background) >= 4.5, `${name} : texte atténué`)
    assert.ok(contrastRatio(light['--color-yellow'], background) >= 4.5, `${name} : accent sur le fond`)
    assert.ok(contrastRatio(light['--color-violet'], background) >= 4.5, `${name} : accent secondaire sur le fond`)
    const raised = light['--color-anthracite-raised']
    assert.ok(contrastRatio(light['--color-yellow'], mixOver(light['--color-yellow'], raised, 0.16)) >= 4.5, `${name} : accent sur sa teinte douce`)
    assert.ok(contrastRatio(light['--color-violet'], mixOver(light['--color-violet'], raised, 0.16)) >= 4.5, `${name} : accent secondaire sur sa teinte douce`)
    assert.ok(contrastRatio(light['--color-on-primary'], light['--color-yellow']) >= 4.5, `${name} : texte sur l'accent`)
    assert.ok(contrastRatio(light['--color-on-primary'], light['--color-yellow-hover']) >= 4.5, `${name} : texte sur l'accent survolé`)
    assert.ok(contrastRatio(light['--color-on-primary'], light['--color-yellow-active']) >= 4.5, `${name} : texte sur l'accent actif`)
    for (const [token, value] of Object.entries(light)) {
      if (!token.startsWith('--color-node-') && !statusTokens.includes(token)) continue
      assert.ok(contrastRatio(value, background) >= 4.5, `${name} : ${token}`)
    }
  }
})

test('thèmes clairs : les propriétés non chromatiques sont conservées', () => {
  const dark = { '--mascot-filter': 'sepia(1) saturate(2)', '--color-yellow': '#f5d547', '--color-violet': '#c4b1ff' }
  const light = buildLightColors(dark)
  assert.equal(light['--mascot-filter'], dark['--mascot-filter'])
  assert.equal(light['--color-black'], '#f2f4f7')
  assert.notEqual(light['--color-yellow'], dark['--color-yellow'])
  assert.match(light['--color-yellow-soft'], /^#[0-9a-f]{8}$/, 'la teinte douce garde une transparence')
})

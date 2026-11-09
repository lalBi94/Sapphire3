// Outils purs du catalogue de thèmes personnalisés : couleurs éditables, conversion et validation.

// Clé de préférence commune aux thèmes créés par l'utilisateur.
export const customThemesKey = 'sapphire-custom-themes'

// Couleurs exposées à l'éditeur, groupées ; une couleur translucide garde la transparence de son thème de base.
export const themeColorGroups = [
  { labelKey: 'theme.colors.interface', tokens: [
    { token: '--color-black', labelKey: 'theme.color.background' },
    { token: '--color-anthracite', labelKey: 'theme.color.surface' },
    { token: '--color-anthracite-raised', labelKey: 'theme.color.surfaceRaised' },
    { token: '--color-input', labelKey: 'theme.color.input' },
    { token: '--color-text', labelKey: 'theme.color.text' },
    { token: '--color-text-muted', labelKey: 'theme.color.textMuted' },
    { token: '--color-border', labelKey: 'theme.color.border' },
    { token: '--color-border-hover', labelKey: 'theme.color.borderHover' },
    { token: '--color-on-primary', labelKey: 'theme.color.onPrimary' },
  ] },
  { labelKey: 'theme.colors.accents', tokens: [
    { token: '--color-yellow', labelKey: 'theme.color.primary' },
    { token: '--color-yellow-hover', labelKey: 'theme.color.primaryHover' },
    { token: '--color-yellow-active', labelKey: 'theme.color.primaryActive' },
    { token: '--color-violet', labelKey: 'theme.color.secondary' },
    { token: '--color-diagnostic', labelKey: 'theme.color.diagnostic' },
  ] },
]

const sixDigit = /^#[0-9a-f]{6}$/i
const eightDigit = /^#[0-9a-f]{8}$/i

// Renvoie la composante opaque d'une couleur pour un sélecteur de couleur natif.
export function hexColorValue(value) {
  return typeof value === 'string' && (sixDigit.test(value) || eightDigit.test(value)) ? value.slice(0, 7).toLowerCase() : '#000000'
}

// Reconstruit une couleur choisie en conservant la transparence éventuelle de la valeur de base.
export function normalizeThemeColor(baseValue, hexValue) {
  return `${hexValue.toLowerCase()}${typeof baseValue === 'string' && eightDigit.test(baseValue) ? baseValue.slice(7) : ''}`
}

// Superpose les couleurs choisies à celles du thème de base, sans en perdre aucune.
export function resolveCustomColors(baseColors, overrides) {
  return { ...baseColors, ...(overrides ?? {}) }
}

// Décompose une couleur hexadécimale 6 ou 8 chiffres en composantes RGB et alpha.
function parseHex(value) {
  if (typeof value !== 'string') return null
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value)
  if (!match) return null
  const int = parseInt(match[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: match[2] ? parseInt(match[2], 16) / 255 : 1 }
}

// Recompose une couleur hexadécimale, avec alpha seulement lorsqu'il n'est pas opaque.
function toHex({ r, g, b, a = 1 }) {
  const part = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}${a < 1 ? part(a * 255) : ''}`
}

// Convertit RGB en teinte, saturation et luminosité.
function rgbToHsl(r, g, b) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === red) h = (green - blue) / d + (green < blue ? 6 : 0)
  else if (max === green) h = (blue - red) / d + 2
  else h = (red - green) / d + 4
  return { h: h * 60, s, l }
}

// Convertit teinte, saturation et luminosité en RGB.
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

// Assombrit une couleur en conservant sa teinte, pour un usage lisible sur fond clair.
function darkenForLight(value, lightness) {
  const color = parseHex(value)
  if (!color) return value
  const { h, s } = rgbToHsl(color.r, color.g, color.b)
  return toHex({ ...hslToRgb(h, Math.min(1, s * 0.9), lightness / 100), a: color.a })
}

// Ajoute une transparence à une couleur sans changer sa teinte.
function withAlpha(value, alpha) {
  const color = parseHex(value)
  if (!color) return value
  return toHex({ ...color, a: alpha })
}

// Mélange une couleur translucide sur un fond opaque.
function blendOver(value, background, alpha) {
  const color = parseHex(value)
  const base = parseHex(background)
  if (!color || !base) return value
  return toHex({
    r: color.r * alpha + base.r * (1 - alpha),
    g: color.g * alpha + base.g * (1 - alpha),
    b: color.b * alpha + base.b * (1 - alpha),
    a: 1,
  })
}

// Calcule la luminance relative WCAG d'une couleur hexadécimale.
function relativeLuminance(value) {
  const color = parseHex(value)
  if (!color) return 0
  const channel = (part) => {
    const amount = part / 255
    return amount <= 0.03928 ? amount / 12.92 : ((amount + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

// Calcule le contraste WCAG entre deux couleurs.
function contrastRatio(first, second) {
  const a = relativeLuminance(first)
  const b = relativeLuminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// Assombrit une couleur jusqu'au contraste minimal demandé sur le fond clair.
function readableOnLight(value, background, minimum, start = 38) {
  let lightness = start
  let result = darkenForLight(value, lightness)
  while (contrastRatio(result, background) < minimum && lightness > 10) {
    lightness -= 1
    result = darkenForLight(value, lightness)
  }
  return result
}

// Assombrit une couleur jusqu'à rester lisible sur sa propre teinte douce.
function readableOnSoft(value, surface, minimum, start = 38) {
  let lightness = start
  let result = darkenForLight(value, lightness)
  while (contrastRatio(result, blendOver(result, surface, 0.16)) < minimum && lightness > 10) {
    lightness -= 1
    result = darkenForLight(value, lightness)
  }
  return result
}

// Choisit un accent lisible sur les surfaces claires et la couleur de texte à poser dessus.
function buildAccent(value, surface, text) {
  let lightness = 34
  let accent = darkenForLight(value, lightness)
  const bestText = () => Math.max(contrastRatio('#ffffff', accent), contrastRatio(text, accent))
  const readableOnSoftTint = () => contrastRatio(accent, blendOver(accent, surface, 0.16))
  while ((readableOnSoftTint() < 4.5 || bestText() < 4.5) && lightness > 10) {
    lightness -= 1
    accent = darkenForLight(value, lightness)
  }
  const darkText = contrastRatio(text, accent) >= contrastRatio('#ffffff', accent)
  return { accent, onAccent: darkText ? text : '#ffffff', darkText, lightness }
}

// Dérive une palette claire cohérente depuis la palette sombre d'un thème.
export function buildLightColors(dark = {}) {
  const background = '#f2f4f7'
  const surface = '#e9edf2'
  const text = '#151922'
  const primarySource = dark['--color-yellow'] ?? '#f5d547'
  const secondarySource = dark['--color-violet'] ?? '#c4b1ff'
  const { accent: primary, onAccent, darkText, lightness } = buildAccent(primarySource, surface, text)
  const secondary = readableOnSoft(secondarySource, surface, 4.5, 38)
  const node = (token, fallback) => readableOnLight(dark[token] ?? fallback, surface, 4.5, 38)
  const status = (token, fallback) => readableOnLight(dark[token] ?? fallback, surface, 4.5, 38)
  const step = darkText ? 1 : -1
  const hoverLightness = Math.min(50, Math.max(14, lightness + step * 5))
  const activeLightness = Math.min(50, Math.max(14, lightness + step * 9))
  return {
    ...dark,
    '--color-black': background,
    '--color-anthracite': '#ffffff',
    '--color-anthracite-raised': '#e9edf2',
    '--color-input': '#ffffff',
    '--color-module-surface': '#fffffffa',
    '--color-comment-surface': '#f7f4fb',
    '--color-text': text,
    '--color-text-muted': '#5b6472',
    '--color-border': '#00000024',
    '--color-border-hover': '#00000040',
    '--color-hover': '#0000000a',
    '--color-grid': '#0000000c',
    '--color-canvas-edge': '#ffffffcc',
    '--color-on-primary': onAccent,
    '--color-glass': '#fffffff5',
    '--color-glass-reflection': '#00000008',
    '--color-glass-highlight': '#0000000a',
    '--color-yellow': primary,
    '--color-yellow-hover': darkenForLight(primarySource, hoverLightness),
    '--color-yellow-active': darkenForLight(primarySource, activeLightness),
    '--color-yellow-soft': withAlpha(primary, 0.16),
    '--color-violet': secondary,
    '--color-violet-soft': withAlpha(secondary, 0.16),
    '--color-violet-border': withAlpha(secondary, 0.55),
    '--color-diagnostic': status('--color-diagnostic', '#f3b1a3'),
    '--color-pure': status('--color-pure', '#7fb069'),
    '--color-warning': status('--color-warning', '#d9a441'),
    '--color-error': status('--color-error', '#e05c6e'),
    '--color-node-variable': node('--color-node-variable', '#6f9ff5'),
    '--color-node-type': node('--color-node-type', '#5fc9d8'),
    '--color-node-function': node('--color-node-function', '#b58cf0'),
    '--color-node-parameter': node('--color-node-parameter', '#e39ad0'),
    '--color-node-condition': node('--color-node-condition', '#d9a441'),
    '--color-node-loop': node('--color-node-loop', '#e07a3f'),
    '--color-node-return': node('--color-node-return', '#e05c6e'),
    '--color-node-block': node('--color-node-block', '#7d8798'),
    '--color-node-statement': node('--color-node-statement', '#7fb069'),
    '--color-node-operator': node('--color-node-operator', '#4fb3a8'),
    '--color-node-value': node('--color-node-value', '#b5c95a'),
    '--color-node-array': node('--color-node-array', '#e8d06a'),
    '--color-node-incomplete': node('--color-node-incomplete', '#d8b184'),
    '--surface-reflection': 'linear-gradient(180deg, #00000004, transparent 30%)',
    '--shadow-panel': '0 12px 28px #0000001f, 0 -8px 18px -8px color-mix(in srgb, var(--color-primary) 18%, transparent), inset 0 0 0 1px #00000008',
    '--shadow-card': '0 2px 10px #00000014, inset 0 1px 0 #00000008',
  }
}

// Reconstruit une liste de thèmes personnalisés valides ; toute entrée douteuse est ignorée sans erreur.
export function parseCustomThemes(raw, presetIds = []) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set()
  const result = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const { id, name, baseId, mode, overrides } = entry
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    if (typeof name !== 'string' || !name.trim()) continue
    if (!presetIds.includes(baseId)) continue
    if (mode !== 'dark' && mode !== 'light') continue
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) continue
    const colors = {}
    for (const [token, value] of Object.entries(overrides)) {
      if (typeof value === 'string' && (sixDigit.test(value) || eightDigit.test(value))) colors[token] = value.toLowerCase()
    }
    seen.add(id)
    result.push({ id, name: name.trim(), baseId, mode, overrides: colors })
  }
  return result
}

export const presetThemes = [
  {
    id: 'sapphire',
    labelKey: 'theme.sapphire',
    mode: 'dark',
    colors: {
      '--color-black': '#0e0e12',
      '--color-anthracite': '#19191f',
      '--color-anthracite-raised': '#24242c',
      '--color-yellow': '#f5d547',
      '--color-yellow-hover': '#ffe777',
      '--color-yellow-active': '#dbba30',
      '--color-yellow-soft': '#f5d54718',
      '--color-violet': '#c4b1ff',
      '--color-violet-soft': '#c4b1ff18',
      '--color-violet-border': '#c4b1ff88',
      '--color-grid': '#ffffff0c',
      '--color-canvas-edge': '#07070b99',
      '--color-text': '#f2f1f6',
      '--color-text-muted': '#b5b2c2',
      '--color-module-surface': '#19191ff5',
      '--color-comment-surface': '#211f28f5',
      '--color-border': '#ffffff24',
      '--color-border-hover': '#ffffff48',
      '--color-hover': '#ffffff0d',
      '--color-on-primary': '#0e0e12',
      '--color-diagnostic': '#f3b1a3',
      '--color-input': '#101015',
      '--color-glass-reflection': '#ffffff08',
      '--color-glass-highlight': '#ffffff12',
      '--color-glass': '#24242ce8',
      '--mascot-filter': 'brightness(1)',
      '--color-node-variable': '#6f9ff5',
      '--color-node-type': '#5fc9d8',
      '--color-node-function': '#b58cf0',
      '--color-node-parameter': '#e39ad0',
      '--color-node-condition': '#d9a441',
      '--color-node-loop': '#e07a3f',
      '--color-node-return': '#e05c6e',
      '--color-node-block': '#7d8798',
      '--color-node-statement': '#7fb069',
      '--color-node-operator': '#4fb3a8',
      '--color-node-value': '#b5c95a',
      '--color-node-array': '#e8d06a',
      '--color-node-incomplete': '#d8b184',
    },
  },
  {
    id: 'void',
    labelKey: 'theme.void',
    mode: 'dark',
    colors: {
      '--color-black': '#06070a',
      '--color-anthracite': '#0c0f14',
      '--color-anthracite-raised': '#171c24',
      '--color-yellow': '#b6ff2e',
      '--color-yellow-hover': '#c8ff5a',
      '--color-yellow-active': '#8fd61f',
      '--color-yellow-soft': '#b6ff2e18',
      '--color-violet': '#6ee7ff',
      '--color-violet-soft': '#6ee7ff18',
      '--color-violet-border': '#6ee7ff88',
      '--color-grid': '#b6ff2e0d',
      '--color-canvas-edge': '#030407cc',
      '--color-text': '#e8edf2',
      '--color-text-muted': '#9ca7b5',
      '--color-module-surface': '#0c0f14fa',
      '--color-comment-surface': '#11161d',
      '--color-border': '#2a313d',
      '--color-border-hover': '#3c4656',
      '--color-hover': '#ffffff08',
      '--color-on-primary': '#06070a',
      '--color-diagnostic': '#ffb020',
      '--color-input': '#0a0d12',
      '--color-glass-reflection': '#ffffff05',
      '--color-glass-highlight': '#ffffff0a',
      '--color-glass': '#0c0f14f5',
      '--mascot-filter': 'sepia(1) saturate(2.8) hue-rotate(42deg) brightness(1.05)',
      '--color-node-variable': '#5fa8ff',
      '--color-node-type': '#4fd8c8',
      '--color-node-function': '#ff7ae0',
      '--color-node-parameter': '#c79bff',
      '--color-node-condition': '#ffb020',
      '--color-node-loop': '#ff8a3d',
      '--color-node-return': '#ff5a5f',
      '--color-node-block': '#7d8798',
      '--color-node-statement': '#7fd16b',
      '--color-node-operator': '#6ee7ff',
      '--color-node-value': '#c8e86a',
      '--color-node-array': '#e8d06a',
      '--color-node-incomplete': '#d8b184',
    },
  },
  {
    id: 'neon',
    labelKey: 'theme.neon',
    mode: 'dark',
    colors: {
      '--color-black': '#0b0d1c',
      '--color-anthracite': '#14182c',
      '--color-anthracite-raised': '#202744',
      '--color-yellow': '#8ef0d0',
      '--color-yellow-hover': '#b0ffe6',
      '--color-yellow-active': '#63c9ab',
      '--color-yellow-soft': '#8ef0d020',
      '--color-violet': '#ff9fb2',
      '--color-violet-soft': '#ff9fb220',
      '--color-violet-border': '#ff9fb288',
      '--color-grid': '#8ef0d014',
      '--color-canvas-edge': '#05071299',
      '--color-text': '#eef5ff',
      '--color-text-muted': '#aab8d8',
      '--color-module-surface': '#14182cf5',
      '--color-comment-surface': '#1b2138f5',
      '--color-border': '#b9caff2e',
      '--color-border-hover': '#b9caff5c',
      '--color-hover': '#b9caff12',
      '--color-on-primary': '#0b0d1c',
      '--color-diagnostic': '#ffb3b8',
      '--color-input': '#0e1224',
      '--color-glass-reflection': '#c8d8ff08',
      '--color-glass-highlight': '#c8d8ff12',
      '--color-glass': '#202744e8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(130deg) brightness(1.08)',
      '--color-node-variable': '#7fb8ff',
      '--color-node-type': '#6fd8d0',
      '--color-node-function': '#bca6ff',
      '--color-node-parameter': '#f0a6d0',
      '--color-node-condition': '#e8c98a',
      '--color-node-loop': '#f0a07a',
      '--color-node-return': '#f08a9e',
      '--color-node-block': '#8a97b8',
      '--color-node-statement': '#93d09a',
      '--color-node-operator': '#64c8bb',
      '--color-node-value': '#c9d982',
      '--color-node-incomplete': '#d9b591',
    },
  },
  {
    id: 'mono',
    labelKey: 'theme.mono',
    mode: 'dark',
    colors: {
      '--color-black': '#101114',
      '--color-anthracite': '#1a1c22',
      '--color-anthracite-raised': '#262a32',
      '--color-yellow': '#e9e7f2',
      '--color-yellow-hover': '#fbfaff',
      '--color-yellow-active': '#c8c4d4',
      '--color-yellow-soft': '#e9e7f220',
      '--color-violet': '#b9b4c9',
      '--color-violet-soft': '#b9b4c920',
      '--color-violet-border': '#b9b4c988',
      '--color-grid': '#e9e7f210',
      '--color-canvas-edge': '#06060999',
      '--color-text': '#f5f4f8',
      '--color-text-muted': '#b1afba',
      '--color-module-surface': '#1a1c22f5',
      '--color-comment-surface': '#22252cf5',
      '--color-border': '#e9e7f22e',
      '--color-border-hover': '#e9e7f25c',
      '--color-hover': '#e9e7f212',
      '--color-on-primary': '#101114',
      '--color-diagnostic': '#f2b8b8',
      '--color-input': '#141519',
      '--color-glass-reflection': '#ffffff08',
      '--color-glass-highlight': '#ffffff12',
      '--color-glass': '#262a32e8',
      '--mascot-filter': 'grayscale(1) brightness(1.06) contrast(1.04)',
      '--color-node-variable': '#c3c8d4',
      '--color-node-type': '#d8dce5',
      '--color-node-function': '#eeeef5',
      '--color-node-parameter': '#b7b2c2',
      '--color-node-condition': '#d0cbd8',
      '--color-node-loop': '#aaaab6',
      '--color-node-return': '#e6dbe3',
      '--color-node-block': '#82858f',
      '--color-node-statement': '#bcc6c0',
      '--color-node-operator': '#a0a8ad',
      '--color-node-value': '#d8dabf',
      '--color-node-incomplete': '#bdb1a8',
    },
  },
  {
    id: 'rose',
    labelKey: 'theme.rose',
    mode: 'dark',
    colors: {
      '--color-black': '#150e16',
      '--color-anthracite': '#211726',
      '--color-anthracite-raised': '#32233b',
      '--color-yellow': '#f2a6c4',
      '--color-yellow-hover': '#ffc5da',
      '--color-yellow-active': '#d484a5',
      '--color-yellow-soft': '#f2a6c420',
      '--color-violet': '#c7b2ff',
      '--color-violet-soft': '#c7b2ff20',
      '--color-violet-border': '#c7b2ff88',
      '--color-grid': '#f2a6c412',
      '--color-canvas-edge': '#0b060b99',
      '--color-text': '#fdf3f8',
      '--color-text-muted': '#cdb2c1',
      '--color-module-surface': '#211726f5',
      '--color-comment-surface': '#2b1c32f5',
      '--color-border': '#f7cde02e',
      '--color-border-hover': '#f7cde05c',
      '--color-hover': '#f7cde012',
      '--color-on-primary': '#150e16',
      '--color-diagnostic': '#f7b2aa',
      '--color-input': '#190f1a',
      '--color-glass-reflection': '#ffd6e808',
      '--color-glass-highlight': '#ffd6e812',
      '--color-glass': '#32233be8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(300deg) brightness(1.06)',
      '--color-node-variable': '#97c0ff',
      '--color-node-type': '#7fd8d0',
      '--color-node-function': '#c5a8ff',
      '--color-node-parameter': '#f2a6d0',
      '--color-node-condition': '#e8ca8c',
      '--color-node-loop': '#f0a27c',
      '--color-node-return': '#f28ca0',
      '--color-node-block': '#a995a3',
      '--color-node-statement': '#9bd49c',
      '--color-node-operator': '#74ccbe',
      '--color-node-value': '#d6e084',
      '--color-node-incomplete': '#deba9e',
    },
  },
  {
    id: 'pro',
    labelKey: 'theme.pro',
    mode: 'dark',
    colors: {
      '--color-black': '#0c111b',
      '--color-anthracite': '#151c2a',
      '--color-anthracite-raised': '#202a3c',
      '--color-yellow': '#9db8ff',
      '--color-yellow-hover': '#bdcfff',
      '--color-yellow-active': '#7d98e0',
      '--color-yellow-soft': '#9db8ff20',
      '--color-violet': '#e8c78a',
      '--color-violet-soft': '#e8c78a20',
      '--color-violet-border': '#e8c78a88',
      '--color-grid': '#9db8ff14',
      '--color-canvas-edge': '#05080f99',
      '--color-text': '#eef2fa',
      '--color-text-muted': '#a9b5c8',
      '--color-module-surface': '#151c2af5',
      '--color-comment-surface': '#1c2536f5',
      '--color-border': '#c4d3ff2e',
      '--color-border-hover': '#c4d3ff5c',
      '--color-hover': '#c4d3ff12',
      '--color-on-primary': '#0c111b',
      '--color-diagnostic': '#f2b0b0',
      '--color-input': '#0f1622',
      '--color-glass-reflection': '#d4e0ff08',
      '--color-glass-highlight': '#d4e0ff12',
      '--color-glass': '#202a3ce8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(187deg) brightness(1.06)',
      '--color-node-variable': '#82b8ff',
      '--color-node-type': '#6fd8d0',
      '--color-node-function': '#b3a6f0',
      '--color-node-parameter': '#e8a6c8',
      '--color-node-condition': '#e8c78a',
      '--color-node-loop': '#e8a07a',
      '--color-node-return': '#e88a98',
      '--color-node-block': '#8797ad',
      '--color-node-statement': '#93cf9c',
      '--color-node-operator': '#64c8bc',
      '--color-node-value': '#c9d982',
      '--color-node-incomplete': '#d4b594',
    },
  },
  {
    id: 'educational',
    labelKey: 'theme.educational',
    mode: 'dark',
    colors: {
      '--color-black': '#12110e',
      '--color-anthracite': '#1d1b16',
      '--color-anthracite-raised': '#2a2720',
      '--color-yellow': '#e8c98a',
      '--color-yellow-hover': '#f5dbaa',
      '--color-yellow-active': '#c9a96a',
      '--color-yellow-soft': '#e8c98a20',
      '--color-violet': '#a9c7b8',
      '--color-violet-soft': '#a9c7b820',
      '--color-violet-border': '#a9c7b888',
      '--color-grid': '#e8c98a12',
      '--color-canvas-edge': '#09080599',
      '--color-text': '#f7f2e8',
      '--color-text-muted': '#c2b9a9',
      '--color-module-surface': '#1d1b16f5',
      '--color-comment-surface': '#25221bf5',
      '--color-border': '#f0dfc02e',
      '--color-border-hover': '#f0dfc05c',
      '--color-hover': '#f0dfc012',
      '--color-on-primary': '#12110e',
      '--color-diagnostic': '#f0b0a0',
      '--color-input': '#17150f',
      '--color-glass-reflection': '#fff0d608',
      '--color-glass-highlight': '#fff0d612',
      '--color-glass': '#2a2720e8',
      '--mascot-filter': 'sepia(1) saturate(1.6) brightness(1.04)',
      '--color-node-variable': '#8fb8e8',
      '--color-node-type': '#7fd0c8',
      '--color-node-function': '#c0a6e8',
      '--color-node-parameter': '#e8a6c8',
      '--color-node-condition': '#e0c27a',
      '--color-node-loop': '#e09a70',
      '--color-node-return': '#e08a88',
      '--color-node-block': '#948e80',
      '--color-node-statement': '#9bc78f',
      '--color-node-operator': '#6cc0ae',
      '--color-node-value': '#c8d078',
      '--color-node-incomplete': '#d0b08a',
    },
  },
].map((entry) => ({ ...entry, lightColors: buildLightColors(entry.colors) }))

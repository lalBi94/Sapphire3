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

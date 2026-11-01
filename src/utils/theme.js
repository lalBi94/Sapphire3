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

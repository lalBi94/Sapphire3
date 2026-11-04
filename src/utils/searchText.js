// Compare sans casse ni accents : un clavier français tape « func » pour « fonction ».
export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

// Variante pour la recherche floue : ponctuation et séparateurs deviennent des espaces.
export function normalizeFuzzyText(value) {
  return normalizeSearchText(value)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
}

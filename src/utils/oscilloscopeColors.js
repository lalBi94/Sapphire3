// Palette fixe et distincte des canaux, lisible sur les thèmes sombres et clairs.
export const oscilloscopeColors = Object.freeze([
  '#f5d547',
  '#7c58ff',
  '#15e272',
  '#f14e0e',
  '#58a6ff',
  '#ee00ab',
])

// Retourne la couleur stable d'un canal à partir de son identifiant.
export function oscilloscopeColor(id) {
  const numeric = Math.trunc(Number(id)) || 1
  return oscilloscopeColors[Math.abs(numeric - 1) % oscilloscopeColors.length]
}

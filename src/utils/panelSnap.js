// Aimante la position d'une fenêtre volante aux bords de son espace quand elle s'en approche.

// Ramène une coordonnée sur le bord aligné si elle se trouve dans la zone d'aimantation.
function snapAxis(value, area, size, margin, threshold) {
  const low = margin
  const high = Math.max(margin, area - size - margin)
  if (Math.abs(value - low) <= threshold) return low
  if (Math.abs(value - high) <= threshold) return high
  return value
}

// Renvoie la position aimantée, ou la position reçue si aucun bord n'est proche.
export function snapPanelToArea({ x, y, width, height, areaWidth, areaHeight, margin = 8, threshold = 22 }) {
  return {
    x: snapAxis(x, areaWidth, width, margin, threshold),
    y: snapAxis(y, areaHeight, height, margin, threshold),
  }
}

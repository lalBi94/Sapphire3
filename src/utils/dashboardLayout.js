// Calculs purs de disposition du dashboard exporté : grille de 12 colonnes, déplacement et persistance.

export const dashboardColumns = 12
export const dashboardRowHeight = 24
export const dashboardRowGap = 12
export const dashboardMaximumRows = 240

// Borne une valeur entière dans un intervalle.
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

// Normalise une entrée de disposition sans perdre son identifiant.
function sanitizeEntry(entry, panel, columns) {
  const width = clamp(Number.isInteger(entry?.w) ? entry.w : panel.w, 1, columns)
  const height = clamp(Number.isInteger(entry?.h) ? entry.h : panel.h, 1, dashboardMaximumRows)
  const x = clamp(Number.isInteger(entry?.x) ? entry.x : 0, 0, Math.max(0, columns - width))
  const y = clamp(Number.isInteger(entry?.y) ? entry.y : 0, 0, dashboardMaximumRows - height)
  return { id: panel.id, x, y, w: width, h: height, visible: entry?.visible !== false }
}

// Indique si un rectangle est libre dans la grille d'occupation.
function isFree(occupied, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (occupied.has(`${column},${row}`)) return false
    }
  }
  return true
}

// Marque un rectangle comme occupé.
function occupy(occupied, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      occupied.add(`${column},${row}`)
    }
  }
}

// Cherche la première place libre pour un panneau, sans chevaucher les précédents.
function placePanel(occupied, panel, columns) {
  const width = clamp(Number.isInteger(panel.w) ? panel.w : 4, 1, columns)
  const height = clamp(Number.isInteger(panel.h) ? panel.h : 6, 1, dashboardMaximumRows)
  for (let y = 0; y < dashboardMaximumRows - height; y += 1) {
    for (let x = 0; x <= columns - width; x += 1) {
      if (isFree(occupied, x, y, width, height)) {
        occupy(occupied, x, y, width, height)
        return { id: panel.id, x, y, w: width, h: height, visible: true }
      }
    }
  }
  const fallback = { id: panel.id, x: 0, y: 0, w: width, h: height, visible: true }
  occupy(occupied, 0, 0, width, height)
  return fallback
}

// Construit une disposition compacte à partir de l'ordre des panneaux exportés.
export function packDashboardLayout(panels, columns = dashboardColumns) {
  const occupied = new Set()
  return panels.map((panel) => placePanel(occupied, panel, columns))
}

// Répartit les panneaux en deux colonnes bento : les panneaux pleine largeur occupent
// une colonne entière, les panneaux demi-largeur se placent par deux côte à côte.
export function packDashboardBento(panels, columns = dashboardColumns) {
  const columnCount = 2
  const columnWidth = Math.max(1, Math.floor(columns / columnCount))
  const halfWidth = Math.max(1, Math.floor(columnWidth / 2))
  const columnHeights = Array(columnCount).fill(0)
  const openHalfRows = Array(columnCount).fill(null)
  const placements = []

  // Choisit la colonne la plus courte pour équilibrer les deux colonnes.
  function chooseColumn() {
    return columnHeights
      .map((height, index) => ({ height, index }))
      .sort((left, right) => left.height - right.height || left.index - right.index)[0].index
  }

  for (const panel of panels) {
    const height = Math.max(1, Math.trunc(panel.h) || 1)
    if (panel.span === 'half') {
      const open = openHalfRows.map((row, index) => row ? { index, row } : null)
        .filter(Boolean)
        .sort((left, right) => columnHeights[left.index] - columnHeights[right.index] || left.index - right.index)
      if (open.length > 0) {
        const { index, row } = open[0]
        placements.push({ id: panel.id, x: index * columnWidth + halfWidth, y: row.y, w: halfWidth, h: height, visible: true })
        const extra = Math.max(0, height - row.height)
        columnHeights[index] += extra
        row.height = Math.max(row.height, height)
        openHalfRows[index] = null
      } else {
        const index = chooseColumn()
        const y = columnHeights[index]
        placements.push({ id: panel.id, x: index * columnWidth, y, w: halfWidth, h: height, visible: true })
        columnHeights[index] += height
        openHalfRows[index] = { y, height }
      }
    } else {
      const index = chooseColumn()
      const y = columnHeights[index]
      placements.push({ id: panel.id, x: index * columnWidth, y, w: columnWidth, h: height, visible: true })
      columnHeights[index] += height
      openHalfRows[index] = null
    }
  }
  return placements
}

// Garantit une entrée pour chaque panneau et retire les identifiants inconnus.
export function normalizeDashboardLayout(layout, panels, columns = dashboardColumns) {
  const entries = Array.isArray(layout) ? layout : []
  const byId = new Map(entries.filter((entry) => entry && typeof entry.id === 'string').map((entry) => [entry.id, entry]))
  const occupied = new Set()
  const normalized = []
  for (const panel of panels) {
    const existing = byId.get(panel.id)
    if (!existing) {
      normalized.push(placePanel(occupied, panel, columns))
      continue
    }
    const entry = sanitizeEntry(existing, panel, columns)
    occupy(occupied, entry.x, entry.y, entry.w, entry.h)
    normalized.push(entry)
  }
  return normalized
}

// Déplace un panneau d'un nombre de cellules, sans sortir de la grille.
export function moveDashboardPanel(layout, id, dx, dy, columns = dashboardColumns) {
  return layout.map((entry) => {
    if (entry.id !== id) return entry
    const x = clamp(entry.x + dx, 0, Math.max(0, columns - entry.w))
    const y = clamp(entry.y + dy, 0, dashboardMaximumRows - entry.h)
    return x === entry.x && y === entry.y ? entry : { ...entry, x, y }
  })
}

// Redimensionne un panneau en respectant sa taille minimale et les bords de la grille.
export function resizeDashboardPanel(layout, id, dw, dh, columns = dashboardColumns, minimum = { w: 2, h: 2 }) {
  return layout.map((entry) => {
    if (entry.id !== id) return entry
    const width = clamp(entry.w + dw, minimum.w, Math.max(minimum.w, columns - entry.x))
    const height = clamp(entry.h + dh, minimum.h, dashboardMaximumRows - entry.y)
    return width === entry.w && height === entry.h ? entry : { ...entry, w: width, h: height }
  })
}

// Affiche ou masque un panneau sans supprimer sa position.
export function toggleDashboardPanel(layout, id, visible) {
  return layout.map((entry) => entry.id === id ? { ...entry, visible: Boolean(visible) } : entry)
}

// Adapte la grille de 12 colonnes à la largeur réelle de l'écran, pour l'affichage seulement.
export function scaleDashboardLayout(layout, columns = dashboardColumns) {
  return layout.map((entry) => {
    const width = clamp(Math.round((entry.w * columns) / dashboardColumns), 1, columns)
    const x = clamp(Math.round((entry.x * columns) / dashboardColumns), 0, Math.max(0, columns - width))
    return { ...entry, x, w: width }
  })
}

// Relit une disposition locale ; toute valeur invalide retombe sur la disposition initiale.
export function readDashboardLayout(storage, key, defaults, panels) {
  if (!storage || typeof storage.getItem !== 'function') return defaults
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null')
    if (!Array.isArray(parsed)) return defaults
    return normalizeDashboardLayout(parsed, panels)
  } catch {
    return defaults
  }
}

// Conserve la disposition dans le navigateur du visiteur, sans toucher au HTML.
export function writeDashboardLayout(storage, key, layout) {
  if (!storage || typeof storage.setItem !== 'function') return false
  try {
    storage.setItem(key, JSON.stringify(layout))
    return true
  } catch {
    return false
  }
}

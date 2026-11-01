import { getNodeSchema } from './logic/index.js'

const fontSize = 12
const lineHeight = 17
const padding = 12
const headerHeight = 28
const indent = 14
const margin = 56
const columnGap = 120
const rowGap = 64
const bandGap = 96
const maxBandWidth = 1600
const minimumWidth = 240
const minimumHeight = 120

// Estime la largeur d'un texte sans dépendre du DOM ; les idéogrammes comptent double.
export function textWidth(text, size = fontSize) {
  let width = 0
  for (const character of String(text)) width += character.codePointAt(0) > 0x2e80 ? size : size * 0.56
  return width
}

// Échappe les caractères réservés au XML pour rester un document valide.
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]))
}

// Découpe un texte en lignes tenant dans une largeur donnée.
function wrapText(text, maxWidth, size = fontSize) {
  const lines = []
  let current = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && textWidth(candidate, size) > maxWidth) { lines.push(current); current = word }
    else current = candidate
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

// Parcourt un module entièrement déplié et produit une ligne par nœud, avec sa profondeur.
function expandLines(module, index, describe) {
  const lines = []
  const visited = new Set()
  const visit = (id, depth) => {
    if (visited.has(id) || depth > 80) return
    visited.add(id)
    const node = index.nodes.get(id)
    if (!node) { lines.push({ depth, text: '?', group: 'incomplete' }); return }
    lines.push({ depth, text: describe(node), group: getNodeSchema(node.kind)?.group ?? 'incomplete' })
    for (const slot of Object.keys(getNodeSchema(node.kind)?.slots ?? {})) {
      const value = node.children?.[slot]
      const children = Array.isArray(value) ? value : value ? [value] : []
      for (const child of children) visit(child, depth + 1)
    }
  }
  for (const id of module.rootNodeIds ?? []) visit(id, 0)
  return lines
}

// Mesure un module déplié : titre, lignes et dimensions nécessaires.
function measureModule(card, index, describe) {
  const module = index.modules.get(card.id)
  const title = module?.name || card.name || ''
  const lines = module ? expandLines(module, index, describe) : []
  const contentWidth = lines.reduce((widest, line) => Math.max(widest, line.depth * indent + textWidth(line.text)), 0)
  return {
    id: card.id,
    title,
    lines,
    width: Math.max(minimumWidth, contentWidth + padding * 2 + 8, padding * 2 + textWidth(title, 14) + 8),
    height: Math.max(minimumHeight, headerHeight + lines.length * lineHeight + padding),
  }
}

// Range les modules en couches selon les dépendances : un exportateur précède ses utilisateurs.
function rankModules(moduleIds, links) {
  const incoming = new Map(moduleIds.map((id) => [id, 0]))
  const children = new Map(moduleIds.map((id) => [id, []]))
  for (const link of links) {
    if (!incoming.has(link?.fromId) || !incoming.has(link?.toId)) continue
    children.get(link.fromId).push(link.toId)
    incoming.set(link.toId, incoming.get(link.toId) + 1)
  }
  const rank = new Map(moduleIds.map((id) => [id, 0]))
  const queue = moduleIds.filter((id) => incoming.get(id) === 0)
  const visited = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    for (const next of children.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next), rank.get(id) + 1))
      incoming.set(next, incoming.get(next) - 1)
      if (incoming.get(next) === 0) queue.push(next)
    }
  }
  // Un cycle ne doit pas empiler tous ses modules dans la même colonne.
  let fallback = Math.max(0, ...rank.values()) + 1
  for (const id of moduleIds) if (!visited.has(id)) rank.set(id, fallback++)
  return rank
}

// Place les modules mesurés en colonnes, sans chevauchement, dans l'ordre des couches.
function placeModules(measured, links) {
  const ranks = rankModules(measured.map((module) => module.id), links)
  const orderedRanks = [...new Set(measured.map((module) => ranks.get(module.id) ?? 0))].sort((a, b) => a - b)
  const boxes = new Map()
  let x = 0
  let bottom = 0
  for (const rank of orderedRanks) {
    const column = measured.filter((module) => (ranks.get(module.id) ?? 0) === rank)
    const columnWidth = Math.max(...column.map((module) => module.width))
    let y = 0
    for (const module of column) {
      boxes.set(module.id, { ...module, x, y })
      bottom = Math.max(bottom, y + module.height)
      y += module.height + rowGap
    }
    x += columnWidth + columnGap
  }
  return { boxes, bottom }
}

// Range les annotations sous les modules, en grille, pour ne jamais les masquer.
function placeAnnotations(cards, boxes, bottom) {
  let x = 0
  let y = bottom + bandGap
  let rowHeight = 0
  for (const card of cards) {
    const width = card.width ?? minimumWidth
    const height = card.height ?? minimumHeight
    if (x > 0 && x + width > maxBandWidth) { x = 0; y += rowHeight + rowGap; rowHeight = 0 }
    boxes.set(card.id, { ...card, x, y, width, height })
    x += width + columnGap
    rowHeight = Math.max(rowHeight, height)
  }
}

// Rend une carte module : cadre, titre et arbre déplié.
function moduleGroup(box, colors) {
  const body = box.lines.map((line, position) => `<text x="${box.x + padding + line.depth * indent}" y="${box.y + headerHeight + (position + 0.75) * lineHeight}" font-size="${fontSize}" fill="${colors.node?.[line.group] ?? colors.text}">${escapeXml(line.text)}</text>`).join('')
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14" fill="${colors.surface}" stroke="${colors.border}" stroke-width="1.5"/>`
    + `<text x="${box.x + padding}" y="${box.y + 19}" font-size="14" font-weight="700" fill="${colors.text}">${escapeXml(box.title)}</text>`
    + `<line x1="${box.x + padding}" y1="${box.y + headerHeight - 7}" x2="${box.x + box.width - padding}" y2="${box.y + headerHeight - 7}" stroke="${colors.border}"/>`
    + body + '</g>'
}

// Rend une carte annotation (Comment) : cadre en pointillés et texte replié.
function commentGroup(box, colors) {
  const lines = wrapText(box.text ?? '', box.width - padding * 2).slice(0, Math.max(1, Math.floor((box.height - headerHeight - padding) / lineHeight)))
  const body = lines.map((line, position) => `<text x="${box.x + padding}" y="${box.y + headerHeight + (position + 0.75) * lineHeight}" font-size="${fontSize}" fill="${colors.muted}">${escapeXml(line)}</text>`).join('')
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14" fill="${colors.comment}" stroke="${colors.border}" stroke-width="1.5" stroke-dasharray="6 5"/>`
    + `<text x="${box.x + padding}" y="${box.y + 19}" font-size="14" font-weight="700" fill="${colors.text}">${escapeXml(box.name ?? '')}</text>` + body + '</g>'
}

// Rend une carte Image : image intégrée et légende superposée.
function imageGroup(box, colors) {
  const caption = box.caption ?? ''
  return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14" fill="${colors.surface}" stroke="${colors.border}" stroke-width="1.5"/>`
    + (box.image ? `<image x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(box.image)}" xlink:href="${escapeXml(box.image)}"/>` : '')
    + `<rect x="${box.x}" y="${box.y + 19}" width="${box.width}" height="22" fill="${colors.text}" fill-opacity="0.72"/>`
    + `<text x="${box.x + padding}" y="${box.y + 19}" font-size="13" font-weight="700" fill="${colors.surface}">${escapeXml(box.name ?? '')}</text>`
    + (caption ? `<text x="${box.x + padding}" y="${box.y + box.height - padding}" font-size="${fontSize}" fill="${colors.text}">${escapeXml(caption)}</text>` : '')
    + '</g>'
}

// Relie deux cartes par une courbe lisible : à droite si possible, sinon par le bas.
function linkPath(from, to) {
  if (to.x >= from.x + from.width) {
    const x1 = from.x + from.width
    const y1 = from.y + headerHeight / 2
    const x2 = to.x
    const y2 = to.y + headerHeight / 2
    const control = Math.max(40, (x2 - x1) / 2)
    return `M${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`
  }
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height
  const x2 = to.x + to.width / 2
  const y2 = to.y + to.height
  const control = Math.max(48, rowGap)
  return `M${x1} ${y1} C ${x1} ${y1 + control}, ${x2} ${y2 + control}, ${x2} ${y2}`
}

// Assemble une vue d'ensemble SVG du workspace entièrement déplié, disposée sans chevauchement.
export function buildWorkspaceSvg({ cards = [], index, links = [], describe = () => '', colors = {} }) {
  const palette = { background: '#0e0e12', surface: '#19191f', comment: '#211f28', border: '#ffffff24', text: '#f2f1f6', muted: '#b5b2c2', accent: '#f5d547', node: {}, ...colors }
  const moduleCards = cards.filter((card) => card.type === 'module' && index.modules.has(card.id))
  const annotationCards = cards.filter((card) => card.type === 'comment' || card.type === 'image')
  const measured = moduleCards.map((card) => measureModule(card, index, describe))
  const { boxes, bottom } = placeModules(measured, links)
  placeAnnotations(annotationCards, boxes, bottom)

  const linkParts = []
  for (const link of links) {
    const from = boxes.get(link.fromId)
    const to = boxes.get(link.toId)
    if (!from || !to) continue
    linkParts.push(`<path d="${linkPath(from, to)}" fill="none" stroke="${palette.accent}" stroke-opacity="0.7" stroke-width="2" marker-end="url(#ws-arrow)"/>`)
  }

  const cardParts = []
  for (const [id, box] of boxes) {
    if (moduleCards.some((card) => card.id === id)) cardParts.push(moduleGroup(box, palette))
    else if (boxes.get(id)?.type === 'image') cardParts.push(imageGroup(box, palette))
    else cardParts.push(commentGroup(box, palette))
  }

  const all = [...boxes.values()]
  const minX = (all.length ? Math.min(...all.map((box) => box.x)) : 0) - margin
  const minY = (all.length ? Math.min(...all.map((box) => box.y)) : 0) - margin
  const maxX = (all.length ? Math.max(...all.map((box) => box.x + box.width)) : 800) + margin
  const maxY = (all.length ? Math.max(...all.map((box) => box.y + box.height)) : 600) + margin
  const width = Math.max(1, Math.round(maxX - minX))
  const height = Math.max(1, Math.round(maxY - minY))

  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    + `viewBox="${Math.round(minX)} ${Math.round(minY)} ${width} ${height}" width="${width}" height="${height}" `
    + 'font-family="Segoe UI, Roboto, system-ui, sans-serif">'
    + `<defs><marker id="ws-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${palette.accent}"/></marker></defs>`
    + `<rect x="${Math.round(minX)}" y="${Math.round(minY)}" width="${width}" height="${height}" fill="${palette.background}"/>`
    + linkParts.join('') + cardParts.join('') + '</svg>'
}

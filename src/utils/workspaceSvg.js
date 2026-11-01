import { getNodeSchema } from './logic/index.js'

const fontSize = 12
const lineHeight = 17
const padding = 12
const headerHeight = 28
const indent = 14
const margin = 48

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

// Décrit une carte module : cadre, titre et arbre déplié.
function moduleCard(card, index, describe, colors) {
  const module = index.modules.get(card.id)
  const title = module?.name || card.name || ''
  const lines = module ? expandLines(module, index, describe) : []
  const contentWidth = lines.reduce((widest, line) => Math.max(widest, line.depth * indent + textWidth(line.text)), 0)
  const width = Math.max(card.width ?? 260, contentWidth + padding * 2 + 8, padding * 2 + textWidth(title, 14) + 8)
  const height = Math.max(card.height ?? 160, headerHeight + lines.length * lineHeight + padding)
  const x = card.x ?? 0
  const y = card.y ?? 0
  const body = lines.map((line, position) => `<text x="${x + padding + line.depth * indent}" y="${y + headerHeight + (position + 0.75) * lineHeight}" font-size="${fontSize}" fill="${colors.node?.[line.group] ?? colors.text}">${escapeXml(line.text)}</text>`).join('')
  return {
    box: { id: card.id, x, y, width, height },
    svg: `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${colors.surface}" stroke="${colors.border}" stroke-width="1.5"/>`
      + `<text x="${x + padding}" y="${y + 19}" font-size="14" font-weight="700" fill="${colors.text}">${escapeXml(title)}</text>`
      + `<line x1="${x + padding}" y1="${y + headerHeight - 7}" x2="${x + width - padding}" y2="${y + headerHeight - 7}" stroke="${colors.border}"/>`
      + body + '</g>',
  }
}

// Décrit une carte annotation (Comment) : cadre en pointillés et texte replié.
function commentCard(card, colors) {
  const width = card.width ?? 260
  const height = card.height ?? 160
  const x = card.x ?? 0
  const y = card.y ?? 0
  const lines = wrapText(card.text ?? '', width - padding * 2).slice(0, Math.max(1, Math.floor((height - headerHeight - padding) / lineHeight)))
  const body = lines.map((line, position) => `<text x="${x + padding}" y="${y + headerHeight + (position + 0.75) * lineHeight}" font-size="${fontSize}" fill="${colors.muted}">${escapeXml(line)}</text>`).join('')
  return {
    box: { id: card.id, x, y, width, height },
    svg: `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${colors.comment}" stroke="${colors.border}" stroke-width="1.5" stroke-dasharray="6 5"/>`
      + `<text x="${x + padding}" y="${y + 19}" font-size="14" font-weight="700" fill="${colors.text}">${escapeXml(card.name ?? '')}</text>`
      + body + '</g>',
  }
}

// Décrit une carte Image : image intégrée et légende superposée.
function imageCard(card, colors) {
  const width = card.width ?? 260
  const height = card.height ?? 180
  const x = card.x ?? 0
  const y = card.y ?? 0
  const caption = card.caption ?? ''
  return {
    box: { id: card.id, x, y, width, height },
    svg: `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${colors.surface}" stroke="${colors.border}" stroke-width="1.5"/>`
      + (card.image ? `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(card.image)}" xlink:href="${escapeXml(card.image)}"/>` : '')
      + `<rect x="${x}" y="${y + 19}" width="${width}" height="22" fill="${colors.text}" fill-opacity="0.72"/>`
      + `<text x="${x + padding}" y="${y + 19}" font-size="13" font-weight="700" fill="${colors.surface}">${escapeXml(card.name ?? '')}</text>`
      + (caption ? `<text x="${x + padding}" y="${y + height - padding}" font-size="${fontSize}" fill="${colors.text}">${escapeXml(caption)}</text>` : '')
      + '</g>',
  }
}

// Assemble une vue d'ensemble SVG du workspace entièrement déplié, prête à zoomer.
export function buildWorkspaceSvg({ cards = [], index, links = [], describe = () => '', colors = {} }) {
  const palette = { background: '#0e0e12', surface: '#19191f', comment: '#211f28', border: '#ffffff24', text: '#f2f1f6', muted: '#b5b2c2', accent: '#f5d547', node: {}, ...colors }
  const boxes = new Map()
  const cardParts = []
  for (const card of cards) {
    const rendered = card.type === 'module' ? moduleCard(card, index, describe, palette)
      : card.type === 'comment' ? commentCard(card, palette)
        : card.type === 'image' ? imageCard(card, palette)
          : null
    if (!rendered) continue
    boxes.set(card.id, rendered.box)
    cardParts.push(rendered.svg)
  }

  const linkParts = []
  for (const link of links) {
    const from = boxes.get(link.fromId)
    const to = boxes.get(link.toId)
    if (!from || !to) continue
    const x1 = from.x + from.width
    const y1 = from.y + headerHeight / 2
    const x2 = to.x
    const y2 = to.y + headerHeight / 2
    const mid = (x1 + x2) / 2
    linkParts.push(`<path d="M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="${palette.accent}" stroke-opacity="0.65" stroke-width="2" marker-end="url(#ws-arrow)"/>`)
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

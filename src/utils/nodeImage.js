// Échappe une valeur texte pour un document SVG.
function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Tronque une valeur trop longue pour tenir dans la carte.
function short(value, maximum = 56) {
  const text = String(value ?? '')
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text
}

// Construit une carte SVG autonome d'un nœud sélectionné, avec ses informations et ses parties.
export function buildNodeImage({ kind, name, type = '', summary = '', footer = '', parts = [], accent = '#f5d547', background = '#19191f', width = 720 }) {
  const lines = parts.slice(0, 12)
  const height = 168 + lines.length * 26
  const title = name || kind
  const rows = lines.map((part, index) => {
    const y = 150 + index * 26
    return `<text x="34" y="${y}" fill="#b5b2c2" font-size="13">${escapeXml(short(part.label, 22))}</text><text x="190" y="${y}" fill="#f2f1f6" font-size="13">${escapeXml(short(part.value))}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${escapeXml(background)}"/><stop offset="1" stop-color="#0e0e12"/></linearGradient></defs>
  <rect width="${width}" height="${height}" rx="18" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="6" rx="3" fill="${escapeXml(accent)}"/>
  <text x="34" y="52" fill="${escapeXml(accent)}" font-size="12" letter-spacing="2">SAPPHIRE 3</text>
  <text x="34" y="88" fill="#f2f1f6" font-size="24" font-weight="600">${escapeXml(short(title, 42))}</text>
  <text x="34" y="112" fill="#b5b2c2" font-size="13">${escapeXml(short(kind, 32))}${type ? ` · ${escapeXml(short(type, 40))}` : ''}</text>
  ${summary ? `<text x="34" y="134" fill="#b5b2c2" font-size="13">${escapeXml(short(summary, 64))}</text>` : ''}
  ${rows}
  <text x="34" y="${height - 22}" fill="#b5b2c2" font-size="11">${escapeXml(short(footer, 90))}</text>
</svg>`
  return { svg, width, height }
}

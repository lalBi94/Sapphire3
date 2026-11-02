import katex from 'katex'

// Options de rendu sûres : commandes dangereuses désactivées, aucun échec bloquant pour l'utilisateur.
const katexOptions = Object.freeze({ displayMode: true, throwOnError: false, strict: 'ignore', trust: false, output: 'html' })

// Découpe un texte de commentaire en segments littéraux et mathématiques, délimités uniquement par `$$ ... $$`.
// Un `$$` non fermé reste du texte : le contenu saisi n'est jamais perdu ni réinterprété.
export function parseMathText(text) {
  const source = typeof text === 'string' ? text : ''
  const segments = []
  let index = 0
  while (index < source.length) {
    const open = source.indexOf('$$', index)
    if (open === -1) break
    const close = source.indexOf('$$', open + 2)
    if (close === -1) break
    if (open > index) segments.push({ kind: 'text', value: source.slice(index, open) })
    segments.push({ kind: 'math', value: source.slice(open + 2, close) })
    index = close + 2
  }
  if (index < source.length) segments.push({ kind: 'text', value: source.slice(index) })
  return segments
}

// Rend un fragment math en HTML KaTeX ; une erreur interne ne casse jamais l'affichage du commentaire.
export function renderMath(content) {
  try {
    return katex.renderToString(typeof content === 'string' ? content : '', katexOptions)
  } catch {
    return ''
  }
}

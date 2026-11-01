// Fait défiler la carte d'un nœud pour le rendre visible, sans jamais déplacer la page,
// la surface du canvas ni un autre conteneur : seul le contenu de la carte bouge.
export function scrollNodeIntoCard(element, block = 'nearest') {
  const card = element?.closest('.canvas-module__content')
  if (!card) return
  const cardRect = card.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  // 'nearest' ajuste le minimum nécessaire ; 'center' place le nœud au milieu de la zone visible.
  const vertical = block === 'center'
    ? rect.top + rect.height / 2 - (cardRect.top + card.clientHeight / 2)
    : rect.top < cardRect.top ? rect.top - cardRect.top : rect.bottom > cardRect.bottom ? rect.bottom - cardRect.bottom : 0
  const horizontal = rect.left < cardRect.left ? rect.left - cardRect.left : rect.right > cardRect.right ? rect.right - cardRect.right : 0
  if (vertical === 0 && horizontal === 0) return
  card.scrollBy({ top: vertical, left: horizontal, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}

import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment et Image restent hors de la logique.
export const moduleTypes = {
  [moduleKinds.module]: { sourceKind: moduleKinds.module, label: 'Module', labelKey: 'card.module', targetLabelKey: 'canvas.module', actionKey: 'nav.createModule', width: 320, height: 220, renamable: true },
  comment: { label: 'Comment', labelKey: 'card.comment', targetLabelKey: 'canvas.note', actionKey: 'nav.createComment', width: 320, height: 220, renamable: true, hasText: true },
  image: { label: 'Image', labelKey: 'card.image', targetLabelKey: 'canvas.image', actionKey: 'nav.createImage', width: 420, height: 260, renamable: true, hasImage: true },
}

export const minimumModuleSize = { width: 180, height: 120 }

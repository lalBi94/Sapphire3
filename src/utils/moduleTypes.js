import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment et Image restent hors de la logique.
export const moduleTypes = {
  [moduleKinds.module]: { sourceKind: moduleKinds.module, label: 'Module', action: 'Create module', actionKey: 'nav.createModule', width: 320, height: 220, renamable: true },
  comment: { label: 'Comment', action: 'Create comment', actionKey: 'nav.createComment', width: 320, height: 220, renamable: true, hasText: true },
  image: { label: 'Image', action: 'Create image', actionKey: 'nav.createImage', width: 420, height: 260, renamable: true, hasImage: true },
}

export const minimumModuleSize = { width: 180, height: 120 }

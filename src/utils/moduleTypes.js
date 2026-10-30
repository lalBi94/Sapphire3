import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment et Image restent hors de la logique.
export const moduleTypes = {
  [moduleKinds.module]: { label: 'Module', action: 'Create module', width: 320, height: 220, renamable: true },
  comment: { label: 'Comment', action: 'Create comment', width: 320, height: 220, renamable: true, hasText: true },
}

// Garde la carte visuelle Image hors de l'énumération historique attendue par le moteur.
Object.defineProperty(moduleTypes, 'image', {
  value: { label: 'Image', action: 'Create image', width: 420, height: 260, renamable: true, hasImage: true },
  enumerable: false,
})

export const minimumModuleSize = { width: 180, height: 120 }

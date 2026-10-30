import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment n'est pas une catégorie logique.
export const moduleTypes = {
  [moduleKinds.module]: { label: 'Module', action: 'Create module', width: 320, height: 220, renamable: true },
  [moduleKinds.main]: { label: 'Main', action: 'Create Main', width: 320, height: 220, renamable: false },
  comment: { label: 'Comment', action: 'Create comment', width: 320, height: 220, renamable: true, hasText: true },
}

export const minimumModuleSize = { width: 180, height: 120 }

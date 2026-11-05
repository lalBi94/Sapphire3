import { moduleKinds } from './logic/model.js'

// Centralise les cartes visuelles ; Comment et Image restent hors de la logique.
export const moduleTypes = {
  [moduleKinds.module]: { sourceKind: moduleKinds.module, label: 'Module', labelKey: 'card.module', targetLabelKey: 'canvas.module', actionKey: 'nav.createModule', width: 320, height: 220, renamable: true, hasEmoji: true },
  screen: { label: 'Screen', labelKey: 'card.screen', targetLabelKey: 'canvas.screen', actionKey: 'nav.createScreen', width: 360, height: 300, renamable: true, hasScreen: true },
  gauge: { label: 'Gauge', labelKey: 'card.gauge', targetLabelKey: 'canvas.gauge', actionKey: 'nav.createGauge', width: 380, height: 260, renamable: true, hasGauge: true },
  progress: { label: 'Progress', labelKey: 'card.progress', targetLabelKey: 'canvas.progress', actionKey: 'nav.createProgress', width: 420, height: 150, renamable: true, hasProgress: true },
  led: { label: 'LED', labelKey: 'card.led', targetLabelKey: 'canvas.led', actionKey: 'nav.createLed', width: 220, height: 170, renamable: true, hasLed: true },
  comment: { label: 'Comment', labelKey: 'card.comment', targetLabelKey: 'canvas.note', actionKey: 'nav.createComment', width: 320, height: 220, renamable: true, hasText: true },
  image: { label: 'Image', labelKey: 'card.image', targetLabelKey: 'canvas.image', actionKey: 'nav.createImage', width: 420, height: 260, renamable: true, hasImage: true },
}

export const minimumModuleSize = { width: 180, height: 120 }

// Vues possibles d'une carte écran : l'écran lui-même, ou le code de son module caché.
export const screenViews = ['screen', 'code']

// Vues possibles d'une carte jauge : l'aperçu de la jauge, ou le code de son module caché.
export const gaugeViews = ['gauge', 'code']

// Vues possibles d'une carte barre de progression : l'aperçu, ou le code de son module caché.
export const progressViews = ['progress', 'code']

// Vues possibles d'une carte LED : le voyant, ou le code de son module caché.
export const ledViews = ['led', 'code']

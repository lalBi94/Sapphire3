import idle from '../assets/mascotte/01_idle.png'
import success from '../assets/mascotte/02_success.png'
import error from '../assets/mascotte/03_error.png'
import warning from '../assets/mascotte/04_warning.png'
import info from '../assets/mascotte/05_info.png'
import loading from '../assets/mascotte/06_loading.png'
import saved from '../assets/mascotte/07_saved.png'
import update from '../assets/mascotte/08_update_available.png'
import debug from '../assets/mascotte/09_debug_paused.png'
import simulation from '../assets/mascotte/10_simulation_finished.png'
import transpile from '../assets/mascotte/11_transpile_failed.png'
import importSuccess from '../assets/mascotte/12_import_success.png'
import exportSuccess from '../assets/mascotte/13_export_success.png'
import shortcut from '../assets/mascotte/14_shortcut_conflict.png'
import hidden from '../assets/mascotte/15_hidden_cards_restored.png'
import locked from '../assets/mascotte/16_locked_card.png'

// Catalogue unique des expressions du robot, chargées comme ressources statiques par Vite.
export const mascotStates = Object.freeze({
  idle: { src: idle },
  success: { src: success },
  error: { src: error },
  warning: { src: warning },
  info: { src: info },
  loading: { src: loading },
  saved: { src: saved },
  update_available: { src: update },
  debug_paused: { src: debug },
  simulation_finished: { src: simulation },
  transpile_failed: { src: transpile },
  import_success: { src: importSuccess },
  export_success: { src: exportSuccess },
  shortcut_conflict: { src: shortcut },
  hidden_cards_restored: { src: hidden },
  locked_card: { src: locked },
})

// Ramène les types d'événements proches à leur expression canonique.
const typeStates = Object.freeze({
  update: 'update_available',
  progress: 'loading',
  simulation: 'simulation_finished',
  debug: 'debug_paused',
  transpile: 'transpile_failed',
  import: 'import_success',
  export: 'export_success',
  shortcut: 'shortcut_conflict',
  hidden: 'hidden_cards_restored',
  locked: 'locked_card',
})

// Retourne l'expression du robot pour un type de notification.
export function mascotForType(type) {
  const state = typeStates[type] ?? type
  return mascotStates[state] ?? mascotStates.info
}

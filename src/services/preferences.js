// Une préférence inaccessible ne doit pas empêcher l'ouverture de l'interface locale.
export function readPreference(key) {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('Interface preferences could not be read.', error)
    return null
  }
}

// Signale un échec de préférence sans le confondre avec l'enregistrement du workspace.
export function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch (error) {
    console.warn('Interface preferences could not be saved.', error)
  }
}

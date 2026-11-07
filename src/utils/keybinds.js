export const keybindStorageKey = 'sapphire-keybinds'

// Catalogue central : identifiants stables, libellés traduisibles et valeurs par défaut.
export const keybindCategories = Object.freeze([
  {
    id: 'workspace',
    labelKey: 'keybind.category.workspace',
    actions: Object.freeze([
      Object.freeze({ id: 'workspace.new', labelKey: 'nav.new', defaultShortcut: 'Ctrl+N' }),
      Object.freeze({ id: 'workspace.open', labelKey: 'nav.openWorkspace', defaultShortcut: 'Ctrl+O' }),
      Object.freeze({ id: 'workspace.save', labelKey: 'nav.saveWorkspace', defaultShortcut: 'Ctrl+S', allowInInput: true }),
    ]),
  },
  {
    id: 'edit',
    labelKey: 'keybind.category.edit',
    actions: Object.freeze([
      Object.freeze({ id: 'edit.undo', labelKey: 'nav.undo', defaultShortcut: 'Ctrl+Z' }),
      Object.freeze({ id: 'edit.redo', labelKey: 'nav.redo', defaultShortcut: 'Ctrl+Y' }),
      Object.freeze({ id: 'edit.copyNode', labelKey: 'transfer.copy', defaultShortcut: 'Ctrl+C' }),
      Object.freeze({ id: 'edit.pasteNode', labelKey: 'transfer.paste', defaultShortcut: 'Ctrl+V' }),
      Object.freeze({ id: 'edit.search', labelKey: 'nav.search', defaultShortcut: 'Ctrl+F', allowInInput: true }),
    ]),
  },
  {
    id: 'navigation',
    labelKey: 'keybind.category.navigation',
    actions: Object.freeze([
      Object.freeze({ id: 'navigation.center', labelKey: 'nav.center', defaultShortcut: 'Ctrl+Shift+F' }),
      Object.freeze({ id: 'navigation.zoom100', labelKey: 'nav.zoom100', defaultShortcut: 'Ctrl+0' }),
      Object.freeze({ id: 'navigation.toggleMinimap', labelKey: 'nav.minimap', defaultShortcut: 'Ctrl+M' }),
    ]),
  },
  {
    id: 'execution',
    labelKey: 'keybind.category.execution',
    actions: Object.freeze([
      Object.freeze({ id: 'execution.run', labelKey: 'run.simulateSp3', defaultShortcut: 'F5' }),
      Object.freeze({ id: 'execution.stop', labelKey: 'simulation.stop', defaultShortcut: 'Shift+F5' }),
      Object.freeze({ id: 'execution.debug', labelKey: 'run.debugSp3', defaultShortcut: 'F6' }),
    ]),
  },
])

// Liste plate utilisée par les hooks et l'interface.
export const keybindActions = Object.freeze(keybindCategories.flatMap((category) => category.actions))
export const defaultKeybinds = Object.freeze(Object.fromEntries(keybindActions.map((action) => [action.id, action.defaultShortcut])))

const modifierAliases = Object.freeze({ ctrl: 'Ctrl', control: 'Ctrl', cmd: 'Ctrl', command: 'Ctrl', meta: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift' })
const specialKeys = Object.freeze({
  escape: 'Escape', esc: 'Escape', enter: 'Enter', return: 'Enter', tab: 'Tab', space: 'Space', backspace: 'Backspace', delete: 'Delete', del: 'Delete',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
})

// Normalise une touche sans dépendre de la disposition affichée par le navigateur.
function keyToken(value) {
  if (typeof value !== 'string' || value === '') return null
  if (value === ' ') return 'Space'
  if (value.length === 1) return value.toUpperCase()
  const lower = value.toLowerCase()
  if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase()
  return specialKeys[lower] ?? null
}

// Convertit un événement clavier en combinaison canonique, ou null pour une touche seule/modificatrice.
export function shortcutFromEvent(event) {
  if (!event || event.repeat || event.isComposing) return null
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Dead'].includes(event.key)) return null
  const key = keyToken(event.key)
  if (!key) return null
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

// Normalise une combinaison textuelle dans le même ordre que shortcutFromEvent.
export function normalizeShortcut(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let ctrl = false
  let alt = false
  let shift = false
  let key = null
  for (const token of value.split('+').map((part) => part.trim()).filter(Boolean)) {
    const modifier = modifierAliases[token.toLowerCase()]
    if (modifier === 'Ctrl') ctrl = true
    else if (modifier === 'Alt') alt = true
    else if (modifier === 'Shift') shift = true
    else if (key !== null) return null
    else key = keyToken(token)
  }
  if (!key) return null
  return [ctrl ? 'Ctrl' : null, alt ? 'Alt' : null, shift ? 'Shift' : null, key].filter(Boolean).join('+')
}

// Rend une combinaison lisible sans changer sa valeur normalisée.
export function formatShortcut(shortcut) {
  return shortcut ? shortcut.split('+').join(' + ') : ''
}

// Liste les combinaisons attribuées à plusieurs actions.
export function findKeybindConflicts(bindings) {
  const owners = new Map()
  for (const action of keybindActions) {
    const shortcut = bindings?.[action.id]
    if (!shortcut) continue
    if (!owners.has(shortcut)) owners.set(shortcut, [])
    owners.get(shortcut).push(action.id)
  }
  return [...owners.entries()].filter(([, ids]) => ids.length > 1).map(([shortcut, actionIds]) => ({ shortcut, actionIds }))
}

// Résout les raccourcis stockés au-dessus des valeurs par défaut, en écartant les données invalides ou conflictuelles.
export function resolveKeybinds(stored = {}) {
  const custom = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  const result = {}
  const used = new Set()
  for (const action of keybindActions) {
    let value
    if (Object.hasOwn(custom, action.id)) {
      value = custom[action.id] === '' ? '' : normalizeShortcut(custom[action.id]) ?? defaultKeybinds[action.id]
    } else {
      value = defaultKeybinds[action.id]
    }
    if (value && used.has(value)) value = defaultKeybinds[action.id]
    if (value && used.has(value)) value = ''
    if (value) used.add(value)
    result[action.id] = value
  }
  return result
}

// Applique une nouvelle combinaison après normalisation et refus des doublons.
export function applyKeybind(bindings, id, shortcut) {
  if (!Object.hasOwn(defaultKeybinds, id)) return { ok: false, code: 'KEYBIND_UNKNOWN' }
  const normalized = normalizeShortcut(shortcut)
  if (!normalized) return { ok: false, code: 'KEYBIND_INVALID' }
  const owner = keybindActions.find((action) => action.id !== id && bindings?.[action.id] === normalized)
  if (owner) return { ok: false, code: 'KEYBIND_CONFLICT', conflictId: owner.id }
  return { ok: true, bindings: { ...bindings, [id]: normalized } }
}

// Retire explicitement la combinaison d'une action.
export function clearKeybind(bindings, id) {
  if (!Object.hasOwn(defaultKeybinds, id)) return { ok: false, code: 'KEYBIND_UNKNOWN' }
  return { ok: true, bindings: { ...bindings, [id]: '' } }
}

// Réinitialise une action après vérification du conflit avec sa valeur par défaut.
export function resetKeybind(bindings, id) {
  return applyKeybind(bindings, id, defaultKeybinds[id])
}

// Restaure toutes les valeurs par défaut.
export function resetAllKeybinds() {
  return { ...defaultKeybinds }
}

// Lit un stockage JSON sans faire confiance à sa forme.
export function parseKeybinds(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// N'écrit que les personnalisations réelles, pour conserver les futurs défauts.
export function serializeKeybinds(bindings) {
  const custom = {}
  for (const action of keybindActions) {
    if (bindings?.[action.id] !== defaultKeybinds[action.id]) custom[action.id] = bindings?.[action.id] ?? ''
  }
  return JSON.stringify(custom)
}

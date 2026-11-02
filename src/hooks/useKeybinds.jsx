import { useEffect, useRef, useState } from 'react'
import { hydratePreferences, readPreference, writePreference } from '../services/preferences.js'
import { applyKeybind, clearKeybind, defaultKeybinds, keybindStorageKey, parseKeybinds, resetAllKeybinds, resetKeybind, resolveKeybinds, serializeKeybinds } from '../utils/keybinds.js'

// Charge, valide et persiste les personnalisations de raccourcis dans les préférences existantes.
export default function useKeybinds() {
  const [bindings, setBindings] = useState(() => resolveKeybinds(parseKeybinds(readPreference(keybindStorageKey))))
  const bindingsRef = useRef(bindings)
  const dirty = useRef(false)

  useEffect(() => {
    let active = true
    hydratePreferences().then(() => {
      if (!active || dirty.current) return
      const next = resolveKeybinds(parseKeybinds(readPreference(keybindStorageKey)))
      bindingsRef.current = next
      setBindings(next)
    })
    return () => { active = false }
  }, [])

  // Met à jour l'état et la préférence durable sans écrire de raccourcis dans le workspace.
  function commit(next) {
    dirty.current = true
    bindingsRef.current = next
    setBindings(next)
    writePreference(keybindStorageKey, serializeKeybinds(next))
  }

  // Affecte une combinaison si elle ne conflictualise aucune autre action active.
  function assign(id, shortcut) {
    const result = applyKeybind(bindingsRef.current, id, shortcut)
    if (result.ok) commit(result.bindings)
    return result
  }

  // Retire la combinaison d'une action.
  function clear(id) {
    const result = clearKeybind(bindingsRef.current, id)
    if (result.ok) commit(result.bindings)
    return result
  }

  // Restaure la valeur par défaut d'une seule action.
  function reset(id) {
    const result = resetKeybind(bindingsRef.current, id)
    if (result.ok) commit(result.bindings)
    return result
  }

  // Restaure toutes les valeurs par défaut.
  function resetAll() {
    commit(resetAllKeybinds())
    return { ok: true }
  }

  // Indique si l'action a été personnalisée par rapport au catalogue.
  function isCustom(id) {
    return bindings[id] !== defaultKeybinds[id]
  }

  return { bindings, assign, clear, reset, resetAll, isCustom }
}

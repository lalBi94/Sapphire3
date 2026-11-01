import { readPreference, writePreference } from './preferences.js'

// Bibliothèque personnelle de fonctions/modules purs, conservée hors des projets et hors du workspace.
const storageKey = 'sapphire-bookmarks'
const maximumBookmarks = 50

// Vérifie la forme minimale d'un favori relu du stockage avant de l'exposer à l'interface.
function isValidBookmark(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (typeof entry.id !== 'string' || typeof entry.name !== 'string') return false
  if (!['function', 'module'].includes(entry.kind)) return false
  if (entry.version !== 1) return false
  if (!Array.isArray(entry.rootNodeIds) || !Array.isArray(entry.nodes) || entry.nodes.length === 0) return false
  return true
}

// Relit la bibliothèque depuis le cache local ; les données invalides sont ignorées sans bloquer.
export function loadBookmarks() {
  try {
    const stored = JSON.parse(readPreference(storageKey) ?? '[]')
    return Array.isArray(stored) ? stored.filter(isValidBookmark).slice(0, maximumBookmarks) : []
  } catch {
    return []
  }
}

// Écrit la bibliothèque dans le cache local puis la copie durable native.
export function saveBookmarks(bookmarks) {
  writePreference(storageKey, JSON.stringify(bookmarks.slice(0, maximumBookmarks)))
}

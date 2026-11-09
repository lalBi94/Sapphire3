import { createContext, useContext, useEffect, useState } from 'react'
import { readPreference, writePreference } from '../services/preferences.js'
import { customThemesKey, parseCustomThemes, presetThemes, resolveCustomColors } from '../utils/theme.js'


const ThemeContext = createContext(null)

// Retrouve un thème prédéfini par identifiant, sinon le premier.
function findPreset(id) {
  return presetThemes.find((theme) => theme.id === id) ?? presetThemes[0]
}

// Résout un thème personnalisé : ses couleurs remplacent celles des deux variantes de son thème de base.
function resolveTheme(entry) {
  const base = findPreset(entry.baseId)
  return {
    id: entry.id,
    name: entry.name,
    mode: entry.mode,
    custom: true,
    baseId: entry.baseId,
    overrides: entry.overrides,
    colors: resolveCustomColors(base.colors, entry.overrides),
    lightColors: resolveCustomColors(base.lightColors, entry.overrides),
  }
}

// Applique les couleurs d'un thème aux variables CSS communes de l'application.
function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.themeMode = theme.mode
  root.style.colorScheme = theme.mode
  // Retire les variables du thème précédent pour laisser tokens.css fournir les valeurs absentes de la variante.
  for (const property of Array.from(root.style)) {
    if (property.startsWith('--')) root.style.removeProperty(property)
  }
  for (const [property, value] of Object.entries(theme.colors)) root.style.setProperty(property, value)
}

// Fournit le thème actif, le catalogue prédéfini et les thèmes créés par l'utilisateur.
export default function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => readPreference('sapphire-theme') ?? presetThemes[0].id)
  const [themeMode, setThemeModeState] = useState(() => readPreference('sapphire-theme-mode') === 'light' ? 'light' : 'dark')
  const [customEntries, setCustomEntries] = useState(() => parseCustomThemes(readPreference(customThemesKey), presetThemes.map((theme) => theme.id)))
  const customThemes = customEntries.map(resolveTheme)
  const selectedTheme = customThemes.find((entry) => entry.id === themeId) ?? findPreset(themeId)
  const theme = { ...selectedTheme, mode: themeMode, colors: themeMode === 'light' ? selectedTheme.lightColors : selectedTheme.colors }

  useEffect(() => {
    const selected = customEntries.map(resolveTheme).find((entry) => entry.id === themeId) ?? findPreset(themeId)
    applyTheme({ id: selected.id, mode: themeMode, colors: themeMode === 'light' ? selected.lightColors : selected.colors })
    writePreference('sapphire-theme', selected.id)
    writePreference('sapphire-theme-mode', themeMode)
  }, [themeId, themeMode, customEntries])

  // Active un thème prédéfini ou personnalisé existant, sinon le thème par défaut.
  function setTheme(id) {
    const known = presetThemes.some((entry) => entry.id === id) || customEntries.some((entry) => entry.id === id)
    setThemeId(known ? id : presetThemes[0].id)
  }

  // Bascule l'application entre variante sombre et variante claire, pour tous les thèmes.
  function setThemeMode(mode) {
    setThemeModeState(mode === 'light' ? 'light' : 'dark')
  }

  // Crée un thème personnalisé copié du thème actif, le persiste et l'active, puis renvoie son identifiant.
  function createTheme(name) {
    const entry = { id: `custom-${crypto.randomUUID()}`, name, baseId: theme.custom ? theme.baseId : theme.id, mode: themeMode, overrides: {} }
    const next = [...customEntries, entry]
    setCustomEntries(next)
    writePreference(customThemesKey, JSON.stringify(next))
    setThemeId(entry.id)
    return entry.id
  }

  // Met à jour le nom ou les couleurs d'un thème personnalisé et conserve la nouvelle liste.
  function updateTheme(id, patch) {
    const next = customEntries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry)
    setCustomEntries(next)
    writePreference(customThemesKey, JSON.stringify(next))
  }

  // Retire un thème personnalisé ; le thème actif retombe sur le premier prédéfini.
  function deleteTheme(id) {
    const next = customEntries.filter((entry) => entry.id !== id)
    setCustomEntries(next)
    writePreference(customThemesKey, JSON.stringify(next))
    setThemeId((current) => current === id ? presetThemes[0].id : current)
  }

  return <ThemeContext.Provider value={{ theme, themeMode, presetThemes, customThemes, setTheme, setThemeMode, createTheme, updateTheme, deleteTheme }}>{children}</ThemeContext.Provider>
}

// Accède au catalogue, aux thèmes personnalisés et au thème actif depuis un composant React.
export function useTheme() {
  return useContext(ThemeContext)
}

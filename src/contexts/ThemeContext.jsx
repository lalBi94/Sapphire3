import { createContext, useContext, useEffect, useState } from 'react'
import { readPreference, writePreference } from '../services/preferences.js'
import { customThemesKey, parseCustomThemes, resolveCustomColors } from '../utils/theme.js'

const presetThemes = [
  {
    id: 'sapphire',
    labelKey: 'theme.sapphire',
    mode: 'dark',
    colors: {
      '--color-black': '#0e0e12',
      '--color-anthracite': '#19191f',
      '--color-anthracite-raised': '#24242c',
      '--color-yellow': '#f5d547',
      '--color-yellow-hover': '#ffe777',
      '--color-yellow-active': '#dbba30',
      '--color-yellow-soft': '#f5d54718',
      '--color-violet': '#c4b1ff',
      '--color-violet-soft': '#c4b1ff18',
      '--color-violet-border': '#c4b1ff88',
      '--color-grid': '#ffffff0c',
      '--color-canvas-edge': '#07070b99',
      '--color-text': '#f2f1f6',
      '--color-text-muted': '#b5b2c2',
      '--color-module-surface': '#19191ff5',
      '--color-comment-surface': '#211f28f5',
      '--color-border': '#ffffff24',
      '--color-border-hover': '#ffffff48',
      '--color-hover': '#ffffff0d',
      '--color-on-primary': '#0e0e12',
      '--color-diagnostic': '#f3b1a3',
      '--color-input': '#101015',
      '--color-glass-reflection': '#ffffff08',
      '--color-glass-highlight': '#ffffff12',
      '--color-glass': '#24242ce8',
      '--mascot-filter': 'brightness(1)',
      '--color-node-variable': '#6f9ff5',
      '--color-node-type': '#5fc9d8',
      '--color-node-function': '#b58cf0',
      '--color-node-parameter': '#e39ad0',
      '--color-node-condition': '#d9a441',
      '--color-node-loop': '#e07a3f',
      '--color-node-return': '#e05c6e',
      '--color-node-block': '#7d8798',
      '--color-node-statement': '#7fb069',
      '--color-node-operator': '#4fb3a8',
      '--color-node-value': '#b5c95a',
      '--color-node-array': '#e8d06a',
      '--color-node-incomplete': '#d8b184',
    },
  },
  {
    id: 'void',
    labelKey: 'theme.void',
    mode: 'dark',
    colors: {
      '--color-black': '#06070a',
      '--color-anthracite': '#0c0f14',
      '--color-anthracite-raised': '#171c24',
      '--color-yellow': '#b6ff2e',
      '--color-yellow-hover': '#c8ff5a',
      '--color-yellow-active': '#8fd61f',
      '--color-yellow-soft': '#b6ff2e18',
      '--color-violet': '#6ee7ff',
      '--color-violet-soft': '#6ee7ff18',
      '--color-violet-border': '#6ee7ff88',
      '--color-grid': '#b6ff2e0d',
      '--color-canvas-edge': '#030407cc',
      '--color-text': '#e8edf2',
      '--color-text-muted': '#9ca7b5',
      '--color-module-surface': '#0c0f14fa',
      '--color-comment-surface': '#11161d',
      '--color-border': '#2a313d',
      '--color-border-hover': '#3c4656',
      '--color-hover': '#ffffff08',
      '--color-on-primary': '#06070a',
      '--color-diagnostic': '#ffb020',
      '--color-input': '#0a0d12',
      '--color-glass-reflection': '#ffffff05',
      '--color-glass-highlight': '#ffffff0a',
      '--color-glass': '#0c0f14f5',
      '--mascot-filter': 'sepia(1) saturate(2.8) hue-rotate(42deg) brightness(1.05)',
      '--color-node-variable': '#5fa8ff',
      '--color-node-type': '#4fd8c8',
      '--color-node-function': '#ff7ae0',
      '--color-node-parameter': '#c79bff',
      '--color-node-condition': '#ffb020',
      '--color-node-loop': '#ff8a3d',
      '--color-node-return': '#ff5a5f',
      '--color-node-block': '#7d8798',
      '--color-node-statement': '#7fd16b',
      '--color-node-operator': '#6ee7ff',
      '--color-node-value': '#c8e86a',
      '--color-node-array': '#e8d06a',
      '--color-node-incomplete': '#d8b184',
    },
  },
  {
    id: 'neon',
    labelKey: 'theme.neon',
    mode: 'dark',
    colors: {
      '--color-black': '#0b0d1c',
      '--color-anthracite': '#14182c',
      '--color-anthracite-raised': '#202744',
      '--color-yellow': '#8ef0d0',
      '--color-yellow-hover': '#b0ffe6',
      '--color-yellow-active': '#63c9ab',
      '--color-yellow-soft': '#8ef0d020',
      '--color-violet': '#ff9fb2',
      '--color-violet-soft': '#ff9fb220',
      '--color-violet-border': '#ff9fb288',
      '--color-grid': '#8ef0d014',
      '--color-canvas-edge': '#05071299',
      '--color-text': '#eef5ff',
      '--color-text-muted': '#aab8d8',
      '--color-module-surface': '#14182cf5',
      '--color-comment-surface': '#1b2138f5',
      '--color-border': '#b9caff2e',
      '--color-border-hover': '#b9caff5c',
      '--color-hover': '#b9caff12',
      '--color-on-primary': '#0b0d1c',
      '--color-diagnostic': '#ffb3b8',
      '--color-input': '#0e1224',
      '--color-glass-reflection': '#c8d8ff08',
      '--color-glass-highlight': '#c8d8ff12',
      '--color-glass': '#202744e8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(130deg) brightness(1.08)',
      '--color-node-variable': '#7fb8ff',
      '--color-node-type': '#6fd8d0',
      '--color-node-function': '#bca6ff',
      '--color-node-parameter': '#f0a6d0',
      '--color-node-condition': '#e8c98a',
      '--color-node-loop': '#f0a07a',
      '--color-node-return': '#f08a9e',
      '--color-node-block': '#8a97b8',
      '--color-node-statement': '#93d09a',
      '--color-node-operator': '#64c8bb',
      '--color-node-value': '#c9d982',
      '--color-node-incomplete': '#d9b591',
    },
  },
  {
    id: 'mono',
    labelKey: 'theme.mono',
    mode: 'dark',
    colors: {
      '--color-black': '#101114',
      '--color-anthracite': '#1a1c22',
      '--color-anthracite-raised': '#262a32',
      '--color-yellow': '#e9e7f2',
      '--color-yellow-hover': '#fbfaff',
      '--color-yellow-active': '#c8c4d4',
      '--color-yellow-soft': '#e9e7f220',
      '--color-violet': '#b9b4c9',
      '--color-violet-soft': '#b9b4c920',
      '--color-violet-border': '#b9b4c988',
      '--color-grid': '#e9e7f210',
      '--color-canvas-edge': '#06060999',
      '--color-text': '#f5f4f8',
      '--color-text-muted': '#b1afba',
      '--color-module-surface': '#1a1c22f5',
      '--color-comment-surface': '#22252cf5',
      '--color-border': '#e9e7f22e',
      '--color-border-hover': '#e9e7f25c',
      '--color-hover': '#e9e7f212',
      '--color-on-primary': '#101114',
      '--color-diagnostic': '#f2b8b8',
      '--color-input': '#141519',
      '--color-glass-reflection': '#ffffff08',
      '--color-glass-highlight': '#ffffff12',
      '--color-glass': '#262a32e8',
      '--mascot-filter': 'grayscale(1) brightness(1.06) contrast(1.04)',
      '--color-node-variable': '#c3c8d4',
      '--color-node-type': '#d8dce5',
      '--color-node-function': '#eeeef5',
      '--color-node-parameter': '#b7b2c2',
      '--color-node-condition': '#d0cbd8',
      '--color-node-loop': '#aaaab6',
      '--color-node-return': '#e6dbe3',
      '--color-node-block': '#82858f',
      '--color-node-statement': '#bcc6c0',
      '--color-node-operator': '#a0a8ad',
      '--color-node-value': '#d8dabf',
      '--color-node-incomplete': '#bdb1a8',
    },
  },
  {
    id: 'rose',
    labelKey: 'theme.rose',
    mode: 'dark',
    colors: {
      '--color-black': '#150e16',
      '--color-anthracite': '#211726',
      '--color-anthracite-raised': '#32233b',
      '--color-yellow': '#f2a6c4',
      '--color-yellow-hover': '#ffc5da',
      '--color-yellow-active': '#d484a5',
      '--color-yellow-soft': '#f2a6c420',
      '--color-violet': '#c7b2ff',
      '--color-violet-soft': '#c7b2ff20',
      '--color-violet-border': '#c7b2ff88',
      '--color-grid': '#f2a6c412',
      '--color-canvas-edge': '#0b060b99',
      '--color-text': '#fdf3f8',
      '--color-text-muted': '#cdb2c1',
      '--color-module-surface': '#211726f5',
      '--color-comment-surface': '#2b1c32f5',
      '--color-border': '#f7cde02e',
      '--color-border-hover': '#f7cde05c',
      '--color-hover': '#f7cde012',
      '--color-on-primary': '#150e16',
      '--color-diagnostic': '#f7b2aa',
      '--color-input': '#190f1a',
      '--color-glass-reflection': '#ffd6e808',
      '--color-glass-highlight': '#ffd6e812',
      '--color-glass': '#32233be8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(300deg) brightness(1.06)',
      '--color-node-variable': '#97c0ff',
      '--color-node-type': '#7fd8d0',
      '--color-node-function': '#c5a8ff',
      '--color-node-parameter': '#f2a6d0',
      '--color-node-condition': '#e8ca8c',
      '--color-node-loop': '#f0a27c',
      '--color-node-return': '#f28ca0',
      '--color-node-block': '#a995a3',
      '--color-node-statement': '#9bd49c',
      '--color-node-operator': '#74ccbe',
      '--color-node-value': '#d6e084',
      '--color-node-incomplete': '#deba9e',
    },
  },
  {
    id: 'pro',
    labelKey: 'theme.pro',
    mode: 'dark',
    colors: {
      '--color-black': '#0c111b',
      '--color-anthracite': '#151c2a',
      '--color-anthracite-raised': '#202a3c',
      '--color-yellow': '#9db8ff',
      '--color-yellow-hover': '#bdcfff',
      '--color-yellow-active': '#7d98e0',
      '--color-yellow-soft': '#9db8ff20',
      '--color-violet': '#e8c78a',
      '--color-violet-soft': '#e8c78a20',
      '--color-violet-border': '#e8c78a88',
      '--color-grid': '#9db8ff14',
      '--color-canvas-edge': '#05080f99',
      '--color-text': '#eef2fa',
      '--color-text-muted': '#a9b5c8',
      '--color-module-surface': '#151c2af5',
      '--color-comment-surface': '#1c2536f5',
      '--color-border': '#c4d3ff2e',
      '--color-border-hover': '#c4d3ff5c',
      '--color-hover': '#c4d3ff12',
      '--color-on-primary': '#0c111b',
      '--color-diagnostic': '#f2b0b0',
      '--color-input': '#0f1622',
      '--color-glass-reflection': '#d4e0ff08',
      '--color-glass-highlight': '#d4e0ff12',
      '--color-glass': '#202a3ce8',
      '--mascot-filter': 'sepia(1) saturate(2) hue-rotate(187deg) brightness(1.06)',
      '--color-node-variable': '#82b8ff',
      '--color-node-type': '#6fd8d0',
      '--color-node-function': '#b3a6f0',
      '--color-node-parameter': '#e8a6c8',
      '--color-node-condition': '#e8c78a',
      '--color-node-loop': '#e8a07a',
      '--color-node-return': '#e88a98',
      '--color-node-block': '#8797ad',
      '--color-node-statement': '#93cf9c',
      '--color-node-operator': '#64c8bc',
      '--color-node-value': '#c9d982',
      '--color-node-incomplete': '#d4b594',
    },
  },
  {
    id: 'educational',
    labelKey: 'theme.educational',
    mode: 'dark',
    colors: {
      '--color-black': '#12110e',
      '--color-anthracite': '#1d1b16',
      '--color-anthracite-raised': '#2a2720',
      '--color-yellow': '#e8c98a',
      '--color-yellow-hover': '#f5dbaa',
      '--color-yellow-active': '#c9a96a',
      '--color-yellow-soft': '#e8c98a20',
      '--color-violet': '#a9c7b8',
      '--color-violet-soft': '#a9c7b820',
      '--color-violet-border': '#a9c7b888',
      '--color-grid': '#e8c98a12',
      '--color-canvas-edge': '#09080599',
      '--color-text': '#f7f2e8',
      '--color-text-muted': '#c2b9a9',
      '--color-module-surface': '#1d1b16f5',
      '--color-comment-surface': '#25221bf5',
      '--color-border': '#f0dfc02e',
      '--color-border-hover': '#f0dfc05c',
      '--color-hover': '#f0dfc012',
      '--color-on-primary': '#12110e',
      '--color-diagnostic': '#f0b0a0',
      '--color-input': '#17150f',
      '--color-glass-reflection': '#fff0d608',
      '--color-glass-highlight': '#fff0d612',
      '--color-glass': '#2a2720e8',
      '--mascot-filter': 'sepia(1) saturate(1.6) brightness(1.04)',
      '--color-node-variable': '#8fb8e8',
      '--color-node-type': '#7fd0c8',
      '--color-node-function': '#c0a6e8',
      '--color-node-parameter': '#e8a6c8',
      '--color-node-condition': '#e0c27a',
      '--color-node-loop': '#e09a70',
      '--color-node-return': '#e08a88',
      '--color-node-block': '#948e80',
      '--color-node-statement': '#9bc78f',
      '--color-node-operator': '#6cc0ae',
      '--color-node-value': '#c8d078',
      '--color-node-incomplete': '#d0b08a',
    },
  },
]

const ThemeContext = createContext(null)

// Retrouve un thème prédéfini par identifiant, sinon le premier.
function findPreset(id) {
  return presetThemes.find((theme) => theme.id === id) ?? presetThemes[0]
}

// Résout un thème personnalisé : ses couleurs remplacent celles de son thème de base.
function resolveTheme(entry) {
  const base = findPreset(entry.baseId)
  return { id: entry.id, name: entry.name, mode: entry.mode, custom: true, overrides: entry.overrides, colors: resolveCustomColors(base.colors, entry.overrides) }
}

// Applique les couleurs d'un thème aux variables CSS communes de l'application.
function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.mode
  for (const [property, value] of Object.entries(theme.colors)) root.style.setProperty(property, value)
}

// Fournit le thème actif, le catalogue prédéfini et les thèmes créés par l'utilisateur.
export default function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => readPreference('sapphire-theme') ?? presetThemes[0].id)
  const [customEntries, setCustomEntries] = useState(() => parseCustomThemes(readPreference(customThemesKey), presetThemes.map((theme) => theme.id)))
  const customThemes = customEntries.map(resolveTheme)
  const theme = customThemes.find((entry) => entry.id === themeId) ?? findPreset(themeId)

  useEffect(() => {
    applyTheme(theme)
    writePreference('sapphire-theme', theme.id)
  }, [theme])

  // Active un thème prédéfini ou personnalisé existant, sinon le thème par défaut.
  function setTheme(id) {
    const known = presetThemes.some((entry) => entry.id === id) || customEntries.some((entry) => entry.id === id)
    setThemeId(known ? id : presetThemes[0].id)
  }

  // Crée un thème personnalisé copié du thème actif, le persiste et l'active, puis renvoie son identifiant.
  function createTheme(name) {
    const entry = { id: `custom-${crypto.randomUUID()}`, name, baseId: theme.custom ? theme.baseId : theme.id, mode: theme.mode, overrides: {} }
    const next = [...customEntries, entry]
    setCustomEntries(next)
    writePreference(customThemesKey, JSON.stringify(next))
    setThemeId(entry.id)
    return entry.id
  }

  // Met à jour le nom, le mode ou les couleurs d'un thème personnalisé et conserve la nouvelle liste.
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

  return <ThemeContext.Provider value={{ theme, presetThemes, customThemes, setTheme, createTheme, updateTheme, deleteTheme }}>{children}</ThemeContext.Provider>
}

// Accède au catalogue, aux thèmes personnalisés et au thème actif depuis un composant React.
export function useTheme() {
  return useContext(ThemeContext)
}

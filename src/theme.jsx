import { createContext, useContext, useEffect, useState } from 'react'

const themes = [
  {
    id: 'sapphire',
    labelKey: 'theme.sapphire',
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
      '--color-node-incomplete': '#d8b184',
    },
    simulation: {},
  },
  {
    id: 'ember',
    labelKey: 'theme.ember',
    colors: {
      '--color-black': '#130d0d',
      '--color-anthracite': '#211616',
      '--color-anthracite-raised': '#322020',
      '--color-yellow': '#ffb86b',
      '--color-yellow-hover': '#ffd08f',
      '--color-yellow-active': '#df8d43',
      '--color-yellow-soft': '#ffb86b1c',
      '--color-violet': '#ff9fa8',
      '--color-violet-soft': '#ff9fa81c',
      '--color-violet-border': '#ff9fa888',
      '--color-grid': '#ffd6c00d',
      '--color-canvas-edge': '#0d060699',
      '--color-text': '#fff2e9',
      '--color-text-muted': '#c8aaa0',
      '--color-module-surface': '#211616f5',
      '--color-comment-surface': '#2d1d1df5',
      '--color-border': '#ffe5d424',
      '--color-border-hover': '#ffe5d448',
      '--color-hover': '#ffe5d40d',
      '--color-on-primary': '#130d0d',
      '--color-diagnostic': '#ffb0a3',
      '--color-input': '#180e0e',
      '--color-glass-reflection': '#fff0e008',
      '--color-glass-highlight': '#fff0e012',
      '--color-glass': '#322020e8',
      '--color-node-variable': '#80bfff',
      '--color-node-type': '#69d6ce',
      '--color-node-function': '#d39bff',
      '--color-node-parameter': '#ff9fd0',
      '--color-node-condition': '#f0c46d',
      '--color-node-loop': '#f28d5e',
      '--color-node-return': '#ff7182',
      '--color-node-block': '#a58f8a',
      '--color-node-statement': '#9bc77c',
      '--color-node-operator': '#63c9b8',
      '--color-node-value': '#d8dc73',
      '--color-node-incomplete': '#e7bd91',
    },
    simulation: {},
  },
  {
    id: 'forest',
    labelKey: 'theme.forest',
    colors: {
      '--color-black': '#0b1110',
      '--color-anthracite': '#14201d',
      '--color-anthracite-raised': '#20302b',
      '--color-yellow': '#b9df73',
      '--color-yellow-hover': '#d6f39a',
      '--color-yellow-active': '#91bb4e',
      '--color-yellow-soft': '#b9df731c',
      '--color-violet': '#a8c7ff',
      '--color-violet-soft': '#a8c7ff1c',
      '--color-violet-border': '#a8c7ff88',
      '--color-grid': '#d9f5e40d',
      '--color-canvas-edge': '#05090899',
      '--color-text': '#edf8f1',
      '--color-text-muted': '#a9c1b4',
      '--color-module-surface': '#14201df5',
      '--color-comment-surface': '#1b2923f5',
      '--color-border': '#d9f5e424',
      '--color-border-hover': '#d9f5e448',
      '--color-hover': '#d9f5e40d',
      '--color-on-primary': '#0b1110',
      '--color-diagnostic': '#ffb29c',
      '--color-input': '#0c1713',
      '--color-glass-reflection': '#e9fff008',
      '--color-glass-highlight': '#e9fff012',
      '--color-glass': '#20302be8',
      '--color-node-variable': '#82b8ff',
      '--color-node-type': '#62d1c2',
      '--color-node-function': '#bea3ff',
      '--color-node-parameter': '#ec9ed5',
      '--color-node-condition': '#dfc267',
      '--color-node-loop': '#e8905f',
      '--color-node-return': '#ec7182',
      '--color-node-block': '#8ea69a',
      '--color-node-statement': '#8bcf78',
      '--color-node-operator': '#63c7a6',
      '--color-node-value': '#c9d96c',
      '--color-node-incomplete': '#dbbd91',
    },
    simulation: {},
  },
]

const ThemeContext = createContext(null)

// Cherche un thème connu à partir de son identifiant persistant.
function findTheme(id) {
  return themes.find((theme) => theme.id === id) ?? themes[0]
}

// Applique les couleurs d'un thème aux variables CSS communes de l'application.
function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  for (const [property, value] of Object.entries(theme.colors)) root.style.setProperty(property, value)
}

// Fournit le thème actif et sa préférence d'interface à toute l'application.
export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => window.localStorage.getItem('sapphire-theme') ?? themes[0].id)
  const theme = findTheme(themeId)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem('sapphire-theme', theme.id)
  }, [theme])

  // Change le thème et conserve uniquement cette préférence d'interface.
  function setTheme(nextThemeId) {
    setThemeId(findTheme(nextThemeId).id)
  }

  return <ThemeContext.Provider value={{ theme, themes, setTheme }}>{children}</ThemeContext.Provider>
}

// Accède au catalogue et au thème actif depuis un composant React.
export function useTheme() {
  return useContext(ThemeContext)
}

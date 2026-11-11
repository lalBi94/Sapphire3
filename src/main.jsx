import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './pages/App.jsx'
import './styles/global.css'
import LanguageProvider from './contexts/LanguageContext.jsx'
import ThemeProvider from './contexts/ThemeContext.jsx'
import KeybindsProvider from './contexts/KeybindsContext.jsx'
import NotificationProvider from './contexts/NotificationContext.jsx'
import PluginProvider from './contexts/PluginContext.jsx'
import { initializePluginRuntime } from './services/plugins.js'

// Configure le registre de plugins avant la première analyse du document.
initializePluginRuntime()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <KeybindsProvider>
          <NotificationProvider>
            <PluginProvider>
              <App />
            </PluginProvider>
          </NotificationProvider>
        </KeybindsProvider>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)

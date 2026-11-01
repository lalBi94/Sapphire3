import { createContext, useContext, useEffect, useState } from 'react'
import { readPreference, writePreference } from '../services/preferences.js'
import { translate, translations } from '../utils/translations.js'

const LanguageContext = createContext(null)

// Langues écrites de droite à gauche : la direction HTML suit la langue active.
const rightToLeftLanguages = new Set(['ar'])

// Fournit une langue explicite aux composants, sans état global modifié pendant le rendu.
export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = readPreference('sapphire-language')
    return typeof stored === 'string' && Object.hasOwn(translations, stored) ? stored : 'en'
  })

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = rightToLeftLanguages.has(language) ? 'rtl' : 'ltr'
  }, [language])

  // Conserve uniquement la préférence de langue, jamais le contenu du workspace.
  function setLanguage(nextLanguage) {
    if (!Object.hasOwn(translations, nextLanguage)) return
    setLanguageState(nextLanguage)
    writePreference('sapphire-language', nextLanguage)
  }

  // Lie le catalogue pur à la langue de ce fournisseur React.
  function t(key, values) {
    return translate(language, key, values)
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

// Partage les textes et la langue entre les branches de l'interface.
export function useTranslation() {
  return useContext(LanguageContext)
}

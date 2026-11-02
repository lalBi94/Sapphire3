// Drapeaux simplifiés, dessinés localement pour rester hors ligne et cohérents avec les thèmes.
function Frame({ children }) {
  return <svg viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">{children}</svg>
}

// Rend le drapeau associé à la langue, sans image distante ni dépendance.
export default function LanguageFlag({ language }) {
  if (language === 'fr') return <Frame><rect width="24" height="16" fill="#fff" /><rect width="8" height="16" fill="#0055A4" /><rect x="16" width="8" height="16" fill="#EF4135" /></Frame>
  if (language === 'zh') return <Frame><rect width="24" height="16" fill="#DE2910" /><path d="M5 3l1.1 2.2 2.4.4-1.8 1.7.4 2.4L5 8.6 2.9 9.7l.4-2.4L1.5 5.6l2.4-.4z" fill="#FFDE00" /></Frame>
  if (language === 'es') return <Frame><rect width="24" height="16" fill="#AA151B" /><rect y="4" width="24" height="8" fill="#F1BF00" /></Frame>
  if (language === 'ar') return <Frame><rect width="24" height="16" fill="#006C35" /><rect x="3" y="6.5" width="18" height="3" fill="#fff" /></Frame>
  if (language === 'ja') return <Frame><rect width="24" height="16" fill="#fff" /><circle cx="12" cy="8" r="4.5" fill="#BC002D" /></Frame>
  if (language === 'hi') return <Frame><rect width="24" height="16" fill="#fff" /><rect width="24" height="5.33" fill="#FF9933" /><rect y="10.67" width="24" height="5.33" fill="#138808" /><circle cx="12" cy="8" r="2.2" fill="none" stroke="#000080" strokeWidth="1" /></Frame>
  if (language === 'ru') return <Frame><rect width="24" height="16" fill="#fff" /><rect y="5.33" width="24" height="5.34" fill="#0039A6" /><rect y="10.67" width="24" height="5.33" fill="#D52B1E" /></Frame>
  return <Frame>
    <rect width="24" height="16" fill="#012169" />
    <path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="4" />
    <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="2" />
    <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="6" />
    <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3" />
  </Frame>
}

// Couleurs dominantes du drapeau, utilisées pour les dégradés de sélection.
export const languageFlagColors = Object.freeze({
  en: ['#012169', '#ffffff', '#C8102E'],
  fr: ['#0055A4', '#ffffff', '#EF4135'],
  zh: ['#DE2910', '#FFDE00', '#DE2910'],
  es: ['#AA151B', '#F1BF00', '#AA151B'],
  ar: ['#006C35', '#ffffff', '#006C35'],
  ja: ['#ffffff', '#BC002D', '#ffffff'],
  hi: ['#FF9933', '#ffffff', '#138808'],
  ru: ['#ffffff', '#0039A6', '#D52B1E'],
})

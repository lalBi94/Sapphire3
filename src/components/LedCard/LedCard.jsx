import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './LedCard.css'

// Affiche un voyant booléen : éteint discret, allumé avec le dégradé et le halo du thème.
export default function LedCard({ card, state = null }) {
  const { t } = useTranslation()
  const name = card.name || t('card.led')
  const on = state?.value === true
  return <div className={`led-card${on ? ' led-card--on' : ''}`} data-canvas-scroll>
    <span className="led-card__lamp" role="img" aria-label={t(on ? 'led.on' : 'led.off', { name })} />
  </div>
}
import { X } from 'lucide-react'
import { useTranslation } from '../../i18n.jsx'
import './SimulationPanel.css'

// Affiche les sorties et l'erreur éventuelle de la dernière simulation locale.
export default function SimulationPanel({ result, running = false, currentStep = 0, onClose }) {
  const { t } = useTranslation()
  if (!result) return null
  return (
    <aside className="simulation-panel" data-canvas-ui data-canvas-scroll aria-label={t('simulation.title')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <header>
        <h2>{t('simulation.title')}</h2>
        <button type="button" aria-label={t('simulation.close')} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      {result.ok ? <><p className="simulation-panel__status">{running ? t('simulation.running') : t('simulation.completed')} · {currentStep}/{result.trace.length} {t('simulation.steps')}</p><pre>{result.output.join('\n') || t('simulation.noOutput')}</pre></> : <p className="simulation-panel__error" role="alert">{result.error}</p>}
    </aside>
  )
}

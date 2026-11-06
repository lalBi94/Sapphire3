import { useState } from 'react'
import { FastForward, Pause, Play, Square, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import usePanelFront from '../../hooks/usePanelFront.jsx'
import { failureLabel } from '../../utils/translations.js'
import { contractLabel } from '../../utils/logic/contracts.js'
import { clampSimulationSpeed, simulationSpeedMax, simulationSpeedMin } from '../../utils/simulationSpeed.js'
import './SimulationPanel.css'

// Affiche les sorties et l'erreur éventuelle de la dernière simulation locale, avec pause, reprise et arrêt.
export default function SimulationPanel({ result, running = false, paused = false, stopped = false, currentStep = 0, free = false, speed = 1, onClose, onPause, onResume, onStop, onToggleFree, onSpeedChange }) {
  const { t } = useTranslation()
  const [speedDraft, setSpeedDraft] = useState(String(speed))
  const front = usePanelFront({ title: result ? t('simulation.title') : null, onClose })
  if (!result) return null

  // Applique un préréglage et garde la saisie personnalisée alignée.
  function chooseSpeed(value) {
    setSpeedDraft(String(value))
    onSpeedChange?.(value)
  }

  // Valide la vitesse personnalisée à la sortie du champ ou avec Entrée.
  function commitSpeed() {
    const next = clampSimulationSpeed(speedDraft)
    setSpeedDraft(String(next))
    onSpeedChange?.(next)
  }

  const status = running ? t('simulation.running') : paused ? t('simulation.paused') : stopped ? t('simulation.stopped') : t('simulation.completed')
  // La sortie suit le pas courant, sauf en mode libre, après un arrêt ou quand aucune animation n'est active.
  const paced = !free && !stopped && currentStep > 0 && Array.isArray(result.outputSteps)
  const visibleOutput = paced ? result.output.slice(0, result.outputSteps.filter((step) => step <= currentStep).length) : result.output
  return (
    <aside className="simulation-panel" data-canvas-ui data-canvas-scroll aria-label={t('simulation.title')} style={front.zIndex ? { zIndex: front.zIndex } : undefined} onPointerDown={(event) => { front.bringToFront(); event.stopPropagation() }} onFocusCapture={front.bringToFront} onKeyDown={(event) => event.stopPropagation()}>
      <header>
        <h2>{t('simulation.title')}</h2>
        {(running || paused) && <button type="button" className="simulation-panel__control" aria-label={t('simulation.free')} aria-pressed={free} title={t('simulation.freeHint')} onClick={onToggleFree}><FastForward size={14} fill="currentColor" aria-hidden="true" />{t('simulation.free')}</button>}
        {running && <button type="button" className="simulation-panel__control" aria-label={t('simulation.pause')} title={t('simulation.pause')} onClick={onPause}><Pause size={14} fill="currentColor" aria-hidden="true" />{t('simulation.pause')}</button>}
        {paused && <button type="button" className="simulation-panel__control" aria-label={t('simulation.resume')} title={t('simulation.resume')} onClick={onResume}><Play size={14} fill="currentColor" aria-hidden="true" />{t('simulation.resume')}</button>}
        {(running || paused) && <button type="button" className="simulation-panel__control simulation-panel__control--danger" aria-label={t('simulation.stop')} title={t('simulation.stop')} onClick={onStop}><Square size={14} fill="currentColor" aria-hidden="true" />{t('simulation.stop')}</button>}
        <button type="button" aria-label={t('simulation.close')} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      {result.ok ? <><p className="simulation-panel__status" role="status">{status} · {currentStep}/{result.trace.length} {t(result.trace.length === 1 ? 'simulation.step' : 'simulation.steps')}</p>
        <div className="simulation-panel__speed">
          <span>{t('simulation.speed')}</span>
          {[1, 2, 3].map((value) => <button type="button" key={value} aria-pressed={speed === value} onClick={() => chooseSpeed(value)}>×{value}</button>)}
          <label className="simulation-panel__speed-custom">×<input type="number" min={simulationSpeedMin} max={simulationSpeedMax} step="1" value={speedDraft} aria-label={t('simulation.speed')} onChange={(event) => setSpeedDraft(event.target.value)} onBlur={commitSpeed} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
        </div>
        <pre>{visibleOutput.join('\n') || t('simulation.noOutput')}</pre>
        {result.contracts?.total > 0 && <section className="simulation-panel__contracts" aria-label={t('contracts.title')}>
          <h3>{t('contracts.title')}</h3>
          {result.contracts.violations.length === 0
            ? <p role="status">{t('contracts.satisfied', { count: result.contracts.total })}</p>
            : <ul>{result.contracts.violations.map((violation, position) => <li key={position} role="alert">{t('contracts.violated', { name: violation.name, rule: contractLabel(violation, t), step: violation.step, value: violation.value })}</li>)}</ul>}
        </section>}</> : <p className="simulation-panel__error" role="alert">{failureLabel({ code: result.errorCode ?? 'SIMULATION_FAILED' }, t)}</p>}
    </aside>
  )
}

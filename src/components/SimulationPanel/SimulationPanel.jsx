import { useRef, useState } from 'react'
import { FastForward, Pause, Play, Square, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import usePanelFront from '../../hooks/usePanelFront.jsx'
import { failureLabel } from '../../utils/translations.js'
import { contractLabel } from '../../utils/logic/contracts.js'
import { clampSimulationSpeed, simulationSpeedMax, simulationSpeedMin } from '../../utils/simulationSpeed.js'
import './SimulationPanel.css'

// Affiche les sorties et l'erreur éventuelle de la dernière simulation locale, avec pause, reprise et arrêt.
export default function SimulationPanel({ result, live = false, running = false, paused = false, stopped = false, currentStep = 0, free = false, speed = 1, onClose, onPause, onResume, onStop, onToggleFree, onSpeedChange }) {
  const { t } = useTranslation()
  const [speedDraft, setSpeedDraft] = useState(String(speed))
  const [position, setPosition] = useState(null)
  const gestureRef = useRef(null)
  const panelRef = useRef(null)
  const front = usePanelFront({ title: result ? t('simulation.title') : null, onClose })
  if (!result) return null

  // Mesure la bulle dans son canvas avant un déplacement.
  function measure() {
    const panel = panelRef.current
    const parent = panel?.offsetParent
    if (!parent) return null
    const bounds = panel.getBoundingClientRect()
    const area = parent.getBoundingClientRect()
    return { x: bounds.left - area.left, y: bounds.top - area.top, width: bounds.width, height: bounds.height, areaWidth: area.width, areaHeight: area.height }
  }

  // Borne la nouvelle position au canvas, sans sortir la bulle par un bord.
  function apply(origin, dx, dy) {
    setPosition({
      x: Math.min(Math.max(8, origin.areaWidth - origin.width - 8), Math.max(8, origin.x + dx)),
      y: Math.min(Math.max(8, origin.areaHeight - origin.height - 8), Math.max(8, origin.y + dy)),
    })
  }

  // Capture le geste depuis l'en-tête, hors boutons d'action.
  function start(event) {
    if (event.button !== 0 || gestureRef.current || event.target.closest('button')) return
    const origin = measure()
    if (!origin) return
    event.preventDefault()
    event.stopPropagation()
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture indisponible */ }
  }

  // Suit le pointeur pendant le déplacement.
  function move(event) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    apply(gesture.origin, event.clientX - gesture.x, event.clientY - gesture.y)
  }

  // Libère le geste après relâchement, annulation ou perte de capture.
  function end(event) {
    if (gestureRef.current?.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Offre le même déplacement aux flèches du clavier.
  function keyDown(event) {
    if (event.target !== event.currentTarget) return
    const directions = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
    const direction = directions[event.key]
    if (!direction) return
    const origin = measure()
    if (!origin) return
    event.preventDefault()
    apply(origin, ...direction)
  }

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
  const paced = !live && !free && !stopped && currentStep > 0 && Array.isArray(result.outputSteps)
  const visibleOutput = paced ? result.output.slice(0, result.outputSteps.filter((step) => step <= currentStep).length) : result.output
  return (
    <aside ref={panelRef} className="simulation-panel" data-canvas-ui data-canvas-scroll aria-label={t('simulation.title')} style={{ ...(position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : {}), ...(front.zIndex ? { zIndex: front.zIndex } : {}) }} onPointerDown={(event) => { front.bringToFront(); event.stopPropagation() }} onFocusCapture={front.bringToFront} onKeyDown={(event) => event.stopPropagation()}>
      <header role="group" tabIndex={0} aria-label={t('details.move')} title={t('details.moveHint')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyDown}>
        <h2>{t('simulation.title')}</h2>
        {!live && (running || paused) && <button type="button" className="simulation-panel__control" aria-label={t('simulation.free')} aria-pressed={free} title={t('simulation.freeHint')} onClick={onToggleFree}><FastForward size={14} fill="currentColor" aria-hidden="true" />{t('simulation.free')}</button>}
        {running && <button type="button" className="simulation-panel__control" aria-label={t('simulation.pause')} title={t('simulation.pause')} onClick={onPause}><Pause size={14} fill="currentColor" aria-hidden="true" />{t('simulation.pause')}</button>}
        {paused && <button type="button" className="simulation-panel__control" aria-label={t('simulation.resume')} title={t('simulation.resume')} onClick={onResume}><Play size={14} fill="currentColor" aria-hidden="true" />{t('simulation.resume')}</button>}
        {(running || paused) && <button type="button" className="simulation-panel__control simulation-panel__control--danger" aria-label={t('simulation.stop')} title={t('simulation.stop')} onClick={onStop}><Square size={14} fill="currentColor" aria-hidden="true" />{t('simulation.stop')}</button>}
        <button type="button" aria-label={t('simulation.close')} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      {result.ok ? <><p className="simulation-panel__status">{status} · {live ? `${currentStep} ${t(currentStep === 1 ? 'simulation.step' : 'simulation.steps')}` : `${currentStep}/${result.trace.length} ${t(result.trace.length === 1 ? 'simulation.step' : 'simulation.steps')}`}</p>
        <p className="visually-hidden" role="status">{status}</p>
        {!live && <div className="simulation-panel__speed">
          <span>{t('simulation.speed')}</span>
          {[1, 2, 3].map((value) => <button type="button" key={value} aria-pressed={speed === value} onClick={() => chooseSpeed(value)}>×{value}</button>)}
          <label className="simulation-panel__speed-custom">×<input type="number" min={simulationSpeedMin} max={simulationSpeedMax} step="1" value={speedDraft} aria-label={t('simulation.speed')} onChange={(event) => setSpeedDraft(event.target.value)} onBlur={commitSpeed} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
        </div>}
        {live && <div className="simulation-panel__speed simulation-panel__speed--live">
          <span>{t('simulation.liveSpeed')}</span>
          <input type="range" min={simulationSpeedMin} max={simulationSpeedMax} step="1" value={speed} aria-label={t('simulation.liveSpeed')} onChange={(event) => onSpeedChange?.(Number(event.target.value))} />
          <span className="simulation-panel__speed-value" aria-hidden="true">{speed}</span>
        </div>}
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

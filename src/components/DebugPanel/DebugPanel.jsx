import { ArrowRight, ChevronDown, ChevronUp, CornerUpRight, RotateCcw, SkipBack, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { snapPanelToArea } from '../../utils/panelSnap.js'
import { failureLabel } from '../../utils/translations.js'
import { kindLabel, typeLabel } from '../LogicTree/logicLabels.js'
import './DebugPanel.css'

// Garde les chaînes distinctes des nombres et préserve le zéro signé des flottants.
function memoryValue(value) {
  if (typeof value === 'string') return JSON.stringify(value)
  return Object.is(value, -0) ? '-0' : String(value)
}

// Présente les valeurs scalaires sans perdre les chaînes vides ou les booléens du programme.
function MemoryTable({ variables, modules, t }) {
  if (variables.length === 0) return <p>{t('debug.noVariables')}</p>
  return <table className="debug-panel__memory"><thead><tr><th>{t('form.name')}</th><th>{t('form.type')}</th><th>{t('form.value')}</th></tr></thead><tbody>
    {variables.map((variable) => <tr key={variable.nodeId} data-memory-node={variable.nodeId}><th scope="row">{variable.name}<small>{modules.get(variable.moduleId)?.name}</small></th><td>{typeLabel(variable.type, t)}</td><td>{variable.initialized ? memoryValue(variable.value) : <em>{t('debug.uninitialized')}</em>}</td></tr>)}
  </tbody></table>
}

// Affiche uniquement l'instantané courant, dans une fenêtre locale déplaçable et redimensionnable.
export default function DebugPanel({ session, index, onAction, onClose }) {
  const [geometry, setGeometry] = useState({ x: 16, y: 16, width: 380, height: 500 })
  const [collapsed, setCollapsed] = useState(false)
  const gesture = useRef(null)
  const { t } = useTranslation()
  const frame = session.frames[session.cursor]
  const finished = !frame || frame.status !== 'paused'
  const currentNode = index.nodes.get(frame?.nodeId)

  // Contraint le déplacement et la taille à la surface visible ; au pointeur, la fenêtre s'aimante aux bords.
  function adjust(origin, mode, dx, dy, bounds, snap = false) {
    const width = mode === 'resize' ? Math.min(Math.max(240, bounds.width - origin.x - 8), Math.max(240, origin.width + dx)) : origin.width
    const height = mode === 'resize' ? Math.min(Math.max(180, bounds.height - origin.y - 8), Math.max(180, origin.height + dy)) : origin.height
    const x = Math.min(Math.max(8, bounds.width - width - 8), Math.max(8, origin.x + (mode === 'move' ? dx : 0)))
    const y = Math.min(Math.max(8, bounds.height - height - 8), Math.max(8, origin.y + (mode === 'move' ? dy : 0)))
    const position = snap && mode === 'move' ? snapPanelToArea({ x, y, width, height, areaWidth: bounds.width, areaHeight: bounds.height }) : { x, y }
    setGeometry({ ...position, width, height })
  }

  // Capture la poignée choisie sans déclencher le déplacement du canvas.
  function handleStart(event, mode) {
    if (event.button !== 0 || gesture.current || mode === 'move' && event.target.closest('button')) return
    const panel = event.currentTarget.closest('.debug-panel')
    const bounds = panel.offsetParent.getBoundingClientRect()
    const rect = panel.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    // Le geste est enregistré avant la capture : une capture indisponible ne bloque pas le déplacement.
    gesture.current = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, origin: { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height }, bounds }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture indisponible */ }
  }

  // Suit le pointeur capturé en pixels d'interface, indépendamment du zoom du workspace.
  function handleMove(event) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    adjust(current.origin, current.mode, event.clientX - current.x, event.clientY - current.y, current.bounds, true)
  }

  // Termine aussi les gestes annulés et les captures perdues.
  function handleEnd(event) {
    if (gesture.current?.pointerId !== event.pointerId) return
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Offre les mêmes réglages au clavier sur la poignée de titre ou de taille.
  function handleKeyDown(event, mode) {
    if (event.target !== event.currentTarget) return
    const direction = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key]
    if (!direction) return
    event.preventDefault()
    const panel = event.currentTarget.closest('.debug-panel')
    const bounds = panel.offsetParent.getBoundingClientRect()
    const rect = panel.getBoundingClientRect()
    adjust({ x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height }, mode, ...direction, bounds)
  }

  return <aside className={`debug-panel${collapsed ? ' debug-panel--collapsed' : ''}`} data-canvas-ui data-canvas-scroll aria-label={t('debug.title')} style={{ left: geometry.x, top: geometry.y, width: geometry.width, ...(collapsed ? {} : { height: geometry.height }) }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <header className="debug-panel__header" tabIndex={0} aria-label={t('debug.move')} title={t('canvas.moveHint')} onPointerDown={(event) => handleStart(event, 'move')} onPointerMove={handleMove} onPointerUp={handleEnd} onPointerCancel={handleEnd} onLostPointerCapture={handleEnd} onKeyDown={(event) => handleKeyDown(event, 'move')}>
      <h2>{t('debug.title')}</h2>
      <button type="button" className="debug-panel__collapse" aria-expanded={!collapsed} aria-label={t(collapsed ? 'panel.expand' : 'panel.collapse')} title={t(collapsed ? 'panel.expand' : 'panel.collapse')} onClick={() => setCollapsed((current) => !current)}>{collapsed ? <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /> : <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />}</button>
      <button type="button" onClick={onClose} aria-label={t('debug.close')}><X size={16} aria-hidden="true" /></button>
    </header>
    <div className="debug-panel__controls">
      <button type="button" disabled={session.cursor === 0 && session.history.length === 0} onClick={() => onAction('restart')} title={t('debug.restartHint')}><SkipBack size={14} aria-hidden="true" />{t('debug.restart')}</button>
      <button type="button" disabled={session.history.length === 0} onClick={() => onAction('back')} title={t('debug.backHint')}><RotateCcw size={14} aria-hidden="true" />{t('debug.back')}</button>
      <button type="button" disabled={finished} onClick={() => onAction('next')} title={t('debug.nextHint')}><ArrowRight size={14} aria-hidden="true" />{t('debug.next')}</button>
      <button type="button" disabled={finished} onClick={() => onAction('scope')} title={t('debug.scopeHint')}><CornerUpRight size={14} aria-hidden="true" />{t('debug.scope')}</button>
    </div>
    <div className="debug-panel__content">
      {(session.errorCode || frame?.errorCode) && <p className="debug-panel__error" role="alert">{failureLabel({ code: session.errorCode ?? frame.errorCode }, t)}</p>}
      {frame && <>
        <p className="debug-panel__status" role="status">{t(`debug.${frame.status}`)} · {session.cursor + 1}/{session.frames.length}{currentNode ? ` · ${currentNode.properties.name || kindLabel(currentNode.kind, t)}` : ''}</p>
        <h3>{t('debug.globals')}</h3><MemoryTable variables={frame.globals} modules={index.modules} t={t} />
        <h3>{t('debug.locals')}</h3>
        {frame.localScopes.length === 0 && <p>{t('debug.noScope')}</p>}
        {[...frame.localScopes].reverse().map((scope) => <section key={scope.instanceId} className="debug-panel__scope" data-debug-scope={scope.nodeId}>
          <h4>{index.nodes.get(scope.nodeId)?.properties.name || kindLabel(index.nodes.get(scope.nodeId)?.kind ?? 'Block', t)}</h4><MemoryTable variables={scope.variables} modules={index.modules} t={t} />
        </section>)}
        <h3>{t('simulation.title')}</h3><pre className="debug-panel__output">{frame.output.join('\n') || t('simulation.noOutput')}</pre>
      </>}
      <h3>{t('debug.functions')}</h3>
      {!session.reachability.ok ? <p>{t('debug.analysisUnavailable')}</p> : <>
        <ul className="debug-panel__functions">{session.reachability.functions.map((entry) => <li key={entry.nodeId}><strong>{index.modules.get(index.nodes.get(entry.nodeId)?.moduleId)?.name} · {index.nodes.get(entry.nodeId)?.properties.name}</strong><span>{typeLabel(index.nodeTypes.get(entry.nodeId), t)}</span><small>{t(entry.reachable ? 'debug.possible' : 'debug.unusedFunction')}</small></li>)}</ul>
        <details className="debug-panel__analysis"><summary>{t('debug.unreachable', { count: session.reachability.unreachableNodeIds.length })}</summary><p>{t('debug.reachabilityNote')}</p><ul>{session.reachability.unreachableNodeIds.map((id) => {
          const node = index.nodes.get(id)
          return <li key={id}>{index.modules.get(node.moduleId)?.name} · {node.properties.name || kindLabel(node.kind, t)} <code>{id}</code></li>
        })}</ul></details>
      </>}
    </div>
    <button className="debug-panel__resize" type="button" aria-label={t('debug.resize')} title={t('canvas.resizeHint')} onPointerDown={(event) => handleStart(event, 'resize')} onPointerMove={handleMove} onPointerUp={handleEnd} onPointerCancel={handleEnd} onLostPointerCapture={handleEnd} onKeyDown={(event) => handleKeyDown(event, 'resize')}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12l8-8M8 12l4-4" /></svg></button>
  </aside>
}

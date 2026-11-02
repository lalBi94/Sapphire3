import { Pause, Play, Square } from 'lucide-react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import ArrayCells from '../ArrayCells/ArrayCells.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { failureLabel } from '../../utils/translations.js'
import { memoryValue } from '../../utils/memorySpace.js'
import { buildFlowGraph, flowCardSize } from '../../utils/flowGraph.js'
import { kindLabel, typeLabel } from '../LogicTree/logicLabels.js'
import './FlowPanel.css'

// Affiche le flux simplifié des fonctions atteignables et l'état courant de la simulation.
export default function FlowPanel({ session, contextIndex, step, running, paused, stopped, onPause, onResume, onStop, onClose }) {
  const { t } = useTranslation()
  const frame = session.frames[step]
  const graph = buildFlowGraph(session.project, contextIndex, session.reachability)
  // Au dernier arrêt, l'activation est déjà dépilée : on garde la dernière fonction vue.
  const activeId = frame?.callStack?.at(-1)?.nodeId
    ?? session.frames.slice(0, step + 1).reverse().find((entry) => entry.callStack?.length > 0)?.callStack.at(-1)?.nodeId
    ?? null
  const activeNode = activeId ? contextIndex.nodes.get(activeId) : null
  const globals = frame?.globals ?? []
  const scopes = [...(frame?.localScopes ?? [])].reverse()
  const stack = [...(frame?.callStack ?? [])].reverse()
  const state = running ? t('simulation.running') : paused ? t('simulation.paused') : stopped ? t('simulation.stopped') : t('simulation.completed')
  const errorCode = session.errorCode ?? frame?.errorCode ?? null

  // Décrit une variable mémorisée avec son type et sa valeur, tableaux compris.
  function variableRow(variable, key) {
    return <li key={key} className="flow-panel__variable">
      <strong>{variable.name}</strong>
      <small>{typeLabel(variable.type, t)}</small>
      <span>{variable.initialized ? (variable.array ? <ArrayCells array={variable.array} /> : memoryValue(variable.value)) : t('debug.uninitialized')}</span>
      {variable.scope && <em>{variable.scope}</em>}
    </li>
  }

  return <FloatingPanel title={t('flow.title')} label={t('flow.title')} onClose={onClose} className="flow-panel">
    <div className="flow-panel__status" role="status">
      <span className={`flow-panel__state${running ? ' flow-panel__state--running' : ''}`}>{state}</span>
      <span>{t('flow.step', { current: session.frames.length ? step + 1 : 0, total: session.frames.length })}</span>
      {activeNode && <strong>{activeNode.properties?.name || kindLabel(activeNode.kind, t)}</strong>}
    </div>
    <div className="flow-panel__controls">
      <button type="button" disabled={!running} onClick={onPause} title={t('simulation.pause')}><Pause size={13} aria-hidden="true" />{t('simulation.pause')}</button>
      <button type="button" disabled={!paused} onClick={onResume} title={t('simulation.resume')}><Play size={13} aria-hidden="true" />{t('simulation.resume')}</button>
      <button type="button" disabled={!running && !paused} onClick={onStop} title={t('simulation.stop')}><Square size={12} aria-hidden="true" />{t('simulation.stop')}</button>
    </div>
    {errorCode && <p className="flow-panel__error" role="alert">{failureLabel({ code: errorCode }, t)}</p>}
    <p className="flow-panel__hint">{t('flow.hint')}</p>
    <div className="flow-panel__viewport">
      {graph.nodes.length === 0 ? <p className="flow-panel__empty">{t('flow.empty')}</p> : <div className="flow-panel__graph" style={{ width: graph.width, height: graph.height }}>
        <svg width={graph.width} height={graph.height} aria-hidden="true" className="flow-panel__edges">
          <defs><marker id="flow-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker></defs>
          {graph.edges.map((edge) => {
            const active = edge.toId === activeId
            return <g key={`${edge.fromId}-${edge.toId}`} className={`flow-panel__edge${active ? ' flow-panel__edge--active' : ''}`}>
              <path d={edge.path} markerEnd="url(#flow-arrow)" />
              {active && <circle r="4" className="flow-panel__pulse"><animateMotion dur="1.2s" repeatCount="indefinite" path={edge.path} /></circle>}
            </g>
          })}
        </svg>
        {graph.nodes.map((fn) => <article key={fn.id} className={`flow-panel__node${fn.id === activeId ? ' flow-panel__node--active' : ''}`} style={{ left: fn.x, top: fn.y, width: flowCardSize.width, height: flowCardSize.height }} data-flow-node={fn.id}>
          <small>{fn.moduleName}</small>
          <strong>{fn.name}</strong>
          <code>{typeLabel(fn.signature, t)}</code>
          <span className="flow-panel__badges">
            {fn.entry && <em>{t('memory.entry')}</em>}
            {fn.recursive && <em>{t('flow.recursive')}</em>}
          </span>
        </article>)}
      </div>}
    </div>
    <h3>{t('flow.variables')}</h3>
    {globals.length === 0 && scopes.every((scope) => scope.variables.length === 0) ? <p>{t('debug.noVariables')}</p> : <ul className="flow-panel__variables">
      {globals.map((variable) => variableRow(variable, `global:${variable.nodeId}`))}
      {scopes.flatMap((scope) => scope.variables.map((variable) => variableRow({ ...variable, scope: contextIndex.nodes.get(scope.nodeId)?.properties?.name || kindLabel(contextIndex.nodes.get(scope.nodeId)?.kind ?? 'Block', t) }, `${scope.instanceId}:${variable.nodeId}`)))}
    </ul>}
    <h3>{t('flow.stack')}</h3>
    {stack.length === 0 ? <p>{t('memory.empty')}</p> : <ol className="flow-panel__stack">{stack.map((entry) => <li key={entry.instanceId} className={entry.nodeId === activeId ? 'flow-panel__stack--active' : undefined}>{contextIndex.nodes.get(entry.nodeId)?.properties?.name || kindLabel(contextIndex.nodes.get(entry.nodeId)?.kind ?? 'Block', t)}</li>)}</ol>}
    <h3>{t('simulation.title')}</h3>
    <pre className="flow-panel__output">{(frame?.output ?? []).join('\n') || t('simulation.noOutput')}</pre>
  </FloatingPanel>
}

import { Code2, Database, Layers } from 'lucide-react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { buildMemorySpace, memoryValue } from '../../utils/memorySpace.js'
import { kindLabel, typeLabel } from '../LogicTree/logicLabels.js'
import ArrayCells from '../ArrayCells/ArrayCells.jsx'
import './MemoryPanel.css'

// Présente une vue abstraite du code, des globales et de la pile d'appels de la session.
export default function MemoryPanel({ index, frame, reachability, onClose }) {
  const { t } = useTranslation()
  const space = buildMemorySpace(index, frame, reachability)

  // Décrit une variable stockée avec son adresse illustrative et sa valeur courante.
  function variableRow(variable) {
    return <li key={variable.nodeId} className="memory-panel__cell">
      <code className="memory-panel__address">{variable.address}</code>
      <strong>{variable.name}</strong>
      <small>{typeLabel(variable.type, t)}</small>
      <div className="memory-panel__value">{variable.initialized ? (variable.array ? <ArrayCells array={variable.array} /> : memoryValue(variable.value)) : t('debug.uninitialized')}</div>
    </li>
  }

  return <FloatingPanel title={t('memory.title')} label={t('memory.title')} info={t('memory.hint')} onClose={onClose} className="memory-panel">
    <section className="memory-panel__segment">
      <h3><Code2 size={14} aria-hidden="true" />{t('memory.code')}<span>{space.functions.length}</span></h3>
      {space.functions.length === 0 ? <p className="memory-panel__empty">{t('memory.empty')}</p> : <ul className="memory-panel__list">
        {space.functions.map((fn) => <li key={fn.id} className="memory-panel__cell">
          <code className="memory-panel__address">{fn.address}</code>
          <strong>{fn.moduleName ? `${fn.moduleName} · ${fn.name}` : fn.name}</strong>
          <small>{typeLabel(fn.signature, t)}</small>
          <span className="memory-panel__tags">
            {fn.entry && <em>{t('memory.entry')}</em>}
            {!fn.reachable && <em className="memory-panel__muted">{t('memory.unreachable')}</em>}
          </span>
        </li>)}
      </ul>}
    </section>
    <section className="memory-panel__segment">
      <h3><Database size={14} aria-hidden="true" />{t('memory.data')}<span>{space.globals.length}</span></h3>
      {space.globals.length === 0 ? <p className="memory-panel__empty">{t('memory.empty')}</p> : <ul className="memory-panel__list">{space.globals.map(variableRow)}</ul>}
    </section>
    <section className="memory-panel__segment">
      <h3><Layers size={14} aria-hidden="true" />{t('memory.stack')}<span>{space.stack.length}</span></h3>
      {space.stack.length === 0 ? <p className="memory-panel__empty">{t('memory.empty')}</p> : space.stack.map((scope) => {
        const node = index.nodes.get(scope.nodeId)
        return <div key={scope.instanceId} className="memory-panel__scope" data-memory-scope={scope.nodeId}>
          <h4><code className="memory-panel__address">{scope.address}</code><span>{node?.properties?.name || kindLabel(node?.kind ?? 'Block', t)}</span></h4>
          {scope.variables.length === 0 ? <p className="memory-panel__empty">{t('memory.empty')}</p> : <ul className="memory-panel__list">{scope.variables.map(variableRow)}</ul>}
        </div>
      })}
    </section>
  </FloatingPanel>
}

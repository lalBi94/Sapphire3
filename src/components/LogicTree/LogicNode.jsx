import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { getNodeSchema } from '../../utils/logic/index.js'
import { kindLabel, nodeSummary, slotLabel } from './logicLabels.js'
import NodeMenuButton from '../NodeMenuButton/NodeMenuButton.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Rend une construction avec ses slots ; les cycles ou liens manquants restent des fragments lisibles.
export default function LogicNode({ id, index, selectedId, activeExecutionId, onSelect, ancestors, expandedIds, onToggle, onOpenActions, dropTarget }) {
  const { t } = useTranslation()
  const node = index.nodes.get(id)
  const schema = node ? getNodeSchema(node.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => entry.location.nodeId === id)
  const slots = Object.entries(schema?.slots ?? {})
  const expanded = expandedIds.has(id)
  const name = node?.properties?.name || kindLabel(node?.kind ?? '', t)
  const summary = node ? nodeSummary(node, index, schema, t) : ''
  const nodeRef = useRef(null)
  const active = activeExecutionId === id
  const drop = dropTarget?.kind === 'node' && dropTarget.id === id ? dropTarget : null

  useEffect(() => {
    if (active) nodeRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [active])

  // L'événement ne remonte pas à un autre nœud ou au module contenant la sélection.
  function handleSelect(event) {
    event.stopPropagation()
    onSelect({ kind: 'node', id })
  }

  // Le pliage reste une présentation locale et ne sélectionne pas le nœud.
  function handleToggle(event) {
    event.stopPropagation()
    onToggle(id)
  }

  if (!node) return <p className="logic-tree__missing">{t('canvas.blockMissing')}</p>
  if (ancestors.includes(id) || ancestors.length >= 60) return <p className="logic-tree__missing">{t('canvas.blockHidden')}</p>
  return (
    <section ref={nodeRef} className={`logic-node${selectedId === id ? ' logic-node--selected' : ''}${active ? ' logic-node--executing' : ''}${expanded ? '' : ' logic-node--collapsed'}${drop ? ` logic-node--drop-${drop.ok ? 'valid' : 'invalid'}` : ''}`} data-source-node={id} data-group={schema?.group ?? 'incomplete'} aria-current={active ? 'step' : undefined} aria-label={name} onClick={handleSelect}>
      <NodeMenuButton label={name} onOpen={(event) => onOpenActions(event, { kind: 'node', id })} />
      <div className="logic-node__header">
        <button type="button" className="logic-node__toggle" aria-expanded={expanded} aria-label={t(expanded ? 'canvas.collapse' : 'canvas.expand', { name })} onClick={handleToggle}>
          {expanded ? <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /> : <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" className="logic-node__heading" draggable title={t('transfer.dragHint')} onClick={handleSelect} aria-pressed={selectedId === id}>
          <span>{kindLabel(node.kind, t)}{node.properties?.name ? ` · ${node.properties.name}` : ''}</span>
          {node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true && <span className="logic-node__entry-point">{t('canvas.startHere')}</span>}
          {diagnostics.length > 0 && <span className="logic-node__issues" aria-label={t(diagnostics.length === 1 ? 'canvas.issueCountOne' : 'canvas.issueCount', { count: diagnostics.length })}>{diagnostics.length}</span>}
        </button>
      </div>
      {summary && <div className={`logic-node__summary${expanded ? '' : ' logic-node__summary--collapsed'}`}>{summary}</div>}
      {expanded && slots.map(([slotName, slot]) => {
        const value = node.children?.[slotName]
        const children = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        return <div className="logic-node__slot" data-slot={slotName} key={slotName}>
          <span className="logic-node__slot-label">{slotLabel(slotName, t)}{slot.many ? ` [${children.length}]` : ''}</span>
          {children.length === 0 ? <span className="logic-node__empty">{t(slot.required ? 'canvas.addSomething' : 'canvas.empty')}</span> : children.map((childId, position) => <LogicNode key={`${childId}:${position}`} id={childId} index={index} selectedId={selectedId} activeExecutionId={activeExecutionId} onSelect={onSelect} ancestors={[...ancestors, id]} expandedIds={expandedIds} onToggle={onToggle} onOpenActions={onOpenActions} dropTarget={dropTarget} />)}
        </div>
      })}
    </section>
  )
}

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getNodeSchema } from '../../utils/logic/index.js'
import { scrollNodeIntoCard } from '../../utils/cardScroll.js'
import { siblingOrder, foldedPreviewLines } from '../../utils/nodeTree.js'
import { kindLabel, nodeLine, nodeSummary, slotLabel } from './logicLabels.js'
import NodeMenuButton from '../NodeMenuButton/NodeMenuButton.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Rend une construction avec ses slots ; les cycles ou liens manquants restent des fragments lisibles.
export default function LogicNode({ id, index, selectedId, activeExecutionId, onSelect, ancestors, expandedIds, onToggle, onOpenActions, dropTarget, onReorder, heat = null, heatEnabled = false, unusedIds = null }) {
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
  const order = onReorder ? siblingOrder(index, id) : null
  const heatEntry = heatEnabled ? heat?.get(id) ?? null : null
  const heatLevel = heatEntry?.level ?? 0
  const executions = heatEntry?.count ?? 0
  const unused = Boolean(unusedIds?.has(id))
  const [preview, setPreview] = useState(null)
  // Un nœud replié qui contient vraiment quelque chose peut montrer un aperçu au survol.
  const previewable = Boolean(node) && !expanded && Object.values(node.children ?? {}).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))

  useEffect(() => {
    if (active) scrollNodeIntoCard(nodeRef.current, 'nearest')
  }, [active])

  // Aperçu au survol : les premières instructions du bloc replié, sans le déplier.
  function showPreview() {
    if (!previewable || !nodeRef.current) return
    const rect = nodeRef.current.getBoundingClientRect()
    const width = 340
    const data = foldedPreviewLines(index, id, (entry) => nodeLine(entry, index, t), 8)
    setPreview({
      width,
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
      below: rect.bottom < window.innerHeight * 0.62,
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      lines: data.lines,
      hidden: data.hidden,
    })
  }

  // Referme l'aperçu sauf si le focus reste dans le nœud.
  function hidePreview(event) {
    if (event?.type === 'blur' && event.currentTarget.contains(event.relatedTarget)) return
    setPreview(null)
  }

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
  return (<>
    <section ref={nodeRef} className={`logic-node${selectedId === id ? ' logic-node--selected' : ''}${active ? ' logic-node--executing' : ''}${expanded ? '' : ' logic-node--collapsed'}${drop ? ` logic-node--drop-${drop.ok ? 'valid' : 'invalid'}` : ''}${heatEnabled ? ` logic-node--heat-${heatLevel}` : ''}`} data-executions={heatEnabled ? executions : undefined} data-source-node={id} data-group={schema?.group ?? 'incomplete'} aria-current={active ? 'step' : undefined} aria-label={name} onClick={handleSelect} onMouseEnter={showPreview} onMouseLeave={hidePreview} onFocus={showPreview} onBlur={hidePreview}>
      <NodeMenuButton label={name} onOpen={(event) => onOpenActions(event, { kind: 'node', id })} />
      <div className="logic-node__header">
        <button type="button" className="logic-node__toggle" aria-expanded={expanded} aria-label={t(expanded ? 'canvas.collapse' : 'canvas.expand', { name })} onClick={handleToggle}>
          {expanded ? <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /> : <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" className="logic-node__heading" draggable title={t('transfer.dragHint')} onClick={handleSelect} aria-pressed={selectedId === id}>
          <span>{kindLabel(node.kind, t)}{node.properties?.name ? ` · ${node.properties.name}` : ''}</span>
          {node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true && <span className="logic-node__entry-point">{t('canvas.startHere')}</span>}
          {diagnostics.length > 0 && <span className="logic-node__issues" aria-label={t(diagnostics.length === 1 ? 'canvas.issueCountOne' : 'canvas.issueCount', { count: diagnostics.length })}>{diagnostics.length}</span>}
          {heatEnabled && executions > 0 && <span className="logic-node__heat" title={t('heatmap.count', { count: executions })} aria-label={t('heatmap.count', { count: executions })}>{executions}</span>}
          {unused && <span className="logic-node__unused" title={t('canvas.unusedHint')} aria-label={t('canvas.unusedHint')}>{t('canvas.unused')}</span>}
        </button>
        {order && order.count > 1 && <div className="logic-node__order">
          <button type="button" className="logic-node__order-button" title={t('canvas.moveUp')} aria-label={t('canvas.moveUp')} disabled={order.position === 0} onClick={(event) => { event.stopPropagation(); onReorder(id, -1) }}><ArrowUp size={13} strokeWidth={2} aria-hidden="true" /></button>
          <button type="button" className="logic-node__order-button" title={t('canvas.moveDown')} aria-label={t('canvas.moveDown')} disabled={order.position === order.count - 1} onClick={(event) => { event.stopPropagation(); onReorder(id, 1) }}><ArrowDown size={13} strokeWidth={2} aria-hidden="true" /></button>
        </div>}
      </div>
      {summary && <div className={`logic-node__summary${expanded ? '' : ' logic-node__summary--collapsed'}`}>{summary}</div>}
      {expanded && slots.map(([slotName, slot]) => {
        const value = node.children?.[slotName]
        const children = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
        return <div className="logic-node__slot" data-slot={slotName} key={slotName}>
          <span className="logic-node__slot-label">{slotLabel(slotName, t)}{slot.many ? ` [${children.length}]` : ''}</span>
          {children.length === 0 ? <span className="logic-node__empty">{t(slot.required ? 'canvas.addSomething' : 'canvas.empty')}</span> : children.map((childId, position) => <LogicNode key={`${childId}:${position}`} id={childId} index={index} selectedId={selectedId} activeExecutionId={activeExecutionId} onSelect={onSelect} ancestors={[...ancestors, id]} expandedIds={expandedIds} onToggle={onToggle} onOpenActions={onOpenActions} dropTarget={dropTarget} onReorder={onReorder} heat={heat} heatEnabled={heatEnabled} unusedIds={unusedIds} />)}
        </div>
      })}
    </section>
    {preview && previewable && createPortal(<div className="logic-node__preview" role="tooltip" aria-label={t('canvas.preview')} style={{ left: preview.left, width: preview.width, ...(preview.below ? { top: preview.top } : { bottom: preview.bottom }) }}>
      {preview.lines.length === 0 && <div className="logic-node__preview-more">{t('canvas.previewEmpty')}</div>}
      {preview.lines.map((line, position) => <div className="logic-node__preview-line" key={position} style={{ paddingLeft: line.depth * 12 }}>{line.text}</div>)}
      {preview.hidden > 0 && <div className="logic-node__preview-more">{t('canvas.previewMore', { count: preview.hidden })}</div>}
    </div>, document.body)}
  </>
  )
}

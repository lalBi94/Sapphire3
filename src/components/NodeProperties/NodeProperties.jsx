import { ChevronRight, Move, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { resolveContext, getNodeSchema } from '../../utils/logic/index.js'
import { diagnosticLabel, kindLabel, slotLabel } from '../LogicTree/logicLabels.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import ModuleNameForm from './ModuleNameForm.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../i18n.jsx'
import './NodeProperties.css'

// Affiche les propriétés du ciblage actuel et les diagnostics dérivés de la dernière mutation.
export default function NodeProperties({ selected, project, index, onConfigure, onRename, onSelect, onDelete, onDeleteModule, onClose, mutationError }) {
  const { t } = useTranslation()
  const [position, setPosition] = useState(null)
  const moveRef = useRef(null)
  const context = resolveContext(project, selected, undefined, index)
  const record = context.record
  const schema = selected.kind === 'node' && record ? getNodeSchema(record.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => selected.kind === 'module' ? entry.location.moduleId === selected.id : entry.location.nodeId === selected.id)
  const configurable = schema && (schema.named || schema.declaresType || ['BinaryExpression', 'UnaryExpression', 'Reference'].includes(record.kind))

  // Capture le panneau et le rend librement déplaçable dans le canvas.
  function handleMoveStart(event) {
    if (event.button !== 0 || event.target.closest('button')) return
    const panel = event.currentTarget.closest('.node-properties')
    const parent = panel?.offsetParent
    if (!panel || !parent) return
    const panelBounds = panel.getBoundingClientRect()
    const parentBounds = parent.getBoundingClientRect()
    const origin = position ?? { x: panelBounds.left - parentBounds.left, y: panelBounds.top - parentBounds.top }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    moveRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin }
    setPosition(origin)
  }

  // Suit le pointeur sans déplacer le canvas sous le panneau.
  function handleMove(event) {
    const move = moveRef.current
    if (!move || move.pointerId !== event.pointerId) return
    setPosition({ x: Math.max(8, move.origin.x + event.clientX - move.x), y: Math.max(8, move.origin.y + event.clientY - move.y) })
  }

  // Termine le déplacement après relâchement ou perte de capture.
  function handleMoveEnd(event) {
    if (moveRef.current?.pointerId !== event.pointerId) return
    moveRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Déplace le panneau par petits pas lorsque sa poignée possède le focus.
  function handleMoveKeyDown(event) {
    const directions = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const panel = event.currentTarget.closest('.node-properties')
    const parent = panel?.offsetParent
    if (!panel || !parent) return
    const bounds = panel.getBoundingClientRect()
    const parentBounds = parent.getBoundingClientRect()
    const origin = position ?? { x: bounds.left - parentBounds.left, y: bounds.top - parentBounds.top }
    setPosition({ x: Math.max(8, origin.x + direction[0]), y: Math.max(8, origin.y + direction[1]) })
  }

  const panelStyle = position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined

  return (
    <aside className="node-properties" style={panelStyle} data-canvas-ui data-canvas-scroll aria-label={t('details.title')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <header className="node-properties__header" onPointerDown={handleMoveStart} onPointerMove={handleMove} onPointerUp={handleMoveEnd} onPointerCancel={handleMoveEnd} onLostPointerCapture={handleMoveEnd}>
        <button type="button" className="node-properties__move" aria-label={t('details.move')} title={t('details.moveHint')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={handleMoveKeyDown}>
          <Move size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h2>{selected.kind === 'module' ? t('details.module') : record ? kindLabel(record.kind) : t('details.block')}</h2>
        <button type="button" aria-label={t('details.close')} onClick={onClose}><X size={18} strokeWidth={1.75} aria-hidden="true" /></button>
      </header>
      {!context.ok ? <p>{t('details.missingBlock')}</p> : <>
        {selected.kind === 'module' ? <ModuleNameForm key={`${record.id}:${record.name}`} module={record} onRename={onRename} /> : configurable ? <NodeForm key={`${record.id}:${JSON.stringify([record.properties, record.references])}`} kind={record.kind} initialNode={record} context={context} submitLabel="Save" onSubmit={(patch) => onConfigure(record.id, patch)} /> : <p>Add or change parts from the + menu.</p>}
        <h3>{selected.kind === 'module' ? t('details.topBlocks') : t('details.parts')}</h3>
        {(selected.kind === 'module' ? [['rootNodeIds', record.rootNodeIds]] : Object.entries(record.children ?? {})).map(([slot, value]) => <div className="node-properties__children" key={slot}><span>{slotLabel(slot)}</span>
          {(Array.isArray(value) ? value : value ? [value] : []).map((id, position) => <button type="button" key={`${id}:${position}`} onClick={() => onSelect({ kind: 'node', id })}>{index.nodes.get(id)?.properties?.name || (index.nodes.get(id) ? kindLabel(index.nodes.get(id).kind) : 'Missing block')}<ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>)}
          {(value === null || (Array.isArray(value) && value.length === 0)) && <small>{t('details.nothingAdded')}</small>}
        </div>)}
      </>}
      <h3>{t('details.issues')} · {diagnostics.length}</h3>
      {mutationError && <p role="alert">{diagnosticLabel(mutationError)}</p>}
      {diagnostics.length === 0 ? <p>{t('details.noIssues')}</p> : <ul className="node-properties__diagnostics">{diagnostics.map((entry, position) => <li key={position}><strong>{diagnosticLabel(entry.code)}</strong>{entry.location.field && <small>{slotLabel(entry.location.field)}</small>}</li>)}</ul>}
      {context.ok && record && <div className="node-properties__danger"><DeleteAction key={`${selected.kind}:${record.id}`} targetId={record.id} kind={selected.kind} onDelete={selected.kind === 'module' ? onDeleteModule : onDelete} /></div>}
    </aside>
  )
}

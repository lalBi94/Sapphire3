import { ChevronRight, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { resolveContext, getNodeSchema } from '../../utils/logic/index.js'
import { diagnosticLabel, kindLabel, slotLabel } from '../LogicTree/logicLabels.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import ModuleNameForm from './ModuleNameForm.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../i18n.jsx'
import './NodeProperties.css'

// Construit une étiquette courte pour un élément de la hiérarchie.
function hierarchyLabel(record) {
  return record?.properties?.name || kindLabel(record?.kind ?? '')
}

// Rend récursivement les descendants source sans laisser un cycle bloquer le panneau.
function HierarchyNode({ id, index, selected, onSelect, ancestors = [] }) {
  const node = index.nodes.get(id)
  if (!node || ancestors.includes(id)) return null
  const childIds = Object.values(node.children ?? {}).flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
  return (
    <li>
      <button type="button" className={`node-properties__hierarchy-item${selected?.kind === 'node' && selected.id === id ? ' node-properties__hierarchy-item--selected' : ''}`} aria-current={selected?.kind === 'node' && selected.id === id ? 'true' : undefined} onClick={() => onSelect({ kind: 'node', id })}>
        <span>{hierarchyLabel(node)}</span>
        {childIds.length > 0 && <small>{childIds.length}</small>}
      </button>
      {childIds.length > 0 && <ul>{childIds.map((childId, position) => <HierarchyNode key={`${childId}:${position}`} id={childId} index={index} selected={selected} onSelect={onSelect} ancestors={[...ancestors, id]} />)}</ul>}
    </li>
  )
}

// Affiche tous les modules et leurs blocs sous forme compacte et navigable.
function ProjectHierarchy({ project, index, selected, onSelect, t }) {
  return (
    <section className="node-properties__hierarchy" aria-label={t('details.hierarchy')}>
      <h3>{t('details.hierarchy')}</h3>
      {project.modules.length === 0 ? <p>{t('details.noModules')}</p> : <ul>
        {project.modules.map((module) => (
          <li key={module.id}>
            <button type="button" className={`node-properties__hierarchy-item node-properties__hierarchy-module${selected?.kind === 'module' && selected.id === module.id ? ' node-properties__hierarchy-item--selected' : ''}`} aria-current={selected?.kind === 'module' && selected.id === module.id ? 'true' : undefined} onClick={() => onSelect({ kind: 'module', id: module.id })}>
              <span>{module.name}</span>
              {module.rootNodeIds.length > 0 && <small>{module.rootNodeIds.length}</small>}
            </button>
            {module.rootNodeIds.length > 0 && <ul>{module.rootNodeIds.map((id, position) => <HierarchyNode key={`${id}:${position}`} id={id} index={index} selected={selected} onSelect={onSelect} />)}</ul>}
          </li>
        ))}
      </ul>}
    </section>
  )
}

// Affiche les propriétés du ciblage actuel et les diagnostics dérivés de la dernière mutation.
export default function NodeProperties({ selected, project, index, onConfigure, onRename, onSelect, onDelete, onDeleteModule, onClose, mutationError }) {
  const { t } = useTranslation()
  const [position, setPosition] = useState(null)
  const [size, setSize] = useState(null)
  const moveRef = useRef(null)
  const resizeRef = useRef(null)
  const context = resolveContext(project, selected, undefined, index)
  const record = context.record
  const schema = selected.kind === 'node' && record ? getNodeSchema(record.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => selected.kind === 'module' ? entry.location.moduleId === selected.id : entry.location.nodeId === selected.id)
  const configurable = schema && (schema.named || schema.declaresType || ['BinaryExpression', 'UnaryExpression', 'Reference'].includes(record.kind))

  // Capture le panneau et le rend librement déplaçable dans le canvas.
  function handleMoveStart(event) {
    if (event.button !== 0 || event.target.closest('button') || resizeRef.current) return
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

  // Capture le coin inférieur gauche pour redimensionner le panneau sans déplacer le contenu.
  function handleResizeStart(event) {
    if (event.button !== 0 || moveRef.current) return
    const panel = event.currentTarget.closest('.node-properties')
    const parent = panel?.offsetParent
    if (!panel || !parent) return
    const panelBounds = panel.getBoundingClientRect()
    const parentBounds = parent.getBoundingClientRect()
    const currentPosition = position ?? { x: panelBounds.left - parentBounds.left, y: panelBounds.top - parentBounds.top }
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: currentPosition,
      width: panelBounds.width,
      height: panelBounds.height,
      parentWidth: parentBounds.width,
      parentHeight: parentBounds.height,
    }
    setPosition(currentPosition)
    setSize({ width: panelBounds.width, height: panelBounds.height })
  }

  // Applique les nouvelles dimensions en gardant le bord droit et le haut du panneau stables.
  function handleResize(event) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const minimumWidth = 240
    const minimumHeight = 180
    const maximumWidth = Math.max(minimumWidth, resize.parentWidth - 16)
    const maximumHeight = Math.max(minimumHeight, resize.parentHeight - resize.origin.y - 16)
    const width = Math.min(maximumWidth, Math.max(minimumWidth, resize.width - (event.clientX - resize.x)))
    const height = Math.min(maximumHeight, Math.max(minimumHeight, resize.height + (event.clientY - resize.y)))
    const x = resize.origin.x + resize.width - width
    setPosition({ x: Math.max(8, x), y: resize.origin.y })
    setSize({ width, height })
  }

  // Termine le redimensionnement après relâchement ou perte de capture.
  function handleResizeEnd(event) {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    resizeRef.current = null
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Redimensionne le panneau par petits pas lorsque la poignée possède le focus.
  function handleResizeKeyDown(event) {
    const directions = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const panel = event.currentTarget.closest('.node-properties')
    const parent = panel?.offsetParent
    if (!panel || !parent) return
    const bounds = panel.getBoundingClientRect()
    const parentBounds = parent.getBoundingClientRect()
    const currentPosition = position ?? { x: bounds.left - parentBounds.left, y: bounds.top - parentBounds.top }
    const width = Math.max(240, bounds.width + direction[0])
    const height = Math.max(180, bounds.height + direction[1])
    setPosition({ x: Math.max(8, currentPosition.x - (width - bounds.width)), y: currentPosition.y })
    setSize({ width, height })
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

  const panelStyle = position || size ? {
    left: position?.x,
    top: position?.y,
    right: 'auto',
    bottom: 'auto',
    width: size?.width,
    height: size?.height,
  } : undefined

  return (
    <aside className="node-properties" style={panelStyle} data-canvas-ui data-canvas-scroll aria-label={t('details.title')} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <header className="node-properties__header" tabIndex={0} aria-label={t('details.move')} title={t('details.moveHint')} onPointerDown={handleMoveStart} onPointerMove={handleMove} onPointerUp={handleMoveEnd} onPointerCancel={handleMoveEnd} onLostPointerCapture={handleMoveEnd} onKeyDown={handleMoveKeyDown}>
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
      <ProjectHierarchy project={project} index={index} selected={selected} onSelect={onSelect} t={t} />
      <button
        className="node-properties__resize"
        type="button"
        aria-label={t('details.resize')}
        title={t('details.resizeHint')}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResize}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onLostPointerCapture={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 12l8-8M8 12l4-4" />
        </svg>
      </button>
    </aside>
  )
}

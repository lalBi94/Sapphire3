import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CircleDot, ClipboardPaste, Copy, CopyPlus, EyeOff, GitBranch, Network, Plus, Trash2 } from 'lucide-react'
import { getAvailableActions, getNodeSchema } from '../../utils/logic/index.js'
import { moduleTypes } from '../../utils/moduleTypes.js'
import { diagnosticLabel, groupLabel, kindLabel, slotLabel } from '../LogicTree/logicLabels.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './LogicContextMenu.css'

// Regroupe les constructions proposées par catégorie visuelle du schéma, dans l'ordre du schéma.
function groupedActions(actions) {
  const groups = []
  for (const action of actions) {
    const group = getNodeSchema(action.kind)?.group ?? 'incomplete'
    const bucket = groups.find((entry) => entry[0] === group)
    if (bucket) bucket[1].push(action)
    else groups.push([group, [action]])
  }
  return groups
}

// Propose le slot, puis la construction compatible et son formulaire latéral.
export default function LogicContextMenu({ project, index, targetId, initialSlot, x, y, onInsert, onDelete, onDeleteModule, onHideCard, onOpenGraph, onCopy, onPaste, onDuplicate, hasClipboard, onClose, anchored = false }) {
  const { t } = useTranslation()
  const [slotName, setSlotName] = useState(initialSlot ?? '')
  const [kind, setKind] = useState('')
  const [position, setPosition] = useState({ x, y })
  const menuRef = useRef(null)
  const moveRef = useRef(null)
  const available = getAvailableActions(project, targetId, slotName || undefined, { index })
  const selectedSlot = available.slot?.name ?? ''
  const parent = targetId.kind === 'node' ? index.parents.get(targetId.id)?.[0] : null
  const canDuplicate = parent?.kind === 'module' || getNodeSchema(index.nodes.get(parent?.id)?.kind)?.slots?.[parent?.slot]?.many

  useEffect(() => {
    const menu = menuRef.current
    const parent = menu.offsetParent
    if (!parent) return
    setPosition({ x: Math.max(8, Math.min(x, parent.clientWidth - menu.offsetWidth - 8)), y: Math.max(8, Math.min(y, parent.clientHeight - 220)) })
  }, [x, y])

  useEffect(() => {
    const first = kind ? menuRef.current.querySelector('input, select, .node-form button') : menuRef.current.querySelector('[role="menuitem"]:not(:disabled)')
    const focused = first ?? menuRef.current
    focused.focus({ preventScroll: true })
  }, [kind, slotName])

  useEffect(() => {
    // Ferme aussi le sous-formulaire lorsque l'utilisateur vise un autre élément.
    function handleOutside(event) {
      if (!menuRef.current.contains(event.target)) onClose(false)
    }
    document.addEventListener('pointerdown', handleOutside, true)
    return () => document.removeEventListener('pointerdown', handleOutside, true)
  }, [onClose])

  // Conserve la saisie native des formulaires et la navigation clavier des listes d'actions.
  function handleKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onClose(true); return }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || event.target.closest('form')) return
    event.preventDefault()
    const buttons = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement)
    buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus()
  }

  // Capture le menu depuis toute zone non interactive pour le déplacer librement.
  function handleMoveStart(event) {
    if (event.button !== 0 || event.target.closest('button, input, select, textarea, [role="menuitem"]')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    moveRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: position }
  }

  // Suit le déplacement du menu sans déclencher le déplacement du canvas.
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

  const menuStyle = {
    left: position.x,
    top: position.y,
    maxHeight: anchored ? `calc(100% - ${position.y + 8}px)` : undefined,
  }

  return (
    <div ref={menuRef} className="logic-context-menu" data-canvas-ui data-canvas-scroll tabIndex={-1} aria-label={t('canvas.blockMenu')} style={menuStyle} onPointerDown={(event) => { event.stopPropagation(); handleMoveStart(event) }} onPointerMove={handleMove} onPointerUp={handleMoveEnd} onPointerCancel={handleMoveEnd} onLostPointerCapture={handleMoveEnd} onKeyDown={handleKeyDown}>
      <div className="logic-context-menu__columns">
      <div className="logic-context-menu__actions" role="menu" aria-label={selectedSlot ? t('canvas.addTo', { slot: slotLabel(selectedSlot, t) }) : t('canvas.addWhere')}>
        <div className="logic-context-menu__title">{t('canvas.addNodes')}</div>
        <div className="logic-context-menu__title">{selectedSlot ? slotLabel(selectedSlot, t) : t('canvas.addWhere')}</div>
        {selectedSlot && available.slots.length > 1 && <button type="button" role="menuitem" onClick={() => { setSlotName(''); setKind('') }}><ArrowLeft className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.back')}</button>}
        {!available.ok && <p>{diagnosticLabel(available.code, t)}</p>}
        {available.ok && !selectedSlot && available.slots.map((slot) => <button type="button" role="menuitem" key={slot.name} disabled={slot.occupied || slot.malformed} onClick={() => { setSlotName(slot.name); setKind('') }}><CircleDot className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{slotLabel(slot.name, t)}{slot.occupied ? t('canvas.alreadyUsed') : slot.many ? t('canvas.several') : ''}</button>)}
        {available.ok && selectedSlot && groupedActions(available.actions).map(([group, actions]) => <Fragment key={group}>
          <div className="logic-context-menu__title logic-context-menu__group">{groupLabel(group, t)}</div>
          {actions.map((action) => <button type="button" role="menuitem" key={action.id} aria-pressed={kind === action.kind} onClick={() => setKind(action.kind)}><Plus className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{kindLabel(action.kind, t)}</button>)}
        </Fragment>)}
        {available.ok && (available.slots.length === 0 || (selectedSlot && available.actions.length === 0)) && <p>{t('canvas.nothingToAdd')}</p>}
      </div>
      <div className="logic-context-menu__actions logic-context-menu__node-actions" role="menu" aria-label={t('canvas.nodeActions')}>
        <div className="logic-context-menu__title">{t('canvas.nodeActions')}</div>
        {targetId.kind === 'node' && <button type="button" role="menuitem" onClick={() => onCopy(targetId)}><Copy className="menu-icon" size={16} aria-hidden="true" />{t('transfer.copy')}</button>}
        <button type="button" role="menuitem" disabled={!hasClipboard} title={t('transfer.pasteHint')} onClick={() => onPaste(targetId)}><ClipboardPaste className="menu-icon" size={16} aria-hidden="true" />{t('transfer.paste')}</button>
        {targetId.kind === 'node' && <button type="button" role="menuitem" disabled={!canDuplicate} title={t(canDuplicate ? 'transfer.duplicateHint' : 'transfer.duplicateUnavailable')} onClick={() => onDuplicate(targetId)}><CopyPlus className="menu-icon" size={16} aria-hidden="true" />{t('transfer.duplicate')}</button>}
        <button type="button" role="menuitem" onClick={() => onOpenGraph(targetId, 'dependencies')}><Network className="menu-icon" size={16} aria-hidden="true" />{t('graph.dependencies')}</button>
        <button type="button" role="menuitem" onClick={() => onOpenGraph(targetId, 'cfg')}><GitBranch className="menu-icon" size={16} aria-hidden="true" />{t('graph.cfg')}</button>
        {available.ok && available.target?.kind === 'node' && <button type="button" role="menuitem" className="logic-context-menu__delete" title={t('canvas.deleteInside')} onClick={() => onDelete(targetId)}><Trash2 className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.deleteBlock')}</button>}
        {available.target?.kind === 'module' && <button type="button" role="menuitem" onClick={() => onHideCard(available.target)}><EyeOff className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.hide')} {t(moduleTypes.module.targetLabelKey)}</button>}
        {available.ok && available.target?.kind === 'module' && <DeleteAction targetId={available.target.id} kind="module" onDelete={onDeleteModule} menu />}
      </div>
      </div>
      {kind && <div className="logic-context-menu__form"><h3>{kindLabel(kind, t)}</h3><NodeForm key={`${selectedSlot}:${kind}`} kind={kind} context={available} onSubmit={(draft) => onInsert(targetId, selectedSlot, draft)} /></div>}
    </div>
  )
}

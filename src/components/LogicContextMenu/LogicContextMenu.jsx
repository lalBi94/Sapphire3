import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CircleDot, Plus, Trash2 } from 'lucide-react'
import { getAvailableActions } from '../../utils/logic/index.js'
import { diagnosticLabel, kindLabel, slotLabel } from '../LogicTree/logicLabels.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../i18n.jsx'
import './LogicContextMenu.css'

// Propose le slot, puis la construction compatible et son formulaire latéral.
export default function LogicContextMenu({ project, index, targetId, initialSlot, x, y, onInsert, onDelete, onDeleteModule, onClose, anchored = false }) {
  const { t } = useTranslation()
  const [slotName, setSlotName] = useState(initialSlot ?? '')
  const [kind, setKind] = useState('')
  const menuRef = useRef(null)
  const available = getAvailableActions(project, targetId, slotName || undefined, { index })
  const selectedSlot = available.slot?.name ?? ''

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

  return (
    <div ref={menuRef} className="logic-context-menu" data-canvas-ui data-canvas-scroll tabIndex={-1} aria-label="Block menu" style={{ left: `min(${x}px, max(8px, calc(100% - ${kind ? 600 : 220}px - 8px)))`, top: anchored ? y : `min(${y}px, max(8px, calc(100% - ${kind ? 630 : 420}px)))`, maxHeight: anchored ? `calc(100% - ${y + 8}px)` : undefined }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={handleKeyDown}>
      <div className="logic-context-menu__actions" role="menu" aria-label={selectedSlot ? `Add to ${selectedSlot}` : 'Choose where to add'}>
        <div className="logic-context-menu__title">{selectedSlot ? slotLabel(selectedSlot) : t('canvas.addWhere')}</div>
        {selectedSlot && available.slots.length > 1 && <button type="button" role="menuitem" onClick={() => { setSlotName(''); setKind('') }}><ArrowLeft className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.back')}</button>}
        {!available.ok && <p>{diagnosticLabel(available.code)}</p>}
        {available.ok && !selectedSlot && available.slots.map((slot) => <button type="button" role="menuitem" key={slot.name} disabled={slot.occupied || slot.malformed} onClick={() => { setSlotName(slot.name); setKind('') }}><CircleDot className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{slotLabel(slot.name)}{slot.occupied ? ' · already used' : slot.many ? ' · several' : ''}</button>)}
        {available.ok && selectedSlot && available.actions.map((action) => <button type="button" role="menuitem" key={action.id} aria-pressed={kind === action.kind} onClick={() => setKind(action.kind)}><Plus className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{kindLabel(action.kind)}</button>)}
        {available.ok && (available.slots.length === 0 || (selectedSlot && available.actions.length === 0)) && <p>{t('canvas.nothingToAdd')}</p>}
        {available.ok && available.target?.kind === 'node' && <button type="button" role="menuitem" className="logic-context-menu__delete" title={t('canvas.deleteInside')} onClick={() => onDelete(targetId)}><Trash2 className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.deleteBlock')}</button>}
        {available.ok && available.target?.kind === 'module' && <DeleteAction targetId={available.target.id} kind="module" onDelete={onDeleteModule} menu />}
      </div>
      {kind && <div className="logic-context-menu__form"><h3>{kindLabel(kind)}</h3><NodeForm key={`${selectedSlot}:${kind}`} kind={kind} context={available} onSubmit={(draft) => onInsert(targetId, selectedSlot, draft)} /></div>}
    </div>
  )
}

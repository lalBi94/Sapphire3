import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookmarkPlus, ChevronDown, ChevronRight, CircleDot, ChevronsDownUp, ChevronsUpDown, ClipboardPaste, Copy, CopyPlus, EyeOff, GitBranch, Lock, LockOpen, Network, Plus, Scissors, Search, Trash2, X } from 'lucide-react'
import { getAvailableActions, getNodeSchema } from '../../utils/logic/index.js'
import { moduleTypes } from '../../utils/moduleTypes.js'
import { scoreFuzzyMatch } from '../../utils/fuzzySearch.js'
import { diagnosticLabel, groupLabel, kindLabel, slotLabel } from '../LogicTree/logicLabels.js'
import HelpButton from '../HelpButton/HelpButton.jsx'
import { nodeHelpTopic } from '../../utils/helpLinks.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './LogicContextMenu.css'

// Regroupe les constructions proposées en arborescence de catégories, dans l'ordre du schéma.
// Un identifiant de groupe peut porter une sous-catégorie : `native.math`.
function groupedActions(actions) {
  const groups = []
  for (const action of actions) {
    const path = String(action.group ?? getNodeSchema(action.kind)?.group ?? 'incomplete').split('.')
    let entry = null
    let id = ''
    for (const segment of path) {
      id = id ? `${id}.${segment}` : segment
      const siblings = entry ? entry.children : groups
      let child = siblings.find((item) => item.id === id)
      if (!child) {
        child = { id, actions: [], children: [] }
        siblings.push(child)
      }
      entry = child
    }
    entry.actions.push(action)
  }
  return groups
}

// Propose le slot, puis la construction compatible et son formulaire latéral.
export default function LogicContextMenu({ project, index, targetId, initialSlot, x, y, onInsert, onDelete, onDeleteModule, onHideCard, onLockCard, targetLocked = false, onExpansion, onOpenGraph, onCopy, onCut, onPaste, onDuplicate, hasClipboard, canToggleExpansion = false, showBookmark = false, canBookmark = false, onBookmark, onClose }) {
  const { t } = useTranslation()
  const [slotName, setSlotName] = useState(initialSlot ?? '')
  const [kind, setKind] = useState('')
  const [preset, setPreset] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ x, y })
  const [bounded, setBounded] = useState(false)
  const [classScope, setClassScope] = useState(targetId.scope === 'private' ? 'private' : 'public')
  const helpTopic = kind ? nodeHelpTopic({ kind, properties: preset ?? {} }) : null
  const menuRef = useRef(null)
  const moveRef = useRef(null)
  const searchRef = useRef(null)
  const targetModule = targetId.kind === 'module' ? project.modules.find((module) => module.id === targetId.id) : null
  const targetDefinition = targetModule?.kind === 'class' ? moduleTypes.class : moduleTypes.module
  const targetKind = targetModule?.kind === 'class' ? 'class' : 'module'
  const effectiveTarget = targetModule?.kind === 'class' ? { ...targetId, scope: classScope } : targetId
  const available = getAvailableActions(project, effectiveTarget, slotName || undefined, { index })
  const selectedSlot = available.slot?.name ?? ''
  const parent = targetId.kind === 'node' ? index.parents.get(targetId.id)?.[0] : null
  const canDuplicate = parent?.kind === 'module' || getNodeSchema(index.nodes.get(parent?.id)?.kind)?.slots?.[parent?.slot]?.many
  const searchTerm = search.trim()
  const searchActive = searchTerm.length > 0
  const searchMatches = searchActive
    ? available.actions
      .map((action) => ({ action, score: actionSearchScore(action) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || actionLabel(left.action).localeCompare(actionLabel(right.action)) || String(left.action.slot).localeCompare(String(right.action.slot)))
      .slice(0, 60)
    : []

  useEffect(() => {
    const menu = menuRef.current
    const parent = menu.offsetParent
    if (!parent) return
    // Place le menu d'après sa hauteur naturelle : il remonte plutôt que d'être coupé en bas.
    setPosition({
      x: Math.max(8, Math.min(x, parent.clientWidth - menu.offsetWidth - 8)),
      y: Math.max(8, Math.min(y, parent.clientHeight - menu.offsetHeight - 8)),
    })
    setBounded(true)
  }, [x, y])

  useEffect(() => {
    const first = kind ? menuRef.current.querySelector('input, select, .node-form button') : menuRef.current.querySelector('[role="menuitem"]:not(:disabled):not(.logic-context-menu__group)') ?? menuRef.current.querySelector('[role="menuitem"]:not(:disabled)')
    const focused = first ?? menuRef.current
    focused.focus({ preventScroll: true })
  }, [kind, slotName])

  // À l'ouverture, la saisie de recherche reçoit le focus pour taper un bloc immédiatement.
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    // Ferme aussi le sous-formulaire lorsque l'utilisateur vise un autre élément.
    function handleOutside(event) {
      if (event.target instanceof Element && event.target.closest('[data-help-panel]')) return
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

  // Déplie ou replie une catégorie ; toutes commencent repliées à l'ouverture du menu.
  function toggleGroup(group) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // Libellé affiché d'une action : nom prédéfini (opération native) ou construction.
  function actionLabel(action) {
    return action.labelKey ? t(action.labelKey) : action.preset?.name ?? kindLabel(action.kind, t)
  }

  // Identité stable d'une action pour l'état sélectionné.
  function actionKey(action) {
    return action.preset?.constructor === true ? 'constructor' : action.preset?.name ?? action.kind
  }

  // Rapproche la saisie du libellé, du type, de la catégorie et du slot de l'action.
  function actionSearchScore(action) {
    const schema = getNodeSchema(action.kind)
    const group = action.group ?? schema?.group ?? ''
    return scoreFuzzyMatch(searchTerm, [
      { text: actionLabel(action), weight: 1 },
      { text: kindLabel(action.kind, t), weight: 0.98 },
      { text: action.kind, weight: 0.78 },
      { text: action.labelKey ? t(action.labelKey) : action.preset?.name ?? '', weight: 0.96 },
      { text: groupLabel(group, t), weight: 0.72 },
      { text: group, weight: 0.5 },
      { text: slotLabel(action.slot, t), weight: 0.62 },
      { text: action.slot, weight: 0.45 },
    ])
  }

  // Choisit une construction et, pour une opération mathématique, le nom prédéfini par son entrée de menu.
  function selectAction(action) {
    if (action.slot && action.slot !== selectedSlot) setSlotName(action.slot)
    setKind(action.kind)
    setPreset(action.preset ?? null)
  }

  // Change le scope d'insertion d'une classe et réinitialise la construction choisie.
  function changeClassScope(scope) {
    setClassScope(scope)
    setKind('')
    setPreset(null)
  }

  // Entrée choisit le meilleur résultat ; Échap efface d'abord la recherche avant de fermer.
  function handleSearchKeyDown(event) {
    if (event.key === 'Enter' && searchMatches.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      selectAction(searchMatches[0].action)
      return
    }
    if (event.key === 'Escape' && search) {
      event.preventDefault()
      event.stopPropagation()
      setSearch('')
    }
  }

  // Vide le champ et rend le focus à la saisie pour enchaîner.
  function clearSearch() {
    setSearch('')
    searchRef.current?.focus({ preventScroll: true })
  }

  // Affiche une catégorie et, une fois dépliée, ses actions puis ses sous-catégories.
  function renderGroup(entry, depth = 0) {
    const collapsed = !expandedGroups.has(entry.id)
    return <Fragment key={entry.id}>
      <button type="button" role="menuitem" className="logic-context-menu__group" data-depth={depth} aria-expanded={!collapsed} title={t(collapsed ? 'menu.groupExpand' : 'menu.groupCollapse')} onClick={() => toggleGroup(entry.id)}>
        {collapsed ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />}
        {groupLabel(entry.id, t)}
      </button>
      {!collapsed && <>
        {entry.actions.map((action) => <button type="button" role="menuitem" key={action.id} data-selected={kind !== '' && actionKey(action) === actionKey({ kind, preset })} onClick={() => selectAction(action)}><Plus className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{actionLabel(action)}</button>)}
        {entry.children.map((child) => renderGroup(child, depth + 1))}
      </>}
    </Fragment>
  }

  const menuStyle = {
    left: position.x,
    top: position.y,
    // Après mesure, borne la hauteur à l'espace restant sous la position choisie.
    maxHeight: bounded ? `calc(100% - ${position.y + 8}px)` : undefined,
  }

  return (
    <div ref={menuRef} className="logic-context-menu" data-canvas-ui data-canvas-scroll tabIndex={-1} aria-label={t('canvas.blockMenu')} style={menuStyle} onPointerDown={(event) => { event.stopPropagation(); handleMoveStart(event) }} onPointerMove={handleMove} onPointerUp={handleMoveEnd} onPointerCancel={handleMoveEnd} onLostPointerCapture={handleMoveEnd} onKeyDown={handleKeyDown}>
      <div className="logic-context-menu__columns">
      <div className="logic-context-menu__blocks">
        {targetModule?.kind === 'class' && <div className="logic-context-menu__scope" role="group" aria-label={t('class.visibility')}>
          <button type="button" aria-pressed={classScope === 'public'} onClick={() => changeClassScope('public')}>{t('class.public')}</button>
          <button type="button" aria-pressed={classScope === 'private'} onClick={() => changeClassScope('private')}>{t('class.private')}</button>
        </div>}
        {available.ok && available.actions.length > 0 && <div className="logic-context-menu__search" role="search">
          <Search size={14} aria-hidden="true" />
          <div className="logic-context-menu__search-field">
            <input ref={searchRef} className="glow" type="search" value={search} placeholder={t('search.placeholder')} aria-label={t('search.title')} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKeyDown} />
            {search && <button type="button" className="logic-context-menu__search-clear" aria-label={t('menu.searchClear')} title={t('menu.searchClear')} onClick={clearSearch}><X size={12} aria-hidden="true" /></button>}
          </div>
        </div>}
        <div className="logic-context-menu__actions" role="menu" aria-label={selectedSlot ? t('canvas.addTo', { slot: slotLabel(selectedSlot, t) }) : t('canvas.addWhere')}>
          <div className="logic-context-menu__title">{selectedSlot ? slotLabel(selectedSlot, t) : t('canvas.addNodes')}</div>
          {selectedSlot && available.slots.length > 1 && <button type="button" role="menuitem" onClick={() => { setSlotName(''); setKind(''); setPreset(null) }}><ArrowLeft className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.back')}</button>}
          {!available.ok && <p>{diagnosticLabel(available.code, t)}</p>}
          {available.ok && searchActive && (searchMatches.length === 0
            ? <p className="logic-context-menu__search-empty">{t('search.none', { term: searchTerm })}</p>
            : <>
              <p className="logic-context-menu__search-count" role="status">{t(searchMatches.length === 1 ? 'search.resultsOne' : 'search.results', { count: searchMatches.length })}</p>
              {searchMatches.map(({ action }) => <button type="button" role="menuitem" key={action.id} data-selected={kind !== '' && actionKey(action) === actionKey({ kind, preset })} onClick={() => selectAction(action)}><Plus className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" /><span className="logic-context-menu__result-label">{actionLabel(action)}</span>{!selectedSlot && <span className="logic-context-menu__result-hint">{slotLabel(action.slot, t)}</span>}</button>)}
            </>)}
          {available.ok && !searchActive && !selectedSlot && available.slots.map((slot) => <button type="button" role="menuitem" key={slot.name} disabled={slot.occupied || slot.malformed} onClick={() => { setSlotName(slot.name); setKind(''); setPreset(null) }}><CircleDot className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{slotLabel(slot.name, t)}{slot.occupied ? t('canvas.alreadyUsed') : slot.many ? t('canvas.several') : ''}</button>)}
          {available.ok && !searchActive && selectedSlot && groupedActions(available.actions).map((entry) => renderGroup(entry))}
          {available.ok && !searchActive && (available.slots.length === 0 || (selectedSlot && available.actions.length === 0)) && <p>{t('canvas.nothingToAdd')}</p>}
        </div>
      </div>
      <div className="logic-context-menu__actions logic-context-menu__node-actions" role="menu" aria-label={t('canvas.nodeActions')}>
        <div className="logic-context-menu__title">{t('canvas.nodeActions')}</div>
        {(targetId.kind === 'node' || targetId.kind === 'module') && <button type="button" role="menuitem" onClick={() => onCopy(targetId)}><Copy className="menu-icon" size={16} aria-hidden="true" />{t('transfer.copy')}</button>}
        {(targetId.kind === 'node' || targetId.kind === 'module') && <button type="button" role="menuitem" onClick={() => onCut(targetId)}><Scissors className="menu-icon" size={16} aria-hidden="true" />{t('transfer.cut')}</button>}
        <button type="button" role="menuitem" disabled={!hasClipboard} title={t('transfer.pasteHint')} onClick={() => onPaste(effectiveTarget)}><ClipboardPaste className="menu-icon" size={16} aria-hidden="true" />{t('transfer.paste')}</button>
        {targetId.kind === 'node' && <button type="button" role="menuitem" disabled={!canDuplicate} title={t(canDuplicate ? 'transfer.duplicateHint' : 'transfer.duplicateUnavailable')} onClick={() => onDuplicate(targetId)}><CopyPlus className="menu-icon" size={16} aria-hidden="true" />{t('transfer.duplicate')}</button>}
        <button type="button" role="menuitem" onClick={() => onOpenGraph(targetId, 'dependencies')}><Network className="menu-icon" size={16} aria-hidden="true" />{t('graph.dependencies')}</button>
        <button type="button" role="menuitem" onClick={() => onOpenGraph(targetId, 'cfg')}><GitBranch className="menu-icon" size={16} aria-hidden="true" />{t('graph.cfg')}</button>
        {showBookmark && <button type="button" role="menuitem" disabled={!canBookmark} title={t(canBookmark ? 'bookmark.saveHint' : 'bookmark.onlyPure')} onClick={() => onBookmark(targetId)}><BookmarkPlus className="menu-icon" size={16} aria-hidden="true" />{t('bookmark.save')}</button>}
        {canToggleExpansion && available.target?.kind === 'module' && <>
          <button type="button" role="menuitem" onClick={() => onExpansion(available.target.id, true)}><ChevronsUpDown className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.expandAll')}</button>
          <button type="button" role="menuitem" onClick={() => onExpansion(available.target.id, false)}><ChevronsDownUp className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.collapseAll')}</button>
        </>}
        {available.ok && available.target?.kind === 'node' && <button type="button" role="menuitem" className="logic-context-menu__delete" title={t('canvas.deleteInside')} onClick={() => onDelete(targetId)}><Trash2 className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.deleteBlock')}</button>}
        {available.target?.kind === 'module' && <button type="button" role="menuitem" onClick={() => onLockCard(available.target.id)}>{targetLocked ? <LockOpen className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" /> : <Lock className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />}{targetLocked ? t('canvas.unlock') : t('canvas.lock')} {t(targetDefinition.targetLabelKey)}</button>}
        {available.target?.kind === 'module' && <button type="button" role="menuitem" onClick={() => onHideCard(available.target)}><EyeOff className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.hide')} {t(targetDefinition.targetLabelKey)}</button>}
        {available.ok && available.target?.kind === 'module' && <DeleteAction targetId={available.target.id} kind={targetKind} onDelete={onDeleteModule} menu />}
      </div>
      </div>
      {kind && <div className="logic-context-menu__form"><div className="logic-context-menu__form-head"><h3>{preset?.constructor === true ? t('class.constructor') : kindLabel(kind, t)}</h3>{helpTopic && <HelpButton title={kindLabel(kind, t)} summary={t(helpTopic.summaryKey)} url={helpTopic.url} />}</div><NodeForm key={`${selectedSlot}:${kind}:${preset?.name ?? ''}:${classScope}`} kind={kind} preset={preset} context={available} onSubmit={(draft) => onInsert(effectiveTarget, selectedSlot, draft)} /></div>}
    </div>
  )
}

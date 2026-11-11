import { useEffect, useRef, useState } from 'react'
import { Activity, AudioWaveform, Blend, Box, Braces, ChartColumn, ChartLine, ChevronDown, ChevronRight, EyeOff, Gauge, Hash, Image, Lightbulb, Lock, LockOpen, MessageSquare, Monitor, MousePointerClick, Palette, Puzzle, Search, SlidersHorizontal, TextCursorInput } from 'lucide-react'
import { cardCategories, moduleTypes } from '../../utils/moduleTypes.js'
import { normalizeSearchText } from '../../utils/searchText.js'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import './CanvasContextMenu.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

const menuIcons = {
  module: Box,
  class: Braces,
  screen: Monitor,
  gauge: Gauge,
  progress: Activity,
  barChart: ChartColumn,
  xyPlot: ChartLine,
  oscilloscope: AudioWaveform,
  heatmap: Monitor,
  led: Lightbulb,
  rgbLed: Palette,
  toggleButton: MousePointerClick,
  holdButton: MousePointerClick,
  numberInput: Hash,
  floatInput: Hash,
  stringInput: TextCursorInput,
  rgbPicker: Palette,
  rgbaPicker: Blend,
  comment: MessageSquare,
  image: Image,
  pluginWidget: Puzzle,
}

// Associe un nom d'icône de manifeste à un composant Lucide local.
function pluginIcon(name) {
  if (name === 'gauge') return Gauge
  if (name === 'chart') return ChartLine
  if (name === 'activity') return Activity
  if (name === 'led') return Lightbulb
  if (name === 'slider') return SlidersHorizontal
  if (name === 'palette') return Palette
  if (name === 'box') return Box
  return Puzzle
}

// Rassemble les clés des groupes et sous-groupes pliables d'une catégorie.
function collectGroupKeys(category) {
  const keys = []
  const visit = (group, prefix) => {
    const key = `${prefix}.${group.id}`
    keys.push(key)
    for (const child of group.groups ?? []) visit(child, key)
  }
  for (const group of category.groups ?? []) visit(group, category.id)
  return keys
}

// Filtre un groupe et ses sous-groupes ; un libellé trouvé conserve ses enfants.
function filterWidgetGroup(group, term, categoryLabel, t, force = false) {
  const labelMatches = Boolean(term) && normalizeSearchText(t(group.labelKey)).includes(term)
  const keepAll = force || labelMatches
  if (Array.isArray(group.groups)) {
    const groups = group.groups
      .map((child) => filterWidgetGroup(child, term, categoryLabel, t, keepAll))
      .filter((child) => child.types.length > 0)
    return { ...group, groups, types: groups.flatMap((child) => child.types) }
  }
  const types = (group.types ?? []).filter((type) => {
    if (!term || keepAll) return true
    const haystack = [t(moduleTypes[type].actionKey), type, categoryLabel].map(normalizeSearchText).join(' ')
    return haystack.includes(term)
  })
  return { ...group, types }
}

// Propose les créations disponibles et gère la fermeture ainsi que le focus clavier.
export default function CanvasContextMenu({ x, y, placement = 'below', onCreate, onCreatePluginWidget, pluginWidgets = [], onClose, commentId = null, onDeleteComment, onHideCard, onLockCard, commentLocked = false, anchored = false }) {
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const [term, setTerm] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(cardCategories.flatMap(collectGroupKeys)))
  const { t } = useTranslation()

  useEffect(() => {
    if (commentId) menuRef.current.querySelector('button:not(:disabled)')?.focus()
    else searchRef.current?.focus()
  }, [commentId])

  useEffect(() => {
    // Ferme le menu lorsqu'un autre élément reçoit un appui.
    function handleOutsidePointer(event) {
      if (!menuRef.current.contains(event.target)) onClose(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true)
  }, [onClose])

  // Filtre les cartes par libellé, identifiant ou catégorie, sans casse ni accents.
  const normalizedTerm = normalizeSearchText(term)
  const pluginActions = commentId ? [] : (pluginWidgets ?? []).filter((entry) => {
    if (!normalizedTerm) return true
    const widget = entry.widget
    const haystack = [widget.name, widget.category, entry.pluginName, entry.pluginId, widget.id].map(normalizeSearchText).join(' ')
    return haystack.includes(normalizedTerm)
  })
  const staticCategories = commentId ? [] : cardCategories.map((category) => {
    const grouped = Array.isArray(category.groups)
    const categoryLabel = t(category.labelKey)
    const categoryMatches = Boolean(normalizedTerm) && normalizeSearchText(categoryLabel).includes(normalizedTerm)
    const groups = (grouped ? category.groups : [{ id: category.id, labelKey: category.labelKey, types: category.types }])
      .map((group) => filterWidgetGroup(group, normalizedTerm, categoryLabel, t, categoryMatches))
      .filter((group) => group.types.length > 0)
    return { ...category, grouped, groups }
  }).filter((category) => category.groups.length > 0)
  const categories = pluginActions.length > 0
    ? [...staticCategories, { id: 'plugins', labelKey: 'canvas.createCategory.plugins', grouped: false, groups: [], pluginActions }]
    : staticCategories

  // Déplie ou replie une sous-catégorie de widgets ; la recherche force l'affichage des résultats.
  function toggleGroup(id) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Affiche une carte créable avec son icône et son libellé traduit.
  function renderAction(type) {
    const Icon = menuIcons[type]
    return <button key={type} type="button" role="menuitem" onClick={() => onCreate(type)}>
      <Icon className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
      {t(moduleTypes[type].actionKey)}
    </button>
  }

  // Affiche un widget fourni par un plugin actif.
  function renderPluginAction(entry) {
    const Icon = pluginIcon(entry.widget.icon)
    return <button key={`${entry.pluginId}/${entry.widget.id}`} type="button" role="menuitem" onClick={() => onCreatePluginWidget?.(entry.pluginId, entry.widget.id)}>
      <Icon className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
      {entry.widget.name}
    </button>
  }

  // Affiche un groupe de widgets, avec ses éventuels sous-groupes.
  function renderWidgetGroup(group, category, depth = 0, prefix = category.id) {
    if (!category.grouped) return group.types.map(renderAction)
    const groupKey = `${prefix}.${group.id}`
    const groupCollapsed = !normalizedTerm && collapsedGroups.has(groupKey)
    const nested = Array.isArray(group.groups) && group.groups.length > 0
    return <div className={`canvas-context-menu__subgroup${depth > 0 ? ' canvas-context-menu__subgroup--nested' : ''}`} role="group" aria-label={t(group.labelKey)} key={group.id}>
      <button
        type="button"
        role="menuitem"
        className="canvas-context-menu__subgroup-title"
        data-group-toggle
        aria-expanded={!groupCollapsed}
        title={t(groupCollapsed ? 'menu.groupExpand' : 'menu.groupCollapse')}
        onClick={() => toggleGroup(groupKey)}
      >
        {groupCollapsed ? <ChevronRight size={12} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />}
        {t(group.labelKey)}
      </button>
      {!groupCollapsed && (nested
        ? group.groups.map((child) => renderWidgetGroup(child, category, depth + 1, groupKey))
        : group.types.map(renderAction))}
    </div>
  }

  // Permet de parcourir les actions sans déplacer le canvas.
  function handleKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose(true)
      return
    }

    const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
    if (buttons.length === 0) return
    const inSearch = document.activeElement === searchRef.current

    if (event.key === 'Enter' && inSearch) {
      event.preventDefault()
      const action = buttons.find((button) => !button.hasAttribute('data-group-toggle'))
      action?.click()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    event.preventDefault()
    if (inSearch) {
      buttons[event.key === 'ArrowDown' ? 0 : buttons.length - 1].focus()
      return
    }
    const index = buttons.indexOf(document.activeElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + direction + buttons.length) % buttons.length].focus()
  }

  const opensAbove = !anchored && !commentId && placement === 'above'
  const menuTop = opensAbove ? undefined : anchored ? y : commentId ? `min(${y}px, max(8px, calc(100% - 280px)))` : y
  const menuBottom = opensAbove ? `calc(100% - ${y}px)` : undefined
  const menuMaxHeight = opensAbove ? `calc(${y}px - 8px)` : anchored || !commentId ? `calc(100% - ${y + 8}px)` : 'calc(100% - 16px)'
  const columns = !commentId
  const hasPluginColumn = columns && pluginActions.length > 0
  const menuWidth = columns ? (hasPluginColumn ? 800 : 620) : 184

  return (
    <div
      ref={menuRef}
      className={`canvas-context-menu${columns ? ' canvas-context-menu--columns' : ''}${hasPluginColumn ? ' canvas-context-menu--plugins' : ''}`}
      data-canvas-ui
      data-canvas-scroll
      style={{
        left: `min(${x}px, max(8px, calc(100% - ${menuWidth + 8}px)))`,
        top: menuBottom ? 'auto' : menuTop,
        bottom: menuBottom,
        maxHeight: menuMaxHeight,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {commentId ? <div role="menu" aria-label={t('canvas.visualMenu')}>
        <button type="button" role="menuitem" onClick={() => onLockCard(commentId.id)}>{commentLocked ? <LockOpen className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" /> : <Lock className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />}{commentLocked ? t('canvas.unlock') : t('canvas.lock')} {t(moduleTypes[commentId.type ?? 'comment'].targetLabelKey)}</button>
        <button type="button" role="menuitem" onClick={() => onHideCard(commentId)}><EyeOff className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />{t('canvas.hide')} {t(moduleTypes[commentId.type ?? 'comment'].targetLabelKey)}</button>
        <DeleteAction targetId={commentId} kind={commentId.type ?? 'comment'} onDelete={onDeleteComment} menu />
      </div> : <>
        <div className="canvas-context-menu__search">
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          <input ref={searchRef} type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t('canvas.createSearch')} aria-label={t('canvas.createSearch')} />
        </div>
        {categories.length === 0
          ? <p className="canvas-context-menu__empty">{t('canvas.createNone', { term })}</p>
          : <div role="menu" className={`canvas-context-menu__columns${hasPluginColumn ? ' canvas-context-menu__columns--plugins' : ''}`} aria-label={t('canvas.addMenu')}>
            {categories.map((category) => <div className="canvas-context-menu__group" role="group" aria-label={t(category.labelKey)} key={category.id}>
              <p className="canvas-context-menu__group-title" aria-hidden="true">{t(category.labelKey)}</p>
              {category.pluginActions
                ? category.pluginActions.map(renderPluginAction)
                : category.groups.map((group) => renderWidgetGroup(group, category))}
            </div>)}
          </div>}
      </>}
    </div>
  )
}

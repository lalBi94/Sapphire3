import { useEffect, useRef, useState } from 'react'
import { Activity, Box, Braces, ChartColumn, ChartLine, EyeOff, Gauge, Image, Lightbulb, Lock, LockOpen, MessageSquare, Monitor, Palette, Search } from 'lucide-react'
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
  heatmap: Monitor,
  led: Lightbulb,
  rgbLed: Palette,
  comment: MessageSquare,
  image: Image,
}

// Propose les créations disponibles et gère la fermeture ainsi que le focus clavier.
export default function CanvasContextMenu({ x, y, onCreate, onClose, commentId = null, onDeleteComment, onHideCard, onLockCard, commentLocked = false, anchored = false }) {
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const [term, setTerm] = useState('')
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
  const categories = commentId ? [] : cardCategories.map((category) => ({
    ...category,
    types: category.types.filter((type) => {
      if (!normalizedTerm) return true
      const haystack = [t(moduleTypes[type].actionKey), type, t(category.labelKey)].map(normalizeSearchText).join(' ')
      return haystack.includes(normalizedTerm)
    }),
  })).filter((category) => category.types.length > 0)

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
      buttons[0].click()
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

  const menuTop = anchored ? y : commentId ? `min(${y}px, max(8px, calc(100% - 280px)))` : y
  const menuMaxHeight = anchored || !commentId ? `calc(100% - ${y + 8}px)` : 'calc(100% - 16px)'
  const columns = !commentId
  const menuWidth = columns ? 620 : 184

  return (
    <div
      ref={menuRef}
      className={`canvas-context-menu${columns ? ' canvas-context-menu--columns' : ''}`}
      data-canvas-ui
      data-canvas-scroll
      style={{ left: `min(${x}px, max(8px, calc(100% - ${menuWidth + 8}px)))`, top: menuTop, maxHeight: menuMaxHeight }}
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
          : <div role="menu" className="canvas-context-menu__columns" aria-label={t('canvas.addMenu')}>
            {categories.map((category) => <div className="canvas-context-menu__group" role="group" aria-label={t(category.labelKey)} key={category.id}>
              <p className="canvas-context-menu__group-title" aria-hidden="true">{t(category.labelKey)}</p>
              {category.types.map((type) => {
                const Icon = menuIcons[type]
                return <button key={type} type="button" role="menuitem" onClick={() => onCreate(type)}>
                  <Icon className="menu-icon" size={16} strokeWidth={1.75} aria-hidden="true" />
                  {t(moduleTypes[type].actionKey)}
                </button>
              })}
            </div>)}
          </div>}
      </>}
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, AudioWaveform, Bot, Box, Braces, Bug, ChartColumn, ChartLine, ChevronsDownUp, ChevronsUpDown, Clock, Cloud, Code2, Cog, Compass, Cpu, Database, FileCode, Flag, FlaskConical, Folder, Gauge, GitBranch, Globe, KeyRound, Lightbulb, Lock, Monitor, MousePointerClick, Network, Palette, Puzzle, Repeat, Rocket, Server, Shield, Smile, Sparkles, Target, Terminal, Wrench, Zap } from 'lucide-react'
import { minimumModuleSize, moduleTypes } from '../../utils/moduleTypes.js'
import NodeMenuButton from '../NodeMenuButton/NodeMenuButton.jsx'
import ScreenCanvas from '../ScreenCanvas/ScreenCanvas.jsx'
import GaugeCard from '../GaugeCard/GaugeCard.jsx'
import ProgressCard from '../ProgressCard/ProgressCard.jsx'
import BarChartCard from '../BarChartCard/BarChartCard.jsx'
import XyPlotCard from '../XyPlotCard/XyPlotCard.jsx'
import OscilloscopeCard from '../OscilloscopeCard/OscilloscopeCard.jsx'
import HeatmapCard from '../HeatmapCard/HeatmapCard.jsx'
import LedCard from '../LedCard/LedCard.jsx'
import RgbLedCard from '../RgbLedCard/RgbLedCard.jsx'
import InputButtonCard from '../InputButtonCard/InputButtonCard.jsx'
import CommentText from '../CommentText/CommentText.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './CanvasModule.css'

// Emoji utiles à un module ; la décoration gratuite a été retirée.
const emojiPresets = ['📦', '🧩', '⚙️', '🛠️', '🚀', '🎯', '🧠', '🧪', '🧮', '📚', '🗂️', '🌐', '🔒', '🔑', '⏱️', '📈', '🎨', '🔔', '♻️', '🧭', '🏁', '🧰', '📡', '🧬']

// Symboles Lucide proposés en complément, avec un nom lisible pour les lecteurs d'écran.
const symbolPresets = [
  ['box', Box, 'Box'],
  ['puzzle', Puzzle, 'Puzzle'],
  ['cog', Cog, 'Cog'],
  ['wrench', Wrench, 'Wrench'],
  ['terminal', Terminal, 'Terminal'],
  ['code', Code2, 'Code'],
  ['braces', Braces, 'Braces'],
  ['fileCode', FileCode, 'Source file'],
  ['folder', Folder, 'Folder'],
  ['database', Database, 'Database'],
  ['server', Server, 'Server'],
  ['cloud', Cloud, 'Cloud'],
  ['globe', Globe, 'Globe'],
  ['network', Network, 'Network'],
  ['shield', Shield, 'Shield'],
  ['key', KeyRound, 'Key'],
  ['zap', Zap, 'Bolt'],
  ['rocket', Rocket, 'Rocket'],
  ['bug', Bug, 'Bug'],
  ['flask', FlaskConical, 'Flask'],
  ['cpu', Cpu, 'Processor'],
  ['branch', GitBranch, 'Branch'],
  ['repeat', Repeat, 'Repeat'],
  ['clock', Clock, 'Clock'],
  ['activity', Activity, 'Activity'],
  ['chart', ChartLine, 'Chart'],
  ['compass', Compass, 'Compass'],
  ['flag', Flag, 'Flag'],
  ['target', Target, 'Target'],
  ['bot', Bot, 'Bot'],
  ['sparkles', Sparkles, 'Sparkles'],
]

// Un choix Lucide est stocké comme `lucide:<clé>`, à côté des emoji texte.
const symbolByValue = new Map(symbolPresets.map(([key, Icon]) => [`lucide:${key}`, Icon]))
const emojiLimit = 16

// Rend l'emoji choisi ou le symbole Lucide correspondant.
function EmojiGlyph({ value, size = 15 }) {
  const Icon = symbolByValue.get(value)
  if (Icon) return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
  return <span aria-hidden="true">{value}</span>
}

// Bouton d'emoji posé en haut à gauche du module ; le choix est rendu hors de la carte pour ne pas être rogné.
function ModuleEmoji({ emoji, onChange }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [anchor, setAnchor] = useState(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    // Ferme le choix en visant ailleurs ou avec Échap.
    function handleOutside(event) {
      if (!event.target.closest('.module-emoji__popover') && !buttonRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKey(event) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', handleOutside, true)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('pointerdown', handleOutside, true); document.removeEventListener('keydown', handleKey) }
  }, [open])

  // Ouvre le choix sous le bouton, borné à la fenêtre et à la hauteur disponible.
  function toggle(event) {
    event.stopPropagation()
    if (open) { setOpen(false); return }
    const rect = buttonRef.current.getBoundingClientRect()
    const width = 272
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
    const top = Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 240))
    setAnchor({ left, top, maxHeight: Math.max(160, window.innerHeight - top - 8) })
    setDraft('')
    setOpen(true)
  }

  // Applique la valeur choisie puis referme le choix.
  function choose(value) {
    onChange(value.trim().slice(0, emojiLimit))
    setOpen(false)
  }

  return <>
    <button ref={buttonRef} type="button" className={`canvas-module__emoji${emoji ? ' canvas-module__emoji--set' : ''}`} aria-label={t('module.emojiAdd')} title={t('module.emojiAdd')} onPointerDown={(event) => event.stopPropagation()} onClick={toggle}>
      {emoji ? <EmojiGlyph value={emoji} /> : <Smile size={15} strokeWidth={1.75} aria-hidden="true" />}
    </button>
    {open && anchor && createPortal(<div className="module-emoji__popover" role="dialog" aria-label={t('module.emojiPicker')} style={{ left: anchor.left, top: anchor.top, maxHeight: anchor.maxHeight }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="module-emoji__scroll">
        <p className="module-emoji__section">{t('module.emojiEmoji')}</p>
        <div className="module-emoji__grid" role="group" aria-label={t('module.emojiEmoji')}>
          {emojiPresets.map((value) => <button type="button" key={value} className={`module-emoji__choice${emoji === value ? ' is-selected' : ''}`} aria-label={value} aria-pressed={emoji === value} title={value} onClick={() => choose(value)} onPointerDown={(event) => event.stopPropagation()}>{value}</button>)}
        </div>
        <p className="module-emoji__section">{t('module.emojiSymbols')}</p>
        <div className="module-emoji__grid" role="group" aria-label={t('module.emojiSymbols')}>
          {symbolPresets.map(([key, Icon, label]) => {
            const value = `lucide:${key}`
            return <button type="button" key={key} className={`module-emoji__choice module-emoji__choice--symbol${emoji === value ? ' is-selected' : ''}`} aria-label={label} aria-pressed={emoji === value} title={label} onClick={() => choose(value)} onPointerDown={(event) => event.stopPropagation()}><Icon size={16} strokeWidth={1.75} aria-hidden="true" /></button>
          })}
        </div>
      </div>
      <div className="module-emoji__custom">
        <input className="module-emoji__input" aria-label={t('module.emojiCustom')} value={draft} maxLength={8} placeholder={t('module.emojiCustom')} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); choose(draft) } }} />
        <button type="button" onClick={() => choose(draft)} onPointerDown={(event) => event.stopPropagation()}>{t('module.emojiApply')}</button>
      </div>
      {emoji && <button type="button" className="module-emoji__clear" onClick={() => choose('')} onPointerDown={(event) => event.stopPropagation()}>{t('module.emojiClear')}</button>}
    </div>, document.body)}
  </>
}

// Affiche un conteneur déplaçable par son en-tête et redimensionnable depuis son angle.
export default function CanvasModule({ module, camera, zoom, onResize, onMove, onMoveStart, onMoveEnd, onRename, onTextChange, onImageChange, onImageFile, onEmojiChange, imageSource = null, screenState = null, screenFrames = null, screenPlaying = false, onScreenViewChange, onScreenSequenceEnd = null, gaugeState = null, gaugeFrames = null, gaugePlaying = false, onGaugeViewChange, progressState = null, progressFrames = null, progressPlaying = false, onProgressViewChange, barChartState = null, barChartFrames = null, barChartPlaying = false, onBarChartViewChange, xyPlotState = null, xyPlotFrames = null, xyPlotPlaying = false, onXyPlotViewChange, oscilloscopeState = null, oscilloscopeFrames = null, oscilloscopePlaying = false, onOscilloscopeViewChange, heatmapState = null, heatmapDimensions, onHeatmapViewChange, ledState = null, ledFrames = null, ledPlaying = false, onLedViewChange, rgbLedState = null, rgbLedFrames = null, rgbLedPlaying = false, onRgbLedViewChange, onInputButtonViewChange, onInputChange, children, selected = false, readOnly = false, onSelect, onOpenActions, onToggleLock, onActivate, zIndex = 1, fitRequest = 0, dropState, expansionState = null, onToggleExpansion, pulse = null, pure = false, deferContent = false, semanticLevel = 'detail', functionsView = null }) {
  const { t } = useTranslation()
  const [isMoving, setIsMoving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingComment, setEditingComment] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [isImageDragOver, setIsImageDragOver] = useState(false)
  const resizeRef = useRef(null)
  const moveRef = useRef(null)
  const titleRef = useRef(null)
  const nameInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const restoreNameFocusRef = useRef(false)
  const contentRef = useRef(null)
  const manuallySizedRef = useRef(0)

  useEffect(() => {
    if (editingName) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    } else if (restoreNameFocusRef.current) {
      titleRef.current.focus({ preventScroll: true })
      restoreNameFocusRef.current = false
    }
  }, [editingName])

  // Agrandit après insertion et dépliage ; un redimensionnement manuel suspend cet ajustement jusqu'à la prochaine insertion.
  useLayoutEffect(() => {
    if (!fitRequest || semanticLevel !== 'detail' || manuallySizedRef.current === fitRequest || !contentRef.current) return
    const content = contentRef.current
    const width = Math.max(module.width, 520, Math.ceil(content.scrollWidth + 2))
    if (width > module.width) {
      onResize(module.id, width, module.height)
      return
    }
    const height = Math.max(module.height, Math.ceil(content.scrollHeight + 42))
    if (height > module.height) onResize(module.id, width, height)
  }, [fitRequest, semanticLevel, children, module.id, module.width, module.height, onResize])

  const definition = moduleTypes[module.type]
  const name = module.name || t(definition.labelKey)
  // Les annotations portent un libellé distinct pour ne pas dupliquer le nom d'un module dans les repères d'accessibilité.
  const annotationLabel = definition.hasText ? t('card.comment') : definition.hasImage ? t('card.image') : null
  const cardLabel = annotationLabel ? `${name} · ${annotationLabel}` : name
  // Une carte écran montre son écran par défaut, ou le code de son module caché.
  const screenView = module.screenView === 'code' ? 'code' : 'screen'
  // Une carte jauge montre son aperçu par défaut, ou le code de son module caché.
  const gaugeView = module.gaugeView === 'code' ? 'code' : 'gauge'
  // Une carte barre montre son aperçu par défaut, ou le code de son module caché.
  const progressView = module.progressView === 'code' ? 'code' : 'progress'
  // Un graphique à barres montre son aperçu par défaut, ou le code de son module caché.
  const barChartView = module.barChartView === 'code' ? 'code' : 'barChart'
  const xyPlotView = module.xyPlotView === 'code' ? 'code' : 'xyPlot'
  const oscilloscopeView = module.oscilloscopeView === 'code' ? 'code' : 'oscilloscope'
  const heatmapView = module.heatmapView === 'code' ? 'code' : 'heatmap'
  // Une carte LED montre son voyant par défaut, ou le code de son module caché.
  const ledView = module.ledView === 'code' ? 'code' : 'led'
  // Une LED RVB suit la même bascule, avec son propre aperçu coloré.
  const rgbLedView = module.rgbLedView === 'code' ? 'code' : 'rgbLed'
  // Un bouton d'entrée montre son bouton ou le code de sa globale booléenne.
  const inputButtonView = module.inputButtonView === 'code' ? 'code' : 'button'
  // La bascule d'en-tête promet l'action inverse de l'état actuel du pliage.
  const expansionLabel = t(expansionState === 'collapse' ? 'canvas.collapseAll' : 'canvas.expandAll')
  // Le zoom sémantique remplace les instructions par les fonctions, puis masque le contenu au niveau modules.
  const structuredContent = semanticLevel === 'functions' ? functionsView : semanticLevel === 'detail' ? children : null
  const contentVisible = semanticLevel !== 'modules'

  // Ouvre un brouillon de titre sans modifier le nom tant qu'il n'est pas validé.
  function handleRenameStart() {
    if (!definition.renamable || moveRef.current || resizeRef.current) return
    setDraftName(name)
    restoreNameFocusRef.current = true
    setEditingName(true)
  }

  // Valide un titre non vide ; un brouillon vide conserve le titre précédent.
  function handleRenameCommit(event) {
    if (event?.type === 'blur') restoreNameFocusRef.current = false
    const nextName = draftName.trim()
    if (nextName) onRename(module.id, nextName)
    setEditingName(false)
  }

  // Valide avec Entrée et annule sans mutation avec Échap.
  function handleNameKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleRenameCommit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditingName(false)
    }
  }

  // Transmet l'image choisie au workspace, qui décide de la copier dans `images/` ou de l'intégrer.
  function readImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    onImageFile?.(module.id, file)
  }

  // Ouvre le sélecteur d'image depuis la zone de dépôt.
  function handleImageChange(event) {
    readImageFile(event.target.files?.[0])
    event.target.value = ''
  }

  // Accepte une image déposée depuis l'explorateur de fichiers.
  function handleImageDrop(event) {
    event.preventDefault()
    setIsImageDragOver(false)
    readImageFile(event.dataTransfer.files?.[0])
  }

  // Maintient l'indicateur visible pendant le survol d'une image à déposer.
  function handleImageDragOver(event) {
    event.preventDefault()
    if (event.dataTransfer.types.includes('Files')) setIsImageDragOver(true)
  }

  // Retire l'indicateur quand le pointeur quitte la zone de dépôt.
  function handleImageDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsImageDragOver(false)
  }

  // Déclenche le choix d'une image au clavier sans gêner la légende.
  function handleImageAreaKeyDown(event) {
    if (event.target !== event.currentTarget) return
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      imageInputRef.current?.click()
    }
  }

  // Ajuste la hauteur de la carte au ratio naturel de l'image chargée.
  function handleImageLoad(event) {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) return
    const ratio = naturalWidth / naturalHeight
    const contentHeight = module.width / ratio
    const height = Math.max(minimumModuleSize.height, Math.ceil(contentHeight + 40))
    if (!Number.isFinite(height) || Math.abs(module.height - height) < 1) return
    onResize(module.id, module.width, height)
  }

  // Capture l'en-tête et mémorise la position ainsi que le zoom au début du geste.
  function handleMoveStart(event) {
    if (module.locked || event.button !== 0 || moveRef.current || resizeRef.current) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    moveRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: module.x, originY: module.y, zoom }
    onMoveStart?.(module.id)
    setIsMoving(true)
  }

  // Convertit le glisser en unités monde sans déplacer le canvas ni changer les dimensions.
  function handleMove(event) {
    const move = moveRef.current
    if (!move || move.pointerId !== event.pointerId) return
    const x = move.originX + (event.clientX - move.x) / move.zoom
    const y = move.originY + (event.clientY - move.y) / move.zoom
    if (Number.isFinite(x) && Number.isFinite(y)) onMove(module.id, x, y)
  }

  // Libère le geste aussi en cas d'annulation ou de perte de capture.
  function handleMoveEnd(event) {
    if (moveRef.current?.pointerId !== event.pointerId) return
    moveRef.current = null
    setIsMoving(false)
    onMoveEnd?.(module.id)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Propose le déplacement au clavier lorsque l'en-tête possède le focus.
  function handleMoveKeyDown(event) {
    if (moveRef.current || resizeRef.current) return
    if (definition.renamable && ['Enter', 'F2'].includes(event.key)) {
      event.preventDefault()
      handleRenameStart()
      return
    }
    const directions = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
    const direction = directions[event.key]
    if (!direction || module.locked) return
    event.preventDefault()
    const x = module.x + direction[0]
    const y = module.y + direction[1]
    if (Number.isFinite(x) && Number.isFinite(y)) onMove(module.id, x, y)
  }

  // Mémorise les dimensions initiales et capture le geste sur la poignée.
  function handleResizeStart(event) {
    if (module.locked || event.button !== 0 || resizeRef.current || moveRef.current) return
    manuallySizedRef.current = fitRequest
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: module.width,
      height: module.height,
      zoom,
    }
  }

  // Convertit le déplacement écran en dimensions du monde, avec un minimum lisible.
  function handleResizeMove(event) {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return

    const width = Math.max(minimumModuleSize.width, resize.width + (event.clientX - resize.x) / resize.zoom)
    const height = Math.max(minimumModuleSize.height, resize.height + (event.clientY - resize.y) / resize.zoom)
    if (Number.isFinite(width) && Number.isFinite(height)) onResize(module.id, width, height)
  }

  // Termine le redimensionnement après relâchement, annulation ou perte de capture.
  function handleResizeEnd(event) {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  // Rend les dimensions ajustables au clavier depuis la poignée.
  function handleResizeKeyDown(event) {
    const directions = {
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0],
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
    }
    const direction = directions[event.key]
    if (!direction || module.locked) return
    manuallySizedRef.current = fitRequest
    event.preventDefault()
    onResize(
      module.id,
      Math.max(minimumModuleSize.width, module.width + direction[0]),
      Math.max(minimumModuleSize.height, module.height + direction[1]),
    )
  }

  return (
    <section
      className={`canvas-module canvas-module--${module.type}${definition.hasEmoji ? ' canvas-module--emoji' : ''}${module.locked ? ' canvas-module--locked' : ''}${isMoving ? ' canvas-module--moving' : ''}${selected ? ' canvas-module--selected' : ''}${dropState ? ` canvas-module--drop-${dropState}` : ''}`}
      role="group"
      aria-label={cardLabel}
      data-source-module={definition.hasText || definition.hasImage ? undefined : module.id}
      data-card-id={module.id}
      data-card-type={module.type}
      data-semantic-level={semanticLevel}
      style={{
        left: `calc(50% + ${(module.x - camera.x) * zoom}px)`,
        top: `calc(50% + ${(module.y - camera.y) * zoom}px)`,
        width: module.width,
        height: module.height,
        zIndex,
        transform: `scale(${zoom})`,
      }}
      onPointerDown={(event) => { onActivate?.(); event.stopPropagation() }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={onSelect}
    >
      {!readOnly && <NodeMenuButton label={name} onOpen={onOpenActions} />}
      {typeof pulse === 'number' && <span key={pulse} className="canvas-module__pulse" aria-hidden="true" />}
      <header className="canvas-module__header">
        {definition.hasEmoji && !readOnly && <ModuleEmoji emoji={module.emoji ?? ''} onChange={(value) => onEmojiChange(module.id, value)} />}
        <h2>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="canvas-module__name-input"
              aria-label={t('canvas.name', { kind: t(definition.labelKey) })}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={handleRenameCommit}
              onKeyDown={handleNameKeyDown}
            />
          ) : (
            <button
              ref={titleRef}
              type="button"
              className="canvas-module__move"
              aria-label={t('canvas.move', { name })}
              title={readOnly ? name : t(module.locked ? 'canvas.lockedHint' : definition.renamable ? 'canvas.renameHint' : 'canvas.moveHint')}
              onDoubleClick={readOnly ? undefined : handleRenameStart}
              onPointerDown={readOnly ? undefined : handleMoveStart}
              onPointerMove={readOnly ? undefined : handleMove}
              onPointerUp={readOnly ? undefined : handleMoveEnd}
              onPointerCancel={readOnly ? undefined : handleMoveEnd}
              onLostPointerCapture={readOnly ? undefined : handleMoveEnd}
              onKeyDown={readOnly ? undefined : handleMoveKeyDown}
            >
              <span className="canvas-module__marker" aria-hidden="true" />
              <span className="canvas-module__name">{name}</span>
            </button>
          )}
        </h2>
        {module.type === 'class' && <span className="canvas-module__class" title={t('card.class')} aria-label={t('card.class')}>{t('card.class')}</span>}
        {pure && <span className="canvas-module__pure" title={t('canvas.pureHint')} aria-label={t('canvas.pureHint')}>{t('canvas.pure')}</span>}
        {definition.hasScreen && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(screenView === 'code' ? 'screen.viewScreen' : 'screen.viewCode')}
          aria-pressed={screenView === 'code'}
          title={t(screenView === 'code' ? 'screen.viewScreen' : 'screen.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onScreenViewChange?.(module.id, screenView === 'code' ? 'screen' : 'code') }}
        >
          {screenView === 'code' ? <Monitor size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasGauge && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(gaugeView === 'code' ? 'gauge.viewGauge' : 'gauge.viewCode')}
          aria-pressed={gaugeView === 'code'}
          title={t(gaugeView === 'code' ? 'gauge.viewGauge' : 'gauge.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onGaugeViewChange?.(module.id, gaugeView === 'code' ? 'gauge' : 'code') }}
        >
          {gaugeView === 'code' ? <Gauge size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasProgress && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(progressView === 'code' ? 'progress.viewProgress' : 'progress.viewCode')}
          aria-pressed={progressView === 'code'}
          title={t(progressView === 'code' ? 'progress.viewProgress' : 'progress.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onProgressViewChange?.(module.id, progressView === 'code' ? 'progress' : 'code') }}
        >
          {progressView === 'code' ? <Activity size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasHeatmap && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(heatmapView === 'code' ? 'heatmap.viewHeatmap' : 'heatmap.viewCode')}
          aria-pressed={heatmapView === 'code'}
          title={t(heatmapView === 'code' ? 'heatmap.viewHeatmap' : 'heatmap.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onHeatmapViewChange?.(module.id, heatmapView === 'code' ? 'heatmap' : 'code') }}
        >
          {heatmapView === 'code' ? <Monitor size={13} aria-hidden="true" /> : <Code2 size={13} aria-hidden="true" />}
        </button>}
        {definition.hasBarChart && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(barChartView === 'code' ? 'barChart.viewBarChart' : 'barChart.viewCode')}
          aria-pressed={barChartView === 'code'}
          title={t(barChartView === 'code' ? 'barChart.viewBarChart' : 'barChart.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onBarChartViewChange?.(module.id, barChartView === 'code' ? 'barChart' : 'code') }}
        >
          {barChartView === 'code' ? <ChartColumn size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasXyPlot && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(xyPlotView === 'code' ? 'xyPlot.viewXyPlot' : 'xyPlot.viewCode')}
          aria-pressed={xyPlotView === 'code'}
          title={t(xyPlotView === 'code' ? 'xyPlot.viewXyPlot' : 'xyPlot.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onXyPlotViewChange?.(module.id, xyPlotView === 'code' ? 'xyPlot' : 'code') }}
        >
          {xyPlotView === 'code' ? <ChartLine size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasOscilloscope && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(oscilloscopeView === 'code' ? 'oscilloscope.viewOscilloscope' : 'oscilloscope.viewCode')}
          aria-pressed={oscilloscopeView === 'code'}
          title={t(oscilloscopeView === 'code' ? 'oscilloscope.viewOscilloscope' : 'oscilloscope.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onOscilloscopeViewChange?.(module.id, oscilloscopeView === 'code' ? 'oscilloscope' : 'code') }}
        >
          {oscilloscopeView === 'code' ? <AudioWaveform size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasLed && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(ledView === 'code' ? 'led.viewLed' : 'led.viewCode')}
          aria-pressed={ledView === 'code'}
          title={t(ledView === 'code' ? 'led.viewLed' : 'led.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onLedViewChange?.(module.id, ledView === 'code' ? 'led' : 'code') }}
        >
          {ledView === 'code' ? <Lightbulb size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasRgbLed && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(rgbLedView === 'code' ? 'rgbLed.viewRgbLed' : 'rgbLed.viewCode')}
          aria-pressed={rgbLedView === 'code'}
          title={t(rgbLedView === 'code' ? 'rgbLed.viewRgbLed' : 'rgbLed.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onRgbLedViewChange?.(module.id, rgbLedView === 'code' ? 'rgbLed' : 'code') }}
        >
          {rgbLedView === 'code' ? <Palette size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {definition.hasInputButton && semanticLevel !== 'modules' && !readOnly && <button
          type="button"
          className="canvas-module__view"
          aria-label={t(inputButtonView === 'code' ? 'inputButton.viewButton' : 'inputButton.viewCode')}
          aria-pressed={inputButtonView === 'code'}
          title={t(inputButtonView === 'code' ? 'inputButton.viewButton' : 'inputButton.viewCode')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onInputButtonViewChange?.(module.id, inputButtonView === 'code' ? 'button' : 'code') }}
        >
          {inputButtonView === 'code' ? <MousePointerClick size={13} strokeWidth={2} aria-hidden="true" /> : <Code2 size={13} strokeWidth={2} aria-hidden="true" />}
        </button>}
        {module.locked && !readOnly && <button
          type="button"
          className="canvas-module__lock"
          aria-label={`${t('canvas.unlock')} ${name}`}
          title={t('canvas.unlock')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onToggleLock(module.id) }}
        >
          <Lock size={13} strokeWidth={2} aria-hidden="true" />
        </button>}
        {semanticLevel === 'detail' && expansionState && <button
          type="button"
          className="canvas-module__expansion"
          aria-label={`${expansionLabel} · ${name}`}
          title={expansionLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onToggleExpansion(module.id) }}
        >
          {expansionState === 'collapse' ? <ChevronsDownUp size={14} strokeWidth={2} aria-hidden="true" /> : <ChevronsUpDown size={14} strokeWidth={2} aria-hidden="true" />}
        </button>}
      </header>
      {definition.hasInputButton ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : inputButtonView === 'code'
              ? (deferContent ? null : structuredContent)
              : <InputButtonCard card={module} onChange={(pressed) => onInputChange?.(module.id, pressed)} />}
        </div>
      ) : definition.hasLed ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : ledView === 'code'
              ? (deferContent ? null : structuredContent)
              : <LedCard card={module} state={ledState} frames={ledFrames} playing={ledPlaying} />}
        </div>
      ) : definition.hasRgbLed ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : rgbLedView === 'code'
              ? (deferContent ? null : structuredContent)
              : <RgbLedCard card={module} state={rgbLedState} frames={rgbLedFrames} playing={rgbLedPlaying} />}
        </div>
      ) : definition.hasGauge ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : gaugeView === 'code'
              ? (deferContent ? null : structuredContent)
              : <GaugeCard card={module} state={gaugeState} frames={gaugeFrames} playing={gaugePlaying} />}
        </div>
      ) : definition.hasProgress ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : progressView === 'code'
              ? (deferContent ? null : structuredContent)
              : <ProgressCard card={module} state={progressState} frames={progressFrames} playing={progressPlaying} />}
        </div>
      ) : definition.hasXyPlot ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : xyPlotView === 'code'
              ? (deferContent ? null : structuredContent)
              : <XyPlotCard card={module} state={xyPlotState} frames={xyPlotFrames} playing={xyPlotPlaying} />}
        </div>
      ) : definition.hasOscilloscope ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : oscilloscopeView === 'code'
              ? (deferContent ? null : structuredContent)
              : <OscilloscopeCard card={module} state={oscilloscopeState} frames={oscilloscopeFrames} playing={oscilloscopePlaying} />}
        </div>
      ) : definition.hasHeatmap ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible ? null : heatmapView === 'code'
            ? (deferContent ? null : structuredContent)
            : <HeatmapCard card={module} dimensions={heatmapDimensions} state={heatmapState} />}
        </div>
      ) : definition.hasBarChart ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : barChartView === 'code'
              ? (deferContent ? null : structuredContent)
              : <BarChartCard card={module} state={barChartState} frames={barChartFrames} playing={barChartPlaying} />}
        </div>
      ) : definition.hasScreen ? (
        <div className="canvas-module__content" data-canvas-scroll tabIndex={0}>
          {!contentVisible
            ? null
            : screenView === 'code'
              ? structuredContent
              : <ScreenCanvas card={module} state={screenState} frames={screenFrames} screenId={module.id} playing={screenPlaying} onSequenceEnd={onScreenSequenceEnd} />}
        </div>
      ) : definition.hasText ? (
        readOnly ? (
          <div className="canvas-module__comment canvas-module__comment--view canvas-module__comment--readonly">
            {module.text ? <CommentText text={module.text} /> : <span className="canvas-module__comment-placeholder">{t('canvas.notePlaceholder')}</span>}
          </div>
        ) : editingComment ? (
          <textarea
            className="canvas-module__comment"
            aria-label={t('canvas.text', { name })}
            placeholder={t('canvas.notePlaceholder')}
            value={module.text ?? ''}
            onChange={(event) => onTextChange(module.id, event.target.value)}
            onBlur={() => setEditingComment(false)}
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div
            className="canvas-module__comment canvas-module__comment--view"
            role="button"
            tabIndex={0}
            aria-label={t('canvas.text', { name })}
            title={t('canvas.mathHint')}
            onClick={() => setEditingComment(true)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEditingComment(true) } }}
          >
            {module.text ? <CommentText text={module.text} /> : <span className="canvas-module__comment-placeholder">{t('canvas.notePlaceholder')}</span>}
          </div>
        )
      ) : definition.hasImage ? readOnly ? (
        <div className="canvas-module__image-content" data-canvas-scroll>
          {imageSource ? <img className="canvas-module__image" src={imageSource} alt={module.caption || name} /> : <span className="canvas-module__image-empty">{t('canvas.empty')}</span>}
          {module.caption && <p className="canvas-module__caption-view">{module.caption}</p>}
        </div>
      ) : (
        <div
          ref={contentRef}
          className={`canvas-module__image-content${imageSource ? '' : ' canvas-module__image-content--empty'}${isImageDragOver ? ' canvas-module__image-content--drag-over' : ''}`}
          data-canvas-scroll
          role="button"
          tabIndex={0}
          aria-label={imageSource ? t('canvas.replaceImage') : t('canvas.chooseImage')}
          onClick={(event) => { if (!event.target.closest('textarea')) imageInputRef.current?.click() }}
          onKeyDown={handleImageAreaKeyDown}
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
        >
          {imageSource ? <img className="canvas-module__image" src={imageSource} alt={module.caption || name} onLoad={handleImageLoad} /> : <span className="canvas-module__image-empty">{t('canvas.chooseImage')}</span>}
          <span className="canvas-module__image-overlay" aria-hidden="true">
            {isImageDragOver ? t('canvas.dropImage') : imageSource ? t('canvas.replaceImage') : ''}
          </span>
          <label className="canvas-module__caption">
            <span className="canvas-module__caption-label">{t('canvas.imageCaption')}</span>
            <textarea aria-label={t('canvas.imageCaption')} value={module.caption ?? ''} placeholder={t('canvas.imageCaptionPlaceholder')} onChange={(event) => onImageChange(module.id, { caption: event.target.value })} />
          </label>
          <input ref={imageInputRef} className="canvas-module__image-input" type="file" accept="image/*" onChange={handleImageChange} />
        </div>
      ) : <div ref={contentRef} className="canvas-module__content" data-canvas-scroll>{semanticLevel === 'detail' && deferContent ? null : structuredContent}</div>}
      {!module.locked && !readOnly && <button
        className="canvas-module__resize"
        type="button"
        aria-label={t('canvas.resize', { name })}
        title={t('canvas.resizeHint')}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onLostPointerCapture={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 12l7-7M9 12l3-3" />
        </svg>
      </button>}
    </section>
  )
}

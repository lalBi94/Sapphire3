import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown, Lock } from 'lucide-react'
import { minimumModuleSize, moduleTypes } from '../../utils/moduleTypes.js'
import { isEmbeddedImage } from '../../utils/embeddedImage.js'
import NodeMenuButton from '../NodeMenuButton/NodeMenuButton.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './CanvasModule.css'

// Affiche un conteneur déplaçable par son en-tête et redimensionnable depuis son angle.
export default function CanvasModule({ module, camera, zoom, onResize, onMove, onRename, onTextChange, onImageChange, children, selected = false, onSelect, onOpenActions, onToggleLock, onActivate, zIndex = 1, fitRequest = 0, dropState, expansionState = null, onToggleExpansion }) {
  const { t } = useTranslation()
  const [isMoving, setIsMoving] = useState(false)
  const [editingName, setEditingName] = useState(false)
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
    if (!fitRequest || manuallySizedRef.current === fitRequest || !contentRef.current) return
    const content = contentRef.current
    const width = Math.max(module.width, 520, Math.ceil(content.scrollWidth + 2))
    if (width > module.width) {
      onResize(module.id, width, module.height)
      return
    }
    const height = Math.max(module.height, Math.ceil(content.scrollHeight + 42))
    if (height > module.height) onResize(module.id, width, height)
  }, [fitRequest, children, module.id, module.width, module.height, onResize])

  const definition = moduleTypes[module.type]
  const name = module.name || t(definition.labelKey)
  // La bascule d'en-tête promet l'action inverse de l'état actuel du pliage.
  const expansionLabel = t(expansionState === 'collapse' ? 'canvas.collapseAll' : 'canvas.expandAll')

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

  // Enregistre une image locale sous forme de données intégrées à la carte.
  function readImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (isEmbeddedImage(reader.result)) onImageChange(module.id, { image: reader.result })
    })
    reader.readAsDataURL(file)
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
      className={`canvas-module canvas-module--${module.type}${module.locked ? ' canvas-module--locked' : ''}${isMoving ? ' canvas-module--moving' : ''}${selected ? ' canvas-module--selected' : ''}${dropState ? ` canvas-module--drop-${dropState}` : ''}`}
      aria-label={name}
      data-source-module={definition.hasText || definition.hasImage ? undefined : module.id}
      data-card-id={module.id}
      data-card-type={module.type}
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
      <NodeMenuButton label={name} onOpen={onOpenActions} />
      <header className="canvas-module__header">
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
              title={t(module.locked ? 'canvas.lockedHint' : definition.renamable ? 'canvas.renameHint' : 'canvas.moveHint')}
              onDoubleClick={handleRenameStart}
              onPointerDown={handleMoveStart}
              onPointerMove={handleMove}
              onPointerUp={handleMoveEnd}
              onPointerCancel={handleMoveEnd}
              onLostPointerCapture={handleMoveEnd}
              onKeyDown={handleMoveKeyDown}
            >
              <span className="canvas-module__marker" aria-hidden="true" />
              <span className="canvas-module__name">{name}</span>
            </button>
          )}
        </h2>
        {module.locked && <button
          type="button"
          className="canvas-module__lock"
          aria-label={`${t('canvas.unlock')} ${name}`}
          title={t('canvas.unlock')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onToggleLock(module.id) }}
        >
          <Lock size={13} strokeWidth={2} aria-hidden="true" />
        </button>}
        {expansionState && <button
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
      {definition.hasText ? (
        <textarea
          className="canvas-module__comment"
          aria-label={t('canvas.text', { name })}
          placeholder={t('canvas.notePlaceholder')}
          value={module.text ?? ''}
          onChange={(event) => onTextChange(module.id, event.target.value)}
          spellCheck={false}
        />
      ) : definition.hasImage ? (
        <div
          ref={contentRef}
          className={`canvas-module__image-content${module.image ? '' : ' canvas-module__image-content--empty'}${isImageDragOver ? ' canvas-module__image-content--drag-over' : ''}`}
          data-canvas-scroll
          role="button"
          tabIndex={0}
          aria-label={module.image ? t('canvas.replaceImage') : t('canvas.chooseImage')}
          onClick={(event) => { if (!event.target.closest('textarea')) imageInputRef.current?.click() }}
          onKeyDown={handleImageAreaKeyDown}
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
        >
          {module.image ? <img className="canvas-module__image" src={module.image} alt={module.caption || name} onLoad={handleImageLoad} /> : <span className="canvas-module__image-empty">{t('canvas.chooseImage')}</span>}
          <span className="canvas-module__image-overlay" aria-hidden="true">
            {isImageDragOver ? t('canvas.dropImage') : module.image ? t('canvas.replaceImage') : ''}
          </span>
          <label className="canvas-module__caption">
            <span className="canvas-module__caption-label">{t('canvas.imageCaption')}</span>
            <textarea aria-label={t('canvas.imageCaption')} value={module.caption ?? ''} placeholder={t('canvas.imageCaptionPlaceholder')} onChange={(event) => onImageChange(module.id, { caption: event.target.value })} />
          </label>
          <input ref={imageInputRef} className="canvas-module__image-input" type="file" accept="image/*" onChange={handleImageChange} />
        </div>
      ) : <div ref={contentRef} className="canvas-module__content" data-canvas-scroll>{children}</div>}
      {!module.locked && <button
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

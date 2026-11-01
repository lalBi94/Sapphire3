import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import useCanvasDocument from '../../hooks/useCanvasDocument.jsx'
import useNodeTransfers from '../../hooks/useNodeTransfers.jsx'
import useNodeSearch from '../../hooks/useNodeSearch.jsx'
import CanvasStatus from '../CanvasStatus/CanvasStatus.jsx'
import Minimap from '../Minimap/Minimap.jsx'
import CanvasContextMenu from '../CanvasContextMenu/CanvasContextMenu.jsx'
import CanvasModule from '../CanvasModule/CanvasModule.jsx'
import CanvasLinks from '../CanvasLinks/CanvasLinks.jsx'
import LogicTree from '../LogicTree/LogicTree.jsx'
import LogicContextMenu from '../LogicContextMenu/LogicContextMenu.jsx'
import NodeProperties from '../NodeProperties/NodeProperties.jsx'
import { moduleTypes } from '../../utils/moduleTypes.js'
import { expandableNodeIdsByModule, expandAllNodeIds, isFullyExpanded } from '../../utils/nodeTree.js'
import { scrollNodeIntoCard } from '../../utils/cardScroll.js'
import { buildWorkspaceSvg } from '../../utils/workspaceSvg.js'
import ProjectNavigation from '../ProjectNavigation/ProjectNavigation.jsx'
import useWorkspaceFiles from '../../hooks/useWorkspaceFiles.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { diagnosticLabel, kindLabel, nodeSummary } from '../LogicTree/logicLabels.js'
import { createDebugSession, moveDebugSession, simulateProgram, getModuleLinks, getNodeSchema } from '../../utils/logic/index.js'
import { transpileProgram } from '../../utils/transpilation/index.js'
import { transpilationLanguages } from '../../utils/transpilation/languages.js'
import { exportWorkspaceFile } from '../../services/workspaceFiles.js'
import SimulationPanel from '../SimulationPanel/SimulationPanel.jsx'
import DebugPanel from '../DebugPanel/DebugPanel.jsx'
import TranspilePanel from '../TranspilePanel/TranspilePanel.jsx'
import NodeGraphPanel from '../NodeGraphPanel/NodeGraphPanel.jsx'
import NodeSearchPanel from '../NodeSearchPanel/NodeSearchPanel.jsx'
import './Canvas.css'

// Assemble présentation, document source et interactions, sans confondre position et syntaxe.
export default function Canvas() {
  const [contextMenu, setContextMenu] = useState(null)
  const [selection, setSelected] = useState(null)
  const [activeCardId, setActiveCardId] = useState(null)
  const [growthRequest, setGrowthRequest] = useState({ moduleId: null, revision: 0 })
  const [distorted, setDistorted] = useState(true)
  const [simulationResult, setSimulationResult] = useState(null)
  const [execution, setExecution] = useState(null)
  const [debugSession, setDebugSession] = useState(null)
  const [transpilationResult, setTranspilationResult] = useState(null)
  const [transpileExportError, setTranspileExportError] = useState(null)
  const [nodeGraph, setNodeGraph] = useState(null)
  const [revealTarget, setRevealTarget] = useState(null)
  const menuTriggerRef = useRef(null)
  const workspaceRef = useRef(null)
  const { language, t } = useTranslation()
  const document = useCanvasDocument()
  const search = useNodeSearch()
  const selected = selection && (selection.kind === 'module' ? document.index.modules.has(selection.id) : document.index.nodes.has(selection.id)) ? selection : null
  const { camera, zoom, canvasRef, isPanning, handlePointerDown, handlePointerMove, handlePointerEnd, handleKeyDown, handleRecenter, panTo, zoomBy, resetZoom, restoreCamera } = useCanvasPan()
  const files = useWorkspaceFiles({ project: document.project, cards: document.cards, camera, selected, onReplace: handleReplaceWorkspace })
  const transfers = useNodeTransfers({ project: document.project, index: document.index, selected, workspaceRef, onPaste: document.pasteNode, onMove: document.moveNode, onDuplicate: document.duplicateNode, onTransferred: handleNodeTransferred })

  useEffect(() => {
    setExecution(null)
    setSimulationResult(null)
    setDebugSession(null)
    setTranspilationResult(null)
    setTranspileExportError(null)
  }, [document.project])

  useEffect(() => {
    if (!execution?.running) return undefined
    const timer = window.setTimeout(() => {
      setExecution((current) => {
        if (!current || current.index >= current.trace.length - 1) return current ? { ...current, running: false } : null
        return { ...current, index: current.index + 1 }
      })
    }, 420)
    return () => window.clearTimeout(timer)
  }, [execution])

  const debugFrame = debugSession?.project === document.project ? debugSession.frames[debugSession.cursor] : null
  const activeExecutionId = debugSession ? debugFrame?.nodeId ?? null : execution?.trace[execution.index] ?? null
  // Identité de la session d'exécution courante : un nouveau Run ou une nouvelle session de debug réinitialise le repli manuel.
  const executionSession = debugSession?.project === document.project ? debugSession.frames : execution?.trace ?? null
  // Les liens intermodules ne dépendent que de l'analyse, pas du déplacement des cartes.
  const moduleLinks = useMemo(() => getModuleLinks(document.index), [document.index])
  // Une carte masquée reste dans le document et le fichier ; elle n'est simplement pas montée.
  const visibleCards = useMemo(() => document.cards.filter((card) => !card.hidden), [document.cards])
  const hiddenCards = useMemo(() => document.cards.filter((card) => card.hidden), [document.cards])
  // La mini-carte ne montre que les modules visibles, comme le cadre de recentrage.
  const minimapModules = useMemo(() => visibleCards.filter((card) => card.type === 'module').map(({ id, x, y, width, height }) => ({ id, x, y, width, height })), [visibleCards])
  // Les nœuds qui contiennent autre chose ne dépendent que de la source analysée.
  const expandableIds = useMemo(() => expandableNodeIdsByModule(document.index), [document.index])

  // Suit le bloc exécuté pour ouvrir ses propriétés sans réinitialiser la position du panneau.
  useEffect(() => {
    if (!activeExecutionId) return
    setSelected((current) => current?.kind === 'node' && current.id === activeExecutionId ? current : { kind: 'node', id: activeExecutionId })
    const moduleId = document.index.nodes.get(activeExecutionId)?.moduleId
    if (moduleId) setActiveCardId(moduleId)
  }, [activeExecutionId])

  // Une fois les ancêtres dépliés dans le DOM, amène le bloc recherché au centre de son module.
  useEffect(() => {
    if (!revealTarget) return
    const element = workspaceRef.current?.querySelector(`[data-source-node="${revealTarget.nodeId}"]`)
    if (element) scrollNodeIntoCard(element, 'center')
    setRevealTarget(null)
  }, [revealTarget])

  // Restaure source, présentation et vue ensemble après confirmation d'import.
  function handleReplaceWorkspace(workspace) {
    transfers.reset()
    setNodeGraph(null)
    setDebugSession(null)
    setExecution(null)
    setSimulationResult(null)
    document.replaceWorkspace(workspace)
    restoreCamera(workspace.presentation.camera)
    setSelected(workspace.presentation.selected)
    setActiveCardId(workspace.presentation.selected?.kind === 'module' ? workspace.presentation.selected.id : null)
    setGrowthRequest({ moduleId: null, revision: 0 })
    menuTriggerRef.current = null
    setContextMenu(null)
  }

  // Place la carte touchée au-dessus des autres cartes sans modifier le document source.
  function bringCardToFront(targetId) {
    if (!targetId) return
    const cardId = targetId.kind !== 'node'
      ? targetId.id
      : document.index.nodes.get(targetId.id)?.moduleId
    if (cardId) setActiveCardId(cardId)
  }

  // Sélectionne une cible et place sa carte au premier plan.
  function handleSelect(targetId) {
    bringCardToFront(targetId)
    setSelected(targetId)
  }

  // Amène un bloc recherché à l'écran : ancêtres dépliés, sélection, module centré à l'échelle actuelle.
  function handleRevealNode(nodeId) {
    const moduleId = document.index.nodes.get(nodeId)?.moduleId
    const card = document.cards.find((entry) => entry.id === moduleId)
    if (!card) return
    const expanded = new Set(card.expandedNodeIds ?? [])
    let cursor = nodeId
    const visited = new Set()
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      expanded.add(cursor)
      const parent = document.index.parents.get(cursor)?.find((entry) => entry.kind === 'node')
      cursor = parent ? parent.id : null
    }
    document.setExpandedNodes(moduleId, [...expanded])
    handleSelect({ kind: 'node', id: nodeId })
    setGrowthRequest((current) => ({ moduleId, revision: current.revision + 1, documentRevision: document.revision }))
    restoreCamera({ x: card.x + card.width / 2, y: card.y + card.height / 2, zoomLevel: camera.zoomLevel })
    setRevealTarget({ nodeId, token: crypto.randomUUID() })
  }

  // Ferme la recherche et rend le clavier de navigation au canvas.
  function handleCloseSearch() {
    search.close()
    canvasRef.current?.focus({ preventScroll: true })
  }

  // Identifie le nœud le plus proche, puis le module ; les annotations restent hors du moteur.
  function handleContextMenu(event) {
    if (event.target.closest('input, textarea')) return
    event.preventDefault()
    if (event.target.closest('[data-canvas-ui], .canvas-status')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const node = event.target.closest('[data-source-node]')
    const card = event.target.closest('[data-card-id]')
    const targetId = node ? { kind: 'node', id: node.dataset.sourceNode } : card ? { kind: card.dataset.cardType, id: card.dataset.cardId } : null
    bringCardToFront(targetId)
    const slot = event.target.closest('[data-slot]')
    const initialSlot = node && slot?.closest('[data-source-node]') === node ? slot.dataset.slot : undefined
    menuTriggerRef.current = null
    setContextMenu({
      id: crypto.randomUUID(), targetId, initialSlot,
      x: targetId ? Math.max(8, x) : Math.max(8, Math.min(x, bounds.width - 192)),
      y: targetId ? Math.max(8, y) : Math.max(8, Math.min(y, bounds.height - (Object.keys(moduleTypes).length * 36 + 24))),
      worldX: camera.x + (x - bounds.width / 2) / zoom,
      worldY: camera.y + (y - bounds.height / 2) / zoom,
    })
  }

  // Ancre le même menu contextuel juste sous le bouton, au clic comme au clavier.
  function handleOpenActions(event, targetId) {
    const bounds = canvasRef.current.getBoundingClientRect()
    const button = event.currentTarget.getBoundingClientRect()
    bringCardToFront(targetId)
    menuTriggerRef.current = event.currentTarget
    setContextMenu({ id: crypto.randomUUID(), targetId, x: Math.max(8, button.left - bounds.left), y: Math.max(8, Math.min(button.bottom - bounds.top + 4, bounds.height - 16)), anchored: true })
  }

  // Ouvre le même menu logique depuis la barre d’édition pour la cible sélectionnée.
  function handleOpenSelectionMenu() {
    if (!selected || selected.kind !== 'node' && selected.kind !== 'module') return
    bringCardToFront(selected)
    menuTriggerRef.current = null
    setContextMenu({ id: crypto.randomUUID(), targetId: selected, x: 16, y: 12 })
  }

  // Ferme le menu sans voler le focus lorsqu'une autre interaction commence.
  function handleCloseMenu(restoreFocus) {
    const trigger = menuTriggerRef.current
    menuTriggerRef.current = null
    setContextMenu(null)
    if (restoreFocus) (trigger?.isConnected ? trigger : canvasRef.current).focus({ preventScroll: true })
  }

  // Crée une carte et, sauf pour Comment, son module source de même identifiant.
  function handleCreateModule(type) {
    if (!contextMenu) return
    document.createCard(type, { x: contextMenu.worldX, y: contextMenu.worldY }, t(moduleTypes[type].labelKey))
    handleCloseMenu(true)
  }

  // Lance une simulation locale uniquement sur un programme statiquement valide.
  function handleRunSimulation() {
    setDebugSession(null)
    const result = simulateProgram(document.project)
    setSimulationResult(result)
    setExecution(result.ok && result.trace.length > 0 ? { trace: result.trace, index: 0, running: true } : null)
  }

  // Prépare les arrêts réversibles après l'analyse d'accessibilité, sans changer le workspace.
  function handleDebugSp3() {
    setExecution(null)
    setSimulationResult(null)
    setContextMenu(null)
    setDebugSession(createDebugSession(document.project))
  }

  // Génère le JavaScript uniquement après analyse du document courant.
  function handleTranspile(target) {
    setTranspileExportError(null)
    setTranspilationResult(transpileProgram(document.project, { target }))
  }

  // Ouvre une analyse liée à la cible du menu sans changer la source ni lancer le programme.
  function handleOpenNodeGraph(target, mode) {
    setNodeGraph({ target, mode })
    handleCloseMenu(true)
  }

  // Exporte le résultat déjà affiché sans relancer une analyse différente.
  async function handleExportTranspilation() {
    if (!transpilationResult?.ok) return
    try {
      setTranspileExportError(null)
      const target = transpilationLanguages.find((option) => option.id === transpilationResult.target)
      await exportWorkspaceFile(target.extension, transpilationResult.code, language)
    } catch (failure) {
      setTranspileExportError(failure)
    }
  }

  // Exporte tout le workspace déplié en une vue d'ensemble SVG, à partir de la présentation courante.
  async function handleExportSvg() {
    const svg = buildWorkspaceSvg({
      cards: document.cards,
      index: document.index,
      links: moduleLinks,
      colors: svgPalette(),
      describe: (node) => {
        const summary = nodeSummary(node, document.index, getNodeSchema(node.kind), t)
        return `${kindLabel(node.kind, t)}${node.properties?.name ? ` ${node.properties.name}` : ''}${summary ? ` · ${summary}` : ''}`
      },
    })
    await files.exportText('svg', svg)
  }

  // Relit les couleurs du thème actif pour peindre la vue d'ensemble SVG.
  function svgPalette() {
    const styles = window.getComputedStyle(window.document.documentElement)
    const read = (name) => styles.getPropertyValue(name).trim() || undefined
    const groups = ['variable', 'type', 'function', 'parameter', 'condition', 'loop', 'return', 'block', 'statement', 'operator', 'value', 'array', 'incomplete']
    return {
      background: read('--color-black'), surface: read('--color-module-surface'), comment: read('--color-comment-surface'),
      border: read('--color-border'), text: read('--color-text'), muted: read('--color-text-muted'), accent: read('--color-yellow'),
      node: Object.fromEntries(groups.map((group) => [group, read(`--color-node-${group}`)])),
    }
  }

  // Ne change que le curseur de lecture et l'instantané mémoire exposé au débogueur.
  function handleDebugAction(action) {
    const next = moveDebugSession(debugSession, action)
    const nodeId = next?.frames[next.cursor]?.nodeId
    const moduleId = document.index.nodes.get(nodeId)?.moduleId
    if (moduleId) setActiveCardId(moduleId)
    setDebugSession(next)
  }

  // Calcule le rectangle global des modules visibles, sans inclure les annotations ni les cartes masquées.
  function getModulesBounds() {
    const modules = document.cards.filter((card) => card.type === 'module' && !card.hidden)
    if (modules.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
    const bounds = modules.reduce((current, module) => ({
      left: Math.min(current.left, module.x),
      top: Math.min(current.top, module.y),
      right: Math.max(current.right, module.x + module.width),
      bottom: Math.max(current.bottom, module.y + module.height),
    }), {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    })
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
    }
  }

  // Calcule le chemin logique temporairement déplié jusqu'au nœud exécuté.
  function getExecutionExpandedNodeIds(moduleId) {
    const currentId = activeExecutionId
    if (!currentId) return []
    const currentNode = document.index.nodes.get(currentId)
    if (!currentNode || currentNode.moduleId !== moduleId) return []
    const ids = [currentId]
    let cursor = currentId
    const visited = new Set()
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      const parent = document.index.parents.get(cursor)?.[0]
      if (parent?.kind !== 'node') break
      ids.push(parent.id)
      cursor = parent.id
    }
    return ids
  }

  // La mutation validée retourne le nœud réellement inséré, qui devient la sélection.
  function handleInsert(targetId, slot, draft) {
    const result = document.insertNode(targetId, slot, draft)
    if (result.ok) {
      setSelected({ kind: 'node', id: result.nodeId })
      setGrowthRequest((current) => ({ moduleId: result.index.nodes.get(result.nodeId).moduleId, revision: current.revision + 1, documentRevision: document.revision }))
      handleCloseMenu(false)
    }
    return result
  }

  // Montre la nouvelle position logique après collage, duplication ou déplacement validé.
  function handleNodeTransferred(result) {
    const moduleId = result.index.nodes.get(result.nodeId)?.moduleId
    const card = document.cards.find((entry) => entry.id === moduleId)
    const expanded = new Set(card?.expandedNodeIds ?? [])
    let cursor = result.nodeId
    const visited = new Set()
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      expanded.add(cursor)
      const parent = result.index.parents.get(cursor)?.[0]
      cursor = parent?.kind === 'node' ? parent.id : null
    }
    if (card) document.setExpandedNodes(moduleId, [...expanded])
    setSelected({ kind: 'node', id: result.nodeId })
    setActiveCardId(moduleId)
    setGrowthRequest((current) => ({ moduleId, revision: current.revision + 1, documentRevision: document.revision }))
    handleCloseMenu(false)
  }

  // Referme le menu après une copie réussie, sans changer la source ni la sélection.
  function handleCopyNode(target) {
    const result = transfers.copyNode(target)
    if (result.ok) handleCloseMenu(true)
  }

  // La suppression retire l'arborescence et sélectionne son parent logique.
  function handleDeleteNode(nodeId) {
    const result = document.deleteNode(nodeId)
    if (result.ok) {
      setSelected(result.selection)
      setContextMenu(null)
    }
    return result
  }

  // Ferme la sélection et le menu après le retrait confirmé d'un module.
  function handleDeleteModule(moduleId) {
    const result = document.deleteModule(moduleId)
    if (result.ok) {
      setSelected(null)
      menuTriggerRef.current = null
      handleCloseMenu(true)
    }
    return result
  }

  // Supprime une annotation confirmée sans modifier la sélection logique existante.
  function handleDeleteComment(commentId) {
    const result = document.deleteComment(typeof commentId === 'object' ? commentId.id : commentId)
    if (result.ok) {
      menuTriggerRef.current = null
      handleCloseMenu(true)
    }
    return result
  }

  // Enveloppe la carte sans la supprimer et referme toute sélection qui en dépend.
  function handleHideCard(targetId) {
    const card = document.cards.find((entry) => entry.id === targetId?.id)
    if (!card) return
    document.setCardHidden(card.id, true)
    if (selected && (selected.id === card.id || document.index.nodes.get(selected.id)?.moduleId === card.id)) setSelected(null)
    if (activeCardId === card.id) setActiveCardId(null)
    menuTriggerRef.current = null
    handleCloseMenu(true)
  }

  // Remet une carte masquée à la position conservée dans le document.
  function handleShowCard(cardId) {
    document.setCardHidden(cardId, false)
  }

  // Bascule le verrou d'une carte : déplacement et redimensionnement bloqués, source intacte.
  function handleToggleLock(cardId) {
    const card = document.cards.find((entry) => entry.id === cardId)
    if (card) document.setCardLocked(card.id, !card.locked)
  }

  // Indique si la carte visée est verrouillée.
  function isCardLocked(cardId) {
    return Boolean(cardId && document.cards.find((entry) => entry.id === cardId)?.locked)
  }

  // Rouvre d'un coup toutes les cartes rangées hors du canvas.
  function handleShowAllHidden() {
    for (const card of hiddenCards) document.setCardHidden(card.id, false)
  }

  // Action offerte par la bascule : aucune si le module ne contient rien à déplier, sinon ce qui reste à faire.
  function getExpansionState(cardId) {
    const expandable = expandableIds.get(cardId) ?? []
    if (expandable.length === 0) return null
    return isFullyExpanded(document.cards.find((entry) => entry.id === cardId)?.expandedNodeIds, expandable) ? 'collapse' : 'expand'
  }

  // Déplie toute la structure ou la replie en une seule édition de présentation, sans toucher à la source.
  function handleExpansion(cardId, expand) {
    const card = document.cards.find((entry) => entry.id === cardId)
    const expandable = expandableIds.get(cardId) ?? []
    if (!card || expandable.length === 0) return
    document.setExpandedNodes(card.id, expand ? expandAllNodeIds(card.expandedNodeIds, expandable) : [])
  }

  return (
    <div ref={workspaceRef} className="canvas-workspace">
    <ProjectNavigation busy={files.busy} message={files.message} error={files.error} pendingImport={files.pendingImport} pendingNew={files.pendingNew} recentFiles={files.recentFiles} onSave={files.handleSave} onSaveAs={files.saveAs} onExportSvg={handleExportSvg} onOpenSp3={files.handleOpenSp3} onOpenRecent={files.handleOpenRecent} onImport={files.handleImport} onOpenExample={files.handleOpenExample} onConfirmImport={files.handleConfirmImport} onCancelImport={files.handleCancelImport} onNew={files.handleNew} onConfirmNew={files.handleConfirmNew} onCancelNew={files.handleCancelNew} onDismiss={files.handleDismiss}
      canUndo={document.canUndo} canRedo={document.canRedo} onUndo={document.undo} onRedo={document.redo}
      onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onZoom100={resetZoom} onCenter={() => handleRecenter(getModulesBounds())}
      distorted={distorted} onToggleDistortion={() => setDistorted((current) => !current)}
      hiddenCards={hiddenCards} onShowCard={handleShowCard} onShowAllHidden={handleShowAllHidden}
      hasSelection={Boolean(selected && selected.kind !== 'comment')} onOpenSelectionMenu={handleOpenSelectionMenu} onOpenSearch={search.show} onRunSimulation={handleRunSimulation} onDebugSp3={handleDebugSp3} onTranspile={handleTranspile} />
    <main ref={canvasRef} className={`canvas${isPanning ? ' canvas--panning' : ''}`} aria-label={t('canvas.aria')} tabIndex={0}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu}
      onDragStart={transfers.handleDragStart} onDragOver={transfers.handleDragOver} onDrop={transfers.handleDrop} onDragEnd={transfers.handleDragEnd}>
      <CanvasGrid camera={camera} zoom={zoom} distorted={distorted} />
      <CanvasLinks cards={visibleCards} links={moduleLinks} camera={camera} zoom={zoom} />
      {visibleCards.map((card) => <CanvasModule key={`${document.revision}:${card.id}`} module={card} camera={camera} zoom={zoom}
        dropState={transfers.dropTarget?.kind === 'module' && transfers.dropTarget.id === card.id ? transfers.dropTarget.ok ? 'valid' : 'invalid' : undefined}
        zIndex={activeCardId === card.id ? 2 : 1}
        onActivate={() => bringCardToFront({ kind: card.type, id: card.id })}
        fitRequest={growthRequest.documentRevision === document.revision && growthRequest.moduleId === card.id ? growthRequest.revision : 0}
        onOpenActions={(event) => handleOpenActions(event, { kind: card.type, id: card.id })}
        selected={selected?.kind === 'module' && selected.id === card.id}
        onSelect={() => handleSelect(card.type === 'module' ? { kind: 'module', id: card.id } : null)}
        onResize={(id, width, height) => document.updateGeometry(id, { width, height })}
        onMove={(id, x, y) => document.updateGeometry(id, { x, y })}
        onRename={document.renameCard} onTextChange={document.updateComment} onImageChange={document.updateImage}
        onToggleLock={handleToggleLock}
        expansionState={document.index.modules.has(card.id) ? getExpansionState(card.id) : null} onToggleExpansion={(id) => handleExpansion(id, getExpansionState(id) !== 'collapse')}>
        {card.type === 'module' && document.index.modules.has(card.id) && <LogicTree module={document.index.modules.get(card.id)} index={document.index} selectedId={selected?.kind === 'node' ? selected.id : null} activeExecutionId={activeExecutionId} executionExpandedNodeIds={getExecutionExpandedNodeIds(card.id)} executionSession={executionSession} onSelect={handleSelect} expandedNodeIds={card.expandedNodeIds} onExpandedChange={(ids) => document.setExpandedNodes(card.id, ids)} onOpenActions={handleOpenActions} onReorder={(id, offset) => document.reorderNode(id, offset)} dropTarget={transfers.dropTarget} />}
      </CanvasModule>)}
      <CanvasStatus camera={camera} zoom={zoom} hiddenCount={hiddenCards.length} onShowAllHidden={handleShowAllHidden} onRecenter={() => handleRecenter(getModulesBounds())} />
      <Minimap modules={minimapModules} camera={camera} zoom={zoom} canvasRef={canvasRef} onNavigate={panTo} />
      {transfers.notice && <div className={`canvas-transfer-status${transfers.notice.error ? ' canvas-transfer-status--error' : ''}`} data-canvas-ui role={transfers.notice.error ? 'alert' : 'status'} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <span>{transfers.notice.error ? diagnosticLabel(transfers.notice.error, t) : t(transfers.notice.message)}{transfers.notice.detail && ` · ${diagnosticLabel(transfers.notice.detail, t)}`}</span>
        <button type="button" aria-label={t('nav.dismiss')} onClick={transfers.dismiss}><X size={14} aria-hidden="true" /></button>
      </div>}
      <SimulationPanel result={simulationResult} running={Boolean(execution?.running)} currentStep={execution ? execution.index + 1 : 0} onClose={() => { setSimulationResult(null); setExecution(null) }} />
      {debugSession?.project === document.project && <DebugPanel session={debugSession} index={document.index} onAction={handleDebugAction} onClose={() => setDebugSession(null)} />}
      <TranspilePanel result={transpilationResult} exportError={transpileExportError} onExport={handleExportTranspilation} onClose={() => { setTranspilationResult(null); setTranspileExportError(null) }} />
      {search.open && <NodeSearchPanel index={document.index} cards={visibleCards} selectedId={selected?.kind === 'node' ? selected.id : null} focusToken={search.token} onReveal={handleRevealNode} onClose={handleCloseSearch} />}
      {nodeGraph && <NodeGraphPanel project={document.project} index={document.index} target={nodeGraph.target} mode={nodeGraph.mode} onSelect={handleSelect} onClose={() => setNodeGraph(null)} />}
      {selected && <NodeProperties key={document.revision} selected={selected} project={document.project} index={document.index} onConfigure={document.configureNode} onRename={document.renameCard} onSelect={handleSelect} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onExport={document.exportFunction} onImport={document.importFunction} onRemoveImport={document.removeImport} onContracts={document.setNodeContracts} onClose={() => setSelected(null)} mutationError={document.mutationError} />}
      {contextMenu && (contextMenu.targetId?.kind === 'node' || contextMenu.targetId?.kind === 'module' ? <LogicContextMenu key={contextMenu.id} project={document.project} index={document.index} targetId={contextMenu.targetId} initialSlot={contextMenu.initialSlot} x={contextMenu.x} y={contextMenu.y} onInsert={handleInsert} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onHideCard={handleHideCard} onLockCard={handleToggleLock} targetLocked={isCardLocked(contextMenu.targetId?.id)} onExpansion={(id, expand) => { handleExpansion(id, expand); handleCloseMenu(true) }} canToggleExpansion={contextMenu.targetId?.kind === 'module' && (expandableIds.get(contextMenu.targetId.id)?.length ?? 0) > 0} onOpenGraph={handleOpenNodeGraph} onCopy={handleCopyNode} onPaste={transfers.pasteNode} onDuplicate={transfers.duplicateNode} hasClipboard={transfers.hasClipboard} onClose={handleCloseMenu} />
        : <CanvasContextMenu key={contextMenu.id} x={contextMenu.x} y={contextMenu.y} onCreate={handleCreateModule} onClose={handleCloseMenu} anchored={contextMenu.anchored} commentId={contextMenu.targetId ? { id: contextMenu.targetId.id, type: contextMenu.targetId.kind } : null} onDeleteComment={handleDeleteComment} onHideCard={handleHideCard} onLockCard={handleToggleLock} commentLocked={isCardLocked(contextMenu.targetId?.id)} />)}
    </main>
    </div>
  )
}

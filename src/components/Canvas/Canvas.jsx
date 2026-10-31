import { useEffect, useRef, useState } from 'react'
import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import useCanvasDocument from '../../hooks/useCanvasDocument.jsx'
import CanvasStatus from '../CanvasStatus/CanvasStatus.jsx'
import CanvasContextMenu from '../CanvasContextMenu/CanvasContextMenu.jsx'
import CanvasModule from '../CanvasModule/CanvasModule.jsx'
import LogicTree from '../LogicTree/LogicTree.jsx'
import LogicContextMenu from '../LogicContextMenu/LogicContextMenu.jsx'
import NodeProperties from '../NodeProperties/NodeProperties.jsx'
import { moduleTypes } from '../../utils/moduleTypes.js'
import ProjectNavigation from '../ProjectNavigation/ProjectNavigation.jsx'
import useWorkspaceFiles from '../../hooks/useWorkspaceFiles.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { createDebugSession, moveDebugSession, simulateProgram } from '../../utils/logic/index.js'
import { transpileProgram } from '../../utils/transpilation/index.js'
import { exportWorkspaceFile } from '../../services/workspaceFiles.js'
import SimulationPanel from '../SimulationPanel/SimulationPanel.jsx'
import DebugPanel from '../DebugPanel/DebugPanel.jsx'
import TranspilePanel from '../TranspilePanel/TranspilePanel.jsx'
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
  const menuTriggerRef = useRef(null)
  const { language, t } = useTranslation()
  const document = useCanvasDocument()
  const selected = selection && (selection.kind === 'module' ? document.index.modules.has(selection.id) : document.index.nodes.has(selection.id)) ? selection : null
  const { camera, zoom, canvasRef, isPanning, handlePointerDown, handlePointerMove, handlePointerEnd, handleKeyDown, handleRecenter, zoomBy, resetZoom, restoreCamera } = useCanvasPan()
  const files = useWorkspaceFiles({ project: document.project, cards: document.cards, camera, selected, onReplace: handleReplaceWorkspace })

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

  useEffect(() => {
    const nodeId = debugSession?.project === document.project ? debugSession.frames[debugSession.cursor]?.nodeId : null
    if (!nodeId) return
    const element = canvasRef.current.querySelector(`[data-source-node="${CSS.escape(nodeId)}"]`)
    if (!element) return
    const bounds = canvasRef.current.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    if (rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom) return
    restoreCamera({ ...camera, x: camera.x + (rect.left + rect.width / 2 - bounds.left - bounds.width / 2) / zoom, y: camera.y + (rect.top + rect.height / 2 - bounds.top - bounds.height / 2) / zoom })
  }, [debugSession])

  const debugFrame = debugSession?.project === document.project ? debugSession.frames[debugSession.cursor] : null
  const activeExecutionId = debugSession ? debugFrame?.nodeId ?? null : execution?.trace[execution.index] ?? null

  // Suit le bloc exécuté pour ouvrir ses propriétés sans réinitialiser la position du panneau.
  useEffect(() => {
    if (!activeExecutionId) return
    setSelected((current) => current?.kind === 'node' && current.id === activeExecutionId ? current : { kind: 'node', id: activeExecutionId })
    const moduleId = document.index.nodes.get(activeExecutionId)?.moduleId
    if (moduleId) setActiveCardId(moduleId)
  }, [activeExecutionId])

  // Restaure source, présentation et vue ensemble après confirmation d'import.
  function handleReplaceWorkspace(workspace) {
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
  function handleTranspile() {
    setTranspileExportError(null)
    setTranspilationResult(transpileProgram(document.project, { target: 'javascript' }))
  }

  // Exporte le résultat déjà affiché sans relancer une analyse différente.
  async function handleExportTranspilation() {
    if (!transpilationResult?.ok) return
    try {
      setTranspileExportError(null)
      await exportWorkspaceFile('js', transpilationResult.code, language)
    } catch (failure) {
      setTranspileExportError(failure)
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

  // Calcule le rectangle global des modules sans inclure les annotations de présentation.
  function getModulesBounds() {
    const modules = document.cards.filter((card) => card.type === 'module')
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

  return (
    <div className="canvas-workspace">
    <ProjectNavigation busy={files.busy} message={files.message} error={files.error} pendingImport={files.pendingImport} recentFiles={files.recentFiles} onSave={files.handleSave} onSaveAs={files.saveAs} onOpenSp3={files.handleOpenSp3} onOpenRecent={files.handleOpenRecent} onImport={files.handleImport} onConfirmImport={files.handleConfirmImport} onCancelImport={files.handleCancelImport} onDismiss={files.handleDismiss}
      canUndo={document.canUndo} canRedo={document.canRedo} onUndo={document.undo} onRedo={document.redo}
      onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onZoom100={resetZoom} onCenter={() => handleRecenter(getModulesBounds())}
      distorted={distorted} onToggleDistortion={() => setDistorted((current) => !current)}
      hasSelection={Boolean(selected && selected.kind !== 'comment')} onOpenSelectionMenu={handleOpenSelectionMenu} onRunSimulation={handleRunSimulation} onDebugSp3={handleDebugSp3} onTranspile={handleTranspile} />
    <main ref={canvasRef} className={`canvas${isPanning ? ' canvas--panning' : ''}`} aria-label={t('canvas.aria')} tabIndex={0}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu}>
      <CanvasGrid camera={camera} zoom={zoom} distorted={distorted} />
      {document.cards.map((card) => <CanvasModule key={`${document.revision}:${card.id}`} module={card} camera={camera} zoom={zoom}
        zIndex={activeCardId === card.id ? 2 : 1}
        onActivate={() => bringCardToFront({ kind: card.type, id: card.id })}
        fitRequest={growthRequest.documentRevision === document.revision && growthRequest.moduleId === card.id ? growthRequest.revision : 0}
        onOpenActions={(event) => handleOpenActions(event, { kind: card.type, id: card.id })}
        selected={selected?.kind === 'module' && selected.id === card.id}
        onSelect={() => handleSelect(card.type === 'module' ? { kind: 'module', id: card.id } : null)}
        onResize={(id, width, height) => document.updateGeometry(id, { width, height })}
        onMove={(id, x, y) => document.updateGeometry(id, { x, y })}
        onRename={document.renameCard} onTextChange={document.updateComment} onImageChange={document.updateImage}>
        {card.type === 'module' && document.index.modules.has(card.id) && <LogicTree module={document.index.modules.get(card.id)} index={document.index} selectedId={selected?.kind === 'node' ? selected.id : null} activeExecutionId={activeExecutionId} executionExpandedNodeIds={getExecutionExpandedNodeIds(card.id)} onSelect={handleSelect} expandedNodeIds={card.expandedNodeIds} onExpandedChange={(ids) => document.setExpandedNodes(card.id, ids)} onOpenActions={handleOpenActions} />}
      </CanvasModule>)}
      <CanvasStatus camera={camera} zoom={zoom} onRecenter={() => handleRecenter(getModulesBounds())} />
      <SimulationPanel result={simulationResult} running={Boolean(execution?.running)} currentStep={execution ? execution.index + 1 : 0} onClose={() => { setSimulationResult(null); setExecution(null) }} />
      {debugSession?.project === document.project && <DebugPanel session={debugSession} index={document.index} onAction={handleDebugAction} onClose={() => setDebugSession(null)} />}
      <TranspilePanel result={transpilationResult} exportError={transpileExportError} onExport={handleExportTranspilation} onClose={() => { setTranspilationResult(null); setTranspileExportError(null) }} />
      {selected && <NodeProperties key={document.revision} selected={selected} project={document.project} index={document.index} onConfigure={document.configureNode} onRename={document.renameCard} onSelect={handleSelect} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onExport={document.exportFunction} onImport={document.importFunction} onRemoveImport={document.removeImport} onClose={() => setSelected(null)} mutationError={document.mutationError} />}
      {contextMenu && (contextMenu.targetId?.kind === 'node' || contextMenu.targetId?.kind === 'module' ? <LogicContextMenu key={contextMenu.id} project={document.project} index={document.index} targetId={contextMenu.targetId} initialSlot={contextMenu.initialSlot} x={contextMenu.x} y={contextMenu.y} anchored={contextMenu.anchored} onInsert={handleInsert} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onClose={handleCloseMenu} />
        : <CanvasContextMenu key={contextMenu.id} x={contextMenu.x} y={contextMenu.y} onCreate={handleCreateModule} onClose={handleCloseMenu} anchored={contextMenu.anchored} commentId={contextMenu.targetId ? { id: contextMenu.targetId.id, type: contextMenu.targetId.kind } : null} onDeleteComment={handleDeleteComment} />)}
    </main>
    </div>
  )
}

import { useState } from 'react'
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
import './Canvas.css'

// Assemble présentation, document source et interactions, sans confondre position et syntaxe.
export default function Canvas() {
  const [contextMenu, setContextMenu] = useState(null)
  const [selected, setSelected] = useState(null)
  const document = useCanvasDocument()
  const { camera, zoom, canvasRef, isPanning, handlePointerDown, handlePointerMove, handlePointerEnd, handleKeyDown, handleRecenter, restoreCamera } = useCanvasPan()
  const files = useWorkspaceFiles({ project: document.project, cards: document.cards, camera, selected, onReplace: handleReplaceWorkspace })

  // Restaure source, présentation et vue ensemble après confirmation d'import.
  function handleReplaceWorkspace(workspace) {
    document.replaceWorkspace(workspace)
    restoreCamera(workspace.presentation.camera)
    setSelected(workspace.presentation.selected)
    setContextMenu(null)
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
    const module = event.target.closest('[data-source-module]')
    const targetId = node ? { kind: 'node', id: node.dataset.sourceNode } : module ? { kind: 'module', id: module.dataset.sourceModule } : null
    const slot = event.target.closest('[data-slot]')
    const initialSlot = node && slot?.closest('[data-source-node]') === node ? slot.dataset.slot : undefined
    setContextMenu({
      id: crypto.randomUUID(), targetId, initialSlot,
      x: targetId ? Math.max(8, x) : Math.max(8, Math.min(x, bounds.width - 192)),
      y: targetId ? Math.max(8, y) : Math.max(8, Math.min(y, bounds.height - (Object.keys(moduleTypes).length * 36 + 24))),
      worldX: camera.x + (x - bounds.width / 2) / zoom,
      worldY: camera.y + (y - bounds.height / 2) / zoom,
    })
  }

  // Ferme le menu sans voler le focus lorsqu'une autre interaction commence.
  function handleCloseMenu(restoreFocus) {
    setContextMenu(null)
    if (restoreFocus) canvasRef.current.focus({ preventScroll: true })
  }

  // Crée une carte et, sauf pour Comment, son module source de même identifiant.
  function handleCreateModule(type) {
    if (!contextMenu) return
    document.createCard(type, { x: contextMenu.worldX, y: contextMenu.worldY })
    handleCloseMenu(true)
  }

  // La mutation validée retourne le nœud réellement inséré, qui devient la sélection.
  function handleInsert(targetId, slot, draft) {
    const result = document.insertNode(targetId, slot, draft)
    if (result.ok) {
      setSelected({ kind: 'node', id: result.nodeId })
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
      handleCloseMenu(true)
    }
    return result
  }

  return (
    <div className="canvas-workspace">
    <ProjectNavigation busy={files.busy} message={files.message} error={files.error} pendingImport={files.pendingImport} onExport={files.handleExport} onImport={files.handleImport} onConfirmImport={files.handleConfirmImport} onCancelImport={files.handleCancelImport} onDismiss={files.handleDismiss} />
    <main ref={canvasRef} className={`canvas${isPanning ? ' canvas--panning' : ''}`} aria-label="Programming canvas. Drag to pan. Right-click a container or node to add inside it." tabIndex={0}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu}>
      <CanvasGrid camera={camera} zoom={zoom} />
      {document.cards.map((card) => <CanvasModule key={`${document.revision}:${card.id}`} module={card} camera={camera} zoom={zoom}
        selected={selected?.kind === 'module' && selected.id === card.id}
        onSelect={() => setSelected(card.type === 'comment' ? null : { kind: 'module', id: card.id })}
        onResize={(id, width, height) => document.updateGeometry(id, { width, height })}
        onMove={(id, x, y) => document.updateGeometry(id, { x, y })}
        onRename={document.renameCard} onTextChange={document.updateComment}>
        {card.type !== 'comment' && document.index.modules.has(card.id) && <LogicTree module={document.index.modules.get(card.id)} index={document.index} selectedId={selected?.kind === 'node' ? selected.id : null} onSelect={setSelected} expandedNodeIds={card.expandedNodeIds} onExpandedChange={(ids) => document.setExpandedNodes(card.id, ids)} />}
      </CanvasModule>)}
      <CanvasStatus camera={camera} zoom={zoom} onRecenter={handleRecenter} />
      {selected && <NodeProperties key={`${document.revision}:${selected.kind}:${selected.id}`} selected={selected} project={document.project} index={document.index} onConfigure={document.configureNode} onRename={document.renameCard} onSelect={setSelected} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onClose={() => setSelected(null)} mutationError={document.mutationError} />}
      {contextMenu && (contextMenu.targetId ? <LogicContextMenu key={contextMenu.id} project={document.project} index={document.index} targetId={contextMenu.targetId} initialSlot={contextMenu.initialSlot} x={contextMenu.x} y={contextMenu.y} onInsert={handleInsert} onDelete={handleDeleteNode} onClose={handleCloseMenu} />
        : <CanvasContextMenu key={contextMenu.id} x={contextMenu.x} y={contextMenu.y} onCreate={handleCreateModule} onClose={handleCloseMenu} />)}
    </main>
    </div>
  )
}

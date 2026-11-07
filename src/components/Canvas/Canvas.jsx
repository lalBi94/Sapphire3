import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import CanvasGrid from '../CanvasGrid/CanvasGrid.jsx'
import CanvasHud from '../CanvasHud/CanvasHud.jsx'
import useCanvasPan from '../../hooks/useCanvasPan.jsx'
import useCanvasDocument from '../../hooks/useCanvasDocument.jsx'
import useNodeTransfers from '../../hooks/useNodeTransfers.jsx'
import useNodeSearch from '../../hooks/useNodeSearch.jsx'
import useGlobalKeybinds from '../../hooks/useGlobalKeybinds.jsx'
import useAppUpdate from '../../hooks/useAppUpdate.jsx'
import CanvasStatus from '../CanvasStatus/CanvasStatus.jsx'
import ModuleFunctions from '../ModuleFunctions/ModuleFunctions.jsx'
import { semanticZoomLevel, semanticSearchZoomLevel } from '../../utils/semanticZoom.js'
import { moduleSnapPixels, snapModuleRect } from '../../utils/moduleSnap.js'
import { clampSimulationSpeed, simulationTargetStep } from '../../utils/simulationSpeed.js'
import Minimap from '../Minimap/Minimap.jsx'
import MascotNotification from '../MascotNotification/MascotNotification.jsx'
import CanvasContextMenu from '../CanvasContextMenu/CanvasContextMenu.jsx'
import CanvasModule from '../CanvasModule/CanvasModule.jsx'
import CanvasLinks from '../CanvasLinks/CanvasLinks.jsx'
import LogicTree from '../LogicTree/LogicTree.jsx'
import LogicContextMenu from '../LogicContextMenu/LogicContextMenu.jsx'
import NodeProperties from '../NodeProperties/NodeProperties.jsx'
import ScreenProperties from '../ScreenProperties/ScreenProperties.jsx'
import { logicalCardTypes, moduleCardTypes, moduleTypes } from '../../utils/moduleTypes.js'
import { expandableNodeIdsByModule, expandAllNodeIds, isFullyExpanded } from '../../utils/nodeTree.js'
import { scrollNodeIntoCard } from '../../utils/cardScroll.js'
import { buildWorkspaceSvg } from '../../utils/workspaceSvg.js'
import { layoutModules } from '../../utils/moduleLayout.js'
import { buildDebugValues } from '../../utils/memorySpace.js'
import ProjectNavigation from '../ProjectNavigation/ProjectNavigation.jsx'
import useWorkspaceFiles from '../../hooks/useWorkspaceFiles.jsx'
import useExercise from '../../hooks/useExercise.jsx'
import ExercisePanel from '../ExercisePanel/ExercisePanel.jsx'
import { createExercise } from '../../utils/exercise.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { useNotifications } from '../../contexts/NotificationContext.jsx'
import { diagnosticLabel, nodeLine } from '../LogicTree/logicLabels.js'
import { failureLabel } from '../../utils/translations.js'
import { moveDebugSession, resolveDebugScreens, getModuleLinks, getUnusedDeclarationIds, getPureIds, captureBookmark, captureSourceNode } from '../../utils/logic/index.js'
import { runDebugSession, runSimulation, runTranspilation, runTranspilationChecks, cancelEngineWork, isEngineCancelled } from '../../services/engineRunner.js'
import { transpilationLanguages } from '../../utils/transpilation/languages.js'
import { exportWorkspaceFile } from '../../services/workspaceFiles.js'
import { openExternal } from '../../services/externalLinks.js'
import { quitApplication, toggleFullScreen } from '../../services/appControl.js'
import { rasterizeSvg } from '../../services/nodeImage.js'
import { repositoryUrl } from '../../utils/appInfo.js'
import { loadBookmarks, saveBookmarks } from '../../services/bookmarks.js'
import SimulationPanel from '../SimulationPanel/SimulationPanel.jsx'
import FunctionPanel from '../FunctionPanel/FunctionPanel.jsx'
import DebugPanel from '../DebugPanel/DebugPanel.jsx'
import MemoryPanel from '../MemoryPanel/MemoryPanel.jsx'
import PointerGraphPanel from '../PointerGraphPanel/PointerGraphPanel.jsx'
import FlowPanel from '../FlowPanel/FlowPanel.jsx'
import TranspilePanel from '../TranspilePanel/TranspilePanel.jsx'
import NodeGraphPanel from '../NodeGraphPanel/NodeGraphPanel.jsx'
import NodeSearchPanel from '../NodeSearchPanel/NodeSearchPanel.jsx'
import BookmarkPanel from '../BookmarkPanel/BookmarkPanel.jsx'
import SettingsWindow from '../SettingsWindow/SettingsWindow.jsx'
import SelectionToolbar from '../SelectionToolbar/SelectionToolbar.jsx'
import './Canvas.css'

// Assemble présentation, document source et interactions, sans confondre position et syntaxe.
export default function Canvas() {
  const [contextMenu, setContextMenu] = useState(null)
  const [selection, setSelection] = useState([])
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [activeCardId, setActiveCardId] = useState(null)
  const [growthRequest, setGrowthRequest] = useState({ moduleId: null, revision: 0 })
  const [canvasSize, setCanvasSize] = useState(() => ({ width: typeof window === 'undefined' ? 0 : window.innerWidth, height: typeof window === 'undefined' ? 0 : window.innerHeight }))
  const [distorted, setDistorted] = useState(true)
  const [minimapVisible, setMinimapVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(true)
  const [hudVisible, setHudVisible] = useState(true)
  const [magnetEnabled, setMagnetEnabled] = useState(true)
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] })
  const [fullScreen, setFullScreen] = useState(false)
  const [simulationResult, setSimulationResult] = useState(null)
  const [execution, setExecution] = useState(null)
  const [executionFree, setExecutionFree] = useState(false)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [debugSession, setDebugSession] = useState(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [pointerGraphOpen, setPointerGraphOpen] = useState(false)
  const [flowRun, setFlowRun] = useState(null)
  const [transpilationResult, setTranspilationResult] = useState(null)
  const [transpileExportError, setTranspileExportError] = useState(null)
  const [engineWork, setEngineWork] = useState(null)
  const [nodeGraph, setNodeGraph] = useState(null)
  const [functionTarget, setFunctionTarget] = useState(null)
  const [functionResult, setFunctionResult] = useState(null)
  const [revealTarget, setRevealTarget] = useState(null)
  const simulationEpochRef = useRef(0)
  const engineEpochRef = useRef(0)
  const transpileEpochRef = useRef(0)
  const functionRunTokenRef = useRef(0)
  const screenRerunRef = useRef({ at: 0, inFlight: false })
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks())
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [breakpoints, setBreakpoints] = useState(() => new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const menuTriggerRef = useRef(null)
  const workspaceRef = useRef(null)
  const groupMoveRef = useRef(null)
  const { language, t } = useTranslation()
  const { notify, clear: clearNotifications } = useNotifications()
  const document = useCanvasDocument()
  const search = useNodeSearch()
  const appUpdate = useAppUpdate()
  // La sélection est une liste : la première cible pilote les panneaux, les autres les opérations groupées.
  const selectedTargets = useMemo(() => (Array.isArray(selection) ? selection : []).filter((target) => target?.kind === 'module' ? document.index.modules.has(target.id) : target?.kind === 'node' ? document.index.nodes.has(target.id) : false), [selection, document.index])
  const selected = selectedTargets[0] ?? null
  const selectedIds = useMemo(() => new Set(selectedTargets.map((target) => target.id)), [selectedTargets])
  const selectedNodeIds = useMemo(() => selectedTargets.filter((target) => target.kind === 'node').map((target) => target.id), [selectedTargets])
  const hasScreenSelection = useMemo(() => selectedTargets.some((target) => target.kind === 'module' && document.cards.some((card) => card.id === target.id && !moduleCardTypes.includes(card.type) && logicalCardTypes.includes(card.type))), [selectedTargets, document.cards])
  const selectedModuleIds = useMemo(() => selectedTargets.filter((target) => target.kind === 'module').map((target) => target.id), [selectedTargets])
  const { camera, zoom, canvasRef, isPanning, handlePointerDown, handlePointerMove, handlePointerEnd, handleKeyDown, handleRecenter, panTo, zoomBy, resetZoom, restoreCamera } = useCanvasPan()
  // Suit la surface réelle du canvas pour ne monter que le contenu des cartes visibles.
  useLayoutEffect(() => {
    const element = canvasRef.current
    if (!element) return undefined
    const measure = () => setCanvasSize((current) => current.width === element.clientWidth && current.height === element.clientHeight ? current : { width: element.clientWidth, height: element.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [canvasRef])
  const files = useWorkspaceFiles({ project: document.project, cards: document.cards, camera, selected, exercise: document.exercise, onReplace: handleReplaceWorkspace, onUpdateImage: document.updateImage })
  const exerciseState = useExercise({ project: document.project, exercise: document.exercise })
  const exerciseRevisionRef = useRef(null)
  const transfers = useNodeTransfers({ project: document.project, index: document.index, selected, selectedNodeIds, readOnly: presentationMode, workspaceRef, onPaste: document.pasteNode, onMove: document.moveNodes, onDuplicate: document.duplicateNode, onTransferred: handleNodeTransferred })

  // Ouvre automatiquement le panneau pour un exercice chargé, sans le rouvrir après fermeture manuelle.
  useEffect(() => {
    if (!document.exercise || exerciseRevisionRef.current === document.revision) return
    exerciseRevisionRef.current = document.revision
    setExerciseOpen(true)
  }, [document.exercise, document.revision])

  useEffect(() => {
    simulationEpochRef.current += 1
    functionRunTokenRef.current += 1
    setExecution(null)
    setSimulationResult(null)
    setDebugSession(null)
    setTranspilationResult(null)
    setTranspileExportError(null)
    setFunctionResult(null)
    setFlowRun(null)
  }, [document.project])

  useEffect(() => {
    if (!execution?.running) return undefined
    const startIndex = execution.index
    const startedAt = performance.now()
    let advancedTo = startIndex
    let timer = 0
    // Avance selon le temps écoulé, sans dépendre de la durée réelle d'un rendu.
    function tick() {
      const target = simulationTargetStep(startIndex, performance.now() - startedAt, simulationSpeed, execution.trace.length)
      if (target > advancedTo) {
        advancedTo = target
        setExecution((current) => {
          if (!current || target <= current.index) return current
          return { ...current, index: target, running: target < current.trace.length - 1 }
        })
      }
      timer = window.setTimeout(tick, 50)
    }
    timer = window.setTimeout(tick, 50)
    return () => window.clearTimeout(timer)
  }, [execution?.running, execution?.trace, simulationSpeed])

  // Les images d'écran sont rejouées directement par la carte, sans état React par frame.
  useEffect(() => {
    if (!flowRun?.running) return undefined
    const timer = window.setTimeout(() => {
      setFlowRun((current) => {
        if (!current || !current.running) return current
        if (current.index >= current.session.frames.length - 1) return { ...current, running: false }
        return { ...current, index: current.index + 1 }
      })
    }, 520)
    return () => window.clearTimeout(timer)
  }, [flowRun])

  const debugFrame = debugSession?.project === document.project ? debugSession.frames[debugSession.cursor] : null
  const screenPlayback = Boolean(!debugFrame && simulationResult?.screenFrames?.length && execution && (execution.running || execution.paused || execution.stopped))
  // État visuel courant des écrans : frame de debug prioritaire, sinon état final.
  const debugScreens = useMemo(() => debugSession?.project === document.project ? resolveDebugScreens(debugSession.frames, debugSession.cursor) : null, [debugSession, document.project])
  const screenStates = debugScreens ?? simulationResult?.screens ?? {}
  // Jauges : un état par pas, aligné sur la trace affichée ; la frame de debug reste prioritaire.
  const gaugeStates = debugFrame?.gauges
    ?? (execution ? simulationResult?.gaugeFrames?.[Math.min(execution.index, (simulationResult?.gaugeFrames?.length ?? 1) - 1)] : null)
    ?? simulationResult?.gauges
    ?? {}
  // LED : même suivi par pas que les jauges, avec l'état final en secours.
  const ledStates = debugFrame?.leds
    ?? (execution ? simulationResult?.ledFrames?.[Math.min(execution.index, (simulationResult?.ledFrames?.length ?? 1) - 1)] : null)
    ?? simulationResult?.leds
    ?? {}
  // LED RVB : mêmes états par pas que les jauges et voyants.
  const rgbLedStates = debugFrame?.rgbLeds
    ?? (execution ? simulationResult?.rgbLedFrames?.[Math.min(execution.index, (simulationResult?.rgbLedFrames?.length ?? 1) - 1)] : null)
    ?? simulationResult?.rgbLeds
    ?? {}
  // Barres de progression : même suivi par pas que les jauges et LED.
  const progressStates = debugFrame?.progresses
    ?? (execution ? simulationResult?.progressFrames?.[Math.min(execution.index, (simulationResult?.progressFrames?.length ?? 1) - 1)] : null)
    ?? simulationResult?.progresses
    ?? {}
  // Graphiques à barres : même suivi par pas que les jauges et barres.
  const barChartStates = debugFrame?.barCharts
    ?? (execution ? simulationResult?.barChartFrames?.[Math.min(execution.index, (simulationResult?.barChartFrames?.length ?? 1) - 1)] : null)
    ?? simulationResult?.barCharts
    ?? {}
  const selectedScreen = selected?.kind === 'module' && document.cards.some((card) => card.id === selected.id && card.type === 'screen')
  // Valeurs des variables et paramètres visibles, limitées à l'arrêt de debug courant.
  const debugValues = useMemo(() => debugFrame ? buildDebugValues(document.index, debugFrame) : null, [document.index, debugFrame])
  // Types concrets inférés pour les appels génériques, sans modifier la source.
  const genericCalls = useMemo(() => new Map((document.analysis?.genericCalls ?? []).map((entry) => [entry.nodeId, entry.types ?? [{ name: 'T', type: entry.type }]])), [document.analysis])
  const activeExecutionId = debugSession ? debugFrame?.nodeId ?? null : execution?.trace[execution.index] ?? null
  // Identité de la session d'exécution courante : un nouveau Run ou une nouvelle session de debug réinitialise le repli manuel.
  const executionSession = debugSession?.project === document.project ? debugSession.frames : execution?.trace ?? null
  // Les liens intermodules ne dépendent que de l'analyse, pas du déplacement des cartes.
  const moduleLinks = useMemo(() => getModuleLinks(document.index), [document.index])
  const selectedScreenCard = selectedScreen ? document.cards.find((card) => card.id === selected.id) ?? null : null
  const selectedScreenModule = selectedScreenCard ? document.index.modules.get(selectedScreenCard.id) ?? null : null
  const selectedScreenCallers = selectedScreenCard ? moduleLinks.filter((link) => link.fromId === selectedScreenCard.id) : []
  // Une carte masquée reste dans le document et le fichier ; elle n'est simplement pas montée.
  const visibleCards = useMemo(() => document.cards.filter((card) => !card.hidden), [document.cards])
  // Le zoom sémantique retire d'abord les annotations, puis remplace les instructions par les fonctions.
  const semanticLevel = useMemo(() => semanticZoomLevel(zoom), [zoom])
  const semanticCards = useMemo(() => semanticLevel === 'detail' ? visibleCards : visibleCards.filter((card) => !['comment', 'image'].includes(card.type)), [visibleCards, semanticLevel])
  // Contenu monté seulement pour les cartes proches de la vue, la sélection, la carte active et l'insertion en cours.
  const renderableCards = useMemo(() => {
    const ids = new Set(selectedModuleIds)
    if (activeCardId) ids.add(activeCardId)
    if (growthRequest.moduleId && growthRequest.documentRevision === document.revision) ids.add(growthRequest.moduleId)
    if (canvasSize.width === 0 || canvasSize.height === 0) {
      for (const card of visibleCards) ids.add(card.id)
      return ids
    }
    const margin = 240
    const halfWidth = canvasSize.width / 2
    const halfHeight = canvasSize.height / 2
    for (const card of visibleCards) {
      const left = halfWidth + (card.x - camera.x) * zoom
      const top = halfHeight + (card.y - camera.y) * zoom
      if (left < canvasSize.width + margin && left + card.width * zoom > -margin && top < canvasSize.height + margin && top + card.height * zoom > -margin) ids.add(card.id)
    }
    return ids
  }, [visibleCards, selectedModuleIds, activeCardId, growthRequest, document.revision, canvasSize, camera.x, camera.y, zoom])
  const hiddenCards = useMemo(() => document.cards.filter((card) => card.hidden), [document.cards])
  // La mini-carte ne montre que les modules visibles, comme le cadre de recentrage.
  const minimapModules = useMemo(() => visibleCards.filter((card) => logicalCardTypes.includes(card.type)).map(({ id, x, y, width, height }) => ({ id, x, y, width, height })), [visibleCards])
  // Fonction sélectionnée : seule cible proposée pour « Run/Debug this function ».
  const selectedFunction = useMemo(() => selected?.kind === 'node' && document.index.nodes.get(selected.id)?.kind === 'FunctionDeclaration' ? { id: selected.id } : null, [selected, document.index])
  // Logic Pulse : la carte du module qui vient d'exécuter un pas pulse brièvement.
  const executionStep = debugSession ? debugSession.cursor : execution ? execution.index : null
  const activeModuleId = activeExecutionId ? document.index.nodes.get(activeExecutionId)?.moduleId ?? null : null
  // Déclarations jamais utilisées : indicateur discret dans l'arbre.
  const unusedIds = useMemo(() => new Set(getUnusedDeclarationIds(document.project, document.analysis)), [document.project, document.analysis])
  // Fonctions et modules purs : pastille discrète et seuls favoris enregistrables.
  const pureIds = useMemo(() => getPureIds(document.project, document.analysis), [document.project, document.analysis])
  // Modules visibles proposés comme destination d'insertion d'un favori.
  const moduleChoices = document.cards.filter((card) => moduleCardTypes.includes(card.type)).map((card) => ({ id: card.id, name: card.name }))
  const functionNode = functionTarget ? document.index.nodes.get(functionTarget) ?? null : null
  const functionSignature = functionNode ? (functionNode.children.parameters ?? []).map((id) => `${document.index.nodes.get(id)?.properties?.name}:${JSON.stringify(document.index.nodes.get(id)?.properties?.type)}`).join('|') : ''
  // Les nœuds qui contiennent autre chose ne dépendent que de la source analysée.
  const expandableIds = useMemo(() => expandableNodeIdsByModule(document.index), [document.index])

  // Suit le bloc exécuté pour ouvrir ses propriétés sans réinitialiser la position du panneau.
  useEffect(() => {
    if (!activeExecutionId) return
    setSelection((current) => current.length === 1 && current[0]?.kind === 'node' && current[0].id === activeExecutionId ? current : [{ kind: 'node', id: activeExecutionId }])
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
    clearNotifications()
    setNodeGraph(null)
    setDebugSession(null)
    setExecution(null)
    setSimulationResult(null)
    document.replaceWorkspace(workspace)
    restoreCamera(workspace.presentation.camera)
    setSelection(workspace.presentation.selected ? [workspace.presentation.selected] : [])
    setActiveCardId(workspace.presentation.selected?.kind === 'module' ? workspace.presentation.selected.id : null)
    setGrowthRequest({ moduleId: null, revision: 0 })
    menuTriggerRef.current = null
    setContextMenu(null)
  }

  // Crée un manifeste vide et ouvre le panneau pour l'enseignant.
  function handleCreateExercise() {
    if (!document.exercise) document.setExercise(createExercise({
      title: t('exercise.title'),
      starter: { project: document.project, presentation: { cards: document.cards, camera, selected: selected ? { kind: selected.kind, id: selected.id } : null } },
    }))
    setExerciseOpen(true)
  }

  // Restaure le squelette fourni par l'enseignant et replace la vue comme à la création.
  function handleResetExercise() {
    if (!document.exercise?.starter) return
    document.restoreStarter(document.exercise.starter)
    restoreCamera(document.exercise.starter.presentation.camera)
    setSelection(document.exercise.starter.presentation.selected ? [document.exercise.starter.presentation.selected] : [])
    setExerciseOpen(true)
  }

  // Ouvre le panneau avant de vérifier pour que le résultat soit visible immédiatement.
  function handleCheckExercise() {
    setExerciseOpen(true)
    exerciseState.check()
  }

  // Enregistre une copie corrigée une fois tous les tests réussis.
  function handleSaveSolution() {
    if (!document.exercise) return
    files.saveSolution(document.exercise.title)
  }

  // Retire le manifeste sans toucher au programme ni aux cartes.
  function handleRemoveExercise() {
    document.setExercise(null)
    setExerciseOpen(false)
  }

  // Place la carte touchée au-dessus des autres cartes sans modifier le document source.
  function bringCardToFront(targetId) {
    if (!targetId) return
    const cardId = targetId.kind !== 'node'
      ? targetId.id
      : document.index.nodes.get(targetId.id)?.moduleId
    if (cardId) setActiveCardId(cardId)
  }

  // Sélectionne une cible, ou l'ajoute/la retire avec Ctrl, Cmd ou Maj.
  function handleSelect(targetId, options = {}) {
    if (!targetId) { setSelection([]); return }
    bringCardToFront(targetId)
    setSelection((current) => {
      if (!options.additive) return [targetId]
      const exists = current.some((entry) => entry.kind === targetId.kind && entry.id === targetId.id)
      if (exists) return current.filter((entry) => !(entry.kind === targetId.kind && entry.id === targetId.id))
      return [...current, targetId]
    })
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
    // Le résultat recherché doit être visible même si sa carte montrait son aperçu graphique.
    if (!moduleCardTypes.includes(card.type) && logicalCardTypes.includes(card.type)) {
      document.updateGeometry(moduleId, { [`${card.type}View`]: 'code' })
    }
    handleSelect({ kind: 'node', id: nodeId })
    // Une recherche doit révéler les instructions même si la vue était sémantiquement repliée.
    restoreCamera({ x: card.x + card.width / 2, y: card.y + card.height / 2, zoomLevel: Math.max(camera.zoomLevel, semanticSearchZoomLevel) })
    setRevealTarget({ nodeId, token: crypto.randomUUID() })
  }

  // Ferme la recherche et rend le clavier de navigation au canvas.
  function handleCloseSearch() {
    search.close()
    canvasRef.current?.focus({ preventScroll: true })
  }

  // Bascule le mode présentation : navigation, zoom et exécution restent disponibles.
  function handleTogglePresentation() {
    const next = !presentationMode
    setPresentationMode(next)
    if (!next) return
    if (files.pendingImport) files.handleCancelImport()
    if (files.pendingNew) files.handleCancelNew()
    setContextMenu(null)
    setSettingsOpen(false)
    setBookmarksOpen(false)
    setTranspilationResult(null)
    setTranspileExportError(null)
    menuTriggerRef.current = null
    transfers.reset()
  }

  // Identifie le nœud le plus proche, puis le module ; les annotations restent hors du moteur.
  function handleContextMenu(event) {
    if (presentationMode) { event.preventDefault(); return }
    if (event.target.closest('input, textarea')) return
    event.preventDefault()
    if (event.target.closest('[data-canvas-ui], .canvas-status')) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const node = event.target.closest('[data-source-node]')
    const card = event.target.closest('[data-card-id]')
    const targetId = node ? { kind: 'node', id: node.dataset.sourceNode } : card ? { kind: logicalCardTypes.includes(card.dataset.cardType) ? 'module' : card.dataset.cardType, id: card.dataset.cardId } : null
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
    if (presentationMode) return
    const bounds = canvasRef.current.getBoundingClientRect()
    const button = event.currentTarget.getBoundingClientRect()
    bringCardToFront(targetId)
    menuTriggerRef.current = event.currentTarget
    setContextMenu({ id: crypto.randomUUID(), targetId, x: Math.max(8, button.left - bounds.left), y: Math.max(8, Math.min(button.bottom - bounds.top + 4, bounds.height - 16)), anchored: true })
  }

  // Ouvre le même menu logique depuis la barre d’édition pour la cible sélectionnée.
  function handleOpenSelectionMenu() {
    if (presentationMode) return
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

  // Indique si une cible peut être enregistrée comme favori, et si elle est pure.
  function bookmarkStatus(target) {
    if (!target) return { show: false, can: false }
    if (target.kind === 'module' && document.cards.some((card) => card.id === target.id && !moduleCardTypes.includes(card.type) && logicalCardTypes.includes(card.type))) return { show: false, can: false }
    if (target.kind === 'module') return { show: true, can: pureIds.modules.has(target.id) }
    if (target.kind === 'node' && document.index.nodes.get(target.id)?.kind === 'FunctionDeclaration') return { show: true, can: pureIds.functions.has(target.id) }
    return { show: false, can: false }
  }

  // Enregistre une cible pure dans la bibliothèque personnelle, sans toucher au document.
  function saveBookmarkFor(target) {
    const result = captureBookmark(document.project, target, { analysis: document.analysis, index: document.index })
    if (!result.ok) return result
    const entry = { id: crypto.randomUUID(), savedAt: Date.now(), ...result.bookmark }
    const next = [entry, ...bookmarks.filter((existing) => !(existing.kind === entry.kind && existing.name === entry.name))]
    setBookmarks(next)
    saveBookmarks(next)
    return result
  }

  // Enregistre la sélection pure depuis le volet des favoris.
  function handleSaveBookmark() {
    if (bookmarkStatus(selected).can) saveBookmarkFor(selected)
  }

  // Enregistre une cible pure directement depuis le menu d'un nœud ou d'un module.
  function handleBookmarkTarget(target) {
    if (saveBookmarkFor(target).ok) handleCloseMenu(true)
  }

  // Insère un favori dans un module choisi, ou dans un nouveau module sélectionné et cadré.
  function handleInsertBookmark(bookmarkId, targetModuleId = null) {
    const bookmark = bookmarks.find((entry) => entry.id === bookmarkId)
    if (!bookmark) return
    const existing = Boolean(targetModuleId && document.index.modules.has(targetModuleId))
    const position = existing ? null : nextBookmarkPosition()
    const result = document.insertSavedBookmark(bookmark, { targetModuleId: existing ? targetModuleId : null, position })
    if (!result.ok) return
    const rootId = result.rootNodeIds?.[0] ?? null
    if (existing) {
      if (rootId) setSelection([{ kind: 'node', id: rootId }])
      setActiveCardId(result.moduleId)
    } else {
      setSelection([{ kind: 'module', id: result.moduleId }])
      setActiveCardId(result.moduleId)
      restoreCamera({ x: position.x + moduleTypes.module.width / 2, y: position.y + moduleTypes.module.height / 2, zoomLevel: camera.zoomLevel })
    }
  }

  // Retire un favori de la bibliothèque sans toucher au document courant.
  function handleDeleteBookmark(bookmarkId) {
    const next = bookmarks.filter((entry) => entry.id !== bookmarkId)
    setBookmarks(next)
    saveBookmarks(next)
  }

  // Situe la carte d'un favori à droite des modules existants, ou au centre de la vue.
  function nextBookmarkPosition() {
    const modules = document.cards.filter((card) => moduleCardTypes.includes(card.type))
    if (modules.length === 0) return { x: camera.x - moduleTypes.module.width / 2, y: camera.y - moduleTypes.module.height / 2 }
    const right = Math.max(...modules.map((card) => card.x + card.width))
    const top = Math.min(...modules.map((card) => card.y))
    return { x: right + 80, y: top }
  }

  // Démarre une opération du moteur et prépare son avancement annulable.
  function beginEngineWork(kind) {
    const epoch = ++engineEpochRef.current
    setEngineWork({ kind, current: 0, total: 0, step: '' })
    return epoch
  }

  // Met à jour l'avancement seulement pour l'opération encore courante.
  function updateEngineWork(epoch, progress) {
    if (epoch !== engineEpochRef.current) return
    setEngineWork((current) => current ? { ...current, ...progress } : current)
  }

  // Efface l'avancement d'une opération terminée, sans toucher à une opération plus récente.
  function endEngineWork(epoch) {
    if (epoch === engineEpochRef.current) setEngineWork(null)
  }

  // Annule immédiatement tout calcul du moteur et invalide les résultats en attente.
  function handleCancelEngineWork() {
    const kind = engineWork?.kind
    engineEpochRef.current += 1
    simulationEpochRef.current += 1
    functionRunTokenRef.current += 1
    transpileEpochRef.current += 1
    screenRerunRef.current.inFlight = false
    cancelEngineWork()
    setEngineWork(null)
    if (kind) notify({ type: 'info', message: t('notification.cancelled'), key: kind, duration: 2500 })
    if (['graphical', 'debug'].includes(kind)) {
      setFlowRun(null)
      setDebugSession(null)
    }
  }

  // Lance une simulation locale uniquement sur un programme statiquement valide.
  async function handleRunSimulation() {
    const epoch = ++simulationEpochRef.current
    cancelEngineWork()
    const work = beginEngineWork('simulation')
    notify({ type: 'loading', title: t('simulation.title'), message: t('simulation.running'), key: 'simulation', duration: 0 })
    setFlowRun(null)
    setDebugSession(null)
    setExecutionFree(false)
    try {
      const result = await runSimulation(document.project, {}, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (epoch !== simulationEpochRef.current) return
      notify(result.ok
        ? { type: 'simulation_finished', title: t('simulation.title'), message: t('simulation.completed'), key: 'simulation', duration: 6000 }
        : { type: 'error', title: t('simulation.title'), message: failureLabel({ code: result.errorCode }, t), key: 'simulation', duration: 0 })
      startTransition(() => {
        setSimulationResult(result)
        setExecution(result.ok && result.trace.length > 0 ? { trace: result.trace, index: 0, running: result.trace.length > 1, paused: false, stopped: false } : null)
      })
    } catch (error) {
      if (isEngineCancelled(error) || epoch !== simulationEpochRef.current) return
      notify({ type: 'error', title: t('simulation.title'), message: failureLabel({ code: 'SIMULATION_FAILED' }, t), key: 'simulation', duration: 0 })
      startTransition(() => {
        setSimulationResult({ ok: false, output: [], outputSteps: [], trace: [], errorCode: 'SIMULATION_FAILED', error: error?.message ?? '' })
        setExecution(null)
      })
    } finally {
      endEngineWork(work)
    }
  }

  // Une séquence d'écran sans cycle relance la simulation pour produire de nouvelles images.
  async function handleScreenSequenceEnd() {
    if (!simulationResult || !execution || screenRerunRef.current.inFlight) return
    const now = Date.now()
    if (now - screenRerunRef.current.at < 200) return
    const epoch = simulationEpochRef.current
    screenRerunRef.current = { at: now, inFlight: true }
    try {
      const result = await runSimulation(document.project, { screenOnly: true })
      if (epoch !== simulationEpochRef.current || !result.ok || !result.screenFrames?.length) return
      startTransition(() => {
        setSimulationResult((current) => current ? {
          ...current,
          screens: result.screens,
          gauges: result.gauges,
          leds: result.leds,
          rgbLeds: result.rgbLeds,
          progresses: result.progresses,
          barCharts: result.barCharts,
          screenFrames: result.screenFrames,
          screenFrameGauges: result.screenFrameGauges ?? [],
          screenFrameLeds: result.screenFrameLeds ?? [],
          screenFrameRgbLeds: result.screenFrameRgbLeds ?? [],
          screenFrameProgresses: result.screenFrameProgresses ?? [],
          screenFrameBarCharts: result.screenFrameBarCharts ?? [],
        } : current)
      })
    } catch {
      // Conserve les images précédentes si la relance échoue ou est annulée.
    } finally {
      screenRerunRef.current.inFlight = false
    }
  }

  // Ouvre la simulation graphique simplifiée sur la trace du moteur, sans code mort.
  async function handleRunGraphical() {
    const epoch = ++simulationEpochRef.current
    cancelEngineWork()
    const work = beginEngineWork('graphical')
    notify({ type: 'loading', title: t('simulation.title'), message: t('simulation.running'), key: 'graphical', duration: 0 })
    setExecution(null)
    setSimulationResult(null)
    setDebugSession(null)
    setContextMenu(null)
    try {
      const session = await runDebugSession(document.project, {}, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (epoch !== simulationEpochRef.current) return
      notify(session.errorCode
        ? { type: 'error', title: t('simulation.title'), message: failureLabel({ code: session.errorCode }, t), key: 'graphical', duration: 0 }
        : { type: 'simulation_finished', title: t('simulation.title'), message: t('simulation.completed'), key: 'graphical', duration: 5000 })
      setFlowRun({ session: { ...session, project: document.project }, index: 0, running: session.frames.length > 1, paused: false, stopped: false })
    } catch (error) {
      if (!isEngineCancelled(error) && epoch === simulationEpochRef.current) {
        notify({ type: 'error', title: t('simulation.title'), message: failureLabel({ code: 'SIMULATION_FAILED' }, t), key: 'graphical', duration: 0 })
        setFlowRun(null)
      }
    } finally {
      endEngineWork(work)
    }
  }

  // Met le flux graphique en pause sans perdre l'image courante.
  function handlePauseFlow() {
    setFlowRun((current) => current?.running ? { ...current, running: false, paused: true } : current)
  }

  // Reprend le flux graphique à l'étape suivante.
  function handleResumeFlow() {
    setFlowRun((current) => current?.paused ? { ...current, running: true, paused: false } : current)
  }

  // Arrête l'animation en laissant la dernière image visible.
  function handleStopFlow() {
    setFlowRun((current) => current ? { ...current, running: false, paused: false, stopped: true } : current)
  }

  // Met l'animation en pause sans la terminer : l'index courant est conservé.
  function handlePauseExecution() {
    setExecution((current) => current?.running ? { ...current, running: false, paused: true } : current)
  }

  // Reprend l'animation là où elle s'était arrêtée.
  function handleResumeExecution() {
    setExecution((current) => current?.paused ? { ...current, running: true, paused: false } : current)
  }

  // Détache la sortie de la cadence des pas : elle s'affiche immédiatement, comme avant.
  function handleToggleExecutionFree() {
    setExecutionFree((current) => !current)
  }

  // Applique une vitesse d'animation bornée, y compris pendant une exécution en cours.
  function handleSimulationSpeedChange(value) {
    setSimulationSpeed(clampSimulationSpeed(value))
  }

  // Interrompt une simulation en cours d'animation sans effacer sa sortie déjà produite.
  function handleStopExecution() {
    setExecution((current) => current ? { ...current, running: false, paused: false, stopped: true } : current)
  }

  // Bascule le plein écran et mémorise l'état réellement appliqué.
  async function handleToggleFullScreen() {
    setFullScreen(Boolean(await toggleFullScreen()))
  }

  // Prépare les arrêts réversibles après l'analyse d'accessibilité, sans changer le workspace.
  async function handleDebugSp3() {
    const epoch = ++simulationEpochRef.current
    cancelEngineWork()
    const work = beginEngineWork('debug')
    notify({ type: 'loading', title: t('debug.title'), message: t('nav.working'), key: 'debug', duration: 0 })
    setExecution(null)
    setSimulationResult(null)
    setFlowRun(null)
    setContextMenu(null)
    try {
      const session = await runDebugSession(document.project, { breakpoints }, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (epoch !== simulationEpochRef.current) return
      notify(session.errorCode
        ? { type: 'error', title: t('debug.title'), message: failureLabel({ code: session.errorCode }, t), key: 'debug', duration: 0 }
        : { type: 'debug_paused', title: t('debug.title'), message: t('debug.paused'), key: 'debug', duration: 9000 })
      setDebugSession({ ...session, project: document.project, breakpoints })
    } catch (error) {
      if (!isEngineCancelled(error) && epoch === simulationEpochRef.current) {
        notify({ type: 'error', title: t('debug.title'), message: failureLabel({ code: 'SIMULATION_FAILED' }, t), key: 'debug', duration: 0 })
        setDebugSession(null)
      }
    } finally {
      endEngineWork(work)
    }
  }

  // Analyse et génère le code dans le worker, avec avancement et annulation.
  async function handleTranspile(target) {
    setTranspileExportError(null)
    const epoch = ++transpileEpochRef.current
    cancelEngineWork()
    const work = beginEngineWork('transpile')
    const targetName = transpilationLanguages.find((option) => option.id === target)?.name ?? target
    notify({ type: 'loading', title: t('transpile.button'), message: t('nav.working'), key: 'transpile', duration: 0 })
    try {
      const result = await runTranspilation(document.project, { target }, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (epoch === transpileEpochRef.current) {
        notify(result.ok
          ? { type: 'success', title: t('transpile.title', { language: targetName }), message: t('transpile.success'), key: 'transpile', duration: 4500 }
          : { type: 'transpile_failed', title: t('transpile.title', { language: targetName }), message: t('transpile.failed'), key: 'transpile', duration: 0 })
        setTranspilationResult(result)
      }
    } catch (error) {
      if (isEngineCancelled(error) || epoch !== transpileEpochRef.current) return
      notify({ type: 'transpile_failed', title: t('transpile.button'), message: failureLabel({ code: error?.code ?? 'TRANSPILE_FAILED' }, t), key: 'transpile', duration: 0 })
      setTranspilationResult({ ok: false, target, code: '', diagnostics: [] })
    } finally {
      endEngineWork(work)
    }
  }

  // Indique, pour chaque cible installée, si le projet courant est réellement transpilable.
  async function getTranspileChecks() {
    try {
      return await runTranspilationChecks(document.project, transpilationLanguages.filter((entry) => entry.available).map((entry) => entry.id))
    } catch (error) {
      if (isEngineCancelled(error)) return {}
      throw error
    }
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
      const path = await exportWorkspaceFile(target.extension, transpilationResult.code, language)
      if (path) notify({ type: 'export_success', message: t('files.exported'), duration: 4500 })
    } catch (failure) {
      notify({ type: 'error', message: `${t('errors.couldNotSave')} ${failureLabel(failure, t)}`, duration: 0 })
      setTranspileExportError(failure)
    }
  }

  // Exporte tout le workspace déplié en une vue d'ensemble SVG, à partir de la présentation courante.
  async function handleExportSvg() {
    const cards = document.cards.map((card) => card.type === 'image' && card.imageRef
      ? { ...card, image: files.imageSourceFor(card) || card.image }
      : card)
    const svg = buildWorkspaceSvg({
      cards,
      index: document.index,
      links: moduleLinks,
      colors: svgPalette(),
      describe: (node) => nodeLine(node, document.index, t),
    })
    await files.exportText('svg', svg)
  }

  // Exporte le sous-arbre du nœud sélectionné en JSON, sans exigence de pureté.
  async function handleExportNodeJson(nodeId) {
    const captured = captureSourceNode(document.project, nodeId, { index: document.index })
    if (!captured.ok) return
    await files.exportText('json', JSON.stringify({ application: 'Sapphire 3', node: captured.clipboard }, null, 2))
  }

  // Rasterise l'image focalisée du nœud et l'enregistre en PNG.
  async function handleExportNodeImage(image) {
    try {
      const bytes = await rasterizeSvg(image.svg, image.width, image.height)
      await files.exportBinary('png', bytes)
    } catch {
      // L'échec de rasterisation laisse le document intact ; une erreur de fichier est signalée par le service.
    }
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

  // Prépare le panneau d'exécution d'une fonction choisie, avec ses entrées.
  function handleOpenFunction(functionId) {
    functionRunTokenRef.current += 1
    setFunctionTarget(functionId)
    setFunctionResult(null)
  }

  // Exécute la fonction choisie avec les entrées validées par le moteur.
  async function handleRunFunction(args) {
    if (!functionTarget) return
    const token = ++functionRunTokenRef.current
    const epoch = simulationEpochRef.current
    const functionId = functionTarget
    cancelEngineWork()
    const work = beginEngineWork('function')
    setFlowRun(null)
    try {
      const result = await runSimulation(document.project, { functionId, args }, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (token !== functionRunTokenRef.current || epoch !== simulationEpochRef.current) return
      startTransition(() => setFunctionResult({ functionId, result }))
    } catch (error) {
      if (isEngineCancelled(error) || token !== functionRunTokenRef.current || epoch !== simulationEpochRef.current) return
      startTransition(() => setFunctionResult({ functionId, result: { ok: false, output: [], outputSteps: [], trace: [], errorCode: 'SIMULATION_FAILED', error: error?.message ?? '' } }))
    } finally {
      endEngineWork(work)
    }
  }

  // Ouvre une session de debug sur la fonction choisie, sans modifier la source.
  async function handleDebugFunction(args) {
    if (!functionTarget) return
    const token = ++functionRunTokenRef.current
    const epoch = ++simulationEpochRef.current
    const functionId = functionTarget
    cancelEngineWork()
    const work = beginEngineWork('debug')
    setExecution(null)
    setSimulationResult(null)
    setFlowRun(null)
    setContextMenu(null)
    setFunctionResult(null)
    try {
      const session = await runDebugSession(document.project, { functionId, args, breakpoints }, { onProgress: (progress) => updateEngineWork(work, progress) })
      if (token !== functionRunTokenRef.current || epoch !== simulationEpochRef.current) return
      setDebugSession({ ...session, project: document.project, breakpoints })
    } catch (error) {
      if (!isEngineCancelled(error) && token === functionRunTokenRef.current && epoch === simulationEpochRef.current) setDebugSession(null)
    } finally {
      endEngineWork(work)
    }
  }

  // Ferme le panneau d'exécution de fonction.
  function handleCloseFunction() {
    functionRunTokenRef.current += 1
    setFunctionTarget(null)
    setFunctionResult(null)
  }

  // Ne change que le curseur de lecture et l'instantané mémoire exposé au débogueur.
  function handleDebugAction(action) {
    const next = moveDebugSession(debugSession, action, { breakpoints })
    const nodeId = next?.frames[next.cursor]?.nodeId
    const moduleId = document.index.nodes.get(nodeId)?.moduleId
    const status = next?.frames[next.cursor]?.status
    const previousStatus = debugSession?.frames[debugSession.cursor]?.status
    if (status !== previousStatus && status === 'completed') notify({ type: 'simulation_finished', title: t('debug.title'), message: t('debug.completed'), key: 'debug', duration: 5000 })
    if (status !== previousStatus && status === 'error') notify({ type: 'error', title: t('debug.title'), message: failureLabel({ code: next?.frames[next.cursor]?.errorCode }, t), key: 'debug', duration: 0 })
    if (moduleId) setActiveCardId(moduleId)
    setDebugSession(next)
  }

  // Ajoute ou retire un point d'arrêt sur un nœud, sans toucher à la source logique.
  function handleToggleBreakpoint(nodeId) {
    setBreakpoints((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  // Répartit les modules visibles en couches selon leurs dépendances, sans toucher au programme.
  function handleArrangeModules() {
    const modules = document.cards.filter((card) => moduleCardTypes.includes(card.type) && !card.hidden)
    if (modules.length === 0) return
    const positions = layoutModules(modules, moduleLinks)
    const locked = new Set(modules.filter((module) => module.locked).map((module) => module.id))
    const movable = Object.fromEntries(Object.entries(positions).filter(([id]) => !locked.has(id)))
    if (Object.keys(movable).length > 0) document.arrangeModules(movable)
  }

  // Calcule le rectangle global des modules visibles, sans inclure les annotations ni les cartes masquées.
  function getModulesBounds() {
    const modules = document.cards.filter((card) => logicalCardTypes.includes(card.type) && !card.hidden)
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
      setSelection([{ kind: 'node', id: result.nodeId }])
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
    setSelection((result.movedNodeIds ?? [result.nodeId]).map((id) => ({ kind: 'node', id })))
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
      setSelection(result.selection ? [result.selection] : [])
      setContextMenu(null)
    }
    return result
  }

  // Ferme la sélection et le menu après le retrait confirmé d'un module.
  function handleDeleteModule(moduleId) {
    const result = document.deleteModule(moduleId)
    if (result.ok) {
      setSelection([])
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
    notify({ type: 'info', message: t('notification.cardHidden', { name: card.name }), duration: 3500 })
    if (selectedTargets.some((target) => target.id === card.id || document.index.nodes.get(target.id)?.moduleId === card.id)) setSelection([])
    if (activeCardId === card.id) setActiveCardId(null)
    menuTriggerRef.current = null
    handleCloseMenu(true)
  }

  // Remet une carte masquée à la position conservée dans le document.
  function handleShowCard(cardId) {
    document.setCardHidden(cardId, false)
    const card = document.cards.find((entry) => entry.id === cardId)
    notify({ type: 'hidden_cards_restored', message: t('notification.cardRestored', { name: card?.name ?? '' }), duration: 4000 })
  }

  // Bascule le verrou d'une carte : déplacement et redimensionnement bloqués, source intacte.
  function handleToggleLock(cardId) {
    const card = document.cards.find((entry) => entry.id === cardId)
    if (!card) return
    const locked = !card.locked
    document.setCardLocked(card.id, locked)
    notify({ type: 'locked_card', message: t(locked ? 'notification.cardLocked' : 'notification.cardUnlocked', { name: card.name }), duration: 4000 })
  }

  // Évite de rerendre le canvas lorsqu'aucun guide d'alignement ne change.
  function updateAlignmentGuides(next) {
    setAlignmentGuides((current) => current.vertical.join('|') === next.vertical.join('|') && current.horizontal.join('|') === next.horizontal.join('|') ? current : next)
  }

  // Mémorise les positions initiales des modules sélectionnés pour un déplacement groupé.
  function handleModuleMoveStart(moduleId) {
    const ids = selectedModuleIds.includes(moduleId) ? selectedModuleIds : [moduleId]
    const origins = new Map()
    for (const id of ids) {
      const card = document.cards.find((entry) => entry.id === id)
      if (card && !card.locked) origins.set(id, { x: card.x, y: card.y, width: card.width, height: card.height })
    }
    groupMoveRef.current = origins.size > 0 ? { id: moduleId, origins } : null
    updateAlignmentGuides({ vertical: [], horizontal: [] })
  }

  // Applique le même delta aux cartes sélectionnées et aimante leur cadre aux modules voisins.
  function handleModuleMove(moduleId, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const groupOrigins = groupMoveRef.current?.id === moduleId ? groupMoveRef.current.origins : null
    const group = groupOrigins
      ? groupOrigins
      : new Map((selectedModuleIds.includes(moduleId) ? selectedModuleIds : [moduleId]).map((id) => {
        const card = document.cards.find((entry) => entry.id === id)
        return card && !card.locked ? [id, { x: card.x, y: card.y, width: card.width, height: card.height }] : null
      }).filter(Boolean))
    const origin = group.get(moduleId)
    if (!origin) return
    let dx = x - origin.x
    let dy = y - origin.y
    let guides = { vertical: [], horizontal: [] }
    if (groupOrigins && magnetEnabled) {
      const rects = [...group.values()].map((start) => ({ x: start.x + dx, y: start.y + dy, width: start.width, height: start.height }))
      const left = Math.min(...rects.map((rect) => rect.x))
      const top = Math.min(...rects.map((rect) => rect.y))
      const right = Math.max(...rects.map((rect) => rect.x + rect.width))
      const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
      const moving = { x: left, y: top, width: right - left, height: bottom - top }
      const candidates = visibleCards.filter((card) => logicalCardTypes.includes(card.type) && !group.has(card.id))
      const snapped = snapModuleRect(moving, candidates, moduleSnapPixels / zoom)
      dx += snapped.x - moving.x
      dy += snapped.y - moving.y
      guides = snapped.guides
    }
    for (const [id, start] of group) document.updateGeometry(id, { x: start.x + dx, y: start.y + dy })
    updateAlignmentGuides(guides)
  }

  // Termine le geste groupé ; le prochain clic repart des positions courantes.
  function handleModuleMoveEnd() {
    groupMoveRef.current = null
    updateAlignmentGuides({ vertical: [], horizontal: [] })
  }

  // Duplique toutes les cibles sélectionnées et sélectionne l'ensemble des copies.
  function handleDuplicateSelection() {
    const result = document.duplicateSelection(selectedTargets)
    if (!result.ok) return result
    const firstModule = result.duplicatedModules?.[0]
    const firstNode = result.duplicatedNodeIds?.[0]
    const copies = [
      ...(result.duplicatedModules ?? []).map((entry) => ({ kind: 'module', id: entry.moduleId })),
      ...(result.duplicatedNodeIds ?? []).map((id) => ({ kind: 'node', id })),
    ]
    setSelection(copies)
    if (firstModule) {
      setActiveCardId(firstModule.moduleId)
    } else if (firstNode) {
      setActiveCardId(result.index.nodes.get(firstNode)?.moduleId ?? null)
    } else {
      setSelection([])
    }
    return result
  }

  // Supprime toutes les cibles sélectionnées après confirmation de la barre groupée.
  function handleDeleteSelection() {
    const result = document.deleteSelection(selectedTargets)
    if (result.ok) setSelection([])
    return result
  }

  // Indique si la carte visée est verrouillée.
  function isCardLocked(cardId) {
    return Boolean(cardId && document.cards.find((entry) => entry.id === cardId)?.locked)
  }

  // Rouvre d'un coup toutes les cartes rangées hors du canvas.
  function handleShowAllHidden() {
    if (hiddenCards.length === 0) return
    for (const card of hiddenCards) document.setCardHidden(card.id, false)
    notify({ type: 'hidden_cards_restored', message: t('notification.cardsRestored', { count: hiddenCards.length }), duration: 4000 })
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

  // Branche le registre central sur les handlers existants, sans dupliquer leur logique métier.
  useGlobalKeybinds({
    'workspace.new': { available: () => !presentationMode && !files.busy && !files.pendingImport && !files.pendingNew, run: files.handleNew },
    'workspace.open': { available: () => !presentationMode && !files.busy && !files.pendingImport, run: files.handleOpenWorkspace },
    'workspace.save': { available: () => !files.busy && !files.pendingImport, run: files.handleSave },
    'edit.undo': { available: () => !presentationMode && document.canUndo, run: document.undo },
    'edit.redo': { available: () => !presentationMode && document.canRedo, run: document.redo },
    'edit.copyNode': { available: () => !presentationMode && selected?.kind === 'node' && !window.getSelection()?.toString(), run: () => transfers.copyNode(selected) },
    'edit.pasteNode': { available: () => !presentationMode && Boolean(selected && transfers.hasClipboard), run: () => transfers.pasteNode(selected) },
    'edit.search': { available: () => true, run: search.show },
    'navigation.center': { available: () => true, run: () => handleRecenter(getModulesBounds()) },
    'navigation.zoom100': { available: () => true, run: resetZoom },
    'navigation.toggleMinimap': { available: () => true, run: () => setMinimapVisible((current) => !current) },
    'execution.run': { available: () => true, run: handleRunSimulation },
    'execution.stop': { available: () => true, run: handleStopExecution },
    'execution.debug': { available: () => true, run: handleDebugSp3 },
  })

  const enginePercent = engineWork && engineWork.total > 0 ? Math.max(0, Math.min(100, Math.round((engineWork.current / engineWork.total) * 100))) : null
  const engineLabel = engineWork ? t(`engine.${engineWork.kind}`) : ''

  return (
    <div ref={workspaceRef} className={`canvas-workspace${navCollapsed ? ' canvas-workspace--nav-collapsed' : ''}`}>
    <a className="canvas-skip-link" href="#canvas-main">{t('nav.skipToCanvas')}</a>
    <ProjectNavigation busy={files.busy} pendingImport={files.pendingImport} pendingNew={files.pendingNew} recentWorkspaces={files.recentWorkspaces} onSave={files.handleSave} onSaveWorkspaceAs={files.saveWorkspaceAs} onExportArchive={files.exportWorkspaceArchive} onExportSvg={handleExportSvg} onOpenWorkspace={files.handleOpenWorkspace} onOpenRecent={files.handleOpenRecent} onImport={files.handleImport} onOpenExample={files.handleOpenExample} onConfirmImport={files.handleConfirmImport} onCancelImport={files.handleCancelImport} onNew={files.handleNew} onConfirmNew={files.handleConfirmNew} onCancelNew={files.handleCancelNew}
      canUndo={document.canUndo} canRedo={document.canRedo} onUndo={document.undo} onRedo={document.redo}
      onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onZoom100={resetZoom} onCenter={() => handleRecenter(getModulesBounds())}
      distorted={distorted} onToggleDistortion={() => setDistorted((current) => !current)}
      minimapVisible={minimapVisible} onToggleMinimap={() => setMinimapVisible((current) => !current)}
      magnetEnabled={magnetEnabled} onToggleMagnet={() => setMagnetEnabled((current) => !current)}
      fullScreen={fullScreen} onToggleFullScreen={handleToggleFullScreen} gridVisible={gridVisible} onToggleGrid={() => setGridVisible((current) => !current)} hudVisible={hudVisible} onToggleHud={() => setHudVisible((current) => !current)} onArrangeModules={handleArrangeModules}
      hiddenCards={hiddenCards} onShowCard={handleShowCard} onShowAllHidden={handleShowAllHidden}
      presentation={presentationMode} onTogglePresentation={handleTogglePresentation}
      hasSelection={Boolean(selected && selected.kind !== 'comment')} onOpenSelectionMenu={handleOpenSelectionMenu} onOpenSearch={search.show} onRunSimulation={handleRunSimulation} onRunGraphical={handleRunGraphical} onDebugSp3={handleDebugSp3} onTranspile={handleTranspile} selectedFunction={selectedFunction} onOpenFunction={handleOpenFunction} simulationRunning={Boolean(execution?.running)} simulationPaused={Boolean(execution?.paused)} onPauseSimulation={handlePauseExecution} onResumeSimulation={handleResumeExecution} onStopSimulation={handleStopExecution} onOpenRepository={() => openExternal(repositoryUrl)} onOpenSettings={() => setSettingsOpen(true)} onQuit={() => quitApplication()} updateAvailable={appUpdate.update.status === 'available'} updateVersion={appUpdate.update.release?.version ?? ''} updateManual={appUpdate.update.release?.installMode === 'manual'} onInstallUpdate={() => appUpdate.install({ title: t('update.confirmTitle'), body: t('update.confirmBody', { version: appUpdate.update.release?.version ?? '' }) })} onCheckTranspile={getTranspileChecks}
      bookmarks={bookmarks} modules={moduleChoices} canBookmark={bookmarkStatus(selected).can} onSaveBookmark={handleSaveBookmark} onInsertBookmark={handleInsertBookmark} onDeleteBookmark={handleDeleteBookmark} onOpenBookmarks={() => setBookmarksOpen(true)} exercise={document.exercise} onOpenExercise={() => setExerciseOpen(true)} onCreateExercise={handleCreateExercise} onCheckExercise={handleCheckExercise} />
    <button type="button" className="canvas-nav-toggle" aria-expanded={!navCollapsed} aria-label={t(navCollapsed ? 'nav.show' : 'nav.hide')} title={t(navCollapsed ? 'nav.show' : 'nav.hide')} onClick={() => setNavCollapsed((current) => !current)}>{navCollapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}</button>
    <main ref={canvasRef} id="canvas-main" className={`canvas${isPanning ? ' canvas--panning' : ''}`} aria-label={t('canvas.aria')} tabIndex={0}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu}
      onDragStart={transfers.handleDragStart} onDragOver={transfers.handleDragOver} onDrop={transfers.handleDrop} onDragEnd={transfers.handleDragEnd}>
      <h1 className="visually-hidden">{t('app.title')}</h1>
      <CanvasGrid camera={camera} zoom={zoom} distorted={distorted} gridVisible={gridVisible} />
      {hudVisible && <CanvasHud camera={camera} zoom={zoom} semanticLevel={semanticLevel} moduleCount={document.index.modules.size} nodeCount={document.index.nodes.size} gridVisible={gridVisible} magnetEnabled={magnetEnabled} />}
      <CanvasLinks cards={visibleCards} links={moduleLinks} camera={camera} zoom={zoom} />
      {semanticCards.map((card) => <CanvasModule key={`${document.revision}:${card.id}`} module={card} camera={camera} zoom={zoom}
        semanticLevel={semanticLevel}
        imageSource={files.imageSourceFor(card)}
        onImageFile={files.handleImageFile}
        functionsView={semanticLevel === 'functions' && document.index.modules.has(card.id) ? <ModuleFunctions module={document.index.modules.get(card.id)} index={document.index} pureIds={pureIds.functions} selectedIds={selectedIds} onSelect={handleSelect} /> : null}
        dropState={transfers.dropTarget?.kind === 'module' && transfers.dropTarget.id === card.id ? transfers.dropTarget.ok ? 'valid' : 'invalid' : undefined}
        zIndex={activeCardId === card.id ? 2 : 1}
        onActivate={() => bringCardToFront({ kind: card.type, id: card.id })}
        fitRequest={growthRequest.documentRevision === document.revision && growthRequest.moduleId === card.id ? growthRequest.revision : 0}
        deferContent={!renderableCards.has(card.id)}
        onOpenActions={(event) => handleOpenActions(event, { kind: logicalCardTypes.includes(card.type) ? 'module' : card.type, id: card.id })}
        selected={selectedIds.has(card.id)}
        onSelect={(event) => handleSelect(logicalCardTypes.includes(card.type) ? { kind: 'module', id: card.id } : null, { additive: event.ctrlKey || event.metaKey || event.shiftKey })}
        onResize={(id, width, height) => document.updateGeometry(id, { width, height })}
        onMove={handleModuleMove} onMoveStart={handleModuleMoveStart} onMoveEnd={handleModuleMoveEnd}
        onScreenViewChange={(id, screenView) => document.updateGeometry(id, { screenView })}
        onScreenSequenceEnd={handleScreenSequenceEnd}
        onGaugeViewChange={(id, gaugeView) => document.updateGeometry(id, { gaugeView })}
        onProgressViewChange={(id, progressView) => document.updateGeometry(id, { progressView })}
        onBarChartViewChange={(id, barChartView) => document.updateGeometry(id, { barChartView })}
        onHeatmapViewChange={(id, heatmapView) => document.updateGeometry(id, { heatmapView })}
        heatmapDimensions={document.index.modules.get(card.id)?.heatmap}
        heatmapState={debugFrame?.heatmaps?.[card.id] ?? (execution ? simulationResult?.heatmapFrames?.[Math.min(execution.index, (simulationResult?.heatmapFrames?.length ?? 1) - 1)]?.[card.id] : null) ?? simulationResult?.heatmaps?.[card.id] ?? null}
        onLedViewChange={(id, ledView) => document.updateGeometry(id, { ledView })}
        onRgbLedViewChange={(id, rgbLedView) => document.updateGeometry(id, { rgbLedView })}
        screenState={screenPlayback ? null : screenStates[card.id] ?? null}
        screenFrames={screenPlayback ? simulationResult.screenFrames : null}
        screenPlaying={screenPlayback && Boolean(execution?.running)}
        gaugeState={gaugeStates[card.id] ?? null}
        gaugeFrames={screenPlayback ? simulationResult.screenFrameGauges ?? null : null}
        gaugePlaying={screenPlayback && Boolean(execution?.running)}
        progressState={progressStates[card.id] ?? null}
        progressFrames={screenPlayback ? simulationResult.screenFrameProgresses ?? null : null}
        progressPlaying={screenPlayback && Boolean(execution?.running)}
        barChartState={barChartStates[card.id] ?? null}
        barChartFrames={screenPlayback ? simulationResult.screenFrameBarCharts ?? null : null}
        barChartPlaying={screenPlayback && Boolean(execution?.running)}
        ledState={ledStates[card.id] ?? null}
        ledFrames={screenPlayback ? simulationResult.screenFrameLeds ?? null : null}
        ledPlaying={screenPlayback && Boolean(execution?.running)}
        rgbLedState={rgbLedStates[card.id] ?? null}
        rgbLedFrames={screenPlayback ? simulationResult.screenFrameRgbLeds ?? null : null}
        rgbLedPlaying={screenPlayback && Boolean(execution?.running)}
        readOnly={presentationMode}
        onRename={document.renameCard} onTextChange={document.updateComment} onImageChange={document.updateImage} onEmojiChange={document.setCardEmoji}
        onToggleLock={handleToggleLock}
        pure={moduleCardTypes.includes(card.type) && pureIds.modules.has(card.id)}
        pulse={activeModuleId === card.id && executionStep !== null ? executionStep + 1 : null}
        expansionState={(moduleCardTypes.includes(card.type) || card.type === 'screen') && document.index.modules.has(card.id) ? getExpansionState(card.id) : null} onToggleExpansion={(id) => handleExpansion(id, getExpansionState(id) !== 'collapse')}>
        {semanticLevel === 'detail' && document.index.modules.has(card.id) && <LogicTree module={document.index.modules.get(card.id)} index={document.index} selectedId={selected?.kind === 'node' ? selected.id : null} selectedIds={selectedIds} readOnly={presentationMode} activeExecutionId={activeExecutionId} executionExpandedNodeIds={getExecutionExpandedNodeIds(card.id)} executionSession={executionSession} onSelect={handleSelect} expandedNodeIds={card.expandedNodeIds} onExpandedChange={(ids) => document.setExpandedNodes(card.id, ids)} onOpenActions={handleOpenActions} onReorder={(id, offset) => document.reorderNode(id, offset)} unusedIds={unusedIds} pureIds={pureIds.functions} breakpoints={breakpoints} onToggleBreakpoint={handleToggleBreakpoint} debugValues={debugValues} genericCalls={genericCalls} dropTarget={transfers.dropTarget} />}
      </CanvasModule>)}
      {alignmentGuides.vertical.map((guide) => <div key={`vertical:${guide}`} className="canvas-alignment-guide canvas-alignment-guide--vertical" style={{ left: `calc(50% + ${(guide - camera.x) * zoom}px)` }} aria-hidden="true" />)}
      {alignmentGuides.horizontal.map((guide) => <div key={`horizontal:${guide}`} className="canvas-alignment-guide canvas-alignment-guide--horizontal" style={{ top: `calc(50% + ${(guide - camera.y) * zoom}px)` }} aria-hidden="true" />)}
      <CanvasStatus camera={camera} zoom={zoom} semanticLevel={semanticLevel} hiddenCount={hiddenCards.length} onShowAllHidden={handleShowAllHidden} onRecenter={() => handleRecenter(getModulesBounds())} />
      {engineWork && <div className="canvas-engine-status" data-canvas-ui role="status" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <div className="canvas-engine-status__body">
          <span>{engineLabel}{enginePercent !== null ? ` · ${enginePercent} %` : ''}</span>
          {enginePercent !== null
            ? <progress max={100} value={enginePercent} aria-label={engineLabel} />
            : <span className="canvas-engine-status__pulse" aria-hidden="true" />}
        </div>
        <button type="button" onClick={handleCancelEngineWork}>{t('engine.cancel')}</button>
      </div>}
      {selectedTargets.length > 1 && !hasScreenSelection && !presentationMode && <SelectionToolbar key={selectedTargets.map((target) => `${target.kind}:${target.id}`).join('|')} count={selectedTargets.length} onDuplicate={handleDuplicateSelection} onDelete={handleDeleteSelection} onClear={() => setSelection([])} />}
      {minimapVisible && <Minimap modules={minimapModules} camera={camera} zoom={zoom} canvasRef={canvasRef} onNavigate={panTo} />}
      <MascotNotification hasMinimap={minimapVisible && minimapModules.length > 0} />
      {transfers.notice && <div className={`canvas-transfer-status${transfers.notice.error ? ' canvas-transfer-status--error' : ''}`} data-canvas-ui role={transfers.notice.error ? 'alert' : 'status'} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <span>{transfers.notice.error ? diagnosticLabel(transfers.notice.error, t) : t(transfers.notice.message)}{transfers.notice.detail && ` · ${diagnosticLabel(transfers.notice.detail, t)}`}</span>
        <button type="button" aria-label={t('nav.dismiss')} onClick={transfers.dismiss}><X size={14} aria-hidden="true" /></button>
      </div>}
      <SimulationPanel result={simulationResult} running={Boolean(execution?.running)} paused={Boolean(execution?.paused)} stopped={Boolean(execution?.stopped)} currentStep={execution ? execution.index + 1 : 0} free={executionFree} speed={simulationSpeed} onSpeedChange={handleSimulationSpeedChange} onToggleFree={handleToggleExecutionFree} onPause={handlePauseExecution} onResume={handleResumeExecution} onStop={handleStopExecution} onClose={() => { setSimulationResult(null); setExecution(null); setExecutionFree(false) }} />
      {exerciseOpen && document.exercise && <ExercisePanel exercise={document.exercise} onChange={document.setExercise} index={document.index} state={exerciseState} onReset={document.exercise.starter ? handleResetExercise : undefined} onSaveSolution={handleSaveSolution} onRemove={handleRemoveExercise} readOnly={presentationMode} onClose={() => setExerciseOpen(false)} />}
      {functionNode && <FunctionPanel key={`${functionTarget}:${functionSignature}`} index={document.index} functionNode={functionNode} result={functionResult?.functionId === functionTarget ? functionResult.result : null} onRun={handleRunFunction} onDebug={handleDebugFunction} onClose={handleCloseFunction} />}
      {debugSession?.project === document.project && <DebugPanel session={debugSession} index={document.index} onAction={handleDebugAction} onClose={() => setDebugSession(null)} memoryOpen={memoryOpen} onToggleMemory={() => { setMemoryOpen((current) => !current); setPointerGraphOpen(false) }} pointerGraphOpen={pointerGraphOpen} onTogglePointerGraph={() => { setPointerGraphOpen((current) => !current); setMemoryOpen(false) }} />}
      {debugSession?.project === document.project && memoryOpen && <MemoryPanel index={document.index} frame={debugFrame} reachability={debugSession.reachability} onClose={() => setMemoryOpen(false)} />}
      {debugSession?.project === document.project && pointerGraphOpen && <PointerGraphPanel index={document.index} frame={debugFrame} onClose={() => setPointerGraphOpen(false)} />}
      {flowRun && <FlowPanel session={flowRun.session} contextIndex={document.index} step={flowRun.index} running={flowRun.running} paused={flowRun.paused} stopped={flowRun.stopped} onPause={handlePauseFlow} onResume={handleResumeFlow} onStop={handleStopFlow} onClose={() => setFlowRun(null)} />}
      <TranspilePanel result={transpilationResult} exportError={transpileExportError} onExport={handleExportTranspilation} onClose={() => { setTranspilationResult(null); setTranspileExportError(null) }} />
      {search.open && <NodeSearchPanel index={document.index} cards={visibleCards} selectedId={selected?.kind === 'node' ? selected.id : null} focusToken={search.token} onReveal={handleRevealNode} onClose={handleCloseSearch} />}
      {!presentationMode && bookmarksOpen && <BookmarkPanel bookmarks={bookmarks} modules={moduleChoices} onInsertBookmark={handleInsertBookmark} onDeleteBookmark={handleDeleteBookmark} onClose={() => setBookmarksOpen(false)} />}
      {!presentationMode && settingsOpen && <SettingsWindow
        onClose={() => setSettingsOpen(false)}
        busy={files.busy} pendingImport={files.pendingImport}
        onNew={files.handleNew} onOpenWorkspace={files.handleOpenWorkspace} onSave={files.handleSave} onSaveWorkspaceAs={files.saveWorkspaceAs} onExportArchive={files.exportWorkspaceArchive} onImport={files.handleImport} onExportSvg={handleExportSvg}
        recentWorkspaces={files.recentWorkspaces} onOpenRecent={files.handleOpenRecent}
        project={document.project} currentFolder={files.currentFolder} diagnostics={document.analysis?.diagnostics ?? []} referenceCount={document.analysis?.semantic?.references?.length ?? 0} unusedCount={unusedIds.size}
        distorted={distorted} onToggleDistortion={() => setDistorted((current) => !current)} minimapVisible={minimapVisible} onToggleMinimap={() => setMinimapVisible((current) => !current)} magnetEnabled={magnetEnabled} onToggleMagnet={() => setMagnetEnabled((current) => !current)} navVisible={!navCollapsed} onToggleNav={() => setNavCollapsed((current) => !current)} hiddenCards={hiddenCards} onShowAllHidden={handleShowAllHidden} onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(0.8)} onZoom100={resetZoom} onCenter={() => handleRecenter(getModulesBounds())}
        bookmarks={bookmarks} canBookmark={bookmarkStatus(selected).can} onSaveBookmark={handleSaveBookmark} onOpenBookmarks={() => setBookmarksOpen(true)} onInsertBookmark={handleInsertBookmark} onDeleteBookmark={handleDeleteBookmark}
        onOpenRepository={() => openExternal(repositoryUrl)} update={appUpdate.update} onCheckUpdate={() => appUpdate.check()} onInstallUpdate={() => appUpdate.install({ title: t('update.confirmTitle'), body: t('update.confirmBody', { version: appUpdate.update.release?.version ?? '' }) })} onQuit={() => quitApplication()} />}
      {nodeGraph && <NodeGraphPanel project={document.project} index={document.index} target={nodeGraph.target} mode={nodeGraph.mode} onSelect={handleSelect} onClose={() => setNodeGraph(null)} />}
      {!presentationMode && selected && !selectedScreen && <NodeProperties key={document.revision} selected={selected} project={document.project} index={document.index} onConfigure={document.configureNode} onRename={document.renameCard} onPreviewSymbolRename={document.previewSymbolRename} onApplySymbolRename={document.applySymbolRename} onSelect={handleSelect} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onExport={document.exportFunction} onImport={document.importFunction} onRemoveImport={document.removeImport} onContracts={document.setNodeContracts} onClose={() => setSelection([])} onExportImage={handleExportNodeImage} onExportNodeJson={handleExportNodeJson} mutationError={document.mutationError} />}
      {!presentationMode && selectedScreenCard && selectedScreenModule && <ScreenProperties key={selectedScreenCard.id} card={selectedScreenCard} module={selectedScreenModule} state={screenStates[selectedScreenCard.id] ?? null} links={selectedScreenCallers} onRename={document.renameCard} onSelect={handleSelect} onClose={() => setSelection([])} />}
      {!presentationMode && contextMenu && (contextMenu.targetId?.kind === 'node' || contextMenu.targetId?.kind === 'module' ? <LogicContextMenu key={contextMenu.id} project={document.project} index={document.index} targetId={contextMenu.targetId} initialSlot={contextMenu.initialSlot} x={contextMenu.x} y={contextMenu.y} onInsert={handleInsert} onDelete={handleDeleteNode} onDeleteModule={handleDeleteModule} onHideCard={handleHideCard} onLockCard={handleToggleLock} targetLocked={isCardLocked(contextMenu.targetId?.id)} onExpansion={(id, expand) => { handleExpansion(id, expand); handleCloseMenu(true) }} canToggleExpansion={contextMenu.targetId?.kind === 'module' && (expandableIds.get(contextMenu.targetId.id)?.length ?? 0) > 0} onOpenGraph={handleOpenNodeGraph} onCopy={handleCopyNode} onPaste={transfers.pasteNode} onDuplicate={transfers.duplicateNode} hasClipboard={transfers.hasClipboard} showBookmark={bookmarkStatus(contextMenu.targetId).show} canBookmark={bookmarkStatus(contextMenu.targetId).can} onBookmark={handleBookmarkTarget} onClose={handleCloseMenu} />
        : <CanvasContextMenu key={contextMenu.id} x={contextMenu.x} y={contextMenu.y} onCreate={handleCreateModule} onClose={handleCloseMenu} anchored={contextMenu.anchored} commentId={contextMenu.targetId ? { id: contextMenu.targetId.id, type: contextMenu.targetId.kind } : null} onDeleteComment={handleDeleteComment} onHideCard={handleHideCard} onLockCard={handleToggleLock} commentLocked={isCardLocked(contextMenu.targetId?.id)} />)}
    </main>
    </div>
  )
}

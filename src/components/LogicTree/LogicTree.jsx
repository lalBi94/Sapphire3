import { memo, useEffect, useRef, useState } from 'react'
import LogicNode from './LogicNode.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './LogicTree.css'

// Rassemble les nœuds du module sans reparcourir tout le projet.
function moduleNodeIds(module, index) {
  return new Set(index.nodeIdsByModule?.get(module.id) ?? [])
}

// Détermine si la sélection contient un nœud de ce module.
function hasSelectedNode(props) {
  if (props.selectedId && props.index.nodes.get(props.selectedId)?.moduleId === props.module.id) return true
  if (!props.selectedIds) return false
  for (const id of props.selectedIds) if (props.index.nodes.get(id)?.moduleId === props.module.id) return true
  return false
}

// Détermine si le nœud exécuté appartient à ce module.
function hasActiveNode(props) {
  return Boolean(props.activeExecutionId) && props.index.nodes.get(props.activeExecutionId)?.moduleId === props.module.id
}

// Signature du dépôt pertinent pour ce module, sans comparer l'objet global.
function dropSignature(props) {
  const drop = props.dropTarget
  if (drop?.kind !== 'node' || props.index.nodes.get(drop.id)?.moduleId !== props.module.id) return ''
  return `${drop.id}:${drop.ok ? 'ok' : 'no'}`
}

// Compare le contenu de deux listes d'identifiants d'exécution.
function sameIds(previous, next) {
  if (previous.length !== next.length) return false
  for (let position = 0; position < previous.length; position += 1) if (previous[position] !== next[position]) return false
  return true
}

// Ne re-rend un arbre que si ce qui le concerne a changé, pas à chaque déplacement de caméra.
function sameTreeProps(previous, next) {
  if (previous.module !== next.module || previous.index !== next.index || previous.readOnly !== next.readOnly) return false
  if (previous.expandedNodeIds !== next.expandedNodeIds) return false
  if (!sameIds(previous.executionExpandedNodeIds, next.executionExpandedNodeIds)) return false
  if (hasSelectedNode(previous) !== hasSelectedNode(next)) return false
  if (hasActiveNode(previous) !== hasActiveNode(next)) return false
  if ((hasActiveNode(previous) || hasActiveNode(next)) && previous.executionSession !== next.executionSession) return false
  if (dropSignature(previous) !== dropSignature(next)) return false
  if (previous.unusedIds !== next.unusedIds || previous.pureIds !== next.pureIds || previous.breakpoints !== next.breakpoints) return false
  if (previous.debugValues !== next.debugValues || previous.genericCalls !== next.genericCalls) return false
  return (previous.onReorder == null) === (next.onReorder == null)
}

// Parcourt les racines source dans leur ordre ; les nœuds sont pliés tant qu'ils ne sont pas dépliés.
function LogicTree({ module, index, selectedId, selectedIds = null, readOnly = false, onSelect, expandedNodeIds, onExpandedChange, onOpenActions, onReorder, activeExecutionId = null, executionExpandedNodeIds = [], executionSession = null, unusedIds = null, pureIds = null, breakpoints = null, onToggleBreakpoint = null, debugValues = null, genericCalls = null, dropTarget }) {
  const knownIds = useRef(null)
  // Nœuds repliés à la main malgré le dépli automatique de la simulation en cours.
  const [executionCollapsed, setExecutionCollapsed] = useState(() => new Set())
  const { t } = useTranslation()

  // Un nouveau Run ou une nouvelle session de debug repart d'un dépli automatique complet.
  useEffect(() => {
    setExecutionCollapsed(new Set())
  }, [executionSession])

  // Déplie les nœuds ajoutés après le montage, ainsi que leurs parents, sans rouvrir l'existant.
  useEffect(() => {
    const current = moduleNodeIds(module, index)
    const previous = knownIds.current
    knownIds.current = current
    if (!previous) return
    const added = [...current].filter((id) => !previous.has(id))
    if (added.length === 0) return
    const next = new Set(expandedNodeIds)
    for (const id of added) {
      let cursor = id
      const visited = new Set()
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor)
        next.add(cursor)
        const parent = index.parents.get(cursor)?.[0]
        cursor = parent?.kind === 'node' ? parent.id : null
      }
    }
    onExpandedChange([...next])
  }, [module, index, expandedNodeIds, onExpandedChange])

  const forcedIds = executionExpandedNodeIds.filter((id) => !executionCollapsed.has(id))
  const expandedIds = new Set([...expandedNodeIds, ...(activeExecutionId ? forcedIds : [])])

  // Mémorise seulement les nœuds explicitement dépliés, sans toucher à la source logique.
  // Un nœud déplié automatiquement par la simulation se replie pour de bon et n'est pas ré-ouvert par la suite.
  function handleToggle(id) {
    const next = new Set(expandedNodeIds)
    if (expandedIds.has(id)) {
      const onlyForced = !next.has(id)
      next.delete(id)
      if (onlyForced) setExecutionCollapsed((current) => new Set(current).add(id))
    } else {
      next.add(id)
      setExecutionCollapsed((current) => {
        if (!current.has(id)) return current
        const remaining = new Set(current)
        remaining.delete(id)
        return remaining
      })
    }
    onExpandedChange([...next])
  }

  return (
    <div className="logic-tree" data-canvas-scroll>
      {module.rootNodeIds.length === 0 && <p className="logic-tree__empty">{t('canvas.addFirst')}</p>}
      {module.rootNodeIds.map((id, position) => <LogicNode key={`${id}:${position}`} id={id} index={index} selectedId={selectedId} selectedIds={selectedIds} readOnly={readOnly} activeExecutionId={activeExecutionId} onSelect={onSelect} ancestors={[]} expandedIds={expandedIds} onToggle={handleToggle} onOpenActions={onOpenActions} dropTarget={dropTarget} onReorder={onReorder} unusedIds={unusedIds} pureIds={pureIds} breakpoints={breakpoints} onToggleBreakpoint={onToggleBreakpoint} debugValues={debugValues} genericCalls={genericCalls} />)}
    </div>
  )
}

export default memo(LogicTree, sameTreeProps)
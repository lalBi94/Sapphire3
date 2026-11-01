import { useEffect, useRef, useState } from 'react'
import LogicNode from './LogicNode.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './LogicTree.css'

// Rassemble les nœuds du module pour repérer ceux réellement ajoutés entre deux rendus.
function moduleNodeIds(module, index) {
  const ids = new Set()
  for (const node of index.nodes.values()) {
    if (node.moduleId === module.id) ids.add(node.id)
  }
  return ids
}

// Parcourt les racines source dans leur ordre ; les nœuds sont pliés tant qu'ils ne sont pas dépliés.
export default function LogicTree({ module, index, selectedId, onSelect, expandedNodeIds, onExpandedChange, onOpenActions, activeExecutionId = null, executionExpandedNodeIds = [], executionSession = null, dropTarget }) {
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
      {module.rootNodeIds.map((id, position) => <LogicNode key={`${id}:${position}`} id={id} index={index} selectedId={selectedId} activeExecutionId={activeExecutionId} onSelect={onSelect} ancestors={[]} expandedIds={expandedIds} onToggle={handleToggle} onOpenActions={onOpenActions} dropTarget={dropTarget} />)}
    </div>
  )
}

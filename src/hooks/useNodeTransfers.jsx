import { useRef, useState } from 'react'
import { captureSourceNode, moveSourceNodes } from '../utils/logic/index.js'
import { useNotifications } from '../contexts/NotificationContext.jsx'
import { useTranslation } from '../contexts/LanguageContext.jsx'
import { failureLabel } from '../utils/translations.js'

const dragType = 'application/x-sapphire-node'

// Vise uniquement le nœud réellement survolé, sans remonter vers un parent compatible de secours.
function dropReceiver(element) {
  if (!(element instanceof Element) || element.closest('[data-canvas-ui], input, textarea, select')) return null
  const node = element.closest('[data-source-node]')
  if (node) return { kind: 'node', id: node.dataset.sourceNode }
  const module = element.closest('[data-source-module]')
  return module ? { kind: 'module', id: module.dataset.sourceModule } : null
}

// Gère le presse-papiers local et les gestes de transfert sans persistance ni API native.
export default function useNodeTransfers({ project, index, selected, selectedNodeIds = [], readOnly = false, workspaceRef, onPaste, onMove, onDuplicate, onTransferred }) {
  const { notify } = useNotifications()
  const { t } = useTranslation()
  const [clipboard, setClipboard] = useState(null)
  const [notice, setNotice] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const dragRef = useRef(null)

  // Évite de réannoncer et de rerendre le même résultat à chaque événement de survol.
  function showNotice(next) {
    setNotice((current) => current?.message === next.message && current?.error === next.error && current?.detail === next.detail && current?.transient === next.transient ? current : next)
  }

  // Publie le résultat final d'un transfert sans retirer le détail contextuel du canvas.
  function publishResult(result, message) {
    notify(result.ok
      ? { type: 'success', message: t(message), key: 'transfer', duration: 3000 }
      : { type: 'warning', message: failureLabel({ code: result.code }, t), key: 'transfer', duration: 6000 })
  }

  // Présente le résultat sans transformer un refus en mutation ou en étape d'historique.
  function finish(result, message) {
    if (result.ok) setNotice(null)
    else showNotice({ error: result.code, detail: result.diagnostics?.[0]?.code })
    publishResult(result, message)
    if (result.ok) onTransferred(result)
    return result
  }

  // Capture une copie indépendante des modifications ultérieures de la source.
  function copyNode(target) {
    const result = captureSourceNode(project, target.id, { index })
    if (result.ok) {
      setClipboard(result.clipboard)
      setNotice(null)
    } else {
      showNotice({ error: result.code })
    }
    publishResult(result, 'transfer.copied')
    return result
  }

  // Colle en bas de l'unique slot compatible du destinataire sélectionné.
  function pasteNode(receiver) {
    if (!clipboard) return finish({ ok: false, code: 'TRANSFER_CLIPBOARD_EMPTY' })
    return finish(onPaste(clipboard, receiver), 'transfer.pasted')
  }

  // Duplique dans la liste parente ; la validation métier reste celle du moteur pur.
  function duplicateNode(target) {
    return finish(onDuplicate(target.id), 'transfer.duplicated')
  }

  // Démarre uniquement depuis le titre d'un nœud de cet onglet, jamais depuis un fichier externe.
  function handleDragStart(event) {
    if (readOnly) { event.preventDefault(); return }
    const heading = event.target.closest('.logic-node__heading')
    if (!heading) return
    const id = heading.closest('[data-source-node]')?.dataset.sourceNode
    if (!id) return
    event.stopPropagation()
    const ids = selectedNodeIds.includes(id) ? selectedNodeIds : [id]
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(dragType, id)
    dragRef.current = { ids, project, cache: new Map() }
    showNotice({ message: 'transfer.dragging', transient: true })
  }

  // Réutilise la validation pendant un même survol, puis invalide le cache au changement de document.
  function probe(receiver) {
    const drag = dragRef.current
    if (drag.project !== project) return { ok: false, code: 'TRANSFER_STALE' }
    const key = JSON.stringify(receiver)
    if (!drag.cache.has(key)) {
      const result = moveSourceNodes(project, drag.ids, receiver, { index })
      drag.cache.set(key, { ok: result.ok, code: result.code })
    }
    return drag.cache.get(key)
  }

  // Affiche un retour positif ou négatif calculé sur l'ensemble du sous-arbre et de ses références.
  function handleDragOver(event) {
    if (readOnly || !dragRef.current) return
    event.preventDefault()
    const receiver = dropReceiver(event.target)
    const result = receiver ? probe(receiver) : { ok: false, code: 'TRANSFER_INCOMPATIBLE' }
    event.dataTransfer.dropEffect = result.ok ? 'move' : 'none'
    setDropTarget((current) => current?.id === receiver?.id && current?.kind === receiver?.kind && current?.ok === result.ok ? current : receiver ? { ...receiver, ok: result.ok } : null)
    showNotice(result.ok ? { message: 'transfer.dropAllowed', transient: true } : { error: result.code, transient: true })
  }

  // Revérifie au dépôt ; un aperçu de survol ne vaut jamais autorisation de mutation.
  function handleDrop(event) {
    if (readOnly) return
    const drag = dragRef.current
    if (!drag) return
    event.preventDefault()
    event.stopPropagation()
    const receiver = dropReceiver(event.target)
    const valid = receiver ? probe(receiver) : { ok: false, code: 'TRANSFER_INCOMPATIBLE' }
    dragRef.current = null
    setDropTarget(null)
    if (!valid.ok) { finish(valid); return }
    finish(onMove(drag.ids, receiver), 'transfer.moved')
  }

  // Retire les indicateurs après annulation ou après sortie de la zone de travail.
  function handleDragEnd() {
    dragRef.current = null
    setDropTarget(null)
    setNotice((current) => current?.transient ? null : current)
  }

  // Efface le presse-papiers lors du remplacement explicite du workspace.
  function reset() {
    setClipboard(null)
    setNotice(null)
    handleDragEnd()
  }

  return { hasClipboard: Boolean(clipboard), notice, dropTarget, copyNode, pasteNode, duplicateNode, reset, dismiss: () => setNotice(null), handleDragStart, handleDragOver, handleDrop, handleDragEnd }
}

import { useEffect, useRef, useState } from 'react'
import { captureSourceModule, captureSourceNode, decodeClipboardPayload, encodeClipboardPayload, moveSourceNodes } from '../utils/logic/index.js'
import { readSystemClipboard, writeSystemClipboard } from '../services/systemClipboard.js'
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

// Gère le presse-papiers local, le presse-papiers système et les gestes de transfert.
export default function useNodeTransfers({ project, index, selected, selectedNodeIds = [], cards = [], readOnly = false, workspaceRef, onPaste, onPasteModule, onCutNode, onCutModule, onMove, onDuplicate, onTransferred }) {
  const { notify } = useNotifications()
  const { t } = useTranslation()
  const [clipboard, setClipboard] = useState(null)
  const [systemClipboardAvailable, setSystemClipboardAvailable] = useState(false)
  const [notice, setNotice] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const dragRef = useRef(null)

  // Vérifie au montage et au retour de focus si le presse-papiers système contient une capture Sapphire.
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const text = await readSystemClipboard()
      if (!cancelled) setSystemClipboardAvailable(Boolean(decodeClipboardPayload(text)))
    }
    void refresh()
    const handleFocus = () => { void refresh() }
    window.addEventListener('focus', handleFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

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

  // Capture un nœud ou un module et publie la capture dans le presse-papiers système.
  function captureTarget(target, message) {
    if (readOnly) return finish({ ok: false, code: 'TRANSFER_READ_ONLY' }, message)
    let result
    if (target?.kind === 'node') result = captureSourceNode(project, target.id, { index })
    else if (target?.kind === 'module') {
      const card = cards.find((entry) => entry.id === target.id) ?? null
      result = captureSourceModule(project, target.id, { card })
    } else result = { ok: false, code: 'TARGET_INVALID' }
    if (result.ok) {
      const source = { kind: target.kind, payload: result.clipboard }
      setClipboard(source)
      setSystemClipboardAvailable(true)
      const encoded = encodeClipboardPayload(target.kind, result.clipboard)
      if (encoded) void writeSystemClipboard(encoded)
      setNotice(null)
    } else {
      showNotice({ error: result.code })
    }
    publishResult(result, message)
    return result
  }

  // Copie la cible sélectionnée dans le presse-papiers local et système.
  function copyTarget(target) {
    return captureTarget(target, 'transfer.copied')
  }

  // Coupe la cible : capture d'abord, suppression seulement si la capture a réussi.
  function cutTarget(target) {
    const result = captureTarget(target, 'transfer.cutDone')
    if (!result.ok) return result
    const removed = target.kind === 'module' ? onCutModule?.(target.id) : onCutNode?.(target.id)
    return removed?.ok === false ? removed : { ...result, cut: true }
  }

  // Colle la capture locale ou, à défaut, une capture présente dans le presse-papiers système.
  async function pasteTarget(receiver, position = null) {
    let source = clipboard
    const text = await readSystemClipboard()
    const decoded = decodeClipboardPayload(text)
    if (decoded) source = decoded
    if (!source) return finish({ ok: false, code: 'TRANSFER_CLIPBOARD_EMPTY' })
    if (source.kind === 'node') {
      if (!receiver) return finish({ ok: false, code: 'TRANSFER_RECEIVER_MISSING' })
      return finish(onPaste(source.payload, receiver), 'transfer.pasted')
    }
    if (source.kind === 'module') {
      if (!onPasteModule) return finish({ ok: false, code: 'TRANSFER_MODULE_UNSUPPORTED' })
      return finish(onPasteModule(source.payload, position), 'transfer.pasted')
    }
    return finish({ ok: false, code: 'TRANSFER_CLIPBOARD_INVALID' })
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

  // Efface le presse-papiers local lors du remplacement explicite du workspace.
  function reset() {
    setClipboard(null)
    setNotice(null)
    handleDragEnd()
  }

  return {
    hasClipboard: Boolean(clipboard) || systemClipboardAvailable,
    notice,
    dropTarget,
    copyNode: copyTarget,
    pasteNode: pasteTarget,
    copyTarget,
    cutTarget,
    pasteTarget,
    duplicateNode,
    reset,
    dismiss: () => setNotice(null),
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  }
}

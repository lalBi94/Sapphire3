import { useRef, useState } from 'react'
import { serializeWorkspace, deserializeWorkspace } from '../utils/workspaceFile.js'
import { exportWorkspaceFile, importWorkspaceFile } from '../services/workspaceFiles.js'

// Prépare les fichiers sans toucher au document actif avant validation et confirmation de remplacement.
export default function useWorkspaceFiles({ project, cards, camera, selected, onReplace }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingImport, setPendingImport] = useState(null)
  const operation = useRef(false)

  // Capture le document au clic et n'annonce le succès qu'après l'écriture native.
  async function handleExport(extension) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const text = serializeWorkspace(project, cards, camera, selected)
      const path = await exportWorkspaceFile(extension, text)
      if (path) setMessage('Workspace exported.')
    } catch (failure) {
      setError(`Export failed: ${failure.message || failure.code || 'Unknown error.'}`)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Valide le fichier choisi avant de demander l'autorisation de remplacer le contenu affiché.
  async function handleImport() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const file = await importWorkspaceFile()
      if (file) setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path })
    } catch (failure) {
      setError(`Import failed: ${failure.message || failure.code || 'Unknown error.'}`)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Remplace le document seulement à la demande explicite de l'utilisateur.
  function handleConfirmImport() {
    if (!pendingImport) return
    onReplace(pendingImport.workspace)
    setPendingImport(null)
    setMessage('Workspace imported.')
  }

  // Conserve intégralement le document courant lorsque l'import est abandonné.
  function handleCancelImport() {
    setPendingImport(null)
  }

  // Efface un message d'échec sans relancer l'opération de fichier.
  function handleDismiss() {
    setError('')
  }

  return { busy, message, error, pendingImport, handleExport, handleImport, handleConfirmImport, handleCancelImport, handleDismiss }
}

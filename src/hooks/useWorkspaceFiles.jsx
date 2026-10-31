import { useEffect, useRef, useState } from 'react'
import { serializeWorkspace, deserializeWorkspace } from '../utils/workspaceFile.js'
import { exportWorkspaceFile, importWorkspaceFile, readWorkspaceFile, writeWorkspaceFile } from '../services/workspaceFiles.js'
import { useTranslation } from '../i18n.jsx'
import { readPreference, writePreference } from '../services/preferences.js'

const recentFilesStorageKey = 'sapphire-recent-sp3-files'
const maximumRecentFiles = 5

// Charge les chemins récents en écartant les valeurs persistées invalides.
function loadRecentFiles() {
  try {
    const stored = JSON.parse(readPreference(recentFilesStorageKey) ?? '[]')
    return Array.isArray(stored) ? stored.filter((path) => typeof path === 'string' && path.toLowerCase().endsWith('.sp3')).slice(0, maximumRecentFiles) : []
  } catch {
    return []
  }
}

// Prépare les fichiers sans toucher au document actif avant validation et confirmation de remplacement.
export default function useWorkspaceFiles({ project, cards, camera, selected, onReplace }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingImport, setPendingImport] = useState(null)
  const [currentPath, setCurrentPath] = useState(null)
  const [recentFiles, setRecentFiles] = useState(loadRecentFiles)
  const operation = useRef(false)

  // Ajoute un chemin en tête de liste et le conserve pour les prochaines sessions.
  function rememberRecentFile(path) {
    const next = [path, ...recentFiles.filter((entry) => entry.toLowerCase() !== path.toLowerCase())].slice(0, maximumRecentFiles)
    setRecentFiles(next)
    writePreference(recentFilesStorageKey, JSON.stringify(next))
  }

  // Retire un chemin devenu inaccessible de la liste persistante.
  function forgetRecentFile(path) {
    const next = recentFiles.filter((entry) => entry.toLowerCase() !== path.toLowerCase())
    setRecentFiles(next)
    writePreference(recentFilesStorageKey, JSON.stringify(next))
  }

  // Capture le document courant dans le format demandé et l'ecrit au chemin choisi.
  async function saveAs(extension = 'sp3') {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const text = serializeWorkspace(project, cards, camera, selected)
      const path = await exportWorkspaceFile(extension, text)
      if (path) {
        if (extension === 'sp3') {
          setCurrentPath(path)
          rememberRecentFile(path)
        }
        setMessage('Workspace saved.')
      }
    } catch (failure) {
      setError(`${t('errors.couldNotSave')} ${failure.message || failure.code || t('errors.default')}`)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Enregistre directement le fichier ouvert, ou ouvre Enregistrer sous pour un nouveau document.
  async function handleSave() {
    if (currentPath) {
      if (operation.current || pendingImport) return
      operation.current = true
      setBusy(true)
      setError('')
      setMessage('')
      try {
        const text = serializeWorkspace(project, cards, camera, selected)
        await writeWorkspaceFile(currentPath, text)
        setMessage('Workspace saved.')
      } catch (failure) {
        setError(`${t('errors.couldNotSave')} ${failure.message || failure.code || t('errors.default')}`)
      } finally {
        operation.current = false
        setBusy(false)
      }
      return
    }
    await saveAs('sp3')
  }

  // Ouvre exclusivement un workspace .sp3 et attend la confirmation avant remplacement.
  async function handleOpenSp3() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const file = await importWorkspaceFile(['sp3'])
      if (file) setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path })
    } catch (failure) {
      setError(`${t('errors.couldNotOpen')} ${failure.message || failure.code || t('errors.default')}`)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Ouvre un chemin recent après avoir vérifié qu'il existe toujours.
  async function handleOpenRecent(path) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const file = await readWorkspaceFile(path)
      setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path })
    } catch (failure) {
      forgetRecentFile(path)
      setError(`${t('errors.couldNotOpen')} ${failure.message || failure.code || t('errors.default')}`)
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
      setError(`${t('errors.couldNotImport')} ${failure.message || failure.code || t('errors.default')}`)
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Remplace le document seulement à la demande explicite de l'utilisateur.
  function handleConfirmImport() {
    if (!pendingImport) return
    onReplace(pendingImport.workspace)
    setCurrentPath(pendingImport.path.toLowerCase().endsWith('.sp3') ? pendingImport.path : null)
    if (pendingImport.path.toLowerCase().endsWith('.sp3')) rememberRecentFile(pendingImport.path)
    setPendingImport(null)
    setMessage('Workspace opened.')
  }

  // Conserve intégralement le document courant lorsque l'import est abandonné.
  function handleCancelImport() {
    setPendingImport(null)
  }

  // Efface un message d'échec sans relancer l'opération de fichier.
  function handleDismiss() {
    setError('')
  }

  useEffect(() => {
    // Intercepte la sauvegarde native sans déclencher celle du navigateur.
    function handleShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      handleSave()
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  })

  return { busy, message, error, pendingImport, recentFiles, handleSave, saveAs, handleOpenSp3, handleOpenRecent, handleImport, handleConfirmImport, handleCancelImport, handleDismiss }
}

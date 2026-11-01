import { useEffect, useRef, useState } from 'react'
import { serializeWorkspace, deserializeWorkspace } from '../utils/workspaceFile.js'
import { exportWorkspaceFile, importWorkspaceFile, readWorkspaceFile, writeWorkspaceFile } from '../services/workspaceFiles.js'
import { useTranslation } from '../contexts/LanguageContext.jsx'
import { readPreference, writePreference, hydratePreferences } from '../services/preferences.js'
import { failureLabel } from '../utils/translations.js'

const recentFilesStorageKey = 'sapphire-recent-sp3-files'
const lastFileStorageKey = 'sapphire-last-sp3-file'
const maximumRecentFiles = 5
const autosaveDelay = 500

// Charge les chemins récents en écartant les valeurs persistées invalides.
function loadRecentFiles() {
  try {
    const stored = JSON.parse(readPreference(recentFilesStorageKey) ?? '[]')
    return Array.isArray(stored) ? stored.filter((path) => typeof path === 'string' && path.toLowerCase().endsWith('.sp3')).slice(0, maximumRecentFiles) : []
  } catch {
    return []
  }
}

// Lit le dernier chemin enregistré, en ignorant une valeur déjà abandonnée ou invalide.
function loadLastFile() {
  const path = readPreference(lastFileStorageKey)
  return typeof path === 'string' && path.toLowerCase().endsWith('.sp3') ? path : null
}

// Prépare les fichiers sans toucher au document actif avant validation et confirmation de remplacement.
export default function useWorkspaceFiles({ project, cards, camera, selected, onReplace }) {
  const { language, t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [pendingImport, setPendingImport] = useState(null)
  const [currentPath, setCurrentPath] = useState(null)
  const [recentFiles, setRecentFiles] = useState(loadRecentFiles)
  const operation = useRef(false)
  const lastSavedText = useRef(null)
  const view = useRef({ camera, selected })
  const booted = useRef(false)

  // Garde la caméra et la sélection les plus récentes pour la sérialisation différée de l'autosave.
  useEffect(() => {
    view.current = { camera, selected }
  }, [camera, selected])

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

  // Associe le document à un chemin et mémorise ce dernier pour la réouverture au prochain lancement.
  function applyCurrentPath(path) {
    setCurrentPath(path)
    writePreference(lastFileStorageKey, path ?? '')
  }

  // Capture le document courant dans le format demandé et l'ecrit au chemin choisi.
  async function saveAs(extension = 'sp3') {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const text = serializeWorkspace(project, cards, camera, selected)
      const path = await exportWorkspaceFile(extension, text, language)
      if (path) {
        if (extension === 'sp3') {
          lastSavedText.current = text
          applyCurrentPath(path)
          rememberRecentFile(path)
        }
        setMessage('files.saved')
      }
    } catch (failure) {
      setError({ prefix: 'errors.couldNotSave', failure })
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
      setError(null)
      setMessage('')
      try {
        const text = serializeWorkspace(project, cards, camera, selected)
        await writeWorkspaceFile(currentPath, text)
        lastSavedText.current = text
        setMessage('files.saved')
      } catch (failure) {
        setError({ prefix: 'errors.couldNotSave', failure })
      } finally {
        operation.current = false
        setBusy(false)
      }
      return
    }
    await saveAs('sp3')
  }

  // Écrit le document sans dialogue ni message : l'autosauvegarde suit chaque modification du contenu.
  async function autosaveToCurrentPath() {
    if (!currentPath || operation.current || pendingImport) return
    const { camera: activeCamera, selected: activeSelected } = view.current
    let text
    try {
      text = serializeWorkspace(project, cards, activeCamera, activeSelected)
    } catch (failure) {
      setError({ prefix: 'errors.couldNotSave', failure })
      return
    }
    if (text === lastSavedText.current) return
    operation.current = true
    try {
      await writeWorkspaceFile(currentPath, text)
      lastSavedText.current = text
    } catch (failure) {
      // L'absence d'environnement natif n'est pas bloquante pour le mode web, ne pas perturber l'interface.
      if (failure.code !== 'DESKTOP_REQUIRED') {
        setError({ prefix: 'errors.couldNotSave', failure })
      }
    } finally {
      operation.current = false
    }
  }

  // Ouvre exclusivement un workspace .sp3 et attend la confirmation avant remplacement.
  async function handleOpenSp3() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const file = await importWorkspaceFile(['sp3'], language)
      if (file) setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path, text: file.text })
    } catch (failure) {
      setError({ prefix: 'errors.couldNotOpen', failure })
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
    setError(null)
    setMessage('')
    try {
      const file = await readWorkspaceFile(path)
      setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path, text: file.text })
    } catch (failure) {
      forgetRecentFile(path)
      setError({ prefix: 'errors.couldNotOpen', failure })
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
    setError(null)
    setMessage('')
    try {
      const file = await importWorkspaceFile(['sp3', 'json'], language)
      if (file) setPendingImport({ workspace: deserializeWorkspace(file.text), path: file.path, text: file.text })
    } catch (failure) {
      setError({ prefix: 'errors.couldNotImport', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Remplace le document seulement à la demande explicite de l'utilisateur.
  function handleConfirmImport() {
    if (!pendingImport) return
    onReplace(pendingImport.workspace)
    lastSavedText.current = pendingImport.text
    applyCurrentPath(pendingImport.path.toLowerCase().endsWith('.sp3') ? pendingImport.path : null)
    if (pendingImport.path.toLowerCase().endsWith('.sp3')) rememberRecentFile(pendingImport.path)
    setPendingImport(null)
    setMessage('files.opened')
  }

  // Conserve intégralement le document courant lorsque l'import est abandonné.
  function handleCancelImport() {
    setPendingImport(null)
  }

  // Efface un message d'échec sans relancer l'opération de fichier.
  function handleDismiss() {
    setError(null)
  }

  // Recharge la liste durable puis rouvre le dernier fichier .sp3 sans dialogue, le document étant neuf.
  async function openLastFileOnStartup() {
    await hydratePreferences()
    setRecentFiles(loadRecentFiles())
    const path = loadLastFile()
    if (!path || operation.current || pendingImport) return
    operation.current = true
    try {
      const file = await readWorkspaceFile(path)
      onReplace(deserializeWorkspace(file.text))
      lastSavedText.current = file.text
      setCurrentPath(path)
      setMessage('files.opened')
    } catch (failure) {
      // Sans client natif (dev web), on ne détruit pas la mémoire du dernier fichier ; on retient seulement un fichier réellement introuvable.
      if (failure?.code === 'DESKTOP_REQUIRED') return
      forgetRecentFile(path)
      writePreference(lastFileStorageKey, '')
    } finally {
      operation.current = false
    }
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

  useEffect(() => {
    // Ne rouvre qu'une seule fois le dernier fichier, même sous StrictMode.
    if (booted.current) return
    booted.current = true
    openLastFileOnStartup()
  }, [])

  useEffect(() => {
    // Planifie une autosauvegarde après chaque changement de contenu, sans écrire pendant les déplacements de vue.
    if (!currentPath) return undefined
    const timer = window.setTimeout(autosaveToCurrentPath, autosaveDelay)
    return () => window.clearTimeout(timer)
  }, [project, cards, currentPath])

  return { busy, message: message ? t(message) : '', error: error ? `${t(error.prefix)} ${failureLabel(error.failure, t)}` : '', pendingImport, recentFiles, handleSave, saveAs, handleOpenSp3, handleOpenRecent, handleImport, handleConfirmImport, handleCancelImport, handleDismiss }
}

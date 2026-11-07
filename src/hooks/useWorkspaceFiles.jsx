import { useEffect, useRef, useState } from 'react'
import { serializeWorkspace, deserializeWorkspace, emptyWorkspace } from '../utils/workspaceFile.js'
import { solutionFileName } from '../utils/exercise.js'
import {
  openWorkspaceFolder, readWorkspaceFolder, writeWorkspaceDocument, writeWorkspaceDocumentWithBackup,
  chooseWorkspaceFolder, workspaceDocumentNameIn, confirmWorkspaceReplace,
  storeWorkspaceImage, readWorkspaceImage, exportWorkspaceArchive as exportWorkspaceArchiveFile,
  exportWorkspaceFile, exportBinaryFile, importWorkspaceFile,
  readRecoveryFile, writeRecoveryFile, clearRecoveryFile, workspaceDocumentName,
} from '../services/workspaceFiles.js'
import { useTranslation } from '../contexts/LanguageContext.jsx'
import { useNotifications } from '../contexts/NotificationContext.jsx'
import { readPreference, writePreference, hydratePreferences } from '../services/preferences.js'
import { examples } from '../utils/examples.js'
import { failureLabel } from '../utils/translations.js'
import { bytesToDataUrl, dataUrlToBytes, dataUrlMimeType, imageExtension } from '../utils/embeddedImage.js'

const recentWorkspacesStorageKey = 'sapphire-recent-workspaces'
const lastWorkspaceStorageKey = 'sapphire-last-workspace'
const legacyRecentFilesStorageKey = 'sapphire-recent-sp3-files'
const legacyLastFileStorageKey = 'sapphire-last-sp3-file'
const maximumRecentWorkspaces = 5
const autosaveDelay = 500

// Extrait le dossier d'un ancien chemin de fichier, pour migrer les préférences sans perdre l'historique.
function folderOfPath(path) {
  const normalized = String(path).replace(/[\\/]+$/, '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return index > 0 ? normalized.slice(0, index) : normalized
}

// Charge les dossiers récents, en convertissant une seule fois l'ancienne liste de fichiers.
function loadRecentWorkspaces() {
  try {
    const stored = readPreference(recentWorkspacesStorageKey)
    if (stored !== null) {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.filter((folder) => typeof folder === 'string' && folder.length > 0).slice(0, maximumRecentWorkspaces) : []
    }
    const legacy = JSON.parse(readPreference(legacyRecentFilesStorageKey) ?? '[]')
    const migrated = Array.isArray(legacy) ? legacy.filter((path) => typeof path === 'string').map(folderOfPath).slice(0, maximumRecentWorkspaces) : []
    if (migrated.length > 0) writePreference(recentWorkspacesStorageKey, JSON.stringify(migrated))
    return migrated
  } catch {
    return []
  }
}

// Lit le dernier dossier de workspace, en convertissant une ancienne valeur de fichier.
function loadLastWorkspace() {
  const stored = readPreference(lastWorkspaceStorageKey)
  if (typeof stored === 'string' && stored.length > 0) return stored
  const legacy = readPreference(legacyLastFileStorageKey)
  return typeof legacy === 'string' && legacy.toLowerCase().endsWith('.sp3') ? folderOfPath(legacy) : null
}

// Lit un fichier choisi en data URL pour l'afficher immédiatement dans la carte Image.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(Object.assign(new Error('IMAGE_READ_FAILED'), { code: 'IMAGE_READ_FAILED' })))
    reader.readAsDataURL(file)
  })
}

// Prépare les dossiers de workspace sans toucher au document actif avant validation et confirmation de remplacement.
export default function useWorkspaceFiles({ project, cards, camera, selected, exercise = null, onReplace, onUpdateImage }) {
  const { language, t } = useTranslation()
  const { notify } = useNotifications()
  const [busy, setBusy] = useState(false)
  const [pendingImport, setPendingImport] = useState(null)
  const [pendingNew, setPendingNew] = useState(false)
  const [currentFolder, setCurrentFolder] = useState(null)
  const [recentWorkspaces, setRecentWorkspaces] = useState(loadRecentWorkspaces)
  const [imageSources, setImageSources] = useState({})
  const [ready, setReady] = useState(false)
  const operation = useRef(false)
  const lastSavedText = useRef(null)
  const lastRecoveryText = useRef(null)
  const documentNameRef = useRef(workspaceDocumentName)
  const view = useRef({ camera, selected, exercise })
  const booted = useRef(false)

  // Choisit l'expression et la durée adaptées à un message de fichier.
  function messageType(key) {
    if (key === 'files.exported') return 'export_success'
    if (key === 'exercise.solutionSaved') return 'export_success'
    if (key === 'files.saved' || key === 'files.recovered' || key === 'files.autosaved') return 'saved'
    if (key === 'files.opened') return 'import_success'
    if (key === 'files.new') return 'success'
    if (key === 'files.savedWithoutBackup') return 'warning'
    return 'info'
  }

  // Publie le feedback centralisé d'une opération de fichier réussie.
  function publishMessage(key) {
    if (!key) return
    notify({ type: messageType(key), message: t(key), key: `file-message:${key}`, duration: key === 'files.savedWithoutBackup' ? 0 : 4500 })
  }

  // Publie une alerte persistante pour une opération de fichier en échec.
  function publishError(value) {
    if (!value) return
    notify({ type: 'error', message: `${t(value.prefix)} ${failureLabel(value.failure, t)}`, key: 'file-error', duration: 0 })
  }

  // Garde la caméra et la sélection les plus récentes pour la sérialisation différée de l'autosave.
  useEffect(() => {
    view.current = { camera, selected, exercise }
  }, [camera, selected, exercise])

  // Ajoute un dossier en tête de liste et le conserve pour les prochaines sessions.
  function rememberRecentWorkspace(folder) {
    const next = [folder, ...recentWorkspaces.filter((entry) => entry.toLowerCase() !== folder.toLowerCase())].slice(0, maximumRecentWorkspaces)
    setRecentWorkspaces(next)
    writePreference(recentWorkspacesStorageKey, JSON.stringify(next))
  }

  // Retire un dossier devenu inaccessible de la liste persistante.
  function forgetRecentWorkspace(folder) {
    const next = recentWorkspaces.filter((entry) => entry.toLowerCase() !== folder.toLowerCase())
    setRecentWorkspaces(next)
    writePreference(recentWorkspacesStorageKey, JSON.stringify(next))
  }

  // Associe le document à un dossier et mémorise ce dernier pour la réouverture au prochain lancement.
  function applyCurrentFolder(folder, documentName = workspaceDocumentName) {
    documentNameRef.current = documentName
    setCurrentFolder(folder)
    writePreference(lastWorkspaceStorageKey, folder ?? '')
  }

  // Supprime la copie de récupération ; un échec réel reste réessayé par l'autosauvegarde suivante.
  async function discardRecovery() {
    if (lastRecoveryText.current === null) return
    try {
      await clearRecoveryFile()
      lastRecoveryText.current = null
    } catch (failure) {
      if (failure?.code === 'DESKTOP_REQUIRED') {
        lastRecoveryText.current = null
        return
      }
      // Le document est déjà enregistré : un nettoyage de récupération impossible est un avertissement, pas un échec de sauvegarde.
      console.warn('Recovery copy could not be cleaned up.', failure)
      notify({ type: 'warning', message: t('files.recoveryCleanupFailed'), key: 'file-warning', duration: 6000 })
    }
  }

  // Recharge les images liées du workspace pour les afficher dans les cartes.
  async function loadImages(folder, workspace) {
    if (!folder) {
      setImageSources({})
      return
    }
    const next = {}
    for (const card of workspace.presentation.cards) {
      if (card.type !== 'image' || !card.imageRef) continue
      try {
        const { bytes, mimeType } = await readWorkspaceImage(folder, card.imageRef)
        next[card.imageRef] = bytesToDataUrl(bytes, mimeType)
      } catch {
        // Une image absente ou illisible laisse la carte vide, sans bloquer le reste du workspace.
      }
    }
    setImageSources(next)
  }

  // Écrit les images encore intégrées dans le dossier `images/` et renvoie les cartes converties.
  async function promoteEmbeddedImages(folder, sourceCards) {
    const nextCards = sourceCards.map((card) => ({ ...card }))
    const sources = {}
    const promoted = []
    for (const card of nextCards) {
      if (card.type !== 'image' || card.imageRef || !card.image) continue
      const bytes = dataUrlToBytes(card.image)
      if (!bytes) continue
      const reference = await storeWorkspaceImage(folder, `${card.id}.${imageExtension(dataUrlMimeType(card.image))}`, bytes)
      sources[reference] = card.image
      card.imageRef = reference
      card.image = ''
      promoted.push({ id: card.id, reference })
    }
    return { cards: nextCards, sources, promoted }
  }

  // Reporte les images promues dans le document actif après une écriture réussie.
  function applyPromoted(prepared) {
    for (const { id, reference } of prepared.promoted) onUpdateImage(id, { imageRef: reference, image: '' })
    if (Object.keys(prepared.sources).length > 0) setImageSources((current) => ({ ...current, ...prepared.sources }))
  }

  // Prépare le document et son texte pour un enregistrement dans un dossier.
  async function prepareDocument(folder) {
    if (!folder) {
      return { cards, sources: {}, promoted: [], text: serializeWorkspace(project, cards, camera, selected, exercise) }
    }
    const prepared = await promoteEmbeddedImages(folder, cards)
    const text = serializeWorkspace(project, prepared.cards, camera, selected, exercise)
    return { ...prepared, text }
  }

  // Prépare le contenu complet d'une archive : document interne et images, liées ou intégrées.
  async function prepareArchive(folder) {
    const nextCards = cards.map((card) => ({ ...card }))
    const entries = []
    for (const card of nextCards) {
      if (card.type !== 'image') continue
      if (card.imageRef) {
        if (!folder) continue
        try {
          const { bytes } = await readWorkspaceImage(folder, card.imageRef)
          entries.push({ name: card.imageRef, data: bytes })
        } catch {
          // Une image introuvable reste référencée ; l'archive signale ainsi le manque sans bloquer l'export.
        }
        continue
      }
      if (!card.image) continue
      const bytes = dataUrlToBytes(card.image)
      if (!bytes) continue
      const reference = `images/${card.id}.${imageExtension(dataUrlMimeType(card.image))}`
      card.imageRef = reference
      card.image = ''
      entries.push({ name: reference, data: bytes })
    }
    const text = serializeWorkspace(project, nextCards, camera, selected, exercise)
    return [{ name: workspaceDocumentName, data: new TextEncoder().encode(text) }, ...entries]
  }

  // Enregistre le document courant dans un nouveau dossier de workspace.
  async function saveWorkspaceAs() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const folder = await chooseWorkspaceFolder(language)
      if (!folder) return
      const existing = await workspaceDocumentNameIn(folder)
      if (existing && !await confirmWorkspaceReplace(language)) return
      const documentName = existing ?? workspaceDocumentName
      const prepared = await prepareDocument(folder)
      await writeWorkspaceDocument(folder, prepared.text, null, documentName)
      applyPromoted(prepared)
      lastSavedText.current = prepared.text
      applyCurrentFolder(folder, documentName)
      rememberRecentWorkspace(folder)
      await discardRecovery()
      publishMessage('files.saved')
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Exporte un document annexe (SVG, code, JSON de nœud) au chemin choisi, sans changer le workspace courant.
  async function exportText(extension, text) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const path = await exportWorkspaceFile(extension, text, language)
      if (path) publishMessage('files.exported')
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Exporte le workspace complet en archive ZIP, document interne et images comprises.
  async function exportWorkspaceArchive(defaultName = null) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const entries = await prepareArchive(currentFolder)
      const name = defaultName ?? `${currentFolder ? currentFolder.split(/[\\/]/).filter(Boolean).pop() : 'workspace'}.zip`
      const path = await exportWorkspaceArchiveFile(entries, language, name)
      if (path) publishMessage('files.exported')
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Enregistre une copie corrigée en archive, sans changer le dossier courant ni les workspaces récents.
  async function saveSolution(title) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const entries = await prepareArchive(currentFolder)
      const name = solutionFileName(title)
      const path = await exportWorkspaceArchiveFile(entries, language, name)
      if (path) publishMessage('exercise.solutionSaved')
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Exporte un contenu binaire (image PNG) au chemin choisi, sans changer le workspace courant.
  async function exportBinary(extension, bytes) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const path = await exportBinaryFile(extension, bytes, language)
      if (path) publishMessage('files.exported')
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Enregistre directement le dossier ouvert, ou choisit un dossier pour un nouveau workspace.
  async function handleSave() {
    if (currentFolder) {
      if (operation.current || pendingImport) return
      operation.current = true
      setBusy(true)
      try {
        const prepared = await prepareDocument(currentFolder)
        const saved = await writeWorkspaceDocumentWithBackup(currentFolder, prepared.text, null, documentNameRef.current)
        applyPromoted(prepared)
        lastSavedText.current = prepared.text
        await discardRecovery()
        publishMessage(saved.backupError ? 'files.savedWithoutBackup' : 'files.saved')
        if (saved.backupError) console.warn('Workspace backup could not be written.', saved.backupError)
      } catch (failure) {
        publishError({ prefix: 'errors.couldNotSave', failure })
      } finally {
        operation.current = false
        setBusy(false)
      }
      return
    }
    await saveWorkspaceAs()
  }

  // Écrit le document sans dialogue : dossier associé, ou copie de récupération pour un document sans dossier.
  async function autosaveWorkspace() {
    if (operation.current || pendingImport) return
    const { camera: activeCamera, selected: activeSelected, exercise: activeExercise } = view.current
    let text
    try {
      text = serializeWorkspace(project, cards, activeCamera, activeSelected, activeExercise)
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
      return
    }
    if (currentFolder) {
      if (text === lastSavedText.current) {
        await discardRecovery()
        return
      }
      operation.current = true
      try {
        await writeWorkspaceDocument(currentFolder, text, null, documentNameRef.current)
        lastSavedText.current = text
        await discardRecovery()
      } catch (failure) {
        // L'absence d'environnement natif n'est pas bloquante pour le mode web, ne pas perturber l'interface.
        if (failure.code !== 'DESKTOP_REQUIRED') {
          publishError({ prefix: 'errors.couldNotSave', failure })
        }
      } finally {
        operation.current = false
      }
      return
    }
    // Un document vierge n'a pas besoin de copie de récupération.
    if (!hasUnsavedContent()) {
      await discardRecovery()
      return
    }
    if (text === lastRecoveryText.current) return
    const firstRecovery = lastRecoveryText.current === null
    operation.current = true
    try {
      await writeRecoveryFile(text)
      lastRecoveryText.current = text
      if (firstRecovery) publishMessage('files.autosaved')
    } catch (failure) {
      if (failure?.code !== 'DESKTOP_REQUIRED') {
        publishError({ prefix: 'errors.couldNotSave', failure })
      }
    } finally {
      operation.current = false
    }
  }

  // Ouvre le dossier de workspace choisi et attend la confirmation avant remplacement.
  async function handleOpenWorkspace() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const workspace = await openWorkspaceFolder(language)
      if (workspace) setPendingImport({ workspace: deserializeWorkspace(workspace.text), folder: workspace.folder, documentName: workspace.documentName, text: workspace.text })
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotOpen', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Ouvre un dossier récent après avoir vérifié qu'il existe toujours.
  async function handleOpenRecent(folder) {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const workspace = await readWorkspaceFolder(folder)
      setPendingImport({ workspace: deserializeWorkspace(workspace.text), folder: workspace.folder, documentName: workspace.documentName, text: workspace.text })
    } catch (failure) {
      forgetRecentWorkspace(folder)
      publishError({ prefix: 'errors.couldNotOpen', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Importe un ancien fichier `.sp3` ou `.json` ; les images intégrées sont converties au premier enregistrement.
  async function handleImport() {
    if (operation.current || pendingImport) return
    operation.current = true
    setBusy(true)
    try {
      const file = await importWorkspaceFile(['sp3', 'json'], language)
      if (file) setPendingImport({ workspace: deserializeWorkspace(file.text), folder: null, text: file.text })
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotImport', failure })
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  // Prépare un exemple local puis attend la confirmation avant de remplacer le document.
  function handleOpenExample(exampleId) {
    if (operation.current || pendingImport) return
    const example = examples.find((entry) => entry.id === exampleId)
    if (!example) return
    try {
      const text = JSON.stringify(example.build())
      setPendingImport({ workspace: deserializeWorkspace(text), folder: null, text, detail: t(example.labelKey) })
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotOpen', failure })
    }
  }

  // Remplace le document seulement à la demande explicite de l'utilisateur.
  async function handleConfirmImport() {
    if (!pendingImport) return
    const folder = typeof pendingImport.folder === 'string' ? pendingImport.folder : null
    onReplace(pendingImport.workspace)
    lastSavedText.current = folder ? pendingImport.text : null
    applyCurrentFolder(folder, pendingImport.documentName ?? workspaceDocumentName)
    if (folder) rememberRecentWorkspace(folder)
    await loadImages(folder, pendingImport.workspace)
    discardRecovery()
    setPendingImport(null)
    publishMessage('files.opened')
  }

  // Conserve intégralement le document courant lorsque l'import est abandonné.
  function handleCancelImport() {
    setPendingImport(null)
  }

  // Détecte un document jamais enregistré dont le contenu disparaîtrait en repartant à zéro.
  function hasUnsavedContent() {
    return !currentFolder && (cards.length > 0 || project.modules.length > 0 || project.nodes.length > 0)
  }

  // Crée un workspace vierge dans un dossier choisi, ou en mémoire si le mode web ne fournit pas de fichiers.
  async function startNewWorkspace() {
    setPendingNew(false)
    await autosaveWorkspace()
    let folder = null
    try {
      folder = await chooseWorkspaceFolder(language)
    } catch (failure) {
      if (failure?.code !== 'DESKTOP_REQUIRED') {
        publishError({ prefix: 'errors.couldNotSave', failure })
        return
      }
    }
    if (folder === null && typeof window !== 'undefined' && typeof window.NL_TOKEN === 'string' && window.NL_PORT) return
    const workspace = emptyWorkspace()
    if (folder) {
      try {
        const existing = await workspaceDocumentNameIn(folder)
        if (existing && !await confirmWorkspaceReplace(language)) return
        const documentName = existing ?? workspaceDocumentName
        const text = serializeWorkspace(workspace.project, workspace.presentation.cards, workspace.presentation.camera, null, null)
        await writeWorkspaceDocument(folder, text, null, documentName)
        lastSavedText.current = text
        applyCurrentFolder(folder, documentName)
        rememberRecentWorkspace(folder)
        await discardRecovery()
      } catch (failure) {
        publishError({ prefix: 'errors.couldNotSave', failure })
        return
      }
    } else {
      lastSavedText.current = null
      applyCurrentFolder(null)
      await discardRecovery()
    }
    onReplace(workspace)
    setImageSources({})
    publishMessage('files.new')
  }

  // Repart d'un document vierge, après confirmation seulement si des modifications risquent d'être perdues.
  function handleNew() {
    if (operation.current || pendingImport) return
    if (hasUnsavedContent()) { setPendingNew(true); return }
    startNewWorkspace()
  }

  // Confirme et démarre le nouveau document après validation explicite.
  function handleConfirmNew() {
    startNewWorkspace()
  }

  // Annule le démarrage et conserve intégralement le document courant.
  function handleCancelNew() {
    setPendingNew(false)
  }

  // Restaure une copie non enregistrée valide, sinon rouvre le dernier dossier de workspace sans dialogue.
  async function openLastWorkspaceOnStartup() {
    await hydratePreferences()
    setRecentWorkspaces(loadRecentWorkspaces())
    operation.current = true
    try {
      let recovery = null
      try {
        recovery = await readRecoveryFile()
      } catch (failure) {
        // Le mode web n'a pas de répertoire de données : aucune récupération à tenter.
        if (failure?.code !== 'DESKTOP_REQUIRED') publishError({ prefix: 'errors.couldNotOpen', failure })
      }
      if (recovery) {
        try {
          onReplace(deserializeWorkspace(recovery.text))
          lastRecoveryText.current = recovery.text
          setImageSources({})
          publishMessage('files.recovered')
          return
        } catch {
          // Une copie illisible est écartée sans empêcher l'ouverture du dernier workspace.
          try {
            await clearRecoveryFile()
          } catch (failure) {
            if (failure?.code !== 'DESKTOP_REQUIRED') publishError({ prefix: 'errors.couldNotSave', failure })
          }
        }
      }
      const folder = loadLastWorkspace()
      if (!folder) return
      try {
        const workspace = await readWorkspaceFolder(folder)
        const parsed = deserializeWorkspace(workspace.text)
        onReplace(parsed)
        lastSavedText.current = workspace.text
        applyCurrentFolder(folder, workspace.documentName)
        await loadImages(folder, parsed)
        publishMessage('files.opened')
      } catch (failure) {
        // Sans client natif (dev web), on ne détruit pas la mémoire du dernier dossier ; on retient seulement un dossier réellement introuvable.
        if (failure?.code === 'DESKTOP_REQUIRED') return
        forgetRecentWorkspace(folder)
        writePreference(lastWorkspaceStorageKey, '')
      }
    } finally {
      operation.current = false
      setReady(true)
    }
  }

  // Ajoute une image : copiée dans `images/` si le workspace a un dossier, sinon conservée en attendant le premier enregistrement.
  async function handleImageFile(cardId, file) {
    if (!file || !String(file.type).startsWith('image/')) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (currentFolder) {
        const reference = await storeWorkspaceImage(currentFolder, file.name, await file.arrayBuffer())
        setImageSources((current) => ({ ...current, [reference]: dataUrl }))
        onUpdateImage(cardId, { imageRef: reference, image: '' })
      } else {
        onUpdateImage(cardId, { image: dataUrl, imageRef: undefined })
      }
    } catch (failure) {
      publishError({ prefix: 'errors.couldNotSave', failure })
    }
  }

  // Renvoie la source d'affichage d'une carte Image : image liée chargée, sinon image intégrée.
  function imageSourceFor(card) {
    if (!card || card.type !== 'image') return null
    if (card.imageRef) return imageSources[card.imageRef] ?? ''
    return card.image ?? ''
  }

  useEffect(() => {
    // Ne rouvre qu'une seule fois le dernier workspace, même sous StrictMode.
    if (booted.current) return
    booted.current = true
    openLastWorkspaceOnStartup()
  }, [])

  useEffect(() => {
    // Planifie une autosauvegarde après chaque changement de contenu, sans écrire pendant les déplacements de vue.
    if (!ready) return undefined
    const timer = window.setTimeout(autosaveWorkspace, autosaveDelay)
    return () => window.clearTimeout(timer)
  }, [project, cards, currentFolder, ready])

  return {
    busy, pendingImport, pendingNew, recentWorkspaces, currentFolder, imageSources, imageSourceFor,
    handleImageFile, handleSave, saveWorkspaceAs, exportWorkspaceArchive, saveSolution, exportText, exportBinary,
    handleOpenWorkspace, handleOpenRecent, handleImport, handleOpenExample, handleConfirmImport, handleCancelImport,
    handleNew, handleConfirmNew, handleCancelNew,
  }
}
